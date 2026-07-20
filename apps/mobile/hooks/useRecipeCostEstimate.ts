/**
 * ENG-1274 — estimated grocery cost for the recipe-detail hero meta row.
 * Lives outside `app/recipe/[id].tsx` so the screen line-budget pin does not grow.
 */
import { useMemo } from "react";
import { isFeatureEnabled } from "@/lib/analytics";
import { buildScaledRecipeCostEstimate } from "@suppr/shared/recipe/buildScaledRecipeCostEstimate";
import {
  formatRecipeCostServingLabel,
  type RecipeCostEstimate,
} from "@suppr/shared/recipe/estimateRecipeCost";

type IngredientLine = {
  name: string;
  amount: number | null;
  unit: string | null;
};

export function useRecipeCostEstimate(args: {
  ingredients: readonly IngredientLine[];
  viewMultiplier: number;
  viewServings: number;
  userTier: "free" | "base" | "pro";
  onCostLockedPress: () => void;
}): {
  estimate: RecipeCostEstimate | null;
  costLabel: string | null;
  costLocked: boolean;
  onCostLockedPress: (() => void) | undefined;
} {
  const enabled = isFeatureEnabled("recipe_estimated_cost_v1");
  const estimate = useMemo(() => {
    const scaledIngredients = args.ingredients.map((ing) => ({
      name: ing.name,
      amount:
        ing.amount != null && Number.isFinite(ing.amount)
          ? String(ing.amount * args.viewMultiplier)
          : "",
      unit: ing.unit ?? "",
    }));
    return buildScaledRecipeCostEstimate({
      enabled,
      ingredients: scaledIngredients,
      servings: args.viewServings,
    });
  }, [enabled, args.ingredients, args.viewMultiplier, args.viewServings]);

  const isPro = args.userTier === "pro";
  return {
    estimate,
    costLabel: estimate && isPro ? formatRecipeCostServingLabel(estimate) : null,
    costLocked: Boolean(estimate && !isPro),
    onCostLockedPress: estimate && !isPro ? args.onCostLockedPress : undefined,
  };
}
