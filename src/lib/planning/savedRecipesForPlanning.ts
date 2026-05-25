import { SEED_RECIPES_V2 } from "../recipes/seedRecipesV2.ts";
import { seedsToRecipeCards } from "../recipes/seedRecipesToCard.ts";
import type { RecipeCard } from "../../types/recipe.ts";

/**
 * Resolve saved recipe ids into full `RecipeCard` rows for plan generation.
 * Web must match mobile: pool = library saves + discover seeds + community uploads.
 * Pre-fix web only searched `uploadedRecipes`, so user-authored and seed saves
 * produced empty or tiny plans.
 */
export function savedRecipesForPlanning(input: {
  savedRecipeIds: readonly string[];
  myLibraryRecipes: readonly RecipeCard[];
  uploadedRecipes: readonly RecipeCard[];
}): RecipeCard[] {
  const byId = new Map<string, RecipeCard>();
  const seeds = seedsToRecipeCards(SEED_RECIPES_V2) as unknown as RecipeCard[];
  for (const r of [...seeds, ...input.uploadedRecipes, ...input.myLibraryRecipes]) {
    byId.set(r.id, r);
  }
  const out: RecipeCard[] = [];
  const seen = new Set<string>();
  for (const id of input.savedRecipeIds) {
    const card = byId.get(id);
    if (!card || seen.has(id)) continue;
    seen.add(id);
    out.push(card);
  }
  return out;
}
