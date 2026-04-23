import type { DayPlan, DayPlanMeal } from "../../types/recipe.ts";

/** Legacy / empty-slot copy stored in old plans — dropped on normalize so UI never shows fake rows. */
export const MEAL_PLAN_LEGACY_PLACEHOLDER_TITLE = "Save recipes to build a macro-aware plan";

/** True for explicit placeholders, legacy empty-slot titles, and older “hint” rows saved without the flag. */
export function isMealPlanPlaceholderLikeTitle(
  recipeTitle: string,
  opts?: { isPlaceholder?: boolean },
): boolean {
  if (opts?.isPlaceholder) return true;
  const title = recipeTitle.trim();
  if (!title) return true;
  const tLower = title.toLowerCase();
  if (tLower === MEAL_PLAN_LEGACY_PLACEHOLDER_TITLE.toLowerCase()) return true;
  if (tLower.startsWith("save recipes to build") && tLower.includes("macro")) return true;
  if (tLower === "save more recipes" || tLower.startsWith("save more recipes")) return true;
  if (tLower === "placeholder" || /^placeholder(\s+meal)?$/i.test(title)) return true;
  if (/^tbd$/i.test(title) || /^coming soon$/i.test(title)) return true;
  if (/^empty slot|^no recipe (yet|chosen)|^tap to add|^pick a recipe|^choose (a )?recipe|^add (a )?recipe/i.test(title)) {
    return true;
  }
  return false;
}

const MIN = 0.5;
const MAX = 8;

/** Whole and half steps (0.5, 1, 1.5, …) for "me / us / family" style scaling. */
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

/**
 * Sum each slot's **display** macros (what the planner row shows).
 * `portionMultiplier` must not be applied again here — the generator and
 * swap/adjust paths already bake scale into `calories` / `protein` / etc.
 * (Applying multiplier twice was F-70 / TestFlight `AHjCqNMX…`.)
 */
export function dayPlanTotalsFromMeals(meals: DayPlanMeal[]): DayPlan["totals"] {
  return meals.reduce(
    (acc, m) => {
      if (m.isPlaceholder) return acc;
      return {
        calories: acc.calories + Math.max(0, Math.round(Number(m.calories) || 0)),
        protein: acc.protein + Math.max(0, Math.round(Number(m.protein) || 0)),
        carbs: acc.carbs + Math.max(0, Math.round(Number(m.carbs) || 0)),
        fat: acc.fat + Math.max(0, Math.round(Number(m.fat) || 0)),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function normalizeDayPlanMeal(m: unknown): DayPlanMeal | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Partial<DayPlanMeal>;
  if (typeof o.name !== "string" || typeof o.recipeTitle !== "string") return null;
  if (isMealPlanPlaceholderLikeTitle(o.recipeTitle, { isPlaceholder: o.isPlaceholder })) {
    return null;
  }
  const title = o.recipeTitle.trim();
  const rawCal = Math.max(0, Math.round(Number(o.calories) || 0));
  const rawPro = Math.max(0, Math.round(Number(o.protein) || 0));
  const rawCarbs = Math.max(0, Math.round(Number(o.carbs) || 0));
  const rawFat = Math.max(0, Math.round(Number(o.fat) || 0));
  const mult = effectivePortionMultiplier(
    typeof o.portionMultiplier === "number" ? o.portionMultiplier : undefined,
  );
  const bakedCal = mult !== 1 ? scaledMacro(rawCal, mult) : rawCal;
  const bakedPro = mult !== 1 ? scaledMacro(rawPro, mult) : rawPro;
  const bakedCarbs = mult !== 1 ? scaledMacro(rawCarbs, mult) : rawCarbs;
  const bakedFat = mult !== 1 ? scaledMacro(rawFat, mult) : rawFat;

  const rawFiber = o.fiberG != null ? Number(o.fiberG) : NaN;
  const bakedFiber =
    Number.isFinite(rawFiber) && mult !== 1
      ? Math.round(rawFiber * mult * 10) / 10
      : Number.isFinite(rawFiber)
        ? Math.round(rawFiber * 10) / 10
        : undefined;

  const out: DayPlanMeal = {
    name: o.name,
    recipeTitle: title,
    calories: bakedCal,
    protein: bakedPro,
    carbs: bakedCarbs,
    fat: bakedFat,
    ...(bakedFiber !== undefined ? { fiberG: bakedFiber } : {}),
    ...(typeof o.recipeId === "string" && o.recipeId.trim() ? { recipeId: o.recipeId.trim() } : {}),
    ...(typeof o.leftoverOf === "string" && o.leftoverOf.trim() !== ""
      ? { leftoverOf: o.leftoverOf.trim(), isLeftover: Boolean(o.isLeftover) }
      : {}),
  };
  return out;
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
    // F-15 — preserve residual protein gap when present on a persisted
    // plan. Only carries through when the value is a negative finite
    // number (gap), so stale zero / undefined / NaN don't surface a
    // misleading hint after a manual edit.
    const rawGap = (d as Partial<DayPlan>).residualProteinGap;
    const gap =
      typeof rawGap === "number" && Number.isFinite(rawGap) && rawGap < 0 ? rawGap : undefined;
    out.push({
      day,
      meals,
      totals: dayPlanTotalsFromMeals(meals),
      ...(gap != null ? { residualProteinGap: gap } : {}),
    });
  }
  return out.length ? out : null;
}
