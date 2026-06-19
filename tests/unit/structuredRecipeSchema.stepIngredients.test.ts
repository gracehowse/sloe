import { describe, expect, it } from "vitest";

import { parseStructuredRecipe, toIngredientLines } from "../../src/lib/recipe-import/structuredRecipeSchema";

describe("structured recipe step-centric parsing", () => {
  it("accepts step-nested ingredients while preserving the flat list", () => {
    const parsed = parseStructuredRecipe(JSON.stringify({
      title: "Pasta",
      servings: 2,
      ingredients: [{ quantity: 100, unit: "g", name: "pasta", prep: null, confidence: 0.95 }],
      steps: [{ text: "Boil the pasta", ingredients: [{ quantity: 100, unit: "g", name: "pasta", confidence: 0.9 }] }],
      prepTimeMin: null,
      cookTimeMin: 10,
      sourceName: null,
      notes: null,
    }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(toIngredientLines(parsed.recipe)).toEqual(["100 g pasta"]);
    expect(parsed.recipe.steps).toEqual([
      { text: "Boil the pasta", ingredients: [expect.objectContaining({ name: "pasta", raw: "100 g pasta" })] },
    ]);
  });

  it("keeps backward compatibility with string steps", () => {
    const parsed = parseStructuredRecipe(JSON.stringify({ ingredients: [], steps: ["Heat pan"] }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.recipe.steps).toEqual([{ text: "Heat pan", ingredients: [] }]);
  });
});
