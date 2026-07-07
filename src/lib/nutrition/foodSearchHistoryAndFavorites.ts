/**
 * Shared history + favourites composition for the food-search panels
 * (ENG-1362 — round 2 of the ENG-550 FoodSearchPanel extraction).
 *
 * Why this exists
 * ---------------
 * ENG-550 already pulled the pure MATCHING primitives (`matchHistoryFoods`,
 * `matchFavoriteFoods`, `favoriteFoodKeySet`, `dedupeDbAgainstHistory`, …)
 * into shared, platform-agnostic modules. Both `FoodSearchPanel` components
 * kept importing those primitives correctly — but each panel then
 * re-wrote its OWN composition on top of them: the "match history, match
 * favourites, dedupe favourites out of history, dedupe the DB catalogue
 * against history, resolve a favourite id for the star-toggle" chain was
 * reimplemented, nearly byte-for-byte, in both files. That composition
 * (not the primitives) is what re-fattened the panels — utility functions
 * are easy to bypass by inlining a slightly different call; a function
 * that OWNS the full derivation is not.
 *
 * Deliberately NOT a React hook
 * -----------------------------
 * A `useMemo`/`useCallback`-based hook was the first draft here, but this
 * repo currently runs React 18 at the root (`src/lib/*` resolves against
 * root `node_modules`) and React 19 in `apps/mobile` — mobile's vitest
 * `dedupe` config only reconciles imports resolved from WITHIN
 * `apps/mobile`, so a hook defined under `src/lib/` and called from a
 * mobile test/component pulls in the wrong React copy
 * ("Cannot read properties of null (reading 'useMemo')"). Rather than
 * fight that (there is an open root-level React 18→19 migration in
 * progress — see the repo's other in-flight work), this module stays a
 * PURE function with zero React import, and each panel wraps the single
 * call in its OWN local `useMemo`/`useCallback`. The derivation itself
 * cannot drift between platforms because it's one function; only the
 * (trivial, one-line) memoisation wrapper is platform-local.
 *
 * Generic over the search-row shape (`RowT`) so it fits both web's
 * `SearchResult` and mobile's `SearchRow` without either panel needing a
 * mapping step — both already carry `key` / `name` / `_source`.
 *
 * `isHistoryVisibleCategory` is caller-supplied rather than hard-coded
 * because the two platforms have a genuine, deliberate divergence here:
 * mobile has a "Recents" category tab that web does not (ENG-748 #8 removed
 * the web equivalent). This module does not collapse that difference — it
 * takes it as a parameter so each platform keeps its own gate.
 */
import {
  matchHistoryFoods,
  historyMatchNameSet,
  dedupeDbAgainstHistory,
  normalizeHistoryName,
  type HistorySearchItem,
  type HistorySearchMatch,
} from "./foodHistorySearch";
import {
  matchFavoriteFoods,
  favoriteFoodKeySet,
  type FavoriteSearchItem,
  type FavoriteSearchMatch,
} from "./favoriteFoodsSearch";
import { favoriteKey } from "./favoriteFoods";

export type FoodSearchRowLike = {
  name: string;
};

export type ToggleFavoriteFoodInput = {
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  source?: string;
};

export type FoodSearchHistoryAndFavoritesArgs<
  RowT extends FoodSearchRowLike,
  HistoryT extends HistorySearchItem,
  FavoriteT extends FavoriteSearchItem,
> = {
  query: string;
  results: readonly RowT[];
  recentFoods: readonly HistoryT[] | undefined;
  favoriteFoods: readonly FavoriteT[] | undefined;
  /** True when the currently-active category tab should surface the
   *  "Past logged" / "Favourites" groups. Web: `category === "All"`.
   *  Mobile: `category === "All" || category === "Recents"`. */
  isHistoryVisibleCategory: boolean;
};

export type FoodSearchHistoryAndFavoritesResult<
  RowT extends FoodSearchRowLike,
  HistoryT extends HistorySearchItem,
  FavoriteT extends FavoriteSearchItem,
> = {
  /** Set of `favoriteKey`s — drives per-row star fill state. */
  favoriteKeys: Set<string>;
  /** Favourites matching the typed query, ranked + capped. */
  favoriteMatches: FavoriteSearchMatch<FavoriteT>[];
  /** History matches with any favourite-duplicate rows removed
   *  (favourites win when a food is both starred and in history). */
  historyMatchesDeduped: HistorySearchMatch<HistoryT>[];
  /** The DB/catalogue result rows with any row that exactly name-matches
   *  a history match removed (history wins over the broad catalogue). */
  dedupedResults: RowT[];
};

/**
 * Pure derivation of the history + favourites groups and the de-duped
 * result list. Call this from inside a single platform-local `useMemo` —
 * see the panels for the exact wiring.
 */
export function computeFoodSearchHistoryAndFavorites<
  RowT extends FoodSearchRowLike,
  HistoryT extends HistorySearchItem = HistorySearchItem,
  FavoriteT extends FavoriteSearchItem = FavoriteSearchItem,
>({
  query,
  results,
  recentFoods,
  favoriteFoods,
  isHistoryVisibleCategory,
}: FoodSearchHistoryAndFavoritesArgs<
  RowT,
  HistoryT,
  FavoriteT
>): FoodSearchHistoryAndFavoritesResult<RowT, HistoryT, FavoriteT> {
  const historyMatches: HistorySearchMatch<HistoryT>[] =
    !query.trim() || !recentFoods || recentFoods.length === 0 || !isHistoryVisibleCategory
      ? []
      : matchHistoryFoods(recentFoods, query);

  const favoriteKeys = favoriteFoodKeySet(favoriteFoods ?? []);

  const favoriteMatches: FavoriteSearchMatch<FavoriteT>[] =
    !query.trim() || !favoriteFoods || favoriteFoods.length === 0 || !isHistoryVisibleCategory
      ? []
      : matchFavoriteFoods(favoriteFoods, query);

  const favoriteMatchKeys = new Set(
    favoriteMatches.map((m) => favoriteKey(m.item.recipeTitle, m.item.calories)),
  );

  const historyMatchesDeduped: HistorySearchMatch<HistoryT>[] =
    favoriteMatchKeys.size === 0
      ? historyMatches
      : historyMatches.filter(
          (m) => !favoriteMatchKeys.has(favoriteKey(m.item.recipeTitle, m.item.calories)),
        );

  const historyNames = historyMatchNameSet(historyMatches);

  const dedupedResults: RowT[] =
    historyNames.size === 0
      ? results.slice()
      : dedupeDbAgainstHistory(results, historyNames, (r) => normalizeHistoryName(r.name));

  return {
    favoriteKeys,
    favoriteMatches,
    historyMatchesDeduped,
    dedupedResults,
  };
}

/**
 * Resolve the favourite id for a toggle (unstarring needs the existing
 * row's id; starring passes none). Both panels call this synchronously
 * inside their own `onToggleFavorite` wiring — it is cheap (linear scan
 * over the user's own favourites list) so it does not need memoisation.
 */
export function resolveFavoriteToggleId<FavoriteT extends FavoriteSearchItem>(
  food: ToggleFavoriteFoodInput,
  favoriteFoods: readonly FavoriteT[] | undefined,
): string | undefined {
  const key = favoriteKey(food.recipeTitle, food.calories);
  const existing = (favoriteFoods ?? []).find(
    (f) => favoriteKey(f.recipeTitle, f.calories) === key,
  );
  return existing?.id;
}
