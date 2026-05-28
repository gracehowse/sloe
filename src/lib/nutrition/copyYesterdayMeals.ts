/**
 * "Copy yesterday" quick-log helper (ENG-709).
 *
 * Pure: no React, no Supabase, no Date (caller passes dateKey so this
 * is always testable without mocking wall-clock time).
 *
 * Returns the meal array for the day immediately before `todayKey`,
 * or an empty array when yesterday has no meals. The caller is
 * responsible for generating fresh IDs before persisting — raw
 * yesterday meal objects are returned as-is so the caller can decide
 * the persistence path (optimistic update + Supabase insert).
 */

/** YYYY-MM-DD → the previous calendar day in the same format. */
export function previousDayKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/**
 * Return the meals logged on the day before `todayKey`.
 * Returns an empty array (never null) so callers can write
 * `if (meals.length === 0) return` without null checks.
 *
 * @param byDay  The in-memory journal map, keyed YYYY-MM-DD.
 * @param todayKey  The current day ("today") — meals from the
 *   PREVIOUS day are returned.
 */
export function getYesterdayMeals<M>(byDay: Record<string, M[]>, todayKey: string): M[] {
  const key = previousDayKey(todayKey);
  const meals = byDay[key];
  return Array.isArray(meals) ? meals : [];
}
