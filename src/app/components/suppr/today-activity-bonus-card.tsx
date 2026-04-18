"use client";

import * as React from "react";
import { Icons } from "../ui/icons";
import { kgToLb } from "../../../lib/nutrition/tdee";
import { weekSummaryHeading } from "../../../lib/nutrition/weekSummaryWindow";
import type { WeekSummaryMode } from "../../../lib/nutrition/weekSummaryWindow";

/**
 * TodayActivityBonusCard — summary + per-workout + weekly deficit.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). All
 * data is passed in by the host; this is pure rendering plus the
 * weekly rollup which reads the same shape as before.
 */
export interface TodayWorkout {
  type: string;
  minutes: number;
  calories: number;
  source: string;
}

export interface TodayActivityBonusCardProps {
  hasBurnData: boolean;
  totalBurnKcal: number;
  effectiveCalorieTarget: number;
  consumedCalories: number;
  basalBurnKcal: number;
  activityBurnForSelectedDay: number;
  workouts: TodayWorkout[];
  weekSummaryMode: WeekSummaryMode;
  weekSummaryKeys: string[];
  activityBurnByDay: Record<string, number>;
  basalBurnByDay: Record<string, number>;
  nutritionByDay: Record<string, Array<{ calories?: number }>>;
  selectedDateKey: string;
  profileMeasurementSystem: "metric" | "imperial";
}

export function TodayActivityBonusCard({
  hasBurnData,
  totalBurnKcal,
  effectiveCalorieTarget,
  consumedCalories,
  basalBurnKcal,
  activityBurnForSelectedDay,
  workouts,
  weekSummaryMode,
  weekSummaryKeys,
  activityBurnByDay,
  basalBurnByDay,
  nutritionByDay,
  selectedDateKey,
  profileMeasurementSystem,
}: TodayActivityBonusCardProps) {
  if (!hasBurnData) return null;

  const deficit = totalBurnKcal - consumedCalories;
  const isDeficit = deficit >= 0;

  let weekBurn = 0;
  let weekConsumed = 0;
  for (const dk of weekSummaryKeys) {
    const activeKcal =
      activityBurnByDay[dk] ?? (dk === selectedDateKey ? activityBurnForSelectedDay : 0);
    weekBurn += activeKcal + (basalBurnByDay[dk] ?? 0);
    const dayMeals = nutritionByDay[dk] ?? [];
    weekConsumed += dayMeals.reduce((s, m) => s + Math.max(0, m.calories ?? 0), 0);
  }
  const showWeekly = weekBurn > 0;
  const weekDeficit = weekBurn - weekConsumed;
  const dailyAvgDeficit = Math.round(weekDeficit / 7);
  const weeklyKgRate = (Math.abs(weekDeficit) / 3500) * 0.4536;
  const weeklyMassLabel =
    profileMeasurementSystem === "imperial"
      ? `${(Math.round(kgToLb(weeklyKgRate) * 10) / 10).toFixed(1)} lb`
      : `${weeklyKgRate.toFixed(2)} kg`;
  const isWeekDeficit = weekDeficit >= 0;

  return (
    <div className="rounded-card border border-border bg-card p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Icons.calories className="h-5 w-5 text-warning" />
        <h3 className="text-sm font-bold text-foreground">Activity Bonus</h3>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div>
          <p className="text-lg font-extrabold text-foreground tabular-nums">{totalBurnKcal.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Total burn</p>
        </div>
        <div className="border-x border-border">
          <p className="text-lg font-extrabold text-foreground tabular-nums">{effectiveCalorieTarget > 0 ? effectiveCalorieTarget.toLocaleString() : "—"}</p>
          <p className="text-[10px] text-muted-foreground">Target intake</p>
        </div>
        <div>
          <p className={`text-lg font-extrabold tabular-nums ${isDeficit ? "text-success" : "text-destructive"}`}>{Math.abs(deficit).toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">{isDeficit ? "Under" : "Over"}</p>
        </div>
      </div>

      {/* Burn breakdown */}
      <div className="space-y-1 mb-3 text-xs">
        {basalBurnKcal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resting energy</span>
            <span className="font-semibold text-foreground tabular-nums">{basalBurnKcal.toLocaleString()} kcal</span>
          </div>
        )}
        {activityBurnForSelectedDay > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Active energy</span>
            <span className="font-semibold text-foreground tabular-nums">{activityBurnForSelectedDay.toLocaleString()} kcal</span>
          </div>
        )}
      </div>

      {/* Workouts */}
      {workouts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Workouts</p>
          {workouts.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-0.5">
              <Icons.dumbbell className="h-4 w-4 text-primary" />
              <span className="flex-1 text-foreground">{w.type}</span>
              {w.minutes > 0 && <span className="text-muted-foreground tabular-nums">{w.minutes} min</span>}
              {w.calories > 0 && <span className="font-semibold text-warning tabular-nums">{w.calories} kcal</span>}
            </div>
          ))}
        </div>
      )}

      {/* Weekly deficit summary */}
      {showWeekly && (
        <div className="mt-3 pt-3 border-t border-border space-y-1 text-xs">
          <p className="font-semibold text-foreground mb-1.5">{weekSummaryHeading(weekSummaryMode)}</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg daily {isWeekDeficit ? "deficit" : "surplus"}</span>
            <span className={`font-semibold tabular-nums ${isWeekDeficit ? "text-success" : "text-destructive"}`}>{Math.abs(dailyAvgDeficit).toLocaleString()} kcal</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Weekly {isWeekDeficit ? "deficit" : "surplus"}</span>
            <span className={`font-semibold tabular-nums ${isWeekDeficit ? "text-success" : "text-destructive"}`}>{Math.abs(weekDeficit).toLocaleString()} kcal</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Projected weekly {isWeekDeficit ? "loss" : "gain"}</span>
            <span className={`font-semibold tabular-nums ${isWeekDeficit ? "text-success" : "text-destructive"}`}>{weeklyMassLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
