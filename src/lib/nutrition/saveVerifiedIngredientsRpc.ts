/**
 * ENG-1108 — web callers for the atomic `save_verified_ingredients` RPC
 * (mirrors `apps/mobile/lib/verifyRecipe.ts:saveVerifiedIngredients`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type SaveVerifiedIngredientRow = {
  id: string;
  name: string;
  amount?: string | number | null;
  unit?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  caffeine_mg?: number;
  alcohol_g?: number;
  is_verified: boolean;
  source?: string | null;
  confidence?: number | null;
  override_macros?: unknown;
  added_by_user?: boolean;
};

export type SaveVerifiedRecipeUpdate = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  caffeine_mg?: number;
  alcohol_g?: number;
  allergens?: unknown;
};

export async function saveVerifiedIngredientsRpc(
  supabase: SupabaseClient,
  recipeId: string,
  recipeUpdate: SaveVerifiedRecipeUpdate,
  ingredientUpdates: SaveVerifiedIngredientRow[],
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.rpc("save_verified_ingredients", {
    p_recipe_id: recipeId,
    p_recipe_update: recipeUpdate,
    p_ingredient_updates: ingredientUpdates,
  });
  if (error) return { error: error.message };
  return { ok: true };
}
