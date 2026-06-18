/**
 * ENG-772 — meal consumption chronology helpers.
 * Within-day ordering and display use coalesce(eaten_at, created_at).
 * date_key remains day-attribution truth; compute from the user's canonical
 * IANA timezone when provided, never UTC slice.
 */

export type MealChronologyFields = {
  eatenAt?: string | null;
  createdAt?: string | null;
};

export type MealEatenAtOptions = {
  /** IANA timezone from profiles.tz_iana. Omit for current device local time. */
  timeZone?: string | null;
};

function normalizeTimeZone(timeZone?: string | null): string | undefined {
  const tz = timeZone?.trim();
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return undefined;
  }
}

function zonedDateTimeParts(instant: Date, timeZone?: string | null) {
  const tz = normalizeTimeZone(timeZone);
  if (!tz) {
    return {
      year: instant.getFullYear(),
      month: instant.getMonth() + 1,
      day: instant.getDate(),
      hours: instant.getHours(),
      minutes: instant.getMinutes(),
      seconds: instant.getSeconds(),
    };
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hours: get("hour"),
    minutes: get("minute"),
    seconds: get("second"),
  };
}

function timezoneOffsetMs(timeZone: string, utcMs: number): number {
  const parts = zonedDateTimeParts(new Date(utcMs), timeZone);
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hours,
    parts.minutes,
    parts.seconds,
  ) - utcMs;
}

function instantFromZonedParts(
  dateKey: string,
  hours: number,
  minutes: number,
  timeZone?: string | null,
): Date {
  const [y, mo, da] = dateKey.split("-").map((p) => Number(p));
  const year = y || 1970;
  const month = (mo || 1) - 1;
  const day = da || 1;
  const tz = normalizeTimeZone(timeZone);
  if (!tz) return new Date(year, month, day, hours, minutes, 0, 0);

  const wallClockAsUtc = Date.UTC(year, month, day, hours, minutes, 0, 0);
  const firstOffset = timezoneOffsetMs(tz, wallClockAsUtc);
  let utcMs = wallClockAsUtc - firstOffset;
  const secondOffset = timezoneOffsetMs(tz, utcMs);
  if (secondOffset !== firstOffset) {
    utcMs = wallClockAsUtc - secondOffset;
  }
  return new Date(utcMs);
}

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

/** `YYYY-MM-DD` in the user's canonical timezone from an ISO instant. */
export function dateKeyFromInstant(iso: string, timeZone?: string | null): string {
  const d = new Date(iso);
  const parts = zonedDateTimeParts(d, timeZone);
  const mo = String(parts.month).padStart(2, "0");
  const da = String(parts.day).padStart(2, "0");
  return `${parts.year}-${mo}-${da}`;
}

/** Format chronology instant for UI (replaces trusting stale time_label). */
export function formatMealTimeFromChronology(
  meal: MealChronologyFields,
  opts?: { locale?: string; timeZone?: string | null },
): string {
  const iso = mealChronologyInstantIso(meal);
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(opts?.locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: normalizeTimeZone(opts?.timeZone),
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
  return instantFromZonedParts(dateKey, hours, minutes, timeZone).toISOString();
}

/** Parse canonical-zone hours/minutes from an ISO instant. */
export function localHoursMinutesFromIso(
  iso: string,
  timeZone?: string | null,
): { hours: number; minutes: number } {
  const parts = zonedDateTimeParts(new Date(iso), timeZone);
  return { hours: parts.hours, minutes: parts.minutes };
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
 * (user edited time), both fields are derived from canonical tz — cross-day gate.
 */
export function nutritionEntryDateKeyAndEatenAt(
  meal: MealChronologyFields,
  anchorDateKey: string,
  localTime?: { hours: number; minutes: number } | null,
  opts?: MealEatenAtOptions,
): { dateKey: string; eatenAt: string | null } {
  const timeZone = opts?.timeZone;
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
  opts?: MealEatenAtOptions,
): string | null {
  const iso = eatenAt?.trim();
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const timeZone = opts?.timeZone;
  if (dateKeyFromInstant(iso, timeZone) === targetDateKey) return iso;
  const { hours, minutes } = localHoursMinutesFromIso(iso, timeZone);
  return eatenAtIsoFromLocalParts(targetDateKey, hours, minutes, timeZone);
}

/** Meal-level convenience for clone/copy flows (see `reanchorEatenAtToDay`). */
export function reanchorMealEatenAt<M extends MealChronologyFields>(
  meal: M,
  targetDateKey: string,
  opts?: MealEatenAtOptions,
): M {
  return { ...meal, eatenAt: reanchorEatenAtToDay(meal.eatenAt, targetDateKey, opts) };
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
