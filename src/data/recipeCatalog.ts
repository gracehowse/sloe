import type { IngredientRow, RecipeCard } from "../types/recipe.ts";

/** In-app catalog fallback (empty — recipes load from Supabase). */
export const RECIPE_CATALOG: RecipeCard[] = [];

const INGREDIENTS: Record<string, IngredientRow[]> = {};

const INSTRUCTIONS: Record<string, string[]> = {};

export function getRecipeById(id: string): RecipeCard | undefined {
  return RECIPE_CATALOG.find((r) => r.id === id);
}

export function getIngredientsForRecipe(recipeId: string): IngredientRow[] {
  return INGREDIENTS[recipeId] ?? [];
}

export function getInstructionsForRecipe(recipeId: string): string[] {
  return INSTRUCTIONS[recipeId] ?? [];
}
