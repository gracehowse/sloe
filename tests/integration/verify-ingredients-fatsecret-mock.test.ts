/**
 * FatSecret branch of verifyIngredients with mocked client (no OAuth / network).
 * Mirrors USDA/OFF mock integration style (P-P2-5).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fatSecretFoodSearch = vi.fn();
const fatSecretFoodGet = vi.fn();

vi.mock("@/lib/fatsecret/client", () => ({
  fatSecretConfigFromEnv: () => ({ consumerKey: "test-key", consumerSecret: "test-secret" }),
  fatSecretFoodSearch: (...args: unknown[]) => fatSecretFoodSearch(...args),
  fatSecretFoodGet: (...args: unknown[]) => fatSecretFoodGet(...args),
}));

vi.mock("@/lib/openFoodFacts/searchProducts", () => ({
  searchOffProducts: vi.fn(async () => []),
}));

vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => false,
  hasFatSecretConfig: () => true,
  hasEdamamConfig: () => false,
  hasSupabaseServiceConfig: () => false,
}));

import { verifyIngredients } from "@/lib/nutrition/verifyIngredients";

describe("verifyIngredients FatSecret (mocked client)", () => {
  beforeEach(() => {
    fatSecretFoodSearch.mockReset();
    fatSecretFoodGet.mockReset();
  });

  it("accepts a high-confidence FatSecret hit and scales macros for grams", async () => {
    fatSecretFoodSearch.mockResolvedValue([
      { food_id: "fs-1", food_name: "Chicken breast, skinless, raw" },
    ]);
    fatSecretFoodGet.mockResolvedValue({
      food_id: "fs-1",
      food_name: "Chicken breast, skinless, raw",
      servings: {
        serving: {
          metric_serving_amount: "100",
          metric_serving_unit: "g",
          calories: "165",
          protein: "31",
          carbohydrate: "0",
          fat: "3.6",
          fiber: "0",
          sugar: "0",
          sodium: "74",
        },
      },
    });

    const result = await verifyIngredients({
      ingredients: [{ name: "chicken breast", amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    expect(result.verified).toHaveLength(1);
    expect(result.verified[0]!.source).toBe("FatSecret");
    expect(result.verified[0]!.matchedName).toMatch(/chicken breast/i);
    expect(result.verified[0]!.macros?.calories).toBe(165);
    expect(result.verified[0]!.macros?.protein).toBe(31);
    expect(result.primarySource).toBe("FatSecret");
    expect(fatSecretFoodSearch).toHaveBeenCalled();
    expect(fatSecretFoodGet).toHaveBeenCalledWith(
      expect.objectContaining({ consumerKey: "test-key" }),
      "fs-1",
    );
  });

  it("skips low-confidence FatSecret hits and uses Estimated", async () => {
    fatSecretFoodSearch.mockResolvedValue([
      { food_id: "fs-cookie", food_name: "Chocolate sandwich cookies, creme-filled" },
    ]);
    fatSecretFoodGet.mockResolvedValue({
      food_id: "fs-cookie",
      food_name: "Chocolate sandwich cookies, creme-filled",
      servings: {
        serving: {
          metric_serving_amount: "100",
          metric_serving_unit: "g",
          calories: "480",
          protein: "5",
          carbohydrate: "68",
          fat: "22",
          fiber: "2",
          sugar: "40",
          sodium: "300",
        },
      },
    });

    const result = await verifyIngredients({
      ingredients: [{ name: "olive oil", amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    expect(fatSecretFoodGet).not.toHaveBeenCalled();
    expect(result.verified[0]!.source).toBe("Estimated");
    expect(result.primarySource).toBe("Estimated");
  });

  it("uses FatSecret when provider is fatsecret (USDA not consulted)", async () => {
    fatSecretFoodSearch.mockResolvedValue([{ food_id: "fs-2", food_name: "Whole milk, 3.25%" }]);
    fatSecretFoodGet.mockResolvedValue({
      food_id: "fs-2",
      food_name: "Whole milk, 3.25%",
      servings: {
        serving: {
          metric_serving_amount: "100",
          metric_serving_unit: "ml",
          calories: "61",
          protein: "3.2",
          carbohydrate: "4.8",
          fat: "3.3",
          fiber: "0",
          sugar: "4.8",
          sodium: "43",
        },
      },
    });

    const result = await verifyIngredients({
      ingredients: [{ name: "whole milk", amount: "200", unit: "ml" }],
      servings: 1,
      provider: "fatsecret",
    });

    expect(result.verified[0]!.source).toBe("FatSecret");
    expect(result.primarySource).toBe("FatSecret");
  });
});
