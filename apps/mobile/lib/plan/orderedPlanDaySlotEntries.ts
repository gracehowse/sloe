/**
 * ENG-1100 — canonical Plan day slot order (web `bySlot` parity).
 *
 * ENG-1278 — the canonical-aim slot set is now the user's ACTUAL configured
 * slots (classic 4 OR a numbered 4-/6-meal preset), not a hardcoded classic
 * four. Callers pass `slots` from `enabledMealSlotLabels(config)`; it defaults
 * to the classic four so every legacy caller stays byte-identical.
 */
import { ALL_MEAL_SLOTS } from "@suppr/nutrition-core/mealPlanAlgo";
import { normaliseMealSlot } from "@suppr/nutrition-core/mealSlots";
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
  /** ENG-1278 — configured slot labels (classic 4 or numbered 4/6). */
  slots: readonly string[] = ALL_MEAL_SLOTS,
): PlanDaySlotEntry<T>[] {
  if (!canonicalAimRows) {
    return sortMealsBySlotOrder(meals).map((meal) => ({
      kind: "meal" as const,
      meal,
      mealIndexInDay: meals.indexOf(meal),
    }));
  }
  // Match a meal to a configured slot: classic names via `normaliseMealSlot`
  // (Snack→Snacks etc.), numbered labels ("Meal 1") via a case-insensitive
  // exact match so a 5-/6-meal day's real meals land in their own slot.
  const bySlot = new Map<string, { meal: T; mealIndexInDay: number }>();
  meals.forEach((meal, i) => {
    const slot =
      normaliseMealSlot(meal.name) ??
      slots.find((s) => s.toLowerCase() === String(meal.name ?? "").trim().toLowerCase());
    if (slot && !bySlot.has(slot)) bySlot.set(slot, { meal, mealIndexInDay: i });
  });
  return slots.map((slot, slotIndex) => {
    const hit = bySlot.get(slot);
    if (hit) return { kind: "meal" as const, ...hit };
    return { kind: "empty" as const, slot, slotIndex };
  });
}
