import { describe, expect, it } from "vitest";
import {
  cookIngredientChecklistKey,
  getCookIngredientCheckedSet,
  toggleCookIngredientChecked,
  clearCookIngredientChecklist,
} from "../../src/lib/nutrition/cookIngredientChecklist.ts";

describe("cookIngredientChecklist session store", () => {
  const recipeId = "recipe-test-946";

  it("starts empty for a new recipe", () => {
    clearCookIngredientChecklist(recipeId);
    expect(getCookIngredientCheckedSet(recipeId).size).toBe(0);
  });

  it("toggles checked state per index", () => {
    clearCookIngredientChecklist(recipeId);
    expect(toggleCookIngredientChecked(recipeId, 0)).toBe(true);
    expect(getCookIngredientCheckedSet(recipeId).has(0)).toBe(true);
    expect(toggleCookIngredientChecked(recipeId, 0)).toBe(false);
    expect(getCookIngredientCheckedSet(recipeId).has(0)).toBe(false);
  });

  it("normalises blank recipe ids", () => {
    expect(cookIngredientChecklistKey("  ")).toBe("unknown");
  });
});
