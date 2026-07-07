import { useState } from "react";
import { Icons } from "../ui/icons";
import { useRecipeLibraryData } from "../../../context/appData/selectors.ts";

/**
 * ENG-1126 — per-card "add to collection" affordance. Extracted from
 * `Library.tsx` (already at the 400-line-cap pin). A recipe can belong to
 * multiple collections at once — this is a checklist, not a radio.
 */
export function AddToCollectionMenu({ recipeId, recipeTitle }: { recipeId: string; recipeTitle: string }) {
  const { recipeCollections, collectionMembershipByRecipeId, addRecipeToCollection, removeRecipeFromCollection } =
    useRecipeLibraryData();
  const [open, setOpen] = useState(false);
  const memberOf = collectionMembershipByRecipeId[recipeId] ?? [];

  if (recipeCollections.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        data-testid={`library-add-to-collection-${recipeId}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="absolute top-2.5 left-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm grid place-items-center shadow-md ring-1 ring-black/5 hover:bg-white transition-colors"
        aria-expanded={open}
        aria-label={`Add ${recipeTitle} to a collection`}
      >
        <Icons.addToCollection className="w-[15px] h-[15px] text-foreground/60" />
      </button>
      {open ? (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-11 left-2.5 z-10 w-48 rounded-lg border border-border bg-card shadow-lg py-1"
        >
          {recipeCollections.map((c) => {
            const checked = memberOf.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void (checked
                    ? removeRecipeFromCollection(c.id, recipeId)
                    : addRecipeToCollection(c.id, recipeId));
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-muted/60"
              >
                <span
                  className={[
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                    checked ? "bg-primary border-primary" : "border-border",
                  ].join(" ")}
                >
                  {checked ? <Icons.check className="w-3 h-3 text-primary-foreground" /> : null}
                </span>
                <span className="truncate">{c.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
