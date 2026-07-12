import { memo, useCallback, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { useAppData } from "../../context/AppDataContext.tsx";
import type { LibraryEntryKind, RecipeCard, UserTier } from "../../types/recipe.ts";
import { RecipeDetail } from "./RecipeDetail";
import { RecipeHeroFallback } from "./suppr/RecipeHeroFallback";
import { recipeUnderlayColor } from "../../lib/recipe/recipeHeroFallback.ts";
import { useFallbackScheme } from "../../lib/theme/useFallbackScheme.ts";
import { SupprButton } from "./suppr/suppr-button";
import { SupprCard } from "./ui/suppr-card";
import { LibraryDesktopHeader } from "./library/LibraryDesktopHeader";
import { LibraryLoadingSkeleton } from "./library/LibraryLoadingSkeleton.tsx";
import { LibraryShelvesHeader } from "./library/LibraryShelvesHeader";
import { useLibraryDiscoverRedirect } from "./library/useLibraryDiscoverRedirect.ts";
import { LibraryCollectionsBar } from "./library/LibraryCollectionsBar.tsx";
import { RecipeCardOverlayControls } from "./library/RecipeCardOverlayControls.tsx";
import { isFeatureEnabled } from "../../lib/analytics/track.ts";
import { formatQualifiedKcal } from "../../lib/nutrition/formatMacro";
import { useRouter } from "next/navigation";
import {
  LIBRARY_CATEGORY_PILLS,
  LIBRARY_PROVENANCE_PILLS,
  matchesRecipeCategory,
  type RecipeCategoryId,
} from "../../lib/recipes/recipeCategoryFilters.ts";
import { classifyLibraryEntry } from "../../lib/recipes/libraryEntryKind.ts";
import {
  matchesPlanImportPill,
  planImportFilterLabels,
  planImportPillId,
} from "../../lib/planning/planImport/libraryFilters.ts";
import { recipeSearchMatch } from "../../lib/recipes/recipeSearchMatch.ts";
import { useLibraryDiscoverSearch } from "../../lib/libraryDiscoverSearchStore.ts";

/**
 * Renders a recipe image with automatic fallback to RecipeHeroFallback
 * when the URL fails to load (e.g. hot-linked external images that
 * return 403/404). Without this, broken images render as blank areas.
 */
function RecipeCardImage({
  src,
  recipeId,
  recipeTitle,
  iconSize = 32,
  className,
  style,
}: {
  src: string;
  recipeId: string;
  recipeTitle: string;
  iconSize?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [broken, setBroken] = useState(false);
  const handleError = useCallback(() => setBroken(true), []);

  if (broken) {
    return <RecipeHeroFallback id={recipeId} title={recipeTitle} iconSize={iconSize} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className}
      style={style}
      onError={handleError}
    />
  );
}

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
  // The explicit override map is populated by AppDataContext when
  // the user create/import flow runs through it locally. It still
  // wins because it captures user intent at write time. The
  // "Unavailable" guard predates the orphan-filtering pass and is
  // kept defensively.
  if (explicit) return explicit;
  if (recipe.creatorName === "Unavailable") return "saved";
  // GW-01 fix (audit 2026-04-28): predicate moved to the shared
  // `src/lib/recipes/libraryEntryKind.ts` so web + mobile use the
  // same rule. Saves win over authorship — see the shared module's
  // header comment for the full rationale (seed-script poisoning of
  // `recipes.author_id`).
  return classifyLibraryEntry(
    {
      isSaved: Boolean(recipe.isSaved),
      authorId: recipe.authorId ?? null,
      sourceUrl: (recipe as { sourceUrl?: string | null }).sourceUrl ?? null,
    },
    userId,
  );
}

