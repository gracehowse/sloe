import { useMemo } from "react";

import { planDayCalendarDate } from "@/lib/mealPlan/planCalendarAnchor";
import { planCalendarDateForIndex } from "@/lib/planning/planDayLabel";
import type { DayPlan } from "@/types/recipe";

/**
 * ENG-1020 (2026-06-13): the week-date lives on the summary card as a
 * "{start} – {end} · Meal plan" eyebrow, mirroring mobile
 * `apps/mobile/app/(tabs)/planner.tsx` `summaryOverline`. Falls back to
 * "This week" when the date math can't resolve (defensive — mirrors mobile).
 *
 * ENG-1491 (mirrors mobile's ENG-1480 `usePlanV3WeekAnchor`): a plan with
 * real meals is labelled by its PERSISTED `start_date` anchor — never the
 * `startOffset` chip, which is UI state that resets to 0 on load (the
 * ENG-1132 hazard) and mislabelled real saved plans as rolling-from-today.
 * An empty plan keeps the prospective chip-driven week.
 */
export function usePlanWeekEyebrow(args: {
  mealPlan: DayPlan[] | null;
  mealPlanStartDate: string | null;
  planHasRealMeals: boolean;
  startOffset: number;
}): string {
  const { mealPlan, mealPlanStartDate, planHasRealMeals, startOffset } = args;
  return useMemo(() => {
    try {
      const planLen = mealPlan?.length ?? 0;
      const anchored = planHasRealMeals && !!mealPlanStartDate;
      const dateForDayIdx = (idx: number) => {
        if (anchored) {
          return planDayCalendarDate({
            planDayNumber: mealPlan?.[idx]?.day ?? idx + 1,
            startDate: mealPlanStartDate,
          });
        }
        // Prospective (empty plan) / legacy-anchorless path — F2-D chip +
        // the persisted `mealPlan[0].day` offset for pre-picker plans.
        const d = planCalendarDateForIndex(idx, startOffset);
        if (planLen > 0 && typeof mealPlan?.[0]?.day === "number") {
          d.setDate(d.getDate() + (mealPlan[0]!.day - 1));
        }
        return d;
      };
      const first = dateForDayIdx(0);
      const last = dateForDayIdx(Math.max(planLen - 1, 0));
      const fmt = (d: Date) =>
        d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (first.getMonth() === last.getMonth()) {
        return `${fmt(first)} – ${last.getDate()} · Meal plan`;
      }
      return `${fmt(first)} – ${fmt(last)} · Meal plan`;
    } catch {
      return "This week";
    }
  }, [mealPlan, mealPlanStartDate, planHasRealMeals, startOffset]);
}
