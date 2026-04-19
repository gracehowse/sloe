import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { webRecipeDeepLink } from "../../lib/share/recipeDeepLink.ts";
import { Icons } from "./ui/icons";
import { IconBox } from "./ui/icon-box";
import { SourceBadge } from "./suppr/source-badge";
import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import { supabase } from "../../lib/supabase/browserClient.ts";
import type { UserTier } from "../../types/recipe.ts";
import { RecipeDetail } from "./RecipeDetail";
import type { RecipeCard } from "../../types/recipe.ts";

const COLLECTIONS_KEY = "suppr-collections-v1";
const HEARTS_KEY = "suppr-feed-hearts-v1";
/** ISO timestamp: last time the user left the Discover view (used for "new from follows" banner). */
const DISCOVER_LAST_LEFT_AT_KEY = "suppr-discover-last-left-at";

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
  /** Navigate to tracker (passed through to CookMode after meal logging). */
  onViewTracker?: () => void;
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

// Build 10 F-11 (TestFlight `AA63DQ7xd2gRhdjC3L7gjtE`, 2026-04-19):
// the per-card macro-fit score was removed — testers reported it felt
// irrelevant. `computeFitLevel` / `FitBadge` have been stripped from
// the recipe card below. No ranking consumed this value (cards remain
// sorted by feed scope / quick filter), so no sort fallback is needed.

type StoryCreator = { key: string; name: string; image: string; recipeId: string };

