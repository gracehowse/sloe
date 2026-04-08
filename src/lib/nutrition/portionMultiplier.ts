import type { DayPlan, DayPlanMeal } from "../../types/recipe.ts";

const MIN = 0.5;
const MAX = 8;

/** Whole and half steps (0.5, 1, 1.5, …) for “me / us / family” style scaling. */
export function clampPortionMultiplier(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  const stepped = Math.round(raw * 2) / 2;
  return Math.min(MAX, Math.max(MIN, stepped));
}

export function effectivePortionMultiplier(m: number | undefined): number {
  if (m == null || !Number.isFinite(m)) return 1;
  return clampPortionMultiplier(m);
}

export function scaledMacro(base: number, mult: number): number {
  return Math.max(0, Math.round(base * mult));
}

export function dayPlanTotalsFromMeals(meals: DayPlanMeal[]): DayPlan["totals"] {
  return meals.reduce(
    (acc, m) => {
      if (m.isPlaceholder) return acc;
      const p = effectivePortionMultiplier(m.portionMultiplier);
      return {
        calories: acc.calories + scaledMacro(m.calories, p),
        protein: acc.protein + scaledMacro(m.protein, p),
        carbs: acc.carbs + scaledMacro(m.carbs, p),
        fat: acc.fat + scaledMacro(m.fat, p),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function normalizeDayPlanMeal(m: unknown): DayPlanMeal | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Partial<DayPlanMeal>;
  if (typeof o.name !== "string" || typeof o.recipeTitle !== "string") return null;
  const base = {
    name: o.name,
    recipeTitle: o.recipeTitle,
    calories: Math.max(0, Math.round(Number(o.calories) || 0)),
    protein: Math.max(0, Math.round(Number(o.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(o.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(o.fat) || 0)),
  };
  if (o.isPlaceholder) {
    return { ...base, isPlaceholder: true as const, portionMultiplier: 1 };
  }
  const mult = effectivePortionMultiplier(
    typeof o.portionMultiplier === "number" ? o.portionMultiplier : undefined,
  );
  return { ...base, portionMultiplier: mult };
}

export function normalizeDayPlans(raw: unknown): DayPlan[] | null {
  if (raw === null) return null;
  if (!Array.isArray(raw)) return null;
  const out: DayPlan[] = [];
  for (const d of raw) {
    if (!d || typeof d !== "object") continue;
    const day = (d as Partial<DayPlan>).day;
    if (typeof day !== "number" || !Number.isFinite(day)) continue;
    const rawMeals = (d as Partial<DayPlan>).meals;
    if (!Array.isArray(rawMeals)) continue;
    const meals = rawMeals.map(normalizeDayPlanMeal).filter((x): x is DayPlanMeal => Boolean(x));
    out.push({ day, meals, totals: dayPlanTotalsFromMeals(meals) });
  }
  return out.length ? out : null;
}
