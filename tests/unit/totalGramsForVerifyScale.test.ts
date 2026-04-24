import { describe, expect, it } from "vitest";
import { scaleFromPer100gGrams } from "../../src/lib/openFoodFacts/scaleFromPer100g";
import { totalGramsForVerifyScale } from "../../src/lib/nutrition/totalGramsForVerifyScale";

/**
 * T5 (full-sweep 2026-04-24): this suite was previously pinning the
 * `ml === g` BUG as correct. The sweep flagged that olive oil
 * (~0.92 g/ml) under-scales kcal by ~9% and honey (~1.42 g/ml) over-scales
 * by ~42% because the function treats ml amounts as grams.
 *
 * The `ml` test below now asserts the CORRECT behaviour expected after a
 * density lookup ships: ml without a resolved chosenPortion gramWeight
 * must not pass through as if it were grams. The test deliberately fails
 * on the current implementation.
 */

const per100g = {
  calories: 100,
  protein: 10,
  carbs: 5,
  fat: 2,
  fiberG: 1,
  sugarG: 0,
  sodiumMg: 0,
};

describe("totalGramsForVerifyScale — grams and label portions (unchanged)", () => {
  it("treats g rows with no chosenPortion as grams (not ×100)", () => {
    const ing = { unit: "g" as const, chosenPortion: null };
    expect(totalGramsForVerifyScale(ing, 500)).toBe(500);
    const scaled = scaleFromPer100gGrams(per100g, 500);
    expect(scaled.calories).toBe(500);
    expect(scaled.protein).toBe(50);
  });

  it("uses gramWeight × count for label servings", () => {
    const ing = {
      unit: "1 portion (170 g)",
      chosenPortion: { label: "1 portion (170 g)", gramWeight: 170 },
    };
    expect(totalGramsForVerifyScale(ing, 2)).toBe(340);
    const scaled = scaleFromPer100gGrams(per100g, 340);
    expect(scaled.calories).toBe(340);
  });

  it("treats explicit chosenPortion g as raw grams", () => {
    const ing = {
      unit: "g",
      chosenPortion: { label: "g", gramWeight: 1 },
    };
    expect(totalGramsForVerifyScale(ing, 500)).toBe(500);
  });
});

describe("totalGramsForVerifyScale — ml without density", () => {
  /**
   * BUG: ml with no chosenPortion gramWeight falls through to `treat as
   * grams` (line 16–20 of totalGramsForVerifyScale.ts). That silently
   * under-scales olive oil by ~9% and over-scales honey by ~42%.
   *
   * This test FAILS on the current implementation (returns 100) and
   * PASSES once a density lookup OR a caller-side measureToGrams resolve
   * ships.
   */
  it.fails("T-density: 100 ml of an ingredient without a resolved density must not be reported as 100 g", () => {
    const ing = { unit: "ml" as const, chosenPortion: null };
    // Correct behaviour: return 0 (or null / undefined), signalling the
    // caller to resolve density via the food match before scaling. The
    // current implementation returns 100 unconditionally, which is
    // accurate for water only.
    expect(totalGramsForVerifyScale(ing, 100)).toBe(0);
  });

  it.fails("T-density: ml resolves correctly when chosenPortion provides gramWeight", () => {
    // Once density lookup ships, the caller populates chosenPortion with
    // a g weight derived from the matched food's density. The resolver
    // should use that weight, not fall back to the ml amount.
    const ing = {
      unit: "ml",
      // 100 ml olive oil ≈ 92 g
      chosenPortion: { label: "100 ml", gramWeight: 92 },
    };
    expect(totalGramsForVerifyScale(ing, 1)).toBe(92);
  });
});
