import { describe, it, expect } from "vitest";
import {
  coerceMacrosWhenCaloriesButNoGrams,
  macroKcalFromGrams,
  mealPlanPortionSpreadPenalty,
} from "../../src/lib/nutrition/coerceRecipeMacrosForPlanning.ts";

describe("macroKcalFromGrams", () => {
  it("sums 4/4/9 kcal per gram", () => {
    expect(macroKcalFromGrams(10, 20, 5)).toBe(10 * 4 + 20 * 4 + 5 * 9);
  });
});

describe("coerceMacrosWhenCaloriesButNoGrams", () => {
  it("fills neutral P/C/F when calories exist but grams explain <45% of kcal", () => {
    const out = coerceMacrosWhenCaloriesButNoGrams({
      calories: 400,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(out.calories).toBe(400);
    expect(out.protein + out.carbs + out.fat).toBeGreaterThan(0);
    expect(macroKcalFromGrams(out.protein, out.carbs, out.fat)).toBeGreaterThan(350);
  });

  it("leaves coherent rows unchanged", () => {
    const out = coerceMacrosWhenCaloriesButNoGrams({
      calories: 400,
      protein: 30,
      carbs: 40,
      fat: 12,
    });
    expect(out).toEqual({ calories: 400, protein: 30, carbs: 40, fat: 12 });
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
