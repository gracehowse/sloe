import { describe, expect, it } from "vitest";

import { scaleMacroTargetsForCalorieBudget } from "../../src/lib/nutrition/scaleMacroTargetsForCalorieBudget";

describe("scaleMacroTargetsForCalorieBudget", () => {
  const base = { protein: 140, carbs: 200, fat: 25 };

  it("returns base macros when there is no calorie bonus", () => {
    expect(
      scaleMacroTargetsForCalorieBudget(base, { baseCalories: 2000, effectiveCalories: 2000 }),
    ).toEqual(base);
    expect(
      scaleMacroTargetsForCalorieBudget(base, { baseCalories: 2000, effectiveCalories: 1800 }),
    ).toEqual(base);
  });

  it("scales protein/carbs/fat proportionally when bonus inflates calories", () => {
    // +10% calorie budget → +10% macro grams (rounded).
    expect(
      scaleMacroTargetsForCalorieBudget(base, { baseCalories: 2000, effectiveCalories: 2200 }),
    ).toEqual({ protein: 154, carbs: 220, fat: 28 });
  });

  it("does not scale when base calories are zero", () => {
    expect(
      scaleMacroTargetsForCalorieBudget(base, { baseCalories: 0, effectiveCalories: 2500 }),
    ).toEqual(base);
  });
});
