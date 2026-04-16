import { describe, expect, it } from "vitest";
import { getMacroValue, type MacroMeal } from "../../src/app/components/MacroDetailPanel";

const sampleMeals: MacroMeal[] = [
  { name: "Breakfast", recipeTitle: "Oatmeal", protein: 12, carbs: 40, fat: 5, calories: 300, fiberG: 4 },
  { name: "Lunch", recipeTitle: "Chicken Salad", protein: 35, carbs: 15, fat: 10, calories: 400, fiberG: 3 },
  { name: "Dinner", recipeTitle: "Salmon Bowl", protein: 30, carbs: 50, fat: 18, calories: 520, fiberG: 6 },
];

describe("MacroDetailPanel — getMacroValue", () => {
  it("extracts protein from a meal", () => {
    expect(getMacroValue(sampleMeals[0], "protein")).toBe(12);
  });

  it("extracts carbs from a meal", () => {
    expect(getMacroValue(sampleMeals[1], "carbs")).toBe(15);
  });

  it("extracts fat from a meal", () => {
    expect(getMacroValue(sampleMeals[2], "fat")).toBe(18);
  });

  it("extracts calories from a meal", () => {
    expect(getMacroValue(sampleMeals[0], "calories")).toBe(300);
  });

  it("extracts fiber from fiberG key", () => {
    expect(getMacroValue(sampleMeals[0], "fiber")).toBe(4);
  });

  it("falls back to fiber key when fiberG is missing", () => {
    const meal: MacroMeal = { name: "Snack", recipeTitle: "Apple", fiber: 3 };
    expect(getMacroValue(meal, "fiber")).toBe(3);
  });

  it("returns 0 when macro key is missing", () => {
    const meal: MacroMeal = { name: "Snack", recipeTitle: "Water" };
    expect(getMacroValue(meal, "protein")).toBe(0);
    expect(getMacroValue(meal, "fiber")).toBe(0);
    expect(getMacroValue(meal, "calories")).toBe(0);
  });

  it("coerces string values to numbers", () => {
    const meal: MacroMeal = { name: "Lunch", recipeTitle: "Soup", protein: "22" as unknown as number };
    expect(getMacroValue(meal, "protein")).toBe(22);
  });

  it("returns 0 for non-numeric string values", () => {
    const meal: MacroMeal = { name: "Lunch", recipeTitle: "Soup", protein: "abc" };
    expect(getMacroValue(meal, "protein")).toBe(0);
  });

  it("handles negative values (does not clamp)", () => {
    // The component displays raw values; clamping is a concern of the caller.
    const meal: MacroMeal = { name: "Correction", recipeTitle: "Adjustment", calories: -50 };
    expect(getMacroValue(meal, "calories")).toBe(-50);
  });
});
