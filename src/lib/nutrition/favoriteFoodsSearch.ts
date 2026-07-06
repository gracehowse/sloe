/**
 * Favourites-in-search (teardown #1, ENG-1041, 2026-06-11).
 *
 * The `user_favorite_foods` model already exists (`favoriteFoods.ts`) and is
 * wired into the Today QuickAddPanel, but it never reached the place people
 * actually search — the food-log search panel. MFP / Lifesum / Yazio refugees
 * arrive with "where are my saved foods?" muscle memory; this module is the
 * shared backbone that surfaces favourites IN the one search surface, as a
 * "Favourites" group above "Past logged" (typed query) and favourites-first
 * in the empty-query "Recent" strip — without adding a new tab.
 *
 * Why a shared, pure module
 * -------------------------
 * Web `FoodSearchPanel` and mobile `FoodSearchPanel` both render the search
 * groups and CLAUDE.md's parity rule says they must not drift. The matching +
 * ordering MACHINERY lives here so both panels import one source of truth;
 * only the React/RN rendering stays in the panel files. Same shape as
 * {@link matchHistoryFoods} in `foodHistorySearch.ts`, deliberately — the two
 * groups read identically and rank with the same scorer.
 *
 * Pure: no React, no Supabase, no `Date` (mobile-bundle-safe via the
 * `@suppr/shared/nutrition/...` alias).
 */

import { searchMatchScore } from "./foodSearchRanking";
import { favoriteKey } from "./favoriteFoods";

/**
 * The minimal favourite-row shape this module needs. A structural subset of
 * `FavoriteFood` (from `favoriteFoods.ts`) so the rows the panel already lists
 * fit without a mapping step. `id` is carried so the star-toggle can call
 * `removeFavorite(id)` directly without a second lookup.
 */
export type FavoriteSearchItem = {
  /** Favourite row id — needed to unstar without re-querying. */
  id: string;
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  source?: string;
  imageUrl?: string | null;
};

/** A scored favourite match — same shape as `HistorySearchMatch`. */
export type FavoriteSearchMatch<T extends FavoriteSearchItem = FavoriteSearchItem> = {
  item: T;
  /** Relevance score in [0, 1] from {@link searchMatchScore}. */
  score: number;
  /** `${lowercase title}|${rounded kcal}` — matches `favoriteKey`. */
  key: string;
};

/**
 * Minimum name-match score a favourite must clear to surface in the
 * "Favourites" group. Mirrors {@link HISTORY_MATCH_MIN_SCORE} (0.15) so the
 * two groups qualify rows the same way — a single-token recall hit ("sour" →
 * "Sourdough") qualifies, genuinely unrelated rows (recall 0) are excluded.
 * Looser than the DB `SEARCH_MATCH_MIN_SCORE` because a favourite is the
 * user's own deliberately-starred data: a partial hit is high-value, low-risk.
 */
export const FAVORITE_MATCH_MIN_SCORE = 0.15;

/**
 * Default cap on the "Favourites" group. Smaller than the history cap (6) —
 * favourites are a deliberately-curated set, so a handful catches the user's
 * staples without dominating the sheet above the broader results.
 */
export const FAVORITE_MATCH_CAP = 5;

/** Substring containment, diacritic + case insensitive. Shared shape with
 *  `foodHistorySearch.normalizedIncludes`. */
function normalizedIncludes(haystack: string, needle: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const h = norm(haystack);
  const n = norm(needle);
  if (!n) return false;
  return h.includes(n);
}

/**
 * Match the user's favourite foods against a query and return the ranked,
 * de-duped, capped "Favourites" group. Ranking mirrors `matchHistoryFoods`:
 *   1. Relevance — `searchMatchScore` (stemmed, diacritic-insensitive),
 *      floored by a raw substring hit so partial-word queries qualify.
 *   2. Title — stable tiebreak (favourites carry no recency/frequency signal;
 *      they are an explicit curated set).
 *
 * De-dupe: identical `${title}|${kcal}` keys collapse to the first occurrence
 * (the favourites list is already de-duped by the DB unique index, but a
 * defensive collapse keeps the group clean if a caller passes duplicates).
 */
export function matchFavoriteFoods<T extends FavoriteSearchItem>(
  items: readonly T[],
  query: string,
  opts: { cap?: number; minScore?: number } = {},
): FavoriteSearchMatch<T>[] {
  const q = (query ?? "").trim();
  if (!q || !Array.isArray(items) || items.length === 0) return [];
  const cap = opts.cap ?? FAVORITE_MATCH_CAP;
  const minScore = opts.minScore ?? FAVORITE_MATCH_MIN_SCORE;
  if (cap <= 0) return [];

  const seen = new Map<string, FavoriteSearchMatch<T>>();
  items.forEach((item) => {
    const title = String(item?.recipeTitle ?? "").trim();
    if (!title) return;
    const tokenScore = searchMatchScore(q, title);
    const substringScore = normalizedIncludes(title, q) ? 0.6 : 0;
    const score = Math.max(tokenScore, substringScore);
    if (score < minScore) return;

    const key = favoriteKey(title, item.calories);
    const existing = seen.get(key);
    if (existing) {
      if (score > existing.score) existing.score = score;
      return;
    }
    seen.set(key, { item, score, key });
  });

  const scored = Array.from(seen.values());
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.recipeTitle.localeCompare(b.item.recipeTitle);
  });
  return scored.slice(0, cap);
}

/**
 * Build the set of `favoriteKey` keys covered by a favourites list, for the
 * per-row star-state check (filled vs outline) without a per-row Supabase
 * round-trip. Matches the DB unique index exactly (lower-cased title + rounded
 * kcal), so the UI star state stays in lock-step with what's persisted.
 */
export function favoriteFoodKeySet(items: readonly FavoriteSearchItem[]): Set<string> {
  return new Set(items.map((f) => favoriteKey(f.recipeTitle, f.calories)));
}

/**
 * Order the empty-query "Recent" strip with favourites first, preserving the
 * caller's recency order within each partition. A row is a favourite when its
 * `favoriteKey` is in `favoriteKeys`. Stable within each group, so the most-
 * recent favourite leads and the rest of recents follow unchanged. Returns a
 * NEW array; never mutates the input.
 *
 * This is the empty-query half of teardown #1 (favourites-first in the Recent
 * strip); the typed-query half is {@link matchFavoriteFoods}.
 */
export function orderRecentWithFavoritesFirst<
  R extends { recipeTitle: string; calories: number },
>(recent: readonly R[], favoriteKeys: Set<string>): R[] {
  if (!Array.isArray(recent) || recent.length === 0) return [];
  if (favoriteKeys.size === 0) return recent.slice();
  const favs: R[] = [];
  const rest: R[] = [];
  for (const row of recent) {
    if (favoriteKeys.has(favoriteKey(row.recipeTitle, row.calories))) favs.push(row);
    else rest.push(row);
  }
  return [...favs, ...rest];
}

/** True when a (title, kcal) pair is in the favourites key set. Convenience
 *  for per-row star rendering in the panels. */
export function isFavoriteRow(
  favoriteKeys: Set<string>,
  recipeTitle: string,
  calories: number,
): boolean {
  return favoriteKeys.has(favoriteKey(recipeTitle, calories));
}
