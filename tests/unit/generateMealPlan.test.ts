import { describe, expect, it } from "vitest";
import { generatePlanFromLibrary, mealPlannerSlotsFromMealType, recipeFitsMealSlot } from "../../src/lib/planning/generateMealPlan.ts";
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
  fiber: 28,
  calorieBandPct: 12,
  carbFatBandPct: 18,
};

describe("generatePlanFromLibrary", () => {
  it("assigns recipes only to slots they fit (e.g. breakfast oats not in Snacks)", () => {
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
      mealSlots: ["Breakfast", "Snacks"],
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
      expect(byName["Snacks"]).toBe("Yogurt Parfait");
      expect(byName["Breakfast"]).not.toBe("Grilled Salmon");
      expect(byName["Snacks"]).not.toBe("Overnight Oats");
      expect(byName["Snacks"]).not.toBe("Grilled Salmon");
    }
  });

  it("returns no meals when the recipe pool is empty", () => {
    const plan = generatePlanFromLibrary({ savedRecipes: [], targets, days: 1 });
    expect(plan).toHaveLength(1);
    expect(plan[0].meals).toHaveLength(0);
    expect(plan[0].totals.calories).toBe(0);
  });

  it("clamps days to 1-7 range", () => {
    const oats = recipe({ id: "o", title: "Oats", calories: 400, protein: 30, carbs: 50, fat: 8, mealSlots: ["Breakfast"] });
    expect(generatePlanFromLibrary({ savedRecipes: [oats], targets, days: 0 })).toHaveLength(1);
    expect(generatePlanFromLibrary({ savedRecipes: [oats], targets, days: 99 })).toHaveLength(7);
  });
});

describe("mealPlannerSlotsFromMealType", () => {
  it("maps single string to slot array", () => {
    expect(mealPlannerSlotsFromMealType("breakfast")).toEqual(["Breakfast"]);
    expect(mealPlannerSlotsFromMealType("dinner")).toEqual(["Dinner"]);
  });

  it("maps string array to slot array", () => {
    const result = mealPlannerSlotsFromMealType(["lunch", "dinner"]);
    expect(result).toContain("Lunch");
    expect(result).toContain("Dinner");
    expect(result).toHaveLength(2);
  });

  it("returns undefined for null/empty", () => {
    expect(mealPlannerSlotsFromMealType(null)).toBeUndefined();
    expect(mealPlannerSlotsFromMealType(undefined)).toBeUndefined();
    expect(mealPlannerSlotsFromMealType("")).toBeUndefined();
    expect(mealPlannerSlotsFromMealType([])).toBeUndefined();
  });

  it("handles case-insensitive input", () => {
    expect(mealPlannerSlotsFromMealType("BREAKFAST")).toEqual(["Breakfast"]);
    expect(mealPlannerSlotsFromMealType("Dinner")).toEqual(["Dinner"]);
  });

  it("maps snack meal type to Snacks slot", () => {
    expect(mealPlannerSlotsFromMealType("snack")).toEqual(["Snacks"]);
  });

  it("filters out unknown tags", () => {
    expect(mealPlannerSlotsFromMealType("brunch")).toBeUndefined();
    expect(mealPlannerSlotsFromMealType(["dinner", "brunch"])).toEqual(["Dinner"]);
  });
});

describe("recipeFitsMealSlot", () => {
  it("untagged recipe fits any slot", () => {
    const r = recipe({ id: "x", title: "X", calories: 100, protein: 10, carbs: 10, fat: 5 });
    expect(recipeFitsMealSlot(r, "Breakfast")).toBe(true);
    expect(recipeFitsMealSlot(r, "Dinner")).toBe(true);
  });

  it("tagged recipe fits matching slot", () => {
    const r = recipe({ id: "x", title: "X", calories: 100, protein: 10, carbs: 10, fat: 5, mealSlots: ["Breakfast"] });
    expect(recipeFitsMealSlot(r, "Breakfast")).toBe(true);
  });

  it("tagged recipe does NOT fit non-matching slot", () => {
    const r = recipe({ id: "x", title: "X", calories: 100, protein: 10, carbs: 10, fat: 5, mealSlots: ["Breakfast"] });
    expect(recipeFitsMealSlot(r, "Dinner")).toBe(false);
  });

  it("multi-tagged recipe fits both slots", () => {
    const r = recipe({ id: "x", title: "X", calories: 100, protein: 10, carbs: 10, fat: 5, mealSlots: ["Lunch", "Dinner"] });
    expect(recipeFitsMealSlot(r, "Lunch")).toBe(true);
    expect(recipeFitsMealSlot(r, "Dinner")).toBe(true);
    expect(recipeFitsMealSlot(r, "Breakfast")).toBe(false);
  });
});
