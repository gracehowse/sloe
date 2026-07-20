/**
 * Tests for USDA FDC data normalization.
 * Wrong nutrient ID matching = wrong macros for all USDA-sourced ingredients.
 */
import { describe, it, expect } from "vitest";
import { fdcFoodMacrosPer100g, fdcFoodMicrosPer100g } from "@/lib/nutrition/usdaNormalize";
import type { FdcFood, FdcNutrient } from "@/lib/usda/fdcClient";

function makeFdcFood(nutrients: Partial<FdcNutrient>[]): FdcFood {
  return {
    fdcId: 12345,
    description: "Test Food",
    foodNutrients: nutrients as FdcNutrient[],
  };
}

describe("fdcFoodMacrosPer100g", () => {
  it("extracts basic macros from nutrient names", () => {
    const food = makeFdcFood([
      { nutrientName: "Energy", unitName: "kcal", amount: 165 },
      { nutrientName: "Protein", amount: 31 },
      { nutrientName: "Total lipid (fat)", amount: 3.6 },
      { nutrientName: "Carbohydrate, by difference", amount: 0 },
      { nutrientName: "Fiber, total dietary", amount: 0 },
    ]);
    const macros = fdcFoodMacrosPer100g(food);
    expect(macros.calories).toBe(165);
    expect(macros.protein).toBe(31);
    expect(macros.fat).toBe(3.6);
    expect(macros.carbs).toBe(0);
    expect(macros.fiberG).toBe(0);
  });

  it("skips amount-less USDA hierarchy rows before measured carbohydrate values", () => {
    const food = makeFdcFood([
      { nutrient: { name: "Carbohydrates", unitName: "g" } },
      {
        nutrient: { name: "Carbohydrate, by difference", unitName: "g" },
        amount: 77.43,
      },
    ]);

    expect(fdcFoodMacrosPer100g(food).carbs).toBe(77.43);
  });

  it("derives calories from a measured Foundation total-fat panel when Energy is absent", () => {
    const food = makeFdcFood([
      { nutrient: { name: "Total fat (NLEA)", unitName: "g" }, amount: 94.5 },
    ]);

    const macros = fdcFoodMacrosPer100g(food);
    expect(macros.fat).toBe(94.5);
    expect(macros.calories).toBeCloseTo(850.5, 1);
  });

  it("handles kJ energy (converts to kcal)", () => {
    const food = makeFdcFood([
      { nutrientName: "Energy", unitName: "kJ", amount: 690 },
    ]);
    const macros = fdcFoodMacrosPer100g(food);
    // 690 kJ ÷ 4.184 ≈ 165 kcal
    expect(macros.calories).toBeCloseTo(165, 0);
  });

  it("extracts fiber", () => {
    const food = makeFdcFood([
      { nutrientName: "Energy", unitName: "kcal", amount: 100 },
      { nutrientName: "Fiber, total dietary", amount: 7.9 },
    ]);
    const macros = fdcFoodMacrosPer100g(food);
    expect(macros.fiberG).toBe(7.9);
  });

  it("handles empty nutrients gracefully", () => {
    const food = makeFdcFood([]);
    const macros = fdcFoodMacrosPer100g(food);
    expect(macros.calories).toBe(0);
    expect(macros.protein).toBe(0);
    expect(macros.carbs).toBe(0);
    expect(macros.fat).toBe(0);
    expect(macros.fiberG).toBe(0);
  });

  it("extracts sugar and sodium", () => {
    const food = makeFdcFood([
      { nutrientName: "Sugars, Total", amount: 5.2 },
      { nutrientName: "Sodium, Na", amount: 0.054 },
    ]);
    const macros = fdcFoodMacrosPer100g(food);
    expect(macros.sugarG).toBeGreaterThan(0);
    expect(macros.sodiumMg).toBeGreaterThan(0);
  });

  // Audit 2026-05-05 K2 (Grace): wine + coffee logged via the food
  // search produced no caffeine / alcohol bump because the USDA
  // normalizer dropped these nutrients on the floor. Pin the
  // extraction so a future refactor can't re-introduce the bug.
  it("extracts caffeine (mg per 100g) — espresso parity", () => {
    const food = makeFdcFood([
      { nutrientName: "Energy", unitName: "kcal", amount: 9 },
      { nutrientName: "Caffeine", unitName: "mg", amount: 212 },
    ]);
    const macros = fdcFoodMacrosPer100g(food);
    expect(macros.caffeineMgPer100g).toBe(212);
    expect(macros.alcoholGPer100g).toBeNull();
  });

  it("extracts alcohol (g per 100g) — white wine parity", () => {
    const food = makeFdcFood([
      { nutrientName: "Energy", unitName: "kcal", amount: 82 },
      { nutrientName: "Alcohol, ethyl", unitName: "g", amount: 10.3 },
    ]);
    const macros = fdcFoodMacrosPer100g(food);
    expect(macros.alcoholGPer100g).toBeCloseTo(10.3, 1);
    expect(macros.caffeineMgPer100g).toBeNull();
  });

  it("returns null for missing or zero caffeine/alcohol (no fabrication)", () => {
    const food = makeFdcFood([
      { nutrientName: "Energy", unitName: "kcal", amount: 100 },
      { nutrientName: "Caffeine", unitName: "mg", amount: 0 },
      // No "Alcohol, ethyl" entry at all.
    ]);
    const macros = fdcFoodMacrosPer100g(food);
    // Zero treated as null — USDA returns 0 for "not measured" on
    // some rows; we'd rather null than fabricate "0 caffeine in your
    // espresso".
    expect(macros.caffeineMgPer100g).toBeNull();
    expect(macros.alcoholGPer100g).toBeNull();
  });
});

