/**
 * USDA branch of verifyIngredients with mocked FDC client (no API key / network).
 * Locks confidence gating + scaling for the external-match tier.
 *
 * Ingredient is "sirloin steak" deliberately: ENG-746 wired the curated
 * genericFoods/genericBeverages tables in as a higher-priority short-circuit, so
 * a staple like "chicken breast" now resolves to a curated "Suppr" row BEFORE
 * USDA is consulted. This test exercises the long-tail USDA branch, so it must
 * use a food absent from those tables (no beef/steak there). Don't change it
 * back to a curated staple — that would silently stop testing the USDA path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/openFoodFacts/searchProducts", () => ({
  searchOffProducts: vi.fn(async () => []),
}));

vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => true,
  hasFatSecretConfig: () => false,
  hasEdamamConfig: () => false,
  hasSupabaseServiceConfig: () => false,
}));

const mockSteakFood = {
  fdcId: 1001,
  description: "Sirloin steak, raw",
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
        fdcId: mockSteakFood.fdcId,
        description: "Sirloin steak, raw",
        dataType: "Foundation",
      },
    ]);
    vi.mocked(fdcFoodGet).mockResolvedValue(mockSteakFood);

    const result = await verifyIngredients({
      ingredients: [{ name: "sirloin steak", amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    expect(result.verified).toHaveLength(1);
    expect(result.verified[0]!.source).toBe("USDA");
    expect(result.verified[0]!.matchedName).toContain("Sirloin");
    expect(result.verified[0]!.macros?.calories).toBe(120);
    expect(result.verified[0]!.macros?.protein).toBe(23);
    expect(result.primarySource).toBe("USDA");
    expect(fdcFoodGet).toHaveBeenCalledWith(expect.anything(), mockSteakFood.fdcId);
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
      ingredients: [{ name: "sirloin steak", amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    expect(fdcFoodGet).not.toHaveBeenCalled();
    expect(result.verified[0]!.source).toBe("Estimated");
    expect(result.primarySource).toBe("Estimated");
  });

  it("uses fdcId override without search when override is provided", async () => {
    vi.mocked(fdcFoodGet).mockResolvedValue(mockSteakFood);

    const result = await verifyIngredients({
      ingredients: [{ name: "whatever label", amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
      overrides: [{ index: 0, fdcId: mockSteakFood.fdcId, description: mockSteakFood.description }],
    });

    expect(fdcFoodsSearch).not.toHaveBeenCalled();
    expect(result.verified[0]!.source).toBe("USDA");
    expect(result.verified[0]!.confidence).toBe(1);
    expect(result.verified[0]!.macros?.calories).toBe(120);
  });
});
