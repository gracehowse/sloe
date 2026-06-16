import { supabase } from "@/lib/supabase";
import {
  saveImportedRecipe as persistSaveImportedRecipe,
  updateImportedRecipe as persistUpdateImportedRecipe,
  type ApiImportedRecipe,
  coercePositiveMinutes,
} from "@suppr/shared/recipes/persistImportedRecipe";

export type { ApiImportedRecipe };
export { coercePositiveMinutes };

export async function saveImportedRecipe(
  userId: string,
  recipe: ApiImportedRecipe,
): Promise<{ recipeId: string } | { error: string }> {
  return persistSaveImportedRecipe(supabase, userId, recipe);
}

export async function updateImportedRecipe(
  userId: string,
  recipeId: string,
  recipe: ApiImportedRecipe,
): Promise<{ recipeId: string } | { error: string }> {
  return persistUpdateImportedRecipe(supabase, userId, recipeId, recipe);
}
