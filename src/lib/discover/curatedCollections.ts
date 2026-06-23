/**
 * Discover "Collections" tiles (Sloe v3 Block 6, ENG-1225).
 *
 * Editorial collection tiles that DEEP-LINK into the existing Discover category
 * pills (`recipeCategoryFilters`) — tapping a tile applies the matching filter,
 * so there's no new curation table and no empty-at-launch problem (decision:
 * `docs/decisions/2026-06-23-block6-discover-reconciliation.md`). Counts are
 * computed live from the feed, never fabricated. Labels are honest to the filter
 * they apply (the prototype's "Under 20 minutes" maps to the Quick-30 ≤30-min
 * pill, so it's relabelled "Under 30 minutes").
 *
 * The gradient hexes are bespoke tile colours from the prototype (`Sloe-App.html`
 * L7566). Like `creatorChipPresentation`, mobile can't read web CSS custom
 * properties, so these literals live in shared JS — the documented carve-out the
 * UI-write discipline allows for cross-platform colour. Behind the
 * `sloe_v3_discover_editorial` flag at the call site.
 */
/* eslint-disable no-restricted-syntax -- canonical cross-platform collection-gradient source; see header. */
import {
  matchesRecipeCategory,
  type RecipeCategoryId,
  type RecipeCategoryRecipe,
} from "../recipes/recipeCategoryFilters";

export interface CuratedCollection {
  id: string;
  /** Tile copy — honest to the filter it applies. */
  label: string;
  /** The category pill this tile deep-links into. */
  categoryId: RecipeCategoryId;
  /** Tile gradient [from, to] (prototype `Sloe-App.html` L7566). */
  gradient: readonly [string, string];
}

/**
 * The two v3 collection tiles that map cleanly onto existing category pills.
 * (The prototype's "Batch & freeze" / "Bright & fresh" have no live predicate
 * and are cut for v1 — see the reconciliation decision doc.)
 */
export const CURATED_COLLECTIONS: readonly CuratedCollection[] = [
  {
    id: "high-protein",
    label: "High-protein dinners",
    categoryId: "high-protein",
    gradient: ["#5a3f74", "#3b2a4d"],
  },
  {
    id: "under-30",
    label: "Under 30 minutes",
    categoryId: "quick",
    gradient: ["#b06a42", "#73422a"],
  },
];

/** Live count of feed recipes that match a collection's category pill. */
export function collectionRecipeCount(
  collection: CuratedCollection,
  recipes: readonly RecipeCategoryRecipe[],
): number {
  return recipes.filter((r) => matchesRecipeCategory(collection.categoryId, r)).length;
}
