"use client";

import * as React from "react";

import type { RecipeCard } from "../../../types/recipe";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import {
  CURATED_COLLECTIONS,
  collectionRecipeCount,
} from "../../../lib/discover/curatedCollections";
import type { RecipeCategoryId } from "../../../lib/recipes/recipeCategoryFilters";

/**
 * DiscoverCollections — the Sloe v3 Discover "Collections" tiles (ENG-1225
 * Block 6), WEB twin of `apps/mobile/components/discover/DiscoverCollections.tsx`
 * (prototype `.w-collections`, Sloe-App.html L7565). Gradient tiles that
 * DEEP-LINK into the existing category pills (click → applies the filter), so
 * there's no new curation table and no empty-at-launch problem. Self-gating on
 * `sloe_v3_discover_editorial` + ≥1 non-empty tile; counts are live
 * (`collectionRecipeCount`), never fabricated. Shares the tile defs with mobile.
 */
export interface DiscoverCollectionsProps {
  /** The Discover feed recipes (for live per-tile counts). */
  recipes: RecipeCard[];
  /** Apply a collection's category-pill filter. */
  onSelectCategory: (categoryId: RecipeCategoryId) => void;
}

export function DiscoverCollections({
  recipes,
  onSelectCategory,
}: DiscoverCollectionsProps) {
  const enabled = isFeatureEnabled("sloe_v3_discover_editorial");
  const tiles = React.useMemo(
    () =>
      CURATED_COLLECTIONS.map((c) => ({
        ...c,
        count: collectionRecipeCount(c, recipes),
      })).filter((c) => c.count > 0),
    [recipes],
  );
  if (!enabled || tiles.length === 0) return null;

  return (
    // ENG-1503 — standard mobile page inset, matching DiscoverQuickWeeknight
    // and the sibling cluster sections (the host has no `< md` padding).
    <section className="mt-6 px-4 md:px-0">
      <h2 className="mb-2 font-[family-name:var(--font-headline)] text-[18px] font-medium leading-[22px] text-foreground">
        Collections
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelectCategory(c.categoryId)}
            aria-label={`${c.label}, ${c.count} recipe${c.count === 1 ? "" : "s"}`}
            className="group flex aspect-[1.4] flex-col justify-end overflow-hidden rounded-card-lg p-3 text-left transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            style={{ backgroundImage: `linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]})` }}
          >
            <span className="line-clamp-2 font-[family-name:var(--font-headline)] text-[15px] leading-[19px] text-white">
              {c.label}
            </span>
            <span className="mt-0.5 text-[11px] text-white/80">
              {c.count} recipe{c.count === 1 ? "" : "s"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default DiscoverCollections;
