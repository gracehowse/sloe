import { useEffect, useMemo, useState } from "react";
import { Heart, Bookmark, CheckCircle2, AlertCircle, Search, SlidersHorizontal, X, Share2, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import type { UserTier } from "../../types/recipe.ts";
import { RecipeDetail } from "./RecipeDetail";
import type { RecipeCard } from "../../types/recipe.ts";

const COLLECTIONS_KEY = "platemate-collections-v1";

type CollectionRow = { id: string; name: string; recipeIds: string[] };

function loadCollections(): CollectionRow[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CollectionRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCollections(rows: CollectionRow[]) {
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(rows));
}

interface DiscoverFeedProps {
  userTier: UserTier;
  /** Open a recipe when landing with `?recipe=` (share link). */
  initialOpenRecipeId?: string | null;
  onConsumedDeepLinkRecipe?: () => void;
}

function formatFeedTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const now = Date.now();
  const diffMs = now - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function DiscoverFeed({
  userTier,
  initialOpenRecipeId,
  onConsumedDeepLinkRecipe,
}: DiscoverFeedProps) {
  const { discoverRecipes, toggleSaveRecipe } = useAppData();
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeCard | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    verified: false,
    maxCalories: "",
    minProtein: "",
  });
  const [collections, setCollections] = useState<CollectionRow[]>(() => loadCollections());
  const [newCollectionName, setNewCollectionName] = useState("");
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  useEffect(() => {
    saveCollections(collections);
  }, [collections]);

  useEffect(() => {
    if (!initialOpenRecipeId || !onConsumedDeepLinkRecipe) return;
    const r = discoverRecipes.find((x) => x.id === initialOpenRecipeId);
    if (r) {
      setSelectedRecipe(r);
      onConsumedDeepLinkRecipe();
      return;
    }
    if (discoverRecipes.length > 0) {
      onConsumedDeepLinkRecipe();
    }
  }, [initialOpenRecipeId, discoverRecipes, onConsumedDeepLinkRecipe]);

  const addToCollection = (recipeId: string, collectionId: string) => {
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId && !c.recipeIds.includes(recipeId)
          ? { ...c, recipeIds: [...c.recipeIds, recipeId] }
          : c,
      ),
    );
    toast.success("Saved to collection");
  };

  const createCollection = () => {
    const name = newCollectionName.trim();
    if (!name) return;
    const id = `col-${Date.now()}`;
    setCollections((prev) => [...prev, { id, name, recipeIds: [] }]);
    setNewCollectionName("");
    toast.success("Collection created — use Add on a recipe");
  };

  const copyShareLink = (recipeId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?recipe=${encodeURIComponent(recipeId)}`;
    void navigator.clipboard.writeText(url).then(
      () => toast.success("Share link copied"),
      () => toast.error("Could not copy link"),
    );
  };

  const recipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const inCollection = (recipe: RecipeCard) => {
      if (!activeCollectionId) return true;
      const c = collections.find((x) => x.id === activeCollectionId);
      return c ? c.recipeIds.includes(recipe.id) : true;
    };
    return discoverRecipes.filter((recipe) => {
      if (!inCollection(recipe)) return false;
      if (q) {
        const hay = `${recipe.title} ${recipe.creatorName}`.toLowerCase();
        if (!hay.includes(q)) {
          return false;
        }
      }
      if (filters.verified && !recipe.isVerified) {
        return false;
      }
      const maxC = filters.maxCalories === "" ? null : Number(filters.maxCalories);
      if (maxC !== null && !Number.isNaN(maxC) && recipe.calories > maxC) {
        return false;
      }
      const minP = filters.minProtein === "" ? null : Number(filters.minProtein);
      if (minP !== null && !Number.isNaN(minP) && recipe.protein < minP) {
        return false;
      }
      return true;
    });
  }, [discoverRecipes, searchQuery, filters, activeCollectionId, collections]);

  if (selectedRecipe) {
    return (
      <RecipeDetail recipe={selectedRecipe} userTier={userTier} onBack={() => setSelectedRecipe(null)} />
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-4 shadow-lg">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Collections (LTK-style lists)</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={() => setActiveCollectionId(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                activeCollectionId === null
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              All recipes
            </button>
            {collections.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCollectionId(c.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  activeCollectionId === c.id
                    ? "bg-violet-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {c.name} ({c.recipeIds.length})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="New collection name"
              className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
            <button
              type="button"
              onClick={createCollection}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium"
            >
              Create
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search recipes, ingredients, creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-5 py-3.5 rounded-xl border-2 transition-all flex items-center gap-2 font-medium shadow-sm ${
              showFilters
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
            Filters
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-xl">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Max Calories</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={filters.maxCalories}
                  onChange={(e) => setFilters({ ...filters, maxCalories: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Min Protein (g)</label>
                <input
                  type="number"
                  placeholder="e.g. 30"
                  value={filters.minProtein}
                  onChange={(e) => setFilters({ ...filters, minProtein: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.verified}
                    onChange={(e) => setFilters({ ...filters, verified: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Verified Only</span>
                </label>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() =>
                    setFilters({ verified: false, maxCalories: "", minProtein: "" })
                  }
                  className="text-sm text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-medium"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-8">
        {recipes.map((recipe) => (
          <article
            key={recipe.id}
            className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.01]"
          >
            {/* Creator Header */}
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="relative">
                <img
                  src={recipe.creatorImage}
                  alt={recipe.creatorName}
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-200/50 dark:ring-slate-700/50"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-900"></div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 dark:text-white">{recipe.creatorName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {recipe.feedCreatedAt ? formatFeedTime(recipe.feedCreatedAt) : "Sample catalog"}
                </p>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="10" cy="4" r="1.5" />
                  <circle cx="10" cy="10" r="1.5" />
                  <circle cx="10" cy="16" r="1.5" />
                </svg>
              </button>
            </div>

            {/* Recipe Image */}
            <button type="button" onClick={() => setSelectedRecipe(recipe)} className="w-full relative overflow-hidden">
              <img src={recipe.image} alt={recipe.title} className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>

            {/* Actions */}
            <div className="px-5 py-4 flex items-center gap-4">
              <button
                type="button"
                className="text-slate-400 hover:text-red-500 transition-all hover:scale-110 active:scale-95"
                aria-label="Like"
              >
                <Heart className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  copyShareLink(recipe.id);
                }}
                className="text-slate-400 hover:text-violet-600 transition-all hover:scale-110 active:scale-95"
                aria-label="Copy share link"
              >
                <Share2 className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleSaveRecipe(recipe.id, userTier);
                }}
                className={`transition-all hover:scale-110 active:scale-95 ${
                  recipe.isSaved ? "text-violet-600" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                aria-label={recipe.isSaved ? "Remove from library" : "Save to library"}
              >
                <Bookmark className="w-6 h-6" fill={recipe.isSaved ? "currentColor" : "none"} />
              </button>
              {collections.length > 0 ? (
                <label
                  className="inline-flex items-center gap-1 text-slate-500"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FolderPlus className="w-5 h-5" />
                  <select
                    className="text-xs bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 max-w-[120px]"
                    defaultValue=""
                    onChange={(e) => {
                      const cid = e.target.value;
                      if (cid) addToCollection(recipe.id, cid);
                      e.target.value = "";
                    }}
                  >
                    <option value="" disabled>
                      Collection…
                    </option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-violet-500 rounded-full"></span>
                {recipe.savedCount.toLocaleString()} saved
              </span>
            </div>

            {/* Recipe Details */}
            <div className="px-5 pb-5">
              <button type="button" onClick={() => setSelectedRecipe(recipe)} className="text-left w-full">
                <h3 className="mb-4 text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{recipe.title}</h3>
              </button>

              {/* Verified Macro Display */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                  {recipe.isVerified ? (
                    <>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-950/30 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">Verified</span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">nutrition per serving</span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 dark:bg-orange-950/30 rounded-full">
                        <AlertCircle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                        <span className="text-xs font-medium text-orange-700 dark:text-orange-400">Estimate</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Calories</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{recipe.calories}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Protein</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{recipe.protein}g</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Carbs</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{recipe.carbs}g</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Fat</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{recipe.fat}g</p>
                  </div>
                </div>

                {/* Creator Discrepancy Warning */}
                {recipe.creatorCalories && Math.abs(recipe.creatorCalories - recipe.calories) / recipe.calories > 0.1 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-start gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200/50 dark:border-orange-800/50">
                      <AlertCircle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        Creator stated: {recipe.creatorCalories} kcal (
                        {Math.round(((recipe.creatorCalories - recipe.calories) / recipe.calories) * 100)}% difference)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
