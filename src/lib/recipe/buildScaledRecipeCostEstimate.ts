/**
 * ENG-1274 — scale viewing-amount ingredients then run the honest cost estimator.
 * Shared by web + mobile recipe-detail so screen files stay under the line budget.
 */
import {
  estimateRecipeCost,
  type RecipeCostEstimate,
  type RecipeCostIngredient,
} from "./estimateRecipeCost";

export function buildScaledRecipeCostEstimate(args: {
  enabled: boolean;
  ingredients: readonly RecipeCostIngredient[];
  servings: number;
}): RecipeCostEstimate | null {
  if (!args.enabled || args.ingredients.length === 0) return null;
  return estimateRecipeCost({
    ingredients: args.ingredients,
    servings: args.servings,
  });
}
