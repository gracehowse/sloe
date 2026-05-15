/**
 * Plan diff helper tests — Group E Card 4 (premium-bar audit
 * 2026-05-14).
 *
 * The Plan tab's regenerate toast ("Plan updated — N meals changed")
 * relies on `countChangedMealsInPlan` to count slot-by-slot
 * differences between the pre-regenerate snapshot and the new plan.
 * If this helper miscounts, the toast either lies to the user (the
 * change number doesn't match what they see) or never fires (the
 * toast surface goes silent).
 *
 * These tests protect:
 *   - exact-match plans report 0 changes (suppresses toast)
 *   - every slot swapped reports the full slot count
 *   - mixed changes count correctly (recipeId swap, title swap)
 *   - day-count change (plan length flip) counts correctly
 *   - slot-count change inside a day (snack toggled off) counts
 *   - placeholder slots (no recipeId, only title) compared by title
 *   - empty meal vs. populated meal counts as 1 change
 *   - null / empty plan inputs report 0 (defensive)
 */
import { describe, expect, it } from "vitest";
import { countChangedMealsInPlan } from "../../src/lib/mealPlan/planDiff";

function mkMeal(recipeId: string | null, recipeTitle?: string | null) {
  return {
    recipeId,
    recipeTitle: recipeTitle ?? null,
  };
}

describe("countChangedMealsInPlan", () => {
  it("returns 0 when plans match slot-for-slot", () => {
    const plan = [
      { meals: [mkMeal("r1"), mkMeal("r2"), mkMeal("r3")] },
      { meals: [mkMeal("r4"), mkMeal("r5"), mkMeal("r6")] },
    ];
    expect(countChangedMealsInPlan(plan, plan)).toBe(0);
  });

  it("counts every slot as changed when all recipes swap", () => {
    const prev = [
      { meals: [mkMeal("r1"), mkMeal("r2"), mkMeal("r3")] },
      { meals: [mkMeal("r4"), mkMeal("r5"), mkMeal("r6")] },
    ];
    const next = [
      { meals: [mkMeal("r10"), mkMeal("r20"), mkMeal("r30")] },
      { meals: [mkMeal("r40"), mkMeal("r50"), mkMeal("r60")] },
    ];
    expect(countChangedMealsInPlan(prev, next)).toBe(6);
  });

  it("counts a mix of changes correctly", () => {
    const prev = [
      { meals: [mkMeal("r1"), mkMeal("r2"), mkMeal("r3")] },
      { meals: [mkMeal("r4"), mkMeal("r5"), mkMeal("r6")] },
    ];
    // Day 0: slot 0 swapped. Day 1: slot 2 swapped. = 2 changes.
    const next = [
      { meals: [mkMeal("r1-new"), mkMeal("r2"), mkMeal("r3")] },
      { meals: [mkMeal("r4"), mkMeal("r5"), mkMeal("r6-new")] },
    ];
    expect(countChangedMealsInPlan(prev, next)).toBe(2);
  });

  it("identifies meals by recipeId first (title change alone is no-op)", () => {
    // Same recipeId, different title (renamed). recipeId wins —
    // the user has the same dish so the slot is unchanged.
    const prev = [{ meals: [mkMeal("r1", "Old name")] }];
    const next = [{ meals: [mkMeal("r1", "New name")] }];
    expect(countChangedMealsInPlan(prev, next)).toBe(0);
  });

  it("falls back to recipeTitle when recipeId is null on both sides", () => {
    // Placeholder slots with no recipeId — title is the identity.
    const prev = [{ meals: [mkMeal(null, "Eggs")] }];
    const next = [{ meals: [mkMeal(null, "Eggs")] }];
    expect(countChangedMealsInPlan(prev, next)).toBe(0);
    const nextChanged = [{ meals: [mkMeal(null, "Pancakes")] }];
    expect(countChangedMealsInPlan(prev, nextChanged)).toBe(1);
  });

  it("counts a slot toggle (snack added) as 1 change", () => {
    const prev = [{ meals: [mkMeal("r1"), mkMeal("r2")] }];
    const next = [{ meals: [mkMeal("r1"), mkMeal("r2"), mkMeal("r3")] }];
    expect(countChangedMealsInPlan(prev, next)).toBe(1);
  });

  it("counts a day-count change (3 → 7 days) by all added slots", () => {
    const prev = [
      { meals: [mkMeal("r1"), mkMeal("r2")] },
      { meals: [mkMeal("r3"), mkMeal("r4")] },
      { meals: [mkMeal("r5"), mkMeal("r6")] },
    ];
    const next = [
      { meals: [mkMeal("r1"), mkMeal("r2")] },
      { meals: [mkMeal("r3"), mkMeal("r4")] },
      { meals: [mkMeal("r5"), mkMeal("r6")] },
      { meals: [mkMeal("r7"), mkMeal("r8")] },
      { meals: [mkMeal("r9"), mkMeal("r10")] },
      { meals: [mkMeal("r11"), mkMeal("r12")] },
      { meals: [mkMeal("r13"), mkMeal("r14")] },
    ];
    // First 3 days unchanged; 4 new days, 2 meals each = 8 new slots.
    expect(countChangedMealsInPlan(prev, next)).toBe(8);
  });

  it("treats empty slot becoming populated as 1 change", () => {
    const prev = [{ meals: [mkMeal(null, null)] }];
    const next = [{ meals: [mkMeal("r1", "Dinner")] }];
    expect(countChangedMealsInPlan(prev, next)).toBe(1);
  });

  it("returns 0 for null / undefined inputs (defensive)", () => {
    expect(countChangedMealsInPlan(null, null)).toBe(0);
    expect(countChangedMealsInPlan([], null)).toBe(0);
    expect(countChangedMealsInPlan(null, [{ meals: [mkMeal("r1")] }])).toBe(0);
  });

  it("returns 0 for two empty plans", () => {
    expect(countChangedMealsInPlan([], [])).toBe(0);
  });
});
