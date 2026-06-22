"use client";

import * as React from "react";
import { WeeklyRecapDialog } from "./weekly-recap-dialog";
import {
  deriveWeeklyRecapStats,
  type RecapWeekDayTotals as RecapWeekDay,
} from "../../../lib/nutrition-core/weeklyRecapStats";

/**
 * useWeeklyRecap — derives the shareable recap stats from the Today week strip
 * and owns the recap dialog (ENG-1225 #20). Returns a `trigger` for the
 * StreakPip's `onStreakPress` and the rendered `dialog`, so the pinned Today
 * host (`NutritionTracker`) only gains a couple of lines.
 *
 * Narrative is derived, never fabricated — it reflects the real on-target count.
 */
export function useWeeklyRecap(
  days: RecapWeekDay[],
  weekLabel: string,
  targetCalories: number,
): { trigger: () => void; dialog: React.ReactNode } {
  const [open, setOpen] = React.useState(false);

  // Shared derivation (ENG-1225 #4) — web + mobile compute identical stats.
  const { dailyCalories, onTargetDays, narrative } = deriveWeeklyRecapStats(
    days,
    targetCalories,
  );

  const dialog = (
    <WeeklyRecapDialog
      open={open}
      onOpenChange={setOpen}
      weekLabel={weekLabel}
      onTargetDays={onTargetDays}
      dailyCalories={dailyCalories}
      targetCalories={Math.round(targetCalories)}
      narrative={narrative}
    />
  );

  return { trigger: () => setOpen(true), dialog };
}
