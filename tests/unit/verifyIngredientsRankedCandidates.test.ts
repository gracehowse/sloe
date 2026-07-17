/**
 * ENG-1426 (count-to-weight-1/2 + ne-A2) — Edamam and FatSecret now rank
 * their search-result candidates by name-match confidence instead of
 * trusting the provider's own result order (`results[0]` for FatSecret,
 * first-hit-above-floor for Edamam), mirroring the USDA/OFF ranked-
 * candidates pattern already in `verifyIngredients.ts`.
 *
 * Also pins ne-A2: a FatSecret serving with no metric weight resolved
 * (`servingMassGrams` → null) silently assumed a 100g serving at full
 * match confidence — a real multi-x macro-error risk invisible to the
 * self-consistency checks. It must now demote to `Math.min(0.5, conf - 0.1)`,
 * landing below the accept floor (0.55) so it surfaces for review instead
 * of silently joining totals.
 *
 * Mocking style mirrors `verifyIngredientsUsdaEdamamMicros.test.ts`: only
 * the provider under test is enabled via a controlled serverEnv mock, and
 * network calls are mocked so the branch under test is the sole resolver.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFdcFoodsSearch = vi.fn();
const mockEdamamFoodSearch = vi.fn();
const mockFatSecretFoodSearch = vi.fn();
const mockFatSecretFoodGet = vi.fn();

vi.mock("@/lib/usda/fdcClient", () => ({
  fdcConfigFromEnv: () => ({ apiKey: "test-key" }),
  fdcFoodsSearch: (...args: unknown[]) => mockFdcFoodsSearch(...args),
  fdcFoodGet: vi.fn(),
}));

vi.mock("@/lib/edamam/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/edamam/client")>();
  return {
    ...actual,
    edamamConfigFromEnv: () => ({ appId: "x", appKey: "y" }),
    edamamFoodSearch: (...args: unknown[]) => mockEdamamFoodSearch(...args),
  };
});

vi.mock("@/lib/fatsecret/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fatsecret/client")>();
  return {
    ...actual,
    fatSecretConfigFromEnv: () => ({ clientId: "x", clientSecret: "y" }),
    fatSecretFoodSearch: (...args: unknown[]) => mockFatSecretFoodSearch(...args),
    fatSecretFoodGet: (...args: unknown[]) => mockFatSecretFoodGet(...args),
  };
});

// OFF disabled — never let it resolve or hit the network.
vi.mock("@/lib/openFoodFacts/searchProducts", () => ({
  searchOffProducts: async () => [],
}));

vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => false,
  hasEdamamConfig: () => true,
  hasFatSecretConfig: () => true,
  hasSupabaseServiceConfig: () => false,
}));

import { verifyIngredients, confidenceForMatch } from "@/lib/nutrition/verifyIngredients";

beforeEach(() => {
  mockFdcFoodsSearch.mockReset().mockResolvedValue([]);
  mockEdamamFoodSearch.mockReset().mockResolvedValue([]);
  mockFatSecretFoodSearch.mockReset().mockResolvedValue([]);
  mockFatSecretFoodGet.mockReset();
});

describe("verifyIngredients — Edamam candidates ranked by confidence (ENG-1426)", () => {
  it("picks the higher-confidence hit even when it is NOT first in the search results", async () => {
    const query = "harissa paste";
    const lowHit = { food: { foodId: "edamam-low", label: "Harissa", nutrients: { ENERC_KCAL: 300, PROCNT: 3, FAT: 25, CHOCDF: 10 } } };
    const highHit = { food: { foodId: "edamam-high", label: "Harissa paste", nutrients: { ENERC_KCAL: 300, PROCNT: 3, FAT: 25, CHOCDF: 10 } } };
    const confLow = confidenceForMatch(query, lowHit.food.label);
    const confHigh = confidenceForMatch(query, highHit.food.label);
    // Sanity check the fixture actually exercises a confidence gap in the
    // intended direction; if scoring ever changes enough to flip this, the
    // fixture (not the pipeline) needs updating.
    expect(confHigh).toBeGreaterThan(confLow);

    // Provider order puts the LOWER-confidence hit first in the array —
    // pre-fix this made verifyIngredients return it unconditionally.
    mockEdamamFoodSearch.mockResolvedValue([lowHit, highHit]);

    const result = await verifyIngredients({
      ingredients: [{ name: query, amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    const row = result.verified[0]!;
    expect(row.source).toBe("Edamam");
    expect(row.fatSecretFoodId).toBe("edamam-high");
    expect(row.matchedName).toBe("Harissa paste");
  });
});

describe("verifyIngredients — FatSecret candidates ranked by confidence (ENG-1426, count-to-weight-1)", () => {
  it("picks the higher-confidence search result even when it is NOT results[0]", async () => {
    const query = "gochugaru powder";
    const lowResult = { food_id: "fs-low", food_name: "Gochugaru" };
    const highResult = { food_id: "fs-high", food_name: "Gochugaru powder" };
    const confLow = confidenceForMatch(query, lowResult.food_name);
    const confHigh = confidenceForMatch(query, highResult.food_name);
    expect(confHigh).toBeGreaterThan(confLow);

    // Pre-fix, verifyIngredients always evaluated only results[0] (fs-low).
    mockFatSecretFoodSearch.mockResolvedValue([lowResult, highResult]);
    mockFatSecretFoodGet.mockImplementation(async (_cfg: unknown, foodId: string) => ({
      servings: {
        serving: {
          serving_description: "100 g",
          metric_serving_amount: "100",
          metric_serving_unit: "g",
          calories: "300",
          protein: "3",
          carbohydrate: "10",
          fat: "25",
        },
      },
      food_id: foodId,
    }));

    const result = await verifyIngredients({
      ingredients: [{ name: query, amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    const row = result.verified[0]!;
    expect(row.source).toBe("FatSecret");
    expect(row.fatSecretFoodId).toBe("fs-high");
    expect(mockFatSecretFoodGet).toHaveBeenCalledWith(expect.anything(), "fs-high");
  });

  it("falls through to the next ranked candidate when the top one is an all-zero placeholder row", async () => {
    const query = "gochugaru powder";
    const results = [
      { food_id: "fs-placeholder", food_name: "Gochugaru powder" },
      { food_id: "fs-real", food_name: "Gochugaru" },
    ];
    mockFatSecretFoodSearch.mockResolvedValue(results);
    mockFatSecretFoodGet.mockImplementation(async (_cfg: unknown, foodId: string) => {
      if (foodId === "fs-placeholder") {
        return {
          servings: {
            serving: {
              serving_description: "100 g",
              metric_serving_amount: "100",
              metric_serving_unit: "g",
              calories: "0",
              protein: "0",
              carbohydrate: "0",
              fat: "0",
            },
          },
          food_id: foodId,
        };
      }
      return {
        servings: {
          serving: {
            serving_description: "100 g",
            metric_serving_amount: "100",
            metric_serving_unit: "g",
            calories: "300",
            protein: "3",
            carbohydrate: "10",
            fat: "25",
          },
        },
        food_id: foodId,
      };
    });

    const result = await verifyIngredients({
      ingredients: [{ name: query, amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    const row = result.verified[0]!;
    expect(row.source).toBe("FatSecret");
    expect(row.fatSecretFoodId).toBe("fs-real");
  });
});

describe("verifyIngredients — FatSecret assumed-100g serving demoted below the accept floor (ENG-1426, ne-A2)", () => {
  it("demotes confidence to Math.min(0.5, conf - 0.1) when no metric weight resolves", async () => {
    const query = "gochugaru powder";
    const foodName = "Gochugaru powder";
    mockFatSecretFoodSearch.mockResolvedValue([{ food_id: "fs-1", food_name: foodName }]);
    // No metric_serving_amount and a serving_description that doesn't parse
    // to a recognised unit — servingMassGrams() returns null, forcing the
    // assumed-100g fallback (servingG = servingMass ?? 100).
    mockFatSecretFoodGet.mockResolvedValue({
      servings: {
        serving: {
          serving_description: "1 serving",
          calories: "300",
          protein: "3",
          carbohydrate: "10",
          fat: "25",
        },
      },
      food_id: "fs-1",
    });

    const result = await verifyIngredients({
      ingredients: [{ name: query, amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    const row = result.verified[0]!;
    expect(row.source).toBe("FatSecret");
    const conf = confidenceForMatch(query, foodName);
    const expectedConfidence = Math.min(0.5, conf - 0.1);
    expect(row.confidence).toBeCloseTo(expectedConfidence, 10);
    // 0.5 is below MIN_ACCEPT_CONFIDENCE (0.55) — the row must surface for
    // review, not join totals silently at full match confidence.
    expect(row.confidence).toBeLessThan(0.55);
  });

  it("keeps full match confidence when a metric weight DOES resolve (no regression)", async () => {
    const query = "gochugaru powder";
    const foodName = "Gochugaru powder";
    mockFatSecretFoodSearch.mockResolvedValue([{ food_id: "fs-1", food_name: foodName }]);
    mockFatSecretFoodGet.mockResolvedValue({
      servings: {
        serving: {
          serving_description: "100 g",
          metric_serving_amount: "100",
          metric_serving_unit: "g",
          calories: "300",
          protein: "3",
          carbohydrate: "10",
          fat: "25",
        },
      },
      food_id: "fs-1",
    });

    const result = await verifyIngredients({
      ingredients: [{ name: query, amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    const row = result.verified[0]!;
    expect(row.source).toBe("FatSecret");
    const conf = confidenceForMatch(query, foodName);
    expect(row.confidence).toBeCloseTo(conf, 10);
  });
});
