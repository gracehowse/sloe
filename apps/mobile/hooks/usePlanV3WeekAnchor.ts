import { useMemo } from "react";
import {
  planCalendarDateForIndex,
  planDayCalendarDate,
} from "@suppr/shared/mealPlan/planCalendarAnchor";

/**
 * ENG-1480 — ONE anchor for the Plan v3 header overline + week strip.
 *
 * A persisted `start_date` only labels the header while the plan actually
 * HAS meals; an empty plan's week is prospective (today + the start-offset
 * chip), never a dead anchor left behind by a since-cleared plan. This also
 * kills the captured header flicker ("9–15 July" → "5–11 July"): the
 * pre-hydration frame and the settled frame agree for empty plans.
 *
 * `planDayCalendarDate` parses the anchor at local midnight — a bare
 * `new Date("YYYY-MM-DD")` is UTC-parsed and shifts a calendar day in
 * negative-offset timezones (see planCalendarAnchor.ts).
 */
export function usePlanV3WeekAnchor(args: {
  planHasRealMeals: boolean;
  planStartDate: string | null;
  startOffset: number;
}) {
  const { planHasRealMeals, planStartDate, startOffset } = args;
  const anchor = useMemo(
    () =>
      planHasRealMeals && planStartDate
        ? planDayCalendarDate({ planDayNumber: 1, startDate: planStartDate })
        : planCalendarDateForIndex(0, startOffset),
    [planHasRealMeals, planStartDate, startOffset],
  );
  const weekLabel = useMemo(() => {
    const end = new Date(anchor);
    end.setDate(anchor.getDate() + 6);
    const mon = (d: Date) => d.toLocaleDateString("en-GB", { month: "long" });
    return anchor.getMonth() === end.getMonth()
      ? `${anchor.getDate()}–${end.getDate()} ${mon(anchor)}`
      : `${anchor.getDate()} ${mon(anchor)} – ${end.getDate()} ${mon(end)}`;
  }, [anchor]);
  // Week-strip dates share the anchor so overline + strip can never
  // disagree about which week the header describes.
  const weekDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(anchor);
        d.setDate(anchor.getDate() + i);
        return d;
      }),
    [anchor],
  );
  return { weekLabel, weekDates };
}
