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
  MIN_ACCEPT_CONFIDENCE,
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

  it("scores high (clears the accept floor) for exact food with neutral USDA descriptors", () => {
    const conf = confidenceForMatch("chicken breast", "Chicken, breast, meat only, cooked, roasted");
    expect(conf).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
    expect(conf).toBeGreaterThan(0.9);
  });

  it("scores high (clears the accept floor) for eggs → 'Egg, whole, raw, fresh'", () => {
    const conf = confidenceForMatch("eggs", "Egg, whole, raw, fresh");
    expect(conf).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
  });

  it("scores high (clears the accept floor) for olive oil → 'Oil, olive, salad or cooking'", () => {
    const conf = confidenceForMatch("olive oil", "Oil, olive, salad or cooking");
    expect(conf).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
  });

  // ── ENG-691 over-rejection watch (nutrition-engine impact review REQUIRED) ──
  // These common staples score in the OLD 0.42–0.70 accepted band but FAIL the
  // raised 0.70 floor on the current scorer. They are pinned here NOT as a
  // desired outcome but so the over-rejection surface is visible and tracked.
  // If a nutrition-engine impact review re-tunes MIN_ACCEPT_CONFIDENCE or the
  // scorer, this block is the canary that flips. See verifyIngredients.ts
  // header on MIN_ACCEPT_CONFIDENCE.
  it("KNOWN over-rejection: 'brown rice' scores below the 0.55 floor on the current scorer", () => {
    const conf = confidenceForMatch("brown rice", "Rice, brown, long-grain, cooked");
    expect(conf).toBeGreaterThan(0.4); // it IS a reasonable match…
    expect(conf).toBeLessThan(MIN_ACCEPT_CONFIDENCE); // …but the raised floor rejects it.
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

  it("a noisy ready-meal match fails both the general and the OFF threshold", () => {
    // A generic query against a dish/product name — well below both gates.
    const conf = confidenceForMatch("chicken", "Chicken Tikka Masala Ready Meal");
    expect(conf).toBeLessThan(MIN_MATCH_CONFIDENCE);
    expect(conf).toBeLessThan(MIN_OFF_CONFIDENCE);
  });
});

describe("threshold constants (ENG-691, Decision D-05)", () => {
  // ENG-691 shipped at 0.55, not 0.70: nutrition-engine impact model (2026-05-26)
  // found 0.70 over-rejects verbose-descriptor staples (brown rice/salmon/tomatoes/
  // flour/milk). 0.55 still tightens from the old 0.42. The 0.70 *band* remains the
  // display/trust signal in verifyConfidencePolicy; ENG-746 tracks the path to a
  // genuine 0.70 accept floor.
  it("MIN_ACCEPT_CONFIDENCE is the tightened accept floor, 0.55", () => {
    expect(MIN_ACCEPT_CONFIDENCE).toBe(0.55);
  });

  it("MIN_MATCH_CONFIDENCE equals the accept floor (0.55)", () => {
    expect(MIN_MATCH_CONFIDENCE).toBe(MIN_ACCEPT_CONFIDENCE);
    expect(MIN_MATCH_CONFIDENCE).toBe(0.55);
  });

  it("MIN_OFF_CONFIDENCE is stricter than the general floor (0.57)", () => {
    expect(MIN_OFF_CONFIDENCE).toBe(0.57);
    expect(MIN_OFF_CONFIDENCE).toBeGreaterThan(MIN_MATCH_CONFIDENCE);
  });

  it("thresholds are reasonable (0 < threshold < 1)", () => {
    expect(MIN_ACCEPT_CONFIDENCE).toBeGreaterThan(0);
    expect(MIN_ACCEPT_CONFIDENCE).toBeLessThan(1);
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
