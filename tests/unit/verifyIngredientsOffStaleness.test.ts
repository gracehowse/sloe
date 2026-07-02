/**
 * ENG-1305 — the OFF search path in verifyIngredients.ts demotes confidence
 * for stale OFF rows (isOffDataStale), separately from (and after) the
 * existing basisCorrected demotion. These tests disable every OTHER
 * provider so a controlled, mocked OFF hit is the only thing that can
 * resolve — isolating the staleness behaviour from real network scoring.
 */
import { describe, it, expect, vi } from "vitest";

// A name that isn't in the curated generic-foods/beverages short-circuit
// table (which would resolve before the OFF search step ever runs).
const INGREDIENT_NAME = "za'atar spice blend";

const FRESH_HIT = {
  code: "0000000000001",
  name: "Za'atar Spice Blend",
  brand: "",
  calories: 380,
  protein: 12,
  carbs: 40,
  fat: 18,
  fiberG: 20,
  sugarG: 2,
  sodiumMg: 400,
  lastModifiedT: Math.floor(Date.now() / 1000) - 60 * 24 * 60 * 60, // 60 days ago
};

const STALE_HIT = {
  ...FRESH_HIT,
  code: "0000000000002",
  lastModifiedT: Math.floor(Date.now() / 1000) - 5 * 365 * 24 * 60 * 60, // 5 years ago
};

const mockSearchOffProducts = vi.fn();

vi.mock("@/lib/openFoodFacts/searchProducts", () => ({
  searchOffProducts: (...args: unknown[]) => mockSearchOffProducts(...args),
}));
vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => false,
  hasFatSecretConfig: () => false,
  hasEdamamConfig: () => false,
  hasSupabaseServiceConfig: () => false,
}));

import { verifyIngredients, MIN_ACCEPT_CONFIDENCE } from "@/lib/nutrition/verifyIngredients";

describe("verifyIngredients — OFF staleness demotion (ENG-1305)", () => {
  it("accepts a fresh OFF row at/above the accept floor", async () => {
    mockSearchOffProducts.mockResolvedValueOnce([FRESH_HIT]);
    const result = await verifyIngredients({
      ingredients: [{ name: INGREDIENT_NAME, amount: "10", unit: "g" }],
      servings: 1,
      provider: "auto",
    });
    const row = result.verified[0]!;
    expect(row.source).toBe("OFF");
    expect(row.confidence).toBeGreaterThanOrEqual(MIN_ACCEPT_CONFIDENCE);
    expect(row.belowAcceptFloor).toBeFalsy();
  });

  it("demotes a stale OFF row's confidence below the fresh row's", async () => {
    mockSearchOffProducts.mockResolvedValueOnce([FRESH_HIT]);
    const fresh = (
      await verifyIngredients({
        ingredients: [{ name: INGREDIENT_NAME, amount: "10", unit: "g" }],
        servings: 1,
        provider: "auto",
      })
    ).verified[0]!;

    mockSearchOffProducts.mockResolvedValueOnce([STALE_HIT]);
    const stale = (
      await verifyIngredients({
        ingredients: [{ name: INGREDIENT_NAME, amount: "10", unit: "g" }],
        servings: 1,
        provider: "auto",
      })
    ).verified[0]!;

    expect(stale.source).toBe("OFF");
    // Same underlying match quality — the only difference is lastModifiedT —
    // so the stale row must score strictly lower than the fresh one.
    expect(stale.confidence).toBeLessThan(fresh.confidence);
  });
});
