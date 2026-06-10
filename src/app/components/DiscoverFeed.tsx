import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  DISCOVER_CATEGORY_PILLS,
  matchesRecipeCategory,
  type RecipeCategoryId,
} from "../../lib/recipes/recipeCategoryFilters.ts";
import { recipeSearchMatch } from "../../lib/recipes/recipeSearchMatch.ts";
import { displayAttribution } from "../../lib/recipes/displayAttribution.ts";
import { useLibraryDiscoverSearch } from "../../lib/libraryDiscoverSearchStore.ts";
import {
  SEED_CLUSTERS,
  isSeedRecipeId,
  type SeedCuisineCluster,
} from "../../lib/recipes/seedRecipesV2.ts";
import { DiscoverRecipeImage } from "./suppr/discover-recipe-image";
import { SupprCard } from "./ui/suppr-card";
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

// Fit-percent badge history (current state: NOT rendered, web + mobile):
//   - F-11 (TestFlight `AA63DQ7xd2gRhdjC3L7gjtE`, 2026-04-19) removed
//     the "Great / Good / Warn" pill because the underlying `fit`
//     field was never populated (always rendered "Good").
//   - 2026-04-20 Grace design prototype port: briefly reinstated as a
//     primary-tinted `{N}%` pill in the top-right of the hero card.
//   - F-45 (2026-04-22) removed it again after repeated tester
//     feedback ("Score means nothing — remove"); the value wasn't
//     anchored to a target the user had chosen, so it read as
//     decorative noise. The `computeRecipeFitPercent` helper stays
//     imported (referenced via `void`) so a future ranking pass can
//     reuse it without re-plumbing. Web + mobile are in parity: NEITHER
//     renders the pill. The removal is pinned on both surfaces by
//     `tests/unit/recipeCardFitBadge.test.ts` (ENG-756 parity audit,
//     2026-05-27 — confirmed no action needed).

