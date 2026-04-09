import { describe, expect, it } from "vitest";
import { generatePlanFromLibrary } from "../../src/lib/planning/generateMealPlan.ts";
import type { RecipeCard } from "../../src/types/recipe.ts";

function recipe(
  partial: Pick<RecipeCard, "id" | "title" | "calories" | "protein" | "carbs" | "fat"> &
    Pick<RecipeCard, "mealSlots">,
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

describe("generatePlanFromLibrary", () => {
  it("assigns recipes only to slots they fit (e.g. breakfast oats not in Snack)", () => {
    const oats = recipe({
      id: "oats",
      title: "Overnight Oats",
      calories: 400,
      protein: 30,
      carbs: 50,
      fat: 8,
      mealSlots: ["Breakfast"],
    });
    const salmon = recipe({
      id: "salmon",
      title: "Grilled Salmon",
      calories: 450,
      protein: 40,
      carbs: 25,
      fat: 20,
      mealSlots: ["Lunch", "Dinner"],
    });
    const parfait = recipe({
      id: "parfait",
      title: "Yogurt Parfait",
      calories: 300,
      protein: 24,
      carbs: 35,
      fat: 8,
      mealSlots: ["Breakfast", "Snack"],
    });
    const chicken = recipe({
      id: "chicken",
      title: "Chicken Bowl",
      calories: 520,
      protein: 45,
      carbs: 45,
      fat: 14,
      mealSlots: ["Lunch", "Dinner"],
    });

    const savedRecipes = [oats, salmon, parfait, chicken];
    const plan = generatePlanFromLibrary({ savedRecipes, targets, days: 3 });

    for (const day of plan) {
      const byName = Object.fromEntries(day.meals.map((m) => [m.name, m.recipeTitle]));
      expect(byName["Breakfast"]).toBeDefined();
      expect(byName["Snack"]).toBe("Yogurt Parfait");
      expect(byName["Breakfast"]).not.toBe("Grilled Salmon");
      expect(byName["Snack"]).not.toBe("Overnight Oats");
      expect(byName["Snack"]).not.toBe("Grilled Salmon");
    }
  });
});
