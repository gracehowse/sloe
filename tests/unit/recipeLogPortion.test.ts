import { describe, expect, it } from "vitest";

import {
  recipeLogMicrosMultiplier,
  recipePortionSelectionFromPickerState,
  recipeSupportsStructuredPortionLog,
  scaleRecipeLogMacros,
} from "@/lib/recipes/recipeLogPortion";

const perServing = {
  calories: 200,
  protein: 10,
  carbs: 20,
  fat: 8,
  fiberG: 2,
};

describe("recipeLogPortion", () => {
  it("detects structured portion logging capability", () => {
    expect(recipeSupportsStructuredPortionLog({ kind: "servings", count: 4 })).toBe(false);
    expect(recipeSupportsStructuredPortionLog({ kind: "weight", totalGrams: 400 })).toBe(true);
    expect(
      recipeSupportsStructuredPortionLog({
        kind: "units",
        count: 12,
        singular: "slice",
        plural: "slices",
      }),
    ).toBe(true);
  });

  it("maps picker state to recipe portion selections", () => {
    expect(
      recipePortionSelectionFromPickerState({
        amount: 50,
        unit: { kind: "gram" },
      }),
    ).toEqual({ mode: "grams", grams: 50 });
    expect(
      recipePortionSelectionFromPickerState({
        amount: 2,
        unit: { kind: "count", singular: "slice", plural: "slices", gramsPerUnit: 50 },
      }),
    ).toEqual({ mode: "units", units: 2 });
  });

  it("scales macros and micros multiplier for gram portions", () => {
    const yieldDef = { kind: "weight" as const, totalGrams: 400 };
    const portion = { mode: "grams" as const, grams: 100 };
    expect(scaleRecipeLogMacros(perServing, 4, yieldDef, portion)).toEqual({
      calories: 200,
      protein: 10,
      carbs: 20,
      fat: 8,
      fiberG: 2,
    });
    expect(recipeLogMicrosMultiplier(perServing, 4, yieldDef, portion)).toBe(1);
  });
});
