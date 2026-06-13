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
      { food_id: "fs-1", food_name: "Sirloin steak, raw" },
    ]);
    fatSecretFoodGet.mockResolvedValue({
      food_id: "fs-1",
      food_name: "Sirloin steak, raw",
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
      ingredients: [{ name: "sirloin steak", amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    expect(result.verified).toHaveLength(1);
    expect(result.verified[0]!.source).toBe("FatSecret");
    expect(result.verified[0]!.matchedName).toMatch(/sirloin steak/i);
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
    // ENG-746: ingredient is "sirloin steak" (absent from the curated
    // genericFoods/genericBeverages tables) so the exact-alias short-circuit
    // doesn't intercept it and the FatSecret branch is genuinely exercised.
    // "Sirloin steak" matches the candidate exactly, clearing the accept floor.
    fatSecretFoodSearch.mockResolvedValue([{ food_id: "fs-2", food_name: "Sirloin steak" }]);
    fatSecretFoodGet.mockResolvedValue({
      food_id: "fs-2",
      food_name: "Sirloin steak",
      servings: {
        serving: {
          metric_serving_amount: "100",
          metric_serving_unit: "g",
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
      ingredients: [{ name: "sirloin steak", amount: "200", unit: "g" }],
      servings: 1,
      provider: "fatsecret",
    });

    expect(result.verified[0]!.source).toBe("FatSecret");
    expect(result.primarySource).toBe("FatSecret");
  });

  // ── ENG-691 — accept floor (0.70) + totals exclusion ──────────────────────

  it("an accepted FatSecret match (≥0.70) is NOT flagged below-floor and DOES sum into totals", async () => {
    fatSecretFoodSearch.mockResolvedValue([{ food_id: "fs-ok", food_name: "Sirloin steak" }]);
    fatSecretFoodGet.mockResolvedValue({
      food_id: "fs-ok",
      food_name: "Sirloin steak",
      servings: {
        serving: {
          metric_serving_amount: "100",
          metric_serving_unit: "g",
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
      ingredients: [{ name: "sirloin steak", amount: "200", unit: "g" }],
      servings: 1,
      provider: "fatsecret",
    });

    expect(result.verified[0]!.source).toBe("FatSecret");
    expect(result.verified[0]!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.verified[0]!.belowAcceptFloor).toBeUndefined();
    expect(result.belowAcceptFloorCount).toBe(0);
    // 61 kcal/100g × 200g = ~122 kcal flows into the headline.
    expect(result.totals.calories).toBeGreaterThan(0);
    expect(result.totals.calories).toBe(result.verified[0]!.macros?.calories);
  });

  it("a sub-floor estimate keeps its macros on the row but is excluded from totals", async () => {
    // Force a fall-through to the local estimator (no usable FatSecret hit):
    // the estimator returns a low-confidence (≤0.35) Estimated row.
    fatSecretFoodSearch.mockResolvedValue([]);

    const result = await verifyIngredients({
      ingredients: [{ name: "olive oil", amount: "1", unit: "tbsp" }],
      servings: 1,
      provider: "fatsecret",
    });

    const row = result.verified[0]!;
    expect(row.source).toBe("Estimated");
    expect(row.confidence).toBeLessThan(0.7);
    expect(row.belowAcceptFloor).toBe(true);
    expect(row.macros?.calories).toBeGreaterThan(0); // estimate preserved on the row…
    expect(result.totals.calories).toBe(0); // …but not silently summed.
    expect(result.belowAcceptFloorCount).toBe(1);
  });

  it("mixed recipe: accepted row sums, sub-floor row is excluded and counted", async () => {
    fatSecretFoodSearch.mockImplementation(async (_cfg: unknown, query: string) => {
      if (/steak/i.test(query)) return [{ food_id: "fs-mix", food_name: "Sirloin steak" }];
      return []; // the second ingredient finds no provider hit → local estimate.
    });
    fatSecretFoodGet.mockResolvedValue({
      food_id: "fs-mix",
      food_name: "Sirloin steak",
      servings: {
        serving: {
          metric_serving_amount: "100",
          metric_serving_unit: "g",
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
      ingredients: [
        { name: "sirloin steak", amount: "200", unit: "g" },
        { name: "olive oil", amount: "1", unit: "tbsp" },
      ],
      servings: 1,
      provider: "fatsecret",
    });

    const steak = result.verified.find((v) => v.source === "FatSecret")!;
    const oil = result.verified.find((v) => v.source === "Estimated")!;
    expect(steak.belowAcceptFloor).toBeUndefined();
    expect(oil.belowAcceptFloor).toBe(true);
    expect(result.belowAcceptFloorCount).toBe(1);
    // Totals reflect ONLY the accepted (FatSecret) row.
    expect(result.totals.calories).toBe(steak.macros?.calories);
  });
});
