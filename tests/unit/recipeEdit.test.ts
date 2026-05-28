import { describe, expect, it } from "vitest";

import {
  RECIPE_MEAL_TYPES,
  buildManualIngredientInsert,
  buildRecipeMetadataUpdate,
  canEditRecipe,
  clampRecipeServings,
  isMetadataDraftValid,
  parseNullableMinutes,
  recomputeRecipeAggregate,
  toggleMealType,
} from "../../src/lib/recipes/recipeEdit";

describe("recipeEdit shared helpers", () => {
  it("canEditRecipe requires matching author and user", () => {
    expect(canEditRecipe("a", "a")).toBe(true);
    expect(canEditRecipe("a", "b")).toBe(false);
    expect(canEditRecipe(null, "a")).toBe(false);
  });

  it("clampRecipeServings enforces 1–48", () => {
    expect(clampRecipeServings(0)).toBe(1);
    expect(clampRecipeServings(99)).toBe(48);
    expect(clampRecipeServings(4.7)).toBe(5);
  });

  it("parseNullableMinutes accepts numbers and strips non-digits from strings", () => {
    expect(parseNullableMinutes("")).toBeNull();
    expect(parseNullableMinutes("15 min")).toBe(15);
    expect(parseNullableMinutes(20)).toBe(20);
    expect(parseNullableMinutes("0")).toBeNull();
  });

  it("toggleMealType keeps canonical order", () => {
    expect(toggleMealType(["lunch"], "dinner")).toEqual(["lunch", "dinner"]);
    expect(toggleMealType(["lunch", "dinner"], "lunch")).toEqual(["dinner"]);
  });

  it("buildRecipeMetadataUpdate trims and nulls empties", () => {
    const out = buildRecipeMetadataUpdate({
      title: "  Pasta  ",
      description: "",
      servings: 2,
      mealType: ["dinner"],
      prepTimeMin: "10",
      cookTimeMin: "",
      instructions: "Boil water",
    });
    expect(out.title).toBe("Pasta");
    expect(out.description).toBeNull();
    expect(out.meal_type).toEqual(["dinner"]);
    expect(out.prep_time_min).toBe(10);
    expect(out.cook_time_min).toBeNull();
    expect(out.instructions).toBe("Boil water");
  });

  it("isMetadataDraftValid rejects blank titles", () => {
    expect(isMetadataDraftValid({ title: " " })).toBe(false);
    expect(isMetadataDraftValid({ title: "Ok" })).toBe(true);
  });

  it("recomputeRecipeAggregate divides summed macros by servings", () => {
    const agg = recomputeRecipeAggregate(
      [
        { calories: 400, protein: 40, carbs: 20, fat: 10, fiber_g: 4, sugar_g: 2, sodium_mg: 800 },
        { calories: 200, protein: 20, carbs: 10, fat: 5, fiber_g: 2, sugar_g: 1, sodium_mg: 400 },
      ],
      2,
    );
    expect(agg).toEqual({
      calories: 300,
      protein: 30,
      carbs: 15,
      fat: 8,
      fiber_g: 3,
      sugar_g: 1.5,
      sodium_mg: 600,
    });
  });

  it("buildManualIngredientInsert zeroes macros and flags manual add", () => {
    const row = buildManualIngredientInsert({
      recipeId: "r1",
      name: " Salt ",
      amount: "1",
      unit: " tsp ",
    });
    expect(row.recipe_id).toBe("r1");
    expect(row.name).toBe("Salt");
    expect(row.amount).toBe(1);
    expect(row.unit).toBe("tsp");
    expect(row.calories).toBe(0);
    expect(row.added_by_user).toBe(true);
    expect(row.is_verified).toBe(false);
    expect(row.source).toBe("Manual");
  });

  it("RECIPE_MEAL_TYPES matches chip set", () => {
    expect([...RECIPE_MEAL_TYPES]).toEqual(["breakfast", "lunch", "dinner", "snack"]);
  });
});
