import { describe, it, expect } from "vitest";
import { edamamFoodMacrosPer100g, edamamAnalysisMacros } from "@/lib/edamam/client";

describe("edamamFoodMacrosPer100g", () => {
  it("extracts macros from Edamam food nutrients", () => {
    const food = {
      foodId: "food_test",
      label: "Chicken Breast",
      category: "Generic",
      categoryLabel: "food",
      nutrients: {
        ENERC_KCAL: 165,
        PROCNT: 31,
        FAT: 3.6,
        CHOCDF: 0,
        FIBTG: 0,
        SUGAR: 0,
        NA: 74,
      },
    };

    const macros = edamamFoodMacrosPer100g(food);
    expect(macros.calories).toBe(165);
    expect(macros.protein).toBe(31);
    expect(macros.fat).toBe(3.6);
    expect(macros.carbs).toBe(0);
    expect(macros.fiberG).toBe(0);
    expect(macros.sodiumMg).toBe(74);
  });

  it("defaults to 0 for missing nutrients", () => {
    const food = {
      foodId: "food_empty",
      label: "Water",
      category: "Generic",
      categoryLabel: "food",
      nutrients: {},
    };

    const macros = edamamFoodMacrosPer100g(food);
    expect(macros.calories).toBe(0);
    expect(macros.protein).toBe(0);
    expect(macros.carbs).toBe(0);
    expect(macros.fat).toBe(0);
  });
});

describe("edamamAnalysisMacros", () => {
  it("extracts macros from Nutrition Analysis result", () => {
    const analysis = {
      calories: 450,
      totalWeight: 300,
      ingredients: [],
      totalNutrients: {
        PROCNT: { label: "Protein", quantity: 35.2, unit: "g" },
        FAT: { label: "Fat", quantity: 12.5, unit: "g" },
        CHOCDF: { label: "Carbs", quantity: 40.1, unit: "g" },
        FIBTG: { label: "Fiber", quantity: 5.3, unit: "g" },
        SUGAR: { label: "Sugars", quantity: 8.7, unit: "g" },
        NA: { label: "Sodium", quantity: 650, unit: "mg" },
      },
      totalDaily: {},
    };

    const macros = edamamAnalysisMacros(analysis);
    expect(macros.calories).toBe(450);
    expect(macros.protein).toBe(35.2);
    expect(macros.fat).toBe(12.5);
    expect(macros.carbs).toBe(40.1);
    expect(macros.fiberG).toBe(5.3);
    expect(macros.sugarG).toBe(8.7);
    expect(macros.sodiumMg).toBe(650);
  });

  it("handles missing nutrients gracefully", () => {
    const analysis = {
      calories: 100,
      totalWeight: 100,
      ingredients: [],
      totalNutrients: {},
      totalDaily: {},
    };

    const macros = edamamAnalysisMacros(analysis);
    expect(macros.calories).toBe(100);
    expect(macros.protein).toBe(0);
  });
});
