/**
 * ENG-1274 — web recipe-detail cost estimate hook.
 * Lives outside `RecipeDetail.tsx` so the screen line-budget pin does not grow.
 */
import { useMemo } from "react";
import { isFeatureEnabled } from "../analytics/track.ts";
import { parseAmount } from "../planning/shoppingMergePrimitives";
import { buildScaledRecipeCostEstimate } from "./buildScaledRecipeCostEstimate";
import type { RecipeCostEstimate } from "./estimateRecipeCost";

type IngredientLine = {
  name: string;
  amount: string;
  unit?: string | null;
};

export function useRecipeCostEstimate(args: {
  ingredients: readonly IngredientLine[];
  servings: number;
  baseServings: number;
}): RecipeCostEstimate | null {
  const enabled = isFeatureEnabled("recipe_estimated_cost_v1");
  return useMemo(() => {
    const scale = args.servings / Math.max(1, args.baseServings);
    const scaledIngredients = args.ingredients.map((ing) => {
      const parsed = parseAmount(ing.amount);
      return {
        name: ing.name,
        amount: parsed != null ? String(parsed * scale) : ing.amount,
        unit: ing.unit ?? "",
      };
    });
    return buildScaledRecipeCostEstimate({
      enabled,
      ingredients: scaledIngredients,
      servings: args.servings,
    });
  }, [enabled, args.ingredients, args.servings, args.baseServings]);
}
