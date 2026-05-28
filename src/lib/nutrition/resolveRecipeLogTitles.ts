import { normalizeRecipeTitle } from "../recipes/normalizeRecipeTitle";

/** Minimal Supabase client for a single `recipes.title` lookup. */
export type RecipeTitleLookupClient = {
  from(table: "recipes"): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{
          data: { title?: string | null } | null;
          error: unknown;
        }>;
      };
    };
  };
};

/**
 * Read the latest `recipes.title` at log time so renames in Library /
 * recipe detail apply even when the Log sheet list was cached earlier.
 */
export async function fetchCanonicalRecipeTitle(
  supabase: RecipeTitleLookupClient,
  recipeId: string | null | undefined,
): Promise<string | null> {
  const id = recipeId?.trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from("recipes")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  if (error || !data?.title?.trim()) return null;
  return normalizeRecipeTitle(data.title);
}

/**
 * Build journal `name` (meal slot) + `recipeTitle` for a recipe log row.
 * Prefers a freshly fetched DB title over any cached list label.
 */
export function resolvePlannedMealLogTitles(input: {
  slotName?: string | null;
  recipeTitle?: string | null;
  fetchedTitle?: string | null;
}): { name: string; recipeTitle: string } {
  const name = input.slotName?.trim() || "Snacks";
  const recipeTitle = normalizeRecipeTitle(
    input.fetchedTitle ?? input.recipeTitle ?? "",
  );
  return { name, recipeTitle };
}
