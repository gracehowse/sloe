/**
 * ENG-928 — slot-aware "go-to" foods for the empty Log sheet.
 *
 * Surfaces foods logged often in the active meal slot (Breakfast/Lunch/etc.),
 * ranked by frequency + recency via `computeFrequentMeals`.
 */

import { normaliseMealSlot, type MealSlot } from "./mealSlots";
import {
  computeFrequentMeals,
  type FoodHistoryItem,
  type FoodHistoryMealLike,
} from "./foodHistory";

const MIN_GO_TO_COUNT = 2;

export function computeSlotGoToFoods<M extends FoodHistoryMealLike & { name?: string | null }>(
  byDay: Record<string, M[]>,
  slot: MealSlot,
  limit = 6,
): FoodHistoryItem[] {
  const slotByDay: Record<string, M[]> = {};
  for (const [dayKey, meals] of Object.entries(byDay)) {
    if (!Array.isArray(meals)) continue;
    const kept = meals.filter((m) => normaliseMealSlot(m?.name ?? "") === slot);
    if (kept.length > 0) slotByDay[dayKey] = kept;
  }
  return computeFrequentMeals(slotByDay, limit).filter((it) => it.count >= MIN_GO_TO_COUNT);
}
