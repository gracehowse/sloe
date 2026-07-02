import { describe, expect, it } from "vitest";

import {
  buildRecipeYieldPortionPicker,
  canLogRecipeByGrams,
  canLogRecipeByUnits,
  clampRecipeYieldServings,
  parseRecipeYieldDefinition,
  recipeGramsPerUnit,
  recipeTotalMacrosFromPerServing,
  scaleRecipeMacroPanel,
  scaleRecipeMacrosByGrams,
  scaleRecipeMacrosByServings,
  scaleRecipeMacrosByUnits,
  scaleRecipePortionMacros,
  serializeRecipeYieldDefinition,
} from "@/lib/nutrition/recipeYield";

const perServing = {
  calories: 200,
  protein: 10,
  carbs: 20,
  fat: 8,
  fiberG: 2,
};

describe("recipeYield", () => {
  it("clamps authored servings into the supported range", () => {
    expect(clampRecipeYieldServings(0)).toBe(1);
    expect(clampRecipeYieldServings(4.6)).toBe(5);
    expect(clampRecipeYieldServings(99)).toBe(48);
    expect(clampRecipeYieldServings(NaN)).toBe(1);
  });

  it("derives total batch macros from per-serving × servings", () => {
    expect(recipeTotalMacrosFromPerServing(perServing, 4)).toEqual({
      calories: 800,
      protein: 40,
      carbs: 80,
      fat: 32,
      fiberG: 8,
    });
  });

  it("scales macros by gram weight when total batch weight is known", () => {
    const total = recipeTotalMacrosFromPerServing(perServing, 2);
    const yieldDef = { kind: "weight" as const, totalGrams: 500 };
    expect(scaleRecipeMacrosByGrams(total, yieldDef, 50)).toEqual({
      calories: 40,
      protein: 2,
      carbs: 4,
      fat: 1.6,
      fiberG: 0.4,
    });
    expect(scaleRecipeMacrosByGrams(total, yieldDef, 0)).toBeNull();
    expect(
      scaleRecipeMacrosByGrams(total, { kind: "servings", count: 2 }, 50),
    ).toBeNull();
  });

  it("scales macros by discrete units when unit count is known", () => {
    const total = recipeTotalMacrosFromPerServing(perServing, 1);
    expect(
      scaleRecipeMacrosByUnits(total, { kind: "units", count: 12, singular: "slice", plural: "slices" }, 3),
    ).toEqual({
      calories: 50,
      protein: 2.5,
      carbs: 5,
      fat: 2,
      fiberG: 0.5,
    });
    expect(
      scaleRecipeMacrosByUnits(
        total,
        {
          kind: "weight_and_units",
          totalGrams: 600,
          unitCount: 12,
          singular: "slice",
          plural: "slices",
        },
        2,
      ),
    ).toEqual({
      calories: 33,
      protein: 1.7,
      carbs: 3.3,
      fat: 1.3,
      fiberG: 0.3,
    });
  });

  it("refuses to guess when yield mode does not support the portion", () => {
    expect(
      scaleRecipePortionMacros(perServing, 4, { kind: "servings", count: 4 }, { mode: "grams", grams: 10 }),
    ).toBeNull();
    expect(
      scaleRecipePortionMacros(perServing, 4, { kind: "weight", totalGrams: 400 }, { mode: "grams", grams: 40 }),
    ).toEqual({
      calories: 80,
      protein: 4,
      carbs: 8,
      fat: 3.2,
      fiberG: 0.8,
    });
    expect(scaleRecipeMacrosByServings(perServing, 2.5)).toEqual({
      calories: 500,
      protein: 25,
      carbs: 50,
      fat: 20,
      fiberG: 5,
    });
  });

  it("parses and serialises yield jsonb with legacy servings fallback", () => {
    expect(parseRecipeYieldDefinition(null, 6)).toEqual({ kind: "servings", count: 6 });
    expect(parseRecipeYieldDefinition({ kind: "weight", totalGrams: 680 }, 4)).toEqual({
      kind: "weight",
      totalGrams: 680,
    });
    expect(
      parseRecipeYieldDefinition(
        { kind: "weight_and_units", totalGrams: 500, unitCount: 10, singular: "bar" },
        1,
      ),
    ).toEqual({
      kind: "weight_and_units",
      totalGrams: 500,
      unitCount: 10,
      singular: "bar",
      plural: "bars",
    });
    expect(parseRecipeYieldDefinition({ kind: "nonsense" }, 3)).toEqual({
      kind: "servings",
      count: 3,
    });
    expect(serializeRecipeYieldDefinition({ kind: "weight", totalGrams: 250 })).toEqual({
      kind: "weight",
      totalGrams: 250,
    });
  });

  it("exposes capability helpers and grams-per-unit", () => {
    expect(canLogRecipeByGrams({ kind: "weight", totalGrams: 100 })).toBe(true);
    expect(canLogRecipeByGrams({ kind: "units", count: 8, singular: "muffin", plural: "muffins" })).toBe(false);
    expect(canLogRecipeByUnits({ kind: "units", count: 8, singular: "muffin", plural: "muffins" })).toBe(true);
    expect(
      recipeGramsPerUnit({
        kind: "weight_and_units",
        totalGrams: 240,
        unitCount: 8,
        singular: "muffin",
        plural: "muffins",
      }),
    ).toBe(30);
  });

  it("builds portion-picker options when batch weight is known", () => {
    const picker = buildRecipeYieldPortionPicker(perServing, 4, {
      kind: "weight_and_units",
      totalGrams: 400,
      unitCount: 8,
      singular: "slice",
      plural: "slices",
    });
    expect(picker).not.toBeNull();
    expect(picker!.units.some((u) => u.kind === "gram")).toBe(true);
    expect(picker!.units.some((u) => u.kind === "count" && u.singular === "slice")).toBe(true);
    expect(buildRecipeYieldPortionPicker(perServing, 4, { kind: "servings", count: 4 })).toBeNull();
  });

  it("rounds scaled panels consistently", () => {
    expect(scaleRecipeMacroPanel(perServing, 0.333)).toEqual({
      calories: 67,
      protein: 3.3,
      carbs: 6.7,
      fat: 2.7,
      fiberG: 0.7,
    });
  });
});
