/**
 * 2026-05-08 build-47 follow-up — Grace TF (open feedback):
 *
 *   "items keep getting added to fields by time of day rather than for
 *   the meal i am trying to add them to for example i clikc + for
 *   breakfast but its the afternoon it adds it as snack"
 *
 * The bug: three pick-handlers on the FAB sheet (recents / saved /
 * library) used `currentSlotFromTime` instead of `activeMealSlot`,
 * silently overriding the user's slot choice. Plus two FAB-open
 * paths (deep-link from the global tab-bar `+`, the empty-state CTA)
 * never reset `activeMealSlot`, so a stale value from earlier could
 * leak into the LogSheet header and the pick-handlers.
 *
 * Static-pin tests so the regression can't sneak back in via a
 * future refactor of (tabs)/index.tsx.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// ENG-773 (2026-05-30): slotForHour now lives in the shared lib (single
// source of truth) — import it for real rather than regex-pinning a
// local copy in index.tsx.
import {
  slotForHour,
  fallbackSlotFromTimeOfDay,
} from "../../../../src/lib/nutrition/recipeJournalSlot";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const SRC = readFileSync(
  resolve(REPO, "apps/mobile/app/(tabs)/index.tsx"),
  "utf8",
);

describe("build-47 — LogSheet pick-handlers honour activeMealSlot", () => {
  it("recents.onPick logs via logHistoryItemFromSheet, which honours activeMealSlot", () => {
    // The recents path used `currentSlotFromTime` pre-fix (build-47). The ENG-1099
    // Today rebuild routes recents through `logHistoryItemFromSheet(found)`, a
    // useCallback that stamps the user-chosen slot (`name: activeMealSlot`, with
    // activeMealSlot in its dep array) — NOT time-of-day. Pin both the recents
    // call and that the callback honours the active slot, so a revert to
    // time-of-day on either side still fails.
    expect(SRC).toMatch(/logHistoryItemFromSheet\(\s*found\s*\)/);
    // Tempered-greedy: anchor on the FIRST `name:` inside the callback and
    // require it to be activeMealSlot. A plain `[\s\S]*?` slides past a reverted
    // `name: currentSlotFromTime` to a later `name: activeMealSlot` elsewhere in
    // this 3,400-line file, so the build-47 revert would false-pass;
    // `(?:(?!name:)[\s\S])*?` cannot cross a `name:`, so the assertion fails if
    // the callback's first `name:` isn't activeMealSlot.
    expect(SRC).toMatch(
      /const logHistoryItemFromSheet = useCallback\((?:(?!name:)[\s\S])*?name:\s*activeMealSlot/,
    );
    // Negative belt-and-braces: the build-47 time-of-day helpers must not
    // appear as a slot source anywhere in the file.
    expect(SRC).not.toMatch(/name:\s*currentSlotFromTime/);
    expect(SRC).not.toMatch(/name:\s*slotForHour\(/);
  });

  it("saved.onPick passes activeMealSlot to logSavedMealFromPanel", () => {
    expect(SRC).toMatch(
      /logSavedMealFromPanel\(\s*meal,\s*activeMealSlot\s*\)/,
    );
  });

  it("library.onPick uses activeMealSlot as the planned-meal name (slot)", () => {
    // The library path used `journalSlotFromMealTypes(...)` pre-fix.
    // That helper does its own time-of-day fallback, which silently
    // ignored the user's slot choice. Look for `name: activeMealSlot`
    // inside the logPlannedMealWithPortion call.
    const libraryIdx = SRC.indexOf("logPlannedMealWithPortion");
    expect(libraryIdx).toBeGreaterThan(-1);
    // Find the FIRST library-onPick logPlannedMealWithPortion call
    // (there are several in the file). Easiest: search for the
    // inline `name: activeMealSlot` near a library-recipe log path.
    const slice = SRC.slice(libraryIdx);
    expect(slice).toMatch(/name:\s*activeMealSlot/);
  });

  it("regression guard: pick-handlers must NOT route through journalSlotFromMealTypes", () => {
    // The pre-fix library path used journalSlotFromMealTypes((recipe.mealSlots ?? []) as string[])
    // which fell back to time-of-day when the recipe had no meal_type.
    // That call must no longer appear inside a logPlannedMealWithPortion(...) name field.
    expect(SRC).not.toMatch(
      /name:\s*journalSlotFromMealTypes\(\s*\(\s*recipe\.mealSlots/,
    );
  });
});

describe("build-47 — generic FAB-open paths reset activeMealSlot to time-of-day", () => {
  it("imports the shared slotForHour helper (single source of truth)", () => {
    // ENG-773: the quick-log path now uses the shared ladder so it can
    // never drift from the recipe-log path again.
    expect(SRC).toMatch(
      /import\s*\{[^}]*\bslotForHour\b[^}]*\}\s*from\s*["']@suppr\/shared\/nutrition\/recipeJournalSlot["']/,
    );
    // The old local copy (its own 10/14/17 cutoffs) must be gone.
    expect(SRC).not.toMatch(/function\s+slotForHour\(/);
  });

  it("deep-link FAB (params.openLog === '1') resets activeMealSlot before opening", () => {
    // 2026-06-12 (audit P2 #5): the openLog open/clear + dismiss effects
    // moved out of index.tsx into the unit-tested `useLogSheetDeepLinks`
    // hook. The slot-reset-before-open ordering now lives there — pin it
    // in the hook source. The behavioural proof (open opens + clears, and
    // the slot is reset) is in `useLogSheetDeepLinks.test.ts`; this static
    // pin guards the build-47 ordering specifically.
    const hookSrc = readFileSync(
      resolve(REPO, "apps/mobile/hooks/useLogSheetDeepLinks.ts"),
      "utf8",
    );
    // The hook checks `params.openLog === "1"` twice: first as the
    // early-return guard in the dismissal effect, then as the opener
    // condition. Pin the SECOND (opener) branch, where the slot reset sits.
    const dismissIdx = hookSrc.indexOf('params.openLog === "1"');
    expect(dismissIdx).toBeGreaterThan(-1);
    const openerIdx = hookSrc.indexOf('params.openLog === "1"', dismissIdx + 1);
    expect(openerIdx).toBeGreaterThan(-1);
    const slice = hookSrc.slice(openerIdx, openerIdx + 600);
    const setActiveIdx = slice.indexOf("setActiveMealSlot(slotForHour");
    const setOpenIdx = slice.indexOf("setFabSheetOpen(true)");
    expect(setActiveIdx).toBeGreaterThan(-1);
    expect(setOpenIdx).toBeGreaterThan(-1);
    expect(setActiveIdx).toBeLessThan(setOpenIdx);
  });

  it("empty-state CTA resets activeMealSlot before opening the sheet", () => {
    // The empty-state onLogMeal handler also fires the analytics
    // `empty_state_cta_clicked` event before opening; the reset must
    // sit between the analytics call and setFabSheetOpen(true).
    const idx = SRC.indexOf("empty_state_cta_clicked");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 800);
    const setActiveIdx = slice.indexOf("setActiveMealSlot(slotForHour");
    const setOpenIdx = slice.indexOf("setFabSheetOpen(true)");
    expect(setActiveIdx).toBeGreaterThan(-1);
    expect(setOpenIdx).toBeGreaterThan(-1);
    expect(setActiveIdx).toBeLessThan(setOpenIdx);
  });

  it("slot-specific FAB (`+ Breakfast` etc.) sets activeMealSlot from the tapped slot", () => {
    // The onOpenFabForSlot prop on TodayMealsSection wires the tapped
    // slot into setActiveMealSlot(slot). Pin that the slot arg is
    // forwarded straight through (not coerced via slotForHour).
    expect(SRC).toMatch(
      /onOpenFabForSlot=\{\s*\(slot\)\s*=>\s*\{\s*setActiveMealSlot\(slot\);\s*setFabSheetOpen\(true\);\s*\}\s*\}/,
    );
  });
});

describe("ENG-773 — unified canonical slot ladder (11/15/17)", () => {
  it("slotForHour buckets: breakfast <11, lunch <15, snacks <17, dinner ≥17", () => {
    for (let h = 0; h < 24; h++) {
      const slot = slotForHour(h);
      if (h < 11) expect(slot).toBe("Breakfast");
      else if (h < 15) expect(slot).toBe("Lunch");
      else if (h < 17) expect(slot).toBe("Snacks");
      else expect(slot).toBe("Dinner");
    }
  });

  it("fallbackSlotFromTimeOfDay delegates to slotForHour (no divergent ladder)", () => {
    // The pre-ENG-773 bug: index.tsx used 10/14/17 while the shared
    // recipe-log path used 11/15/17, so the same clock time bucketed
    // a 10–11am / 2–3pm log into different meals by entry path.
    for (let h = 0; h < 24; h++) {
      const d = new Date(2026, 0, 1, h, 30, 0);
      expect(fallbackSlotFromTimeOfDay(d)).toBe(slotForHour(h));
    }
  });
});

describe("ENG-773 — mobile LogSheet slot selector is flag-gated", () => {
  it("wraps the LogSheet `slot` prop in isFeatureEnabled('log-sheet-slot-selector')", () => {
    // The visible picker is new structure, so per CLAUDE.md it ships
    // behind a flag. `activeMealSlot` is still threaded through every
    // commit path regardless — only the picker UI is gated.
    expect(SRC).toMatch(
      /slot=\{[\s\S]{0,200}isFeatureEnabled\(\s*["']log-sheet-slot-selector["']\s*\)[\s\S]{0,160}current:\s*activeMealSlot/,
    );
  });

  it("passes the canonical MEAL_SLOTS as the selector options (no local list)", () => {
    expect(SRC).toMatch(/options:\s*MEAL_SLOTS/);
  });

  it("imports isFeatureEnabled from the analytics module", () => {
    expect(SRC).toMatch(
      /import\s*\{[^}]*\bisFeatureEnabled\b[^}]*\}\s*from\s*["']@\/lib\/analytics["']/,
    );
  });
});
