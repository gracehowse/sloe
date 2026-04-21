"use client";

import * as React from "react";
import { todayKey } from "../../../lib/nutrition/trackerDate";

/**
 * TodayWeekView — week-mode view of the Today screen.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18).
 *
 * Rendered when `viewMode === "week"`. All data is derived in the
 * composition root (`NutritionTracker`) and passed in — the component
 * holds no state and fires no side effects beyond `onSelectDayKey`,
 * which tells the parent to jump to a day and flip back to day mode.
 */

export interface TodayWeekDay {
  key: string;
  short: string;
  date: Date;
  totals: { calories: number; protein: number; carbs: number; fat: number };
  waterMl: number;
  steps: number | null;
}

export interface TodayWeekTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface TodayWeekViewProps {
  days: TodayWeekDay[];
  weekTotals: TodayWeekTotals;
  weekAvg: TodayWeekTotals;
  loggedDaysInWeek: number;
  weekEffectiveCalorieBudget: number;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  waterMlTarget: number;
  dailyStepsGoal: number;
  preferActivityAdjustedCalories: boolean;
  maintenanceForWeek: number;
  /** `targets.calories + day activity budget add-on` for each day index. */
  dayGoals: number[];
  onSelectDayKey: (key: string) => void;
}

function MacroBarRowWeb({
  label,
  current,
  goal,
  colorVar,
}: {
  label: string;
  current: number;
  goal: number;
  colorVar: string;
}) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-16 text-[10px] font-bold tracking-wide text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colorVar }} />
      </div>
      <span className="w-14 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
        {Math.round(current)} / {goal}
      </span>
    </div>
  );
}

