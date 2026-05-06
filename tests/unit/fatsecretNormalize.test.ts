/**
 * FatSecret normaliser pins — focuses on the per-100g micronutrient
 * extractor introduced 2026-05-06 to close the meal-detail
 * "Vitamins, minerals & more" gap for FatSecret-sourced logs.
 *
 * Scope:
 *   - Premier-tier wider panel (saturated/poly/mono/trans fat,
 *     cholesterol, calcium, iron, potassium) is scaled to per-100g
 *     using the picked serving's gram weight.
 *   - Basic-tier responses (which omit the wider panel) yield only
 *     fiber/sugar/sodium when present.
 *   - Per-100g basis — caller will scale by `grams / 100` at log
 *     time via `scaleMicrosForGrams`.
 *   - Vitamins (A/C/D) are intentionally NOT emitted. FatSecret
 *     returns these in inconsistent units across response shapes;
 *     emitting blindly would risk mcg-vs-IU drift.
 *   - Zero / missing / non-finite values are dropped (no
 *     fabrication).
 */
import { describe, it, expect } from "vitest";
import type { FatSecretServing } from "@/lib/fatsecret/client";
import { fatSecretServingMicrosPer100g } from "@/lib/nutrition/fatsecretNormalize";

describe("fatSecretServingMicrosPer100g", () => {
  it("scales a 240g Big-Mac-style Premier serving to per-100g", () => {
    // Per-serving values for a 240 g sandwich → factor = 100/240 ≈ 0.4167.
    const serving: FatSecretServing = {
      serving_description: "1 sandwich (240g)",
      metric_serving_amount: "240",
      metric_serving_unit: "g",
      saturated_fat: "11.0", // 11 g sat fat per 240 g → 4.6 g/100g
      monounsaturated_fat: "10.4", // → 4.3 g/100g
      polyunsaturated_fat: "1.6", // → 0.7 g/100g
      trans_fat: "1.0", // → 0.4 g/100g
      cholesterol: "82", // 82 mg per 240 g → 34 mg/100g
      sodium: "950", // 950 mg → 396 mg/100g
      potassium: "397", // → 165 mg/100g
      calcium: "256", // → 107 mg/100g
      iron: "5.2", // → 2.2 mg/100g
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
    expect(micros.calciumMg).toBeCloseTo(107, 0);
    expect(micros.ironMg).toBeCloseTo(2.2, 1);
    expect(micros.fiberG).toBeCloseTo(1.3, 1);
    expect(micros.sugarG).toBeCloseTo(3.8, 1);
  });

  it("returns an empty map when gram weight is non-positive", () => {
    const serving: FatSecretServing = {
      cholesterol: "10",
      saturated_fat: "1",
    };
    expect(fatSecretServingMicrosPer100g(serving, 0)).toEqual({});
    expect(fatSecretServingMicrosPer100g(serving, -10)).toEqual({});
  });

  it("emits only fiber/sugar/sodium on a Basic-tier response (no Premier fields)", () => {
    // Basic tier ships only fiber/sugar/sodium; the wider panel is
    // absent. The extractor must not invent — only emit what exists.
    const serving: FatSecretServing = {
      serving_description: "1 cup (250g)",
      metric_serving_amount: "250",
      metric_serving_unit: "g",
      fiber: "5",
      sugar: "12",
      sodium: "300",
    };
    const micros = fatSecretServingMicrosPer100g(serving, 250);
    expect(micros).toEqual({
      fiberG: 2,
      sugarG: 4.8,
      sodiumMg: 120,
    });
  });

  it("never emits vitamins (A/C/D) even when FatSecret ships them — unit ambiguity", () => {
    const serving: FatSecretServing = {
      metric_serving_amount: "100",
      metric_serving_unit: "g",
      vitamin_a: "200", // could be mcg, IU, or %DV — we never know
      vitamin_c: "30",
      vitamin_d: "5",
    };
    const micros = fatSecretServingMicrosPer100g(serving, 100);
    expect(micros.vitaminAMcgRae).toBeUndefined();
    expect(micros.vitaminCMg).toBeUndefined();
    expect(micros.vitaminDMcg).toBeUndefined();
  });

  it("drops zero / missing / NaN values", () => {
    const serving: FatSecretServing = {
      metric_serving_amount: "100",
      metric_serving_unit: "g",
      cholesterol: "0",
      iron: "",
      saturated_fat: "0",
    };
    const micros = fatSecretServingMicrosPer100g(serving, 100);
    expect(micros.cholesterolMg).toBeUndefined();
    expect(micros.ironMg).toBeUndefined();
    expect(micros.saturatedFatG).toBeUndefined();
  });
});
