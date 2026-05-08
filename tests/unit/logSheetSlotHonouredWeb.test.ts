/**
 * 2026-05-08 build-47 follow-up — Grace TF (open feedback):
 *
 *   "items keep getting added to fields by time of day rather than for
 *   the meal i am trying to add them to for example i clikc + for
 *   breakfast but its the afternoon it adds it as snack"
 *
 * Web parity for `apps/mobile/tests/unit/logSheetSlotHonoured.test.ts`.
 * Per project rule (memory: feedback_mobile_decisions_apply_to_web):
 * the same fix lands on web in the same commit.
 *
 * Pre-fix on web: three pick-handlers in NutritionTracker.tsx used
 * `currentSlotFromTime` instead of `mealSlot`, so the LogSheet header
 * showed one slot but logging committed to a different one.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
const SRC = readFileSync(
  resolve(REPO, "src/app/components/NutritionTracker.tsx"),
  "utf8",
);

describe("build-47 — web LogSheet pick-handlers honour mealSlot", () => {
  it("recents.onPick passes mealSlot to logHistoryItem", () => {
    expect(SRC).toMatch(/logHistoryItem\(\s*found,\s*mealSlot\s*\)/);
  });

  it("saved.onPick passes mealSlot to logSavedMeal", () => {
    expect(SRC).toMatch(/logSavedMeal\(\s*meal,\s*mealSlot\s*\)/);
  });

  it("library.onPick uses `mealSlot as MealSlot` as the planned-meal slot", () => {
    expect(SRC).toMatch(/const\s+slot\s*=\s*mealSlot\s+as\s+MealSlot;/);
  });

  it("regression guard: library.onPick must NOT route through journalSlotFromMealTypes", () => {
    // Pre-fix shape: const slot = recipe.mealSlots
    //   ? (journalSlotFromMealTypes(...) as MealSlot)
    //   : (currentSlotFromTime as MealSlot);
    expect(SRC).not.toMatch(
      /const\s+slot\s*=\s*recipe\.mealSlots[\s\S]{0,200}journalSlotFromMealTypes/,
    );
  });
});

describe("build-47 — web generic LogSheet-open paths reset mealSlot to time-of-day", () => {
  it("module-level slotForHour helper exists and covers the 4 buckets", () => {
    expect(SRC).toMatch(/function\s+slotForHour\(/);
    const fnMatch = SRC.match(
      /function\s+slotForHour\([\s\S]+?return\s+["']Dinner["'];?\s*\}/,
    );
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

  it("openLogParam deep-link resets mealSlot before opening", () => {
    const idx = SRC.indexOf('openLogParam !== "1"');
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 600);
    const setMealSlotIdx = slice.indexOf("setMealSlot(slotForHour");
    const setOpenIdx = slice.indexOf("setLogSheetOpen(true)");
    expect(setMealSlotIdx).toBeGreaterThan(-1);
    expect(setOpenIdx).toBeGreaterThan(-1);
    expect(setMealSlotIdx).toBeLessThan(setOpenIdx);
  });

  it("empty-state CTA resets mealSlot before opening the LogSheet", () => {
    const idx = SRC.indexOf("empty_state_cta_clicked");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 800);
    const setMealSlotIdx = slice.indexOf("setMealSlot(slotForHour");
    const setOpenIdx = slice.indexOf("setLogSheetOpen(true)");
    expect(setMealSlotIdx).toBeGreaterThan(-1);
    expect(setOpenIdx).toBeGreaterThan(-1);
    expect(setMealSlotIdx).toBeLessThan(setOpenIdx);
  });

  it("TodayMealsSection onOpenLogSheet wire-up resets mealSlot before opening", () => {
    // Find the `onOpenLogSheet={...}` prop on the slot-section render.
    const idx = SRC.indexOf("onOpenLogSheet={");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 300);
    expect(slice).toContain("setMealSlot(slotForHour");
    expect(slice).toContain("setLogSheetOpen(true)");
    const setMealSlotIdx = slice.indexOf("setMealSlot(slotForHour");
    const setOpenIdx = slice.indexOf("setLogSheetOpen(true)");
    expect(setMealSlotIdx).toBeLessThan(setOpenIdx);
  });

  it("slot-specific Add form (`+ Slot` row) sets mealSlot from the tapped slot", () => {
    expect(SRC).toMatch(
      /onOpenAddForSlot=\{\s*\(slot\)\s*=>\s*\{[\s\S]{0,80}setMealSlot\(slot\);[\s\S]{0,80}setAddOpen\(true\);[\s\S]{0,40}\}\s*\}/,
    );
  });
});
