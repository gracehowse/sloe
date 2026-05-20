import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "./ui/icons";
import { IconBox } from "./ui/icon-box";
import { SourceBadge } from "./suppr/source-badge";
import { useAppData } from "../../context/AppDataContext.tsx";
import { supabase } from "../../lib/supabase/browserClient.ts";
import type { UserTier } from "../../types/recipe.ts";
import { RecipeDetail } from "./RecipeDetail";
import type { RecipeCard } from "../../types/recipe.ts";
import { computeRecipeFitPercent } from "../../lib/nutrition/recipeFitPercent.ts";
import { DISCOVER_POPULAR_MIN_SAVES } from "../../lib/recipes/fetchPublicRecipeSaveCounts.ts";
import { recipeSearchMatch } from "../../lib/recipes/recipeSearchMatch.ts";
import { useLibraryDiscoverSearch } from "../../lib/libraryDiscoverSearchStore.ts";
import {
  SEED_CLUSTERS,
  isSeedRecipeId,
  type SeedCuisineCluster,
} from "../../lib/recipes/seedRecipesV2.ts";
import { RecipeHeroFallback } from "./suppr/RecipeHeroFallback";
// Phase 4 / B3.X — trust posture sweep (D-2026-04-27-16).
// GW-08 (audit 2026-04-28): `TrustChip` + `recipeLevelTrust` dropped
// from the Discover hero card — see the comment on the card body.

const COLLECTIONS_KEY = "suppr-collections-v1";
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

// Fit-percent badge history:
//   - F-11 (TestFlight `AA63DQ7xd2gRhdjC3L7gjtE`, 2026-04-19) removed
//     the "Great / Good / Warn" pill because the underlying `fit`
//     field was never populated (always rendered "Good").
//   - 2026-04-20 Grace design prototype port: reinstated as a
//     primary-tinted `{N}%` pill in the top-right of the hero card
//     body. The value comes from `computeRecipeFitPercent` so web +
//     mobile can't drift. Decision rationale: "Grace sent the
//     prototype with fit % and said 'add this' — overrides F-11".
//     Pinned by `tests/unit/recipeCardFitBadge.test.ts`.

