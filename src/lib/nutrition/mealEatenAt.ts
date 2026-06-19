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

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
};

function zonedPartsFromInstant(iso: string, timeZone: string): ZonedDateTimeParts | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(iso));
    const value = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const out = {
      year: value("year"),
      month: value("month"),
      day: value("day"),
      hours: value("hour"),
      minutes: value("minute"),
    };
    return Object.values(out).every(Number.isFinite) ? out : null;
  } catch {
    return null;
  }
}

function wallClockMs(parts: ZonedDateTimeParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hours, parts.minutes, 0, 0);
}

/**
 * Convert a named-zone wall-clock time to a UTC ISO instant.
 * JS has no Date constructor for "YYYY-MM-DD HH:mm in Europe/London", so this
 * starts from the same numeric fields as UTC, reads how that instant formats in
 * the target zone, then applies the wall-clock delta. A second pass covers DST
 * seams where the first offset guess crosses a transition.
 */
function isoFromZonedLocalParts(
  dateKey: string,
  hours: number,
  minutes: number,
  timeZone: string,
): string | null {
  const [y, mo, da] = dateKey.split("-").map((p) => Number(p));
  if (![y, mo, da, hours, minutes].every(Number.isFinite)) return null;
  const desired = { year: y, month: mo || 1, day: da || 1, hours, minutes };
  const desiredMs = wallClockMs(desired);
  let utcMs = Date.UTC(desired.year, desired.month - 1, desired.day, hours, minutes, 0, 0);

  for (let i = 0; i < 2; i += 1) {
    const actual = zonedPartsFromInstant(new Date(utcMs).toISOString(), timeZone);
    if (!actual) return null;
    const delta = desiredMs - wallClockMs(actual);
    if (delta === 0) break;
    utcMs += delta;
  }

  return new Date(utcMs).toISOString();
}

/** `YYYY-MM-DD` in the user's local/canonical timezone from an ISO instant. */
export function dateKeyFromInstant(iso: string, timeZone?: string | null): string {
  if (timeZone) {
    const parts = zonedPartsFromInstant(iso, timeZone);
    if (parts) {
      return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
    }
  }
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
  timeZone?: string | null,
): string {
  if (timeZone) {
    const zoned = isoFromZonedLocalParts(dateKey, hours, minutes, timeZone);
    if (zoned) return zoned;
  }
  const [y, mo, da] = dateKey.split("-").map((p) => Number(p));
  const d = new Date(y, (mo || 1) - 1, da || 1, hours, minutes, 0, 0);
  return d.toISOString();
}

/** Parse local hours/minutes from an ISO instant. */
export function localHoursMinutesFromIso(
  iso: string,
  timeZone?: string | null,
): { hours: number; minutes: number } {
  if (timeZone) {
    const parts = zonedPartsFromInstant(iso, timeZone);
    if (parts) return { hours: parts.hours, minutes: parts.minutes };
  }
  const d = new Date(iso);
  return { hours: d.getHours(), minutes: d.getMinutes() };
}

/** `HH:mm` (24h) for `<input type="time">` and mobile time fields. */
export function localTimeInputValueFromIso(iso: string, timeZone?: string | null): string {
  const { hours, minutes } = localHoursMinutesFromIso(iso, timeZone);
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
export function defaultEatenAtForNewLog(dateKey: string, timeZone?: string | null): string {
  const now = new Date();
  const todayKey = dateKeyFromInstant(now.toISOString(), timeZone);
  if (dateKey === todayKey) return now.toISOString();
  const { hours, minutes } = localHoursMinutesFromIso(now.toISOString(), timeZone);
  return eatenAtIsoFromLocalParts(dateKey, hours, minutes, timeZone);
}

/**
 * Resolve `date_key` + `eaten_at` for a write. When `localTime` is set
 * (user edited time), both fields are derived from local tz — cross-day gate.
 */
export function nutritionEntryDateKeyAndEatenAt(
  meal: MealChronologyFields,
  anchorDateKey: string,
  localTime?: { hours: number; minutes: number } | null,
  timeZone?: string | null,
): { dateKey: string; eatenAt: string | null } {
  if (localTime) {
    const eatenAt = eatenAtIsoFromLocalParts(anchorDateKey, localTime.hours, localTime.minutes, timeZone);
    return { dateKey: dateKeyFromInstant(eatenAt, timeZone), eatenAt };
  }
  const eaten = meal.eatenAt?.trim();
  if (eaten) {
    return { dateKey: dateKeyFromInstant(eaten, timeZone), eatenAt: eaten };
  }
  return { dateKey: anchorDateKey, eatenAt: null };
}

/**
 * Re-anchor an `eaten_at` instant onto a different calendar day, preserving
 * the local wall-clock time ("I usually eat this at 8am" survives the copy).
 *
 * Copy/duplicate flows MUST run clones through this before persisting to
 * another day: `cloneMealWithoutId` spreads `...rest`, so a clone keeps its
 * SOURCE-day `eatenAt`, and every write path derives `date_key` from
 * `eaten_at` when set (`nutritionEntryDateKeyAndEatenAt`) — an un-re-anchored
 * clone would silently bucket back to the source day, corrupting daily totals
 * (launch-audit 2026-06-12, follow-up to P1-2).
 *
 * Same-day re-anchor is the identity; null/undefined passes through as null.
 */
export function reanchorEatenAtToDay(
  eatenAt: string | null | undefined,
  targetDateKey: string,
  timeZone?: string | null,
): string | null {
  const iso = eatenAt?.trim();
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  if (dateKeyFromInstant(iso, timeZone) === targetDateKey) return iso;
  const { hours, minutes } = localHoursMinutesFromIso(iso, timeZone);
  return eatenAtIsoFromLocalParts(targetDateKey, hours, minutes, timeZone);
}

/** Meal-level convenience for clone/copy flows (see `reanchorEatenAtToDay`). */
export function reanchorMealEatenAt<M extends MealChronologyFields>(
  meal: M,
  targetDateKey: string,
  timeZone?: string | null,
): M {
  return { ...meal, eatenAt: reanchorEatenAtToDay(meal.eatenAt, targetDateKey, timeZone) };
}

/** Build `eaten_at` from journal `date_key` + `HH:mm` preview input. */
export function eatenAtFromLogDateAndTime(
  logDateKey: string,
  timeInput: string,
  timeZone?: string | null,
): string {
  const localTime = parseLocalTimeInput(timeInput);
  if (localTime) {
    return eatenAtIsoFromLocalParts(logDateKey, localTime.hours, localTime.minutes, timeZone);
  }
  return defaultEatenAtForNewLog(logDateKey, timeZone);
}
