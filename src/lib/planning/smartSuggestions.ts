import type { DayPlan, RecipeCard } from "../../types/recipe.ts";
import { getIngredientsForRecipe, RECIPE_CATALOG } from "../../data/recipeCatalog.ts";
import { isCatalogRecipeId } from "./generateShoppingList.ts";

function normalizeIngredientKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(",")[0]!
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ingredient name keys already required by non-placeholder meals in the plan (catalog recipes only in MVP). */
export function collectPlanIngredientKeys(
  mealPlan: DayPlan[] | null,
  titleToId: (title: string) => string | null,
): Set<string> {
  const keys = new Set<string>();
  if (!mealPlan?.length) return keys;
  for (const day of mealPlan) {
    for (const meal of day.meals) {
      if (meal.isPlaceholder) continue;
      const id = titleToId(meal.recipeTitle);
      if (!id || !isCatalogRecipeId(id)) continue;
      for (const ing of getIngredientsForRecipe(id)) {
        const k = normalizeIngredientKey(ing.name);
        if (k.length > 1) keys.add(k);
      }
    }
  }
  return keys;
}

export type SmartSuggestion = {
  recipe: RecipeCard;
  sharedIngredients: string[];
  score: number;
};

/**
 * Recipes in the catalog that are not already on the plan and share ingredients with plan recipes.
 */
export function computeSmartRecipeSuggestions(input: {
  mealPlan: DayPlan[] | null;
  titleToId: (title: string) => string | null;
  max?: number;
}): SmartSuggestion[] {
  const max = input.max ?? 6;
  const planKeys = collectPlanIngredientKeys(input.mealPlan, input.titleToId);
  if (planKeys.size === 0) return [];

  const titlesOnPlan = new Set<string>();
  for (const d of input.mealPlan ?? []) {
    for (const m of d.meals) {
      if (!m.isPlaceholder) titlesOnPlan.add(m.recipeTitle);
    }
  }

  const out: SmartSuggestion[] = [];

  for (const recipe of RECIPE_CATALOG) {
    if (titlesOnPlan.has(recipe.title)) continue;
    const ings = getIngredientsForRecipe(recipe.id);
    const shared: string[] = [];
    for (const ing of ings) {
      const k = normalizeIngredientKey(ing.name);
      if (k.length > 1 && planKeys.has(k)) {
        shared.push(ing.name);
      }
    }
    if (shared.length === 0) continue;
    out.push({ recipe, sharedIngredients: shared.slice(0, 8), score: shared.length });
  }

  out.sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title));
  return out.slice(0, max);
}
