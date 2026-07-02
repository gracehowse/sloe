/**
 * ENG-1332 — verifyIngredients now carries the USDA + Edamam micro panels
 * (follow-up to ENG-1299, which did FatSecret + OFF). Micros scale with the
 * SAME grams as the macros (micros ∝ macros; absent ≠ zero; no synthesis).
 *
 * These tests enable ONLY the provider under test (via a controlled serverEnv
 * mock) and feed a mocked hit, so the USDA / Edamam network branch is the sole
 * resolver. Expected micros are computed with the REAL extractors + scaler so
 * the assertion can never drift from the production scaling contract.
 *
 * USDA — the recipe branch already holds the full `fdcFoodGet` response at the
 * match site, so it carries the FULL panel. Edamam — the /parser search hit
 * only carries the minimal block (fiber/sugar/sodium); the full 35-field panel
 * needs a per-hit /nutrients POST that we deliberately DON'T fetch on the
 * import critical path, so Edamam carries the search-hit panel only.
 */
import { describe, it, expect, vi } from "vitest";
import type { FdcFood } from "@/lib/usda/fdcClient";

// Non-curated names so the genericFoods/genericBeverages short-circuit doesn't
// resolve them before the network provider runs.
const USDA_QUERY = "gruyere cheese";
const EDAMAM_QUERY = "gochujang paste";

// Gruyère per-100g panel — realistic macros + a full micro set (keyed by USDA
// nutrient NUMBER, which `fdcFoodMicrosPer100g` reads).
const GRUYERE: FdcFood = {
  fdcId: 900001,
  description: "gruyere cheese",
  foodNutrients: [
    { nutrient: { name: "Energy", number: "208", unitName: "kcal" }, amount: 413 },
    { nutrient: { name: "Protein", number: "203", unitName: "g" }, amount: 30 },
    { nutrient: { name: "Total lipid (fat)", number: "204", unitName: "g" }, amount: 32 },
    { nutrient: { name: "Carbohydrate, by difference", number: "205", unitName: "g" }, amount: 0.4 },
    { nutrient: { name: "Sodium, Na", number: "307", unitName: "mg" }, amount: 336 },
    { nutrient: { name: "Calcium, Ca", number: "301", unitName: "mg" }, amount: 1011 },
    { nutrient: { name: "Fatty acids, total saturated", number: "606", unitName: "g" }, amount: 19 },
    { nutrient: { name: "Cholesterol", number: "601", unitName: "mg" }, amount: 110 },
  ],
} as unknown as FdcFood;

const EDAMAM_HIT = {
  food: {
    foodId: "food_edamam_gochujang",
    label: "gochujang paste",
    nutrients: {
      ENERC_KCAL: 200,
      PROCNT: 6,
      FAT: 2,
      CHOCDF: 40,
      FIBTG: 3,
      SUGAR: 20,
      NA: 3000,
    },
  },
};

const mockFdcFoodsSearch = vi.fn();
const mockFdcFoodGet = vi.fn();
const mockEdamamFoodSearch = vi.fn();

vi.mock("@/lib/usda/fdcClient", () => ({
  fdcConfigFromEnv: () => ({ apiKey: "test-key" }),
  fdcFoodsSearch: (...args: unknown[]) => mockFdcFoodsSearch(...args),
  fdcFoodGet: (...args: unknown[]) => mockFdcFoodGet(...args),
}));

// Keep the real extractors (edamamFoodMacrosPer100g / edamamFoodMicrosPer100g);
// only override the config + search so a controlled hit resolves.
vi.mock("@/lib/edamam/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/edamam/client")>();
  return {
    ...actual,
    edamamConfigFromEnv: () => ({ appId: "x", appKey: "y" }),
    edamamFoodSearch: (...args: unknown[]) => mockEdamamFoodSearch(...args),
  };
});

// OFF disabled — never let it resolve or hit the network.
vi.mock("@/lib/openFoodFacts/searchProducts", () => ({
  searchOffProducts: async () => [],
}));

// USDA + Edamam enabled; FatSecret + Suppr-DB off. Provider order is
// Suppr → USDA → Edamam → OFF → FatSecret, so which one resolves is
// controlled by which mock returns a hit.
vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => true,
  hasEdamamConfig: () => true,
  hasFatSecretConfig: () => false,
  hasSupabaseServiceConfig: () => false,
}));

import { verifyIngredients } from "@/lib/nutrition/verifyIngredients";
import { fdcFoodMicrosPer100g } from "@/lib/nutrition/usdaNormalize";
import { edamamFoodMicrosPer100g } from "@/lib/edamam/client";
import { scaleMicrosForGrams } from "@/lib/openFoodFacts/parseOffMicros";