function kindBadgeClasses(kind: LibraryEntryKind): string {
  switch (kind) {
    case "created":
      return "bg-primary/10 text-primary-solid";
    case "imported":
      return "bg-warning-soft text-warning-solid";
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

export const Library = memo(function Library({ userTier, onUpgrade: _onUpgrade, onGoDiscover }: LibraryProps) {
  const { savedRecipesForLibrary, libraryDataReady, libraryEntryKindByRecipeId, userId, duplicateRecipeToCreatedDraft, toggleSaveRecipe, nutritionTargets, collectionMembershipByRecipeId } = useAppData();
  const uid = userId;
  const router = useRouter();
  const fallbackScheme = useFallbackScheme(); // ENG-1528 — dark ramp underlay on dark cards
  const [selectedRecipe, setSelectedRecipe] = useState<(RecipeCard & { savedAt: Date }) | null>(null);
  // Shared with DiscoverFeed via `useLibraryDiscoverSearch` so the
  // query survives view switches (ENG-53, 2026-05-16). Variable names
  // kept (searchQuery / setSearchQuery) so all 10+ downstream usages
  // — filter loops, render of the input, clear-button — stay untouched.
  const { query: searchQuery, setQuery: setSearchQuery } = useLibraryDiscoverSearch();

  // ENG-100 empty-library → Discover, guarded on `libraryDataReady` so a
  // transiently-empty list on a cold load can never bounce a user with
  // recipes to Discover (ENG-1313 — rationale lives in the hook).
  useLibraryDiscoverRedirect({
    ready: libraryDataReady,
    savedCount: savedRecipesForLibrary.length,
    onGoDiscover,
  });
  // ENG-921 (Grace) — CATEGORY filters per Figma `527:2`, shared with mobile via
  // `recipeCategoryFilters.ts`. ENG-1247 (Grace 2026-06-26 "Both rows") re-added
  // the entry-kind buckets as the visible provenance row above the category row.
  const [category, setCategory] = useState<RecipeCategoryId>("all");
  // Secondary entry-kind filter — null = no entry-kind narrowing.
  const [entryKind, setEntryKind] = useState<"saved" | "imported" | "created" | null>(null);
  // ENG-653 — contextual "Imported plans" source pill (refines the Imported
  // entry-kind; mobile parity). Holds a `plan-import:<source>` id or null;
  // only meaningful when `entryKind === "imported"`.
  const [planImportPill, setPlanImportPill] = useState<string | null>(null);
  const collectionsEnabled = isFeatureEnabled("recipe_collections_v1"); // ENG-1126
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  // Mobile parity: a cycle button switches the sort key between
  // Recent (default) / Calories / Protein. See
  // `apps/mobile/app/(tabs)/library.tsx` 24-57.
  const [sortKey, setSortKey] = useState<"recent" | "calories" | "protein">("recent");
  const cycleSort = () => {
    setSortKey((prev) =>
      prev === "recent" ? "calories" : prev === "calories" ? "protein" : "recent",
    );
  };
  const sortLabel = sortKey === "recent" ? "Recent" : sortKey === "calories" ? "Calories" : "Protein";

  // ENG-653 — unique plan-import source labels for the contextual pill row.
  const importPlanPills = useMemo(
    () => planImportFilterLabels(savedRecipesForLibrary.map((r) => r.sourceName)),
    [savedRecipesForLibrary],
  );

  const filteredRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = savedRecipesForLibrary;
    if (q) {
      list = list.filter((r) =>
        recipeSearchMatch(
          {
            title: r.title,
            creatorName: r.creatorName,
            tags: r.mealSlots ?? null,
          },
          q,
        ),
      );
    }
    // Primary: category (Figma `527:2`). Reuses the shared predicate so
    // web + mobile classify identically.
    if (category !== "all") {
      list = list.filter((r) => matchesRecipeCategory(category, r));
    }
    // Secondary: entry-kind (Saved / Imported) — preserved per ENG-921.
    if (entryKind) {
      list = list.filter(
        (r) => entryKindForRecipe(r, libraryEntryKindByRecipeId[r.id], uid) === entryKind,
      );
    }
    // ENG-653: contextual plan-import source refinement (only under Imported).
    if (entryKind === "imported" && planImportPill) {
      list = list.filter((r) => matchesPlanImportPill(planImportPill, r.sourceName));
    }
    if (selectedCollectionId) { // ENG-1126
      list = list.filter((r) => (collectionMembershipByRecipeId[r.id] ?? []).includes(selectedCollectionId));
    }
    // Apply sort. Higher-is-better for Calories / Protein; Recent uses
    // `savedAt` if present (some entries don't carry it — those go to
    // the bottom). Stable ordering for ties via slice() before sort.
    const sorted = list.slice();
    if (sortKey === "calories") {
      sorted.sort((a, b) => (b.calories ?? 0) - (a.calories ?? 0));
    } else if (sortKey === "protein") {
      sorted.sort((a, b) => (b.protein ?? 0) - (a.protein ?? 0));
    } else {
      // recent — default order from context is already created_at desc,
      // so no-op (just preserve existing order).
    }
    return sorted;
  }, [savedRecipesForLibrary, searchQuery, category, entryKind, planImportPill, selectedCollectionId, collectionMembershipByRecipeId, libraryEntryKindByRecipeId, uid, sortKey]);

  // ENG-1313: the loading state IS the Library skeleton — never Discover.
  if (!libraryDataReady && savedRecipesForLibrary.length === 0) return <LibraryLoadingSkeleton />;
  if (selectedRecipe) {
    return (
      <RecipeDetail
        recipe={selectedRecipe}
        userTier={userTier}
        onBack={() => setSelectedRecipe(null)}
        onUpgrade={_onUpgrade}
      />
    );
  }

  return (
    <div className="product-shell py-pm-6 space-y-5">
      {/* Header
          2026-04-20 desktop prototype port
          (`docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
          `WebLibrary`): at `md+` the legacy "Library" title + saved
          pill row collapses into the prototype-matching "Library" +
          "{n} recipes · sorted by {sortLabel}" header. Below `md` the
          mobile-web pill row is preserved so narrow-width parity with
          the mobile tab stays intact. */}
      <div className="mb-4">
        <LibraryDesktopHeader
          recipeCount={filteredRecipes.length}
          sortLabel={sortLabel}
        />

        {/* Search and Filter */}
        {/* Audit 2026-04-30 visual-qa P1 #10 — stack search (row 1) above the
            filter pills (row 2) at every breakpoint; the prior side-by-side
            `flex` broke when pills wrapped to two rows. */}
        <div className="flex flex-col gap-3 mt-6">
          {/* Search field — Figma `527:2`: cream-card pill, line border,
              magnifier prefix. "Search your recipes" placeholder. */}
          <div className="relative group">
            <Icons.search className="w-[18px] h-[18px] absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search your recipes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
          {/* Provenance row — v3 Cookbook (All/Saved/Created/Imported), ENG-1247
              "Both rows" (Grace); writes `entryKind`. Mobile parity. */}
          <div
            data-testid="library-provenance-pills"
            className="flex flex-nowrap md:flex-wrap gap-2 items-center overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden mb-2"
          >
            {LIBRARY_PROVENANCE_PILLS.map((p) => {
              const active = p.id === "all" ? entryKind === null : entryKind === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`library-provenance-${p.id}`}
                  onClick={() => {
                    setPlanImportPill(null);
                    setEntryKind(p.id === "all" ? null : p.id);
                  }}
                  className={[
                    "shrink-0 inline-flex items-center px-4 py-2 min-h-8 rounded-full text-[13px] transition-all whitespace-nowrap",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    active
                      ? "bg-primary-soft text-primary-solid font-semibold"
                      : "bg-card text-muted-foreground font-medium hover:bg-muted/60",
                  ].join(" ")}
                  aria-pressed={active}
                  aria-label={`Source: ${p.label}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {/* Category pills — ENG-921/Figma 527:2 (meal types · Quick 30 · …); provenance is the row above (ENG-1247). Padding snapped px-3.5→px-4 (ENG-1280) to match Discover's on-scale 16px; the ENG-921 squish-fix was vertical-only (py-2 min-h-8) so this doesn't regress it. */}
          <div
            data-testid="library-filter-pills"
            className="flex flex-nowrap md:flex-wrap gap-2 items-center overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {LIBRARY_CATEGORY_PILLS.map((f) => {
              const active = category === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  data-testid={`library-category-${f.id}`}
                  onClick={() => setCategory(f.id)}
                  className={[
                    "shrink-0 inline-flex items-center px-4 py-2 min-h-8 rounded-full text-[13px] transition-all whitespace-nowrap",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    // Chip grammar (ENG-1022): selected = bg-primary-soft + primary-solid label + font-semibold, no border; unselected = quiet bg-card + muted, no border. Shared with the provenance row above.
                    active
                      ? "bg-primary-soft text-primary-solid font-semibold"
                      : "bg-card text-muted-foreground font-medium hover:bg-muted/60",
                  ].join(" ")}
                  aria-pressed={active}
                  aria-label={`Category: ${f.label}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          {/* ENG-653 — contextual "Imported plans" source pills. A
              refinement of the Imported entry-kind, so they only reveal when
              Imported is active AND the user actually has plan imports. This
              keeps the default Library at a single filter row (categories)
              while preserving plan-import filtering. Mobile parity:
              `apps/mobile/app/(tabs)/library.tsx` (contextual plan-import
              pills under the category row). */}
          {entryKind === "imported" && importPlanPills.length > 0 ? (
            <div
              data-testid="library-plan-import-pills"
              className="flex flex-nowrap md:flex-wrap gap-2 items-center overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {importPlanPills.map((label) => {
                const id = planImportPillId(label);
                const active = planImportPill === id;
                const short = label.replace(/^Imported · /, "");
                return (
                  <button
                    key={id}
                    type="button"
                    data-testid={`library-plan-import-${id}`}
                    onClick={() => setPlanImportPill(active ? null : id)}
                    aria-pressed={active}
                    aria-label={`Filter imported plan: ${short}`}
                    className={[
                      "shrink-0 inline-flex items-center px-4 py-2 min-h-8 rounded-full text-[13px] transition-all whitespace-nowrap",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      active
                        ? "bg-primary-soft text-primary-solid font-semibold"
                        : "bg-card text-muted-foreground font-medium hover:bg-muted/60",
                    ].join(" ")}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
          ) : null}
          {/* ENG-1126 — collections, flag-gated, old path unaffected. */}
          {collectionsEnabled ? (
            <LibraryCollectionsBar selectedCollectionId={selectedCollectionId} onSelectCollection={setSelectedCollectionId} />
          ) : null}
          {/* Count line + quiet controls — Figma `527:2` ("24 saved
              recipes"). Mobile-web only (desktop shows a subtitle in its
              header). The calm count sits left; the entry-kind narrowing
              (All / Saved / Imported) + sort cycle ride as quiet trailing
              controls so the saved-vs-imported distinction stays reachable
              WITHOUT a competing second pill row. */}
          <div className="md:hidden flex items-center justify-between gap-3">
            <p
              data-testid="library-count-line"
              className="text-[13px] text-muted-foreground tabular-nums"
            >
              {entryKind === "saved"
                ? `${filteredRecipes.length} saved ${filteredRecipes.length === 1 ? "recipe" : "recipes"}`
                : `${filteredRecipes.length} ${filteredRecipes.length === 1 ? "recipe" : "recipes"}`}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Sort cycle — mobile parity (`cycleSort`): Recent →
                  Calories → Protein → Recent. */}
              <button
                type="button"
                onClick={cycleSort}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/60 transition-colors whitespace-nowrap"
                aria-label={`Sort by ${sortLabel}, tap to change`}
              >
                <Icons.adjust className="w-3 h-3" aria-hidden />
                {sortLabel}
              </button>
              {/* ENG-1197 — persistent create entry on the count row (parity
                  with the mobile "+" glyph). The redesign left web with no
                  create affordance once the library is non-empty. */}
              <button
                type="button"
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("view", "create");
                  window.history.pushState({}, "", url.toString());
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
                className="inline-flex items-center justify-center rounded-full border border-border w-7 h-7 text-muted-foreground hover:bg-muted/60 transition-colors"
                aria-label="Create a new recipe"
              >
                <Icons.add className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State — Figma S7 (`529:2`): dashed cream slab, frost-mist
          icon badge, serif heading, stacked clay + outline pill CTAs.
          The "no matches after filter" case (library is non-empty but
          the active category/search empties it) keeps a lighter inline
          variant so the user can clear the filter. */}
      {filteredRecipes.length === 0 && savedRecipesForLibrary.length === 0 && (
        <div
          data-testid="library-empty-state"
          className="bg-card border border-dashed border-border rounded-2xl px-8 py-12 text-center max-w-md mx-auto"
        >
          <span className="w-14 h-14 rounded-full bg-foreground-brand/10 flex items-center justify-center text-foreground-brand mx-auto mb-4">
            <Icons.saved className="w-6 h-6" />
          </span>
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-medium text-foreground">
            No saved recipes yet
          </h2>
          <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed max-w-[260px] mx-auto">
            Import from a Reel or TikTok, create your own, or browse Discover to start your collection.
          </p>
          <div className="flex flex-col gap-2.5 mt-6 max-w-[280px] mx-auto">
            {/* Button system (2026-06-12): the empty-library card's ONE primary
                action → `SupprButton` variant="primary" (solid aubergine fill,
                white label + glyph, pill, no border/shadow). Supersedes the old
                aubergine-OUTLINE treatment. Mirror of mobile library empty-state
                `ctaBtn`. "Explore Discover" stays the quieter secondary below. */}
            <SupprButton
              variant="primary"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("view", "import");
                window.history.pushState({}, "", url.toString());
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              className="w-full gap-2"
              aria-label="Import a recipe"
            >
              <Icons.import className="w-4 h-4" aria-hidden />
              Import a recipe
            </SupprButton>
            {/* ENG-1197 — restore the orphaned "create your own" entry on web
                (parity with mobile). The redesign left web with NO create entry
                at all; `view=create` → RecipeUpload mode="create" (text + photo). */}
            <button
              type="button"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("view", "create");
                window.history.pushState({}, "", url.toString());
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              className="w-full bg-background border border-border text-foreground font-semibold text-sm rounded-full py-3 inline-flex items-center justify-center gap-2 hover:bg-muted/60 transition-colors"
              aria-label="Create your own recipe"
            >
              <Icons.create className="w-4 h-4" aria-hidden />
              Create your own
            </button>
            {onGoDiscover ? (
              <button
                type="button"
                onClick={onGoDiscover}
                className="w-full bg-background border border-border text-foreground font-semibold text-sm rounded-full py-3 inline-flex items-center justify-center gap-2 hover:bg-muted/60 transition-colors"
              >
                <Icons.discover className="w-4 h-4" aria-hidden />
                Explore Discover
              </button>
            ) : null}
          </div>
        </div>
      )}
      {filteredRecipes.length === 0 && savedRecipesForLibrary.length > 0 && (
        <div className="text-center py-16 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Icons.search className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-foreground">No matches</h3>
          <p className="text-muted-foreground mb-5 text-sm">
            Try another search term, category, or clear the filters.
          </p>
          {/* Button system (2026-06-12): a secondary "reset" action on a
              no-matches state → `SupprButton` variant="ghost" (transparent, no
              border, plum label). Supersedes the old aubergine-OUTLINE
              treatment. Mirror: no mobile equivalent — mobile shows a search-
              only empty state with no Clear-filters control. */}
          <SupprButton
            variant="ghost"
            onClick={() => {
              setCategory("all");
              setEntryKind(null);
              setSearchQuery("");
            }}
          >
            Clear filters
          </SupprButton>
        </div>
      )}

      {/* ENG-1225 Block 5 — v3 editorial shelves above the grid (All only).
          Self-gating; the shelf recipes carry savedAt (from filteredRecipes)
          so the open cast is safe. The sloe_v3_editorial_shelves flag that
          gated this was collapsed as always-on in ENG-1356. */}
      <LibraryShelvesHeader
        filtered={filteredRecipes}
        category={category}
        onPressRecipe={(r) => setSelectedRecipe(r as RecipeCard & { savedAt: Date })}
      />
      {/* Recipe grid — Sloe Figma `527:2` unified card layout (ENG-896).
          One responsive grid (2-col mobile-web, 3-col desktop). Square hero,
          bookmark overlay, macro row, saves/time meta — mobile parity. */}
      {filteredRecipes.length > 0 && (
        <>
          <div
            data-testid="library-recipe-grid"
            className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredRecipes.map((recipe) => {
              const kind = entryKindForRecipe(recipe, libraryEntryKindByRecipeId[recipe.id], uid);
              const kcal = Math.round(recipe.calories ?? 0);
              const protein = Math.round(recipe.protein ?? 0);
              const carbs = Math.round(recipe.carbs ?? 0);
              const fat = Math.round(recipe.fat ?? 0);
              const totalTime = (typeof recipe.prepTimeMin === "number" ? recipe.prepTimeMin : 0) + (typeof recipe.cookTimeMin === "number" ? recipe.cookTimeMin : 0);
              // `★ N` uses the REAL saves count (`savedCount`) — there is no
              // rating field on RecipeCard, so we never fabricate a 4.8-style
              // score (would trip recipeCardNoScore.test.ts + the trust
              // posture). The star pairs with the honest popularity signal.
              const saves = typeof recipe.savedCount === "number" ? recipe.savedCount : 0;
              return (
                <SupprCard
                  key={recipe.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRecipe(recipe)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedRecipe(recipe);
                  }}
                  padding="none"
                  radius="lg"
                  elevation="card"
                  border={false}
                  className="group overflow-hidden text-left cursor-pointer transition-all"
                >
                  {/* ENG-1374 PR 2 — opaque cuisine-tint underlay on the wrapper (never page white) */}
                  <div className="relative overflow-hidden" style={{ aspectRatio: "1 / 1", backgroundColor: recipeUnderlayColor({ id: recipe.id, title: recipe.title }, fallbackScheme) }}>
                    {recipe.image ? (
                      <RecipeCardImage
                        src={recipe.image}
                        recipeId={recipe.id}
                        recipeTitle={recipe.title}
                        iconSize={30}
                        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                        style={{ viewTransitionName: `recipe-${recipe.id}-image` }}
                      />
                    ) : (
                      <div className="w-full h-full" style={{ viewTransitionName: `recipe-${recipe.id}-image` }}>
                        <RecipeHeroFallback id={recipe.id} title={recipe.title} iconSize={30} />
                      </div>
                    )}
                    <RecipeCardOverlayControls
                      recipe={recipe}
                      kind={kind}
                      userTier={userTier}
                      toggleSaveRecipe={toggleSaveRecipe}
                      collectionsEnabled={collectionsEnabled}
                    />
                  </div>
                  <div className="px-1 pt-2.5 pb-1">
                    <h3 className="font-[family-name:var(--font-headline)] text-[15px] font-medium leading-snug text-foreground line-clamp-2">
                      {recipe.title}
                    </h3>
                    {/* Macro row (recipes.md §3.1) — kcal · protein · carbs · fat
                        in the immutable macro colours, protein emphasised. kcal
                        suppressed at ≤0 so an un-computed recipe never shows a
                        confident "0 kcal" (trust posture). Narrow 2-col card → no
                        letters (hue + icon carry meaning, protein leads). Mobile
                        parity: apps/mobile/app/(tabs)/library.tsx MacroIconRow. */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground tabular-nums">
                      {kcal > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Icons.calories className="w-[11px] h-[11px]" style={{ color: "var(--macro-calories)" }} aria-hidden />
                          {isFeatureEnabled("kcal_trust_qualifier_v1") ? formatQualifiedKcal(kcal, recipe.isVerified) : String(kcal)}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                        <Icons.protein className="w-[11px] h-[11px]" style={{ color: "var(--macro-protein)" }} aria-hidden />
                        {protein}g
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icons.carbs className="w-[11px] h-[11px]" style={{ color: "var(--macro-carbs)" }} aria-hidden />
                        {carbs}g
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icons.fat className="w-[11px] h-[11px]" style={{ color: "var(--macro-fat)" }} aria-hidden />
                        {fat}g
                      </span>
                    </div>
                    {/* Meta row — Figma `527:2` shape `★ N · M min`, but
                        every chip is REAL + degrades gracefully:
                          • saves chip only when savedCount > 0 (no `★ 0`),
                          • time chip only when total time > 0,
                          • if neither exists, fall back to the honest
                            serving count so the row never reads empty or
                            shows a fabricated rating. */}
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
                      {saves > 0 ? (
                        <span role="img" className="inline-flex items-center gap-1" aria-label={`${saves} ${saves === 1 ? "save" : "saves"}`}>
                          <Icons.star className="w-[13px] h-[13px] text-primary fill-primary" aria-hidden />
                          {saves}
                        </span>
                      ) : null}
                      {saves > 0 && totalTime > 0 ? <span aria-hidden>·</span> : null}
                      {totalTime > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Icons.time className="w-[12px] h-[12px]" aria-hidden />
                          {totalTime} min
                        </span>
                      ) : null}
                      {saves === 0 && totalTime === 0 ? (
                        <span>{recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}</span>
                      ) : null}
                    </div>
                    {kind === "created" && recipe.isPublished === false ? (
                      <SupprButton
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const q = new URLSearchParams({ view: "create", editRecipe: recipe.id }).toString();
                          router.replace(`/home?${q}`, { scroll: false });
                        }}
                        className="mt-3 h-auto px-2.5 py-1 text-[11px]"
                      >
                        Go public
                      </SupprButton>
                    ) : null}
                    {kind === "imported" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void (async () => {
                            const newId = await duplicateRecipeToCreatedDraft(recipe.id);
                            if (!newId) return;
                            const q = new URLSearchParams({ view: "create", editRecipe: newId }).toString();
                            router.replace(`/home?${q}`, { scroll: false });
                          })();
                        }}
                        className="mt-3 inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-warning text-foreground text-[11px] font-semibold hover:opacity-90"
                      >
                        Create your own version
                      </button>
                    ) : null}
                  </div>
                </SupprCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});
