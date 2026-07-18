"use client";

import * as React from "react";

import { deriveLibraryComposition } from "@/lib/recipes/libraryShelves";
import type { RecipeCard } from "@/types/recipe";
import { FeaturedHero } from "./FeaturedHero";
import { EditorialShelf } from "./EditorialShelf";

/**
 * LibraryShelvesHeader — the Sloe v3 Cookbook editorial header (ENG-1225 Block 5).
 *
 * WEB parity twin of `apps/mobile/components/library/LibraryShelvesHeader.tsx`:
 * a "Tonight's pick" hero + the Fits-your-day / Quick / High-protein shelves
 * derived from the filtered library, shown above the grid ONLY on the All
 * filter. Self-gating so the host (Library.tsx) just drops it above its grid.
 * Tonight's pick = the first "fits your day" recipe (else the first card).
 *
 * The mobile twin reads its shelves from the shared `useLibraryShelves` hook; on
 * web the same memoized `deriveLibraryShelves` derivation is inlined here (per
 * the v3 spec — no separate web hook), so the threshold/cap/copy logic stays
 * single-sourced in `@/lib/recipes/libraryShelves`.
 */
export interface LibraryShelvesHeaderProps {
  /** The already-filtered library list. */
  filtered: RecipeCard[];
  /** Active category id — shelves show only when this is "all". */
  category: string;
  onPressRecipe: (recipe: RecipeCard) => void;
  sparseMediaEnabled?: boolean;
}

export function LibraryShelvesHeader({
  filtered,
  category,
  onPressRecipe,
  sparseMediaEnabled = false,
}: LibraryShelvesHeaderProps) {
  const composition = React.useMemo(
    () => deriveLibraryComposition(filtered, sparseMediaEnabled),
    [filtered, sparseMediaEnabled],
  );
  if (category !== "all") return null;
  const { featured, shelves } = composition;
  return (
    <>
      {featured ? (
        <FeaturedHero
          recipe={featured}
          onPress={() => onPressRecipe(featured)}
        />
      ) : null}
      {shelves.map((sh) => (
        <EditorialShelf
          key={sh.key}
          title={sh.title}
          subtitle={sh.subtitle}
          recipes={sh.recipes}
          onPressRecipe={onPressRecipe}
        />
      ))}
    </>
  );
}

export default LibraryShelvesHeader;
