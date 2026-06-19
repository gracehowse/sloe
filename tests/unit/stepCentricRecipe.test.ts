import { describe, expect, it } from "vitest";

import { flattenStepIngredientLines, flattenStepIngredients } from "../../src/lib/recipes/stepCentricRecipe";

describe("flattenStepIngredients", () => {
  it("flattens in first-use order and deduplicates by normalized name", () => {
    const ingredients = flattenStepIngredients([
      { text: "Whisk eggs", ingredients: [{ quantity: 2, unit: "", name: "Eggs", prep: null }] },
      { text: "Add eggs again", ingredients: [{ quantity: 1, unit: "", name: " eggs ", prep: null }] },
      { text: "Fold flour", ingredients: [{ quantity: 100, unit: "g", name: "Flour", prep: "sifted" }] },
    ]);

    expect(ingredients.map((ingredient) => ingredient.name)).toEqual(["Eggs", "Flour"]);
    expect(flattenStepIngredientLines([{ text: "Fold flour", ingredients: [ingredients[1]] }])).toEqual([
      "100 g Flour, sifted",
    ]);
  });

  it("drops processed prep-state and optional serving-note rows", () => {
    const lines = flattenStepIngredientLines([
      {
        text: "Make slurry",
        ingredients: [
          { quantity: 1, unit: "tbsp", name: "cornflour mixed with warm water", prep: null },
          { quantity: 2, unit: "tbsp", name: "yoghurt", prep: "to serve (optional)" },
          { quantity: 1, unit: "tbsp", name: "olive oil", prep: null },
        ],
      },
    ]);

    expect(lines).toEqual(["1 tbsp olive oil"]);
  });

  it("handles empty and ingredient-less steps", () => {
    expect(flattenStepIngredients([])).toEqual([]);
    expect(flattenStepIngredients([{ text: "Rest", ingredients: [] }, { text: "Serve" }])).toEqual([]);
  });
});