export function TodayWeekView({
  days,
  weekTotals,
  weekAvg,
  loggedDaysInWeek,
  weekEffectiveCalorieBudget,
  calorieTarget,
  proteinTarget,
  carbsTarget,
  fatTarget,
  waterMlTarget,
  dailyStepsGoal,
  preferActivityAdjustedCalories,
  maintenanceForWeek,
  dayGoals,
  onSelectDayKey,
}: TodayWeekViewProps) {
  const maxCal = Math.max(
    1,
    ...days.map((d, i) => Math.max(d.totals.calories, dayGoals[i] ?? calorieTarget)),
  );
  const under = weekEffectiveCalorieBudget > weekTotals.calories;
  const diff = Math.round(Math.abs(weekEffectiveCalorieBudget - weekTotals.calories));

  return (
    <div className="flex flex-col gap-4 mb-4">
      <div className="rounded-card bg-card border border-border p-4">
        <p className="text-sm font-semibold text-foreground mb-3">Weekly calories</p>
        <div className="flex justify-between items-end gap-1 h-36">
          {days.map((day, i) => {
            const dayGoal = dayGoals[i] ?? calorieTarget;
            const barH = maxCal > 0 ? Math.max(4, (day.totals.calories / maxCal) * 110) : 4;
            const over = day.totals.calories > dayGoal;
            const isCurrentDay = day.key === todayKey();
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => onSelectDayKey(day.key)}
                className="flex flex-col items-center flex-1 gap-1 min-w-0"
              >
                <span className="text-[10px] text-muted-foreground tabular-nums h-4">
                  {day.totals.calories > 0 ? Math.round(day.totals.calories) : ""}
                </span>
                <div
                  className="w-full max-w-[28px] rounded-md transition-colors mx-auto"
                  style={{
                    height: barH,
                    backgroundColor: over ? "var(--warning)" : day.totals.calories > 0 ? "var(--primary)" : "var(--muted)",
                  }}
                />
                <span
                  className={`text-[11px] font-semibold ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}
                >
                  {day.short}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground text-right mt-1">
          {preferActivityAdjustedCalories
            ? `Goal: ${calorieTarget} kcal base + activity bonus when over maintenance (~${maintenanceForWeek} kcal)`
            : `Daily goal: ${calorieTarget} kcal`}
        </p>
      </div>

      <div className="rounded-card bg-card border border-border p-4">
        <p className="text-sm font-semibold text-foreground mb-2">Steps & water</p>
        <p className="text-[10px] text-muted-foreground mb-3">Each column: steps vs goal (top), water vs goal (bottom). Tap a day to open it.</p>
        <div className="flex gap-1 items-end">
          {days.map((day) => {
            const stepPct =
              day.steps != null && dailyStepsGoal > 0 ? Math.min(100, (day.steps / dailyStepsGoal) * 100) : 0;
            const waterPct =
              waterMlTarget > 0 ? Math.min(100, (day.waterMl / waterMlTarget) * 100) : 0;
            const isCurrentDay = day.key === todayKey();
            return (
              <button
                key={`sw-${day.key}`}
                type="button"
                onClick={() => onSelectDayKey(day.key)}
                className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
              >
                <div className="w-full max-w-[28px] flex flex-col justify-end gap-1 h-[52px] mx-auto">
                  <div className="relative h-[22px] w-full rounded bg-muted overflow-hidden">
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded transition-all"
                      style={{
                        height: `${stepPct}%`,
                        minHeight: day.steps != null && day.steps > 0 ? 3 : 0,
                        backgroundColor:
                          day.steps != null && day.steps >= dailyStepsGoal ? "var(--success)" : "var(--primary)",
                      }}
                    />
                  </div>
                  <div className="relative h-[22px] w-full rounded bg-muted overflow-hidden">
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded bg-macro-water transition-all"
                      style={{
                        height: `${waterPct}%`,
                        minHeight: day.waterMl > 0 ? 3 : 0,
                      }}
                    />
                  </div>
                </div>
                <span
                  className={`text-[10px] font-semibold ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}
                >
                  {day.short}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-card bg-card border border-border p-4">
        <p className="text-sm font-semibold text-foreground mb-3">Weekly summary</p>
        <div className="flex justify-around text-center">
          <div>
            <p className="text-2xl font-extrabold text-foreground tabular-nums">
              {Math.round(weekTotals.calories)}
            </p>
            <p className="text-[11px] text-muted-foreground">Total kcal</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-primary tabular-nums">
              {Math.round(weekAvg.calories)}
            </p>
            <p className="text-[11px] text-muted-foreground">Daily avg</p>
          </div>
          <div>
            <p className={`text-2xl font-extrabold tabular-nums ${under ? "text-success" : "text-destructive"}`}>
              {diff}
            </p>
            <p className="text-[11px] text-muted-foreground">{under ? "Under budget" : "Over budget"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-card bg-card border border-border p-4">
        <p className="text-sm font-semibold text-foreground mb-1">Daily averages</p>
        <p className="text-[11px] text-muted-foreground mb-3">
          Based on {loggedDaysInWeek} day{loggedDaysInWeek !== 1 ? "s" : ""} with logged food
        </p>
        <MacroBarRowWeb label="PROTEIN" current={weekAvg.protein} goal={proteinTarget} colorVar="var(--macro-protein)" />
        <MacroBarRowWeb label="CARBS" current={weekAvg.carbs} goal={carbsTarget} colorVar="var(--macro-carbs)" />
        <MacroBarRowWeb label="FATS" current={weekAvg.fat} goal={fatTarget} colorVar="var(--macro-fat)" />
      </div>

      <div className="rounded-card bg-card border border-border p-4">
        <p className="text-sm font-semibold text-foreground mb-2">Macro breakdown</p>
        <div className="flex flex-col gap-2 mt-2">
          {days.map((day) => (
            <button
              key={day.key}
              type="button"
              onClick={() => onSelectDayKey(day.key)}
              className="flex items-center gap-2 w-full text-left"
            >
              <span className="w-8 text-[11px] font-semibold text-muted-foreground">{day.short}</span>
              <div className="flex-1 flex h-3.5 rounded overflow-hidden bg-muted">
                {day.totals.calories > 0 && (() => {
                  const total = day.totals.protein + day.totals.carbs + day.totals.fat || 1;
                  return (
                    <>
                      <div style={{ width: `${(day.totals.protein / total) * 100}%`, background: "var(--macro-protein)" }} />
                      <div style={{ width: `${(day.totals.carbs / total) * 100}%`, background: "var(--macro-carbs)" }} />
                      <div style={{ width: `${(day.totals.fat / total) * 100}%`, background: "var(--macro-fat)" }} />
                    </>
                  );
                })()}
              </div>
              <span className="w-11 text-right text-[11px] text-muted-foreground tabular-nums">
                {day.totals.calories > 0 ? Math.round(day.totals.calories) : "—"}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--macro-protein)]" /> Protein
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--macro-carbs)]" /> Carbs
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--macro-fat)]" /> Fat
          </span>
        </div>
      </div>
    </div>
  );
}
