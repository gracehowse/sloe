/**
 * FatSecret normaliser pins — the per-100g + absolute micronutrient
 * extractors that close the meal-detail "Vitamins, minerals & more" gap
 * for FatSecret-sourced logs.
 *
 * Scope:
 *   - Premier-tier wider panel (saturated/poly/mono/trans fat,
 *     cholesterol, potassium) is scaled to per-100g using the picked
 *     serving's gram weight; emitted in absolute units (mg/g).
 *   - Calcium / iron / vitamins A/C/D arrive as %DV (FatSecret's %RDI)
 *     and are converted to absolute via the FDA 2016 Daily Values
 *     (calcium 1300mg, iron 18mg, vit A 900µg RAE, vit C 90mg, vit D 20µg).
 *     Verified live 2026-05-26 across cheddar/orange/spinach/Big Mac/
 *     Total cereal/fortified rice — see
 *     docs/decisions/2026-05-26-fatsecret-percent-dv-micros.md.
 *   - Zero / missing / non-finite values are dropped (no fabrication).
 */
import { describe, it, expect } from "vitest";
import type { FatSecretServing } from "@/lib/fatsecret/client";
import {
  fatSecretMicroFieldToAbsolute,
  fatSecretServingMicrosAbsolute,
  fatSecretServingMicrosPer100g,
  inferFatSecretMicroUnitMode,
} from "@/lib/nutrition/fatsecretNormalize";

describe("fatSecretServingMicrosPer100g", () => {
  it("scales a 240g Premier serving to per-100g, converting %DV micros to absolute", () => {
    // Per-serving values for a 240 g sandwich → factor = 100/240 ≈ 0.4167.
    const serving: FatSecretServing = {
      serving_description: "1 sandwich (240g)",
      metric_serving_amount: "240",
      metric_serving_unit: "g",
      saturated_fat: "11.0", // → 4.6 g/100g
      monounsaturated_fat: "10.4", // → 4.3 g/100g
      polyunsaturated_fat: "1.6", // → 0.7 g/100g
      trans_fat: "1.0", // → 0.4 g/100g
      cholesterol: "82", // → 34 mg/100g
      sodium: "950", // → 396 mg/100g
      potassium: "397", // → 165 mg/100g
      calcium: "20", // 20%DV → 260 mg/serving → 108 mg/100g
      iron: "25", // 25%DV → 4.5 mg/serving → 1.9 mg/100g
      fiber: "3.0", // → 1.3 g/100g
      sugar: "9.0", // → 3.8 g/100g
    };
    const micros = fatSecretServingMicrosPer100g(serving, 240);
    expect(micros.saturatedFatG).toBeCloseTo(4.6, 1);
    expect(micros.monoFatG).toBeCloseTo(4.3, 1);
    expect(micros.polyFatG).toBeCloseTo(0.7, 1);
    expect(micros.transFatG).toBeCloseTo(0.4, 1);
    expect(micros.cholesterolMg).toBeCloseTo(34, 0);
    expect(micros.sodiumMg).toBeCloseTo(396, 0);
    expect(micros.potassiumMg).toBeCloseTo(165, 0);
    expect(micros.fiberG).toBeCloseTo(1.3, 1);
    expect(micros.sugarG).toBeCloseTo(3.8, 1);
    // %DV → absolute, then scaled to per-100g:
    expect(micros.calciumMg).toBeCloseTo(108, 0);
    expect(micros.ironMg).toBeCloseTo(1.9, 1);
  });

  it("converts %DV calcium/iron/vitamins to absolute (cheddar @ 100g, factor=1)", () => {
    // Verified live: cheddar Ca 55%→715mg, Fe ~4%→0.7mg, vit A 29%→261µg.
    const serving: FatSecretServing = {
      serving_description: "100 g",
      metric_serving_amount: "100",
      metric_serving_unit: "g",
      calcium: "55", // 55%DV × 1300mg = 715mg
      iron: "4", // 4%DV × 18mg = 0.72mg
      vitamin_a: "29", // 29%DV × 900µg = 261µg RAE
      vitamin_c: "0",
    };
    const micros = fatSecretServingMicrosPer100g(serving, 100);
    expect(micros.calciumMg).toBeCloseTo(715, 0);
    expect(micros.ironMg).toBeCloseTo(0.7, 1);
    expect(micros.vitaminAMcgRae).toBeCloseTo(261, 0);
    expect(micros.vitaminCMg).toBeUndefined(); // 0 dropped
  });

  it("emits vitamins A/C/D from %DV (spinach-style)", () => {
    // Verified live: spinach Fe 15%→2.7mg, vit A 52%→468µg, vit C 31%→27.9mg.
    const serving: FatSecretServing = {
      metric_serving_amount: "100",
      metric_serving_unit: "g",
      iron: "15",
      vitamin_a: "52",
      vitamin_c: "31",
    };
    const micros = fatSecretServingMicrosPer100g(serving, 100);
    expect(micros.ironMg).toBeCloseTo(2.7, 1);
    expect(micros.vitaminAMcgRae).toBeCloseTo(468, 0);
    expect(micros.vitaminCMg).toBeCloseTo(27.9, 1);
  });

  it("returns an empty map when gram weight is non-positive", () => {
    const serving: FatSecretServing = { cholesterol: "10", saturated_fat: "1" };
    expect(fatSecretServingMicrosPer100g(serving, 0)).toEqual({});
    expect(fatSecretServingMicrosPer100g(serving, -10)).toEqual({});
  });

  it("emits only fiber/sugar/sodium on a Basic-tier response (no Premier fields)", () => {
    const serving: FatSecretServing = {
      serving_description: "1 cup (250g)",
      metric_serving_amount: "250",
      metric_serving_unit: "g",
      fiber: "5",
      sugar: "12",
      sodium: "300",
    };
    expect(fatSecretServingMicrosPer100g(serving, 250)).toEqual({
      fiberG: 2,
      sugarG: 4.8,
      sodiumMg: 120,
    });
  });

  it("drops zero / missing / NaN values", () => {
    const serving: FatSecretServing = {
      metric_serving_amount: "100",
      metric_serving_unit: "g",
      cholesterol: "0",
      iron: "",
      calcium: "0",
      saturated_fat: "0",
    };
    const micros = fatSecretServingMicrosPer100g(serving, 100);
    expect(micros.cholesterolMg).toBeUndefined();
    expect(micros.ironMg).toBeUndefined();
    expect(micros.calciumMg).toBeUndefined();
    expect(micros.saturatedFatG).toBeUndefined();
  });
});

