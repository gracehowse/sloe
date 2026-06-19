import type { LoggedMeal } from "../../types/recipe.ts";
import { canonicalNutritionEntrySource } from "./canonicalNutritionEntrySource.ts";
import { nutritionEntryDateKeyAndEatenAt } from "./mealEatenAt.ts";

/** Column-parity update payload for `nutrition_entries` (ENG-1122). */
export function buildNutritionEntryUpdatePayload(
  dayKey: string,
  meal: LoggedMeal,
  timeZone?: string | null,
): Record<string, unknown> {
  const { dateKey, eatenAt } = nutritionEntryDateKeyAndEatenAt(meal, dayKey, null, timeZone);
  return {
    date_key: dateKey,
    name: meal.name,
    recipe_title: meal.recipeTitle,
    time_label: meal.time,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    fiber_g: meal.fiberG ?? null,
    water_ml: meal.waterMl ?? null,
    portion_multiplier: meal.portionMultiplier ?? 1,
    nutrition_micros:
      meal.micros && Object.keys(meal.micros).length > 0 ? meal.micros : {},
    source: canonicalNutritionEntrySource(meal.source),
    recipe_id: meal.recipeId ?? null,
    eaten_at: eatenAt,
  };
}
