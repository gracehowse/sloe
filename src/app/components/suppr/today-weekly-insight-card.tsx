"use client";

import * as React from "react";
import { Icons } from "../ui/icons";

/**
 * TodayWeeklyInsightCard — compact right-rail summary on the desktop
 * Today view, ported from the 2026-04-20 Claude Design prototype.
 *
 * Scope: desktop-only (>= `lg:`) — the mobile Today screen has no
 * right-rail. This card is purely informational; every number is
 * derived from data the `AppDataContext` already has on the selected
 * week (logged days, totals, plan meal count). No fabrication, no
 * invented nutrition.
 *
 * States covered:
 *  - Loaded week with food logged on at least one day: show logged
 *    days count, weekly kcal averaged, and an 7-day sparkline of
 *    daily calories.
 *  - Empty / no logs this week: show the household-sized planning
 *    line only, with a muted placeholder sparkline.
 */

export interface TodayWeeklyInsightCardProps {
  /** Number of unique people this plan is cooking for (household
   *  member count + 1 for the user). 0 hides the planning line. */
  householdSize: number;
  /** Number of days in the selected week that have at least one meal
   *  logged. Range 0-7. */
  loggedDaysInWeek: number;
  /** Average daily kcal across the whole week. Null when the week has
   *  no logged day — we refuse to show "0 kcal" as a faux result. */
  weekAvgKcal: number | null;
  /** Daily calorie totals for the selected week, Monday → Sunday (or
   *  Sunday → Saturday depending on user pref). Length is always 7;
   *  0 is a valid "no log" marker. */
  weekDailyKcal: number[];
  /** Weekly kcal target (per-day target × 7). Drives the sparkline's
   *  y-axis scaling so the bars feel proportional to the user's goal,
   *  not to their highest day. */
  dailyKcalTarget: number;
  className?: string;
}

export function TodayWeeklyInsightCard({
  householdSize,
  loggedDaysInWeek,
  weekAvgKcal,
  weekDailyKcal,
  dailyKcalTarget,
  className,
}: TodayWeeklyInsightCardProps) {
  const bars = React.useMemo(() => {
    const safeMax = Math.max(
      dailyKcalTarget > 0 ? dailyKcalTarget * 1.2 : 0,
      ...weekDailyKcal,
      1,
    );
    return weekDailyKcal.slice(0, 7).map((v) => {
      const pct = Math.min(100, Math.max(0, (v / safeMax) * 100));
      return pct;
    });
  }, [weekDailyKcal, dailyKcalTarget]);

  return (
    <section
      aria-label="Weekly insight"
      className={`rounded-card bg-card card-slab-flat p-4 ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icons.sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Weekly insight
        </h2>
      </div>

      {householdSize > 0 ? (
        <p className="text-sm font-semibold text-foreground mb-2">
          {householdSize === 1
            ? "Planning for you this week"
            : `Planning for ${householdSize} this week`}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground mb-3">
        {loggedDaysInWeek === 0
          ? "Log a meal to start the week."
          : loggedDaysInWeek === 1
            ? "1 day logged so far."
            : `${loggedDaysInWeek} days logged so far.`}
        {weekAvgKcal != null ? (
          <>
            {" "}
            <span className="font-semibold text-foreground">
              {Math.round(weekAvgKcal).toLocaleString()} kcal
            </span>{" "}
            daily average.
          </>
        ) : null}
      </p>

      {/* Sparkline — 7 bars, one per day. Empty days render at ~4%
          height so the baseline is visible without looking like a
          fabricated zero-value. */}
      <div
        className="flex items-end gap-1 h-14"
        role="img"
        aria-label={
          loggedDaysInWeek === 0
            ? "No meals logged this week yet."
            : `${loggedDaysInWeek} days logged this week.`
        }
      >
        {bars.map((pct, i) => {
          const hasData = (weekDailyKcal[i] ?? 0) > 0;
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${Math.max(4, pct)}%`,
                background: hasData ? "var(--primary)" : "var(--muted)",
                opacity: hasData ? 1 : 0.6,
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
