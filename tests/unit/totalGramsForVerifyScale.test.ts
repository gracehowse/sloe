import { describe, expect, it } from "vitest";
import { scaleFromPer100gGrams } from "../../src/lib/openFoodFacts/scaleFromPer100g";
import {
  totalGramsForVerifyScale,
  totalGramsForVerifyScaleDetailed,
} from "../../src/lib/nutrition/totalGramsForVerifyScale";

/**
 * P0-2 (2026-04-25): density lookup shipped. ml amounts now resolve to grams
 * via (in priority order) chosenPortion.gramWeight, options.gPerMl, or
 * densityForName via the STAPLES table. ml without any resolved density
 * returns 0 (refused) — callers must surface a "needs density" affordance.
 *
 * Previous version of this file pinned the ml=g BUG with `it.fails(...)`;
 * those assertions now run as regular `it(...)` and pass.
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

describe("totalGramsForVerifyScale — ml density resolution", () => {
  it("T-density: 100 ml of an ingredient without a resolved density returns 0 (refused)", () => {
    const ing = { unit: "ml" as const, chosenPortion: null };
    // Caller did not supply name or options.gPerMl — refuse rather than
    // silently report 100 ml as 100 g.
    expect(totalGramsForVerifyScale(ing, 100)).toBe(0);
    const detailed = totalGramsForVerifyScaleDetailed(ing, 100);
    expect(detailed).toEqual({ grams: 0, densityRefused: true });
  });

  it("T-density: ml resolves correctly when chosenPortion provides gramWeight", () => {
    const ing = {
      unit: "ml",
      // 100 ml olive oil ≈ 92 g — caller has already resolved density.
      chosenPortion: { label: "100 ml", gramWeight: 92 },
    };
    expect(totalGramsForVerifyScale(ing, 1)).toBe(92);
  });

  it("T-density: ml resolves via name lookup when chosenPortion is missing", () => {
    const ing = { name: "olive oil", unit: "ml" as const, chosenPortion: null };
    // STAPLES["olive oil"].gPerMl = 0.92 → 100 ml × 0.92 = 92 g.
    expect(totalGramsForVerifyScale(ing, 100)).toBeCloseTo(92, 5);
  });

  it("T-density: ml resolves via name lookup for honey (over-1.0 density)", () => {
    const ing = { name: "honey", unit: "ml" as const, chosenPortion: null };
    // STAPLES["honey"].gPerMl = 1.42 → 100 ml × 1.42 = 142 g.
    expect(totalGramsForVerifyScale(ing, 100)).toBeCloseTo(142, 5);
  });

  it("T-density: options.gPerMl overrides name-resolved density", () => {
    const ing = { name: "olive oil", unit: "ml" as const, chosenPortion: null };
    // Caller passes a different density (e.g. a measured value from a food
    // match) — overrides the staple lookup.
    expect(totalGramsForVerifyScale(ing, 100, { gPerMl: 1.0 })).toBe(100);
  });

  it("T-density: trivial {label:'ml', gramWeight:1} placeholder routes through density resolution", () => {
    // STANDARD_UNITS in verify.tsx ships this shape when the user picks the
    // generic "ml" unit. Function should ignore the trivial gramWeight=1
    // and resolve via name density instead.
    const ing = {
      name: "olive oil",
      unit: "ml" as const,
      chosenPortion: { label: "ml", gramWeight: 1 },
    };
    expect(totalGramsForVerifyScale(ing, 100)).toBeCloseTo(92, 5);
  });

  it("T-density: trivial ml placeholder + no name + no gPerMl returns 0 (refused)", () => {
    const ing = {
      unit: "ml" as const,
      chosenPortion: { label: "ml", gramWeight: 1 },
    };
    expect(totalGramsForVerifyScale(ing, 100)).toBe(0);
    expect(totalGramsForVerifyScaleDetailed(ing, 100)).toEqual({
      grams: 0,
      densityRefused: true,
    });
  });

  it("T-density: ml with a non-trivial chosenPortion gramWeight wins over name lookup", () => {
    // If the caller resolved density via the food match and stored it on
    // chosenPortion, that wins — name lookup is only a fallback.
    const ing = {
      name: "olive oil",
      unit: "ml" as const,
      chosenPortion: { label: "100 ml", gramWeight: 95 }, // measured density
    };
    expect(totalGramsForVerifyScale(ing, 1)).toBe(95);
  });

  it("T-density: scaling per-100g macros for 100 ml olive oil yields 884 kcal × 0.92", () => {
    const ing = { name: "olive oil", unit: "ml" as const, chosenPortion: null };
    const grams = totalGramsForVerifyScale(ing, 100);
    expect(grams).toBeCloseTo(92, 5);
    const oilPer100g = {
      calories: 884,
      protein: 0,
      carbs: 0,
      fat: 100,
      fiberG: 0,
      sugarG: 0,
      sodiumMg: 0,
    };
    const scaled = scaleFromPer100gGrams(oilPer100g, grams);
    // 884 × 92 / 100 = 813.28 kcal (scaler may round to integer). Pre-fix
    // the same input scaled to 884 kcal (ml=g bug). Anything under ~830
    // means the density correction landed.
    expect(scaled.calories).toBeGreaterThan(800);
    expect(scaled.calories).toBeLessThan(820);
    // Sanity: pre-fix value (884) is now firmly excluded.
    expect(scaled.calories).toBeLessThan(884);
  });
});

describe("totalGramsForVerifyScale — invalid input", () => {
  it("returns 0 for non-finite or non-positive amounts", () => {
    const ing = { unit: "g" as const, chosenPortion: null };
    expect(totalGramsForVerifyScale(ing, 0)).toBe(0);
    expect(totalGramsForVerifyScale(ing, -1)).toBe(0);
    expect(totalGramsForVerifyScale(ing, Number.NaN)).toBe(0);
    expect(totalGramsForVerifyScale(ing, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
