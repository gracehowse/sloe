/**
 * TestFlight / planner helpers — recipes sometimes have recipe-level kcal
 * but P/C/F still at 0 in the DB (seeded rows, partial imports). The joint
 * meal-plan fitter then drives extreme portion multipliers and scaled rows
 * show calories with 0g macros (AGSeM-FnnYbZy6FJveUKBoc).
 *
 * T4 (full-sweep 2026-04-24): the coerced P/C/F split is a neutral
 * guess — NOT real nutrition. It is safe for the planner fitter and the
 * planner row display (where it prevents "calories with 0g macros"
 * confusion), but it is **NEVER** safe to write to `nutrition_entries` /
 * the user's journal: doing so violates the project's
 * "if nutrition is uncertain, do not guess" rule and silently inserts
 * fabricated data into a health log.
 *
 * The return value now carries `isCoerced: boolean` so journal-write
 * paths can detect the fabrication and refuse (or ask the user to verify
 * the recipe before logging). See `wouldCoerceMacros` for a cheap
 * detection helper that takes only the raw recipe row — use it inside
 * fetch layers (e.g. `fetchPlannedMealMicros`) to signal log-time
 * guardrails without re-running the coercion.
 *
 * Policy reference: `docs/product/nutrition-approximation-policy.md` §A1.
 */

const KCAL_P = 4;
const KCAL_C = 4;
const KCAL_F = 9;

/** Coercion fires when stated calories are ≥ this multiple of the kcal
 *  explained by the gram columns. Below this threshold we treat the
 *  gram columns as unreliable and synthesise a neutral split. */
export const MACRO_COERCION_THRESHOLD = 0.45;

/** Grams of P/C/F as their calorie contribution. */
export function macroKcalFromGrams(protein: number, carbs: number, fat: number): number {
  const p = Math.max(0, Number(protein) || 0);
  const c = Math.max(0, Number(carbs) || 0);
  const f = Math.max(0, Number(fat) || 0);
  return p * KCAL_P + c * KCAL_C + f * KCAL_F;
}

export type MacrosInput = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
};

export type MacrosResult = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  /**
   * True when the returned P/C/F are **synthesised** from a neutral
   * 28/42/30 split because the gram columns didn't explain the stated
   * calories. Never write a row with `isCoerced: true` to
   * `nutrition_entries` — it's not real nutrition data.
   */
  isCoerced: boolean;
};

/**
 * Cheap, side-effect-free check: would `coerceMacrosWhenCaloriesButNoGrams`
 * synthesise macros for this input? Use this at journal-write guardrails
 * where you have the raw recipe row and need a go/no-go signal without
 * actually running the coercion.
 */
export function wouldCoerceMacros(input: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}): boolean {
  const cal = Math.max(0, Math.round(Number(input.calories) || 0));
  if (cal <= 0) return false;
  const k0 = macroKcalFromGrams(
    Number(input.protein) || 0,
    Number(input.carbs) || 0,
    Number(input.fat) || 0,
  );
  return k0 < cal * MACRO_COERCION_THRESHOLD;
}

/**
 * When stated calories are mostly unexplained by the gram columns, assign a
 * neutral P/C/F split so `fitDayToTargets` + row display stay coherent.
 * Does not invent fiber when missing (separate import path).
 *
 * **Planner-display only.** The result carries `isCoerced: true` when the
 * synthesis fires; journal write paths must check the flag and refuse to
 * persist fabricated P/C/F values. See `wouldCoerceMacros` for the cheap
 * detection variant used at write-time.
 */
export function coerceMacrosWhenCaloriesButNoGrams(input: MacrosInput): MacrosResult {
  const cal = Math.max(0, Math.round(Number(input.calories) || 0));
  const p0 = Number(input.protein) || 0;
  const c0 = Number(input.carbs) || 0;
  const f0 = Number(input.fat) || 0;
  const fiberIn = input.fiberG;
  if (cal <= 0) {
    return {
      calories: 0,
      protein: p0,
      carbs: c0,
      fat: f0,
      ...(fiberIn != null ? { fiberG: fiberIn } : {}),
      isCoerced: false,
    };
  }
  const k0 = macroKcalFromGrams(p0, c0, f0);
  if (k0 >= cal * MACRO_COERCION_THRESHOLD) {
    return {
      calories: cal,
      protein: p0,
      carbs: c0,
      fat: f0,
      ...(fiberIn != null ? { fiberG: fiberIn } : {}),
      isCoerced: false,
    };
  }
  const protein = Math.round((cal * 0.28) / KCAL_P * 10) / 10;
  const carbs = Math.round((cal * 0.42) / KCAL_C * 10) / 10;
  const fat = Math.round((cal * 0.3) / KCAL_F * 10) / 10;
  return {
    calories: cal,
    protein,
    carbs,
    fat,
    ...(fiberIn != null && Number.isFinite(fiberIn) && fiberIn > 0 ? { fiberG: fiberIn } : {}),
    isCoerced: true,
  };
}

/**
 * Planner-fitter base macros for a recipe row — the coerced calories/P/C/F with
 * `fiberG` defaulted to 0, the exact shape `MealPlanner.pickSwap` feeds into
 * `refitDayMealsToTargets`. Extracted from MealPlanner so the pinned screen file
 * shrinks (ENG-958). Planner-display only — never persist (see the isCoerced note).
 */
export function baseMacrosFromRecipe(r: MacrosInput): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
} {
  const c = coerceMacrosWhenCaloriesButNoGrams(r);
  return {
    calories: c.calories,
    protein: c.protein,
    carbs: c.carbs,
    fat: c.fat,
    fiberG: c.fiberG ?? 0,
  };
}

/**
 * Penalise extreme per-slot portion spreads (e.g. 0.2× vs 1.8×) so the
 * sampler prefers days that still hit targets without looking absurd.
 */
export function mealPlanPortionSpreadPenalty(multipliers: readonly number[]): number {
  const m = multipliers.filter((x) => Number.isFinite(x) && x > 0.01);
  if (m.length < 2) return 0;
  const hi = Math.max(...m);
  const lo = Math.min(...m);
  const ratio = hi / lo;
  if (ratio <= 4) return 0;
  return (ratio - 4) * 12;
}
