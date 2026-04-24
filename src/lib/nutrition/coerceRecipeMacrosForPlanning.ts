/**
 * TestFlight / planner helpers — recipes sometimes have recipe-level kcal
 * but P/C/F still at 0 in the DB (seeded rows, partial imports). The joint
 * meal-plan fitter then drives extreme portion multipliers and scaled rows
 * show calories with 0g macros (AGSeM-FnnYbZy6FJveUKBoc).
 */

const KCAL_P = 4;
const KCAL_C = 4;
const KCAL_F = 9;

/** Grams of P/C/F as their calorie contribution. */
export function macroKcalFromGrams(protein: number, carbs: number, fat: number): number {
  const p = Math.max(0, Number(protein) || 0);
  const c = Math.max(0, Number(carbs) || 0);
  const f = Math.max(0, Number(fat) || 0);
  return p * KCAL_P + c * KCAL_C + f * KCAL_F;
}

/**
 * When stated calories are mostly unexplained by the gram columns, assign a
 * neutral P/C/F split so `fitDayToTargets` + row display stay coherent.
 * Does not invent fiber when missing (separate import path).
 */
export function coerceMacrosWhenCaloriesButNoGrams(input: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
}): { calories: number; protein: number; carbs: number; fat: number; fiberG?: number } {
  const cal = Math.max(0, Math.round(Number(input.calories) || 0));
  const p0 = Number(input.protein) || 0;
  const c0 = Number(input.carbs) || 0;
  const f0 = Number(input.fat) || 0;
  const fiberIn = input.fiberG;
  if (cal <= 0) {
    return { calories: 0, protein: p0, carbs: c0, fat: f0, ...(fiberIn != null ? { fiberG: fiberIn } : {}) };
  }
  const k0 = macroKcalFromGrams(p0, c0, f0);
  if (k0 >= cal * 0.45) {
    return { calories: cal, protein: p0, carbs: c0, fat: f0, ...(fiberIn != null ? { fiberG: fiberIn } : {}) };
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
