/**
 * Batch cook helpers (ENG-1255 / B3 minimal v1).
 *
 * Prototype: `docs/ux/redesign/v3/Sloe-App.html` `BatchCook` (~L5651).
 * Grace scope 2026-06-28: recipe picker + batch-size scaling + shopping-list
 * scale — not the full assign-portions / fridge-pip planner at launch.
 */
export const BATCH_COOK_MIN_PORTIONS = 2;
export const BATCH_COOK_MIN_TIME_MIN = 25;

export interface BatchCookRecipeCandidate {
  id: string;
  title: string;
  calories: number;
  protein: number;
  timeMin: number;
  servings: number;
  imageUrl?: string | null;
}

export function recipeTotalTimeMin(
  prep: number | null | undefined,
  cook: number | null | undefined,
): number {
  return (prep ?? 0) + (cook ?? 0);
}

export function isBatchCookCandidate(input: {
  prep_time_min?: number | null;
  cook_time_min?: number | null;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  timeMin?: number;
}): boolean {
  const t =
    input.timeMin ??
    recipeTotalTimeMin(
      input.prep_time_min ?? input.prepTimeMin,
      input.cook_time_min ?? input.cookTimeMin,
    );
  return t >= BATCH_COOK_MIN_TIME_MIN;
}

/** Per-portion kcal when the recipe yield is scaled to `batchPortions`. */
export function batchPerPortionCalories(
  caloriesPerRecipeYield: number,
  recipeServings: number,
): number {
  if (recipeServings <= 0) return Math.round(caloriesPerRecipeYield);
  return Math.round(caloriesPerRecipeYield / recipeServings);
}

/** Ingredient-list multiplier for shopping when cooking `batchPortions`. */
export function batchShoppingMultiplier(
  batchPortions: number,
  recipeServings: number,
): number {
  if (recipeServings <= 0) return batchPortions;
  return batchPortions / recipeServings;
}

export function clampBatchPortions(value: number): number {
  return Math.max(BATCH_COOK_MIN_PORTIONS, Math.floor(value));
}

export function defaultBatchCookToolSubtitle(): string {
  return "Cook once · scale shopping";
}

export function batchCookToolSubtitle(batchPortions: number, assignedMeals = 0): string {
  if (assignedMeals > 0) {
    return `${batchPortions} portions · ${assignedMeals} in plan`;
  }
  return `${batchPortions} portions · scale shopping`;
}
