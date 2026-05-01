/**
 * Mobile cook-completion polish (audit P1, 2026-04-30).
 *
 * Two converging fixes covered here:
 *
 *  1. FIX 2 — parsed-duration countdown timers. When the current step
 *     text contains a parseable duration ("bake for 25 minutes"), the
 *     timer counts DOWN from that duration instead of forcing the user
 *     to tap "Start Timer" with no idea how long to set it for. Reuses
 *     the shared `parseTimersInStep` helper so mobile + web mark the
 *     same phrases as durations.
 *
 *  2. FIX 3 — calmer completion card. Replaces the static 🎉 + "Enjoy
 *     your meal!" hero with a usable surface: captured cook duration,
 *     1-tap rating row, "Add to my regulars" that writes a saved meal.
 *     Audit finding: "🎉 emoji is the entire celebration. No haptics
 *     on completion. No rating. No 'save to my regulars'. No shareable
 *     card."
 *
 * Pure-helper unit tests live here for `formatCookDuration`,
 * `pickDefaultRegularsSlot`, `parseCookHistory`, `medianCookDuration`,
 * `appendCookHistoryEntry` — all in `apps/mobile/lib/cookSession.ts`
 * so they can be imported without dragging Expo Router / RN into the
 * test environment.
 *
 * Structural source-level assertions cover the React-rendered surface
 * (the cook screen depends on Expo Router + RN primitives that
 * vitest/jsdom can't render — RNTL install lives on the R7 backlog).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  appendCookHistoryEntry,
  COOK_HISTORY_MAX_ENTRIES,
  formatCookDuration,
  medianCookDuration,
  parseCookHistory,
  pickDefaultRegularsSlot,
  type CookHistoryEntry,
} from "../../lib/cookSession";

const COOK_PATH = resolve(__dirname, "../../app/cook.tsx");
const SOURCE = readFileSync(COOK_PATH, "utf8");

describe("formatCookDuration (pure helper)", () => {
  it("renders 0 seconds as 0m 00s", () => {
    expect(formatCookDuration(0)).toBe("0m 00s");
  });

  it("zero-pads seconds under 10", () => {
    expect(formatCookDuration(65)).toBe("1m 05s");
  });

  it("formats whole minutes without rounding", () => {
    expect(formatCookDuration(600)).toBe("10m 00s");
  });

  it("preserves the seconds portion past round minutes", () => {
    expect(formatCookDuration(620)).toBe("10m 20s");
  });

  it("stays in minutes past 60 (subjective time-spent label)", () => {
    expect(formatCookDuration(3725)).toBe("62m 05s");
  });

  it("clamps negative input to 0", () => {
    expect(formatCookDuration(-30)).toBe("0m 00s");
  });

  it("rejects NaN", () => {
    expect(formatCookDuration(Number.NaN)).toBe("0m 00s");
  });

  it("rejects Infinity", () => {
    expect(formatCookDuration(Number.POSITIVE_INFINITY)).toBe("0m 00s");
  });
});

describe("pickDefaultRegularsSlot (pure helper)", () => {
  // Anchor each hour to a fixed Date so tests do not depend on the
  // runner's local TZ — but we DO check `getHours()` reads, which is
  // local. `setHours()` keeps the local hour stable regardless of CI.
  const at = (h: number, m: number = 0): Date =>
    new Date(2026, 3, 30, h, m, 0, 0);

  it("Breakfast at 7am", () => {
    expect(pickDefaultRegularsSlot(at(7))).toBe("Breakfast");
  });

  it("Breakfast at midnight (lower edge)", () => {
    expect(pickDefaultRegularsSlot(at(0))).toBe("Breakfast");
  });

  it("Breakfast at 10:59 (just before the cutoff)", () => {
    expect(pickDefaultRegularsSlot(at(10, 59))).toBe("Breakfast");
  });

  it("Lunch at 11am (the < 11h cutoff means 11h itself goes to Lunch)", () => {
    expect(pickDefaultRegularsSlot(at(11))).toBe("Lunch");
  });

  it("Lunch at 13:00", () => {
    expect(pickDefaultRegularsSlot(at(13))).toBe("Lunch");
  });

  it("Snacks at 15:00", () => {
    expect(pickDefaultRegularsSlot(at(15))).toBe("Snacks");
  });

  it("Snacks at 16:30", () => {
    expect(pickDefaultRegularsSlot(at(16, 30))).toBe("Snacks");
  });

  it("Dinner at 17:00", () => {
    expect(pickDefaultRegularsSlot(at(17))).toBe("Dinner");
  });

  it("Dinner at 23:30", () => {
    expect(pickDefaultRegularsSlot(at(23, 30))).toBe("Dinner");
  });
});

describe("parseCookHistory (pure helper)", () => {
  it("returns [] for non-array input", () => {
    expect(parseCookHistory(null)).toEqual([]);
    expect(parseCookHistory({})).toEqual([]);
    expect(parseCookHistory("oops")).toEqual([]);
  });

  it("drops malformed entries silently", () => {
    expect(
      parseCookHistory([
        { durationSec: 600, ts: 1 },
        { durationSec: -1, ts: 1 },
        { durationSec: 0, ts: 1 },
        { durationSec: NaN, ts: 1 },
        { ts: 1 },
        null,
        { durationSec: 300, ts: NaN },
      ]),
    ).toEqual([{ durationSec: 600, ts: 1 }]);
  });

  it("preserves valid entries verbatim", () => {
    const valid: CookHistoryEntry[] = [
      { durationSec: 600, ts: 1700000000000 },
      { durationSec: 720, ts: 1700000060000 },
    ];
    expect(parseCookHistory(valid)).toEqual(valid);
  });
});

describe("medianCookDuration (pure helper)", () => {
  it("returns null for empty history", () => {
    expect(medianCookDuration([])).toBeNull();
  });

  it("returns the single entry for a one-element history", () => {
    expect(medianCookDuration([{ durationSec: 420, ts: 1 }])).toBe(420);
  });

  it("returns the middle entry for an odd-length sorted history", () => {
    const hist: CookHistoryEntry[] = [
      { durationSec: 300, ts: 1 },
      { durationSec: 600, ts: 2 },
      { durationSec: 900, ts: 3 },
    ];
    expect(medianCookDuration(hist)).toBe(600);
  });

  it("returns the rounded average of the two centre values for even-length", () => {
    const hist: CookHistoryEntry[] = [
      { durationSec: 300, ts: 1 },
      { durationSec: 500, ts: 2 },
      { durationSec: 600, ts: 3 },
      { durationSec: 900, ts: 4 },
    ];
    // (500 + 600) / 2 = 550
    expect(medianCookDuration(hist)).toBe(550);
  });

  it("ignores non-finite durations", () => {
    const hist: CookHistoryEntry[] = [
      { durationSec: 600, ts: 1 },
      { durationSec: NaN, ts: 2 },
      { durationSec: 900, ts: 3 },
    ];
    expect(medianCookDuration(hist)).toBe(750);
  });

  it("handles unsorted input", () => {
    const hist: CookHistoryEntry[] = [
      { durationSec: 900, ts: 1 },
      { durationSec: 300, ts: 2 },
      { durationSec: 600, ts: 3 },
    ];
    expect(medianCookDuration(hist)).toBe(600);
  });
});

describe("appendCookHistoryEntry (pure helper)", () => {
  it("appends to an empty history", () => {
    expect(
      appendCookHistoryEntry([], { durationSec: 600, ts: 1 }),
    ).toEqual([{ durationSec: 600, ts: 1 }]);
  });

  it("preserves prior order with new entry at the end", () => {
    const prior: CookHistoryEntry[] = [
      { durationSec: 300, ts: 1 },
      { durationSec: 400, ts: 2 },
    ];
    expect(
      appendCookHistoryEntry(prior, { durationSec: 500, ts: 3 }),
    ).toEqual([
      { durationSec: 300, ts: 1 },
      { durationSec: 400, ts: 2 },
      { durationSec: 500, ts: 3 },
    ]);
  });

  it("caps the array at COOK_HISTORY_MAX_ENTRIES, keeping the most recent", () => {
    const prior: CookHistoryEntry[] = Array.from(
      { length: COOK_HISTORY_MAX_ENTRIES },
      (_, i) => ({ durationSec: 100 + i, ts: i + 1 }),
    );
    const next = appendCookHistoryEntry(prior, {
      durationSec: 999,
      ts: 9999,
    });
    expect(next.length).toBe(COOK_HISTORY_MAX_ENTRIES);
    // The oldest entry (durationSec: 100, ts: 1) should be evicted.
    expect(next[0]).toEqual({ durationSec: 101, ts: 2 });
    expect(next[next.length - 1]).toEqual({ durationSec: 999, ts: 9999 });
  });

  it("does not mutate the input array", () => {
    const prior: CookHistoryEntry[] = [{ durationSec: 600, ts: 1 }];
    appendCookHistoryEntry(prior, { durationSec: 700, ts: 2 });
    expect(prior).toEqual([{ durationSec: 600, ts: 1 }]);
  });
});

describe("Cook screen — FIX 2 (parsed-duration timer) source structure", () => {
  it("imports parseTimersInStep from the shared recipeTimers module", () => {
    // Critical: must reuse the SHARED helper (web + mobile single
    // source of truth) — not roll its own regex. A new regex here
    // would let the two platforms classify "bake 25 minutes" as a
    // timer differently and the user-facing pill copy would drift.
    expect(SOURCE).toMatch(
      /\bparseTimersInStep\b[^;]*from\s+["'][^"']+recipeTimers["']/,
    );
  });

  it("imports the lucide Timer icon for the suggested-duration pill", () => {
    // Lucide icon set per Claude Design prototype carryover rules.
    // Don't substitute an Ionicons or Material equivalent. Allow the
    // common rename pattern (`Timer as TimerIcon`) so we don't shadow
    // the React Native `Timer` global.
    expect(SOURCE).toMatch(
      /\bTimer(?:\s+as\s+\w+)?[^}]*\}\s*from\s+["']lucide-react-native["']/,
    );
  });

  it("renders the 'Set {N}:NN timer' pill copy from the spec", () => {
    expect(SOURCE).toMatch(/Set \$\{formatTimer\([^)]*totalSeconds\)\} timer/);
  });

  it("supports count-down mode via timerDurationSec state", () => {
    expect(SOURCE).toMatch(/setTimerDurationSec\b/);
    // Count-down readout subtracts elapsed from duration so the user
    // sees the remaining time, not the elapsed.
    expect(SOURCE).toMatch(/timerDurationSec\s*-\s*timerElapsed/);
  });

  it("falls back to count-up stopwatch when no duration is parsed", () => {
    // The audit rule: "If no duration in current step text, fall back
    // to the current count-up stopwatch behaviour. Don't break the
    // existing UX." `Start stopwatch` is the user-visible label that
    // confirms the fallback path renders.
    expect(SOURCE).toMatch(/Start stopwatch/);
  });

  it("fires Success haptic + step-done prompt when the countdown completes", () => {
    expect(SOURCE).toMatch(/Haptics\.NotificationFeedbackType\.Success/);
    // The step-done prompt is an Alert with Restart / Next step
    // buttons. Anchor on both choices so a future tweak that only
    // shows one option still flags here.
    expect(SOURCE).toMatch(/Timer done/);
    expect(SOURCE).toMatch(/text:\s*"Restart"/);
    expect(SOURCE).toMatch(/text:\s*"Next step"/);
  });

  it("pulses the suggested-duration pill before the user taps it", () => {
    // Pulse stops once a timer is active; that gate is what makes the
    // pulse a hint, not a permanent dance.
    expect(SOURCE).toMatch(/showSuggestedPill/);
    expect(SOURCE).toMatch(/Animated\.loop/);
  });
});

describe("Cook screen — FIX 3 (completion polish) source structure", () => {
  it("imports expo-haptics for the on-completion success haptic", () => {
    expect(SOURCE).toMatch(/from\s+["']expo-haptics["']/);
  });

  it("captures cook session duration on isDone transition", () => {
    expect(SOURCE).toMatch(/sessionStartRef\.current/);
    expect(SOURCE).toMatch(/setCookDurationSec\b/);
  });

  it("persists cook history per recipe to AsyncStorage", () => {
    // Schema-less but durable — the per-recipe history feeds the
    // future "you usually cook this in N min" surface. No backend
    // table exists yet (CLAUDE.md: never invent backend); local-first.
    expect(SOURCE).toMatch(/persistCookHistoryEntry/);
    expect(SOURCE).toMatch(/COOK_HISTORY_KEY_PREFIX/);
    expect(SOURCE).toMatch(/AsyncStorage\.setItem/);
  });

  it("delegates the cap-and-slice math to the pure appendCookHistoryEntry helper", () => {
    // Without the cap a frequently-cooked recipe would balloon
    // AsyncStorage. The pure helper enforces it; the screen reuses.
    expect(SOURCE).toMatch(/appendCookHistoryEntry/);
  });

  it("renders 'Recipe done.' as the completion title (calm posture)", () => {
    // Audit: "calmer completion card" — no exclamation marks, no
    // confetti, no 'you crushed it!' copy. The full-stop is load-
    // bearing copy.
    expect(SOURCE).toMatch(/Recipe done\./);
  });

  it("renders the captured cook duration on the completion card", () => {
    // JSX expression interpolation, not a template literal — so the
    // surrounding braces don't carry a leading `$`.
    expect(SOURCE).toMatch(/Took you \{formatCookDuration\(cookDurationSec\)\}/);
  });

  it("renders 5 tappable star icons for the rating row", () => {
    // Five stars from the prototype carryover rule (lucide icon set).
    expect(SOURCE).toMatch(/\[1,\s*2,\s*3,\s*4,\s*5\]/);
    expect(SOURCE).toMatch(/<Star\b/);
  });

  it("rating dots have per-N accessibility labels", () => {
    // a11y rule from the spec: rating dots are tappable,
    // accessibilityLabel "Rate {N} stars".
    expect(SOURCE).toMatch(/Rate \$\{n\} star\$\{n === 1 \? "" : "s"\}/);
  });

  it("'Add to my regulars' button writes via createSavedMeal", () => {
    expect(SOURCE).toMatch(
      /createSavedMeal\b[^;]*from\s+["'][^"']+savedMeals["']/,
    );
    // Auto-detect slot from time of day so the saved meal lands in
    // the right slot without prompting the user.
    expect(SOURCE).toMatch(/pickDefaultRegularsSlot/);
  });

  it("does not render the static 🎉 emoji as the entire celebration", () => {
    // The original done state was literally `<Text>🎉</Text>` as the
    // hero. Keeping a regex that catches the failure mode.
    expect(SOURCE).not.toMatch(/<Text style=\{styles\.doneIcon\}>🎉<\/Text>/);
    // And the "Enjoy your meal!" copy is the wrong posture per audit.
    // Allow the historical reference inside the audit-trail comment
    // (a load-bearing explanation of what we replaced) — only flag
    // a JSX `<Text>` rendering of the old copy.
    expect(SOURCE).not.toMatch(/<Text[^>]*>\s*Enjoy your meal!\s*<\/Text>/);
  });

  it("preserves the 'Log this meal' P2-24 path so we don't break the journal hook", () => {
    expect(SOURCE).toMatch(/cook_mode_log_tapped/);
    expect(SOURCE).toMatch(/autoLog=1/);
  });
});
