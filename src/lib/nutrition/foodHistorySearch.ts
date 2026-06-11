/**
 * History-first food search (ENG-1033, 2026-06-10).
 *
 * The behaviour Grace asked for (MFP grammar): when the user types a query in
 * the food-log search, FIRST surface matching items from their OWN logging
 * history — past-logged foods / meals / recipes — as a visually-distinct
 * "Past logged" group above the database (FatSecret / USDA / OFF) results.
 * Each row is one-tap loggable. Database results follow. An empty query keeps
 * the existing recents-on-mount behaviour (this module is the typed-query
 * layer only).
 *
 * Why a shared, pure module
 * -------------------------
 * Web `FoodSearchPanel` and mobile `FoodSearchPanel` both render search
 * results, and CLAUDE.md's parity rule says the two surfaces must not drift.
 * The matching + ranking + de-dupe MACHINERY lives here so both panels import
 * one source of truth; only the React/RN rendering stays in the panel files.
 *
 * Pure: no React, no Supabase, no `Date` (mobile-bundle-safe — imported via
 * the `@suppr/shared/nutrition/...` alias). The recency signal comes from the
 * pre-sorted order the caller already has (history items arrive ordered
 * newest-first from `computeRecentMeals`), not from reading the clock here.
 *
 * Relevance reuses {@link searchMatchScore} (the ENG-807 stemmed, diacritic-
 * insensitive scorer) so "Past logged" matches the user's intent the same way
 * the database ranker does — `sour` matches `Sourdough`, `smart` matches
 * `Smartfood popcorn`, `Pâté` matches `pate`.
 */

import { searchMatchScore } from "./foodSearchRanking";
import { foodHistoryKey } from "./foodHistory";

/**
 * The minimal history-row shape this module needs. Deliberately a structural
 * subset of `FoodHistoryItem` (from `foodHistory.ts`) so both the web
 * `recentFoods` rows and the mobile ones fit without a mapping step.
 *
 * `count` and the newest-first position drive the recency-weighted frequency
 * tiebreak; `recipeTitle` + `calories` drive the de-dupe key and the name
 * match.
 */
export type HistorySearchItem = {
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  source?: string;
  /** Total times this (title, rounded-kcal) pair has been logged. */
  count?: number;
  imageUrl?: string | null;
};

/**
 * A scored history match. Carries the original item plus the relevance score
 * and the canonical de-dupe key so the consuming panel can (a) render the row
 * and (b) suppress any database result that collides with a history match
 * (history wins — see {@link dedupeDbAgainstHistory}).
 */
export type HistorySearchMatch<T extends HistorySearchItem = HistorySearchItem> = {
  item: T;
  /** Relevance score in [0, 1] from {@link searchMatchScore}. */
  score: number;
  /** `${lowercase title}|${rounded kcal}` — matches `foodHistoryKey`. */
  key: string;
};

/**
 * Minimum name-match score a history row must clear to surface in the
 * "Past logged" group. Lower than the database `VERIFIED_TIER_MIN_SCORE`
 * (0.55) on purpose: history is the user's OWN data, so a looser substring /
 * stemmed hit is still a high-value, low-risk suggestion (re-logging
 * something they've eaten before). Set just above 0 so a single-token recall
 * hit ("sour" → "Sourdough") qualifies while genuinely unrelated rows
 * (recall 0) are excluded.
 */
export const HISTORY_MATCH_MIN_SCORE = 0.15;

/**
 * Default cap on the "Past logged" group. MFP shows a handful of history
 * matches above the database results — enough to catch the user's staple
 * without pushing the broader catalogue off-screen. 6 is the ceiling; the
 * group shrinks naturally when fewer match.
 */
export const HISTORY_MATCH_CAP = 6;

