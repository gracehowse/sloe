/**
 * ENG-1276 — load a recipe's ingredient rows with a graceful fallback for the
 * staged `matched_alias_key` column. On a DB where the migration
 * (20260702130200) has not landed, the primary select fails with 42703; we
 * retry with the pre-ENG-1276 column set (no alias fallback) rather than
 * failing the whole ingredient load. Shared so the web recipe-detail load
 * stays thin (screen-budget ratchet) and web/mobile keep the same retry rule.
 *
 * `supabase` is typed loosely (browser or RN client) — see `ingredientImages`.
 */

type LooseIngredientQuery = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: unknown[] | null; error: unknown }>;
      };
    };
  };
};

export interface LoadRecipeIngredientRowsResult {
  data: unknown[] | null;
  error: unknown;
}

/**
 * Select the given base columns plus `matched_alias_key`, retrying without the
 * alias column if it is missing. `baseColumns` is the comma-separated pre-
 * ENG-1276 projection (each caller keeps its own so no columns are dropped).
 */
export async function loadRecipeIngredientRows(
  supabase: unknown,
  recipeId: string,
  baseColumns: string,
): Promise<LoadRecipeIngredientRowsResult> {
  const client = supabase as LooseIngredientQuery;
  const run = (cols: string) =>
    client
      .from("recipe_ingredients")
      .select(cols)
      .eq("recipe_id", recipeId)
      .order("created_at", { ascending: true });

  const first = await run(`${baseColumns}, matched_alias_key`);
  const err = first.error as { code?: string; message?: string } | null;
  const aliasColumnMissing =
    !!err &&
    (err.code === "42703" ||
      err.code === "PGRST204" ||
      (err.message ?? "").includes("matched_alias_key"));
  if (aliasColumnMissing) {
    return run(baseColumns);
  }
  return first;
}
