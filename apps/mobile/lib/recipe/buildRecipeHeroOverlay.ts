/**
 * ENG-1247 / ENG-1274 — build the v3 recipe-detail hero title overlay model.
 * Extracted from `app/recipe/[id].tsx` so the screen line-budget pin does not grow.
 */
import type { RecipeHeroOverlay } from "../../components/recipe/RecipeDetailHero";

export function buildRecipeHeroOverlay(args: {
  active: boolean;
  saved: boolean;
  title: string;
  timeMin: number | null;
  kcal: number | null;
  servings: number;
  costLabel: string | null;
  costLocked: boolean;
  onCostLockedPress?: () => void;
}): RecipeHeroOverlay | null {
  if (!args.active) return null;
  return {
    kicker: args.saved ? "From your cookbook" : "Fits your day",
    title: args.title,
    timeMin: args.timeMin,
    kcal: args.kcal,
    servings: args.servings,
    costLabel: args.costLabel,
    costLocked: args.costLocked,
    onCostLockedPress: args.onCostLockedPress,
  };
}
