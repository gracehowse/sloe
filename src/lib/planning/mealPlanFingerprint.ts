import { effectivePortionMultiplier } from "../nutrition/portionMultiplier.ts";
import type { DayPlan } from "../../types/recipe.ts";

/**
 * Stable string for the meal-plan shape that drives shopping list generation
 * (recipes + portion multipliers per slot). Used to detect when the list is out of date.
 */
export function fingerprintMealPlanForShopping(mealPlan: DayPlan[] | null): string {
  if (!mealPlan?.length) return "";
  const parts: string[] = [];
  const sorted = [...mealPlan].sort((a, b) => a.day - b.day);
  for (const dp of sorted) {
    for (let i = 0; i < dp.meals.length; i++) {
      const m = dp.meals[i]!;
      const ph = m.isPlaceholder ? "1" : "0";
      const title = (m.recipeTitle ?? "").trim();
      const p = effectivePortionMultiplier(m.portionMultiplier);
      parts.push(`${dp.day}:${i}:${ph}:${title}:${p}`);
    }
  }
  return parts.join("|");
}
