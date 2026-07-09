import { useMemo } from "react";

import {
  buildWeekStats,
  type WeekStatsBundle,
  type ByDayOf,
  type DayTargetOverride,
  type MealMacros,
} from "@/lib/progressWeekReport";

/**
 * `proteinOnTargetDays` for the legacy `DigestStoryCard`, anchored to the
 * digest's PREVIOUS COMPLETED week — the same window `buildDigestWeekView`/
 * `recap` use, NOT the current-week `weekStats` the "THIS WEEK" chart/chips
 * above it use. Mixing those two 7-day windows on one card was the "929 vs
 * 1,402" avg-divergence bug (ENG-1373). Everything else the legacy card
 * needs comes from `recap` (a `WeeklyRecap`, which doesn't carry this field).
 */
export function useDigestWeekStats<M extends MealMacros>(
  byDay: ByDayOf<M>,
  targets: { calories: number; protein: number; carbs: number; fat: number; fiber?: number },
  weekStartDay: "monday" | "sunday",
  targetsByDay?: Record<string, DayTargetOverride | null | undefined>,
): WeekStatsBundle {
  return useMemo(() => {
    const previousWeekAnchor = new Date();
    previousWeekAnchor.setDate(previousWeekAnchor.getDate() - 7);
    return buildWeekStats(byDay, targets, weekStartDay, previousWeekAnchor, targetsByDay);
  }, [byDay, targets, weekStartDay, targetsByDay]);
}
