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
 * holds no state apart from the optional scrubber tooltip and fires
 * no side effects beyond `onSelectDayKey`, which tells the parent to
 * jump to a day and flip back to day mode.
 *
 * 2026-05-01 (ui-critic finding #5, P1) — chart upgraded from
 * unstyled bars to MacroFactor-tier:
 *   - bars carry top-only rounded corners so they read as
 *     bars-from-the-baseline rather than floating pills.
 *   - a horizontal dashed target rule sits at the calorie-target
 *     y-position so over/under is readable at a glance.
 *   - bars animate in via CSS height transition on mount /
 *     mode-change.
 *   - clicking a bar reveals a floating tooltip with day name,
 *     kcal logged, kcal target, delta. Click elsewhere or the same
 *     bar again dismisses.
 *   - above the chart: "7-day avg: X kcal · closest to target: [day]".
 *   - mobile parity: `apps/mobile/components/today/TodayWeekView.tsx`.
 */

const PLOT_HEIGHT_PX = 110;

function targetRulePctFromBottom(target: number, maxCal: number): number | null {
  if (!Number.isFinite(target) || target <= 0) return null;
  if (!Number.isFinite(maxCal) || maxCal <= 0) return null;
  if (target > maxCal) return null;
  return (target / maxCal) * 100;
}

function closestToTargetIndexWeb(
  days: TodayWeekDay[],
  dayGoals: number[],
  fallbackTarget: number,
): number | null {
  let bestIdx: number | null = null;
  let bestDelta = Infinity;
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (!day || day.totals.calories <= 0) continue;
    const goal = dayGoals[i] ?? fallbackTarget;
    if (!Number.isFinite(goal) || goal <= 0) continue;
    const delta = Math.abs(day.totals.calories - goal);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIdx = i;
    }
  }
  return bestIdx;
}

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

  // 2026-05-01 (ui-critic #5) — scrubber state + closest-to-target.
  const [scrubIndex, setScrubIndex] = React.useState<number | null>(null);
  const bestIdx = React.useMemo(
    () => closestToTargetIndexWeb(days, dayGoals, calorieTarget),
    [days, dayGoals, calorieTarget],
  );
  const bestDayLabel = bestIdx != null ? days[bestIdx]?.short ?? null : null;
  const targetRulePct = React.useMemo(
    () => targetRulePctFromBottom(calorieTarget, maxCal),
    [calorieTarget, maxCal],
  );

  return (
    <div className="flex flex-col gap-4 mb-4">
      <div className="rounded-card bg-card border border-border p-4">
        <p className="text-sm font-semibold text-foreground mb-1">Weekly calories</p>
        {/* Above-chart summary — only when at least one day was logged. */}
        {loggedDaysInWeek > 0 && (
          <p
            data-testid="today-week-chart-summary"
            className="mb-3 text-[11px] text-muted-foreground"
          >
            {`7-day avg: ${Math.round(weekAvg.calories)} kcal`}
            {bestDayLabel ? ` · closest to target: ${bestDayLabel}` : ""}
          </p>
        )}
        <div
          data-testid="today-week-chart"
          className="relative flex justify-between items-end gap-1"
          style={{ height: `${PLOT_HEIGHT_PX + 18 + 14}px` }}
        >
          {days.map((day, i) => {
            const dayGoal = dayGoals[i] ?? calorieTarget;
            const barH = maxCal > 0 ? Math.max(4, (day.totals.calories / maxCal) * PLOT_HEIGHT_PX) : 4;
            const over = day.totals.calories > dayGoal;
            const isCurrentDay = day.key === todayKey();
            const isScrubbed = scrubIndex === i;
            return (
              <button
                key={day.key}
                type="button"
                data-testid={`today-week-chart-bar-${i}`}
                onClick={() =>
                  setScrubIndex((prev) => (prev === i ? null : i))
                }
                onDoubleClick={() => onSelectDayKey(day.key)}
                aria-label={`${day.short} — ${Math.round(day.totals.calories)} kcal of ${Math.round(dayGoal)} kcal target`}
                className="relative z-10 flex flex-col items-center flex-1 gap-1 min-w-0"
              >
                <span className="text-[10px] text-muted-foreground tabular-nums h-4">
                  {day.totals.calories > 0 ? Math.round(day.totals.calories) : ""}
                </span>
                <div
                  className="w-full max-w-[28px] mx-auto transition-[height,width,background-color] duration-500 ease-out"
                  style={{
                    height: barH,
                    width: isScrubbed ? 32 : undefined,
                    borderTopLeftRadius: 6,
                    borderTopRightRadius: 6,
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    backgroundColor: isScrubbed
                      ? "var(--primary)"
                      : over
                        ? "var(--warning)"
                        : day.totals.calories > 0
                          ? "var(--primary)"
                          : "var(--muted)",
                  }}
                />
                <span
                  className={`text-[11px] font-semibold ${isCurrentDay || isScrubbed ? "text-primary" : "text-muted-foreground"}`}
                >
                  {day.short}
                </span>
              </button>
            );
          })}
          {/* Target rule — dashed horizontal line at the day-target
              y-position. `bottom: 18px` matches the day-label row;
              the line then translates up by `targetRulePct` of the
              plot height. */}
          {targetRulePct != null && (
            <div
              data-testid="today-week-chart-target-rule"
              aria-hidden="true"
              className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-primary/40"
              style={{
                bottom: `calc(18px + ${(targetRulePct / 100) * PLOT_HEIGHT_PX}px)`,
              }}
            />
          )}
          {/* Floating scrubber tooltip — surfaces day details. */}
          {scrubIndex != null && days[scrubIndex] && (() => {
            const day = days[scrubIndex]!;
            const goal = dayGoals[scrubIndex] ?? calorieTarget;
            const delta = Math.round(day.totals.calories - goal);
            const deltaLabel =
              delta === 0
                ? "On target"
                : delta > 0
                  ? `${delta} kcal over`
                  : `${Math.abs(delta)} kcal under`;
            const colCenterPct = ((scrubIndex + 0.5) / days.length) * 100;
            const isLeftHalf = colCenterPct < 50;
            return (
              <div
                data-testid="today-week-chart-tooltip-backdrop"
                role="button"
                aria-label="Dismiss day details"
                tabIndex={0}
                onClick={() => setScrubIndex(null)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setScrubIndex(null);
                }}
                className="absolute inset-0 z-20"
              >
                <div
                  data-testid="today-week-chart-tooltip"
                  role="status"
                  aria-label={`${day.short} — ${Math.round(day.totals.calories)} kcal of ${Math.round(goal)} kcal target — ${deltaLabel}`}
                  className={`absolute top-0 ${isLeftHalf ? "left-0" : "right-0"} rounded-md border border-border bg-card px-3 py-2 shadow-sm`}
                  style={{ minWidth: 140 }}
                >
                  <p className="text-[12px] font-bold text-foreground">{day.short}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {Math.round(day.totals.calories)} / {Math.round(goal)} kcal
                  </p>
                  <p
                    className={`text-[11px] font-bold ${
                      delta === 0
                        ? "text-success"
                        : delta > 0
                          ? "text-warning"
                          : "text-success"
                    }`}
                  >
                    {deltaLabel}
                  </p>
                </div>
              </div>
            );
          })()}
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
            {/* User-sentiment audit (round 4, 2026-04-30): replaced the
                punitive over/under-target labels with the canonical
                "Net deficit"/"Net surplus" phrasing from
                `src/lib/copy/today.ts`. UCL Oct 2025 study + r/loseit
                data show that judgmental framing drives logging
                avoidance; "deficit"/"surplus" reads as observation,
                not judgment. Colour also softened — green stays for
                under-target, but the over-target tone moves from red
                (`text-destructive`) to amber (`text-warning`) per
                project memory + spec §1.4. Red is reserved for truly
                destructive actions; tracking copy never punishes. */}
            <p className={`text-2xl font-extrabold tabular-nums ${under ? "text-success" : "text-warning"}`}>
              {diff}
            </p>
            <p className="text-[11px] text-muted-foreground">{under ? "Net deficit" : "Net surplus"}</p>
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
