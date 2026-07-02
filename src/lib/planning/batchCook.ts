/**
 * Batch cook helpers (ENG-1255 / B3 minimal v1).
 *
 * Prototype: `docs/ux/redesign/v3/Sloe-App.html` `BatchCook` (~L5651).
 * Grace scope 2026-06-28: recipe picker + batch-size scaling + shopping-list
 * scale — not the full assign-portions / fridge-pip planner at launch.
 */
export const BATCH_COOK_MIN_PORTIONS = 2;

export interface BatchCookRecipeCandidate {
  id: string;
  title: string;
  calories: number;
  protein: number;
  timeMin: number;
  servings: number;
  imageUrl?: string | null;
  /**
   * ENG-1327 — future creator signal. Creators will be able to mark a recipe
   * as explicitly batch-friendly (keeps well, freezes well); when that field
   * lands it flows through here and short-circuits the servings gate. No
   * schema exists yet — candidate mappers populate it once the creator field
   * ships.
   */
  batchFriendly?: boolean;
}

export function recipeTotalTimeMin(
  prep: number | null | undefined,
  cook: number | null | undefined,
): number {
  return (prep ?? 0) + (cook ?? 0);
}

/**
 * Batch-cook eligibility (ENG-1327, Grace 2026-07-02): a recipe is batchable
 * when it yields multiple portions — or a creator has marked it
 * batch-friendly. Cook time is deliberately NOT a gate: batching is about
 * portions / keeps-well / creator signal, not how long the pot takes.
 */
export function isBatchCookCandidate(input: {
  servings?: number | null;
  batchFriendly?: boolean | null;
}): boolean {
  if (input.batchFriendly === true) return true;
  return (input.servings ?? 0) >= BATCH_COOK_MIN_PORTIONS;
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
