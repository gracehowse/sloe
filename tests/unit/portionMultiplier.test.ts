import { describe, expect, it } from "vitest";
import {
  clampPortionMultiplier,
  effectivePortionMultiplier,
  scaledMacro,
  dayPlanTotalsFromMeals,
  normalizeDayPlans,
} from "../../src/lib/nutrition/portionMultiplier.ts";
import type { DayPlanMeal } from "../../src/types/recipe.ts";

describe("portionMultiplier", () => {
  it("clampPortionMultiplier rounds to half steps and bounds", () => {
    expect(clampPortionMultiplier(1)).toBe(1);
    expect(clampPortionMultiplier(1.2)).toBe(1);
    expect(clampPortionMultiplier(1.3)).toBe(1.5);
    expect(clampPortionMultiplier(9)).toBe(8);
    expect(clampPortionMultiplier(0.25)).toBe(0.5);
  });

  it("dayPlanTotalsFromMeals scales non-placeholder meals", () => {
    const meals: DayPlanMeal[] = [
      {
        name: "Breakfast",
        recipeTitle: "Oats",
        calories: 400,
        protein: 30,
        carbs: 50,
        fat: 10,
        portionMultiplier: 1,
      },
      {
        name: "Dinner",
        recipeTitle: "Salmon",
        calories: 500,
        protein: 40,
        carbs: 20,
        fat: 20,
        portionMultiplier: 2,
      },
    ];
    expect(dayPlanTotalsFromMeals(meals)).toEqual({
      calories: 400 + 1000,
      protein: 30 + 80,
      carbs: 50 + 40,
      fat: 10 + 40,
    });
  });

  it("normalizeDayPlans repairs totals from multipliers", () => {
    const raw = [
      {
        day: 1,
        meals: [
          {
            name: "Lunch",
            recipeTitle: "Bowl",
            calories: 100,
            protein: 10,
            carbs: 10,
            fat: 5,
            portionMultiplier: 2,
          },
        ],
        totals: { calories: 100, protein: 10, carbs: 10, fat: 5 },
      },
    ];
    const out = normalizeDayPlans(raw);
    expect(out).not.toBeNull();
    expect(out![0]!.totals).toEqual({ calories: 200, protein: 20, carbs: 20, fat: 10 });
  });

  it("effectivePortionMultiplier defaults to 1 for undefined", () => {
    expect(effectivePortionMultiplier(undefined)).toBe(1);
    expect(effectivePortionMultiplier(null as any)).toBe(1);
    expect(effectivePortionMultiplier(NaN)).toBe(1);
  });

  it("effectivePortionMultiplier returns the value when valid", () => {
    expect(effectivePortionMultiplier(1.5)).toBe(1.5);
    expect(effectivePortionMultiplier(0.5)).toBe(0.5);
  });

  it("scaledMacro multiplies and rounds", () => {
    expect(scaledMacro(100, 1.5)).toBe(150);
    expect(scaledMacro(33, 2)).toBe(66);
    expect(scaledMacro(100, 0.5)).toBe(50);
  });

  it("clampPortionMultiplier handles NaN", () => {
    expect(clampPortionMultiplier(NaN)).toBe(1);
  });

  it("normalizeDayPlans returns null for null input", () => {
    expect(normalizeDayPlans(null as any)).toBeNull();
  });

  it("normalizeDayPlans returns null for non-array", () => {
    expect(normalizeDayPlans("oops" as any)).toBeNull();
  });

  it("dayPlanTotalsFromMeals skips placeholder meals", () => {
    const meals: DayPlanMeal[] = [
      { name: "Breakfast", recipeTitle: "Oats", calories: 400, protein: 30, carbs: 50, fat: 10 },
      { name: "Lunch", recipeTitle: "Save more recipes", calories: 0, protein: 0, carbs: 0, fat: 0, isPlaceholder: true },
    ];
    const totals = dayPlanTotalsFromMeals(meals);
    expect(totals.calories).toBe(400);
  });
});
