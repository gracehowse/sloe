import { describe, expect, it } from "vitest";
import { RECIPE_CATALOG } from "../../src/data/recipeCatalog.ts";
import { computeSmartRecipeSuggestions } from "../../src/lib/planning/smartSuggestions.ts";

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
});
