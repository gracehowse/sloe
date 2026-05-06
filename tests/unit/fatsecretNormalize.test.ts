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
import {
  fatSecretServingMicrosAbsolute,
  fatSecretServingMicrosPer100g,
} from "@/lib/nutrition/fatsecretNormalize";

describe("fatSecretServingMicrosPer100g", () => {
  it("scales a 240g Big-Mac-style Premier serving to per-100g — unit-safe fields only", () => {
    // Per-serving values for a 240 g sandwich → factor = 100/240 ≈ 0.4167.
    // 2026-05-06: calcium/iron NO LONGER emitted because FatSecret
    // returns these as %DV in some responses (verified on McDonald's
    // Big Mac food.get: calcium="9", iron="22" — only iron makes
    // sense as %DV given the real Big Mac iron content). Treating
    // them as mg fabricates values, so we skip them.
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
      calcium: "256", // SKIPPED — FatSecret unit-ambiguous
      iron: "5.2", // SKIPPED — FatSecret unit-ambiguous
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
    // Pin the unit-safety carve-out:
    expect(micros.calciumMg).toBeUndefined();
    expect(micros.ironMg).toBeUndefined();
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

describe("fatSecretServingMicrosAbsolute", () => {
  // 2026-05-06: per-serving (not per-100g) Premier panel for foods
  // that ship with no metric grounding (e.g. McDonald's Big Mac
  // food.get returns "1 serving" with no `metric_serving_amount`).
  // Same unit-safety filter as the per-100g extractor — no
  // calcium/iron/vitamins.
  it("returns absolute (per-serving) values without scaling", () => {
    const serving: FatSecretServing = {
      serving_description: "1 serving",
      // No metric_serving_amount — per-serving-only path.
      saturated_fat: "11.000",
      trans_fat: "1.000",
      cholesterol: "85",
      sodium: "1060",
      potassium: "370",
      fiber: "3.0",
      sugar: "7.00",
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
    });
  });

  it("never emits calcium / iron / vitamins (unit-ambiguous from FatSecret)", () => {
    const serving: FatSecretServing = {
      serving_description: "1 serving",
      calcium: "9", // %DV in some responses
      iron: "22", // %DV in some responses
      vitamin_a: "10",
      vitamin_c: "8",
      vitamin_d: "15",
    };
    const micros = fatSecretServingMicrosAbsolute(serving);
    expect(micros.calciumMg).toBeUndefined();
    expect(micros.ironMg).toBeUndefined();
    expect(micros.vitaminAMcgRae).toBeUndefined();
    expect(micros.vitaminCMg).toBeUndefined();
    expect(micros.vitaminDMcg).toBeUndefined();
  });

  it("drops zero / missing values", () => {
    const serving: FatSecretServing = {
      cholesterol: "0",
      sodium: "",
      sugar: "0.0",
    };
    expect(fatSecretServingMicrosAbsolute(serving)).toEqual({});
  });
});
