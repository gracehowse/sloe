/**
 * ENG (2026-06-12, launch-audit P1-1 / P1-2) — single source of truth for the
 * `nutrition_entries` upsert/update row shape.
 *
 * Three paths wrote rows to `nutrition_entries` with hand-rolled, almost-but-
 * not-quite-identical object literals:
 *   - `persistMealsImmediate` (Today, immediate insert/upsert)
 *   - `persistMealUpdateImmediate` (Today, immediate edit-save UPDATE)
 *   - `useNutritionEntriesSync` (the 600ms debounced backstop)
 *
 * The backstop omitted `eaten_at` entirely and hard-coded `date_key` to the
 * selected day. Today that was only safe because the omission was *uniform*
 * (PostgREST excludes a column from the upsert set when no row has it) and the
 * UI clamps time edits to the anchor day. One heterogeneous batch — or a
 * refactor that adds `eaten_at` to some rows but not others — and the backstop
 * would either NULL a real consumption time or reset `date_key`, re-introducing
 * the exact data-loss class that previously cost Grace ~25 days of journal data.
 *
 * Routing all three call sites through these builders guarantees:
 *   1. `eaten_at` + an eaten-derived `date_key` are ALWAYS present, derived via
 *      the shared `mealEatenAt` helper exactly as the immediate path derives them.
 *   2. The upsert column set is identical for every meal in a batch — a meal
 *      with `eatenAt` and one without produce the same `Object.keys`, so the
 *      PostgREST upsert column set can never become heterogeneous.
 */
import { newMealId, type JournalMeal } from "@/lib/nutritionJournal";
import { canonicalNutritionEntrySource } from "@suppr/shared/nutrition/canonicalNutritionEntrySource";
import { nutritionEntryDateKeyAndEatenAt } from "@suppr/shared/nutrition/mealEatenAt";

/** Matches the `nutrition_entries` id format; non-matching ids get re-minted. */
export const NUTRITION_ENTRY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Insert/upsert row for `nutrition_entries`. */
export type NutritionEntryRow = {
  id: string;
  user_id: string;
  date_key: string;
  name: string;
  recipe_title: string;
  time_label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number | null;
  water_ml: number | null;
  portion_multiplier: number;
  nutrition_micros: Record<string, number>;
  source: string | null;
  recipe_id: string | null;
  eaten_at: string | null;
};

/** UPDATE payload for `nutrition_entries` (no `id`/`user_id` — those are the `.eq()` scope). */
export type NutritionEntryUpdatePayload = Omit<NutritionEntryRow, "id" | "user_id" | "recipe_id">;

/** `nutrition_micros` JSONB the way every write path normalises it (drop empty → `{}`). */
function microsForWrite(micros: JournalMeal["micros"]): Record<string, number> {
  return micros && Object.keys(micros).length > 0 ? micros : {};
}

/**
 * Build the EXACT row `persistMealsImmediate` writes today, plus a guaranteed
 * `eaten_at` + eaten-derived `date_key`.
 *
 * - `id`: kept when it's a real UUID, re-minted via `newMealId()` otherwise
 *   (a fresh client-side id, never a server round-trip).
 * - `eaten_at`: `meal.eatenAt ?? null` (no `localTime` override — callers that
 *   edited a time bake it into `meal.eatenAt` before calling).
 * - `date_key`: derived from `eaten_at` when set, falling back to `anchorDayKey`
 *   when `eatenAt` is null — identical to `nutritionEntryDateKeyAndEatenAt`.
 *
 * Every returned object has the same key set regardless of whether `eatenAt`
 * was present, so a batch is never a heterogeneous upsert column set.
 */
export function buildNutritionEntryRow(
  meal: JournalMeal,
  anchorDayKey: string,
  userId: string,
  timeZone?: string | null,
): NutritionEntryRow {
  const id = NUTRITION_ENTRY_UUID_RE.test(meal.id) ? meal.id : newMealId();
  const { dateKey, eatenAt } = nutritionEntryDateKeyAndEatenAt(meal, anchorDayKey, null, { timeZone });
  return {
    id,
    user_id: userId,
    date_key: dateKey,
    name: meal.name,
    recipe_title: meal.recipeTitle,
    time_label: meal.time,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    fiber_g: meal.fiberG ?? null,
    water_ml: meal.waterMl ?? null,
    portion_multiplier: meal.portionMultiplier ?? 1,
    nutrition_micros: microsForWrite(meal.micros),
    source: canonicalNutritionEntrySource(meal.source),
    recipe_id: meal.recipeId ?? null,
    eaten_at: eatenAt,
  };
}

/**
 * Build the EXACT UPDATE payload `persistMealUpdateImmediate` writes today,
 * including `eaten_at` + the eaten-derived `date_key`.
 *
 * `localTime` (when the user edited the time field) is forwarded to the shared
 * helper so the same-day clamp is honoured: a time on `anchorDayKey` rebuilds
 * `eaten_at` from local parts on that day and `date_key` stays the anchor day.
 */
export function buildNutritionEntryUpdatePayload(
  meal: JournalMeal,
  anchorDayKey: string,
  localTime?: { hours: number; minutes: number } | null,
  timeZone?: string | null,
): NutritionEntryUpdatePayload {
  const { dateKey, eatenAt } = nutritionEntryDateKeyAndEatenAt(meal, anchorDayKey, localTime, { timeZone });
  return {
    date_key: dateKey,
    name: meal.name,
    recipe_title: meal.recipeTitle,
    time_label: meal.time,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    fiber_g: meal.fiberG ?? null,
    water_ml: meal.waterMl ?? null,
    portion_multiplier: meal.portionMultiplier ?? 1,
    nutrition_micros: microsForWrite(meal.micros),
    source: canonicalNutritionEntrySource(meal.source),
    eaten_at: eatenAt,
  };
}
