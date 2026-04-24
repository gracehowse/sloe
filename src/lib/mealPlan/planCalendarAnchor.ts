/**
 * Meal plan `meal_plan_days.day` is the 1-based index within the saved
 * plan (first column = 1), not ISO weekday. Calendar dates for each
 * index are computed from the plan's persisted `start_date` (T7 —
 * 2026-04-24 sweep): `calendarDate = start_date + (day - 1)`.
 *
 * Legacy pre-T7 rows (or JSONB plans without a persisted anchor) fall
 * back to today-aware offset iteration via `findLegacyPlanDayForCalendarDate`,
 * which is flagged as imprecise in the audit (§C2) and should be
 * removed once all plans have migrated.
 */

export function stripMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Calendar date for plan column index `idx` (0-based), offset from
 *  today by `offset` days. Kept for the legacy JSONB fallback +
 *  planner UI's "start offset" chip preview. */
export function planCalendarDateForIndex(idx: number, offset: number = 0): Date {
  const d = stripMidnight(new Date());
  d.setDate(d.getDate() + idx + offset);
  return d;
}

/** Planner start-offset presets (today / tomorrow / next week). Still
 *  used by the persist path to translate the UI chip selection into a
 *  calendar `start_date` at save time. */
export const PLAN_WEEK_START_OFFSETS = [0, 1, 7] as const;

/**
 * Parse a Postgres `date` column value into a JS `Date` at local
 * midnight. Supabase returns `date` columns as ISO `YYYY-MM-DD`; `new
 * Date('YYYY-MM-DD')` is parsed as UTC, so we deliberately parse the
 * parts to construct a local-midnight Date.
 */
function parseStartDate(raw: string | null | undefined): Date | null {
  if (typeof raw !== "string" || raw.length < 10) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo, d, 0, 0, 0, 0);
}

/**
 * Compute the canonical `YYYY-MM-DD` start_date for a plan given a
 * local "today" and the UI's chip offset (0 = today, 1 = tomorrow, 7
 * = next week). Used by the persist path so the column stores the
 * exact date the user intended day 1 to be.
 */
export function startDateForOffset(today: Date, offset: number): string {
  const d = stripMidnight(today);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type PlanDayRow = {
  id: string;
  day: number;
  /** T7: when present, the resolver uses `start_date + (day - 1)` to
   *  compute the calendar date deterministically. Null / missing for
   *  pre-migration rows during the rollout window. */
  start_date?: string | null;
};

/**
 * Which `meal_plan_days` row (if any) corresponds to `targetCalendarDate`.
 *
 * Resolution order:
 *   1. If ALL rows carry `start_date`, compute `start_date + (day - 1)`
 *      and return the exact match.
 *   2. If ANY row is missing `start_date` (legacy), fall back to the
 *      pre-T7 offset-iteration logic — same behaviour as before for
 *      a graceful rollout window. Flagged as imprecise; remove once
 *      all plans have backfilled.
 */
export function findPlanDayIdForCalendarDate(
  dayRows: PlanDayRow[],
  targetCalendarDate: Date,
  offsets: readonly number[] = PLAN_WEEK_START_OFFSETS,
): string | null {
  if (!dayRows.length) return null;
  const target = stripMidnight(targetCalendarDate).getTime();

  const anyMissingAnchor = dayRows.some(
    (r) => parseStartDate(r.start_date ?? null) == null,
  );

  if (!anyMissingAnchor) {
    // T7 fast path — deterministic anchor lookup.
    for (const row of dayRows) {
      const anchor = parseStartDate(row.start_date ?? null);
      if (!anchor) continue;
      const rowDate = new Date(anchor);
      rowDate.setDate(rowDate.getDate() + (row.day - 1));
      if (stripMidnight(rowDate).getTime() === target) return row.id;
    }
    return null;
  }

  // Legacy fallback — pre-T7 rows without a persisted start_date.
  // Documented as imprecise; kept for rollout safety.
  for (const off of offsets) {
    for (const row of dayRows) {
      const cal = planCalendarDateForIndex(row.day - 1, off);
      if (stripMidnight(cal).getTime() === target) {
        return row.id;
      }
    }
  }
  return null;
}

export function findLegacyPlanDayForCalendarDate<T extends { day: number }>(
  days: T[],
  targetCalendarDate: Date,
  offsets: readonly number[] = PLAN_WEEK_START_OFFSETS,
): T | null {
  if (!days.length) return null;
  const target = stripMidnight(targetCalendarDate).getTime();
  for (const off of offsets) {
    for (const d of days) {
      const cal = planCalendarDateForIndex(d.day - 1, off);
      if (stripMidnight(cal).getTime() === target) {
        return d;
      }
    }
  }
  return null;
}
