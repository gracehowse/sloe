/**
 * Pure composer for the Library tab's dataset. Given the raw
 * ingredients (`saves` rows, the user's authored recipes, and any
 * recipes the user has saved from Discover) this returns the ordered
 * union that backs both web `savedRecipesForLibrary` and mobile
 * `useSavedLibraryRecipes`.
 *
 * Shared rules (F-7, TestFlight `AO2jdncS2GxyJaeXPPFR30M`, 2026-04-18):
 *   - A recipe belongs in Library when it's either:
 *       (a) in `saves` (explicitly bookmarked), OR
 *       (b) authored by the current user (`authorId === userId`) —
 *           imports and created drafts are "mine by nature" and stay
 *           visible even when the user toggles the bookmark off.
 *   - `isSaved` on each output card reflects `saves` membership only.
 *     Author-owned rows that are NOT in `saves` carry `isSaved: false`
 *     so the bookmark icon on Recipe Detail remains honest.
 *   - Orphan saves (a `saves` row whose recipe no longer exists in
 *     `recipes`) drop silently — no "Unavailable" card is synthesised.
 *     See `filterOrphanSaves.ts` for the server-side cleanup path.
 *   - Ordering: saves first in save-date-desc order; then author-owned
 *     rows not already in saves, in created-date-desc order (as
 *     supplied).
 */

import type { RecipeCard } from "../../types/recipe.ts";

export type ComposeLibraryEntriesInput = {
  /** Current signed-in user id, or null if unauthed. */
  userId: string | null;
  /**
   * `saves` rows ordered by `created_at` desc. The `created_at`
   * timestamp becomes `savedAt` for ordering.
   */
  saves: ReadonlyArray<{ recipeId: string; createdAt: string | null }>;
  /**
   * Recipes authored by the current user, ordered by created_at
   * desc. Source is `recipes where author_id = userId`.
   */
  authoredRecipes: ReadonlyArray<RecipeCard>;
  /**
   * Recipes sourced from the community feed (`uploadedRecipes` on
   * web, `useDiscoverRecipes` on mobile). Lookup pool for saved
   * recipes that are not author-owned.
   */
  communityRecipes: ReadonlyArray<RecipeCard>;
};

export type LibraryEntry = RecipeCard & { savedAt: Date };

export function composeLibraryEntries(
  input: ComposeLibraryEntriesInput,
): LibraryEntry[] {
  const { userId, saves, authoredRecipes, communityRecipes } = input;
  const byId = new Map<string, LibraryEntry>();
  const saveIdSet = new Set(saves.map((s) => s.recipeId));
  const savedAtById = new Map<string, string>();
  for (const s of saves) savedAtById.set(s.recipeId, s.createdAt ?? new Date().toISOString());

  // Lookup pool — prefer authored (freshest, with sourceUrl) over
  // community (shared copy). Deduping lets us treat the two sources
  // uniformly.
  const lookup = new Map<string, RecipeCard>();
  for (const r of communityRecipes) lookup.set(r.id, r);
  for (const r of authoredRecipes) lookup.set(r.id, r);

  // 1) Explicit saves, in saves order.
  for (const s of saves) {
    const base = lookup.get(s.recipeId);
    if (!base) continue; // orphan save — drop silently (F-8).
    const savedAt = new Date(s.createdAt ?? Date.now());
    byId.set(s.recipeId, { ...base, isSaved: true, savedAt });
  }

  // 2) Author-owned recipes not already surfaced as a save, newest
  //    first. `isSaved` stays false — their bookmark state is honest.
  if (userId) {
    for (const r of authoredRecipes) {
      if (!r.authorId || r.authorId !== userId) continue;
      if (byId.has(r.id)) continue;
      const createdAt = r.feedCreatedAt;
      const savedAt =
        typeof createdAt === "string" && createdAt
          ? new Date(createdAt)
          : new Date(savedAtById.get(r.id) ?? Date.now());
      byId.set(r.id, { ...r, isSaved: saveIdSet.has(r.id), savedAt });
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => b.savedAt.getTime() - a.savedAt.getTime(),
  );
}
