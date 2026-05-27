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
import { reconcileOffPer100g } from "@/../src/lib/openFoodFacts/reconcilePer100g";

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

describe("parseOffMicrosPer100g — per-100g factor (ENG-738 micro scale)", () => {
  it("applies a factor < 1 to every micro (serving-basis rescale)", () => {
    // Same payload as the F-79 sodium/cholesterol/iron test, but the row is a
    // 50 g serving-basis pack whose `*_100g` fields hold per-50g values, so the
    // true-per-100g factor is 100/50 = 2... here we instead simulate a factor
    // of 0.5 (a 200 g serving) to prove the multiply lands before rounding.
    const out = parseOffMicrosPer100g(
      { sodium_100g: 0.28, cholesterol_100g: 0.744, iron_100g: 0.0034, calcium_100g: 0.1 },
      0.5,
    );
    expect(out.sodiumMg).toBe(140); // 0.28 * 0.5 * 1000
    expect(out.cholesterolMg).toBe(372); // 0.744 * 0.5 * 1000
    expect(out.ironMg).toBe(1.7); // 0.0034 * 0.5 * 1000
    expect(out.calciumMg).toBe(50); // 0.1 * 0.5 * 1000
  });

  it("factor defaults to 1 (omitted arg leaves values unchanged)", () => {
    const out = parseOffMicrosPer100g({ sodium_100g: 0.14, calcium_100g: 0.05 });
    expect(out.sodiumMg).toBe(140);
    expect(out.calciumMg).toBe(50);
  });

  it("a garbage factor (0 / negative / NaN) is treated as 1 — never zeroes micros", () => {
    for (const bad of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const out = parseOffMicrosPer100g({ sodium_100g: 0.14 }, bad);
      expect(out.sodiumMg).toBe(140);
    }
  });
});

/**
 * ENG-738 (2026-05-26) — the correctness gate. A KNOWN serving-based OFF
 * product (`nutrition_data_per:"serving"`, `serving_quantity: 30`) whose
 * `*_100g` micro fields actually hold the per-30g values. Reconciled +
 * factor-scaled micros MUST equal raw × (100 / 30) — i.e. true per-100g.
 *
 * This pins the END-TO-END call-site composition the search / barcode
 * mappers run: `const recon = reconcileOffPer100g(n, p)` →
 * `parseOffMicrosPer100g(n, recon.per100gFactor)`.
 */
describe("ENG-738 — serving-basis micros reconcile to true per-100g (fixture gate)", () => {
  // A 30 g serving snack. `*_100g` fields hold the per-30g values:
  //   calcium  0.030 g / 30 g  →  100 mg per 30 g  → 333 mg per 100 g
  //   iron     0.0021 g / 30 g →  2.1 mg per 30 g  → 7   mg per 100 g
  //   vit C    0.018 g / 30 g  →  18 mg per 30 g   → 60  mg per 100 g
  //   sodium   0.150 g / 30 g  →  150 mg per 30 g  → 500 mg per 100 g
  //   sugars   6 g / 30 g                          → 20  g per 100 g
  //   fiber    2 g / 30 g                          → 6.7 g per 100 g
  const SCALE = 100 / 30;
  const product = { nutrition_data_per: "serving", serving_quantity: 30 } as const;
  const nutriments = {
    // Macros (per-30g in disguise) — reconcileOne corrects these from *_serving.
    "energy-kcal_100g": 150,
    "energy-kcal_serving": 150,
    proteins_100g: 4.5,
    proteins_serving: 4.5,
    carbohydrates_100g: 24,
    carbohydrates_serving: 24,
    fat_100g: 3,
    fat_serving: 3,
    // Micros + fiber/sugar/sodium (per-30g in disguise, no *_serving twin).
    calcium_100g: 0.03,
    iron_100g: 0.0021,
    "vitamin-c_100g": 0.018,
    sodium_100g: 0.15,
    sugars_100g: 6,
    fiber_100g: 2,
  };

  it("reconcile flags the row corrected and derives factor = 100/30", () => {
    const recon = reconcileOffPer100g(nutriments, product);
    expect(recon.corrected).toBe(true);
    expect(recon.servingBasis).toBe(true);
    expect(recon.per100gFactor).toBeCloseTo(SCALE, 4); // 3.333…
  });

  it("micros equal raw × (100/30) — true per-100g", () => {
    const recon = reconcileOffPer100g(nutriments, product);
    const micros = parseOffMicrosPer100g(nutriments, recon.per100gFactor);
    // calcium: 0.03 g * (100/30) * 1000 = 100 mg → wait: 0.03*3.333*1000 = 100
    expect(micros.calciumMg).toBe(100);
    expect(micros.ironMg).toBeCloseTo(7, 1); // 0.0021 * 3.333 * 1000
    expect(micros.vitaminCMg).toBeCloseTo(60, 1); // 0.018 * 3.333 * 1000
    expect(micros.sodiumMg).toBe(500); // 0.15 * 3.333 * 1000
    expect(micros.sugarG).toBeCloseTo(20, 1); // 6 * 3.333
    expect(micros.fiberG).toBeCloseTo(6.7, 1); // 2 * 3.333
  });

  it("a per-100g-basis twin of the same product leaves micros unchanged (factor 1)", () => {
    // Identical nutriment magnitudes but declared per-100g and bases agree →
    // factor 1, micros read straight through.
    const per100Product = { nutrition_data_per: "100g", serving_quantity: 30 } as const;
    const per100Nutriments = {
      "energy-kcal_100g": 150,
      "energy-kcal_serving": 45, // 150 * (30/100) — agrees with per-100g basis
      proteins_100g: 4.5,
      proteins_serving: 1.35,
      carbohydrates_100g: 24,
      carbohydrates_serving: 7.2,
      fat_100g: 3,
      fat_serving: 0.9,
      calcium_100g: 0.03,
      iron_100g: 0.0021,
      "vitamin-c_100g": 0.018,
      sodium_100g: 0.15,
      sugars_100g: 6,
      fiber_100g: 2,
    };
    const recon = reconcileOffPer100g(per100Nutriments, per100Product);
    expect(recon.corrected).toBe(false);
    expect(recon.per100gFactor).toBe(1);
    const micros = parseOffMicrosPer100g(per100Nutriments, recon.per100gFactor);
    // Unchanged from raw: calcium 0.03 g → 30 mg, sodium 0.15 g → 150 mg.
    expect(micros.calciumMg).toBe(30);
    expect(micros.sodiumMg).toBe(150);
    expect(micros.sugarG).toBe(6);
    expect(micros.fiberG).toBe(2);
  });
});
