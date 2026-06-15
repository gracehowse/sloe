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
  extractOffMacrosPerServing,
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

  it("ENG-774: a declared serving-basis row WITHOUT serving_quantity is flagged (no mass to verify)", () => {
    // The blind spot: `nutrition_data_per:"serving"` but no `serving_quantity`,
    // so there is no mass to reconstruct/verify. The `*_100g` field may secretly
    // hold per-serving values; we can't correct it, so we FLAG the row
    // (corrected:true → soft-warn + demoted confidence) instead of silently
    // trusting it. Value is left as published; no scaling is applied.
    const nutriments = {
      "energy-kcal_100g": 480, // possibly per-serving in disguise — unverifiable
      "energy-kcal_serving": 480,
      proteins_100g: 5,
      proteins_serving: 5,
      carbohydrates_100g: 68,
      carbohydrates_serving: 68,
      fat_100g: 22,
      fat_serving: 22,
    };
    const recon = reconcileOffPer100g(nutriments, { nutrition_data_per: "serving" }); // no serving_quantity
    expect(recon.servingBasis).toBe(true);
    expect(recon.servingNoMass).toBe(true);
    expect(recon.corrected).toBe(true); // was silently false before ENG-774
    expect(recon.calories).toBe(480); // unchanged — nothing better to use
    expect(recon.per100gFactor).toBe(1); // no scaling on an unverifiable row
  });

  it("ENG-774: serving-basis without mass still flags when only `*_100g` are present", () => {
    const recon = reconcileOffPer100g(
      { "energy-kcal_100g": 300, proteins_100g: 9 },
      { nutrition_data_per: "serving" },
    );
    expect(recon.servingBasis).toBe(true);
    expect(recon.corrected).toBe(true);
    expect(recon.calories).toBe(300);
  });

  it("ENG-774: a per-100g-basis row without serving_quantity is NOT flagged (no false positive)", () => {
    // Same missing-mass shape, but declared per-100g → no basis ambiguity, so it
    // must stay unflagged. Guards against the new flag over-firing.
    const recon = reconcileOffPer100g(
      { "energy-kcal_100g": 250, proteins_100g: 8 },
      { nutrition_data_per: "100g" },
    );
    expect(recon.servingBasis).toBe(false);
    expect(recon.corrected).toBe(false);
    expect(recon.calories).toBe(250);
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

describe("reconcileOffPer100g — per100gFactor (ENG-738 micro/fiber/sugar/sodium scale)", () => {
  it("corrected serving-basis row: factor = recon.calories / rawEnergyKcal100g (= 100/serving)", () => {
    // 500 g pot whose `*_100g` hold per-pot values; energy present.
    const nutriments = {
      "energy-kcal_100g": 1325,
      "energy-kcal_serving": 1325,
      proteins_100g: 265,
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
    expect(recon.corrected).toBe(true);
    // recon.calories ≈ 265; raw energy 1325 → factor ≈ 0.2 = 100/500.
    expect(recon.per100gFactor).toBeCloseTo(recon.calories / 1325, 5);
    expect(recon.per100gFactor).toBeCloseTo(0.2, 3); // 100 / 500
  });

  it("corrected serving-basis row with energy ABSENT: factor falls back to 100 / serving_quantity", () => {
    // No energy field at all; protein carries the disagreement.
    const nutriments = {
      proteins_100g: 75, // per-pot
      proteins_serving: 75,
      carbohydrates_100g: 30,
      carbohydrates_serving: 30,
      fat_100g: 6,
      fat_serving: 6,
    };
    const recon = reconcileOffPer100g(nutriments, {
      nutrition_data_per: "serving",
      serving_quantity: 250,
    });
    expect(recon.corrected).toBe(true);
    expect(recon.per100gFactor).toBeCloseTo(100 / 250, 5); // 0.4
  });

  it("genuine per-100g row: factor = 1 (no-op)", () => {
    const nutriments = {
      "energy-kcal_100g": 60,
      "energy-kcal_serving": 102,
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
    expect(recon.corrected).toBe(false);
    expect(recon.per100gFactor).toBe(1);
  });

  it("no per-serving fields / no serving_quantity: factor = 1 (no-op)", () => {
    const recon = reconcileOffPer100g(
      { "energy-kcal_100g": 250, proteins_100g: 8, carbohydrates_100g: 30, fat_100g: 10 },
      {},
    );
    expect(recon.per100gFactor).toBe(1);
  });

  it("never returns a degenerate factor (NaN / ≤0)", () => {
    // serving_quantity 0 is rejected by servingQuantityGrams → not serving
    // basis → factor 1, never a divide-by-zero.
    const recon = reconcileOffPer100g(
      { "energy-kcal_100g": 100, "energy-kcal_serving": 100 },
      { nutrition_data_per: "serving", serving_quantity: 0 },
    );
    expect(Number.isFinite(recon.per100gFactor)).toBe(true);
    expect(recon.per100gFactor).toBeGreaterThan(0);
  });

  it("ENG-774 — extractOffMacrosPerServing reads per-serving fields", () => {
    const macros = extractOffMacrosPerServing({
      "energy-kcal_serving": 480,
      proteins_serving: 5,
      carbohydrates_serving: 68,
      fat_serving: 22,
    });
    expect(macros).toEqual({ calories: 480, protein: 5, carbs: 68, fat: 22 });
  });
});
