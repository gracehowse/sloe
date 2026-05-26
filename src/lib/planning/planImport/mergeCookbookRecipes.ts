import type { PlanImportParsedRecipe } from "./types";

/** Merge recipe lists from chunked parses; later chunks do not overwrite existing keys. */
export function mergeCookbookRecipes(
  batches: PlanImportParsedRecipe[][],
): PlanImportParsedRecipe[] {
  const byKey = new Map<string, PlanImportParsedRecipe>();
  for (const batch of batches) {
    for (const recipe of batch) {
      if (!byKey.has(recipe.key)) {
        byKey.set(recipe.key, recipe);
      }
    }
  }
  return [...byKey.values()];
}
