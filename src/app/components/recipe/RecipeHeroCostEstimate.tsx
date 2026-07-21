/**
 * ENG-1274 — recipe-detail hero meta "est. cost" chip (Pro / locked).
 * Owns the cost hook so `RecipeDetail.tsx` stays under its line-budget pin.
 */
import { toast } from "sonner";
import { Badge } from "../suppr/badge";
import { useRecipeCostEstimate } from "../../../lib/recipe/useRecipeCostEstimate";
import {
  formatRecipeCostServingLabel,
  RECIPE_COST_LOCKED_LABEL,
} from "../../../lib/recipe/estimateRecipeCost";

type IngredientLine = {
  name: string;
  amount: string;
  unit?: string | null;
};

type Props = {
  ingredients: readonly IngredientLine[];
  servings: number;
  baseServings: number;
  isPro: boolean;
  onUpgrade?: () => void;
};

export function RecipeHeroCostEstimate({
  ingredients,
  servings,
  baseServings,
  isPro,
  onUpgrade,
}: Props) {
  const estimate = useRecipeCostEstimate({ ingredients, servings, baseServings });
  if (!estimate) return null;

  if (isPro) {
    return (
      <span
        className="inline-flex items-center gap-1"
        data-testid="recipe-cost-estimate"
      >
        {formatRecipeCostServingLabel(estimate)}
        <Badge variant="pro" className="ml-1 px-1 py-0 text-[9px] leading-none">
          Pro
        </Badge>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 pointer-events-auto"
      data-testid="recipe-cost-estimate-locked"
      onClick={() => {
        if (onUpgrade) onUpgrade();
        else toast.error("Upgrade to Pro to see estimated grocery cost.");
      }}
    >
      {RECIPE_COST_LOCKED_LABEL}
      <Badge variant="pro" className="ml-1 px-1 py-0 text-[9px] leading-none">
        Pro
      </Badge>
    </button>
  );
}
