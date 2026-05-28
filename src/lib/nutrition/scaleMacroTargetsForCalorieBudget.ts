/**
 * Scale protein / carbs / fat gram targets when activity bonus inflates
 * the calorie budget. Keeps macro rings, tiles, remaining rows, food
 * search, and widget snapshots aligned with the calorie ring goal.
 */

export type MacroGramTargets = {
  protein: number;
  carbs: number;
  fat: number;
};

export function scaleMacroTargetsForCalorieBudget(
  base: MacroGramTargets,
  params: { baseCalories: number; effectiveCalories: number },
): MacroGramTargets {
  const { baseCalories, effectiveCalories } = params;
  if (baseCalories <= 0 || effectiveCalories <= baseCalories) {
    return { ...base };
  }
  const scale = effectiveCalories / baseCalories;
  return {
    protein: Math.round(base.protein * scale),
    carbs: Math.round(base.carbs * scale),
    fat: Math.round(base.fat * scale),
  };
}
