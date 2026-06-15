import { describe, expect, it } from "vitest";

import { buildNutritionEntryUpdatePayload } from "@/lib/nutrition/nutritionEntryUpdatePayload";
import type { LoggedMeal } from "@/types/recipe";

describe("buildNutritionEntryUpdatePayload", () => {
  it("maps LoggedMeal fields to nutrition_entries columns", () => {
    const meal: LoggedMeal = {
      id: "m1",
      name: "Breakfast",
      recipeTitle: "Oats",
      time: "8:00 AM",
      calories: 320,
      protein: 12,
      carbs: 45,
      fat: 8,
      fiberG: 6,
      portionMultiplier: 1.5,
      source: "manual",
      recipeId: "r1",
    };
    const payload = buildNutritionEntryUpdatePayload("2026-06-14", meal);
    expect(payload).toMatchObject({
      date_key: "2026-06-14",
      name: "Breakfast",
      recipe_title: "Oats",
      time_label: "8:00 AM",
      calories: 320,
      protein: 12,
      carbs: 45,
      fat: 8,
      fiber_g: 6,
      portion_multiplier: 1.5,
      recipe_id: "r1",
    });
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("user_id");
  });
});
