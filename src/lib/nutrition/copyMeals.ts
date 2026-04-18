/**
 * Copy-meal / duplicate-day helpers.
 *
 * Pure: no React, no Supabase, no network. Imported by both the web
 * journal hook (`src/context/appData/useNutritionJournalState.ts`) and
 * the mobile journal state in `apps/mobile/app/(tabs)/index.tsx`, so the
 * two platforms cannot drift on clone semantics or date arithmetic.
 *
 * Design notes:
 *  - `cloneMealWithoutId` strips the original `id` so the caller's insert
 *    primitive (which mints a fresh id via `newId("meal")` on web and
 *    `newMealId()` on mobile) never collides with the source row.
 *  - `addDays` anchors on **noon local** before adding days. This keeps
 *    the month/year rollover correct and is robust across DST transitions
 *    where midnight can slide an hour backwards / forwards.
 *  - `expandDateRange` is inclusive and returns `[]` for reversed ranges;
 *    the caller is responsible for deduping source day before calling.
 */

/**
 * Minimal shape for cloning a logged meal. Deliberately narrow so both
 * `LoggedMeal` (web, `src/types/recipe.ts`) and `JournalMeal`
 * (mobile, `apps/mobile/lib/nutritionJournal.ts`) satisfy it.
 */
export type MealClonable = {
  name: string;
  recipeTitle: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  waterMl?: number;
  portionMultiplier?: number;
  source?: string | null;
  micros?: Record<string, number> | null;
};

/** Parse a `YYYY-MM-DD` key into a local Date anchored at noon. */
function parseAtNoon(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  // Noon keeps us safely inside the local calendar day across DST shifts.
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function isValidDateKey(key: string): boolean {
  if (typeof key !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = parseAtNoon(key);
  return !Number.isNaN(d.getTime()) && formatDateKey(d) === key;
}

/**
 * Return a shallow clone of `meal` with no `id`. Optionally override
 * the `time` label (handy for "Copied at 14:03" style timestamps if a
 * caller ever wants to re-stamp; default is to preserve the original).
 *
 * Never mutates the input. Discards any `id` the input may have had.
 */
export function cloneMealWithoutId<M extends MealClonable>(
  meal: M,
  overrides?: Partial<{ time: string }>,
): Omit<M, "id"> {
  // Destructure out `id` defensively — `M` extends MealClonable which has
  // no `id` field, but callers pass `LoggedMeal` / `JournalMeal` that do.
  const { id: _discardedId, ...rest } = meal as M & { id?: string };
  void _discardedId;
  const next = { ...rest } as Omit<M, "id">;
  if (overrides && typeof overrides.time === "string") {
    (next as MealClonable).time = overrides.time;
  }
  return next;
}

/**
 * Inclusive list of `YYYY-MM-DD` keys between `startDateKey` and
 * `endDateKey`. If the two keys are equal, returns `[startDateKey]`.
 * If `endDateKey` is before `startDateKey`, returns `[]`.
 * Returns `[]` for invalid keys.
 */
export function expandDateRange(startDateKey: string, endDateKey: string): string[] {
  if (!isValidDateKey(startDateKey) || !isValidDateKey(endDateKey)) return [];
  if (startDateKey === endDateKey) return [startDateKey];
  const start = parseAtNoon(startDateKey);
  const end = parseAtNoon(endDateKey);
  if (end.getTime() < start.getTime()) return [];
  const out: string[] = [];
  const cursor = new Date(start);
  // Hard upper bound to avoid runaway loops on absurd inputs.
  const maxIterations = 4000; // ~11 years of daily keys.
  let i = 0;
  while (cursor.getTime() <= end.getTime() && i < maxIterations) {
    out.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
    i += 1;
  }
  return out;
}

/**
 * Add `n` days (can be negative) to a `YYYY-MM-DD` key. Handles month
 * and year rollover and is DST-safe because it anchors the date at noon
 * before shifting.
 * Returns the input unchanged if it is not a valid date key.
 */
export function addDays(dateKey: string, n: number): string {
  if (!isValidDateKey(dateKey)) return dateKey;
  const d = parseAtNoon(dateKey);
  d.setDate(d.getDate() + n);
  return formatDateKey(d);
}

/** Today's `YYYY-MM-DD` in local time. `now` is injectable for tests. */
export function todayKey(now: Date = new Date()): string {
  return formatDateKey(now);
}

/**
 * Remove the source day and dedupe the provided target day keys, in
 * arrival order. Invalid keys are dropped. Used by both platforms
 * before iterating the insert primitive.
 */
export function sanitizeCopyTargets(
  sourceDayKey: string,
  targetDayKeys: readonly string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of targetDayKeys) {
    if (!isValidDateKey(k)) continue;
    if (k === sourceDayKey) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
