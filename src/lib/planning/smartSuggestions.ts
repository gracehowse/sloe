import type { DayPlan, RecipeCard } from "../../types/recipe.ts";
import { getIngredientsForRecipe, RECIPE_CATALOG } from "../../data/recipeCatalog.ts";
import { isCatalogRecipeId } from "./generateShoppingList.ts";
import { normalizeIngredientNameKey } from "./ingredientNameKey.ts";

const catalogIds = new Set(RECIPE_CATALOG.map((r) => r.id));

/**
 * Ingredient name keys already required by non-placeholder meals in the plan.
 * Uses catalog ingredients and optional DB ingredient names for community recipes.
 */
export function collectPlanIngredientKeys(
  mealPlan: DayPlan[] | null,
  titleToId: (title: string) => string | null,
  dbIngredientsByRecipeId?: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  const keys = new Set<string>();
  if (!mealPlan?.length) return keys;
  for (const day of mealPlan) {
    for (const meal of day.meals) {
      if (meal.isPlaceholder) continue;
      const id = titleToId(meal.recipeTitle);
      if (!id) continue;
      if (isCatalogRecipeId(id)) {
        for (const ing of getIngredientsForRecipe(id)) {
          const k = normalizeIngredientNameKey(ing.name);
          if (k.length > 1) keys.add(k);
        }
      } else {
        const names = dbIngredientsByRecipeId?.get(id);
        if (names?.length) {
          for (const name of names) {
            const k = normalizeIngredientNameKey(name);
            if (k.length > 1) keys.add(k);
          }
        }
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
 * Catalog + optional community recipes that are not already on the plan and share ingredients with plan recipes.
 */
export function computeSmartRecipeSuggestions(input: {
  mealPlan: DayPlan[] | null;
  titleToId: (title: string) => string | null;
  max?: number;
  /** Ingredient display names from `recipe_ingredients` keyed by recipe id. */
  dbIngredientsByRecipeId?: ReadonlyMap<string, readonly string[]>;
  /** Saved community (non-catalog) recipes to include in the suggestion pool. */
  extraRecipePool?: readonly RecipeCard[];
}): SmartSuggestion[] {
  const max = input.max ?? 6;
  const planKeys = collectPlanIngredientKeys(
    input.mealPlan,
    input.titleToId,
    input.dbIngredientsByRecipeId,
  );
  if (planKeys.size === 0) return [];

  const titlesOnPlan = new Set<string>();
  for (const d of input.mealPlan ?? []) {
    for (const m of d.meals) {
      if (!m.isPlaceholder) titlesOnPlan.add(m.recipeTitle);
    }
  }

  const out: SmartSuggestion[] = [];
  const seenIds = new Set<string>();

  const scoreRecipe = (recipe: RecipeCard, ingredientNames: readonly string[]) => {
    if (titlesOnPlan.has(recipe.title)) return;
    const shared: string[] = [];
    for (const name of ingredientNames) {
      const k = normalizeIngredientNameKey(name);
      if (k.length > 1 && planKeys.has(k)) {
        shared.push(name);
      }
    }
    if (shared.length === 0) return;
    if (seenIds.has(recipe.id)) return;
    seenIds.add(recipe.id);
    out.push({ recipe, sharedIngredients: shared.slice(0, 8), score: shared.length });
  };

  for (const recipe of RECIPE_CATALOG) {
    const ings = getIngredientsForRecipe(recipe.id).map((i) => i.name);
    scoreRecipe(recipe, ings);
  }

  const extra = input.extraRecipePool ?? [];
  for (const recipe of extra) {
    if (catalogIds.has(recipe.id)) continue;
    const fromDb = input.dbIngredientsByRecipeId?.get(recipe.id);
    if (fromDb?.length) {
      scoreRecipe(recipe, fromDb);
    }
  }

  out.sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title));
  return out.slice(0, max);
}
