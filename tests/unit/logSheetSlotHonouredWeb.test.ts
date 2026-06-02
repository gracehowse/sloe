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
  it("ENG-773 — imports the shared slotForHour ladder (no local 10/14/17 copy)", () => {
    // Web now uses the single-source helper from `recipeJournalSlot` so
    // it can never drift from mobile again. The old module-level copy
    // (its own 10/14/17 cutoffs) is gone; the shared ladder is 11/15/17,
    // verified bucket-by-bucket in `recipeJournalSlot.test.ts` +
    // `apps/mobile/tests/unit/logSheetSlotHonoured.test.ts`.
    expect(SRC).toMatch(
      /import\s*\{[\s\S]*?\bslotForHour\b[\s\S]*?\}\s*from\s*["']\.\.\/\.\.\/lib\/nutrition\/recipeJournalSlot["']/,
    );
    expect(SRC).not.toMatch(/function\s+slotForHour\(/);
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

describe("ENG-773 — web LogSheet slot selector is flag-gated", () => {
  it("wraps the LogSheet `slot` prop in isFeatureEnabled('log-sheet-slot-selector')", () => {
    // The visible picker is new structure, so per CLAUDE.md it ships
    // behind a flag. `mealSlot` is still threaded through every commit
    // path regardless — only the picker UI is gated.
    expect(SRC).toMatch(
      /slot=\{[\s\S]{0,120}isFeatureEnabled\(\s*["']log-sheet-slot-selector["']\s*\)[\s\S]{0,160}current:\s*mealSlot/,
    );
  });

  it("passes the canonical MEAL_SLOTS as the selector options (no local list)", () => {
    expect(SRC).toMatch(/options:\s*MEAL_SLOTS/);
  });
});
