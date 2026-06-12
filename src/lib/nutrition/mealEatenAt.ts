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

/** `HH:mm` (24h) for `<input type="time">` and mobile time fields. */
export function localTimeInputValueFromIso(iso: string): string {
  const { hours, minutes } = localHoursMinutesFromIso(iso);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Parse `HH:mm` or `H:mm` (24h). Returns null when invalid. */
export function parseLocalTimeInput(raw: string): { hours: number; minutes: number } | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/** Default consumption instant when logging on `dateKey` (today → now). */
export function defaultEatenAtForNewLog(dateKey: string): string {
  const now = new Date();
  const todayKey = dateKeyFromInstant(now.toISOString());
  if (dateKey === todayKey) return now.toISOString();
  const { hours, minutes } = localHoursMinutesFromIso(now.toISOString());
  return eatenAtIsoFromLocalParts(dateKey, hours, minutes);
}

/**
 * Resolve `date_key` + `eaten_at` for a write. When `localTime` is set
 * (user edited time), both fields are derived from local tz — cross-day gate.
 */
export function nutritionEntryDateKeyAndEatenAt(
  meal: MealChronologyFields,
  anchorDateKey: string,
  localTime?: { hours: number; minutes: number } | null,
): { dateKey: string; eatenAt: string | null } {
  if (localTime) {
    const eatenAt = eatenAtIsoFromLocalParts(anchorDateKey, localTime.hours, localTime.minutes);
    return { dateKey: dateKeyFromInstant(eatenAt), eatenAt };
  }
  const eaten = meal.eatenAt?.trim();
  if (eaten) {
    return { dateKey: dateKeyFromInstant(eaten), eatenAt: eaten };
  }
  return { dateKey: anchorDateKey, eatenAt: null };
}

/** Build `eaten_at` from journal `date_key` + `HH:mm` preview input. */
export function eatenAtFromLogDateAndTime(logDateKey: string, timeInput: string): string {
  const localTime = parseLocalTimeInput(timeInput);
  if (localTime) {
    return eatenAtIsoFromLocalParts(logDateKey, localTime.hours, localTime.minutes);
  }
  return defaultEatenAtForNewLog(logDateKey);
}
