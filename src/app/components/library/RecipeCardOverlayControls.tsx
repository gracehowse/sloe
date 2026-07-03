import { Icons } from "../ui/icons";
import { AddToCollectionMenu } from "./AddToCollectionMenu.tsx";
import type { LibraryEntryKind, RecipeCard, UserTier } from "../../../types/recipe.ts";

/**
 * Recipe-card overlay controls — bookmark (top-right) + either the Draft
 * badge or the ENG-1126 "add to collection" menu (top-left, mutually
 * exclusive slot). Extracted from `Library.tsx` (already at its 400-line-cap
 * pin) so the card-grid render stays legible as this cluster grows.
 */
export function RecipeCardOverlayControls({
  recipe,
  kind,
  userTier,
  toggleSaveRecipe,
  collectionsEnabled,
}: {
  recipe: RecipeCard & { savedAt: Date; isSaved: boolean; isPublished?: boolean };
  kind: LibraryEntryKind;
  userTier: UserTier;
  toggleSaveRecipe: (recipeId: string, tier: UserTier, kind?: LibraryEntryKind) => boolean;
  collectionsEnabled: boolean;
}) {
  return (
    <>
      {/* Bookmark overlay — circular translucent, top-right. Filled clay
          when saved; outline when not (e.g. an imported recipe you
          authored but un-saved — bookmark stays honest per
          composeLibraryEntries F-7). Tapping toggles the save without
          opening the recipe. */}
      <button
        type="button"
        data-testid={`library-bookmark-${recipe.id}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleSaveRecipe(recipe.id, userTier, kind);
        }}
        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm grid place-items-center shadow-md ring-1 ring-black/5 hover:bg-white transition-colors"
        aria-pressed={recipe.isSaved}
        aria-label={recipe.isSaved ? `Saved: ${recipe.title}. Tap to remove` : `Save ${recipe.title}`}
      >
        {recipe.isSaved ? (
          <Icons.saved className="w-[15px] h-[15px] text-primary" />
        ) : (
          <Icons.save className="w-[15px] h-[15px] text-foreground/60" />
        )}
      </button>
      {kind !== "saved" && recipe.isPublished === false ? (
        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold shadow-sm bg-foreground/80 text-background">
          Draft
        </div>
      ) : collectionsEnabled ? (
        <AddToCollectionMenu recipeId={recipe.id} recipeTitle={recipe.title} />
      ) : null}
    </>
  );
}
