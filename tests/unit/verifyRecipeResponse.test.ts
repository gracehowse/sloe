import { describe, expect, it } from "vitest";
import { flatMacroRowsFromVerifyJson, perServingFromVerifyJson } from "../../src/lib/nutrition/verifyRecipeResponse";

describe("verifyRecipeResponse", () => {
  it("maps canonical verify API verified[] + macros", () => {
    const json = {
      ok: true,
      verified: [
        {
          input: { name: "x", amount: "1", unit: "cup" },
          resolved: { name: "x", amount: "1", unit: "cup" },
          fatSecretFoodId: null,
          matchedName: "Chicken",
          confidence: 0.82,
          source: "USDA",
          macros: { calories: 200, protein: 40, carbs: 0, fat: 4, fiberG: 0, sugarG: 0, sodiumMg: 100 },
        },
      ],
      totals: { calories: 200, protein: 40, carbs: 0, fat: 4, fiberG: 0, sugarG: 0, sodiumMg: 100 },
      perServing: { calories: 100, protein: 20, carbs: 0, fat: 2, fiberG: 0, sugarG: 0, sodiumMg: 50 },
      primarySource: "USDA",
      sourceCounts: { USDA: 1 },
      minIngredientConfidence: 0.82,
      avgIngredientConfidence: 0.82,
    };

    const rows = flatMacroRowsFromVerifyJson(json as Record<string, unknown>);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({
      calories: 200,
      protein: 40,
      source: "USDA",
      confidence: 0.82,
    });
    const ps = perServingFromVerifyJson(json as Record<string, unknown>);
    expect(ps?.calories).toBe(100);
  });

  it("prefers verified[] over stale ingredientRows when both exist", () => {
    const json = {
      ok: true,
      ingredientRows: [{ calories: 0, protein: 0, carbs: 0, fat: 0, source: "bad", confidence: 0 }],
      verified: [
        {
          confidence: 0.9,
          source: "USDA",
          macros: { calories: 50, protein: 5, carbs: 0, fat: 1, fiberG: 0, sugarG: 0, sodiumMg: 0 },
        },
      ],
      totals: { calories: 50, protein: 5, carbs: 0, fat: 1, fiberG: 0, sugarG: 0, sodiumMg: 0 },
      perServing: { calories: 50, protein: 5, carbs: 0, fat: 1, fiberG: 0, sugarG: 0, sodiumMg: 0 },
    };
    const rows = flatMacroRowsFromVerifyJson(json as Record<string, unknown>);
    expect(rows).toHaveLength(1);
    expect(rows![0]!.calories).toBe(50);
    expect(rows![0]!.source).toBe("USDA");
  });

  it("coerces string perServing.calories from JSON", () => {
    const json = {
      ok: true,
      perServing: { calories: "120", protein: "10", carbs: "0", fat: "4", fiberG: "0", sugarG: "0", sodiumMg: "0" },
    };
    const ps = perServingFromVerifyJson(json as Record<string, unknown>);
    expect(ps?.calories).toBe(120);
    expect(ps?.protein).toBe(10);
  });

  it("derives perServing from totals when perServing is missing", () => {
    const json = {
      ok: true,
      verified: [
        {
          confidence: 0.9,
          source: "USDA",
          macros: { calories: 400, protein: 10, carbs: 20, fat: 5, fiberG: 1, sugarG: 0, sodiumMg: 50 },
        },
      ],
      totals: { calories: 400, protein: 10, carbs: 20, fat: 5, fiberG: 1, sugarG: 0, sodiumMg: 50 },
    };
    const ps = perServingFromVerifyJson(json as Record<string, unknown>, { servings: 4 });
    expect(ps?.calories).toBe(100);
    expect(ps?.protein).toBe(2.5);
  });
});
