import { describe, expect, it } from "vitest";
import {
  clampPortionMultiplier,
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
});
