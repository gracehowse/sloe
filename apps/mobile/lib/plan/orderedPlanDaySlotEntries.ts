/**
 * ENG-1100 — canonical Plan day slot order (web `bySlot` parity).
 */
import { ALL_MEAL_SLOTS } from "@suppr/shared/nutrition/mealPlanAlgo";
import { normaliseMealSlot } from "@suppr/shared/nutrition/mealSlots";
import {
  resolvePlanSlotIconKey,
  type PlanSlotIconKey,
} from "@suppr/shared/planning/planDayLabel";

export type PlanDaySlotMeal = { name: string };

export type PlanDaySlotEntry<T extends PlanDaySlotMeal = PlanDaySlotMeal> =
  | { kind: "meal"; meal: T; mealIndexInDay: number }
  | { kind: "empty"; slot: string; slotIndex: number };

function sortMealsBySlotOrder<T extends PlanDaySlotMeal>(meals: T[]): T[] {
  const order: Record<PlanSlotIconKey, number> = {
    breakfast: 0,
    lunch: 1,
    dinner: 2,
    snacks: 3,
  };
  const rank = (name: string) => order[resolvePlanSlotIconKey(name)] ?? 99;
  return [...meals].sort((a, b) => rank(a.name) - rank(b.name));
}

export function orderedPlanDaySlotEntries<T extends PlanDaySlotMeal>(
  meals: T[],
  canonicalAimRows: boolean,
): PlanDaySlotEntry<T>[] {
  if (!canonicalAimRows) {
    return sortMealsBySlotOrder(meals).map((meal) => ({
      kind: "meal" as const,
      meal,
      mealIndexInDay: meals.indexOf(meal),
    }));
  }
  const bySlot = new Map<string, { meal: T; mealIndexInDay: number }>();
  meals.forEach((meal, i) => {
    const slot = normaliseMealSlot(meal.name);
    if (slot && !bySlot.has(slot)) bySlot.set(slot, { meal, mealIndexInDay: i });
  });
  return ALL_MEAL_SLOTS.map((slot, slotIndex) => {
    const hit = bySlot.get(slot);
    if (hit) return { kind: "meal" as const, ...hit };
    return { kind: "empty" as const, slot, slotIndex };
  });
}
