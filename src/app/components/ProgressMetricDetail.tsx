"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icons } from "./ui/icons";
import { useAppData } from "../../context/AppDataContext.tsx";
import { normalizeMacroTargets } from "../../types/profile.ts";
import { computeLoggingStreak } from "../../lib/nutrition/trackerStats.ts";
import { buildWeekStats, getStreakContributingDays } from "../../lib/nutrition/progressWeekReport.ts";
import { todayKey } from "../../lib/nutrition/trackerDate.ts";

export type ProgressMetric = "calories" | "protein" | "streak";

function formatLongDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

type Props = {
  metric: ProgressMetric;
  weekStartDay: "monday" | "sunday";
  onClose: () => void;
};

export function ProgressMetricDetail({ metric, weekStartDay, onClose }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { nutritionByDay, setSelectedDateKey, nutritionTargets } = useAppData();
  const targets = normalizeMacroTargets(nutritionTargets);
  const todayDk = todayKey();

  const weekStats = useMemo(
    () => buildWeekStats(nutritionByDay, targets, weekStartDay),
    [nutritionByDay, targets, weekStartDay],
  );
  const streakDays = useMemo(() => computeLoggingStreak(nutritionByDay), [nutritionByDay]);
  const streakDaysDetail = useMemo(() => getStreakContributingDays(nutritionByDay), [nutritionByDay]);

  const title =
    metric === "calories" ? "Calories this week" : metric === "protein" ? "Protein consistency" : "Logging streak";

  const subtitle =
    metric === "calories"
      ? `Average across days you logged food: ${weekStats.avgCalories.toLocaleString()} kcal vs ${targets.calories.toLocaleString()} kcal target.`
      : metric === "protein"
        ? `A day counts as “on target” when protein is at least 90% of your ${Math.round(targets.protein)}g goal.`
        : "Consecutive days (ending today or yesterday) where you logged at least one meal.";

  const openDay = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", "today");
    p.delete("metric");
    router.replace(p.toString() ? `/?${p.toString()}` : "/?view=today", { scroll: false });
  };

  return (
    <div className="max-w-2xl mx-auto px-pm-5 py-pm-5">
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-lg border border-border bg-card flex items-center justify-center text-foreground hover:bg-muted"
          aria-label="Back"
        >
          <Icons.back className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-extrabold text-primary tracking-wide uppercase truncate">{title}</h1>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">{subtitle}</p>

      {metric === "calories" && (
        <>
          <div className="rounded-xl bg-card border border-border p-4 mb-4">
            <p className="text-sm font-semibold text-foreground mb-3">Daily intake</p>
            <div className="flex items-end gap-2 h-32">
              {weekStats.days.map((d) => {
                const maxCal = Math.max(targets.calories, ...weekStats.days.map((x) => x.calories), 1);
                const barH = maxCal > 0 ? Math.max(6, (d.calories / (maxCal * 1.15)) * 96) : 6;
                const over = d.calories > targets.calories;
                const isToday = d.key === todayDk;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => openDay(d.key)}
                    className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
                  >
                    <span className="text-[10px] text-muted-foreground tabular-nums h-4">
                      {d.calories > 0 ? (d.calories >= 1000 ? `${(d.calories / 1000).toFixed(1)}k` : String(d.calories)) : "—"}
                    </span>
                    <div
                      className="w-full rounded-md transition-opacity"
                      style={{
                        height: barH,
                        backgroundColor: d.calories === 0 ? "var(--muted)" : over ? "var(--warning)" : "var(--success)",
                        opacity: isToday ? 1 : 0.85,
                      }}
                    />
                    <span className={`text-[11px] font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>{d.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">Tap a day to open it on Today.</p>
          </div>

          {weekStats.days.map((d) => (
            <button
              key={`row-${d.key}`}
              type="button"
              onClick={() => openDay(d.key)}
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 mb-2 text-left hover:bg-muted/40 transition-colors"
            >
              <div>
                <p className="text-sm font-bold text-foreground">{formatLongDate(d.key)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{d.label}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-base font-extrabold text-foreground tabular-nums">{d.calories.toLocaleString()} kcal</p>
                  <p className="text-[11px] text-muted-foreground">
                    {d.calories > 0 ? `${Math.round((d.calories / targets.calories) * 100)}% of goal` : "No meals"}
                  </p>
                </div>
                <Icons.forward className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </>
      )}

      {metric === "protein" && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground font-semibold">Avg / day</p>
              <p className="text-2xl font-extrabold text-[var(--macro-protein)] tabular-nums mt-1">{weekStats.avgProtein}g</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground font-semibold">On target</p>
              <p className="text-2xl font-extrabold text-primary tabular-nums mt-1">{weekStats.proteinOnTarget}/7</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Weekly protein adherence vs goal: {weekStats.proteinAdherence}%. Carbs {weekStats.carbsAdherence}% · Fat {weekStats.fatAdherence}%
          </p>

          {weekStats.days.map((d) => {
            const hit = d.protein >= targets.protein * 0.9;
            const pct = targets.protein > 0 ? Math.round((d.protein / targets.protein) * 100) : 0;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => openDay(d.key)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 mb-2 text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{formatLongDate(d.key)}</p>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: hit ? "var(--success)" : "var(--warning)" }} />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-[15px] font-extrabold text-[var(--macro-protein)] tabular-nums">{Math.round(d.protein)}g</p>
                    <p className="text-[11px] text-muted-foreground">{hit ? "On target" : `${pct}% of goal`}</p>
                  </div>
                  <Icons.forward className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </>
      )}

      {metric === "streak" && (
        <>
          <div className="rounded-xl border border-border bg-card p-5 mb-4">
            <p className="text-4xl font-black text-primary tabular-nums">{streakDays}</p>
            <p className="text-sm font-semibold text-foreground mt-1">
              consecutive logging day{streakDays !== 1 ? "s" : ""}
            </p>
          </div>

          {streakDaysDetail.length === 0 ? (
            <p className="text-sm text-muted-foreground">Log a meal on Today to start a streak.</p>
          ) : (
            <>
              <p className="text-sm font-bold text-foreground mb-2">Days in this streak</p>
              {streakDaysDetail.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => openDay(row.key)}
                  className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 mb-2 text-left hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold text-foreground">{formatLongDate(row.key)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {row.mealCount} meal{row.mealCount !== 1 ? "s" : ""} · {row.calories.toLocaleString()} kcal
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Icons.check className="w-5 h-5 text-success" />
                    <Icons.forward className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
