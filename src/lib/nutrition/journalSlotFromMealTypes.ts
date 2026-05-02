/**
 * Resolve the canonical journal meal-slot for a recipe from its
 * `meal_type` array.
 *
 * Single source of truth for the "which slot does a recipe land in
 * when logged with one tap?" decision. Used by:
 *   - mobile recipe detail (`apps/mobile/app/recipe/[id].tsx`)
 *   - mobile LogSheet Library tab pick handler
 *     (`apps/mobile/app/(tabs)/index.tsx`)
 *   - web LogSheet Library tab pick handler
 *     (`src/app/components/NutritionTracker.tsx`)
 *
 * Rules (in priority order):
 *   1. If `meal_type` mentions "breakfast" -> "Breakfast"
 *   2. If it mentions "lunch" -> "Lunch"
 *   3. If it mentions "dinner" or "supper" -> "Dinner"
 *   4. If it mentions "snack" -> "Snacks"
 *   5. Otherwise pass the first entry through `normaliseMealSlot` for
 *      legacy / mixed-case rows.
 *   6. When all else fails (no meal_type, unrecognised string) ->
 *      `fallback` (default `"Lunch"`).
 *
 * Pure -- no React, no Supabase, safe to import from anywhere.
 */

import { normaliseMealSlot, type MealSlot } from "./mealSlots";

export function journalSlotFromMealTypes(
  mealType: readonly string[] | string[] | null | undefined,
  fallback: MealSlot = "Lunch",
): MealSlot {
  if (!mealType || mealType.length === 0) return fallback;
  const joined = mealType.map((t) => String(t).toLowerCase()).join(" ");
  if (joined.includes("breakfast")) return "Breakfast";
  if (joined.includes("lunch")) return "Lunch";
  if (joined.includes("dinner") || joined.includes("supper")) return "Dinner";
  if (joined.includes("snack")) return "Snacks";
  return normaliseMealSlot(mealType[0]) ?? fallback;
}
