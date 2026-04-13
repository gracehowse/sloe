/**
 * USDA branch of verifyIngredients with mocked FDC client (no API key / network).
 * Locks confidence gating + scaling for the external-match tier.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/openFoodFacts/searchProducts", () => ({
  searchOffProducts: vi.fn(async () => []),
}));

vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => true,
  hasFatSecretConfig: () => false,
}));

const mockChickenFood = {
  fdcId: 1001,
  description: "Chicken, breast, meat only, raw",
  dataType: "Foundation",
  foodNutrients: [
    { nutrient: { name: "Energy", unitName: "KCAL" }, amount: 120 },
    { nutrient: { name: "Protein", unitName: "G" }, amount: 23 },
    { nutrient: { name: "Carbohydrate, by difference", unitName: "G" }, amount: 0 },
    { nutrient: { name: "Total lipid (fat)", unitName: "G" }, amount: 2.6 },
    { nutrient: { name: "Fiber, total dietary", unitName: "G" }, amount: 0 },
    { nutrient: { name: "Sugars, total including NLEA", unitName: "G" }, amount: 0 },
    { nutrient: { name: "Sodium, Na", unitName: "MG" }, amount: 45 },
  ],
};

vi.mock("@/lib/usda/fdcClient", () => ({
  fdcConfigFromEnv: vi.fn(() => ({ apiKey: "test-key" })),
  fdcFoodsSearch: vi.fn(),
  fdcFoodGet: vi.fn(),
}));

import { fdcFoodGet, fdcFoodsSearch } from "@/lib/usda/fdcClient";
import { verifyIngredients } from "@/lib/nutrition/verifyIngredients";

describe("verifyIngredients USDA (mocked FDC)", () => {
  beforeEach(() => {
    vi.mocked(fdcFoodsSearch).mockReset();
    vi.mocked(fdcFoodGet).mockReset();
  });

  it("accepts a high-confidence Foundation hit and scales macros for grams", async () => {
    vi.mocked(fdcFoodsSearch).mockResolvedValue([
      {
        fdcId: mockChickenFood.fdcId,
        description: "Chicken, breast, meat only, raw",
        dataType: "Foundation",
      },
    ]);
    vi.mocked(fdcFoodGet).mockResolvedValue(mockChickenFood);

    const result = await verifyIngredients({
      ingredients: [{ name: "chicken breast", amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    expect(result.verified).toHaveLength(1);
    expect(result.verified[0]!.source).toBe("USDA");
    expect(result.verified[0]!.matchedName).toContain("Chicken");
    expect(result.verified[0]!.macros?.calories).toBe(120);
    expect(result.verified[0]!.macros?.protein).toBe(23);
    expect(result.primarySource).toBe("USDA");
    expect(fdcFoodGet).toHaveBeenCalledWith(expect.anything(), mockChickenFood.fdcId);
  });

  it("skips low-confidence USDA hits and falls back to Estimated", async () => {
    vi.mocked(fdcFoodsSearch).mockResolvedValue([
      {
        fdcId: 9999,
        description: "Bread, white, commercially prepared (includes soft bread crumbs)",
        dataType: "Branded",
      },
    ]);

    const result = await verifyIngredients({
      ingredients: [{ name: "chicken breast", amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    expect(fdcFoodGet).not.toHaveBeenCalled();
    expect(result.verified[0]!.source).toBe("Estimated");
    expect(result.primarySource).toBe("Estimated");
  });

  it("uses fdcId override without search when override is provided", async () => {
    vi.mocked(fdcFoodGet).mockResolvedValue(mockChickenFood);

    const result = await verifyIngredients({
      ingredients: [{ name: "whatever label", amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
      overrides: [{ index: 0, fdcId: mockChickenFood.fdcId, description: mockChickenFood.description }],
    });

    expect(fdcFoodsSearch).not.toHaveBeenCalled();
    expect(result.verified[0]!.source).toBe("USDA");
    expect(result.verified[0]!.confidence).toBe(1);
    expect(result.verified[0]!.macros?.calories).toBe(120);
  });
});
