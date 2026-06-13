import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { useAppData } from "../../context/AppDataContext.tsx";
import type { LibraryEntryKind, RecipeCard, UserTier } from "../../types/recipe.ts";
import { RecipeDetail } from "./RecipeDetail";
import { RecipeHeroFallback } from "./suppr/RecipeHeroFallback";
import { SupprButton } from "./suppr/suppr-button";
import { SupprCard } from "./ui/suppr-card";
import { useRouter } from "next/navigation";
import {
  LIBRARY_CATEGORY_PILLS,
  matchesRecipeCategory,
  type RecipeCategoryId,
} from "../../lib/recipes/recipeCategoryFilters.ts";
import { classifyLibraryEntry } from "../../lib/recipes/libraryEntryKind.ts";
import { computeRecipeFitPercent } from "../../lib/nutrition/recipeFitPercent.ts";
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

export const Library = memo(function Library({ userTier, onUpgrade: _onUpgrade, onGoDiscover }: LibraryProps) {
  const { savedRecipesForLibrary, libraryEntryKindByRecipeId, userId, duplicateRecipeToCreatedDraft, toggleSaveRecipe, nutritionTargets } = useAppData();
  const uid = userId;
  const router = useRouter();
  const [selectedRecipe, setSelectedRecipe] = useState<(RecipeCard & { savedAt: Date }) | null>(null);
  // Shared with DiscoverFeed via `useLibraryDiscoverSearch` so the
  // query survives view switches (ENG-53, 2026-05-16). Variable names
  // kept (searchQuery / setSearchQuery) so all 10+ downstream usages
  // — filter loops, render of the input, clear-button — stay untouched.
  const { query: searchQuery, setQuery: setSearchQuery } = useLibraryDiscoverSearch();

  // ENG-100 (2026-05-16, Grace decision = "default to Discover only"):
  // Library is empty for new users — the first thing a user sees when
  // they click into the Recipes group is a blank slate that doesn't
  // tell the product story. Redirect to /discover while saved
  // recipes = 0. After the first save, the normal Library landing
  // kicks in. Mirrors the mobile `useFocusEffect` in
  // `apps/mobile/app/(tabs)/library.tsx`.
  useEffect(() => {
    if (savedRecipesForLibrary.length === 0 && onGoDiscover) {
      onGoDiscover();
    }
  }, [savedRecipesForLibrary.length, onGoDiscover]);
  // ENG-921 (2026-06-07, Grace) — CATEGORY filters per Figma `527:2`
  // (All · Breakfast · Lunch · Dinner · Dessert · Quick 30 · Under 500
  // cal · High protein · Soup · Pasta · Chicken · Salad), shared with
  // mobile via `recipeCategoryFilters.ts`. The entry-kind buckets
  // (Saved / Imported) are NOT lost — ENG-921 polish (2026-06-07) folds
  // them into a single quiet segmented control in the header (above the
  // category row) instead of a competing second pill row, so the user
  // can still narrow by how a recipe entered their library.
  const [category, setCategory] = useState<RecipeCategoryId>("all");
  // Secondary entry-kind filter — null = no entry-kind narrowing.
  const [entryKind, setEntryKind] = useState<"saved" | "imported" | null>(null);
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

  const filteredRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = savedRecipesForLibrary;
    if (q) {
      list = list.filter(
        (r) => r.title.toLowerCase().includes(q) || r.creatorName.toLowerCase().includes(q),
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
  }, [savedRecipesForLibrary, searchQuery, category, entryKind, libraryEntryKindByRecipeId, uid, sortKey]);

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
        <div className="hidden md:block mb-6">
          <h1
            className="text-[24px] font-bold text-foreground -tracking-[0.02em]"
            data-testid="library-desktop-title"
          >
            Library
          </h1>
          <p
            className="text-[13px] text-muted-foreground mt-0.5 tabular-nums"
            data-testid="library-desktop-subtitle"
          >
            {`${filteredRecipes.length} recipe${filteredRecipes.length === 1 ? "" : "s"} · sorted by ${sortLabel.toLowerCase()}`}
          </p>
        </div>

        {/* Search and Filter */}
        {/* Audit 2026-04-30 visual-qa P1 #10 — at md+, the prior
            `flex gap-3` placed the search input and the pill row
            side-by-side. When pills wrapped to two rows, the search
            input stayed at one row, so the heights diverged and the
            layout looked broken. Stack vertically at every breakpoint
            now: search on row 1, filter pills on row 2. */}
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
          {/* Category filter pills — ENG-921 / Figma `527:2`. The SINGLE
              primary filter row: `All`(clay) · Breakfast · Lunch · Dinner ·
              Dessert · Quick 30 · … Clay-fill active, cream-card +
              line-border inactive, horizontal scroll. The old second
              entry-kind pill row is gone (ENG-921 / Figma 527:2 polish
              2026-06-07) — "Saved" is now expressed by the bookmark overlay
              on the card, and the Saved/Imported narrowing rides the quiet
              control on the count line below. Sort + entry-kind are NOT a
              second filter row. Mobile parity:
              `apps/mobile/app/(tabs)/library.tsx`. */}
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
                    "shrink-0 inline-flex items-center px-3.5 py-2 min-h-8 rounded-full text-[13px] transition-all whitespace-nowrap",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    // Chip grammar (web parity 2026-06-10, ENG-1022): selected =
                    // `bg-primary-soft` fill + `primary-solid` label +
                    // `font-semibold`, NO ring/border; unselected = quiet
                    // `bg-card` + muted label, NO border. The old
                    // `border border-primary-solid` selected ring + the
                    // unselected `border border-border` were the chip drift.
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
              {/* Entry-kind cycle (preserved per ENG-921): All → Saved →
                  Imported → All. A quiet text control, NOT a pill row. */}
              <button
                type="button"
                data-testid="library-entrykind-cycle"
                onClick={() =>
                  setEntryKind((prev) =>
                    prev === null ? "saved" : prev === "saved" ? "imported" : null,
                  )
                }
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/60 transition-colors whitespace-nowrap"
                aria-label={`Showing ${entryKind ?? "all"} recipes, tap to change`}
              >
                <Icons.filter className="w-3 h-3" aria-hidden />
                {entryKind === "saved" ? "Saved" : entryKind === "imported" ? "Imported" : "All"}
              </button>
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
            Save a recipe from a Reel or TikTok, or browse Discover to start your collection.
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

      {/* Recipe Grid
          2026-04-20 desktop prototype port
          (`docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
          `WebLibrary`). Two variants:

          - Desktop (`md+`): prototype-flat grid. 4:3 hero, title
            + source + kcal/P/time meta row with lucide icons, kind
            pill + Draft chip + kcal pill overlay preserved from
            live (Grace's mix-and-match rule: keep the stronger
            live affordances, adopt prototype structure). Saved-kind
            cards also render a bookmark dot top-right for quick
            visual scan. Fit-% pill renders primary-tinted in the
            top-right of the card body, parity with Discover's
            2026-04-20 port.
          - Mobile-web (`< md`): retains the live card layout
            (author row + P/C/F chips + large image). Mobile users
            on the native app get a fully-styled prototype card;
            this mobile-WEB path is an intermediate state until the
            narrow-viewport port lands. The sort/filter behaviours
            are identical across both. */}
      {filteredRecipes.length > 0 && (
        <>
          {/* Desktop (≥ md) — prototype-flat grid */}
          <div
            data-testid="library-desktop-grid"
            className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filteredRecipes.map((recipe) => {
              const kind = entryKindForRecipe(recipe, libraryEntryKindByRecipeId[recipe.id], uid);
              const kcal = Math.round(recipe.calories ?? 0);
              const protein = Math.round(recipe.protein ?? 0);
              const carbs = Math.round(recipe.carbs ?? 0);
              const fat = Math.round(recipe.fat ?? 0);
              const totalTime =
                (typeof recipe.prepTimeMin === "number" ? recipe.prepTimeMin : 0) +
                (typeof recipe.cookTimeMin === "number" ? recipe.cookTimeMin : 0);
              const fitPct = computeRecipeFitPercent(
                {
                  calories: recipe.calories,
                  protein: recipe.protein,
                  carbs: recipe.carbs,
                  fat: recipe.fat,
                },
                nutritionTargets
                  ? {
                      calories: nutritionTargets.calories,
                      protein: nutritionTargets.protein,
                      carbs: nutritionTargets.carbs,
                      fat: nutritionTargets.fat,
                    }
                  : null,
              ).percent;
              // Design Direction 2026: flat bg-card border card → SupprCard (flag-gated internally).
              return (
                <SupprCard
                  key={`desktop-${recipe.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRecipe(recipe)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedRecipe(recipe);
                  }}
                  padding="none"
                  radius="lg"
                  elevation="card"
                  className="group text-left overflow-hidden cursor-pointer w-full transition-all"
                >
                  <div className="relative overflow-hidden" style={{ aspectRatio: "4 / 3" }}>
                    {/* Phase 5 / B5 (2026-04-27) — view-transition-name
                        on the card image so the recipe-card → detail
                        morph (spec §1.1) has a continuous geometry
                        anchor. Browsers without the View Transitions
                        API (Firefox today) ignore the property — no
                        regression. The matching name lives on the
                        detail hero (RecipeDetail.tsx). */}
                    {recipe.image ? (
                      <RecipeCardImage
                        src={recipe.image}
                        recipeId={recipe.id}
                        recipeTitle={recipe.title}
                        iconSize={32}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        style={{ viewTransitionName: `recipe-${recipe.id}-image` }}
                      />
                    ) : (
                      <div
                        className="w-full h-full"
                        style={{ viewTransitionName: `recipe-${recipe.id}-image` }}
                      >
                        <RecipeHeroFallback id={recipe.id} title={recipe.title} iconSize={32} />
                      </div>
                    )}
                    <div
                      className={`absolute top-3 left-3 px-2 py-0.5 rounded-md text-[11px] font-semibold shadow-sm ${kindBadgeClasses(kind)}`}
                    >
                      {kindLabel(kind)}
                    </div>
                    {kind !== "saved" && recipe.isPublished === false ? (
                      <div className="absolute top-3 left-[5.5rem] px-2 py-0.5 rounded-md text-[11px] font-semibold shadow-sm bg-foreground/80 text-background">
                        Draft
                      </div>
                    ) : null}
                    {kind === "saved" ? (
                      <div
                        data-testid={`library-saved-dot-${recipe.id}`}
                        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/95 backdrop-blur-sm grid place-items-center shadow-sm"
                        aria-label="Saved"
                      >
                        <Icons.saved className="w-[14px] h-[14px] text-primary" />
                      </div>
                    ) : (
                      <div className="absolute top-3 right-3 px-2.5 py-1 bg-card/95 backdrop-blur-sm rounded-md text-[11px] font-semibold shadow-sm text-foreground tabular-nums">
                        {kcal} kcal
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 relative">
                    <span
                      data-testid={`library-fit-${recipe.id}`}
                      className="absolute top-3 right-3 inline-flex items-center rounded-full bg-primary/15 text-primary text-[11px] font-semibold px-2 py-0.5 tabular-nums"
                    >
                      {fitPct}%
                    </span>
                    <p
                      className="text-[13px] font-bold text-foreground leading-snug -tracking-[0.01em] pr-12"
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
                      {recipe.creatorName}
                    </p>
                    {/* Macro row (recipes.md §3.1) — kcal · protein ·
                        carbs · fat in the immutable macro colours, protein
                        emphasised (heavier + ink) so the card reads as a
                        tracker. kcal suppressed at ≤0 so an un-computed
                        recipe never shows a confident "0 kcal" (trust
                        posture). Mobile parity:
                        `apps/mobile/app/(tabs)/library.tsx` MacroIconRow.
                        text-[11px] = DS §2.2 caption ramp. Was text-[11px]
                        which is below the 12pt caption floor on the scale. */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[11px] text-muted-foreground tabular-nums">
                      {kcal > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Icons.calories
                            className="w-[11px] h-[11px]"
                            style={{ color: "var(--macro-calories)" }}
                          />
                          {kcal} kcal
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
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
                      {totalTime > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Icons.time className="w-[11px] h-[11px] text-muted-foreground" />
                          {totalTime} min
                        </span>
                      ) : null}
                    </div>
                    {/* GW-08 (audit 2026-04-28): TrustChip removed —
                        the chip's source was fabricated from
                        `recipe.isVerified`, which the importer writes
                        unconditionally on any LLM extract that produced
                        non-zero calories. Restore once real per-recipe
                        match-source data is plumbed (P1/P2 GW-08 work). */}
                    {/* Preserved secondary actions — Go public / Create
                        your own version. Kept reachable on desktop
                        per the parity requirement; rendered as small
                        inline chips beneath the meta row. */}
                    {kind === "created" && recipe.isPublished === false ? (
                      // Button system (2026-06-12): "Go public" is a secondary
                      // per-card action → `SupprButton` variant="ghost"
                      // (transparent, no border, plum label). Supersedes the old
                      // aubergine-OUTLINE chip. Mirror of mobile `goPublicBtn`.
                      // Sized down (h-auto + caption type) to read as an inline
                      // card chip, not a full-width CTA.
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

          {/* Mobile-web (< md) — Sloe Figma `527:2` 2-column photo grid.
              Each card: full-bleed photo (rounded, ~172px), bookmark
              overlay top-right, then title (serif) + `★ saves · time`
              meta row. NO macro numbers, NO "..." overflow, NO kind badge
              chrome on the card — those live in the detail screen now. The
              saved-vs-imported distinction is expressed by the bookmark
              overlay (saved → filled clay) + the quiet entry-kind control
              on the count line above. Mobile parity:
              `apps/mobile/app/(tabs)/library.tsx`. */}
          <div
            data-testid="library-mobile-grid"
            className="grid grid-cols-2 gap-4 md:hidden"
          >
            {filteredRecipes.map((recipe) => {
              const kind = entryKindForRecipe(recipe, libraryEntryKindByRecipeId[recipe.id], uid);
              const kcal = Math.round(recipe.calories ?? 0);
              const protein = Math.round(recipe.protein ?? 0);
              const carbs = Math.round(recipe.carbs ?? 0);
              const fat = Math.round(recipe.fat ?? 0);
              const totalTime =
                (typeof recipe.prepTimeMin === "number" ? recipe.prepTimeMin : 0) +
                (typeof recipe.cookTimeMin === "number" ? recipe.cookTimeMin : 0);
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
                  <div className="relative overflow-hidden" style={{ aspectRatio: "1 / 1" }}>
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
                      <div
                        className="w-full h-full"
                        style={{ viewTransitionName: `recipe-${recipe.id}-image` }}
                      >
                        <RecipeHeroFallback id={recipe.id} title={recipe.title} iconSize={30} />
                      </div>
                    )}
                    {/* Bookmark overlay — circular translucent, top-right.
                        Filled clay when saved; outline when not (e.g. an
                        imported recipe you authored but un-saved — bookmark
                        stays honest per composeLibraryEntries F-7). Tapping
                        toggles the save without opening the recipe. */}
                    <button
                      type="button"
                      data-testid={`library-bookmark-${recipe.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleSaveRecipe(recipe.id, userTier, kind);
                      }}
                      className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm grid place-items-center shadow-md ring-1 ring-black/5 hover:bg-white transition-colors"
                      aria-pressed={recipe.isSaved}
                      aria-label={recipe.isSaved ? `Saved: ${recipe.title}. Tap to remove` : `Save ${recipe.title}`}
                    >
                      {recipe.isSaved ? (
                        <Icons.saved className="w-[15px] h-[15px] text-primary" />
                      ) : (
                        <Icons.save className="w-[15px] h-[15px] text-foreground/60" />
                      )}
                    </button>
                    {kind !== "saved" && recipe.isPublished === false ? (
                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold shadow-sm bg-foreground/80 text-background">
                        Draft
                      </div>
                    ) : null}
                  </div>
                  <div className="px-1 pt-2.5 pb-1">
                    <h3 className="font-[family-name:var(--font-headline)] text-[15px] font-medium leading-snug text-foreground line-clamp-2">
                      {recipe.title}
                    </h3>
                    {/* Macro row (recipes.md §3.1) — kcal · protein · carbs
                        · fat in the immutable macro colours, protein
                        emphasised. kcal suppressed at ≤0 so an un-computed
                        recipe never shows a confident "0 kcal" (trust
                        posture). Narrow 2-col card → no letters (the hue +
                        icon carry the meaning, protein leads). Mobile
                        parity: `apps/mobile/app/(tabs)/library.tsx`
                        MacroIconRow with `emphasiseProtein`. */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground tabular-nums">
                      {kcal > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Icons.calories className="w-[11px] h-[11px]" style={{ color: "var(--macro-calories)" }} aria-hidden />
                          {kcal}
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
