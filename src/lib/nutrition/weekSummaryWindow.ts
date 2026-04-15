import { dateKeyFromDate } from "./trackerStats";

export type WeekSummaryMode = "rolling" | "calendar_week";

export function normalizeWeekSummaryMode(raw: unknown): WeekSummaryMode {
  if (raw === "calendar_week") return "calendar_week";
  return "rolling";
}

/**
 * Date keys (YYYY-MM-DD) for the nutrition tracker burn/deficit summary.
 * - rolling: anchor day and the six prior calendar days (7 days ending on anchor).
 * - calendar_week: the seven days of the week that contains anchor, respecting week start (Mon or Sun).
 */
export function weekSummaryDateKeys(
  mode: WeekSummaryMode,
  anchor: Date,
  weekStartDay: "monday" | "sunday",
): string[] {
  const anchorNoon = new Date(anchor);
  anchorNoon.setHours(12, 0, 0, 0);

  if (mode === "rolling") {
    const keys: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(anchorNoon);
      d.setDate(anchorNoon.getDate() - i);
      keys.push(dateKeyFromDate(d));
    }
    return keys;
  }

  const d = new Date(anchorNoon);
  const dow = d.getDay();
  const startOffset =
    weekStartDay === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
  const weekFirst = new Date(d);
  weekFirst.setDate(d.getDate() + startOffset);
  weekFirst.setHours(12, 0, 0, 0);

  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(weekFirst);
    x.setDate(weekFirst.getDate() + i);
    keys.push(dateKeyFromDate(x));
  }
  return keys;
}

export function weekSummaryHeading(mode: WeekSummaryMode): string {
  return mode === "calendar_week" ? "This week" : "7-day rolling summary";
}