describe("fatSecretServingMicrosAbsolute", () => {
  it("returns absolute (per-serving) values without scaling, %DV converted", () => {
    // Big-Mac-style no-metric serving: Ca 9%→117mg, Fe 22%→4mg (verified live).
    const serving: FatSecretServing = {
      serving_description: "1 serving",
      saturated_fat: "11.000",
      trans_fat: "1.000",
      cholesterol: "85",
      sodium: "1060",
      potassium: "370",
      fiber: "3.0",
      sugar: "7.00",
      calcium: "9", // 9%DV × 1300 = 117mg
      iron: "22", // 22%DV × 18 = 3.96mg
      vitamin_c: "8", // 8%DV × 90 = 7.2mg
    };
    const micros = fatSecretServingMicrosAbsolute(serving);
    expect(micros).toEqual({
      saturatedFatG: 11,
      transFatG: 1,
      cholesterolMg: 85,
      sodiumMg: 1060,
      potassiumMg: 370,
      fiberG: 3,
      sugarG: 7,
      calciumMg: 117,
      ironMg: 4,
      vitaminCMg: 7.2,
    });
  });

  it("drops zero / missing values", () => {
    const serving: FatSecretServing = { cholesterol: "0", sodium: "", sugar: "0.0", calcium: "0" };
    expect(fatSecretServingMicrosAbsolute(serving)).toEqual({});
  });
});

describe("ENG-1118 — FatSecret %DV vs absolute unit guard", () => {
  it("infers percentDv for legacy v1 serving fields", () => {
    const serving: FatSecretServing = {
      calcium: "55",
      iron: "4",
      vitamin_a: "29",
    };
    expect(inferFatSecretMicroUnitMode(serving)).toBe("percentDv");
  });

  it("infers absolute when migrated API returns physical mg/µg", () => {
    const serving: FatSecretServing = {
      calcium: "715",
      iron: "0.72",
      vitamin_a: "261",
    };
    expect(inferFatSecretMicroUnitMode(serving)).toBe("absolute");
  });

  it("does not inflate v2 absolute calcium by applying %DV multiplier", () => {
    const serving: FatSecretServing = {
      metric_serving_amount: "100",
      metric_serving_unit: "g",
      calcium: "715",
      iron: "0.7",
      vitamin_a: "261",
    };
    const micros = fatSecretServingMicrosPer100g(serving, 100);
    expect(micros.calciumMg).toBeCloseTo(715, 0);
    expect(micros.ironMg).toBeCloseTo(0.7, 1);
    expect(micros.vitaminAMcgRae).toBeCloseTo(261, 0);
    // Wrong path would be ~9295 mg calcium (715% × 1300).
    expect(micros.calciumMg).toBeLessThan(2000);
  });

  it("fatSecretMicroFieldToAbsolute keeps legacy %DV conversion", () => {
    expect(fatSecretMicroFieldToAbsolute("9", 1300, 1500, "percentDv")).toBeCloseTo(117, 0);
    expect(fatSecretMicroFieldToAbsolute("55", 1300, 1500, "percentDv")).toBeCloseTo(715, 0);
  });

  it("fatSecretMicroFieldToAbsolute passes through plausible absolutes", () => {
    expect(fatSecretMicroFieldToAbsolute("715", 1300, 1500, "absolute")).toBe(715);
    expect(fatSecretMicroFieldToAbsolute("117", 1300, 1500, "absolute")).toBe(117);
  });

  it("drops values that are implausible under either interpretation", () => {
    expect(fatSecretMicroFieldToAbsolute("50000", 1300, 1500, "percentDv")).toBe(0);
    expect(fatSecretMicroFieldToAbsolute("50000", 1300, 1500, "absolute")).toBe(0);
  });
});
