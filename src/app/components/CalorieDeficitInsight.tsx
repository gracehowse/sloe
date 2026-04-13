"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import type { LoggedMeal } from "../../types/recipe.ts";
import {
  rollingDeficitStats,
  todayFoodBalanceKcal,
} from "../../lib/nutrition/deficitProjection.ts";
import { dateKeyFromDate } from "../../lib/nutrition/trackerStats.ts";

type CalorieDeficitInsightProps = {
  nutritionByDay: Record<string, LoggedMeal[]>;
  selectedDateKey: string;
  caloriesEatenToday: number;
  /** Net goal for selected day (base + activity when enabled). */
  netCalorieGoal: number;
  baseCalorieGoal: number;
  preferActivityAdjusted: boolean;
  activityBurnKcal: number;
};

export function CalorieDeficitInsight({
  nutritionByDay,
  selectedDateKey,
  caloriesEatenToday,
  netCalorieGoal,
  baseCalorieGoal,
  preferActivityAdjusted,
  activityBurnKcal,
}: CalorieDeficitInsightProps) {
  const todayBalance = useMemo(
    () => todayFoodBalanceKcal(caloriesEatenToday, netCalorieGoal),
    [caloriesEatenToday, netCalorieGoal],
  );

  const rolling = useMemo(
    () => rollingDeficitStats(nutritionByDay, baseCalorieGoal, 7, new Date()),
    [nutritionByDay, baseCalorieGoal],
  );

  const isToday = selectedDateKey === dateKeyFromDate(new Date());

  const headline = useMemo(() => {
    if (todayBalance > 0) {
      return `About ${todayBalance} kcal under your food budget today`;
    }
    if (todayBalance < 0) {
      return `About ${Math.abs(todayBalance)} kcal over your food budget today`;
    }
    return "Right on your calorie budget for food so far today";
  }, [todayBalance]);

  return (
    <section
      className="rounded-2xl border border-violet-200/60 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20 px-4 py-4 mb-6"
      aria-label="Calorie budget insight"
    >
      <div className="flex gap-2 mb-2">
        <Info className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Budget &amp; deficit (estimated)</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Numbers are projections from what you&apos;ve logged — resting burn and activity can still change through the day.
          </p>
        </div>
      </div>

      {isToday ? (
        <p className="text-sm text-slate-800 dark:text-slate-200 font-medium mb-3">{headline}</p>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          Open today&apos;s date for live budget pacing; this day shows logged food vs that day&apos;s net goal in the summary above.
        </p>
      )}

      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500 dark:text-slate-400">Food logged</dt>
          <dd className="font-mono tabular-nums text-slate-900 dark:text-white">{caloriesEatenToday} kcal</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500 dark:text-slate-400">Net calorie goal</dt>
          <dd className="font-mono tabular-nums text-slate-900 dark:text-white">{netCalorieGoal} kcal</dd>
        </div>
        {preferActivityAdjusted && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">Activity adjustment</dt>
            <dd className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
              +{activityBurnKcal} kcal (on top of {baseCalorieGoal} base)
            </dd>
          </div>
        )}
      </dl>

      {rolling.loggedDayCount > 0 && rolling.avgDailyDeficitKcal != null && (
        <div className="mt-4 pt-3 border-t border-violet-200/50 dark:border-violet-900/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Recent pace (last 7 days, logged days only)
          </p>
          <p className="text-sm text-slate-800 dark:text-slate-200">
            Averaging about{" "}
            <span className="font-semibold">
              {rolling.avgDailyDeficitKcal > 0
                ? `${rolling.avgDailyDeficitKcal} kcal under`
                : rolling.avgDailyDeficitKcal < 0
                  ? `${Math.abs(rolling.avgDailyDeficitKcal)} kcal over`
                  : "on target with"}
            </span>{" "}
            your base goal per logged day.
          </p>
          {rolling.projectedWeekDeficitKcal != null && rolling.projectedWeekDeficitKcal > 0 && rolling.fatKgEquivalentIfWeekHeld != null ? (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              If that pace held for a full week, that&apos;s roughly{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {rolling.projectedWeekDeficitKcal.toLocaleString()} kcal
              </span>{" "}
              cumulative vs base goal — on the order of{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                ~{rolling.fatKgEquivalentIfWeekHeld} kg
              </span>{" "}
              fat-equivalent (very rough; not medical advice).
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
