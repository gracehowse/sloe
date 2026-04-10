import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { supabase } from "../../lib/supabase/browserClient.ts";
import type { UserTier } from "../../types/recipe.ts";
import { RecipeDetail } from "./RecipeDetail";
import type { RecipeCard } from "../../types/recipe.ts";

const COLLECTIONS_KEY = "platemate-collections-v1";
const HEARTS_KEY = "platemate-feed-hearts-v1";
/** ISO timestamp: last time the user left the Discover view (used for “new from follows” banner). */
const DISCOVER_LAST_LEFT_AT_KEY = "platemate-discover-last-left-at";

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
  /** Auto-open cook mode when recipe is deep-linked. */
  initialCookMode?: boolean;
  /** Pre-fill servings when opening from planner (portion multiplier). */
  initialPortions?: number;
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

export const DiscoverFeed = memo(function DiscoverFeed({
  userTier,
  initialOpenRecipeId,
  initialCookMode,
  initialPortions,
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
  const [feedScope, setFeedScope] = useState<"forYou" | "following">("forYou");
  const [followedAuthorIds, setFollowedAuthorIds] = useState<Set<string>>(() => new Set());
  const [followedCreatorIds, setFollowedCreatorIds] = useState<Set<string>>(() => new Set());
  const [followGraphLoading, setFollowGraphLoading] = useState(true);
  const [newFromFollowsCount, setNewFromFollowsCount] = useState(0);
  const [dismissNewFromFollows, setDismissNewFromFollows] = useState(false);
  const prevDetailRef = useRef<RecipeCard | null>(null);

  useEffect(() => {
    return () => {
      try {
        localStorage.setItem(DISCOVER_LAST_LEFT_AT_KEY, new Date().toISOString());
      } catch {
        // ignore quota / private mode
      }
    };
  }, []);

  const loadFollowGraph = useCallback(async () => {
    setFollowGraphLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) {
      setFollowedAuthorIds(new Set());
      setFollowedCreatorIds(new Set());
      setFollowGraphLoading(false);
      return;
    }
    const [af, cf] = await Promise.all([
      supabase.from("author_follows").select("author_id").eq("follower_id", uid),
      supabase.from("follows").select("creator_id").eq("user_id", uid),
    ]);
    const authors = new Set<string>();
    if (!af.error && af.data) {
      for (const row of af.data as { author_id: string }[]) {
        if (row.author_id) authors.add(row.author_id);
      }
    }
    const creators = new Set<string>();
    if (!cf.error && cf.data) {
      for (const row of cf.data as { creator_id: string }[]) {
        if (row.creator_id) creators.add(row.creator_id);
      }
    }
    setFollowedAuthorIds(authors);
    setFollowedCreatorIds(creators);
    setFollowGraphLoading(false);
  }, []);

  useEffect(() => {
    void loadFollowGraph();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void loadFollowGraph();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadFollowGraph]);

  useEffect(() => {
    if (prevDetailRef.current && !selectedRecipe) {
      void loadFollowGraph();
    }
    prevDetailRef.current = selectedRecipe;
  }, [selectedRecipe, loadFollowGraph]);

  useEffect(() => {
    if (followGraphLoading) return;
    const authorIds = [...followedAuthorIds];
    const creatorIds = [...followedCreatorIds];
    if (authorIds.length === 0 && creatorIds.length === 0) {
      setNewFromFollowsCount(0);
      return;
    }
    let lastLeft: string | null = null;
    try {
      lastLeft = localStorage.getItem(DISCOVER_LAST_LEFT_AT_KEY);
    } catch {
      lastLeft = null;
    }
    if (!lastLeft || Number.isNaN(Date.parse(lastLeft))) {
      setNewFromFollowsCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("recipes")
        .select("id", { count: "exact", head: true })
        .eq("published", true)
        .gt("created_at", lastLeft);
      if (authorIds.length > 0 && creatorIds.length > 0) {
        q = q.or(`author_id.in.(${authorIds.join(",")}),creator_id.in.(${creatorIds.join(",")})`);
      } else if (authorIds.length > 0) {
        q = q.in("author_id", authorIds);
      } else {
        q = q.in("creator_id", creatorIds);
      }
      const { count, error } = await q;
      if (error && process.env.NODE_ENV === "development") {
        console.warn("newFromFollowsCount:", error.message);
      }
      if (!cancelled) {
        setNewFromFollowsCount(error || count == null ? 0 : count);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [followGraphLoading, followedAuthorIds, followedCreatorIds]);

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
    const matchesFollowing = (recipe: RecipeCard) => {
      const cid = recipe.creatorId ?? null;
      const aid = recipe.authorId ?? null;
      if (cid && followedCreatorIds.has(cid)) return true;
      if (aid && followedAuthorIds.has(aid)) return true;
      return false;
    };
    return discoverRecipes.filter((recipe) => {
      if (feedScope === "following" && !matchesFollowing(recipe)) return false;
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
  }, [
    discoverRecipes,
    searchQuery,
    filters,
    activeCollectionId,
    collections,
    feedScope,
    followedAuthorIds,
    followedCreatorIds,
  ]);

  if (selectedRecipe) {
    return (
      <RecipeDetail recipe={selectedRecipe} userTier={userTier} onBack={() => setSelectedRecipe(null)} autoOpenCookMode={initialCookMode} initialServings={initialPortions} />
    );
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      {/* App bar */}
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
        <div className="mx-4 mt-3 flex rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100/80 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={() => setFeedScope("forYou")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              feedScope === "forYou"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            For you
          </button>
          <button
            type="button"
            disabled={followGraphLoading}
            onClick={() => setFeedScope("following")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              feedScope === "following"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {followGraphLoading ? "Following…" : "Following"}
          </button>
        </div>

        {feedScope === "forYou" &&
        !followGraphLoading &&
        newFromFollowsCount > 0 &&
        !dismissNewFromFollows ? (
          <div className="mx-4 mt-3 rounded-2xl border border-violet-200/90 dark:border-violet-900/50 bg-violet-50/95 dark:bg-violet-950/35 px-4 py-3 text-sm text-violet-950 dark:text-violet-100/95 flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-violet-900 dark:text-violet-100">
                {newFromFollowsCount} new recipe{newFromFollowsCount === 1 ? "" : "s"} from people you follow
              </p>
              <p className="mt-0.5 text-violet-900/85 dark:text-violet-200/80 text-xs leading-relaxed">
                Since you last opened Discover. Switch to Following to see their posts first.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFeedScope("following");
                  setDismissNewFromFollows(true);
                }}
                className="mt-2 text-xs font-semibold text-violet-700 dark:text-violet-300 underline-offset-2 hover:underline"
              >
                Open Following feed
              </button>
            </div>
            <button
              type="button"
              onClick={() => setDismissNewFromFollows(true)}
              className="p-1 rounded-lg text-violet-600 dark:text-violet-400 hover:bg-violet-100/80 dark:hover:bg-violet-900/50 shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}

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

        {/* Stories strip — creator avatars */}
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
                All posts
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
                  ? "Nothing in the feed yet. Check your connection, then pull to refresh. If you’re setting up the app, publish a recipe with an author so community posts can appear here."
                  : feedScope === "following"
                    ? followedAuthorIds.size + followedCreatorIds.size === 0
                      ? "Open a recipe and follow the author to build your Following feed."
                      : "No posts from people you follow match your search, filters, or collection."
                    : "Nothing matches right now. Clear search or filters, or pick another collection."}
              </p>
              {discoverRecipes.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setFilters({ verified: false, maxCalories: "", minProtein: "" });
                    setActiveCollectionId(null);
                    setFeedScope("forYou");
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

                {/* Media — editorial card: fixed 1:1, scrim, title lockup */}
                <div className="relative w-full aspect-square bg-black/5 dark:bg-black/25">
                  <button
                    type="button"
                    onClick={() => setSelectedRecipe(recipe)}
                    className="absolute inset-0 block"
                    aria-label={`Open ${recipe.title}`}
                  >
                    <img src={recipe.image} alt="" className="h-full w-full object-cover" />
                  </button>
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSaveRecipe(recipe.id, userTier);
                    }}
                    className={`absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/90 shadow-md backdrop-blur-sm transition-pm dark:bg-slate-900/80 dark:border-slate-600/50 ${
                      recipe.isSaved ? "text-violet-600 dark:text-violet-400" : "text-slate-800 dark:text-slate-100"
                    }`}
                    aria-label={recipe.isSaved ? "Saved" : "Save recipe"}
                  >
                    <Bookmark className="h-5 w-5" fill={recipe.isSaved ? "currentColor" : "none"} />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pt-12 text-left text-white">
                    <p className="text-xs font-medium text-white/80">{recipe.creatorName}</p>
                    <h2 className="mt-1 text-lg font-bold leading-tight tracking-tight text-white drop-shadow-sm sm:text-xl">
                      {recipe.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium sm:text-xs">
                      {isCommunity ? (
                        <span className="rounded-md bg-white/15 px-2 py-0.5 backdrop-blur-sm">Community</span>
                      ) : (
                        <span className="rounded-md bg-violet-500/40 px-2 py-0.5 backdrop-blur-sm">Curated</span>
                      )}
                      {recipe.isVerified ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/35 px-2 py-0.5">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/35 px-2 py-0.5">
                          <AlertCircle className="h-3 w-3" />
                          Estimate
                        </span>
                      )}
                      <span className="rounded-md bg-black/30 px-2 py-0.5 font-semibold tabular-nums">
                        {recipe.calories} kcal · P{recipe.protein} C{recipe.carbs} F{recipe.fat}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center px-3 pt-3">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => toggleHeart(recipe.id)}
                      className={`p-1 -m-1 transition-pm active:scale-95 ${liked ? "text-red-500" : "text-slate-800 dark:text-slate-200"}`}
                      aria-label={liked ? "Unlike" : "Like"}
                    >
                      <Heart className="w-7 h-7" fill={liked ? "currentColor" : "none"} strokeWidth={liked ? 0 : 1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRecipe(recipe)}
                      className="p-1 -m-1 text-slate-800 dark:text-slate-200 transition-pm"
                      aria-label="Open recipe"
                    >
                      <MessageCircle className="w-7 h-7" />
                    </button>
                    <button
                      type="button"
                      onClick={() => copyShareLink(recipe.id)}
                      className="p-1 -m-1 text-slate-800 dark:text-slate-200 transition-pm"
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
                    className={`p-1 -m-1 ml-auto transition-pm ${recipe.isSaved ? "text-violet-600" : "text-slate-800 dark:text-slate-200"}`}
                    aria-label="Save"
                  >
                    <Bookmark className="w-7 h-7" fill={recipe.isSaved ? "currentColor" : "none"} />
                  </button>
                </div>

                <p className="px-3 pt-2 text-sm text-slate-900 dark:text-white">
                  <span className="font-semibold">{likeCount(recipe)} likes</span>
                </p>

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
});
