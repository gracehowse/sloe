/**
 * Open Food Facts branch with mocked search (no network). USDA/FatSecret off.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const searchOffProducts = vi.fn();

vi.mock("@/lib/openFoodFacts/searchProducts", () => ({
  searchOffProducts: (...args: unknown[]) => searchOffProducts(...args),
}));

vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => false,
  hasFatSecretConfig: () => false,
}));

import { verifyIngredients } from "@/lib/nutrition/verifyIngredients";

describe("verifyIngredients OFF (mocked search)", () => {
  beforeEach(() => {
    searchOffProducts.mockReset();
  });

  it("accepts a high-confidence OFF product and scales per 100g macros", async () => {
    searchOffProducts.mockResolvedValue([
      {
        code: "1234567890123",
        name: "Olive oil",
        brand: "",
        calories: 884,
        protein: 0,
        carbs: 0,
        fat: 100,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 2,
      },
    ]);

    const result = await verifyIngredients({
      ingredients: [{ name: "olive oil", amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    expect(result.verified[0]!.source).toBe("OFF");
    expect(result.verified[0]!.matchedName).toMatch(/olive/i);
    expect(result.verified[0]!.macros?.calories).toBe(884);
    expect(result.verified[0]!.macros?.fat).toBe(100);
    expect(result.primarySource).toBe("OFF");
    expect(searchOffProducts).toHaveBeenCalled();
  });

  it("rejects low-confidence OFF rows and uses Estimated", async () => {
    searchOffProducts.mockResolvedValue([
      {
        code: "999",
        name: "Chocolate sandwich cookies, creme-filled",
        brand: "Generic",
        calories: 480,
        protein: 5,
        carbs: 68,
        fat: 22,
        fiberG: 2,
        sugarG: 40,
        sodiumMg: 300,
      },
    ]);

    const result = await verifyIngredients({
      ingredients: [{ name: "olive oil", amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    expect(result.verified[0]!.source).toBe("Estimated");
    expect(result.primarySource).toBe("Estimated");
  });
});
