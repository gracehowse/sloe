"use client";

import * as React from "react";
import { WeeklyRecapDialog } from "./weekly-recap-dialog";

interface RecapWeekDay {
  totals: { calories: number };
}

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

  const dailyCalories = days.map((d) =>
    d.totals.calories > 0 ? Math.round(d.totals.calories) : null,
  );
  const onTargetDays = days.filter(
    (d) => d.totals.calories > 0 && d.totals.calories <= targetCalories,
  ).length;
  const loggedDays = dailyCalories.filter((c) => c != null).length;
  const narrative =
    loggedDays === 0
      ? "A fresh week ahead."
      : onTargetDays >= 5
        ? "A steady, consistent week."
        : onTargetDays >= 3
          ? "Solid progress this week."
          : "Every logged day counts.";

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
