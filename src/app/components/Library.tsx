import { memo, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { useAppData } from "../../context/AppDataContext.tsx";
import type { LibraryEntryKind, RecipeCard, UserTier } from "../../types/recipe.ts";
import { RecipeDetail } from "./RecipeDetail";
import { useRouter } from "next/navigation";
import {
  LIBRARY_FILTER_PILLS,
  matchesNutritionPill,
  type LibraryFilterPillId,
} from "../../lib/recipes/libraryFilters.ts";
import { classifyLibraryEntry } from "../../lib/recipes/libraryEntryKind.ts";
import { computeRecipeFitPercent } from "../../lib/nutrition/recipeFitPercent.ts";
// GW-08 (audit 2026-04-28): `TrustChip` + `recipeLevelTrust` dropped
// — Library cards no longer render the chip; see card-body comments.

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
  const { savedRecipesForLibrary, libraryEntryKindByRecipeId, userId, duplicateRecipeToCreatedDraft, nutritionTargets } = useAppData();
  const uid = userId;
  const router = useRouter();
  const [selectedRecipe, setSelectedRecipe] = useState<(RecipeCard & { savedAt: Date }) | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // 2026-04-20 prototype port: migrate web to the shared
  // `LIBRARY_FILTER_PILLS` set (All · Saved · High-Protein · Quick ·
  // Vegetarian · Created · Imported) that mobile already consumes.
  // Web previously exposed only the four entry-kind pills, so web +
  // mobile diverged on filter affordances. Both now share
  // `libraryFilters.ts` for predicate + label.
  const [pill, setPill] = useState<LibraryFilterPillId>("all");
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

  const savedCount = savedRecipesForLibrary.length;
  // 2026-04-30 audit visual-qa P1 #7 (mobile parity with
  // `apps/mobile/app/(tabs)/library.tsx` L495-525): show counts on
  // the entry-kind pills (All / Saved) so the user knows the size of
  // each bucket at a glance. Other pills (high-protein / quick /
  // vegetarian / created / imported) get no count — they're filters,
  // not buckets.
  // "All" = total saved-library size (matches the desktop subtitle).
  // "Saved" = entries classified as kind="saved" by the shared
  // `classifyLibraryEntry` predicate so the count never disagrees
  // with what the "Saved" pill actually filters down to.
  const savedOnlyCount = useMemo(
    () =>
      savedRecipesForLibrary.filter(
        (r) => entryKindForRecipe(r, libraryEntryKindByRecipeId[r.id], uid) === "saved",
      ).length,
    [savedRecipesForLibrary, libraryEntryKindByRecipeId, uid],
  );

  const filteredRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = savedRecipesForLibrary;
    if (q) {
      list = list.filter(
        (r) => r.title.toLowerCase().includes(q) || r.creatorName.toLowerCase().includes(q),
      );
    }
    if (pill === "saved" || pill === "created" || pill === "imported") {
      list = list.filter(
        (r) => entryKindForRecipe(r, libraryEntryKindByRecipeId[r.id], uid) === (pill as LibraryEntryKind),
      );
    } else if (pill !== "all") {
      list = list.filter((r) => matchesNutritionPill(pill, r));
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
  }, [savedRecipesForLibrary, searchQuery, pill, libraryEntryKindByRecipeId, uid, sortKey]);

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
    <div className="max-w-4xl mx-auto px-pm-5 py-pm-5 md:max-w-6xl">
      {/* Header
          2026-04-20 desktop prototype port
          (`docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
          `WebLibrary`): at `md+` the legacy "Library" title + saved
          pill row collapses into the prototype-matching "Library" +
          "{n} recipes · sorted by {sortLabel}" header. Below `md` the
          mobile-web pill row is preserved so narrow-width parity with
          the mobile tab stays intact. */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-6 md:hidden">
          <h1 className="text-foreground">Library</h1>
          <div className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 border bg-muted text-foreground border-border">
            {savedCount} recipe{savedCount === 1 ? "" : "s"}
          </div>
        </div>
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
            {filteredRecipes.length} recipe{filteredRecipes.length === 1 ? "" : "s"} · sorted by {sortLabel.toLowerCase()}
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
          <div className="relative group">
            <Icons.search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary shadow-sm transition-all"
            />
          </div>
          <div
            data-testid="library-filter-pills"
            className="flex flex-nowrap md:flex-wrap gap-2 items-center overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {LIBRARY_FILTER_PILLS.map((f) => {
              const count =
                f.id === "all"
                  ? savedCount
                  : f.id === "saved"
                    ? savedOnlyCount
                    : null;
              const label = count != null ? `${f.label} · ${count}` : f.label;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPill(f.id)}
                  // 2026-05-02 (build-12): tester reported the pill
                  // text was squished against the border. Bumped
                  // horizontal padding (`px-3` → `px-3.5` == 14px) and
                  // pinned a `min-h-8` (32px) floor so descenders no
                  // longer kiss the border. `inline-flex items-center`
                  // keeps the label optically centred when the row
                  // grows past the text's intrinsic height. Mobile
                  // parity: `apps/mobile/app/(tabs)/library.tsx`
                  // `filterPill` style.
                  className={[
                    "shrink-0 inline-flex items-center px-3.5 py-1.5 min-h-8 rounded-full text-sm font-semibold border transition-all whitespace-nowrap",
                    pill === f.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:bg-muted/60",
                  ].join(" ")}
                  aria-label={`Filter: ${f.label}${count != null ? `, ${count} recipes` : ""}`}
                >
                  {label}
                </button>
              );
            })}
            {/* Sort cycle button — mobile parity
                (`apps/mobile/app/(tabs)/library.tsx` `cycleSort`). Cycles
                Recent → Calories → Protein → Recent. Web previously had
                no sort control; mobile previously had no kind filter.
                Both surfaces now expose both. */}
            <button
              type="button"
              onClick={cycleSort}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted/60 transition-all inline-flex items-center gap-1.5"
              aria-label={`Sort by ${sortLabel}, click to change`}
            >
              <Icons.adjust className="w-3.5 h-3.5" aria-hidden />
              {sortLabel}
            </button>
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
              return (
                <button
                  key={`desktop-${recipe.id}`}
                  type="button"
                  onClick={() => setSelectedRecipe(recipe)}
                  className="group text-left rounded-2xl bg-card border border-border overflow-hidden cursor-pointer w-full hover:shadow-xl hover:shadow-foreground/5 hover:-translate-y-0.5 transition-all"
                >
                  <div className="relative overflow-hidden" style={{ aspectRatio: "4 / 3" }}>
                    {/* Phase 5 / B5 (2026-04-27) — view-transition-name
                        on the card image so the recipe-card → detail
                        morph (spec §1.1) has a continuous geometry
                        anchor. Browsers without the View Transitions
                        API (Firefox today) ignore the property — no
                        regression. The matching name lives on the
                        detail hero (RecipeDetail.tsx). */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- viewTransitionName + arbitrary recipe image URLs */}
                    <img
                      src={recipe.image}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      style={{ viewTransitionName: `recipe-${recipe.id}-image` }}
                    />
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
                      <div className="absolute top-3 right-3 px-2.5 py-1 bg-card/95 backdrop-blur-sm rounded-md text-[12px] font-semibold shadow-sm text-foreground tabular-nums">
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
                      className="text-[14px] font-bold text-foreground leading-snug -tracking-[0.01em] pr-12"
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
                        {protein} P
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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const q = new URLSearchParams({ view: "create", editRecipe: recipe.id }).toString();
                          router.replace(`/home?${q}`, { scroll: false });
                        }}
                        className="mt-3 inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-primary text-white text-[11px] font-semibold hover:opacity-90"
                      >
                        Go public
                      </button>
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
                        className="mt-3 inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-warning text-background text-[11px] font-semibold hover:opacity-90"
                      >
                        Create your own version
                      </button>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mobile-web (< md) — legacy layout preserved */}
          <div className="grid grid-cols-1 gap-6 md:hidden">
            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 text-left shadow-lg cursor-pointer"
                onClick={() => setSelectedRecipe(recipe)}
              >
                <div className="relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary recipe image URLs */}
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
                </div>
                <div className="p-5">
                  {/* Audit 2026-04-30 visual-qa P0 #4 — long titles on the
                      mobile-web card path used to wrap to 4-5 lines and
                      blow out card height. Match the desktop grid path
                      (line-clamp:2) so card heights stay consistent and
                      the meta row underneath remains visible. */}
                  <h4 className="mb-3">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedRecipe(recipe); }}
                      className="line-clamp-2 text-foreground group-hover:text-primary transition-colors text-left font-inherit hover:underline focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                    >
                      {recipe.title}
                    </button>
                  </h4>
                  {entryKindForRecipe(recipe, libraryEntryKindByRecipeId[recipe.id], uid) === "created" &&
                  recipe.isPublished === false ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const q = new URLSearchParams({ view: "create", editRecipe: recipe.id }).toString();
                        router.replace(`/home?${q}`, { scroll: false });
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
                          router.replace(`/home?${q}`, { scroll: false });
                        })();
                      }}
                      className="mb-3 inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-warning text-background text-xs font-semibold hover:opacity-90"
                    >
                      Create your own version
                    </button>
                  ) : null}
                  <div className="flex items-center gap-2 mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element -- creator avatar URLs */}
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
                  {/* GW-08 (audit 2026-04-28): TrustChip removed; see
                      desktop grid path above for the full rationale. */}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
});
