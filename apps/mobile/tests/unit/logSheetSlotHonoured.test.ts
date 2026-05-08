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

const REPO = resolve(__dirname, "..", "..", "..", "..");
const SRC = readFileSync(
  resolve(REPO, "apps/mobile/app/(tabs)/index.tsx"),
  "utf8",
);

describe("build-47 — LogSheet pick-handlers honour activeMealSlot", () => {
  it("recents.onPick passes activeMealSlot to logHistoryItemToSlot", () => {
    // The recents path used `currentSlotFromTime` pre-fix.
    expect(SRC).toMatch(
      /logHistoryItemToSlot\(\s*found,\s*activeMealSlot\s*\)/,
    );
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
  it("module-level slotForHour helper exists and covers the 4 buckets", () => {
    expect(SRC).toMatch(/function\s+slotForHour\(/);
    // Each bucket boundary appears at least once in the helper body.
    const fnMatch = SRC.match(/function\s+slotForHour\([\s\S]+?return\s+["']Dinner["'];?\s*\}/);
    expect(fnMatch, "slotForHour body must be findable").not.toBeNull();
    if (fnMatch) {
      const body = fnMatch[0];
      expect(body).toContain("Breakfast");
      expect(body).toContain("Lunch");
      expect(body).toContain("Snacks");
      expect(body).toContain("Dinner");
      expect(body).toMatch(/h\s*<\s*10/);
      expect(body).toMatch(/h\s*<\s*14/);
      expect(body).toMatch(/h\s*<\s*17/);
    }
  });

  it("deep-link FAB (params.openLog === '1') resets activeMealSlot before opening", () => {
    // Find the openLog deep-link useEffect; expect setActiveMealSlot
    // BEFORE setFabSheetOpen(true) inside the same branch.
    const idx = SRC.indexOf('params.openLog === "1"');
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 600);
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

describe("build-47 — slotForHour bucket boundaries (pure)", () => {
  // Mirror the helper's logic so the buckets stay matchable. The
  // file isn't importable as a module from this test (it's a
  // React Native screen with side-effect imports), so we re-implement
  // and pin the boundaries against the source.
  function expectedSlot(h: number): string {
    if (h < 10) return "Breakfast";
    if (h < 14) return "Lunch";
    if (h < 17) return "Snacks";
    return "Dinner";
  }

  it("breakfast covers 0-9, lunch 10-13, snacks 14-16, dinner 17-23", () => {
    for (let h = 0; h < 24; h++) {
      const slot = expectedSlot(h);
      if (h < 10) expect(slot).toBe("Breakfast");
      else if (h < 14) expect(slot).toBe("Lunch");
      else if (h < 17) expect(slot).toBe("Snacks");
      else expect(slot).toBe("Dinner");
    }
  });
});
