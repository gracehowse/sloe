/**
 * P0 (2026-05-26) — Open Food Facts per-100g hardening.
 *
 * Root cause of the "Chobani Greek yogurt · 500 g · 1,325 kcal · 265 g
 * protein" failure: an OFF product with `nutrition_data_per:"serving"` (500 g
 * pot) stored its PER-POT (per-serving) values in the `*_100g` fields. The
 * code trusts `energy-kcal_100g` as genuine per-100g, so the legitimate ×5
 * grams-scale turned a per-500g base into ×25.
 *
 * `reconcileOffPer100g` rebuilds the true per-100g from the `*_serving`
 * fields + `serving_quantity` and replaces the mislabeled `*_100g` when the
 * two bases disagree beyond tolerance.
 */
import { describe, expect, it } from "vitest";
import {
  reconcileOffPer100g,
  OFF_BASIS_DISAGREEMENT_TOLERANCE,
} from "@/lib/openFoodFacts/reconcilePer100g";

describe("reconcileOffPer100g — per-serving-basis hardening", () => {
  it("the 500 g per-serving-basis bug row: yields ~265 kcal / ~53 g per 100g, not 1325/265", () => {
    // The poisoned OFF row: `*_100g` fields hold the PER-POT (per-500g)
    // values; `*_serving` hold the same per-pot numbers; serving = 500 g.
    const nutriments = {
      "energy-kcal_100g": 1325, // mislabeled — really per 500 g pot
      "energy-kcal_serving": 1325,
      proteins_100g: 265, // mislabeled
      proteins_serving: 265,
      carbohydrates_100g: 90,
      carbohydrates_serving: 90,
      fat_100g: 0,
      fat_serving: 0,
    };
    const recon = reconcileOffPer100g(nutriments, {
      nutrition_data_per: "serving",
      serving_quantity: 500,
    });
    // Reconstructed per-100g = per-serving / (500/100) = /5.
    expect(recon.calories).toBeCloseTo(265, 0); // 1325 / 5
    expect(recon.protein).toBeCloseTo(53, 0); // 265 / 5
    expect(recon.carbs).toBeCloseTo(18, 0); // 90 / 5
    expect(recon.corrected).toBe(true);
    expect(recon.servingBasis).toBe(true);

    // And the downstream consequence: scaling the CORRECTED per-100g back to
    // 500 g now gives ~1,325 kcal again — but that is the genuine per-pot
    // energy, so logging the WHOLE 500 g pot is correct. The bug only bites
    // when a per-100g value is itself wrong; here a 100 g serving now reads
    // 265 kcal (a believable Greek-yogurt-pot-concentrate), and the search /
    // verify plausibility guard cross-checks scaled-vs-panel so the ×25
    // inflation can no longer surface.
    const per100Calories = recon.calories;
    expect(per100Calories).toBeLessThan(900); // passes the absolute ceiling
  });

  it("leaves a genuine per-100g row untouched (bases agree)", () => {
    // Real Chobani: 60 kcal/100g, 10 g protein/100g; 170 g pot serving.
    const nutriments = {
      "energy-kcal_100g": 60,
      "energy-kcal_serving": 102, // 60 × 1.7
      proteins_100g: 10,
      proteins_serving: 17,
      carbohydrates_100g: 3.6,
      carbohydrates_serving: 6.1,
      fat_100g: 0,
      fat_serving: 0,
    };
    const recon = reconcileOffPer100g(nutriments, {
      nutrition_data_per: "100g",
      serving_quantity: 170,
    });
    expect(recon.calories).toBeCloseTo(60, 0);
    expect(recon.protein).toBeCloseTo(10, 0);
    expect(recon.corrected).toBe(false);
  });

  it("falls back to published when no per-serving fields or serving_quantity", () => {
    const nutriments = {
      "energy-kcal_100g": 250,
      proteins_100g: 8,
      carbohydrates_100g: 30,
      fat_100g: 10,
    };
    const recon = reconcileOffPer100g(nutriments, {});
    expect(recon.calories).toBe(250);
    expect(recon.protein).toBe(8);
    expect(recon.corrected).toBe(false);
    expect(recon.servingBasis).toBe(false);
  });

  it("uses the reconstructed value when the published _100g is missing", () => {
    const nutriments = {
      "energy-kcal_serving": 200,
      proteins_serving: 12,
      carbohydrates_serving: 20,
      fat_serving: 8,
    };
    // serving = 250 g → per-100g = serving / 2.5.
    const recon = reconcileOffPer100g(nutriments, {
      nutrition_data_per: "serving",
      serving_quantity: 250,
    });
    expect(recon.calories).toBeCloseTo(80, 0); // 200 / 2.5
    expect(recon.protein).toBeCloseTo(4.8, 1); // 12 / 2.5
    expect(recon.corrected).toBe(true);
  });

  it("does not correct when bases agree within tolerance", () => {
    // 25% tolerance: 100 vs 120 (20% off) should NOT correct.
    const within = 100 * (1 + OFF_BASIS_DISAGREEMENT_TOLERANCE - 0.05);
    const nutriments = {
      "energy-kcal_100g": 100,
      "energy-kcal_serving": within * 2, // serving = 200 g → recon = within
      proteins_100g: 5,
      proteins_serving: 10,
      carbohydrates_100g: 10,
      carbohydrates_serving: 20,
      fat_100g: 2,
      fat_serving: 4,
    };
    const recon = reconcileOffPer100g(nutriments, {
      nutrition_data_per: "serving",
      serving_quantity: 200,
    });
    expect(recon.calories).toBe(100); // published kept (within tolerance)
    expect(recon.corrected).toBe(false);
  });
});
