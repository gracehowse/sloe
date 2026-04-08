import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  Search,
  SlidersHorizontal,
  X,
  Share2,
  FolderPlus,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import type { UserTier } from "../../types/recipe.ts";
import { RecipeDetail } from "./RecipeDetail";
import type { RecipeCard } from "../../types/recipe.ts";

const COLLECTIONS_KEY = "platemate-collections-v1";
const HEARTS_KEY = "platemate-feed-hearts-v1";

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

function loadHeartSet(): Set<string> {
  try {
    const raw = localStorage.getItem(HEARTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function persistHeartSet(ids: Set<string>) {
  localStorage.setItem(HEARTS_KEY, JSON.stringify([...ids]));
}

function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
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

type StoryCreator = { key: string; name: string; image: string; recipeId: string };

export function DiscoverFeed({
  userTier,
  initialOpenRecipeId,
  onConsumedDeepLinkRecipe,
}: DiscoverFeedProps) {
  const { discoverRecipes, toggleSaveRecipe, communityFeedCount, refreshDiscoverRecipes } = useAppData();
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
  const [heartTick, setHeartTick] = useState(0);
  const hearts = useMemo(() => loadHeartSet(), [heartTick]);

  const toggleHeart = (recipeId: string) => {
    const next = loadHeartSet();
    if (next.has(recipeId)) next.delete(recipeId);
    else next.add(recipeId);
    persistHeartSet(next);
    setHeartTick((t) => t + 1);
  };

  const likeCount = (recipe: RecipeCard) => {
    const base = recipe.savedCount;
    const liked = hearts.has(recipe.id);
    return formatCompactNumber(base + (liked ? 1 : 0));
  };

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

  const storyCreators: StoryCreator[] = useMemo(() => {
    const seen = new Set<string>();
    const out: StoryCreator[] = [];
    for (const r of discoverRecipes) {
      const key = `${r.creatorName}|${r.creatorImage}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key: r.id, name: r.creatorName, image: r.creatorImage, recipeId: r.id });
    }
    return out;
  }, [discoverRecipes]);

  const scrollToPost = (recipeId: string) => {
    document.getElementById(`discover-post-${recipeId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      () => toast.success("Link copied"),
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
    <div className="max-w-lg mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      {/* App bar — Instagram-style */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white font-[system-ui]">
          Platemate
        </h1>
        <div className="flex flex-1 max-w-[220px] items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="search"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          {searchQuery ? (
            <button type="button" onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-lg border-2 transition-colors ${
            showFilters
              ? "border-violet-600 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          aria-label="Filters"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </header>

      <div className="px-0 sm:px-2">
        {/* Community vs curated — honest copy */}
        {communityFeedCount === 0 ? (
          <div className="mx-4 mt-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/25 px-4 py-3 text-sm text-amber-950 dark:text-amber-100/90">
            <p className="font-medium text-amber-900 dark:text-amber-100/95">No creator posts yet</p>
            <p className="mt-1 text-amber-900/85 dark:text-amber-200/80 leading-relaxed">
              When people publish recipes to Platemate, they show up here. Until then, browse{" "}
              <strong>Platemate picks</strong> — curated recipes so you can explore the app. Each pick is labeled on the
              card.
            </p>
            <button
              type="button"
              onClick={() => void refreshDiscoverRecipes()}
              className="mt-2 text-sm font-semibold text-amber-900 dark:text-amber-100 underline-offset-2 hover:underline"
            >
              Refresh feed
            </button>
          </div>
        ) : (
            <p className="mx-4 mt-4 text-xs text-slate-500 dark:text-slate-400">
            {communityFeedCount} live creator post{communityFeedCount === 1 ? "" : "s"} · newest first
          </p>
        )}

        {/* Stories strip — creator avatars (Instagram-style) */}
        {storyCreators.length > 0 ? (
          <div className="mt-4 pl-4 pr-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Creators
            </p>
            <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {storyCreators.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => scrollToPost(s.recipeId)}
                  className="flex flex-col items-center gap-1 shrink-0 w-[72px]"
                >
                  <span className="rounded-full p-[3px] bg-gradient-to-tr from-amber-400 via-violet-500 to-fuchsia-500">
                    <img
                      src={s.image}
                      alt=""
                      className="w-[64px] h-[64px] rounded-full object-cover border-2 border-white dark:border-slate-950"
                    />
                  </span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate w-full text-center">
                    {s.name.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Collections + filters */}
        <div className="mx-4 mt-6 space-y-3">
          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Saved collections</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Organize library saves — filter the feed to one list.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => setActiveCollectionId(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  activeCollectionId === null
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                For you
              </button>
              {collections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCollectionId(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                    activeCollectionId === c.id
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
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
                placeholder="New collection"
                className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
              <button
                type="button"
                onClick={createCollection}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium"
              >
                Add
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/90 dark:bg-slate-900/80 p-4 shadow-lg space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Max kcal</label>
                  <input
                    type="number"
                    placeholder="500"
                    value={filters.maxCalories}
                    onChange={(e) => setFilters({ ...filters, maxCalories: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Min protein</label>
                  <input
                    type="number"
                    placeholder="30"
                    value={filters.minProtein}
                    onChange={(e) => setFilters({ ...filters, minProtein: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.verified}
                  onChange={(e) => setFilters({ ...filters, verified: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-violet-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Verified macros only</span>
              </label>
              <button
                type="button"
                onClick={() => setFilters({ verified: false, maxCalories: "", minProtein: "" })}
                className="text-sm font-medium text-violet-600 dark:text-violet-400"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Feed posts */}
        <div className="mt-8 space-y-10">
          {recipes.length === 0 ? (
            <div className="mx-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white/60 dark:bg-slate-900/40 p-8 text-center">
              <p className="text-slate-900 dark:text-white font-medium mb-2">Nothing to show</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                {discoverRecipes.length === 0
                  ? "No recipes loaded. Check connection and seed data, or publish recipes with an author in Supabase."
                  : "Adjust search or filters, or switch back to For you."}
              </p>
              {discoverRecipes.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setFilters({ verified: false, maxCalories: "", minProtein: "" });
                    setActiveCollectionId(null);
                  }}
                  className="text-sm font-semibold text-violet-600 dark:text-violet-400"
                >
                  Reset
                </button>
              ) : null}
            </div>
          ) : null}

          {recipes.map((recipe) => {
            const isCommunity = recipe.feedSource === "community";
            const isCatalog = recipe.feedSource === "catalog";
            const liked = hearts.has(recipe.id);
            return (
              <article
                key={recipe.id}
                id={`discover-post-${recipe.id}`}
                className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 border-y sm:border sm:rounded-xl overflow-hidden shadow-sm"
              >
                {/* Post header */}
                <div className="flex items-center gap-3 px-3 py-3">
                  <button
                    type="button"
                    onClick={() => scrollToPost(recipe.id)}
                    className="relative shrink-0"
                    aria-hidden
                  >
                    <img
                      src={recipe.creatorImage}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                    />
                    {isCommunity ? (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
                    ) : null}
                  </button>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{recipe.creatorName}</p>
                      {isCatalog ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
                          Platemate pick
                        </span>
                      ) : null}
                      {isCommunity ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300">
                          Live
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {recipe.feedCreatedAt ? formatFeedTime(recipe.feedCreatedAt) : isCatalog ? "Curated recipe" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyShareLink(recipe.id)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                    aria-label="Copy link"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>

                {/* Media — square like Instagram */}
                <button type="button" onClick={() => setSelectedRecipe(recipe)} className="block w-full bg-black/5 dark:bg-black/20">
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    className="w-full aspect-square object-cover"
                  />
                </button>

                {/* Actions */}
                <div className="flex items-center px-3 pt-3">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => toggleHeart(recipe.id)}
                      className={`p-1 -m-1 transition-transform active:scale-90 ${liked ? "text-red-500" : "text-slate-800 dark:text-slate-200"}`}
                      aria-label={liked ? "Unlike" : "Like"}
                    >
                      <Heart className="w-7 h-7" fill={liked ? "currentColor" : "none"} strokeWidth={liked ? 0 : 1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRecipe(recipe)}
                      className="p-1 -m-1 text-slate-800 dark:text-slate-200"
                      aria-label="Open recipe"
                    >
                      <MessageCircle className="w-7 h-7" />
                    </button>
                    <button
                      type="button"
                      onClick={() => copyShareLink(recipe.id)}
                      className="p-1 -m-1 text-slate-800 dark:text-slate-200"
                      aria-label="Share link"
                    >
                      <Share2 className="w-7 h-7" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      toggleSaveRecipe(recipe.id, userTier);
                    }}
                    className={`p-1 -m-1 ml-auto ${recipe.isSaved ? "text-violet-600" : "text-slate-800 dark:text-slate-200"}`}
                    aria-label="Save"
                  >
                    <Bookmark className="w-7 h-7" fill={recipe.isSaved ? "currentColor" : "none"} />
                  </button>
                </div>

                <p className="px-3 pt-2 text-sm text-slate-900 dark:text-white">
                  <span className="font-semibold">{likeCount(recipe)} likes</span>
                </p>

                {/* Caption */}
                <div className="px-3 pb-1 pt-1">
                  <p className="text-sm text-slate-900 dark:text-white leading-snug">
                    <span className="font-semibold">{recipe.creatorName}</span>{" "}
                    <span className="font-normal">{recipe.title}</span>
                  </p>
                </div>

                {/* Macros — compact, “details” feel */}
                <div className="px-3 pb-3 flex flex-wrap items-center gap-2 text-xs">
                  {recipe.isVerified ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Estimate
                    </span>
                  )}
                  <span className="text-slate-500 dark:text-slate-400">
                    {recipe.calories} kcal · P {recipe.protein}g · C {recipe.carbs}g · F {recipe.fat}g
                  </span>
                </div>

                {collections.length > 0 ? (
                  <div className="px-3 pb-4 flex items-center gap-2">
                    <FolderPlus className="w-4 h-4 text-slate-400 shrink-0" />
                    <select
                      className="flex-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2"
                      defaultValue=""
                      onChange={(e) => {
                        const cid = e.target.value;
                        if (cid) addToCollection(recipe.id, cid);
                        e.target.value = "";
                      }}
                    >
                      <option value="" disabled>
                        Add to collection…
                      </option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {recipe.creatorCalories && Math.abs(recipe.creatorCalories - recipe.calories) / recipe.calories > 0.1 ? (
                  <div className="mx-3 mb-3 px-3 py-2 rounded-lg bg-orange-50/90 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-900/50">
                    <p className="text-[11px] text-orange-800 dark:text-orange-300">
                      Creator stated {recipe.creatorCalories} kcal (
                      {Math.round(((recipe.creatorCalories - recipe.calories) / recipe.calories) * 100)}% vs our estimate)
                    </p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
