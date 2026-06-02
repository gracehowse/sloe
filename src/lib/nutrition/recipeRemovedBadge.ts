/**
 * ENG-766 — shared gate for the planner "Recipe removed" badge.
 *
 * `meal_plans.plan` is JSONB with no FK to `recipes.id`, so a plan row's
 * `recipeId` can outlive the recipe (deleted from the library). The badge
 * tells the user that, so they can swap/remove the slot.
 *
 * The bug it fixes: the badge condition is just `!knownRecipeIds.has(id)`.
 * `knownRecipeIds` is built from the recipe library, which hydrates
 * asynchronously AFTER the plan loads — so during that window every row
 * (recipeId not yet in the set) flashed "Recipe removed" + an imageless
 * card before the library arrived. Gate the badge on the library actually
 * being loaded so it only ever marks a genuinely-removed recipe.
 *
 * Shared so web (`MealPlanner.tsx`) and mobile (`planner.tsx`) can't drift.
 * Each platform supplies `libraryLoaded` from its best available signal:
 *   - mobile: the recipe hooks' `loading` flags (`!discoverLoading && !savedLoading`)
 *   - web: `knownRecipeIds.size > 0` (AppDataContext exposes no loading flag;
 *     a non-empty set means the library has hydrated)
 */
export function shouldShowRecipeRemovedBadge(params: {
  /** Row has a chosen recipe (not a placeholder/empty slot). */
  hasRecipe: boolean;
  /** The row's baked recipe id. */
  recipeId: string | null | undefined;
  /** Ids known to the current session (discover seed + saved library). */
  knownRecipeIds: ReadonlySet<string>;
  /** Whether the recipe library has finished loading on this platform. */
  libraryLoaded: boolean;
}): boolean {
  const { hasRecipe, recipeId, knownRecipeIds, libraryLoaded } = params;
  // Never during hydration — that's the flash we're killing.
  if (!libraryLoaded) return false;
  // Placeholder rows (no recipe) intentionally stay silent.
  if (!hasRecipe || !recipeId) return false;
  return !knownRecipeIds.has(recipeId);
}
