import { describe, expect, it } from "vitest";
import { scaleFromPer100gGrams } from "../../src/lib/openFoodFacts/scaleFromPer100g";
import { totalGramsForVerifyScale } from "../../src/lib/nutrition/totalGramsForVerifyScale";

const per100g = {
  calories: 100,
  protein: 10,
  carbs: 5,
  fat: 2,
  fiberG: 1,
  sugarG: 0,
  sodiumMg: 0,
};

describe("totalGramsForVerifyScale", () => {
  it("treats g rows with no chosenPortion as grams (not ×100)", () => {
    const ing = { unit: "g" as const, chosenPortion: null };
    expect(totalGramsForVerifyScale(ing, 500)).toBe(500);
    const scaled = scaleFromPer100gGrams(per100g, 500);
    expect(scaled.calories).toBe(500);
    expect(scaled.protein).toBe(50);
  });

  it("uses gramWeight × count for label servings", () => {
    const ing = {
      unit: "1 portion (170 g)",
      chosenPortion: { label: "1 portion (170 g)", gramWeight: 170 },
    };
    expect(totalGramsForVerifyScale(ing, 2)).toBe(340);
    const scaled = scaleFromPer100gGrams(per100g, 340);
    expect(scaled.calories).toBe(340);
  });

  it("treats explicit chosenPortion g as raw grams", () => {
    const ing = {
      unit: "g",
      chosenPortion: { label: "g", gramWeight: 1 },
    };
    expect(totalGramsForVerifyScale(ing, 500)).toBe(500);
  });
});
