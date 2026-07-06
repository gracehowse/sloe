import { useLibraryShelves } from "@/hooks/useLibraryShelves";
import type { RecipeCard } from "@/lib/types";
import { FeaturedHero } from "./FeaturedHero";
import { EditorialShelf } from "./EditorialShelf";

/**
 * LibraryShelvesHeader — the Sloe v3 Cookbook editorial header (ENG-1225 Block
 * 5): a "Tonight's pick" hero + the Fits-your-day / Quick / High-protein shelves
 * derived from the filtered library, shown above the grid ONLY on the All
 * filter. Self-gating so the pinned `library.tsx` just drops it into its
 * FlatList ListHeader. Tonight's pick = the first "fits your day" recipe
 * (else the first card).
 */
export interface LibraryShelvesHeaderProps {
  /** The already-filtered library list. */
  filtered: RecipeCard[];
  /** Active category id — shelves show only when this is "all". */
  category: string;
  onPressRecipe: (recipe: RecipeCard) => void;
}

export function LibraryShelvesHeader({
  filtered,
  category,
  onPressRecipe,
}: LibraryShelvesHeaderProps) {
  const shelves = useLibraryShelves(filtered);
  if (category !== "all") return null;
  const featured = shelves[0]?.recipes[0] ?? filtered[0] ?? null;
  return (
    <>
      {featured ? (
        <FeaturedHero recipe={featured} onPress={() => onPressRecipe(featured)} />
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
