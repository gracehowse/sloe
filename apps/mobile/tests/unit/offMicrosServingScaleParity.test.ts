/**
 * ENG-738 (2026-05-26) — Open Food Facts micronutrient SCALE bug (mobile).
 *
 * On OFF rows with `nutrition_data_per:"serving"` the `*_100g` nutriment
 * fields actually hold per-SERVING values. `reconcileOffPer100g` already
 * rebuilds correct per-100g MACROS, but the micros + fiber/sugar/sodium are
 * read straight off the raw `*_100g` fields at every call site, so they were
 * at the wrong scale on serving-basis products.
 *
 * The fix adds `reconcileOffPer100g(...).per100gFactor` and threads it into
 * `parseOffMicrosPer100g(n, factor)` at each mobile OFF mapping
 * (`apps/mobile/lib/verifyRecipe.ts` searchOFF + lookupBarcode).
 *
 * Mobile imports the helpers via the `@suppr/shared/*` alias, which resolves
 * to `../../src/lib/*` (the same shared source the web app uses). This test
 * exercises that resolution path to prove the byte-for-byte-shared logic
 * scales micros to true per-100g on mobile exactly as on web. The web
 * behavioural gate lives in `tests/unit/parseOffMicros.test.ts`; this is its
 * mobile twin.
 */
import { describe, expect, it } from "vitest";
import { reconcileOffPer100g } from "@suppr/shared/openFoodFacts/reconcilePer100g";
import { parseOffMicrosPer100g } from "@suppr/shared/openFoodFacts/parseOffMicros";

describe("ENG-738 mobile — serving-basis micros reconcile to true per-100g", () => {
  // A 30 g serving snack whose `*_100g` micro fields hold the per-30g values.
  const product = { nutrition_data_per: "serving", serving_quantity: 30 } as const;
  const nutriments = {
    "energy-kcal_100g": 150,
    "energy-kcal_serving": 150,
    proteins_100g: 4.5,
    proteins_serving: 4.5,
    carbohydrates_100g: 24,
    carbohydrates_serving: 24,
    fat_100g: 3,
    fat_serving: 3,
    calcium_100g: 0.03, // 30 mg / 30 g → 100 mg / 100 g
    iron_100g: 0.0021, // 2.1 mg / 30 g → 7 mg / 100 g
    "vitamin-c_100g": 0.018, // 18 mg / 30 g → 60 mg / 100 g
    sodium_100g: 0.15, // 150 mg / 30 g → 500 mg / 100 g
    sugars_100g: 6, // 6 g / 30 g → 20 g / 100 g
    fiber_100g: 2, // 2 g / 30 g → 6.7 g / 100 g
  };

  it("derives factor = 100 / 30 and flags the row corrected", () => {
    const recon = reconcileOffPer100g(nutriments, product);
    expect(recon.corrected).toBe(true);
    expect(recon.servingBasis).toBe(true);
    expect(recon.per100gFactor).toBeCloseTo(100 / 30, 4);
  });

  it("micros equal raw × (100/30) — true per-100g (the call-site composition)", () => {
    const recon = reconcileOffPer100g(nutriments, product);
    const micros = parseOffMicrosPer100g(nutriments, recon.per100gFactor);
    expect(micros.calciumMg).toBe(100);
    expect(micros.ironMg).toBeCloseTo(7, 1);
    expect(micros.vitaminCMg).toBeCloseTo(60, 1);
    expect(micros.sodiumMg).toBe(500);
    expect(micros.sugarG).toBeCloseTo(20, 1);
    expect(micros.fiberG).toBeCloseTo(6.7, 1);
  });

  it("a per-100g-basis product leaves micros unchanged (factor 1, no-op)", () => {
    const per100Product = { nutrition_data_per: "100g", serving_quantity: 30 } as const;
    const per100Nutriments = {
      "energy-kcal_100g": 150,
      "energy-kcal_serving": 45, // agrees with the per-100g basis
      proteins_100g: 4.5,
      proteins_serving: 1.35,
      carbohydrates_100g: 24,
      carbohydrates_serving: 7.2,
      fat_100g: 3,
      fat_serving: 0.9,
      calcium_100g: 0.03,
      iron_100g: 0.0021,
      sodium_100g: 0.15,
      sugars_100g: 6,
      fiber_100g: 2,
    };
    const recon = reconcileOffPer100g(per100Nutriments, per100Product);
    expect(recon.corrected).toBe(false);
    expect(recon.per100gFactor).toBe(1);
    const micros = parseOffMicrosPer100g(per100Nutriments, recon.per100gFactor);
    expect(micros.calciumMg).toBe(30); // unchanged
    expect(micros.sodiumMg).toBe(150);
    expect(micros.sugarG).toBe(6);
    expect(micros.fiberG).toBe(2);
  });
});
