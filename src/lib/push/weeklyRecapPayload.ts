/**
 * Sunday push rewrite — T3 (2026-04-19).
 *
 * Pure helpers that turn raw `nutrition_entries` rows + a profile slice
 * into the shapes `buildWeeklyRecap` and `selectDigestSuggestion`
 * consume.
 *
 * Why this lives in `src/lib/push/` (not `src/lib/nutrition/`):
 *   - It is a *route-side* reshape: it converts from the DB row shape
 *     to the in-memory `ByDayOf<MealMacros>` map the recap builder
 *     wants. The nutrition module already exposes the math; this file
 *     exists so the route doesn't open-code a bucketing loop.
 *   - The push subdirectory already houses the other server-only push
 *     plumbing (`expoPush.ts`). Keeping the reshape next door makes
 *     the route's import surface boring: `@/lib/push/...` for delivery,
 *     `@/lib/nutrition/...` for math.
 *
 * Pure module — no React, no RN, no Supabase, no `process.env`. Both
 * the server route and the unit tests import it the same way.
 */

import type { ByDayOf, MealMacros } from "../nutrition/progressWeekReport";
import { weekKeyFor } from "../nutrition/weeklyRecap";

/**
 * Minimum row shape the reshape consumes. `nutrition_entries.date_key`
 * is a `date` column on the DB which supabase-js returns as `YYYY-MM-DD`
 * already, so no parsing needed. Numerics may arrive as `null` when the
 * row has no value (e.g. water-only logs that record fiber but no
 * macros) — we treat null as 0 because the recap builder later sums
 * with `Math.max(0, m.x)`, so a `null` and a `0` are indistinguishable
 * to the math.
 */
export type NutritionEntryRow = {
  user_id: string;
  date_key: string;
  /** Display name used by `buildUsualMealRecapInsight` to bucket by slot. */
  name?: string | null;
  recipe_title?: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

/**
 * Recap-input meal shape — extends `MealMacros` with the `name` and
 * `recipeTitle` fields so the same map can also feed
 * `buildUsualMealRecapInsight` later (it pattern-matches against
 * `(slotName, recipeTitle, calories)` to find "usual" combos).
 *
 * The recap builder itself only reads `MealMacros`; the extra fields
 * are passed through as a `Record<string, unknown>`-friendly extension
 * via TypeScript's structural-typing (the function signature requires
 * `M extends MealMacros`, so additional fields are tolerated).
 */
export type RecapMeal = MealMacros & {
  name: string;
  recipeTitle: string;
};

/**
 * Bucket a flat list of `nutrition_entries` rows into the
 * `ByDayOf<RecapMeal>` map `buildWeeklyRecap` consumes.
 *
 * Behaviour pinned by `tests/unit/weeklyRecapPayload.test.ts`:
 *   - Empty input → empty map.
 *   - Multiple rows on the same `date_key` are bucketed into the same
 *     array, in input order (preserves the chronological order
 *     supabase-js returns when the caller orders by `date_key, created_at`).
 *   - `null` macro fields are coerced to `0` (the recap builder later
 *     applies `Math.max(0, m.x)`; this just ensures TypeScript-side the
 *     shape is `MealMacros`, not `MealMacros | null`).
 *   - Rows with a `user_id` that doesn't match the caller's `userId`
 *     filter are skipped — supabase-js sometimes returns the full IN()
 *     query result and we want callers to be able to slice per user
 *     without an extra `.filter()` on the route. Pass `userId: null`
 *     to disable this filter (e.g. for tests).
 *   - Date keys outside the supplied 7-key window are skipped — the
 *     route fetches with a `>=` / `<=` filter but DST boundaries make
 *     it cheaper to bound here than to compute exact UTC bounds in SQL.
 *
 * Does NOT compute `weekKey` — the caller already knows it (it derives
 * the SQL date bounds from the same anchor). The function does no
 * I/O and no time-zone math.
 */
export function entriesToByDay(
  rows: ReadonlyArray<NutritionEntryRow>,
  userId: string | null,
  windowKeys: readonly string[],
): ByDayOf<RecapMeal> {
  const out: ByDayOf<RecapMeal> = {};
  // Pre-build a Set for O(1) membership; the window is always 7 keys
  // but defensively use a Set so a future 14-day or 28-day window
  // doesn't degrade.
  const allowed = new Set(windowKeys);
  for (const row of rows) {
    if (userId !== null && row.user_id !== userId) continue;
    if (!row.date_key || !allowed.has(row.date_key)) continue;
    const meal: RecapMeal = {
      name: typeof row.name === "string" ? row.name : "",
      recipeTitle: typeof row.recipe_title === "string" ? row.recipe_title : "",
      calories: Number.isFinite(row.calories) ? Number(row.calories) : 0,
      protein: Number.isFinite(row.protein) ? Number(row.protein) : 0,
      carbs: Number.isFinite(row.carbs) ? Number(row.carbs) : 0,
      fat: Number.isFinite(row.fat) ? Number(row.fat) : 0,
    };
    const bucket = out[row.date_key];
    if (bucket) {
      bucket.push(meal);
    } else {
      out[row.date_key] = [meal];
    }
  }
  return out;
}

/**
 * Build the 7-day window of `YYYY-MM-DD` keys the recap covers.
 *
 * The push fires for the *previous completed week* — so we anchor on
 * `now - 7 days` and snap to the user's `weekStartDay`. This mirrors
 * the snap inside `buildWeeklyRecap` so the SQL window aligns 1:1 with
 * the keys the recap builder later asks for.
 *
 * Returned in chronological order so callers can pass `[0]` and
 * `[6]` directly as SQL bounds.
 */
export function previousWeekKeys(
  weekStartDay: "monday" | "sunday",
  now: Date = new Date(),
): string[] {
  const anchor = new Date(now);
  anchor.setDate(anchor.getDate() - 7);
  anchor.setHours(0, 0, 0, 0);
  const dow = anchor.getDay();
  const offset = weekStartDay === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
  const start = new Date(anchor);
  start.setDate(anchor.getDate() + offset);
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    keys.push(`${y}-${m}-${da}`);
  }
  return keys;
}

