/**
 * ENG-1247 / ENG-1274 — v3 recipe-detail hero overlay + cost estimate.
 * Extracted from `app/recipe/[id].tsx` so the screen line-budget pin does not grow.
 */
import { useRecipeCostEstimate } from "./useRecipeCostEstimate";
import { buildRecipeHeroOverlay } from "../lib/recipe/buildRecipeHeroOverlay";
import type { RecipeHeroOverlay } from "../components/recipe/RecipeDetailHero";

type IngredientLine = {
  name: string;
  amount: number | null;
  unit: string | null;
};

export function useRecipeHeroOverlay(args: {
  recipeDetailV3: boolean;
  heroImageUrl: string | null;
  heroImageBroken: boolean;
  saved: boolean;
  title: string;
  prepMin: number | null | undefined;
  cookMin: number | null | undefined;
  kcal: number;
  viewServings: number;
  viewMultiplier: number;
  ingredients: readonly IngredientLine[];
  userTier: "free" | "base" | "pro";
  onCostLockedPress: () => void;
}): {
  heroOverlay: RecipeHeroOverlay | null;
  heroOverlayActive: boolean;
  heroTotalTimeMin: number | null;
} {
  const recipeCostHero = useRecipeCostEstimate({
    ingredients: args.ingredients,
    viewMultiplier: args.viewMultiplier,
    viewServings: args.viewServings,
    userTier: args.userTier,
    onCostLockedPress: args.onCostLockedPress,
  });

  const heroShowsPhoto = Boolean(args.heroImageUrl) && !args.heroImageBroken;
  const heroOverlayActive = args.recipeDetailV3 && heroShowsPhoto;
  const heroTotalTimeMin =
    (args.prepMin ?? 0) + (args.cookMin ?? 0) || null;

  const heroOverlay = buildRecipeHeroOverlay({
    active: heroOverlayActive,
    saved: args.saved,
    title: args.title,
    timeMin: heroTotalTimeMin,
    kcal: Math.round(args.kcal) > 0 ? Math.round(args.kcal) : null,
    servings: args.viewServings,
    costLabel: recipeCostHero.costLabel,
    costLocked: recipeCostHero.costLocked,
    onCostLockedPress: recipeCostHero.onCostLockedPress,
  });

  return { heroOverlay, heroOverlayActive, heroTotalTimeMin };
}
