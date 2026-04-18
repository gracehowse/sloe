/**
 * Food history helpers — build Frequent / Recent / Eat-again lists from
 * a user's journal `byDay` map.
 *
 * Pure: no React, no Supabase, no Date (callers must pass `now`).
 * Importing this file from a React Native component is safe, and it is
 * re-used by the web Quick Add panel and the mobile Quick Add panel so
 * the two platforms cannot drift.
 *
 * Design notes:
 *  - The bucketing key is `${lowercase title}|${Math.round(calories)}`.
 *    This matches the unique index on `public.user_favorite_foods` so
 *    starring a row from any tab produces a stable identity.
 *  - Rounding: calories are rounded to integers for the key; macros on
 *    the returned item are averaged across occurrences (defensive — the
 *    same food logged twice should have equal macros, but averaging
 *    protects against tiny rounding drift from different sources).
 *  - "Missing title" rows are coerced to "Unnamed food" rather than
 *    dropped, so the user can still see + re-log them.
 */

/** Shape of a journal meal that this helper can consume. Narrow on
 * purpose so both `JournalMeal` (mobile) and `LoggedMeal` (web) fit. */
export type FoodHistoryMealLike = {
  recipeTitle?: string;
  name?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  fiber?: number;
  source?: string | null;
  createdAt?: string | null;
};

/** Normalised history item used by the Quick Add panel rows. */
export type FoodHistoryItem = {
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  source?: string;
  /** Total number of times this (title, rounded-calorie) pair has been logged. */
  count: number;
  /** ISO timestamp or `YYYY-MM-DD` of the most recent logging, if available. */
  lastLoggedAt?: string;
};

const UNNAMED = "Unnamed food";

function safeNumber(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function titleOf(m: FoodHistoryMealLike): string {
  const t = String(m.recipeTitle ?? m.name ?? "").trim();
  return t.length > 0 ? t : UNNAMED;
}

function fiberOf(m: FoodHistoryMealLike): number | undefined {
  if (typeof m.fiberG === "number" && Number.isFinite(m.fiberG)) return m.fiberG;
  if (typeof m.fiber === "number" && Number.isFinite(m.fiber)) return m.fiber;
  return undefined;
}

/** Canonical dedupe key matching the DB unique index. */
export function foodHistoryKey(title: string, calories: number): string {
  return `${title.trim().toLowerCase()}|${Math.round(safeNumber(calories))}`;
}

type Bucket = {
  key: string;
  /** Earliest-seen title spelling; UI shows this casing. */
  title: string;
  calories: number; // rounded
  /** Sums (for averaging). */
  proteinSum: number;
  carbsSum: number;
  fatSum: number;
  fiberSum: number;
  fiberCount: number;
  /** Most recent provenance seen for this bucket. */
  source?: string;
  count: number;
  /** Sort key for most-recent tie-break: `${dayKey}#${indexInDay}`. */
  lastSortKey: string;
  /** Last-seen ISO timestamp or `YYYY-MM-DD`. */
  lastLoggedAt?: string;
};

function emptyBucket(title: string, calories: number, key: string): Bucket {
  return {
    key,
    title,
    calories,
    proteinSum: 0,
    carbsSum: 0,
    fatSum: 0,
    fiberSum: 0,
    fiberCount: 0,
    count: 0,
    lastSortKey: "",
  };
}

function addToBucket(b: Bucket, m: FoodHistoryMealLike, dayKey: string, indexInDay: number): void {
  b.count += 1;
  b.proteinSum += safeNumber(m.protein);
  b.carbsSum += safeNumber(m.carbs);
  b.fatSum += safeNumber(m.fat);
  const fib = fiberOf(m);
  if (fib != null) {
    b.fiberSum += fib;
    b.fiberCount += 1;
  }
  if (m.source) b.source = String(m.source);
  // Pad the index so "day#10" sorts after "day#2".
  const sortKey = `${dayKey}#${String(indexInDay).padStart(6, "0")}`;
  if (sortKey > b.lastSortKey) {
    b.lastSortKey = sortKey;
    b.lastLoggedAt = m.createdAt ?? dayKey;
  }
}

function finaliseBucket(b: Bucket): FoodHistoryItem {
  const n = b.count > 0 ? b.count : 1;
  const item: FoodHistoryItem = {
    recipeTitle: b.title,
    calories: b.calories,
    protein: Math.round((b.proteinSum / n) * 10) / 10,
    carbs: Math.round((b.carbsSum / n) * 10) / 10,
    fat: Math.round((b.fatSum / n) * 10) / 10,
    count: b.count,
  };
  if (b.fiberCount > 0) {
    item.fiber = Math.round((b.fiberSum / b.fiberCount) * 10) / 10;
  }
  if (b.source) item.source = b.source;
  if (b.lastLoggedAt) item.lastLoggedAt = b.lastLoggedAt;
  return item;
}

/**
 * Walk every meal in `byDay` in chronological order, populating one
 * bucket per (title, rounded-calories) pair. Returned buckets still
 * carry sort metadata so callers can order them.
 */
function buildBuckets<M extends FoodHistoryMealLike>(byDay: Record<string, M[]>): Bucket[] {
  const buckets = new Map<string, Bucket>();
  // Sort day keys ascending; lexical sort works for YYYY-MM-DD.
  const allDayKeys = Object.keys(byDay).sort();
  for (const dk of allDayKeys) {
    const meals = byDay[dk];
    if (!Array.isArray(meals)) continue;
    for (let i = 0; i < meals.length; i += 1) {
      const m = meals[i]!;
      const title = titleOf(m);
      const cal = Math.round(safeNumber(m.calories));
      const key = foodHistoryKey(title, cal);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = emptyBucket(title, cal, key);
        buckets.set(key, bucket);
      }
      addToBucket(bucket, m, dk, i);
    }
  }
  return Array.from(buckets.values());
}

