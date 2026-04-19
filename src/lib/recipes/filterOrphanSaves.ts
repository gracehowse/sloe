/**
 * Pure helper for filtering out orphan `saves` rows — save rows that
 * reference a `recipes.id` that no longer exists (the recipe was
 * deleted or was never persisted to the DB).
 *
 * Background (F-8, TestFlight `AAHS7CjeXNC-mwzyLgWFuKQ`, 2026-04-18):
 * testers reported Library / Discover showing "recipes that don't
 * exist". Root cause was two-fold on web:
 *   1. `saves.recipe_id` is not a FK cascade in some historical
 *      projects — deleting a recipe leaves its save row behind.
 *   2. The old `savedRecipeMetaById` fallback branch in
 *      `savedRecipesForLibrary` rendered a synthetic "Unavailable"
 *      card for those orphan rows, which looked broken.
 *
 * This helper is split out so it's:
 *   - unit-testable without a Supabase client (see
 *     `tests/unit/discoverOrphanFilter.test.ts`),
 *   - reusable by mobile later if we add the same wire-up, and
 *   - shared with the "narrow filter" path (validIds is the intersection
 *     of save IDs and existing recipe IDs).
 *
 * Note: this does NOT cover the "all seed IDs have been deleted → fall
 * back to recent published recipes" case described in F-8. The current
 * Discover feed queries `recipes` live (`refreshDiscoverRecipes` and
 * mobile `useDiscoverRecipes`), so deleted rows simply don't come back
 * and the feed already falls back to whatever is still published. No
 * orphan-ID seed list exists to narrow.
 */

export type FilterOrphanSavesResult = {
  /** Save IDs that correspond to a live recipe row — safe to render. */
  validIds: string[];
  /** Save IDs whose recipe has been deleted — should be cleaned up. */
  orphanIds: string[];
};

/**
 * @param saveIds      all `recipe_id`s from the `saves` table
 * @param liveRecipeIds `id`s of recipes that currently exist in `recipes`
 *                     (author_id is not null, i.e. not tombstoned / anonymised)
 */
export function filterOrphanSaves(
  saveIds: readonly string[],
  liveRecipeIds: readonly string[],
): FilterOrphanSavesResult {
  const live = new Set(liveRecipeIds);
  const validIds: string[] = [];
  const orphanIds: string[] = [];
  for (const id of saveIds) {
    if (live.has(id)) validIds.push(id);
    else orphanIds.push(id);
  }
  return { validIds, orphanIds };
}
