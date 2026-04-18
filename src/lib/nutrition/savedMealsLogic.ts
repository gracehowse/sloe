/**
 * Saved meals — pure helpers (Batch 2.6).
 *
 * No React, no Supabase, no Date-singleton access. Imported by both the
 * web Quick Add panel (`saved-meals-tab.tsx`) and the mobile Quick Add
 * panel (inline in `apps/mobile/app/(tabs)/index.tsx`) so the two
 * platforms cannot drift on summary math or scaling semantics.
 *
 * What lives here:
 *  - `summariseSavedMeal` — total kcal / P / C / F + item count for the
 *    whole combo, respecting each item's `portionMultiplier`.
 *  - `buildMealEntriesFromSavedMeal` — convert a saved meal into an
 *    array of `LoggedMeal`-shaped entries ready to insert via the
 *    existing `addLoggedMealForDate` (web) / `setByDay` (mobile) path.
 *    The caller provides `makeId` so the id generator stays consistent
 *    with the rest of the platform (web `newId("meal")`, mobile
 *    `newMealId()`).
 */

import type { SavedMeal, SavedMealItem } from "./savedMeals";

function safeNumber(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function safeNonNegative(n: unknown): number {
  const v = safeNumber(n);
  return v >= 0 ? v : 0;
}

/** Effective portion multiplier — always > 0. Missing / zero / negative
 * values fall back to 1 so "no explicit scaling" === "one portion". */
export function effectivePortionMultiplier(item: SavedMealItem): number {
  const raw =
    item.portionMultiplier != null && Number.isFinite(Number(item.portionMultiplier))
      ? Number(item.portionMultiplier)
      : 1;
  return raw > 0 ? raw : 1;
}

export type SavedMealSummary = {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  itemCount: number;
};

/**
 * Sum macros across every item, scaling each by its `portionMultiplier`.
 * Rounds kcal to an integer and P/C/F to one decimal — matches the
 * display format the Quick Add panel uses elsewhere.
 *
 * Empty combos return all zeroes; they are never rendered as rows by the
 * UI, but the function stays total so tests can assert the invariant.
 */
export function summariseSavedMeal(meal: SavedMeal): SavedMealSummary {
  const items = Array.isArray(meal?.items) ? meal.items : [];
  let kcal = 0;
  let p = 0;
  let c = 0;
  let f = 0;
  for (const it of items) {
    const pm = effectivePortionMultiplier(it);
    kcal += safeNonNegative(it.calories) * pm;
    p += safeNonNegative(it.protein) * pm;
    c += safeNonNegative(it.carbs) * pm;
    f += safeNonNegative(it.fat) * pm;
  }
  return {
    totalCalories: Math.round(kcal),
    totalProtein: Math.round(p * 10) / 10,
    totalCarbs: Math.round(c * 10) / 10,
    totalFat: Math.round(f * 10) / 10,
    itemCount: items.length,
  };
}

/** Shape returned by `buildMealEntriesFromSavedMeal`. Matches the common
 * fields of web `LoggedMeal` and mobile `JournalMeal` so either caller
 * can use the result directly as `Omit<LoggedMeal,"id"> | JournalMeal`. */
export type BuiltMealEntry = {
  id: string;
  name: string;
  recipeTitle: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  waterMl?: number;
  portionMultiplier: number;
  source?: string;
  sourceId?: string;
};

/**
 * Convert every item in `meal.items` into one logged-meal entry in the
 * same order. Each entry:
 *  - has a fresh id from `makeId()` (so a `saved meal with 3 items` logs
 *    as 3 rows in `nutrition_entries`, each with its own id)
 *  - lands in `slot` with the given `timeLabel`
 *  - carries the item's snapshot macros **already scaled** by its
 *    `portionMultiplier` so the persisted row totals match what the
 *    user saw in the Quick Add panel
 *  - preserves `portionMultiplier = 1` on the output entry (the macros
 *    are already scaled), so downstream code that also multiplies by
 *    `portionMultiplier` does not double-count.
 *
 * `fiber` / `waterMl` / `source` / `sourceId` propagate only when
 * present — undefined fields stay undefined rather than becoming `null`
 * so the output is interchangeable with a manual log.
 *
 * Generic `T` lets the caller type-narrow to their platform's shape
 * (`Omit<LoggedMeal, "id">` on web, `JournalMeal` on mobile) — the
 * function body itself deals only with the common fields.
 */
export function buildMealEntriesFromSavedMeal<T extends BuiltMealEntry = BuiltMealEntry>(
  meal: SavedMeal,
  slot: string,
  timeLabel: string,
  makeId: () => string,
): T[] {
  const items = Array.isArray(meal?.items) ? meal.items : [];
  const out: BuiltMealEntry[] = [];
  for (const it of items) {
    const pm = effectivePortionMultiplier(it);
    const kcal = Math.round(safeNonNegative(it.calories) * pm);
    const protein = Math.round(safeNonNegative(it.protein) * pm * 10) / 10;
    const carbs = Math.round(safeNonNegative(it.carbs) * pm * 10) / 10;
    const fat = Math.round(safeNonNegative(it.fat) * pm * 10) / 10;

    const entry: BuiltMealEntry = {
      id: makeId(),
      name: slot,
      recipeTitle: String(it.recipeTitle ?? "").trim() || meal.name,
      time: timeLabel,
      calories: kcal,
      protein,
      carbs,
      fat,
      // Macros above are already scaled — set the output multiplier to 1
      // so callers that multiply `calories * portionMultiplier` do not
      // double-count.
      portionMultiplier: 1,
    };

    if (it.fiber != null && Number.isFinite(Number(it.fiber))) {
      entry.fiberG = Math.round(safeNonNegative(it.fiber) * pm * 10) / 10;
    }
    if (it.waterMl != null && Number.isFinite(Number(it.waterMl))) {
      entry.waterMl = Math.round(safeNonNegative(it.waterMl) * pm);
    }
    if (it.source) entry.source = String(it.source);
    if (it.sourceId) entry.sourceId = String(it.sourceId);

    out.push(entry);
  }
  return out as T[];
}
