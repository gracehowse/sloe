import { useState } from "react";
import { useRecipeLibraryData } from "../../../context/appData/selectors.ts";

/**
 * ENG-1126 — user-created recipe collections pill row. Extracted from
 * `Library.tsx` (already at the 400-line-cap pin) rather than inlined.
 * Matches the existing category/provenance pill grammar exactly (selected =
 * bg-primary-soft + primary-solid label + font-semibold, unselected = quiet
 * bg-card + muted, no border — ENG-1022 chip grammar).
 *
 * Orthogonal to category/entry-kind filtering — layers on top, doesn't
 * replace it. Pro-gating on collection creation is an explicitly deferred
 * decision (ENG-1126's own dependency note); collection creation is open
 * to all tiers for now.
 */
export function LibraryCollectionsBar({
  selectedCollectionId,
  onSelectCollection,
}: {
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
}) {
  const { recipeCollections, createCollection } = useRecipeLibraryData();
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");

  const submitNewCollection = async () => {
    const name = draftName.trim();
    if (!name) {
      setCreating(false);
      setDraftName("");
      return;
    }
    const ok = await createCollection(name);
    if (ok) {
      setDraftName("");
      setCreating(false);
    }
  };

  if (recipeCollections.length === 0 && !creating) {
    return (
      <div className="flex items-center">
        <button
          type="button"
          data-testid="library-new-collection"
          onClick={() => setCreating(true)}
          className="shrink-0 inline-flex items-center px-4 py-2 min-h-8 rounded-full text-[13px] transition-all whitespace-nowrap bg-card text-muted-foreground font-medium hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label="Create a collection"
        >
          + New collection
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="library-collection-pills"
      className="flex flex-nowrap md:flex-wrap gap-2 items-center overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        data-testid="library-collection-all"
        onClick={() => onSelectCollection(null)}
        className={[
          "shrink-0 inline-flex items-center px-4 py-2 min-h-8 rounded-full text-[13px] transition-all whitespace-nowrap",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          selectedCollectionId === null
            ? "bg-primary-soft text-primary-solid font-semibold"
            : "bg-card text-muted-foreground font-medium hover:bg-muted/60",
        ].join(" ")}
        aria-pressed={selectedCollectionId === null}
        aria-label="All collections"
      >
        All
      </button>
      {recipeCollections.map((c) => {
        const active = selectedCollectionId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            data-testid={`library-collection-${c.id}`}
            onClick={() => onSelectCollection(active ? null : c.id)}
            className={[
              "shrink-0 inline-flex items-center px-4 py-2 min-h-8 rounded-full text-[13px] transition-all whitespace-nowrap",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              active
                ? "bg-primary-soft text-primary-solid font-semibold"
                : "bg-card text-muted-foreground font-medium hover:bg-muted/60",
            ].join(" ")}
            aria-pressed={active}
            aria-label={`Collection: ${c.name}`}
          >
            {c.name}
          </button>
        );
      })}
      {creating ? (
        <input
          autoFocus
          data-testid="library-new-collection-input"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={submitNewCollection}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submitNewCollection();
            if (e.key === "Escape") {
              setCreating(false);
              setDraftName("");
            }
          }}
          placeholder="Collection name"
          aria-label="New collection name"
          className="shrink-0 px-4 py-2 min-h-8 rounded-full text-[13px] bg-card border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary w-40"
        />
      ) : (
        <button
          type="button"
          data-testid="library-new-collection"
          onClick={() => setCreating(true)}
          className="shrink-0 inline-flex items-center px-4 py-2 min-h-8 rounded-full text-[13px] transition-all whitespace-nowrap bg-card text-muted-foreground font-medium hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label="Create a collection"
        >
          + New
        </button>
      )}
    </div>
  );
}
