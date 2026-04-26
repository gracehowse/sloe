/**
 * F-79 (2026-04-25) — pin OFF micronutrient parser.
 *
 * Tester saw "Vitamins, minerals & more" panel showing "—" on every row
 * for OFF-sourced items (Pete & Gerry's eggs, Fly By Jing chili crisp,
 * fairlife shake) even though OFF ships sat fat / sodium / calcium /
 * iron / etc. Root cause was the OFF parser only reading kcal/P/C/F/
 * fiber/sugar/sodium and dropping every other nutriment field.
 *
 * This test pins:
 *  - OFF gram → mg/mcg unit conversion (sodium, calcium, vitamin D, …),
 *  - the canonical camelCase keys that match `MICRO_LINES`,
 *  - the "drop zero / non-finite" rule so absent fields don't pollute
 *    `nutrition_micros`,
 *  - `scaleMicrosForGrams` correctness + caller-override semantics.
 */
import { describe, expect, it } from "vitest";
import {
  parseOffMicrosPer100g,
  scaleMicrosForGrams,
} from "@/../src/lib/openFoodFacts/parseOffMicros";

describe("parseOffMicrosPer100g", () => {
  it("returns an empty object when nutriments is null / undefined / empty", () => {
    expect(parseOffMicrosPer100g(null)).toEqual({});
    expect(parseOffMicrosPer100g(undefined)).toEqual({});
    expect(parseOffMicrosPer100g({})).toEqual({});
  });

  it("converts OFF grams to mg for sodium / cholesterol / minerals", () => {
    // Pete & Gerry's egg-style payload: sodium 0.14 g/100g (=140 mg),
    // cholesterol 0.372 g/100g (=372 mg), iron 0.0017 g/100g (=1.7 mg).
    const out = parseOffMicrosPer100g({
      sodium_100g: 0.14,
      cholesterol_100g: 0.372,
      iron_100g: 0.0017,
      calcium_100g: 0.05,
    });
    expect(out.sodiumMg).toBe(140);
    expect(out.cholesterolMg).toBe(372);
    expect(out.ironMg).toBe(1.7);
    expect(out.calciumMg).toBe(50);
  });

  it("converts OFF grams to mcg for vitamin D / B12 / folate", () => {
    // 0.000005 g/100g = 5 mcg/100g (typical fortified yogurt vitamin D).
    const out = parseOffMicrosPer100g({
      "vitamin-d_100g": 0.000005,
      "vitamin-b12_100g": 0.0000012,
      folates_100g: 0.00012,
    });
    expect(out.vitaminDMcg).toBe(5);
    expect(out.vitaminB12Mcg).toBe(1.2);
    expect(out.folateMcg).toBe(120);
  });

  it("emits sat/mono/poly/trans fat in grams (no conversion)", () => {
    const out = parseOffMicrosPer100g({
      "saturated-fat_100g": 12.6,
      "monounsaturated-fat_100g": 25.4,
      "polyunsaturated-fat_100g": 8.1,
      "trans-fat_100g": 0.3,
    });
    expect(out.saturatedFatG).toBe(12.6);
    expect(out.monoFatG).toBe(25.4);
    expect(out.polyFatG).toBe(8.1);
    expect(out.transFatG).toBe(0.3);
  });

  it("converts caffeine grams → mg (closes F-13 dead-field drift)", () => {
    // Coffee at OFF: caffeine_100g = 0.04 g/100g → 40 mg/100g.
    const out = parseOffMicrosPer100g({ caffeine_100g: 0.04 });
    expect(out.caffeineMg).toBe(40);
  });

  it("falls back to alt OFF keys (folates → folate → vitamin-b9)", () => {
    expect(parseOffMicrosPer100g({ "vitamin-b9_100g": 0.0001 }).folateMcg).toBe(100);
    expect(parseOffMicrosPer100g({ folate_100g: 0.0002 }).folateMcg).toBe(200);
    expect(parseOffMicrosPer100g({ folates_100g: 0.0003 }).folateMcg).toBe(300);
  });

  it("drops zero / negative / non-finite values", () => {
    const out = parseOffMicrosPer100g({
      sodium_100g: 0,
      calcium_100g: -1,
      iron_100g: Number.NaN,
      magnesium_100g: Number.POSITIVE_INFINITY,
      "saturated-fat_100g": 0.0,
    });
    expect(out).toEqual({});
  });

  it("uses camelCase keys matching MICRO_LINES exactly", () => {
    const out = parseOffMicrosPer100g({
      sugars_100g: 4.2,
      sodium_100g: 0.1,
      "saturated-fat_100g": 1.2,
      "monounsaturated-fat_100g": 2.3,
      "polyunsaturated-fat_100g": 0.8,
      "trans-fat_100g": 0.05,
      cholesterol_100g: 0.05,
      caffeine_100g: 0.04,
      calcium_100g: 0.1,
      iron_100g: 0.001,
      magnesium_100g: 0.05,
      phosphorus_100g: 0.1,
      potassium_100g: 0.3,
      zinc_100g: 0.0015,
      "vitamin-c_100g": 0.04,
      "vitamin-d_100g": 0.000002,
      "vitamin-e_100g": 0.0015,
      "vitamin-k_100g": 0.000035,
      "vitamin-a_100g": 0.0001,
      "vitamin-b6_100g": 0.0008,
      "vitamin-b12_100g": 0.0000018,
      folates_100g: 0.00006,
    });
    // Spot-check the canonical keys are present
    for (const k of [
      "sugarG", "sodiumMg", "saturatedFatG", "monoFatG", "polyFatG", "transFatG",
      "cholesterolMg", "caffeineMg", "calciumMg", "ironMg", "magnesiumMg",
      "phosphorusMg", "potassiumMg", "zincMg", "vitaminCMg", "vitaminDMcg",
      "vitaminEMg", "vitaminKMcg", "vitaminAMcgRae", "vitaminB6Mg",
      "vitaminB12Mcg", "folateMcg",
    ]) {
      expect(out[k]).toBeDefined();
    }
  });
});

describe("scaleMicrosForGrams", () => {
  it("scales every key proportionally to grams / 100", () => {
    const per100 = { sodiumMg: 140, calciumMg: 50, saturatedFatG: 4.0 };
    const scaled = scaleMicrosForGrams(per100, 200);
    expect(scaled.sodiumMg).toBe(280);
    expect(scaled.calciumMg).toBe(100);
    expect(scaled.saturatedFatG).toBe(8);
  });

  it("returns empty when grams <= 0", () => {
    expect(scaleMicrosForGrams({ sodiumMg: 100 }, 0)).toEqual({});
    expect(scaleMicrosForGrams({ sodiumMg: 100 }, -50)).toEqual({});
  });

  it("merge overrides win — F-13 explicit caffeine/alcohol stays canonical", () => {
    const per100 = { caffeineMg: 50, sodiumMg: 100 };
    // Caller pre-computed caffeineMg = 95 (one cup of coffee, exactly).
    // Even though the per-100g would scale to a different value, the
    // explicit override wins.
    const scaled = scaleMicrosForGrams(per100, 240, { caffeineMg: 95 });
    expect(scaled.caffeineMg).toBe(95);
    expect(scaled.sodiumMg).toBe(240); // 100 * 2.4
  });

  it("drops keys that scale to zero", () => {
    const scaled = scaleMicrosForGrams({ ironMg: 0.1 }, 1); // 0.001 mg → rounds to 0
    expect(scaled.ironMg).toBeUndefined();
  });
});