describe("verifyIngredients — USDA micros carry (ENG-1332)", () => {
  it("carries the USDA micro panel scaled by the same grams as the macros", async () => {
    mockFdcFoodsSearch.mockResolvedValue([{ fdcId: 900001, description: "gruyere cheese" }]);
    mockFdcFoodGet.mockResolvedValue(GRUYERE);

    const grams = 50;
    const result = await verifyIngredients({
      ingredients: [{ name: USDA_QUERY, amount: String(grams), unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    const row = result.verified[0]!;
    expect(row.source).toBe("USDA");
    // micros ∝ macros: the exact per-100g panel scaled by the resolved grams.
    const expected = scaleMicrosForGrams(fdcFoodMicrosPer100g(GRUYERE), grams);
    expect(Object.keys(expected).length).toBeGreaterThan(0);
    expect(row.micros).toEqual(expected);
    // Carried a real calcium value (per-100g 1011 × 50/100, scaler-rounded).
    expect(row.micros!.calciumMg).toBeGreaterThan(0);
  });

  it("scales micros by effectiveGrams (portion-aware), not the raw grams input (adversarial self-review catch)", async () => {
    // "2 slice ham" — a food-specific portion weight (28g/slice) overrides the
    // generic per-gram default. If a future regression scaled micros with the
    // raw `grams` parsed from the ingredient line instead of the resolved
    // `effectiveGrams`, this is the only test that would catch it (the other
    // USDA tests use unit: "g", which never enters the portion-lookup branch).
    const HAM: FdcFood = {
      fdcId: 900003,
      description: "ham, sliced",
      foodNutrients: [
        { nutrient: { name: "Energy", number: "208", unitName: "kcal" }, amount: 145 },
        { nutrient: { name: "Protein", number: "203", unitName: "g" }, amount: 21 },
        { nutrient: { name: "Total lipid (fat)", number: "204", unitName: "g" }, amount: 5 },
        { nutrient: { name: "Carbohydrate, by difference", number: "205", unitName: "g" }, amount: 1.5 },
        { nutrient: { name: "Sodium, Na", number: "307", unitName: "mg" }, amount: 1200 },
      ],
      foodPortions: [{ portionDescription: "1 slice", modifier: "slice", measureUnit: { name: "slice" }, gramWeight: 28 }],
    } as unknown as FdcFood;
    mockFdcFoodsSearch.mockResolvedValue([{ fdcId: 900003, description: "ham, sliced" }]);
    mockFdcFoodGet.mockResolvedValue(HAM);

    const result = await verifyIngredients({
      ingredients: [{ name: "ham", amount: "2", unit: "slice" }],
      servings: 1,
      provider: "auto",
    });

    const row = result.verified[0]!;
    expect(row.source).toBe("USDA");
    // effectiveGrams = 2 slices × 28g = 56g — NOT the generic-default grams
    // the estimator would otherwise assign to a bare "2 ham".
    const effectiveGrams = 56;
    const expected = scaleMicrosForGrams(fdcFoodMicrosPer100g(HAM), effectiveGrams);
    expect(Object.keys(expected).length).toBeGreaterThan(0);
    expect(row.micros).toEqual(expected);
    // Macros must agree with the SAME effectiveGrams basis (sodium 1200mg/100g × 56/100).
    expect(row.macros!.sodiumMg).toBeCloseTo(1200 * (effectiveGrams / 100), 0);
  });

  it("emits no micros key when the USDA food publishes none (absent ≠ zero)", async () => {
    const bare = {
      fdcId: 900002,
      description: "gruyere cheese",
      foodNutrients: [
        { nutrient: { name: "Energy", number: "208", unitName: "kcal" }, amount: 413 },
        { nutrient: { name: "Protein", number: "203", unitName: "g" }, amount: 30 },
        { nutrient: { name: "Total lipid (fat)", number: "204", unitName: "g" }, amount: 32 },
        { nutrient: { name: "Carbohydrate, by difference", number: "205", unitName: "g" }, amount: 0.4 },
      ],
    } as unknown as FdcFood;
    mockFdcFoodsSearch.mockResolvedValue([{ fdcId: 900002, description: "gruyere cheese" }]);
    mockFdcFoodGet.mockResolvedValue(bare);

    const result = await verifyIngredients({
      ingredients: [{ name: USDA_QUERY, amount: "50", unit: "g" }],
      servings: 1,
      provider: "auto",
    });
    const row = result.verified[0]!;
    expect(row.source).toBe("USDA");
    expect(row.micros).toBeUndefined();
  });
});

describe("verifyIngredients — Edamam micros carry (ENG-1332)", () => {
  it("carries the Edamam search-hit micro panel scaled by the same grams", async () => {
    // USDA yields nothing so the chain falls through to Edamam.
    mockFdcFoodsSearch.mockResolvedValue([]);
    mockEdamamFoodSearch.mockResolvedValue([EDAMAM_HIT]);

    const grams = 50;
    const result = await verifyIngredients({
      ingredients: [{ name: EDAMAM_QUERY, amount: String(grams), unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    const row = result.verified[0]!;
    expect(row.source).toBe("Edamam");
    const expected = scaleMicrosForGrams(edamamFoodMicrosPer100g(EDAMAM_HIT.food), grams);
    expect(Object.keys(expected).length).toBeGreaterThan(0);
    expect(row.micros).toEqual(expected);
  });
});
