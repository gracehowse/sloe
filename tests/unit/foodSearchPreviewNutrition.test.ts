import { describe, expect, it } from "vitest";
import {
  foodSearchPreviewExtraMicroRows,
  scaledPreviewMicros,
  type FoodSearchPreviewNutritionInput,
} from "@/lib/nutrition/foodSearchPreviewNutrition";

const BASE: FoodSearchPreviewNutritionInput = {
  scaledMacros: {
    calories: 200,
    protein: 10,
    carbs: 20,
    fat: 8,
    fiberG: 3,
    sugarG: 5,
    sodiumMg: 400,
  },
  hasMacrosPerServing: false,
  chosenPortion: { gramWeight: 100 },
  quantity: 1,
};

describe("foodSearchPreviewNutrition — ENG-1062 / F-161 F-162", () => {
  it("scales OFF-style per-100g micros by portion grams", () => {
    const scaled = scaledPreviewMicros({
      ...BASE,
      microsPer100g: { saturatedFatG: 2, potassiumMg: 300, cholesterolMg: 50 },
    });
    expect(scaled.saturatedFatG).toBe(2);
    expect(scaled.potassiumMg).toBe(300);
    expect(scaled.cholesterolMg).toBe(50);
  });

  it("scales FatSecret per-serving micros by quantity × servingFraction", () => {
    const scaled = scaledPreviewMicros({
      ...BASE,
      hasMacrosPerServing: true,
      chosenPortion: { gramWeight: 0, servingFraction: 0.5 },
      quantity: 2,
      microsPerServing: { saturatedFatG: 4, potassiumMg: 200 },
    });
    expect(scaled.saturatedFatG).toBe(4);
    expect(scaled.potassiumMg).toBe(200);
  });

  it("surfaces vendor micro rows beyond fibre/sugar/sodium", () => {
    const rows = foodSearchPreviewExtraMicroRows({
      ...BASE,
      microsPer100g: {
        fiberG: 3,
        sugarG: 5,
        sodiumMg: 400,
        saturatedFatG: 1.5,
        potassiumMg: 250,
      },
    });
    expect(rows.map((r) => r.key)).toEqual(["saturatedFatG", "potassiumMg"]);
    expect(rows[0]?.label).toBe("Sat. fat");
  });

  it("returns no extra rows when vendor published macros only", () => {
    const rows = foodSearchPreviewExtraMicroRows({
      ...BASE,
      microsPer100g: { fiberG: 3, sugarG: 5, sodiumMg: 400 },
    });
    expect(rows).toEqual([]);
  });
});