/** Substring containment, diacritic + case insensitive. */
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
 * Match the user's logged-food history against a query and return the ranked,
 * de-duped, capped "Past logged" group.
 *
 * Ranking (in order):
 *   1. **Relevance** — `searchMatchScore` (stemmed, diacritic-insensitive).
 *      A direct substring hit ("sour" in "Sourdough") is floored to a strong
 *      score so a partial-word match the token scorer would miss still ranks.
 *   2. **Recency-weighted frequency** — ties on relevance break by a blend of
 *      how often the item was logged (`count`) and how recently (its index in
 *      the caller's newest-first input). Recent + frequent wins.
 *   3. **Title** — final stable tiebreak.
 *
 * De-dupe: identical `${title}|${kcal}` keys collapse to the first (most
 * recent) occurrence, so the same staple logged 20× shows once.
 *
 * @param items   History rows, expected newest-first (e.g. from
 *                `computeRecentMeals`). Order is the recency signal.
 * @param query   The raw search query (caller need not pre-trim).
 * @param opts.cap          Max rows in the group (default {@link HISTORY_MATCH_CAP}).
 * @param opts.minScore     Min relevance to qualify (default {@link HISTORY_MATCH_MIN_SCORE}).
 */
export function matchHistoryFoods<T extends HistorySearchItem>(
  items: readonly T[],
  query: string,
  opts: { cap?: number; minScore?: number } = {},
): HistorySearchMatch<T>[] {
  const q = (query ?? "").trim();
  if (!q || !Array.isArray(items) || items.length === 0) return [];
  const cap = opts.cap ?? HISTORY_MATCH_CAP;
  const minScore = opts.minScore ?? HISTORY_MATCH_MIN_SCORE;
  if (cap <= 0) return [];

  type Scored = HistorySearchMatch<T> & { recencyIndex: number; count: number };
  const seen = new Map<string, Scored>();

  items.forEach((item, index) => {
    const title = String(item?.recipeTitle ?? "").trim();
    if (!title) return;
    // Relevance from the shared scorer, floored by a raw substring hit so a
    // partial-word query the token scorer can't see ("sour" → "Sourdough")
    // still qualifies.
    const tokenScore = searchMatchScore(q, title);
    const substringScore = normalizedIncludes(title, q) ? 0.6 : 0;
    const score = Math.max(tokenScore, substringScore);
    if (score < minScore) return;

    const key = foodHistoryKey(title, item.calories);
    const count = Number.isFinite(item.count) ? Math.max(1, item.count as number) : 1;
    // De-dupe: keep the most-recent (lowest index) occurrence of a key, but
    // carry the higher count + the better score forward so a staple that
    // appears more than once in the window still ranks on its true frequency.
    const existing = seen.get(key);
    if (existing) {
      if (score > existing.score) existing.score = score;
      if (count > existing.count) existing.count = count;
      return;
    }
    seen.set(key, { item, score, key, recencyIndex: index, count });
  });

  const scored = Array.from(seen.values());
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Recency-weighted frequency: a higher count and a more-recent position
    // both lift a row. Weight count linearly and decay recency so a freshly
    // logged item edges out an older one of equal frequency.
    const weight = (s: Scored) => s.count * 2 - s.recencyIndex * 0.1;
    const wb = weight(b);
    const wa = weight(a);
    if (wb !== wa) return wb - wa;
    return a.item.recipeTitle.localeCompare(b.item.recipeTitle);
  });

  return scored.slice(0, cap).map(({ item, score, key }) => ({ item, score, key }));
}

/**
 * Build the set of `${title}|${kcal}` de-dupe keys covered by a "Past logged"
 * group. Use this when the database rows share the SAME kcal grounding as
 * history (e.g. the user's own custom foods / favourites, which are stored
 * per-serving). Matches the DB unique index exactly.
 */
export function historyMatchKeySet(matches: readonly HistorySearchMatch[]): Set<string> {
  return new Set(matches.map((m) => m.key));
}

/** Normalize a food name for cross-source de-dupe: diacritic-stripped,
 *  lower-cased, whitespace-collapsed. */
export function normalizeHistoryName(name: string): string {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the set of normalized NAMES covered by a "Past logged" group, for
 * de-duping the broad database catalogue (FatSecret / USDA / OFF), whose kcal
 * grounding is per-100g and so never matches the per-serving history kcal.
 * The honest cross-source identity is the name: if the user has already
 * logged a food with this exact name, surface theirs and suppress the
 * catalogue duplicate (history wins). Conservative on purpose — only an
 * EXACT normalized-name collision de-dupes, so "Sourdough" suppresses the
 * catalogue "Sourdough" but never "Sourdough crackers".
 */
export function historyMatchNameSet(matches: readonly HistorySearchMatch[]): Set<string> {
  return new Set(matches.map((m) => normalizeHistoryName(m.item.recipeTitle)));
}

/**
 * Filter a list of database result rows, dropping any whose
 * `${title}|${kcal}` key collides with a history match. `keyOf` lets each
 * platform map its own row shape (web `SearchResult`, mobile `SearchRow`) to
 * the canonical key. Rows the caller can't key (e.g. a row missing a kcal
 * value) are kept — we never drop a DB result we can't positively dedupe.
 */
export function dedupeDbAgainstHistory<R>(
  rows: readonly R[],
  historyKeys: Set<string>,
  keyOf: (row: R) => string | null,
): R[] {
  if (historyKeys.size === 0) return rows.slice();
  return rows.filter((row) => {
    const key = keyOf(row);
    if (key == null) return true;
    return !historyKeys.has(key);
  });
}
