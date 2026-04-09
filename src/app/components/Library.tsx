import { useMemo, useState } from "react";
import { Search, Filter } from "lucide-react";
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
      return "bg-violet-100 dark:bg-violet-950/50 text-violet-800 dark:text-violet-200";
    case "imported":
      return "bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200";
    case "saved":
    default:
      return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
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

export function Library({ userTier, onUpgrade, onGoDiscover }: LibraryProps) {
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
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">Library</h1>
          <div className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 border bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700">
            {savedCount} recipe{savedCount === 1 ? "" : "s"}
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3 mt-6">
          <div className="flex-1 relative group">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-600 transition-colors" />
            <input
              type="text"
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 shadow-sm transition-all"
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
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-800 dark:text-violet-200"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                ].join(" ")}
              >
                {k === "all" ? "All sources" : kindLabel(k)}
              </button>
            ))}
            <span className="hidden sm:inline-flex items-center gap-2 text-slate-400 text-sm ml-1" aria-hidden>
              <Filter className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredRecipes.length === 0 && (
        <div className="text-center py-24 max-w-md mx-auto">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/40 dark:to-indigo-950/40 flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-violet-500 dark:text-violet-400" />
          </div>
          <h3 className="mb-3 text-slate-900 dark:text-white">
            {savedRecipesForLibrary.length === 0 ? "Your library is empty" : "No matches"}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {savedRecipesForLibrary.length === 0
              ? "Save public recipes from Discover, add your own creations, or import cookbooks and links—each type is labeled here."
              : "Try another search term or switch the source filter."}
          </p>
          {savedRecipesForLibrary.length === 0 && onGoDiscover ? (
            <button
              type="button"
              onClick={onGoDiscover}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:shadow-lg hover:shadow-violet-500/25 transition-all"
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
              className="group backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl overflow-hidden hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 text-left shadow-lg"
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
                  <div className="absolute top-3 left-[6.75rem] px-2.5 py-1 rounded-lg text-xs font-semibold shadow-md border border-white/20 bg-slate-900/80 text-white">
                    Draft
                  </div>
                ) : null}
                <div className="absolute top-3 right-3 px-3 py-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-lg text-sm font-semibold shadow-lg">
                  {recipe.calories} kcal
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="p-5">
                <h4 className="mb-3 text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{recipe.title}</h4>
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
                    className="mb-3 inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:opacity-90"
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
                    className="mb-3 inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:opacity-90"
                  >
                    Create your own version
                  </button>
                ) : null}
                <div className="flex items-center gap-2 mb-4">
                  <img
                    src={recipe.creatorImage}
                    alt={recipe.creatorName}
                    className="w-6 h-6 rounded-full object-cover ring-2 ring-slate-200/50 dark:ring-slate-700/50"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{recipe.creatorName}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-medium">P: {recipe.protein}g</span>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-medium">C: {recipe.carbs}g</span>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-medium">F: {recipe.fat}g</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
