"use client";

import * as React from "react";
import { Flame } from "lucide-react";
import { cn } from "../ui/utils";

/**
 * Desktop right rail — context column shown on the Today screen at
 * `lg` and up. Holds the user's **trajectory** (streak, this-week
 * adherence, last-7-day breakdown) so the main column can keep its
 * focus on today's calorie state. Intentionally does NOT repeat the
 * hero's calorie ring or macro tiles — that duplication was flagged
 * as competing focal points (Grace, 2026-05-21 visual sweep). The
 * rail's job is "where am I heading", not "where am I now".
 */

export interface TodayDesktopRightRailProps {
  /** Effective calorie target — used to colour week bars + daily
   *  breakdown progress. */
  targetKcal: number;
  weekDailyKcal: number[];
  weekDayLabels: string[];
  weekLoggedDays: number;
  weekAvgKcal: number | null;
  streakDays: number;
  activeDateKey: string;
  todayDateKey: string;
  byDay: Record<string, ReadonlyArray<{ calories: number }>>;
  onSelectDayKey: (dateKey: string) => void;
  className?: string;
}

function lastSevenDateKeys(endKey: string): string[] {
  const [y, m, d] = endKey.split("-").map(Number);
  if (!y || !m || !d) return [];
  const end = new Date(y, m - 1, d);
  const out: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const dt = new Date(end);
    dt.setDate(end.getDate() - i);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    out.push(`${yy}-${mm}-${dd}`);
  }
  return out;
}

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatShortDay(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return "";
  return SHORT_DAY[new Date(y, m - 1, d).getDay()] ?? "";
}

export function TodayDesktopRightRail({
  targetKcal,
  weekDailyKcal,
  weekDayLabels,
  weekLoggedDays,
  weekAvgKcal,
  streakDays,
  activeDateKey,
  todayDateKey,
  byDay,
  onSelectDayKey,
  className,
}: TodayDesktopRightRailProps) {
  const dateKeys = lastSevenDateKeys(todayDateKey);

  const sparkMax = Math.max(targetKcal * 1.2, ...weekDailyKcal, 1);

  // Streak ladder labels — "On a roll" reads warmer than "current
  // streak" once a user is past day 2; collapses to a calmer "Build
  // your streak" copy when there's no streak yet so the empty state
  // doesn't feel punitive.
  const streakHeadline =
    streakDays === 0
      ? "Build your streak"
      : streakDays === 1
        ? "Day 1 — nice start"
        : `${streakDays}-day streak`;
  const streakSubline =
    streakDays === 0
      ? "Log any meal today to begin."
      : streakDays < 7
        ? "Keep it going — one log a day."
        : streakDays < 30
          ? "You're locked in. Keep showing up."
          : "Habit territory. Quietly impressive.";

  return (
    <aside
      className={cn("w-[300px] shrink-0 space-y-4", className)}
      aria-label="Today dashboard sidebar"
    >
      {/* Streak card — the warm anchor of the rail. Card-elevated-hero
          carries a softer drop so it reads as the primary surface of
          the rail (over the two cards below it).
          One-treatment elevation (Grace 2026-06-09): page-ground card →
          soft lift (`card-slab`). Was flat slab. */}
      <div className="rounded-card bg-card card-slab p-5">
        <div className="flex items-center gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
            style={{
              background:
                streakDays > 0
                  ? "color-mix(in srgb, var(--success) 14%, transparent)"
                  : "var(--muted)",
            }}
          >
            <Flame
              className="h-5 w-5"
              style={{
                color: streakDays > 0 ? "var(--success)" : "var(--muted-foreground)",
              }}
              aria-hidden
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-foreground leading-tight">
              {streakHeadline}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {streakSubline}
            </p>
          </div>
        </div>
      </div>

      {/* Week at a glance card.
          One-treatment elevation (Grace 2026-06-09): page-ground card →
          soft lift (`card-slab`). Was flat slab. */}
      <div className="rounded-card bg-card card-slab p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            This week
          </h2>
          {weekAvgKcal != null && (
            <span className="text-[11px] font-semibold text-foreground tabular-nums">
              {Math.round(weekAvgKcal).toLocaleString()} avg
            </span>
          )}
        </div>

        {/* Sparkline bars */}
        <div
          className="flex items-end gap-2 mb-2"
          style={{ height: 64 }}
          role="img"
          aria-label="Weekly calorie sparkline"
        >
          {weekDailyKcal.slice(0, 7).map((v, i) => {
            const barH = Math.max(3, Math.round((v / sparkMax) * 64));
            const hasData = v > 0;
            const isOverDay = targetKcal > 0 && v > targetKcal;
            return (
              <div
                key={i}
                className="flex-1 rounded-md transition-all duration-300"
                style={{
                  height: barH,
                  background: !hasData
                    ? "var(--muted)"
                    : isOverDay
                      ? "var(--over-budget-fg)"
                      : "var(--success)",
                  opacity: hasData ? 1 : 0.35,
                }}
              />
            );
          })}
        </div>
        <div className="flex gap-2">
          {weekDayLabels.slice(0, 7).map((label, i) => (
            <span
              key={i}
              className="flex-1 text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {label.charAt(0)}
            </span>
          ))}
        </div>

        <p className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
          {weekLoggedDays === 0
            ? "Start logging to see your week."
            : `${weekLoggedDays}/7 days logged`}
        </p>
      </div>

      {/* Last 7 days detail.
          One-treatment elevation (Grace 2026-06-09): page-ground card →
          soft lift (`card-slab`). Was flat slab. */}
      <div className="rounded-card bg-card card-slab p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2.5 px-1">
          Daily breakdown
        </h2>
        <ol className="space-y-0.5" role="list">
          {dateKeys.map((key) => {
            const meals = byDay[key] ?? [];
            const calories = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
            const pct = targetKcal > 0 ? Math.min(calories / targetKcal, 1) : 0;
            const isActive = key === activeDateKey;
            const isToday = key === todayDateKey;
            const dayIsOver = targetKcal > 0 && calories > targetKcal;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onSelectDayKey(key)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    isActive ? "bg-primary/[0.08]" : "hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "w-8 shrink-0 text-[11px] font-semibold tabular-nums",
                      isActive ? "text-primary" : "text-foreground",
                    )}
                  >
                    {formatShortDay(key)}
                  </span>

                  {isToday && !isActive && (
                    <span className="shrink-0 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider">
                      Today
                    </span>
                  )}

                  <div className="relative h-1.5 flex-1 min-w-0 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{
                        width: `${pct * 100}%`,
                        background: dayIsOver
                          ? "var(--over-budget-fg)"
                          : "var(--success)",
                      }}
                    />
                  </div>

                  <span
                    className={cn(
                      "w-10 shrink-0 text-right text-[10px] font-medium tabular-nums",
                      calories === 0 ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {calories === 0 ? "—" : Math.round(calories)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}
