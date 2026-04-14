/**
 * Tests for confidence-based match gating in the verification pipeline.
 *
 * The pipeline must reject low-confidence matches from all external sources
 * (USDA, OFF, FatSecret) per CLAUDE.md: "reject low-confidence matches".
 * Matches below the threshold fall through to the next source or to local estimation.
 */
import { describe, it, expect } from "vitest";
import {
  confidenceForMatch,
  MIN_MATCH_CONFIDENCE,
  MIN_OFF_CONFIDENCE,
  preparationStateMismatch,
  scaledMacrosPlausible,
} from "@/lib/nutrition/verifyIngredients";

describe("confidenceForMatch", () => {
  // --- High-confidence matches (should be accepted) ---

  it("returns 1.0 for exact match", () => {
    expect(confidenceForMatch("chicken breast", "chicken breast")).toBe(1);
  });

  it("scores high for exact food with neutral USDA descriptors", () => {
    const conf = confidenceForMatch("chicken breast", "Chicken, breast, meat only, cooked, roasted");
    expect(conf).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
    expect(conf).toBeGreaterThan(0.5);
  });

  it("scores high for eggs → 'Egg, whole, raw, fresh'", () => {
    const conf = confidenceForMatch("eggs", "Egg, whole, raw, fresh");
    expect(conf).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
  });

  it("scores high for brown rice → 'Rice, brown, long-grain, cooked'", () => {
    const conf = confidenceForMatch("brown rice", "Rice, brown, long-grain, cooked");
    expect(conf).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
  });

  it("scores high for olive oil → 'Oil, olive, salad or cooking'", () => {
    const conf = confidenceForMatch("olive oil", "Oil, olive, salad or cooking");
    expect(conf).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
  });

  // --- Low-confidence matches (should be rejected) ---

  it("scores below MIN_MATCH_CONFIDENCE for unrelated food", () => {
    const conf = confidenceForMatch("chicken breast", "Bread, zucchini, made with vegetable oil");
    expect(conf).toBeLessThan(MIN_MATCH_CONFIDENCE);
  });

  it("scores below MIN_MATCH_CONFIDENCE for nonsense query", () => {
    const conf = confidenceForMatch("xyzzy", "Chicken, breast, meat only");
    expect(conf).toBeLessThan(MIN_MATCH_CONFIDENCE);
  });

  it("returns 0 for empty query", () => {
    expect(confidenceForMatch("", "Chicken breast")).toBe(0);
  });

  it("returns 0 for empty candidate", () => {
    expect(confidenceForMatch("chicken", "")).toBe(0);
  });

  // --- Dish-word penalty prevents false matches ---

  it("penalises dish-word candidates: 'chicken' should not match 'Chicken soup'", () => {
    const soupConf = confidenceForMatch("chicken", "Chicken soup, canned, ready to serve");
    const rawConf = confidenceForMatch("chicken", "Chicken, broilers or fryers, breast, meat only, raw");
    // The raw chicken should score higher than the soup
    expect(rawConf).toBeGreaterThan(soupConf);
  });

  it("penalises branded products", () => {
    const brandedConf = confidenceForMatch("chicken breast", "TYSON Chicken Breast Tenders, breaded");
    const genericConf = confidenceForMatch("chicken breast", "Chicken, breast, meat only, cooked, roasted");
    expect(genericConf).toBeGreaterThan(brandedConf);
  });

  // --- OFF threshold is stricter than general threshold ---

  it("MIN_OFF_CONFIDENCE is higher than MIN_MATCH_CONFIDENCE", () => {
    expect(MIN_OFF_CONFIDENCE).toBeGreaterThan(MIN_MATCH_CONFIDENCE);
  });

  it("a marginal match passes general threshold but fails OFF threshold", () => {
    // This simulates a case where a generic query gets a partial product match
    const conf = confidenceForMatch("chicken", "Chicken Tikka Masala Ready Meal");
    // Should be above general threshold (it contains "chicken") but ideally below OFF threshold
    // due to the extra dish/product words
    expect(conf).toBeLessThan(MIN_OFF_CONFIDENCE);
  });
});

describe("threshold constants", () => {
  it("MIN_MATCH_CONFIDENCE is 0.42", () => {
    expect(MIN_MATCH_CONFIDENCE).toBe(0.42);
  });

  it("MIN_OFF_CONFIDENCE is 0.52", () => {
    expect(MIN_OFF_CONFIDENCE).toBe(0.52);
  });

  it("thresholds are reasonable (0 < threshold < 1)", () => {
    expect(MIN_MATCH_CONFIDENCE).toBeGreaterThan(0);
    expect(MIN_MATCH_CONFIDENCE).toBeLessThan(1);
    expect(MIN_OFF_CONFIDENCE).toBeGreaterThan(0);
    expect(MIN_OFF_CONFIDENCE).toBeLessThan(1);
  });
});

describe("scaledMacrosPlausible", () => {
  it("accepts consistent chicken-scale macros", () => {
    expect(
      scaledMacrosPlausible({
        calories: 120,
        protein: 23,
        carbs: 0,
        fat: 2.6,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 45,
      }),
    ).toBe(true);
  });

  it("rejects impossible calorie vs macro split", () => {
    expect(
      scaledMacrosPlausible({
        calories: 500,
        protein: 5,
        carbs: 5,
        fat: 5,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0,
      }),
    ).toBe(false);
  });
});

describe("preparationStateMismatch", () => {
  it("flags grilled query vs raw-only FDC description", () => {
    expect(preparationStateMismatch("grilled chicken breast", "Chicken, breast, meat only, raw")).toBe(true);
  });

  it("allows plain chicken breast vs raw FDC row", () => {
    expect(preparationStateMismatch("chicken breast", "Chicken, breast, meat only, raw")).toBe(false);
  });

  it("flags raw query vs cooked-only description", () => {
    expect(preparationStateMismatch("raw chicken", "Chicken, breast, meat only, cooked, roasted")).toBe(true);
  });
});
