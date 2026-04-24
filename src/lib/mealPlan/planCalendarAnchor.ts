/**
 * Meal plan `meal_plan_days.day` is the 1-based index within the saved plan
 * (first column = 1), not ISO weekday. Calendar dates for each index follow
 * the same rule as the planner UI: `stripMidnight(today) + (idx + offset)` days.
 */

export function stripMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Calendar date for plan column index `idx` (0-based), offset from today by `offset` days. */
export function planCalendarDateForIndex(idx: number, offset: number = 0): Date {
  const d = stripMidnight(new Date());
  d.setDate(d.getDate() + idx + offset);
  return d;
}

/** Planner start-offset presets (today / tomorrow / next week). */
export const PLAN_WEEK_START_OFFSETS = [0, 1, 7] as const;

export type PlanDayRow = { id: string; day: number };

/**
 * Which `meal_plan_days` row (if any) corresponds to `targetCalendarDate`,
 * given only plan indices 1..7 and the same offset semantics as the planner.
 */
export function findPlanDayIdForCalendarDate(
  dayRows: PlanDayRow[],
  targetCalendarDate: Date,
  offsets: readonly number[] = PLAN_WEEK_START_OFFSETS,
): string | null {
  if (!dayRows.length) return null;
  const target = stripMidnight(targetCalendarDate).getTime();
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