/**
 * Most-frequent meals across the user's entire history.
 *
 * Order: `count desc`, most-recent tie-break, then title for stability.
 */
export function computeFrequentMeals<M extends FoodHistoryMealLike>(
  byDay: Record<string, M[]>,
  topN = 20,
): FoodHistoryItem[] {
  const buckets = buildBuckets(byDay);
  buckets.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.lastSortKey !== b.lastSortKey) return b.lastSortKey.localeCompare(a.lastSortKey);
    return a.title.localeCompare(b.title);
  });
  const capped = topN >= 0 ? buckets.slice(0, topN) : buckets;
  return capped.map(finaliseBucket);
}

/**
 * Most-recently logged unique meals across history.
 *
 * Order: most recent day first, then later-position-in-day first.
 * `count` still reflects total occurrences across all days so the UI
 * can show "logged 12×" on a row that surfaces as Recent.
 */
export function computeRecentMeals<M extends FoodHistoryMealLike>(
  byDay: Record<string, M[]>,
  limit = 20,
): FoodHistoryItem[] {
  const buckets = buildBuckets(byDay);
  buckets.sort((a, b) => {
    if (a.lastSortKey !== b.lastSortKey) return b.lastSortKey.localeCompare(a.lastSortKey);
    return a.title.localeCompare(b.title);
  });
  const capped = limit >= 0 ? buckets.slice(0, limit) : buckets;
  return capped.map(finaliseBucket);
}

/**
 * "Eat again from yesterday's lunch?" — find the most recent *prior*
 * day that has a meal in `slot` and return a deduped summary of the
 * last meal in that slot.
 *
 * Today is excluded on purpose: the card suggests re-logging something
 * the user has already eaten on another day, not the meal they just
 * logged. Callers pass `now` so this function stays pure.
 */
export function computeEatAgainForSlot<M extends FoodHistoryMealLike & { name?: string }>(
  byDay: Record<string, M[]>,
  slot: string,
  now: Date,
): FoodHistoryItem | null {
  if (!slot || !(now instanceof Date) || Number.isNaN(now.getTime())) return null;
  const todayKey = formatDayKey(now);
  const normSlot = slot.trim().toLowerCase();
  // Walk days newest → oldest, skipping today.
  const dayKeys = Object.keys(byDay).sort().reverse();
  for (const dk of dayKeys) {
    if (dk >= todayKey) continue;
    const meals = byDay[dk];
    if (!Array.isArray(meals) || meals.length === 0) continue;
    // Last meal in that slot on that day.
    for (let i = meals.length - 1; i >= 0; i -= 1) {
      const m = meals[i]!;
      const mSlot = String(m.name ?? "").trim().toLowerCase();
      if (mSlot === normSlot) {
        const title = titleOf(m);
        const cal = Math.round(safeNumber(m.calories));
        const key = foodHistoryKey(title, cal);
        const bucket = emptyBucket(title, cal, key);
        addToBucket(bucket, m, dk, i);
        return finaliseBucket(bucket);
      }
    }
  }
  return null;
}

function formatDayKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}
