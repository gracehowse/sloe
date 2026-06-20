import { describe, expect, it } from "vitest";
import { computeSmartRecipeSuggestions } from "@suppr/shared/planning/smartSuggestions";

describe("plan smart suggestions (ENG-1193 mobile parity)", () => {
  it("scores saved-pool recipes that share plan ingredients", () => {
    const planRecipeId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const suggestionId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const plan = [
      {
        day: 1,
        meals: [
          {
            name: "Lunch",
            recipeTitle: "Chicken rice bowl",
            calories: 500,
            protein: 40,
            carbs: 50,
            fat: 10,
          },
        ],
        totals: { calories: 500, protein: 40, carbs: 50, fat: 10 },
      },
    ];
    const titleToId = (t: string) => (t === "Chicken rice bowl" ? planRecipeId : null);
    const dbMap = new Map<string, string[]>([
      [planRecipeId, ["chicken breast", "white rice"]],
      [suggestionId, ["salmon", "white rice", "lemon"]],
    ]);
    const extraRecipePool = [
      {
        id: suggestionId,
        creatorName: "Test",
        creatorImage: "",
        title: "Salmon rice bowl",
        image: "",
        servings: 1,
        calories: 480,
        protein: 38,
        carbs: 42,
        fat: 14,
        isVerified: true,
        savedCount: 0,
        isSaved: true,
      },
    ];
    const out = computeSmartRecipeSuggestions({
      mealPlan: plan,
      titleToId,
      dbIngredientsByRecipeId: dbMap,
      extraRecipePool,
      max: 4,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.recipe.id).toBe(suggestionId);
    expect(out[0]!.sharedIngredients.some((n) => n.toLowerCase().includes("rice"))).toBe(true);
  });
});
