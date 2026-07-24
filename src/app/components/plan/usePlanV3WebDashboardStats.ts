import { useMemo } from "react";

import type { DayPlan } from "@/types/recipe";

/**
 * Derivation helpers for {@link PlanV3WebDashboard}'s week-health strip and
 * open-slots nudge. Extracted 2026-07-24 (design-consistency pass) to keep the
 * dashboard under the 400-line screen cap once the empty week grew a ghosted
 * preview — the file is a composition surface, so its pure derivations belong
 * beside it rather than inside it.
 *
 * Both are grounded in the real plan: nothing here invents a suggestion.
 */
export const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type WeekStat = { value: string; label: string };

/** Derive the week-health stat strip from the real plan (planned days, the
 *  week's average calories + protein over planned days, and the daily target). */
export function useWeekStats(plan: DayPlan[], targetKcal: number): WeekStat[] {
  return useMemo(() => {
    const plannedDays = plan.filter((d) => d.meals.some((m) => !m.isPlaceholder));
    const n = plannedDays.length;
    const avg = (pick: (d: DayPlan) => number) =>
      n === 0 ? 0 : Math.round(plannedDays.reduce((s, d) => s + pick(d), 0) / n);
    return [
      { value: `${n}/7`, label: "Days planned" },
      // ENG-1533 — comma-format kcal so it matches the "1,856" used everywhere
      // else (was raw String() → "1856").
      { value: avg((d) => d.totals?.calories ?? 0).toLocaleString(), label: "Avg cal" },
      { value: `${avg((d) => d.totals?.protein ?? 0)}g`, label: "Avg protein" },
      { value: targetKcal.toLocaleString(), label: "Daily target" },
    ];
  }, [plan, targetKcal]);
}

/** The weekday names that still have an open slot, for a single grounded nudge. */
export function useOpenSlots(plan: DayPlan[], weekDates: Date[]): string[] {
  return useMemo(() => {
    const openDays: string[] = [];
    plan.forEach((day, i) => {
      if (!day.meals.some((m) => m.isPlaceholder)) return;
      const d = weekDates[i];
      openDays.push(d ? (WEEKDAY_LONG[d.getDay()] ?? "A day") : "A day");
    });
    return openDays;
  }, [plan, weekDates]);
}