/**
 * Convenience wrapper: returns both the window keys and the weekKey
 * for the previous completed week. Used by the route to build the
 * SQL filter and the analytics payload off the same anchor (so the
 * `weekKey` we send out matches the data we computed against).
 */
export function previousWeekDescriptor(
  weekStartDay: "monday" | "sunday",
  now: Date = new Date(),
): { weekKey: string; keys: string[]; firstKey: string; lastKey: string } {
  const keys = previousWeekKeys(weekStartDay, now);
  const previousWeekAnchor = new Date(now);
  previousWeekAnchor.setDate(previousWeekAnchor.getDate() - 7);
  return {
    weekKey: weekKeyFor(previousWeekAnchor, weekStartDay),
    keys,
    firstKey: keys[0]!,
    lastKey: keys[keys.length - 1]!,
  };
}

/**
 * Parse a JSON-blob `weight_kg_by_day` profile column into the
 * `Record<string, number>` shape `buildWeeklyRecap` consumes. Tolerant
 * of the column being null (no weigh-ins) or non-object (corrupted)
 * — both flatten to an empty map so the recap builder cleanly returns
 * `weightDeltaKg: null`.
 */
export function parseWeightKgByDay(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/**
 * Parse the freeze ledger JSON columns into the `FreezeLedger` shape.
 * Mirrors the tolerance rules in `streakFreeze.ts`: missing arrays
 * collapse to `[]` so the math degrades gracefully.
 */
export function parseFreezeLedger(
  earnedAtRaw: unknown,
  usedHistoryRaw: unknown,
): { earnedAt: Array<{ earnedAt: string }>; usedHistory: Array<{ dateKey: string; earnedAt: string }> } {
  const earnedAt: Array<{ earnedAt: string }> = [];
  if (Array.isArray(earnedAtRaw)) {
    for (const entry of earnedAtRaw) {
      if (entry && typeof entry === "object" && typeof (entry as { earnedAt?: unknown }).earnedAt === "string") {
        earnedAt.push({ earnedAt: (entry as { earnedAt: string }).earnedAt });
      }
    }
  }
  const usedHistory: Array<{ dateKey: string; earnedAt: string }> = [];
  if (Array.isArray(usedHistoryRaw)) {
    for (const entry of usedHistoryRaw) {
      if (
        entry &&
        typeof entry === "object" &&
        typeof (entry as { dateKey?: unknown }).dateKey === "string" &&
        typeof (entry as { earnedAt?: unknown }).earnedAt === "string"
      ) {
        const e = entry as { dateKey: string; earnedAt: string };
        usedHistory.push({ dateKey: e.dateKey, earnedAt: e.earnedAt });
      }
    }
  }
  return { earnedAt, usedHistory };
}
