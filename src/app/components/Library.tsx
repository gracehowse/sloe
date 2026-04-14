import { memo, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { useAppData } from "../../context/AppDataContext.tsx";
import { isCatalogRecipeId } from "../../lib/planning/generateShoppingList.ts";
import type { LibraryEntryKind, RecipeCard, UserTier } from "../../types/recipe.ts";
import { RecipeDetail } from "./RecipeDetail";
import { useRouter } from "next/navigation";

interface LibraryProps {
  userTier: UserTier;
  onUpgrade?: () => void;
  onGoDiscover?: () => void;
}

function entryKindForRecipe(
  recipe: RecipeCard,
  explicit: LibraryEntryKind | undefined,
  userId: string | null,
): LibraryEntryKind {
  if (explicit) return explicit;
  if (isCatalogRecipeId(recipe.id)) return "saved";
  if (recipe.creatorName === "Unavailable") return "saved";
  if (userId && recipe.authorId && recipe.authorId === userId) return "created";
  return "saved";
}

function kindBadgeClasses(kind: LibraryEntryKind): string {
  switch (kind) {
    case "created":
      return "bg-primary/10 text-primary";
    case "imported":
      return "bg-warning-soft text-warning";
    case "saved":
    default:
      return "bg-muted text-muted-foreground";
  }
}

function kindLabel(kind: LibraryEntryKind): string {
  switch (kind) {
    case "created":
      return "Your recipe";
    case "imported":
      return "Imported";
    case "saved":
    default:
      return "Saved";
  }
}

export const Library = memo(function Library({ userTier, onUpgrade, onGoDiscover }: LibraryProps) {
  const { savedRecipesForLibrary, libraryEntryKindByRecipeId, userId, duplicateRecipeToCreatedDraft } = useAppData();
  const uid = userId;
  const router = useRouter();
  const [selectedRecipe, setSelectedRecipe] = useState<(RecipeCard & { savedAt: Date }) | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | LibraryEntryKind>("all");

  const savedCount = savedRecipesForLibrary.length;

  const filteredRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = savedRecipesForLibrary;
    if (q) {
      list = list.filter(
        (r) => r.title.toLowerCase().includes(q) || r.creatorName.toLowerCase().includes(q),
      );
    }
    if (kindFilter === "all") return list;
    return list.filter(
      (r) => entryKindForRecipe(r, libraryEntryKindByRecipeId[r.id], uid) === kindFilter,
    );
  }, [savedRecipesForLibrary, searchQuery, kindFilter, libraryEntryKindByRecipeId, uid]);

  if (selectedRecipe) {
    return (
      <RecipeDetail
        recipe={selectedRecipe}
        userTier={userTier}
        onBack={() => setSelectedRecipe(null)}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">Library</h1>
          <div className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 border bg-muted text-foreground border-border">
            {savedCount} recipe{savedCount === 1 ? "" : "s"}
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3 mt-6">
          <div className="flex-1 relative group">
            <Icons.search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary shadow-sm transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {(["all", "saved", "created", "imported"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={[
                  "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                  kindFilter === k
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/60",
                ].join(" ")}
              >
                {k === "all" ? "All sources" : kindLabel(k)}
              </button>
            ))}
            <span className="hidden sm:inline-flex items-center gap-2 text-muted-foreground text-sm ml-1" aria-hidden>
              <Icons.filter className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredRecipes.length === 0 && (
        <div className="text-center py-24 max-w-md mx-auto">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Icons.search className="w-10 h-10 text-primary" />
          </div>
          <h3 className="mb-3 text-foreground">
            {savedRecipesForLibrary.length === 0 ? "Your library is empty" : "No matches"}
          </h3>
          <p className="text-muted-foreground mb-6">
            {savedRecipesForLibrary.length === 0
              ? "Save public recipes from Discover, add your own creations, or import cookbooks and links—each type is labeled here."
              : "Try another search term or switch the source filter."}
          </p>
          {savedRecipesForLibrary.length === 0 && onGoDiscover ? (
            <button
              type="button"
              onClick={onGoDiscover}
              className="px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all"
            >
              Go to Discover
            </button>
          ) : null}
        </div>
      )}

      {/* Recipe Grid */}
      {filteredRecipes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecipes.map((recipe) => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => setSelectedRecipe(recipe)}
              className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 text-left shadow-lg"
            >
              <div className="relative overflow-hidden">
                <img src={recipe.image} alt={recipe.title} className="w-full aspect-[4/3] object-cover group-hover:scale-110 transition-transform duration-500" />
                <div
                  className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-md border border-white/30 ${kindBadgeClasses(entryKindForRecipe(recipe, libraryEntryKindByRecipeId[recipe.id], uid))}`}
                >
                  {kindLabel(entryKindForRecipe(recipe, libraryEntryKindByRecipeId[recipe.id], uid))}
                </div>
                {entryKindForRecipe(recipe, libraryEntryKindByRecipeId[recipe.id], uid) !== "saved" &&
                recipe.isPublished === false ? (
                  <div className="absolute top-3 left-[6.75rem] px-2.5 py-1 rounded-lg text-xs font-semibold shadow-md border border-white/20 bg-foreground/80 text-background">
                    Draft
                  </div>
                ) : null}
                <div className="absolute top-3 right-3 px-3 py-1.5 bg-card/95 backdrop-blur-sm rounded-lg text-sm font-semibold shadow-lg text-foreground">
                  {recipe.calories} kcal
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="p-5">
                <h4 className="mb-3 text-foreground group-hover:text-primary transition-colors">{recipe.title}</h4>
                {entryKindForRecipe(recipe, libraryEntryKindByRecipeId[recipe.id], uid) === "created" &&
                recipe.isPublished === false ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const q = new URLSearchParams({ view: "create", editRecipe: recipe.id }).toString();
                      router.replace(`/?${q}`, { scroll: false });
                    }}
                    className="mb-3 inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90"
                  >
                    Go public
                  </button>
                ) : null}
                {entryKindForRecipe(recipe, libraryEntryKindByRecipeId[recipe.id], uid) === "imported" ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void (async () => {
                        const newId = await duplicateRecipeToCreatedDraft(recipe.id);
                        if (!newId) return;
                        const q = new URLSearchParams({ view: "create", editRecipe: newId }).toString();
                        router.replace(`/?${q}`, { scroll: false });
                      })();
                    }}
                    className="mb-3 inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-warning text-background text-xs font-semibold hover:opacity-90"
                  >
                    Create your own version
                  </button>
                ) : null}
                <div className="flex items-center gap-2 mb-4">
                  <img
                    src={recipe.creatorImage}
                    alt={recipe.creatorName}
                    className="w-6 h-6 rounded-full object-cover ring-2 ring-border/50"
                  />
                  <span className="text-sm text-muted-foreground font-medium">{recipe.creatorName}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="px-2 py-1 bg-muted rounded text-foreground font-medium">P: {recipe.protein}g</span>
                  <span className="px-2 py-1 bg-muted rounded text-foreground font-medium">C: {recipe.carbs}g</span>
                  <span className="px-2 py-1 bg-muted rounded text-foreground font-medium">F: {recipe.fat}g</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
