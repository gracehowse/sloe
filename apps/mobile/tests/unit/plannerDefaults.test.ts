/**
 * Planner defaults — wave-2 (2026-04-30 audit-vs-competitors) FIX 1,
 * plus the ENG-1646 fix (2026-07-21).
 *
 * Plan IS a week tool. Defaulting to a 1-day plan hid the "wow" of a
 * planned week behind a tap and made Plan look like Today with extra
 * steps. Wave-2 changed the initial `days` state from 1 to 7 and added
 * a clamp so free-tier users (who can't generate >1-day plans) are
 * bumped back to 1 once the async tier resolves.
 *
 * ENG-1646: that clamp was ONE-WAY (`if (isFree && !ref.current)
 * setDays(1)`, no else branch). `userTier` starts as "free" on every
 * cold mount (before the async cached-tier/RC/profile resolve
 * completes), so the clamp fired on first render for EVERY user —
 * including Pro — and once tier resolved to non-free, nothing ever
 * restored `days` back to 7. A separate effect that re-synced `days`
 * to a loaded plan's length made this self-reinforcing (permanently
 * stuck at 1, even after upgrading). Net effect: "Generate week" only
 * ever produced a 1-day plan, for every mobile user, since the
 * ENG-1225 flag-collapse made the manual day-count picker unreachable
 * under `sloe_v3_plan` (default-on). Fixed by (a) making the clamp
 * two-way, (b) gating the reload-sync effect behind `!sloeV3Plan`
 * (nothing in the v3 IA reads `days` for display), and (c) computing
 * the actual generation day count live (`effectiveDays = isFree ? 1 :
 * days`) instead of trusting persisted `days` state — mirrors web's
 * proven-correct `useMealPlanRegenerate.ts` pattern.
 *
 * Mounting the full Plan screen in vitest is heavy (Supabase / RC /
 * AsyncStorage / expo-haptics). This is a structural source-level
 * check that pins:
 *
 *   1. `useState<1 | 3 | 7>(7)` — Pro-default 7-day plan.
 *   2. The `useEffect` sync is TWO-WAY (both clamps to 1 for free AND
 *      restores 7 for non-free), not a one-way clamp.
 *   3. The free-tier clamp respects user choice via a ref guard so a
 *      Pro user who tapped "1" doesn't get bumped back to 7.
 *   4. `generatePlan` computes `effectiveDays` live from `isFree`
 *      rather than trusting `days` state, and uses it for the actual
 *      `generateSmartPlan` call.
 *   5. The plan-length reload-sync effect is gated off under
 *      `sloeV3Plan` so a stale/free-tier plan length can't corrupt a
 *      later Pro-tier generate.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PLANNER_PATH = resolve(__dirname, "../../app/(tabs)/planner.tsx");
const SRC = readFileSync(PLANNER_PATH, "utf8");

describe("Planner defaults (wave-2 FIX 1)", () => {
  it("defaults the days picker to 7 (week-view-first)", () => {
    expect(SRC).toMatch(/useState<1 \| 3 \| 7>\(7\)/);
  });

  it("does NOT default to 1 (regression guard against the old behaviour)", () => {
    // Catch any future refactor that re-introduces the 1-day default.
    expect(SRC).not.toMatch(/useState<1 \| 3 \| 7>\(1\)/);
  });

  it("declares a userPickedDaysRef to gate the free-tier clamp", () => {
    expect(SRC).toContain("userPickedDaysRef");
    // Default false so the first effect run after isFree resolves can
    // legitimately clamp.
    expect(SRC).toMatch(/userPickedDaysRef\s*=\s*useRef\(false\)/);
  });

  it("marks the ref true on every chip tap so a Pro user who chose 1 isn't bumped back to 7", () => {
    // Both day-picker chip onPress handlers must set the flag.
    const occurrences = SRC.split("userPickedDaysRef.current = true").length - 1;
    // We have two day-pickers: the initial generate UI + the expanded
    // "regenerate setup" UI. Both must mark the ref.
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});

describe("Planner tier-clamp is two-way (ENG-1646 regression guard)", () => {
  it("syncs days to isFree ? 1 : 7 rather than one-way-clamping to 1", () => {
    expect(SRC).toMatch(
      /if\s*\(!userPickedDaysRef\.current\)\s*{\s*setDays\(isFree \? 1 : 7\);?\s*}/,
    );
  });

  it("does NOT reintroduce the one-way clamp (no else branch, never restores)", () => {
    // The old bug: `if (isFree && !ref.current) setDays(1)` with no
    // path back to 7 once isFree resolves false. Guard against a
    // future refactor silently dropping the two-way sync.
    expect(SRC).not.toMatch(/if\s*\(isFree\s*&&\s*!userPickedDaysRef\.current\)\s*{\s*setDays\(1\)/);
  });
});

describe("generatePlan computes the day count live from tier (ENG-1646)", () => {
  it("declares effectiveDays = isFree ? 1 : days inside generatePlan", () => {
    expect(SRC).toMatch(/const effectiveDays = isFree \? 1 : days;/);
  });

  it("passes effectiveDays (not raw days) into generateSmartPlan", () => {
    expect(SRC).toMatch(/generateSmartPlan\(\{[\s\S]{0,200}?days: effectiveDays,/);
  });
});

describe("plan-length reload-sync is gated off under sloe_v3_plan (ENG-1646)", () => {
  it("skips re-syncing `days` to the loaded plan length when sloeV3Plan is on", () => {
    expect(SRC).toMatch(/if \(!plan\?\.length \|\| sloeV3Plan\) return;/);
  });
});