export const DiscoverFeed = memo(function DiscoverFeed({
  userTier,
  initialOpenRecipeId,
  initialCookMode,
  initialPortions,
  onConsumedDeepLinkRecipe,
  onViewTracker,
}: DiscoverFeedProps) {
  const router = useRouter();
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
  // ENG-921 (2026-06-07) — CATEGORY filters per Figma `528:2`
  // (All · Trending · Quick 30 · Under 500 cal · High protein · From
  // Reels · Breakfast · Dinner · Dessert · Soup · Pasta · Chicken).
  // `Trending` + `From Reels` are Discover-only signals handled below.
  const [category, setCategory] = useState<RecipeCategoryId | "trending" | "from-reels">("all");
  // Following feed scope is wired functionality (author/creator follow
  // graph) — preserved as a secondary toggle outside the category row.
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
      // Category filter pills (Figma `528:2`). `Trending` / `From Reels`
      // are Discover-only signals; everything else routes through the
      // shared `matchesRecipeCategory` predicate (web ↔ mobile parity).
      if (category === "trending") {
        if ((recipe.savedCount ?? 0) < DISCOVER_POPULAR_MIN_SAVES) return false;
      } else if (category === "from-reels") {
        // From Reels — recipes imported from a social short-form platform.
        const sp = recipe.sourcePlatform;
        if (sp !== "instagram" && sp !== "tiktok" && sp !== "youtube") return false;
      } else if (category !== "all") {
        if (!matchesRecipeCategory(category, recipe)) return false;
      }
      return true;
    });
  }, [
    discoverRecipes,
    searchQuery,
    filters,
    category,
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
    category === "all" &&
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
      <header className="hidden md:block mb-6">
        <h1 className="text-[24px] font-extrabold -tracking-[0.03em] text-foreground" style={{ letterSpacing: "-0.4px" }}>Discover</h1>
        <p
          data-testid="discover-desktop-subtitle"
          className="text-[13px] text-muted-foreground mt-1"
        >
          {`${recipes.length} recipe${recipes.length === 1 ? "" : "s"} · sorted by recent`}
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
        <div className="mx-4 mt-4 flex items-center gap-2.5 rounded-2xl bg-muted/50 px-4 py-3.5 md:mx-0 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
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

        {/* Category filter pills — ENG-921 / Figma `528:2`. "Following"
            leads as a secondary feed-scope toggle (wired follow-graph
            feature), then the shared category set. Mobile parity:
            `apps/mobile/app/(tabs)/discover.tsx`.

            Chip grammar (web parity 2026-06-10, ENG-1022): selected =
            `bg-primary-soft` fill + `primary-solid` label + `font-semibold`,
            NO selected ring/border; unselected = quiet `bg-card` + muted
            label, NO border. The old `border border-primary-solid` selected
            ring and the unselected `border border-border` were the chip
            drift this pass converges. */}
        <div className="mt-4 pl-4 pr-2 md:pl-0 md:pr-0">
          <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <button
              key="following"
              type="button"
              data-testid="discover-category-following"
              onClick={() => {
                setFeedScope("following");
                setCategory("all");
              }}
              className={`shrink-0 px-3.5 py-2 rounded-full text-[13px] whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                feedScope === "following"
                  ? "bg-primary-soft text-primary-solid font-semibold"
                  : "bg-card text-muted-foreground font-medium hover:text-foreground hover:bg-muted"
              }`}
              aria-pressed={feedScope === "following"}
            >
              Following
            </button>
            {DISCOVER_CATEGORY_PILLS.map((f) => {
              const isActive = feedScope === "forYou" && category === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  data-testid={`discover-category-${f.id}`}
                  onClick={() => {
                    setFeedScope("forYou");
                    setCategory(f.id);
                  }}
                  className={`shrink-0 px-3.5 py-2 rounded-full text-[13px] whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    isActive
                      ? "bg-primary-soft text-primary-solid font-semibold"
                      : "bg-card text-muted-foreground font-medium hover:text-foreground hover:bg-muted"
                  }`}
                  aria-pressed={isActive}
                  aria-label={`Category: ${f.label}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* DEFERRED — Figma-only builds (not built this pass, per the
            Recipes Figma-parity brief):
              · "Popular collections" carousel (Figma `528:61`) — ENG-907
              · "Recipes in action" Reels rail (Figma `528:105`) — ENG-908
            These have no wired data source yet (curated collections +
            short-form video) and are tracked as net-new builds. The
            chrome/tabs/filters/states that DO exist are reskinned here.
            See `docs/ux/redesign/figma-migration-tracker.md`. */}

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
                // Design Direction 2026 — eating-out mini card routed through SupprCard.
                // flag-gated: elevation ON → soft shadow + no border; OFF → flat border.
                <SupprCard
                  key={m.foodId}
                  role="button"
                  tabIndex={0}
                  onClick={() => onViewTracker?.()}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onViewTracker?.(); }}
                  padding="md"
                  radius="lg"
                  className="shrink-0 w-44 text-left hover:bg-muted transition-colors cursor-pointer"
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
                </SupprCard>
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

            Fit-percent pill: removed by F-45 (2026-04-22) and NOT
            rendered here — see the badge-history note at the top of
            this file. `computeRecipeFitPercent` stays imported for a
            future ranking pass. Web + mobile parity confirmed by
            `tests/unit/recipeCardFitBadge.test.ts`. Mobile equivalent:
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
          <div data-testid="discover-cluster-carousels" className="mt-6 space-y-10">
            {SEED_CLUSTERS.map((cluster) => {
              const items = seedRecipesByCluster.get(cluster.id) ?? [];
              if (items.length === 0) return null;
              return (
                <section
                  key={cluster.id}
                  data-testid={`discover-cluster-${cluster.id}`}
                  aria-label={cluster.title}
                >
                  <h2 className="text-[18px] font-extrabold text-foreground -tracking-[0.02em] px-4 md:px-0 mb-3">
                    {cluster.title}
                  </h2>
                  <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory scroll-pl-4 md:scroll-pl-0">
                    <div className="flex gap-3.5 pb-2" style={{ minWidth: "max-content" }}>
                      {items.map((recipe, idx) => {
                        const kcal = Math.round(recipe.calories);
                        const protein = Math.round(recipe.protein);
                        const cookTime =
                          recipe.cookTime ?? (recipe.cookTimeMin ? `${recipe.cookTimeMin} min` : null);
                        const isHero = idx === 0;
                        return (
                          <button
                            key={`cluster-${recipe.id}`}
                            type="button"
                            onClick={() => setSelectedRecipe(recipe)}
                            className={`group shrink-0 snap-start text-left rounded-3xl overflow-hidden relative cursor-pointer hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5 transition-all duration-200 ease-out ${isHero ? "w-[280px] md:w-[320px]" : "w-[200px] md:w-[240px]"}`}
                          >
                            <div className="relative overflow-hidden" style={{ aspectRatio: isHero ? "3 / 4" : "4 / 5" }}>
                              <DiscoverRecipeImage
                                id={recipe.id}
                                title={recipe.title}
                                image={recipe.image}
                                iconSize={24}
                                aspectRatio={isHero ? "3 / 4" : "4 / 5"}
                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                              <div className="absolute bottom-0 left-0 right-0 p-3.5">
                                <p
                                  className={`font-bold text-white leading-snug -tracking-[0.01em] drop-shadow-sm ${isHero ? "text-[15px]" : "text-[13px]"}`}
                                  style={{
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                  }}
                                >
                                  {recipe.title}
                                </p>
                                <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-1.5 text-[11px] text-white/80 tabular-nums">
                                  <span className="inline-flex items-center gap-1">
                                    <Icons.calories className="w-3 h-3 text-white/70" />
                                    {kcal} kcal
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <Icons.protein className="w-3 h-3 text-white/70" />
                                    {protein}g
                                  </span>
                                  {cookTime ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Icons.time className="w-3 h-3 text-white/70" />
                                      {cookTime}
                                    </span>
                                  ) : null}
                                </div>
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
            className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-8"
          >
            {displayRecipes.map((recipe) => {
              const kcal = Math.round(recipe.calories);
              const protein = Math.round(recipe.protein);
              const carbs = Math.round(recipe.carbs);
              const fat = Math.round(recipe.fat);
              const cookTime = recipe.cookTime ?? (recipe.cookTimeMin ? `${recipe.cookTimeMin} min` : null);
              // Calm the stale curated-seed brand byline to the live
              // brand + drop internal seed sources at the display boundary
              // (see displayAttribution). Mobile parity: discover.tsx uses
              // the same helper.
              const byline = displayAttribution({ creatorName: recipe.creatorName });
              return (
                <button
                  key={`desktop-${recipe.id}`}
                  type="button"
                  id={`discover-desktop-post-${recipe.id}`}
                  onClick={() => setSelectedRecipe(recipe)}
                  className="group text-left rounded-3xl overflow-hidden cursor-pointer w-full relative hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5 transition-all duration-200 ease-out"
                >
                  <div className="relative overflow-hidden" style={{ aspectRatio: recipe.image ? "4 / 5" : "8 / 1" }}>
                    <DiscoverRecipeImage
                      id={recipe.id}
                      title={recipe.title}
                      image={recipe.image}
                      iconSize={28}
                      aspectRatio={recipe.image ? "4 / 5" : "8 / 1"}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                    />
                    {recipe.sourcePlatform ? (
                      <div className="absolute top-3 left-3 z-10">
                        <SourceBadge
                          source={recipe.sourcePlatform}
                          className="text-[9px] px-1.5 py-0.5"
                        />
                      </div>
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p
                        className="text-[15px] font-bold text-white leading-snug -tracking-[0.01em] drop-shadow-sm"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {recipe.title}
                      </p>
                      {byline ? (
                        <p className="text-[11px] text-white/70 mt-1 truncate">
                          {recipe.creatorId ? (
                            <span
                              role="link"
                              tabIndex={0}
                              className="hover:text-white hover:underline cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); router.push(`/creator/${recipe.creatorId}`); }}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); router.push(`/creator/${recipe.creatorId}`); } }}
                            >
                              {byline}
                            </span>
                          ) : (
                            byline
                          )}
                        </p>
                      ) : null}
                      {/* Macro row (recipes.md §3.1) — kcal · protein ·
                          carbs · fat, protein emphasised. Mobile parity:
                          discover.tsx MacroIconRow. Over the photo the
                          macro hue dots are dropped to white/60 for
                          contrast; protein leads via weight. */}
                      <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-2 text-[11px] text-white/80 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Icons.calories className="w-3 h-3 text-white/60" />
                          {kcal} kcal
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-white">
                          <Icons.protein className="w-3 h-3 text-white/60" />
                          {protein}g
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Icons.carbs className="w-3 h-3 text-white/60" />
                          {carbs}g
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Icons.fat className="w-3 h-3 text-white/60" />
                          {fat}g
                        </span>
                        {cookTime ? (
                          <span className="inline-flex items-center gap-1">
                            <Icons.time className="w-3 h-3 text-white/60" />
                            {cookTime}
                          </span>
                        ) : null}
                      </div>
                    </div>
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
            // Aubergine SOFT-TINT nudge card (Sloe treatment §10) — was a stale
            // hardcoded brand-blue; aligned to the aubergine accent + parity
            // with the mobile Discover import card.
            style={{ background: "var(--accent-primary-soft)", borderColor: "var(--accent-primary-ring)" }}
          >
            <IconBox size="lg" tone="primary">
              <Icons.import />
            </IconBox>
            <div className="flex-1">
              {/* Gap-7 fix (2026-06-09): completed brand list — no dangling ellipsis.
                  Mirrors mobile discover.tsx copy change. */}
              <p className="text-[13px] font-semibold text-foreground">Import from TikTok, Instagram &amp; YouTube</p>
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
            {/* ── Recipe ideas (hero cards) ── */}
            <h3 className="text-[13px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground mt-[22px] mb-3 px-4">
              Recipe ideas
            </h3>
            <div className="grid gap-3.5 px-4">
              {displayRecipes.slice(0, 2).map((recipe) => {
                const kcal = Math.round(recipe.calories);
                const protein = Math.round(recipe.protein);
                const carbs = Math.round(recipe.carbs);
                const fat = Math.round(recipe.fat);
                const byline = displayAttribution({ creatorName: recipe.creatorName });
                void computeRecipeFitPercent;
                void nutritionTargets;
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    id={`discover-post-${recipe.id}`}
                    onClick={() => setSelectedRecipe(recipe)}
                    className="group text-left rounded-3xl overflow-hidden cursor-pointer w-full relative hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5 transition-all duration-200 ease-out"
                  >
                    <div className="relative overflow-hidden" style={{ aspectRatio: recipe.image ? "3 / 4" : "8 / 1" }}>
                      <DiscoverRecipeImage
                        id={recipe.id}
                        title={recipe.title}
                        image={recipe.image}
                        iconSize={28}
                        aspectRatio={recipe.image ? "3 / 4" : "8 / 1"}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                      />
                      {recipe.sourcePlatform ? (
                        <div className="absolute top-3 left-3 z-10">
                          <SourceBadge source={recipe.sourcePlatform} className="text-[9px] px-1.5 py-0.5" />
                        </div>
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-[18px] font-bold text-white leading-tight -tracking-[0.01em] drop-shadow-sm" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {recipe.title}
                        </p>
                        {byline ? (
                          <p className="text-[11px] text-white/70 mt-1 truncate">
                            {recipe.creatorId ? (
                              <span
                                role="link"
                                tabIndex={0}
                                className="hover:text-white hover:underline cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); router.push(`/creator/${recipe.creatorId}`); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); router.push(`/creator/${recipe.creatorId}`); } }}
                              >
                                {byline}
                              </span>
                            ) : (
                              byline
                            )}
                          </p>
                        ) : null}
                        {/* Macro row (recipes.md §3.1) — kcal · protein ·
                            carbs · fat, protein emphasised. Mobile parity:
                            discover.tsx MacroIconRow. */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                          <span className="inline-flex items-center gap-1 text-[11px] text-white/80 tabular-nums">
                            <Icons.calories className="w-3 h-3 text-white/60" />
                            {kcal} kcal
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-white tabular-nums font-semibold">
                            <Icons.protein className="w-3 h-3 text-white/60" />
                            {protein}g
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-white/80 tabular-nums">
                            <Icons.carbs className="w-3 h-3 text-white/60" />
                            {carbs}g
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-white/80 tabular-nums">
                            <Icons.fat className="w-3 h-3 text-white/60" />
                            {fat}g
                          </span>
                          {recipe.cookTime ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-white/80">
                              <Icons.time className="w-3 h-3 text-white/60" />
                              {recipe.cookTime}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── More ideas (compact list) — only when there's a 3rd+ */}
            {displayRecipes.length > 2 ? (
              <>
                <h3 className="text-[13px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground mt-[28px] mb-3 px-4">
                  More ideas
                </h3>
                {/* Design Direction 2026 — "More ideas" list container routed through SupprCard. */}
                <SupprCard padding="none" radius="lg" className="mx-4 overflow-hidden">
                  {displayRecipes.slice(2).map((recipe, idx) => {
                    const kcal = Math.round(recipe.calories);
                    const protein = Math.round(recipe.protein);
                    const carbs = Math.round(recipe.carbs);
                    const byline = displayAttribution({ creatorName: recipe.creatorName });
                    return (
                      <button
                        key={recipe.id}
                        type="button"
                        id={`discover-post-${recipe.id}`}
                        onClick={() => setSelectedRecipe(recipe)}
                        className={`w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors ${idx > 0 ? "border-t border-border" : ""}`}
                      >
                        <DiscoverRecipeImage
                          id={recipe.id}
                          title={recipe.title}
                          image={recipe.image}
                          iconSize={18}
                          variant="thumb"
                          className="w-full h-full object-cover"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-semibold text-foreground truncate">
                            {recipe.title}
                          </span>
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {recipe.creatorId ? (
                              <span
                                role="link"
                                tabIndex={0}
                                className="hover:text-primary hover:underline cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); router.push(`/creator/${recipe.creatorId}`); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); router.push(`/creator/${recipe.creatorId}`); } }}
                              >
                                {byline}
                              </span>
                            ) : (
                              byline
                            )}
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
                </SupprCard>
              </>
            ) : null}
          </div>
        ) : showClusterCarousels ? null : (
          <div className="mt-6 mx-4 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center md:mx-0">
            <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-muted">
              <Icons.discover className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Nothing to show</p>
            <p className="text-[13px] text-muted-foreground mb-4 max-w-sm mx-auto">
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
                  setCategory("all");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-transparent border-[1.5px] border-primary-solid px-4 py-2 text-sm font-semibold text-primary-solid hover:bg-primary/5 transition-colors"
              >
                Reset filters
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
        <h3 className="text-[13px] font-bold text-foreground -tracking-[0.01em] mt-[22px] mb-2.5 px-4">
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
          className="mx-4 mt-3 rounded-xl border border-border bg-card p-3.5 flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors card-elevated"
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
