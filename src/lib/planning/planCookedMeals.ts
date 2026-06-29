import { dateKeyFromDate } from "../datetime/dateKey";

/**
 * Plan "cooked" detection — a planned meal counts as cooked when the user has
 * logged a matching diary entry on that calendar day (ENG-1247 plan-day band).
 */
export interface PlanMealCookRef {
  recipeId?: string | null;
  recipeTitle?: string | null;
  isPlaceholder?: boolean;
}

export interface LoggedMealCookRef {
  recipeId?: string | null;
  recipeTitle?: string | null;
  name?: string | null;
}

function normTitle(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** True when a diary entry matches this planned meal (recipe id or title). */
export function isPlanMealCooked(
  meal: PlanMealCookRef,
  logged: readonly LoggedMealCookRef[],
): boolean {
  if (meal.isPlaceholder) return false;
  const planTitle = normTitle(meal.recipeTitle);
  if (!meal.recipeId && !planTitle) return false;
  for (const entry of logged) {
    if (meal.recipeId && entry.recipeId && meal.recipeId === entry.recipeId) {
      return true;
    }
    const entryTitle = normTitle(entry.recipeTitle || entry.name);
    if (planTitle && entryTitle && planTitle === entryTitle) return true;
  }
  return false;
}

/** Count planned slots on a day that appear in the food diary for that date. */
export function countPlanDayCookedMeals(
  meals: readonly PlanMealCookRef[],
  logged: readonly LoggedMealCookRef[],
): number {
  return meals.filter((m) => isPlanMealCooked(m, logged)).length;
}

/** Per-slot cooked flags aligned to `meals` indices. */
export function planDayCookedFlags(
  meals: readonly PlanMealCookRef[],
  logged: readonly LoggedMealCookRef[],
): boolean[] {
  return meals.map((m) => isPlanMealCooked(m, logged));
}

export type PlanJournalByDay = Record<string, readonly LoggedMealCookRef[]>;

/** Diary rows logged on the same local calendar day as `date`. */
export function journalEntriesForPlanDate(
  nutritionByDay: PlanJournalByDay | undefined,
  date: Date,
): readonly LoggedMealCookRef[] {
  if (!nutritionByDay) return [];
  return nutritionByDay[dateKeyFromDate(date)] ?? [];
}
