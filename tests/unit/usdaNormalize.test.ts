/**
 * Tests for USDA FDC data normalization.
 * Wrong nutrient ID matching = wrong macros for all USDA-sourced ingredients.
 */
import { describe, it, expect } from "vitest";
import { fdcFoodMacrosPer100g } from "@/lib/nutrition/usdaNormalize";
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
});
