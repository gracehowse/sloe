/**
 * P1-19 (2026-04-25) — pin that the planner threads `macrosAreEstimated`
 * onto produced meal rows when the underlying recipe was coerced by
 * `coerceMacrosWhenCaloriesButNoGrams`. Both the mobile sampler
 * (`generateSmartPlan` in `mealPlanAlgo.ts`) and the web sampler
 * (`generatePlanFromLibrary` in `generateMealPlan.ts`) must set the
 * flag identically.
 *
 * Companion: the journal-write guards from P0-3 already refuse to
 * persist these rows; this chip is the visual counterpart so the
 * user sees the planner is showing a neutral 28/42/30 split, not
 * real data, BEFORE they tap log.
 */
import { describe, it, expect } from "vitest";
import {
  generateSmartPlan,
  type SimpleRecipe,
  type PlannerTargets,
} from "../../src/lib/nutrition/mealPlanAlgo";
import { generatePlanFromLibrary } from "../../src/lib/planning/generateMealPlan";
import type { RecipeCard } from "../../src/types/recipe";

const TARGETS: PlannerTargets = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
  calorieBandPct: 12,
  carbFatBandPct: 18,
};

// Coercion fires when stated kcal > gram-derived kcal × 0.45 inverse.
// Recipe with 600 kcal and 0/0/0 P/C/F → 0 < 600 × 0.45 → triggers.
function coercedRecipe(id: string, title: string, kcal: number): SimpleRecipe {
  return {
    id,
    title,
    calories: kcal,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiberG: 0,
    mealType: ["breakfast", "lunch", "dinner", "snack"],
  };
}

function coherentRecipe(id: string, title: string): SimpleRecipe {
  return {
    id,
    title,
    calories: 500,
    protein: 35,
    carbs: 50,
    fat: 18,
    fiberG: 6,
    mealType: ["breakfast", "lunch", "dinner", "snack"],
  };
}

describe("planner threads macrosAreEstimated when recipe is coerced (P1-19)", () => {
  it("mobile generateSmartPlan: coerced recipes produce rows with macrosAreEstimated:true", () => {
    const recipes = [
      coercedRecipe("a", "Breakfast smoothie kcal-only", 350),
      coercedRecipe("b", "Lunch wrap kcal-only", 600),
      coercedRecipe("c", "Snack bar kcal-only", 250),
      coercedRecipe("d", "Dinner bowl kcal-only", 800),
    ];
    const [day] = generateSmartPlan({ recipes, targets: TARGETS, days: 1, seed: 42 });
    expect(day).toBeDefined();
    for (const m of day!.meals) {
      expect(m.macrosAreEstimated).toBe(true);
    }
  });

  it("mobile generateSmartPlan: coherent recipes produce rows without macrosAreEstimated", () => {
    const recipes = [
      coherentRecipe("a", "Breakfast bowl"),
      coherentRecipe("b", "Lunch wrap"),
      coherentRecipe("c", "Snack mix"),
      coherentRecipe("d", "Dinner plate"),
    ];
    const [day] = generateSmartPlan({ recipes, targets: TARGETS, days: 1, seed: 42 });
    expect(day).toBeDefined();
    for (const m of day!.meals) {
      expect(m.macrosAreEstimated).toBeUndefined();
    }
  });

  it("mobile generateSmartPlan: mixed pool flags only the coerced rows", () => {
    const recipes: SimpleRecipe[] = [
      { ...coercedRecipe("a", "Breakfast kcal-only", 400), mealType: ["breakfast"] },
      { ...coherentRecipe("b"), id: "b", title: "Lunch coherent", mealType: ["lunch"] },
      { ...coherentRecipe("c"), id: "c", title: "Snack coherent", mealType: ["snack"] },
      { ...coercedRecipe("d", "Dinner kcal-only", 700), mealType: ["dinner"] },
    ];
    const [day] = generateSmartPlan({ recipes, targets: TARGETS, days: 1, seed: 42 });
    expect(day).toBeDefined();
    const breakfast = day!.meals.find((m) => m.name === "Breakfast");
    const lunch = day!.meals.find((m) => m.name === "Lunch");
    const snacks = day!.meals.find((m) => m.name === "Snacks");
    const dinner = day!.meals.find((m) => m.name === "Dinner");
    expect(breakfast?.macrosAreEstimated).toBe(true);
    expect(lunch?.macrosAreEstimated).toBeUndefined();
    expect(snacks?.macrosAreEstimated).toBeUndefined();
    expect(dinner?.macrosAreEstimated).toBe(true);
  });

  it("web generatePlanFromLibrary: coerced recipes produce rows with macrosAreEstimated:true", () => {
    const card: Omit<RecipeCard, "id" | "title" | "calories" | "protein" | "carbs" | "fat"> = {
      creatorName: "Test",
      creatorImage: "",
      image: "",
      servings: 1,
      isVerified: false,
      savedCount: 0,
      isSaved: false,
    } as Omit<RecipeCard, "id" | "title" | "calories" | "protein" | "carbs" | "fat">;
    const recipes: RecipeCard[] = [
      { ...card, id: "a", title: "Smoothie", calories: 350, protein: 0, carbs: 0, fat: 0 } as RecipeCard,
      { ...card, id: "b", title: "Wrap", calories: 600, protein: 0, carbs: 0, fat: 0 } as RecipeCard,
      { ...card, id: "c", title: "Bar", calories: 250, protein: 0, carbs: 0, fat: 0 } as RecipeCard,
      { ...card, id: "d", title: "Bowl", calories: 800, protein: 0, carbs: 0, fat: 0 } as RecipeCard,
    ];
    const [day] = generatePlanFromLibrary({
      savedRecipes: recipes,
      targets: TARGETS,
      days: 1,
      seed: 42,
    });
    expect(day).toBeDefined();
    for (const m of day!.meals) {
      expect(m.macrosAreEstimated).toBe(true);
    }
  });
});
