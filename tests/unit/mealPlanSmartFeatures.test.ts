/**
 * Tests for the unified smart meal plan algorithm features:
 * slot weighting, portion scaling, configurable slots, seeded randomness.
 */
import { describe, it, expect } from "vitest";
import { generatePlanFromLibrary } from "../../src/lib/planning/generateMealPlan.ts";
import type { RecipeCard } from "../../src/types/recipe.ts";

function recipe(
  partial: Pick<RecipeCard, "id" | "title" | "calories" | "protein" | "carbs" | "fat"> &
    Partial<Pick<RecipeCard, "mealSlots">>,
): RecipeCard {
  return {
    creatorName: "Test",
    creatorImage: "",
    image: "",
    servings: 1,
    isVerified: true,
    savedCount: 0,
    isSaved: false,
    ...partial,
  };
}

const targets = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 70,
  calorieBandPct: 12,
  carbFatBandPct: 18,
};

const recipes = [
  recipe({ id: "a", title: "Oats", calories: 400, protein: 30, carbs: 50, fat: 10, mealSlots: ["Breakfast"] }),
  recipe({ id: "b", title: "Salad", calories: 350, protein: 35, carbs: 30, fat: 12, mealSlots: ["Lunch"] }),
  recipe({ id: "c", title: "Steak", calories: 600, protein: 50, carbs: 20, fat: 30, mealSlots: ["Dinner"] }),
  recipe({ id: "d", title: "Yogurt", calories: 200, protein: 20, carbs: 25, fat: 5, mealSlots: ["Snacks"] }),
  recipe({ id: "e", title: "Chicken Bowl", calories: 500, protein: 45, carbs: 40, fat: 15, mealSlots: ["Lunch", "Dinner"] }),
];

describe("slot weighting", () => {
  it("dinner meals get more calories than snack meals", () => {
    const plan = generatePlanFromLibrary({ savedRecipes: recipes, targets, days: 1, seed: 42 });
    const day = plan[0];
    const dinner = day.meals.find((m) => m.name === "Dinner");
    const snack = day.meals.find((m) => m.name === "Snacks");
    expect(dinner).toBeDefined();
    expect(snack).toBeDefined();
    if (dinner && snack) {
      expect(dinner.calories).toBeGreaterThan(snack.calories);
    }
  });
});

describe("portion scaling", () => {
  it("meals can have portionMultiplier != 1", () => {
    const plan = generatePlanFromLibrary({ savedRecipes: recipes, targets, days: 1, seed: 42 });
    const day = plan[0];
    // At least one meal should have a non-1 portionMultiplier (scaled to fit slot target)
    const hasScaled = day.meals.some((m) => m.portionMultiplier !== undefined && m.portionMultiplier !== 1);
    // This is probabilistic but with the given recipes + targets, scaling should occur
    expect(hasScaled || day.meals.length === 0).toBe(true);
  });

  it("portionMultiplier is between 0.5 and 2", () => {
    const plan = generatePlanFromLibrary({ savedRecipes: recipes, targets, days: 3, seed: 42 });
    for (const day of plan) {
      for (const meal of day.meals) {
        if (meal.portionMultiplier !== undefined) {
          expect(meal.portionMultiplier).toBeGreaterThanOrEqual(0.5);
          expect(meal.portionMultiplier).toBeLessThanOrEqual(2);
        }
      }
    }
  });
});

describe("configurable slots", () => {
  it("generates plan with only 2 slots when configured", () => {
    const plan = generatePlanFromLibrary({
      savedRecipes: recipes,
      targets,
      days: 1,
      slots: ["Breakfast", "Dinner"],
      seed: 42,
    });
    expect(plan[0].meals).toHaveLength(2);
    expect(plan[0].meals[0].name).toBe("Breakfast");
    expect(plan[0].meals[1].name).toBe("Dinner");
  });

  it("generates plan with 3 slots excluding Snacks", () => {
    const plan = generatePlanFromLibrary({
      savedRecipes: recipes,
      targets,
      days: 1,
      slots: ["Breakfast", "Lunch", "Dinner"],
      seed: 42,
    });
    expect(plan[0].meals).toHaveLength(3);
    expect(plan[0].meals.find((m) => m.name === "Snacks")).toBeUndefined();
  });
});

describe("seeded randomness", () => {
  it("same seed produces identical plans", () => {
    const plan1 = generatePlanFromLibrary({ savedRecipes: recipes, targets, days: 3, seed: 12345 });
    const plan2 = generatePlanFromLibrary({ savedRecipes: recipes, targets, days: 3, seed: 12345 });
    expect(plan1).toEqual(plan2);
  });

  it("different seeds produce different plans", () => {
    const plan1 = generatePlanFromLibrary({ savedRecipes: recipes, targets, days: 3, seed: 11111 });
    const plan2 = generatePlanFromLibrary({ savedRecipes: recipes, targets, days: 3, seed: 99999 });
    // At least one day should differ
    const allSame = plan1.every((d, i) =>
      d.meals.every((m, j) => m.recipeTitle === plan2[i].meals[j].recipeTitle),
    );
    expect(allSame).toBe(false);
  });
});

describe("day variety (recency penalty)", () => {
  it("avoids repeating the same recipes across consecutive days", () => {
    // With only 5 recipes and 3 days, some repetition is inevitable,
    // but the algorithm should try to minimise it
    const plan = generatePlanFromLibrary({ savedRecipes: recipes, targets, days: 3, seed: 42 });
    const day1Titles = new Set(plan[0].meals.map((m) => m.recipeTitle));
    const day2Titles = new Set(plan[1].meals.map((m) => m.recipeTitle));
    // Not all meals should be identical between day 1 and day 2
    const overlap = [...day1Titles].filter((t) => day2Titles.has(t)).length;
    expect(overlap).toBeLessThan(day1Titles.size);
  });
});