export const DiscoverFeed = memo(function DiscoverFeed({
  userTier,
  initialOpenRecipeId,
  initialCookMode,
  initialPortions,
  onConsumedDeepLinkRecipe,
  onViewTracker,
}: DiscoverFeedProps) {
  const { discoverRecipes, toggleSaveRecipe, communityFeedCount, refreshDiscoverRecipes } = useAppData();
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeCard | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  // Eating-out row — Edamam restaurant + branded results, debounced 350ms.
  // Surfaces only when the query is ≥ 3 chars to avoid noisy/empty calls.
  // TestFlight `AOI9xgY88Dx-uphiXI8IzEk` (2026-04-18). Mirrors mobile Discover.
  type EatingOutHit = { foodId: string; label: string; brand: string | null; calories: number; protein: number };
  const [eatingOut, setEatingOut] = useState<EatingOutHit[]>([]);
  const [eatingOutLoading, setEatingOutLoading] = useState(false);
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setEatingOut([]);
      setEatingOutLoading(false);
      return;
    }
    let cancelled = false;
    setEatingOutLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/edamam/search?q=${encodeURIComponent(q)}&mode=meals`);
        const json = await res.json();
        if (cancelled) return;
        if (json.ok && Array.isArray(json.hits)) {
          setEatingOut((json.hits as EatingOutHit[]).slice(0, 12));
        } else {
          setEatingOut([]);
        }
      } catch {
        if (!cancelled) setEatingOut([]);
      } finally {
        if (!cancelled) setEatingOutLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setEatingOutLoading(false);
    };
  }, [searchQuery]);
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
  const [quickFilter, setQuickFilter] = useState("For You");
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
    const url = webRecipeDeepLink(recipeId, window.location.origin);
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
      // Quick filter pills
      if (quickFilter === "High Protein" && recipe.protein < 25) return false;
      if (quickFilter === "Low Carb" && recipe.carbs > 30) return false;
      if (quickFilter === "Quick") {
        const cm = recipe.cookTimeMin;
        if (cm != null && cm > 0) return cm <= 20;
        return true;
      }
      return true;
    });
  }, [
    discoverRecipes,
    searchQuery,
    filters,
    quickFilter,
    activeCollectionId,
    collections,
    feedScope,
    followedAuthorIds,
    followedCreatorIds,
  ]);

  if (selectedRecipe) {
    return (
      <RecipeDetail recipe={selectedRecipe} userTier={userTier} onBack={() => setSelectedRecipe(null)} autoOpenCookMode={initialCookMode} initialServings={initialPortions} onViewTracker={onViewTracker} />
    );
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-background pb-12">
      {/* Title area */}
      <header className="sticky top-0 z-20 px-4 py-4 border-b border-border bg-card/90 backdrop-blur-md">
        <h1 className="text-2xl font-bold text-foreground mb-1">Discover</h1>
        <p className="text-sm text-muted-foreground">Recipes that fit your macros</p>
      </header>

      <div className="px-0 sm:px-2">
        {/* Search bar — rectangular to match mobile
            (`apps/mobile/app/(tabs)/discover.tsx` 247: borderRadius: 10
            ≈ `rounded-md`). Rounded pill was a visual divergence
            without a UX reason. */}
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5">
          <Icons.search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="search"
            placeholder="Search or paste a link..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {searchQuery ? (
            <button type="button" onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
              <Icons.close className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {/* Filter pills — horizontal scrollable */}
        <div className="mt-4 pl-4 pr-2">
          <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {["For You", "Popular", "Quick", "High Protein", "Low Carb"].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setQuickFilter(label)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  quickFilter === label
                    ? "border-2 border-primary bg-primary/15 text-primary"
                    : "border border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Eating out — Edamam restaurant + branded meals. Renders only
            when the user has typed at least 3 characters; collapsed
            otherwise. TestFlight `AOI9xgY88Dx-uphiXI8IzEk` (2026-04-18). */}
        {(eatingOutLoading || eatingOut.length > 0) && (
          <div className="mt-4 px-4">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Eating out
              </p>
              <p className="text-[10px] text-muted-foreground">
                {eatingOutLoading
                  ? "Searching…"
                  : `${eatingOut.length} restaurant ${eatingOut.length === 1 ? "match" : "matches"}`}
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {eatingOut.map((m) => (
                <button
                  key={m.foodId}
                  type="button"
                  onClick={() => onViewTracker?.()}
                  className="shrink-0 w-44 p-3 rounded-xl border border-border bg-card text-left hover:bg-muted transition-colors"
                  title={m.label}
                >
                  {m.brand ? (
                    <p className="text-[10px] font-bold uppercase tracking-wide text-primary mb-1 truncate">
                      {m.brand}
                    </p>
                  ) : null}
                  <p className="text-xs font-semibold text-foreground line-clamp-2 mb-2">
                    {m.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {Math.round(m.calories)} kcal · {Math.round(m.protein)}p
                  </p>
                  <p className="text-[9px] text-muted-foreground/70 mt-0.5">per 100 g</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Import CTA card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("view", "import");
            window.history.pushState({}, "", url.toString());
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
          className="mx-4 mt-4 rounded-xl border p-3.5 flex items-center gap-3 cursor-pointer transition-colors"
          style={{ background: "rgba(76,108,224,0.08)", borderColor: "rgba(76,108,224,0.22)" }}
        >
          <IconBox size="lg" tone="primary">
            <Icons.import />
          </IconBox>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-foreground">Import from TikTok, Instagram...</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Paste a link or share from any app</p>
          </div>
          <Icons.forward className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* My Library CTA — parity with mobile
            (`apps/mobile/app/(tabs)/discover.tsx` 369). Mobile shows
            this immediately after the Import CTA so users discover the
            saved-recipes shortcut without leaving Discover. Same `view`
            URL trick the Import card uses. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("view", "library");
            window.history.pushState({}, "", url.toString());
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
          className="mx-4 mt-3 rounded-xl border border-border bg-card p-3.5 flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors"
        >
          <IconBox size="lg" tone="success">
            <Icons.save />
          </IconBox>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-foreground">My Library</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Saved and imported recipes</p>
          </div>
          <Icons.forward className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Feed — 2-column grid */}
        <div className="mt-8">
          {recipes.length === 0 ? (
            <div className="mx-4 rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
              <p className="text-foreground font-medium mb-2">Nothing to show</p>
              <p className="text-sm text-muted-foreground mb-4">
                {discoverRecipes.length === 0
                  ? "Nothing in the feed yet. Check your connection, then pull to refresh. If you're setting up the app, publish a recipe with an author so community posts can appear here."
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
                  className="text-sm font-semibold text-primary"
                >
                  Reset
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 px-4">
              {recipes.map((recipe) => {
                // F-11 (`AA63DQ7xd2gRhdjC3L7gjtE`, 2026-04-19): the
                // fit badge previously rendered here was removed; the
                // hero gradient now uses a single neutral accent so
                // no per-recipe colour comes from the dropped score.
                const heroColor = "var(--primary)";
                return (
                  <div
                    key={recipe.id}
                    id={`discover-post-${recipe.id}`}
                    onClick={() => setSelectedRecipe(recipe)}
                    className="rounded-xl bg-card border border-border overflow-hidden cursor-pointer"
                  >
                    {/* Hero gradient or image */}
                    <div className="flex items-center justify-center relative overflow-hidden" style={{ height: 80, background: recipe.image ? undefined : `linear-gradient(135deg, ${heroColor}08, ${heroColor}18)` }}>
                      {recipe.image ? (
                        <img src={recipe.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Icons.dinner className="w-7 h-7" style={{ color: `${heroColor}60` }} />
                      )}
                      {recipe.sourcePlatform && (
                        <div className="absolute top-2 left-2">
                          <SourceBadge source={recipe.sourcePlatform} className="text-[9px] px-1.5 py-0.5" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-foreground leading-tight mb-0.5" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {recipe.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mb-1.5">
                        {recipe.creatorName}{recipe.cookTime ? ` · ${recipe.cookTime}` : ""}
                      </p>

                      {/* Macro dots */}
                      <div className="flex gap-1.5 mb-1.5">
                        {([
                          ["P", recipe.protein, "var(--macro-protein)"],
                          ["C", recipe.carbs, "var(--macro-carbs)"],
                          ["F", recipe.fat, "var(--macro-fat)"],
                        ] as const).map(([label, value, color]) => (
                          <div key={label} className="flex items-center gap-0.5">
                            <div className="w-1 h-1 rounded-sm" style={{ background: color }} />
                            <span className="text-[10px] text-muted-foreground tabular-nums">{value}g</span>
                          </div>
                        ))}
                      </div>

                      {/* Calories — fit badge removed (F-11). */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-foreground tabular-nums">
                          {recipe.calories}
                          <span className="text-[9px] font-normal text-muted-foreground"> kcal</span>
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="flex gap-2 text-[9px] text-muted-foreground">
                        <span>{formatCompactNumber(recipe.savedCount)} saves</span>
                        {(recipe as any).madeCount > 0 && (
                          <span>{formatCompactNumber((recipe as any).madeCount)} made</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
