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
  // 2026-05-26 (Grace): the Today card heading reflects the WINDOW
  // ("7-day rolling summary" / "This week"); the Settings control that
  // chooses that window is labelled "Deficit summary".
  return mode === "calendar_week" ? "This week" : "7-day rolling summary";
}

/**
 * The other deficit-window mode. There are only two modes, so this is a
 * straight flip. Retained as a small, well-tested helper: the in-place
 * Today toggle that used it was removed 2026-05-26 (the control now lives
 * in Settings — see `docs/journeys/food-tracking.md`), but the involution
 * is still useful for any future two-state switch and keeps the
 * mode-cycle logic in one place rather than inlined per call site.
 */
export function nextWeekSummaryMode(mode: WeekSummaryMode): WeekSummaryMode {
  return mode === "rolling" ? "calendar_week" : "rolling";
}

/**
 * Destination-of-tap label for a deficit-window switch control. Describes
 * the window the user would switch TO so the affordance reads as an
 * action rather than a status.
 *   - viewing "rolling"      → "Switch to this week"
 *   - viewing "calendar_week"→ "Switch to last 7 days"
 *
 * Retained alongside `nextWeekSummaryMode` after the in-place Today
 * toggle was removed (2026-05-26); the Settings control uses the plainer
 * "Last 7 days" / "Mon–Sun" segmented labels.
 */
export function weekSummaryToggleLabel(mode: WeekSummaryMode): string {
  return mode === "calendar_week"
    ? "Switch to last 7 days"
    : "Switch to this week";
}
