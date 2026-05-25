import { describe, expect, it } from "vitest";
import {
  resolveStructuredIngredient,
  structuredIngredientsForVerify,
} from "../../src/lib/recipe-ingredients/structuredIngredientsForVerify";

describe("structuredIngredientsForVerify", () => {
  it("preserves separate amount and unit columns for verify API", () => {
    expect(
      structuredIngredientsForVerify([
        { name: "olive oil", amount: "2", unit: "tbsp" },
        { name: "yellow onion", amount: "1", unit: "medium" },
      ]),
    ).toEqual([
      { name: "olive oil", amount: "2", unit: "tbsp" },
      { name: "yellow onion", amount: "1", unit: "medium" },
    ]);
  });

  it("parses amount embedded in name when amount column is empty", () => {
    expect(
      resolveStructuredIngredient({ name: "500 g chicken breast", amount: "", unit: "" }),
    ).toEqual({
      name: "chicken breast",
      amount: "500",
      unit: "g",
    });
  });
});

describe("mergeVerifiedMacroRows", () => {
  it("sets isVerified when confidence clears the verify bar", async () => {
    const { mergeVerifiedMacroRows } = await import("../../src/lib/nutrition/verifyRecipeResponse");
    const out = mergeVerifiedMacroRows(
      [{ name: "olive oil", isVerified: false }],
      [
        {
          calories: 120,
          protein: 0,
          carbs: 0,
          fat: 14,
          fiber: 0,
          sugar: 0,
          sodium: 0,
          source: "USDA",
          confidence: 0.82,
        },
      ],
    );
    expect(out[0]?.isVerified).toBe(true);
    expect(out[0]?.source).toBe("USDA");
  });
});
