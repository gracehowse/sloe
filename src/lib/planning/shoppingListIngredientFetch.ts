/**
 * Resolve ingredients for shopping-list generation across UUID recipes
 * (DB `recipe_ingredients`) and Discover seed catalogue ids (`seed-v2-*`).
 *
 * Passing seed slugs into `.in("recipe_id", …)` throws Postgres
 * `invalid input syntax for type uuid` — ENG-1668 follow-up (Grace sim
 * 2026-07-22 on Mediterranean tomato butter bean orzo).
 *
 * Only `seed-v2-*` ids are diverted to the in-app catalogue. All other
 * ids (real UUIDs, and test/fake clients that ignore filters) still hit
 * the DB query path.
 */
import { isSeedRecipeId, findSeedRecipeById } from "../recipes/seedRecipesV2";
import type { RecipeIngredientRow } from "./generateShoppingList";

/**
 * Minimal thenable query client — real SupabaseClient or the regenerate
 * test duck. Kept intentionally shallow to avoid Supabase generic depth.
 */
export type ShoppingListIngredientClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type ShoppingListIngredientFetchResult = {
  ingredientsByRecipeId: Map<string, RecipeIngredientRow[]>;
  /** Non-null when the DB batch query failed. Seed rows still populate. */
  error: string | null;
};

function seedIngredientsAsRows(recipeId: string): RecipeIngredientRow[] | null {
  const seed = findSeedRecipeById(recipeId);
  if (!seed) return null;
  return seed.ingredients.map((ing) => ({
    name: ing.name,
    amount: String(ing.grams),
    unit: "g",
  }));
}

/**
 * Batch-load ingredients for a mixed set of recipe ids. Safe to call with
 * empty input. `seed-v2-*` ids never hit Postgres.
 */
export async function fetchShoppingListIngredientsByRecipeId(
  client: ShoppingListIngredientClient,
  recipeIds: readonly string[],
): Promise<ShoppingListIngredientFetchResult> {
  const ingredientsByRecipeId = new Map<string, RecipeIngredientRow[]>();
  const unique = [...new Set(recipeIds.filter(Boolean))];
  if (unique.length === 0) {
    return { ingredientsByRecipeId, error: null };
  }

  const dbIds: string[] = [];
  for (const id of unique) {
    if (isSeedRecipeId(id)) {
      const rows = seedIngredientsAsRows(id);
      if (rows) ingredientsByRecipeId.set(id, rows);
      continue;
    }
    dbIds.push(id);
  }

  if (dbIds.length === 0) {
    return { ingredientsByRecipeId, error: null };
  }

  const { data, error } = await client
    .from("recipe_ingredients")
    .select("recipe_id, name, amount, unit")
    .in("recipe_id", dbIds);

  if (error) {
    return {
      ingredientsByRecipeId,
      error: error.message || "Could not load ingredients",
    };
  }

  for (const row of data ?? []) {
    const rid = String((row as { recipe_id?: string | null }).recipe_id ?? "");
    if (!rid) continue;
    const bucket = ingredientsByRecipeId.get(rid) ?? [];
    const amount = (row as { amount?: number | string | null }).amount;
    bucket.push({
      name: String((row as { name?: string | null }).name ?? ""),
      amount: amount != null && amount !== "" ? String(amount) : "",
      unit: String((row as { unit?: string | null }).unit ?? ""),
    });
    ingredientsByRecipeId.set(rid, bucket);
  }

  return { ingredientsByRecipeId, error: null };
}
