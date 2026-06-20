import { describe, expect, it } from "vitest";
import {
  collectPlanIngredientKeys,
  computeSmartRecipeSuggestions,
} from "../../src/lib/planning/smartSuggestions";

describe("computeSmartRecipeSuggestions", () => {
  it("returns pool recipes that share ingredients with the plan, excluding meals already on the plan", () => {
    const chickenId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const salmonId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const title = "High-Protein Chicken & Rice Bowl";
    const plan = [
      {
        day: 1,
        meals: [
          {
            name: "Lunch",
            recipeTitle: title,
            calories: 542,
            protein: 48,
            carbs: 52,
            fat: 12,
          },
        ],
        totals: { calories: 542, protein: 48, carbs: 52, fat: 12 },
      },
    ];
    const titleToId = (t: string) => (t === title ? chickenId : null);
    const dbMap = new Map<string, string[]>([
      [chickenId, ["Chicken breast", "White rice", "Olive oil"]],
      [salmonId, ["Salmon fillet", "Mixed vegetables", "Olive oil"]],
    ]);
    const extraRecipePool = [
      {
        id: salmonId,
        creatorName: "Test",
        creatorImage: "",
        title: "Grilled Salmon with Roasted Vegetables",
        image: "",
        servings: 1,
        calories: 468,
        protein: 42,
        carbs: 28,
        fat: 20,
        isVerified: true,
        savedCount: 0,
        isSaved: false,
      },
    ];
    const out = computeSmartRecipeSuggestions({
      mealPlan: plan,
      titleToId,
      dbIngredientsByRecipeId: dbMap,
      extraRecipePool,
    });
    const ids = out.map((s) => s.recipe.id);
    expect(ids).toContain(salmonId);
    expect(ids).not.toContain(chickenId);
  });

  it("includes community pool recipes when Supabase ingredient names overlap the plan", () => {
    const communityId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    const soupId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    const plan = [
      {
        day: 1,
        meals: [
          {
            name: "Lunch",
            recipeTitle: "Community Chili",
            calories: 400,
            protein: 30,
            carbs: 40,
            fat: 12,
          },
        ],
        totals: { calories: 400, protein: 30, carbs: 40, fat: 12 },
      },
    ];
    const titleToId = (t: string) => (t === "Community Chili" ? communityId : null);
    const dbMap = new Map<string, string[]>([
      [communityId, ["black beans", "tomato", "onion"]],
      [soupId, ["black beans", "water"]],
    ]);
    const extraRecipePool = [
      {
        id: soupId,
        creatorName: "You",
        creatorImage: "",
        title: "Bean Soup",
        image: "",
        servings: 1,
        calories: 200,
        protein: 12,
        carbs: 28,
        fat: 4,
        isVerified: false,
        savedCount: 0,
        isSaved: true,
      },
    ];
    const keys = collectPlanIngredientKeys(plan, titleToId, dbMap);
    expect(keys.has("black beans")).toBe(true);
    const out = computeSmartRecipeSuggestions({
      mealPlan: plan,
      titleToId,
      dbIngredientsByRecipeId: dbMap,
      extraRecipePool,
      max: 10,
    });
    const soup = out.find((s) => s.recipe.title === "Bean Soup");
    expect(soup).toBeDefined();
    expect(soup!.sharedIngredients.some((n) => n.toLowerCase().includes("bean"))).toBe(true);
  });
});
