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

import { normaliseMealSlot } from "./mealSlots";
import { isHealthImportFallbackTitle } from "./healthImportLabels";

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
  /**
   * Tracking-extras autoupdate (2026-05-01) — surface caffeine + alcohol
   * micros from the original journal row so re-logging from Quick Add /
   * Eat-again carries the same per-serving stimulant payload that the
   * search-result commit captured. The bucket builder reads
   * `micros.caffeineMg` / `micros.alcoholG` first and falls back to the
   * top-level fields, so callers from either platform fit.
   */
  micros?: Record<string, number> | null;
  caffeineMg?: number;
  alcoholG?: number;
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
  /**
   * Tracking-extras autoupdate (2026-05-01) — average per-serving caffeine /
   * alcohol contribution across occurrences. Set when ANY of the bucket's
   * journal rows carried `micros.caffeineMg` / `micros.alcoholG`. Quick
   * Add commit paths re-attach these to `meal.micros` so the F-13 daily
   * bump fires on a re-log. Averaged (not summed) so a 3x-logged cortado
   * surfaces as ~128 mg per tap, not 384 mg.
   */
  caffeineMg?: number;
  alcoholG?: number;
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

/**
 * Tracking-extras autoupdate (2026-05-01) — caffeine extraction from a
 * journal-meal-like row. Reads `micros.caffeineMg` first (canonical for
 * meals committed via the food-search / barcode / voice / photo paths)
 * and falls back to a top-level `caffeineMg` for legacy / synthetic
 * shapes. Returns `undefined` for missing / non-positive / non-finite so
 * the bucket can distinguish "no caffeine info" from "0 mg".
 */
function caffeineOf(m: FoodHistoryMealLike): number | undefined {
  const micro = m.micros && typeof m.micros === "object" ? m.micros.caffeineMg : undefined;
  const candidates = [micro, m.caffeineMg];
  for (const raw of candidates) {
    if (raw == null) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/** Same shape as `caffeineOf` for ethanol grams. */
function alcoholOf(m: FoodHistoryMealLike): number | undefined {
  const micro = m.micros && typeof m.micros === "object" ? m.micros.alcoholG : undefined;
  const candidates = [micro, m.alcoholG];
  for (const raw of candidates) {
    if (raw == null) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
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
  /**
   * Tracking-extras autoupdate (2026-05-01) — caffeine + alcohol running
   * sums + counts so finalised buckets average the per-occurrence value.
   * Counts are tracked separately from `count` because not every
   * occurrence carries a stimulant payload (a generic "Coffee" row that
   * was logged once via search and once manually averages from one
   * sample, not two).
   */
  caffeineMgSum: number;
  caffeineCount: number;
  alcoholGSum: number;
  alcoholCount: number;
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
    caffeineMgSum: 0,
    caffeineCount: 0,
    alcoholGSum: 0,
    alcoholCount: 0,
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
  // Tracking-extras autoupdate (2026-05-01) — fold caffeine + alcohol
  // contributions when present. Missing → bucket count stays at 0 so
  // the finalised item omits the field entirely (no "0 mg caffeine"
  // false positive on a steak log).
  const caff = caffeineOf(m);
  if (caff != null) {
    b.caffeineMgSum += caff;
    b.caffeineCount += 1;
  }
  const alc = alcoholOf(m);
  if (alc != null) {
    b.alcoholGSum += alc;
    b.alcoholCount += 1;
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
  // Tracking-extras autoupdate (2026-05-01) — caffeine snaps to integer
  // mg (matches scaleCaffeineAlcohol output shape + stored daily-bucket
  // precision). Alcohol snaps to 1 dp g for the same reason. Only
  // surfaced when at least one occurrence carried the nutrient.
  if (b.caffeineCount > 0) {
    item.caffeineMg = Math.round(b.caffeineMgSum / b.caffeineCount);
  }
  if (b.alcoholCount > 0) {
    item.alcoholG = Math.round((b.alcoholGSum / b.alcoholCount) * 10) / 10;
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
 *
 * N1 (2026-05-03): synthetic HealthKit-import-fallback rows are skipped.
 * Re-logging a row literally titled "MyFitnessPal entry · 250 kcal"
 * (or the legacy "Food log (250 kcal)") gives the user no leverage —
 * it's a placeholder for an unknown food, not a real recipe to re-log.
 * If every prior meal in the slot is a fallback, return null rather
 * than promote a meaningless suggestion.
 */
export function computeEatAgainForSlot<M extends FoodHistoryMealLike & { name?: string }>(
  byDay: Record<string, M[]>,
  slot: string,
  now: Date,
): FoodHistoryItem | null {
  if (!slot || !(now instanceof Date) || Number.isNaN(now.getTime())) return null;
  const todayKey = formatDayKey(now);
  // Canonical slot via the shared helper — accepts "Breakfast" / "breakfast" /
  // "  BREAKFAST  " / "Snack" equally. Unknown slot → no suggestion.
  const targetSlot = normaliseMealSlot(slot);
  if (!targetSlot) return null;
  // Walk days newest → oldest, skipping today.
  const dayKeys = Object.keys(byDay).sort().reverse();
  for (const dk of dayKeys) {
    if (dk >= todayKey) continue;
    const meals = byDay[dk];
    if (!Array.isArray(meals) || meals.length === 0) continue;
    // Last meal in that slot on that day. Synthetic HealthKit-import
    // fallback rows are skipped (N1 — they have no real food identity).
    for (let i = meals.length - 1; i >= 0; i -= 1) {
      const m = meals[i]!;
      if (normaliseMealSlot(m.name) !== targetSlot) continue;
      const title = titleOf(m);
      if (isHealthImportFallbackTitle(title)) continue;
      const cal = Math.round(safeNumber(m.calories));
      const key = foodHistoryKey(title, cal);
      const bucket = emptyBucket(title, cal, key);
      addToBucket(bucket, m, dk, i);
      return finaliseBucket(bucket);
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

/**
 * Returns true when a history/favourite/recent/frequent row originated from an
 * AI-assisted logging flow (voice or photo capture).
 *
 * Shared by the web and mobile Quick Add panels so the "AI" badge fires for
 * the same set of `source` strings on both platforms. Matches the strings
 * written by `NutritionTracker` (web) and mobile Today voice/photo commit
 * paths: `"AI voice"`, `"AI photo"`, `"voice"`, `"ai_voice"`, `"ai_photo"`.
 * Accepts arbitrary casing and ignores leading/trailing whitespace.
 *
 * Centralising this rule is a CLAUDE.md parity requirement (audit H1,
 * 2026-04-18): if either platform updates the AI source tag, the other
 * stays in sync automatically because both import from here.
 */
export function isAiSourcedFoodHistoryItem(
  item: Pick<FoodHistoryItem, "source"> | { source?: string | null | undefined },
): boolean {
  const s = item?.source;
  if (s == null) return false;
  const lc = String(s).trim().toLowerCase();
  if (!lc) return false;
  return (
    lc.includes("ai voice") ||
    lc.includes("ai photo") ||
    lc === "voice" ||
    lc === "ai_voice" ||
    lc === "ai_photo"
  );
}
