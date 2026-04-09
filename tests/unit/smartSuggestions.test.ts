import { describe, expect, it } from "vitest";
import { RECIPE_CATALOG } from "../../src/data/recipeCatalog.ts";
import {
  collectPlanIngredientKeys,
  computeSmartRecipeSuggestions,
} from "../../src/lib/planning/smartSuggestions.ts";

describe("computeSmartRecipeSuggestions", () => {
  it("returns catalog recipes that share ingredients with the plan, excluding meals already on the plan", () => {
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
    const titleToId = (t: string) => RECIPE_CATALOG.find((r) => r.title === t)?.id ?? null;
    const out = computeSmartRecipeSuggestions({ mealPlan: plan, titleToId });
    const ids = out.map((s) => s.recipe.id);
    // Shares "olive oil" with salmon recipe in catalog data.
    expect(ids).toContain("cccccccc-cccc-cccc-cccc-cccccccccccc");
    expect(ids).not.toContain("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
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
