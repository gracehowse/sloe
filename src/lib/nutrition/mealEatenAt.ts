/**
 * ENG-772 — meal consumption chronology helpers.
 * Within-day ordering and display use coalesce(eaten_at, created_at).
 * date_key remains day-attribution truth; compute from local tz, never UTC slice.
 */

export type MealChronologyFields = {
  eatenAt?: string | null;
  createdAt?: string | null;
};

/** ISO instant used for chronology, or null when neither field is set. */
export function mealChronologyInstantIso(meal: MealChronologyFields): string | null {
  const eaten = meal.eatenAt?.trim();
  if (eaten) return eaten;
  const created = meal.createdAt?.trim();
  return created || null;
}

export function mealChronologyMs(meal: MealChronologyFields): number {
  const iso = mealChronologyInstantIso(meal);
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

/** `YYYY-MM-DD` in the user's local timezone from an ISO instant. */
export function dateKeyFromInstant(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Format chronology instant for UI (replaces trusting stale time_label). */
export function formatMealTimeFromChronology(
  meal: MealChronologyFields,
  opts?: { locale?: string },
): string {
  const iso = mealChronologyInstantIso(meal);
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(opts?.locale, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Ascending chronology (earlier meals first). */
export function compareMealsByChronology(
  a: MealChronologyFields,
  b: MealChronologyFields,
): number {
  return mealChronologyMs(a) - mealChronologyMs(b);
}

/**
 * Build an `eaten_at` ISO from a calendar day (`date_key`) + local clock
 * hours/minutes on that day.
 */
export function eatenAtIsoFromLocalParts(
  dateKey: string,
  hours: number,
  minutes: number,
): string {
  const [y, mo, da] = dateKey.split("-").map((p) => Number(p));
  const d = new Date(y, (mo || 1) - 1, da || 1, hours, minutes, 0, 0);
  return d.toISOString();
}

/** Parse local hours/minutes from an ISO instant. */
export function localHoursMinutesFromIso(iso: string): { hours: number; minutes: number } {
  const d = new Date(iso);
  return { hours: d.getHours(), minutes: d.getMinutes() };
}