describe("fdcFoodMicrosPer100g", () => {
  // 2026-05-06 — TestFlight feedback: "USDA FoodData Central did not
  // publish vitamin or mineral data for this product." for every
  // USDA-sourced log. Diagnosis: the route only extracted macros and
  // discarded micros. These pins lock the per-100g micro extraction
  // by USDA nutrient *number* (stable across data types) so a future
  // refactor can't silently regress the meal-detail panel back to
  // empty.
  function makeFood(rows: Array<{ number?: string; name?: string; unit?: string; amount: number }>): FdcFood {
    return {
      fdcId: 12345,
      description: "Test Food",
      foodNutrients: rows.map((r) => ({
        nutrient: { number: r.number, name: r.name ?? "", unitName: r.unit ?? "g" },
        amount: r.amount,
      })) as FdcNutrient[],
    };
  }

  it("extracts the Big-3 mineral panel (calcium, iron, potassium)", () => {
    const micros = fdcFoodMicrosPer100g(
      makeFood([
        { number: "301", name: "Calcium, Ca", unit: "mg", amount: 113 },
        { number: "303", name: "Iron, Fe", unit: "mg", amount: 1.6 },
        { number: "306", name: "Potassium, K", unit: "mg", amount: 286 },
      ]),
    );
    expect(micros.calciumMg).toBe(113);
    expect(micros.ironMg).toBe(1.6);
    expect(micros.potassiumMg).toBe(286);
  });

  it("extracts fat breakdown (sat / mono / poly / trans) in grams", () => {
    const micros = fdcFoodMicrosPer100g(
      makeFood([
        { number: "606", name: "Fatty acids, total saturated", unit: "g", amount: 4.6 },
        { number: "645", name: "Fatty acids, total monounsaturated", unit: "g", amount: 2.1 },
        { number: "646", name: "Fatty acids, total polyunsaturated", unit: "g", amount: 0.8 },
        { number: "605", name: "Fatty acids, total trans", unit: "g", amount: 0.2 },
      ]),
    );
    expect(micros.saturatedFatG).toBe(4.6);
    expect(micros.monoFatG).toBe(2.1);
    expect(micros.polyFatG).toBe(0.8);
    expect(micros.transFatG).toBe(0.2);
  });

  it("extracts cholesterol (mg per 100g)", () => {
    const micros = fdcFoodMicrosPer100g(
      makeFood([{ number: "601", name: "Cholesterol", unit: "mg", amount: 87 }]),
    );
    expect(micros.cholesterolMg).toBe(87);
  });

  it("extracts vitamins with unit conversion (B6 in mg, vitamin C in mg, vitamin A in mcg RAE)", () => {
    const micros = fdcFoodMicrosPer100g(
      makeFood([
        { number: "415", name: "Vitamin B-6", unit: "mg", amount: 0.42 },
        { number: "401", name: "Vitamin C, total ascorbic acid", unit: "mg", amount: 53.2 },
        { number: "320", name: "Vitamin A, RAE", unit: "µg", amount: 28 },
      ]),
    );
    expect(micros.vitaminB6Mg).toBe(0.42);
    expect(micros.vitaminCMg).toBe(53.2);
    expect(micros.vitaminAMcgRae).toBe(28);
  });

  it("prefers Folate, DFE (id 435) over raw Folate, total (id 417)", () => {
    const micros = fdcFoodMicrosPer100g(
      makeFood([
        { number: "417", name: "Folate, total", unit: "µg", amount: 60 },
        { number: "435", name: "Folate, DFE", unit: "µg", amount: 102 },
      ]),
    );
    // DFE wins so dietary-folate-equivalent labelling is consistent
    // with the daily-value reference used elsewhere in the app.
    expect(micros.folateMcg).toBe(102);
  });

  it("falls back to Folate, total when DFE not present", () => {
    const micros = fdcFoodMicrosPer100g(
      makeFood([{ number: "417", name: "Folate, total", unit: "µg", amount: 60 }]),
    );
    expect(micros.folateMcg).toBe(60);
  });

  it("drops zero / missing / non-finite values (never fabricated)", () => {
    const micros = fdcFoodMicrosPer100g(
      makeFood([
        { number: "301", name: "Calcium, Ca", unit: "mg", amount: 0 },
        { number: "303", name: "Iron, Fe", unit: "mg", amount: Number.NaN },
      ]),
    );
    expect(micros.calciumMg).toBeUndefined();
    expect(micros.ironMg).toBeUndefined();
  });

  it("handles unit normalisation (µg → mg, g → mg) for minerals", () => {
    const micros = fdcFoodMicrosPer100g(
      makeFood([
        // Magnesium reported in g (rare but valid) — should normalise
        // to mg (·1000).
        { number: "304", name: "Magnesium, Mg", unit: "g", amount: 0.045 },
      ]),
    );
    expect(micros.magnesiumMg).toBe(45);
  });

  it("returns an empty record when no curated nutrients are present", () => {
    const micros = fdcFoodMicrosPer100g(makeFood([]));
    expect(Object.keys(micros)).toHaveLength(0);
  });
});
