import { describe, it, expect } from "vitest";
import {
  coerceMacrosWhenCaloriesButNoGrams,
  macroKcalFromGrams,
  mealPlanPortionSpreadPenalty,
  wouldCoerceMacros,
} from "../../src/lib/nutrition/coerceRecipeMacrosForPlanning.ts";

describe("macroKcalFromGrams", () => {
  it("sums 4/4/9 kcal per gram", () => {
    expect(macroKcalFromGrams(10, 20, 5)).toBe(10 * 4 + 20 * 4 + 5 * 9);
  });
});

describe("coerceMacrosWhenCaloriesButNoGrams", () => {
  it("fills neutral P/C/F when calories exist but grams explain <45% of kcal, and flags isCoerced=true", () => {
    const out = coerceMacrosWhenCaloriesButNoGrams({
      calories: 400,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(out.calories).toBe(400);
    expect(out.protein + out.carbs + out.fat).toBeGreaterThan(0);
    expect(macroKcalFromGrams(out.protein, out.carbs, out.fat)).toBeGreaterThan(350);
    expect(out.isCoerced).toBe(true);
  });

  it("leaves coherent rows unchanged and flags isCoerced=false", () => {
    const out = coerceMacrosWhenCaloriesButNoGrams({
      calories: 400,
      protein: 30,
      carbs: 40,
      fat: 12,
    });
    expect(out).toEqual({
      calories: 400,
      protein: 30,
      carbs: 40,
      fat: 12,
      isCoerced: false,
    });
  });

  it("returns isCoerced=false when calories are zero (nothing to synthesise)", () => {
    const out = coerceMacrosWhenCaloriesButNoGrams({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(out.isCoerced).toBe(false);
  });
});

describe("wouldCoerceMacros — cheap signal for journal-write guards", () => {
  it("returns true when gram columns explain <45% of stated calories", () => {
    expect(
      wouldCoerceMacros({ calories: 400, protein: 0, carbs: 0, fat: 0 }),
    ).toBe(true);
  });

  it("returns false for coherent rows", () => {
    expect(
      wouldCoerceMacros({ calories: 400, protein: 30, carbs: 40, fat: 12 }),
    ).toBe(false);
  });

  it("returns false when calories are zero (nothing to coerce)", () => {
    expect(
      wouldCoerceMacros({ calories: 0, protein: 0, carbs: 0, fat: 0 }),
    ).toBe(false);
  });

  it("returns true for kcal-only rows even when protein is non-zero but sub-threshold", () => {
    // 400 kcal, 5 g protein = 20 kcal explained (5%) — still triggers
    expect(
      wouldCoerceMacros({ calories: 400, protein: 5, carbs: 0, fat: 0 }),
    ).toBe(true);
  });
});

describe("mealPlanPortionSpreadPenalty", () => {
  it("is zero when spread ≤4×", () => {
    expect(mealPlanPortionSpreadPenalty([0.5, 1, 1.5])).toBe(0);
  });

  it("grows when max/min exceeds 4×", () => {
    const p = mealPlanPortionSpreadPenalty([0.2, 1.8]);
    expect(p).toBeGreaterThan(0);
  });
});
