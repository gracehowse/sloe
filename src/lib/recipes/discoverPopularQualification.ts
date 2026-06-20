import { DISCOVER_POPULAR_MIN_SAVES } from "./fetchPublicRecipeSaveCounts";
import { isSeedRecipeId } from "./seedRecipesV2";

/** Minimal recipe shape for Discover "Popular"/"Trending" gating. */
export type DiscoverPopularCandidate = {
  id: string;
  saves?: number | null;
  savedCount?: number | null;
  feedSource?: string | null;
};

/**
 * Whether a Discover card qualifies for the "Popular"/"Trending" pill.
 *
 * Community uploads need ≥ `DISCOVER_POPULAR_MIN_SAVES` global saves.
 * Curated catalog seeds (`feedSource: "catalog"` / `seed-v2-*` ids) are
 * editorial — always visible regardless of save count (ENG-1202).
 */
export function discoverQualifiesAsPopular(recipe: DiscoverPopularCandidate): boolean {
  if (recipe.feedSource === "catalog" || isSeedRecipeId(recipe.id)) return true;
  const saves = recipe.saves ?? recipe.savedCount ?? 0;
  return saves >= DISCOVER_POPULAR_MIN_SAVES;
}