export const DiscoverFeed = memo(function DiscoverFeed({
  userTier,
  initialOpenRecipeId,
  initialCookMode,
  initialPortions,
  onConsumedDeepLinkRecipe,
  onViewTracker,
}: DiscoverFeedProps) {
  const { discoverRecipes, nutritionTargets } = useAppData();
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeCard | null>(null);
  // Shared with Library via `useLibraryDiscoverSearch` so the query
  // survives view switches (ENG-53, 2026-05-16). Variable names
  // (searchQuery / setSearchQuery) preserved so the 20+ downstream
  // references — Edamam debounce, recipeSearchMatch, render, etc. —
  // stay untouched.
  const { query: searchQuery, setQuery: setSearchQuery } = useLibraryDiscoverSearch();
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
  const [collections] = useState<CollectionRow[]>(() => loadCollections());
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState("For You");
  const [feedScope, setFeedScope] = useState<"forYou" | "following">("forYou");
  const [followedAuthorIds, setFollowedAuthorIds] = useState<Set<string>>(() => new Set());
  const [followedCreatorIds, setFollowedCreatorIds] = useState<Set<string>>(() => new Set());
  const [followGraphLoading, setFollowGraphLoading] = useState(true);
  const [, setNewFromFollowsCount] = useState(0);
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
        // Polish (2026-04-25): tokenized AND match — pre-fix the
        // substring approach failed for "wasabi katsu curry" when the
        // title was "Katsu Curry · Wasabi" because the tokens weren't
        // contiguous. recipeSearchMatch splits the query into tokens
        // and requires each one to appear somewhere across title +
        // description + creator.
        if (
          !recipeSearchMatch(
            {
              title: recipe.title,
              creatorName: recipe.creatorName ?? null,
              source: recipe.sourcePlatform ?? null,
            },
            q,
          )
        ) {
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
        // GW-06 (audit 2026-04-28): pre-fix recipes with
        // `cookTimeMin == null` passed through as "Quick" — most
        // legacy imports don't carry cook time, so the pill silently
        // behaved like "All". Now requires a real cook- or prep-time
        // signal to qualify.
        const cm = recipe.cookTimeMin;
        const pm = recipe.prepTimeMin;
        const cookOk = typeof cm === "number" && cm > 0;
        const prepOk = typeof pm === "number" && pm > 0;
        if (!cookOk && !prepOk) return false;
        const total = (cookOk ? cm : 0) + (prepOk ? pm : 0);
        return total <= 30;
      }
      if (quickFilter === "Popular" && (recipe.savedCount ?? 0) < DISCOVER_POPULAR_MIN_SAVES) return false;
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

  // Wave 4 (2026-05-02) — group seed entries by cluster for the
  // cluster carousels (Mediterranean → Asian → Latin → Comfort →
  // Healthy bowls). Non-seed (community) entries flow through to
  // the legacy flat layout below the carousels so community uploads
  // are never hidden behind seeds. Cluster carousels render only
  // when no search/filter narrows the feed (otherwise the cluster
  // grouping fights the active query). Mobile parity:
  // `apps/mobile/app/(tabs)/discover.tsx`.
  const seedRecipesByCluster = useMemo(() => {
    const map = new Map<SeedCuisineCluster, RecipeCard[]>();
    for (const c of SEED_CLUSTERS) map.set(c.id, []);
    for (const r of recipes) {
      if (!isSeedRecipeId(r.id)) continue;
      const after = r.id.slice("seed-v2-".length);
      let clusterId: SeedCuisineCluster | null = null;
      for (const c of SEED_CLUSTERS) {
        if (after.startsWith(`${c.id}-`)) {
          clusterId = c.id;
          break;
        }
      }
      if (!clusterId) continue;
      map.get(clusterId)?.push(r);
    }
    return map;
  }, [recipes]);

  const nonSeedRecipes = useMemo(
    () => recipes.filter((r) => !isSeedRecipeId(r.id)),
    [recipes],
  );

  const showClusterCarousels =
    !searchQuery.trim() &&
    quickFilter === "For You" &&
    feedScope === "forYou" &&
    !activeCollectionId &&
    !filters.verified &&
    filters.maxCalories === "" &&
    filters.minProtein === "";

  // What the legacy flat grid + 3-section layout reads from. When
  // cluster carousels are showing, seeds are already rendered above
  // — the layout below should only show community uploads to avoid
  // duplication.
  const displayRecipes = showClusterCarousels ? nonSeedRecipes : recipes;

  if (selectedRecipe) {
    return (
      <RecipeDetail recipe={selectedRecipe} userTier={userTier} onBack={() => setSelectedRecipe(null)} autoOpenCookMode={initialCookMode} initialServings={initialPortions} onViewTracker={onViewTracker} />
    );
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-background pb-12 md:max-w-6xl md:px-pm-5">
      {/* Title area — prototype treatment: BROWSE overline + large
          Discover title + round search-icon button on the right.
          Mobile parity: apps/mobile/app/(tabs)/discover.tsx.

          2026-04-20 desktop prototype port
          (`docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
          `WebLibrary(title="Discover")`). At `md+` the title shrinks
          to 24px and a "{n} recipes · sorted by recent" subtitle
          replaces the BROWSE overline. The search search-icon round
          button is dropped on desktop — the main search bar below is
          the canonical way in, and the breadcrumb agent ships an
          additional top-bar search. Sticky/blur/border are dropped
          so the content canvas reads continuously with the sidebar. */}
      <header className="hidden md:block mb-4">
        <h1 className="text-[24px] font-bold -tracking-[0.02em] text-foreground">Discover</h1>
        <p
          data-testid="discover-desktop-subtitle"
          className="text-[13px] text-muted-foreground mt-0.5"
        >
          {recipes.length} recipe{recipes.length === 1 ? "" : "s"} · sorted by recent
        </p>
      </header>

      <div className="px-0 sm:px-2 md:px-0">
        {/* Search bar — prototype treatment: bigger, 12px radius. At
            `md+` the side gutter collapses so the bar sits flush with
            the title; the bar itself is unchanged.
            GW-05 (audit 2026-04-28): pre-fix the placeholder claimed
            "48,000+ recipes & foods" — aspirational catalog size, not
            the real one. Now honest until we either ship a real
            catalog count or pivot the placeholder to talk about Edamam. */}
        <div className="mx-4 mt-4 flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3.5 md:mx-0">
          <Icons.search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="search"
            placeholder="Search recipes"
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
        <div className="mt-4 pl-4 pr-2 md:pl-0 md:pr-0">
          <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {["For You", "Following", "Popular", "Quick", "High Protein", "Low Carb"].map((label) => {
              const isFollowingPill = label === "Following";
              const isActive = isFollowingPill
                ? feedScope === "following"
                : feedScope === "forYou" && quickFilter === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (isFollowingPill) {
                      setFeedScope("following");
                      setQuickFilter("For You");
                    } else {
                      setFeedScope("forYou");
                      setQuickFilter(label);
                    }
                  }}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "border-2 border-primary bg-primary/15 text-primary"
                      : "border border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              );
            })}
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

        {/* ── Prototype port (2026-04-20, screens-mobile.jsx
            `DiscoverScreen` lines 345–438): three stacked sections
            instead of a single 2-column grid.

              1. "Matches your day" — 2 hero cards (16:10 image, full
                 width, stacked vertically). Takes `recipes.slice(0, 2)`.
              2. "More ideas" — one card containing compact meal-row
                 style list rows for `recipes.slice(2)`.
              3. "From your sources" — Import + My Library CTAs,
                 reordered to the BOTTOM per prototype (they are
                 utility, not discovery content).

            When the filtered recipe list is empty we DO NOT render
            sections 1 + 2; the existing "Nothing to show" empty state
            takes their place. The "From your sources" CTAs still render
            — that's how users bring content in.

            F-11 reversed 2026-04-20 per Grace's prototype: fit-percent
            badge is back as a primary-tinted `{N}%` pill top-right of
            the hero card body. Value comes from the shared
            `computeRecipeFitPercent` helper. Pinned by
            `tests/unit/recipeCardFitBadge.test.ts`. Mobile parity:
            `apps/mobile/app/(tabs)/discover.tsx` Discover sections. */}

        {/* 2026-04-20 desktop prototype port
            (`docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
            `WebLibrary(title="Discover")`): at `md+` the prototype is
            a flat 3-column card grid, NOT the three-section structure
            the mobile prototype calls for. We render the flat grid
            only at `md+` and hide it below; the three-section
            structure below is wrapped in `md:hidden` so it stays the
            mobile-web experience. Both paths read from the same
            `recipes` list so search / filter behaviour stays
            consistent across widths. Empty state falls through to
            the single shared "Nothing to show" block below.

            Wave 4 (2026-05-02): when cluster carousels render above,
            the flat grid + 3-section layout below shows only
            community uploads (`displayRecipes` = `nonSeedRecipes`)
            so seeds aren't duplicated. */}

        {/* Wave 4 (2026-05-02) — cuisine cluster carousels. Five
            horizontal carousels (Mediterranean → Asian → Latin →
            Comfort → Healthy bowls) render when no search/filter
            narrows the feed. Mobile parity:
            `apps/mobile/app/(tabs)/discover.tsx` cluster sections.
            Below the carousels, the existing flat grid / 3-section
            layout still renders for any community uploads
            (`nonSeedRecipes`) so community content is never hidden
            behind seeds. */}
        {showClusterCarousels ? (
          <div data-testid="discover-cluster-carousels" className="mt-4 space-y-6">
            {SEED_CLUSTERS.map((cluster) => {
              const items = seedRecipesByCluster.get(cluster.id) ?? [];
              if (items.length === 0) return null;
              return (
                <section
                  key={cluster.id}
                  data-testid={`discover-cluster-${cluster.id}`}
                  aria-label={cluster.title}
                >
                  <h2 className="text-[14px] font-bold text-foreground -tracking-[0.01em] px-4 md:px-0 mb-2.5">
                    {cluster.title}
                  </h2>
                  <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                    <div className="flex gap-3 pb-2" style={{ minWidth: "max-content" }}>
                      {items.map((recipe) => {
                        const kcal = Math.round(recipe.calories);
                        const protein = Math.round(recipe.protein);
                        const cookTime =
                          recipe.cookTime ?? (recipe.cookTimeMin ? `${recipe.cookTimeMin} min` : null);
                        return (
                          <button
                            key={`cluster-${recipe.id}`}
                            type="button"
                            onClick={() => setSelectedRecipe(recipe)}
                            className="shrink-0 w-[220px] text-left rounded-xl bg-card border border-border overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all"
                          >
                            <div
                              className="relative overflow-hidden"
                              style={{ aspectRatio: recipe.image ? "16 / 10" : "8 / 1" }}
                            >
                              {recipe.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={recipe.image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <RecipeHeroFallback id={recipe.id} title={recipe.title} iconSize={24} />
                              )}
                            </div>
                            <div className="p-2.5">
                              <p
                                className="text-[13px] font-bold text-foreground leading-snug -tracking-[0.01em]"
                                style={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {recipe.title}
                              </p>
                              <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                                <span className="inline-flex items-center gap-1">
                                  <Icons.calories
                                    className="w-[11px] h-[11px]"
                                    style={{ color: "var(--macro-calories)" }}
                                  />
                                  {kcal} kcal
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Icons.protein
                                    className="w-[11px] h-[11px]"
                                    style={{ color: "var(--macro-protein)" }}
                                  />
                                  {protein}g
                                </span>
                                {cookTime ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Icons.time className="w-[11px] h-[11px] text-muted-foreground" />
                                    {cookTime}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}

        {displayRecipes.length > 0 ? (
          <div
            data-testid="discover-desktop-grid"
            className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6"
          >
            {displayRecipes.map((recipe) => {
              const kcal = Math.round(recipe.calories);
              const protein = Math.round(recipe.protein);
              const carbs = Math.round(recipe.carbs);
              const fat = Math.round(recipe.fat);
              const fiber = Number.isFinite(recipe.fiberG) ? Math.round((recipe.fiberG ?? 0) * 10) / 10 : 0;
              const cookTime = recipe.cookTime ?? (recipe.cookTimeMin ? `${recipe.cookTimeMin} min` : null);
              return (
                <button
                  key={`desktop-${recipe.id}`}
                  type="button"
                  id={`discover-desktop-post-${recipe.id}`}
                  onClick={() => setSelectedRecipe(recipe)}
                  className="group text-left rounded-2xl bg-card border border-border overflow-hidden cursor-pointer w-full hover:shadow-xl hover:shadow-foreground/5 hover:-translate-y-0.5 transition-all"
                >
                  <div
                    className="relative overflow-hidden"
                    // P1-19 web parity (2026-04-25 ui-critic): image-less
                    // hero collapses from 16:10 to a thin 8:1 category
                    // band so the title + macros below carry the
                    // visual weight. Image-bearing rows keep the
                    // full hero.
                    style={{ aspectRatio: recipe.image ? "16 / 10" : "8 / 1" }}
                  >
                    {recipe.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote creator URLs; next/image domains not enumerated
                      <img
                        src={recipe.image}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      />
                    ) : (
                      <RecipeHeroFallback id={recipe.id} title={recipe.title} iconSize={28} />
                    )}
                    {recipe.sourcePlatform && (
                      <div className="absolute top-2 left-2">
                        <SourceBadge
                          source={recipe.sourcePlatform}
                          className="text-[9px] px-1.5 py-0.5"
                        />
                      </div>
                    )}
                  </div>
                  <div className="p-3.5">
                    <p
                      className="text-[14px] font-bold text-foreground leading-snug -tracking-[0.01em]"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {recipe.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {recipe.creatorName || ""}
                    </p>
                    {/* Polish (2026-04-25 visual-qa): pre-fix only kcal +
                        protein had icons. Tester feedback: "on the discover
                        page protein has an icon but none of the other macro
                        nutrients do. also fibre is not shown - same rule
                        should apply it should show whats configured in
                        settings eg fibre etc". Now each macro gets its own
                        icon + value pair; fibre joins when the recipe carries
                        a non-zero value. */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[11px] text-muted-foreground tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Icons.calories
                          className="w-[11px] h-[11px]"
                          style={{ color: "var(--macro-calories)" }}
                        />
                        {kcal} kcal
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icons.protein
                          className="w-[11px] h-[11px]"
                          style={{ color: "var(--macro-protein)" }}
                        />
                        {protein}g
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icons.carbs
                          className="w-[11px] h-[11px]"
                          style={{ color: "var(--macro-carbs)" }}
                        />
                        {carbs}g
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icons.fat
                          className="w-[11px] h-[11px]"
                          style={{ color: "var(--macro-fat)" }}
                        />
                        {fat}g
                      </span>
                      {fiber > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Icons.fiber
                            className="w-[11px] h-[11px]"
                            style={{ color: "var(--success)" }}
                          />
                          {fiber}g
                        </span>
                      ) : null}
                      {cookTime ? (
                        <span className="inline-flex items-center gap-1">
                          <Icons.time className="w-[11px] h-[11px] text-muted-foreground" />
                          {cookTime}
                        </span>
                      ) : null}
                    </div>
                    {/* GW-08 (audit 2026-04-28): TrustChip removed —
                        the source label was fabricated from
                        `recipe.isVerified`, which is set by the
                        importer at `apps/mobile/lib/saveImportedRecipe.ts:210`
                        as `is_verified: (m?.calories ?? 0) > 0` (true
                        whenever the LLM extracts non-zero calories).
                        Restoring it requires real per-recipe
                        match-source data — P1/P2 work in the GW-08
                        audit. */}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* 2026-05-12 (premium-bar audit web parity, DC13 + refuse-
            to-pass #8): permanent Import card above the feed on
            mobile-web. Mirrors the mobile placement (shipped in
            f69a279) — Import is the first thing the user sees on
            Discover, not buried at the bottom under "From your
            sources". `testID` preserved for the Maestro flow on
            iOS, but the click handler uses History API parity with
            the rest of the mobile-web nav. */}
        <div className="md:hidden">
          <div
            role="button"
            tabIndex={0}
            data-testid="discover-import-cta-top"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set("view", "import");
              window.history.pushState({}, "", url.toString());
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
            className="mx-4 mt-3 rounded-xl border p-3.5 flex items-center gap-3 cursor-pointer transition-colors"
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
        </div>

        {/* Section 1 + 2: recipe sections — only when there's content
            MOBILE-WEB ONLY (below `md`). Desktop uses the flat grid
            above; this three-section structure matches the mobile app
            layout so narrow web feels like the native app.

            Wave 4 (2026-05-02): reads `displayRecipes` (community
            uploads only when cluster carousels are active above). */}
        {displayRecipes.length > 0 ? (
          <div className="md:hidden">
            {/* ── Matches your day (hero cards) ── */}
            <h3 className="text-[14px] font-bold text-foreground -tracking-[0.01em] mt-[22px] mb-2.5 px-4">
              Matches your day
            </h3>
            <div className="grid gap-3 px-4">
              {displayRecipes.slice(0, 2).map((recipe) => {
                const kcal = Math.round(recipe.calories);
                const protein = Math.round(recipe.protein);
                const carbs = Math.round(recipe.carbs);
                const fat = Math.round(recipe.fat);
                // 2026-04-20 prototype port — primary-tinted fit-percent
                // pill top-right of the card body. `nutritionTargets`
                // feeds the shared helper; when targets aren't loaded
                // yet the helper returns a synthesised neutral value so
                // every card still shows a value.
                // F-45 (2026-04-22): fit-percent pill removed per repeated
                // tester feedback ("Score means nothing — remove").
                void computeRecipeFitPercent;
                void nutritionTargets;
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    id={`discover-post-${recipe.id}`}
                    onClick={() => setSelectedRecipe(recipe)}
                    className="text-left rounded-[14px] bg-card border border-border overflow-hidden cursor-pointer w-full"
                  >
                    {/* P1-19 web parity: hero collapses to 8:1 band when
                        no image (mobile parity, see DiscoverFeed grid above
                        and apps/mobile/app/(tabs)/discover.tsx). */}
                    <div
                      className="flex items-center justify-center relative overflow-hidden"
                      style={{ aspectRatio: recipe.image ? "16 / 10" : "8 / 1" }}
                    >
                      {recipe.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote creator URLs; next/image domains not enumerated
                        <img src={recipe.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <RecipeHeroFallback id={recipe.id} title={recipe.title} iconSize={28} />
                      )}
                      {recipe.sourcePlatform && (
                        <div className="absolute top-2 left-2">
                          <SourceBadge source={recipe.sourcePlatform} className="text-[9px] px-1.5 py-0.5" />
                        </div>
                      )}
                    </div>
                    <div className="p-3.5 relative">
                      {/* F-45: fit-percent pill removed — see
                          mobile discover.tsx for the matching change. */}
                      <p className="text-[15px] font-bold text-foreground leading-tight -tracking-[0.01em]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {recipe.title}
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-1 truncate">
                        {recipe.creatorName || ""}
                      </p>
                      {/* Polish (2026-04-25 visual-qa): mobile-web hero now
                          renders one icon per macro (matches desktop grid
                          and mobile native). Fibre joins when present. */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
                          <Icons.calories className="w-[11px] h-[11px]" style={{ color: "var(--macro-calories)" }} />
                          {kcal} kcal
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
                          <Icons.protein className="w-[11px] h-[11px]" style={{ color: "var(--macro-protein)" }} />
                          {protein}g
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
                          <Icons.carbs className="w-[11px] h-[11px]" style={{ color: "var(--macro-carbs)" }} />
                          {carbs}g
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
                          <Icons.fat className="w-[11px] h-[11px]" style={{ color: "var(--macro-fat)" }} />
                          {fat}g
                        </span>
                        {Number.isFinite(recipe.fiberG) && (recipe.fiberG ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
                            <Icons.fiber className="w-[11px] h-[11px]" style={{ color: "var(--success)" }} />
                            {Math.round((recipe.fiberG ?? 0) * 10) / 10}g
                          </span>
                        ) : null}
                        {recipe.cookTime ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Icons.time className="w-[11px] h-[11px] text-muted-foreground" />
                            {recipe.cookTime}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── More ideas (compact list) — only when there's a 3rd+ */}
            {displayRecipes.length > 2 ? (
              <>
                <h3 className="text-[14px] font-bold text-foreground -tracking-[0.01em] mt-[22px] mb-2.5 px-4">
                  More ideas
                </h3>
                <div className="mx-4 rounded-xl border border-border bg-card overflow-hidden">
                  {displayRecipes.slice(2).map((recipe, idx) => {
                    const kcal = Math.round(recipe.calories);
                    const protein = Math.round(recipe.protein);
                    const carbs = Math.round(recipe.carbs);
                    return (
                      <button
                        key={recipe.id}
                        type="button"
                        id={`discover-post-${recipe.id}`}
                        onClick={() => setSelectedRecipe(recipe)}
                        className={`w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors ${idx > 0 ? "border-t border-border" : ""}`}
                      >
                        <span className="w-10 h-10 rounded-lg bg-muted text-muted-foreground inline-flex items-center justify-center shrink-0 overflow-hidden">
                          {recipe.image ? (
                            // eslint-disable-next-line @next/next/no-img-element -- remote creator URLs; next/image domains not enumerated
                            <img src={recipe.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Icons.chef className="w-[18px] h-[18px]" />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-semibold text-foreground truncate">
                            {recipe.title}
                          </span>
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {recipe.creatorName || ""}
                            {recipe.cookTime ? ` · ${recipe.cookTime}` : ""}
                          </span>
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
                          <span className="font-semibold text-foreground">{kcal}</span>
                          {` · ${protein}P · ${carbs}C`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        ) : showClusterCarousels ? null : (
          <div className="mt-6 mx-4 rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center md:mx-0">
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
        )}

        {/* ── My Library jump card — bottom rail. MOBILE-WEB ONLY:
            on desktop the sidebar has a permanent Library entry, so
            the CTA is duplicative (`md:hidden` wrapper below).
            Import moved to a permanent first card above the feed
            (2026-05-12 audit, mirror of mobile). */}
        <div className="md:hidden">
        <h3 className="text-[14px] font-bold text-foreground -tracking-[0.01em] mt-[22px] mb-2.5 px-4">
          My Library
        </h3>

        {/* My Library CTA — parity with mobile
            (`apps/mobile/app/(tabs)/discover.tsx`). Same `view` URL
            trick the Import card uses. */}
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
        </div>
      </div>
    </div>
  );
});
