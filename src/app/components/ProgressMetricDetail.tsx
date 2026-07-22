"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icons } from "./ui/icons";
import { useAppData } from "../../context/AppDataContext.tsx";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { useAuthSession } from "../../context/AuthSessionContext.tsx";
import { normalizeMacroTargets } from "../../types/profile.ts";
import { computeProtectedStreak, readFreezeLedger, type FreezeLedger } from "../../lib/nutrition/streakFreeze.ts";
import { buildWeekStats, getStreakContributingDays } from "../../lib/nutrition/progressWeekReport.ts";
import { todayKey } from "../../lib/nutrition/trackerDate.ts";
import { getDailyTargets, type DailyTarget } from "../../lib/nutrition/dailyTargetRead.ts";
import { useNutritionHistoryWindow } from "../../hooks/useNutritionHistoryWindow.ts";

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
  const { authedUserId } = useAuthSession();
  // ENG-1324 — streak detail looks past the 35-day boot window; widen the
  // shared journal to 90 days (mobile parity).
  useNutritionHistoryWindow();
  const targets = normalizeMacroTargets(nutritionTargets);
  const todayDk = todayKey();

  // Flat-card surfaces (2026-06-12, Withings grammar — decision:
  // docs/decisions/2026-06-12-flat-card-surfaces.md). This metric-detail card
  // was a straggler riding the raw `--elev-card-soft` token directly (bypassing
  // the `.card-slab` primitive the CORE flattened), so it kept the retired soft
  // lift. Flattened to match the primitive: borderless + FLAT (no shadow) —
  // separation comes from the card fill on the cream ground, mirroring the
  // mobile `useCardElevation` flat result. `design_system_elevation` collapsed
  // (ENG-1651) — this was permanently ON via REDESIGN_DEFAULT_ON.
  const cardCls = "border border-transparent";

  // F-2 (2026-04-19) — snapshot targets for this week so past-day
  // "% of goal" values don't shift when the user later edits their
  // activity_level / plan_pace / goal.
  const [dailyTargetsByDay, setDailyTargetsByDay] = useState<Record<string, DailyTarget | null>>({});
  useEffect(() => {
    if (!authedUserId) {
      setDailyTargetsByDay({});
      return;
    }
    const nowD = new Date();
    const dow = nowD.getDay();
    const startOffset = weekStartDay === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
    const weekFirst = new Date(nowD);
    weekFirst.setDate(nowD.getDate() + startOffset);
    const weekKeys: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekFirst);
      d.setDate(weekFirst.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      weekKeys.push(`${y}-${m}-${day}`);
    }
    let cancelled = false;
    void getDailyTargets(supabase, authedUserId, weekKeys).then((snapshots) => {
      if (!cancelled) setDailyTargetsByDay(snapshots);
    });
    return () => {
      cancelled = true;
    };
  }, [authedUserId, weekStartDay]);

  const weekTargetsByDay = useMemo(() => {
    const out: Record<string, { targetCalories: number | null; targetProtein: number | null; targetCarbs: number | null; targetFat: number | null } | null> = {};
    for (const [k, v] of Object.entries(dailyTargetsByDay)) {
      out[k] = v
        ? {
            targetCalories: v.targetCalories,
            targetProtein: v.targetProteinG,
            targetCarbs: v.targetCarbsG,
            targetFat: v.targetFatG,
          }
        : null;
    }
    return out;
  }, [dailyTargetsByDay]);

  const weekStats = useMemo(
    () => buildWeekStats(nutritionByDay, targets, weekStartDay, new Date(), weekTargetsByDay),
    [nutritionByDay, targets, weekStartDay, weekTargetsByDay],
  );

  // Numbers audit 2026-05-04 #4: this surface was rendering raw streak
  // (`computeLoggingStreak`) while Today / Progress / Recap render the
  // protected streak (with freezes applied). After a freeze auto-applied,
  // tapping "Logging streak" from Progress dropped the user from "26 days"
  // to "25 days" mid-flow. Now both surfaces compute the same number.
  const [freezeLedger, setFreezeLedger] = useState<FreezeLedger>({ earnedAt: [], usedHistory: [] });
  const [freezeBudgetMax, setFreezeBudgetMax] = useState<number>(3);
  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("streak_freezes_earned_at, streak_freezes_used_history, streak_freeze_budget_max")
      .eq("id", authedUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setFreezeLedger(
          readFreezeLedger({
            earnedAt: (data as { streak_freezes_earned_at?: unknown }).streak_freezes_earned_at,
            usedHistory: (data as { streak_freezes_used_history?: unknown }).streak_freezes_used_history,
          }),
        );
        const budget = (data as { streak_freeze_budget_max?: unknown }).streak_freeze_budget_max;
        if (typeof budget === "number" && Number.isFinite(budget) && budget >= 0) {
          setFreezeBudgetMax(budget);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authedUserId]);
  const streakDays = useMemo(
    () => computeProtectedStreak(nutritionByDay as never, freezeLedger, freezeBudgetMax).streakLength,
    [nutritionByDay, freezeLedger, freezeBudgetMax],
  );
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
    router.replace(p.toString() ? `/home?${p.toString()}` : "/home?view=today", { scroll: false });
  };

  return (
    <div className="product-shell py-pm-5">
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-lg border border-border bg-card flex items-center justify-center text-foreground hover:bg-muted"
          aria-label="Back"
        >
          <Icons.back className="w-4 h-4" />
        </button>
        {/* ENG-822 (2026-05-31 design-director review): calmed the header —
            was a shouty saturated-blue, ALL-CAPS, letter-spaced primary banner;
            now a normal-case, foreground-coloured title. Mirrors the mobile
            calm-header change. The subtitle below already carries the context. */}
        <h1 className="text-xl font-bold text-foreground truncate">{title}</h1>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">{subtitle}</p>

      {metric === "calories" && (
        <>
          <div className={`rounded-xl bg-card p-4 mb-4 ${cardCls}`}>
            <p className="text-sm font-semibold text-foreground mb-3">Daily intake</p>
            <div className="flex items-end gap-2 h-32">
              {weekStats.days.map((d) => {
                const maxCal = Math.max(targets.calories, ...weekStats.days.map((x) => x.calories), 1);
                const barH = maxCal > 0 ? Math.max(6, (d.calories / (maxCal * 1.15)) * 96) : 6;
                // F-2 — over/under judged against each day's own target.
                const over = d.calories > d.targetCalories;
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
            {/* 2026-05-08 ui-critic F8 web parity: removed "Tap a day to open it on Today."
                trailing helper. Day buttons below are visibly tappable (cursor + hover). */}
          </div>

          {weekStats.days.map((d) => (
            <button
              key={`row-${d.key}`}
              type="button"
              onClick={() => openDay(d.key)}
              className={`w-full flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3.5 mb-2 text-left hover:bg-muted/40 transition-colors ${cardCls}`}
            >
              <div>
                <p className="text-sm font-bold text-foreground">{formatLongDate(d.key)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{d.label}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-base font-extrabold text-foreground tabular-nums">{d.calories.toLocaleString()} kcal</p>
                  <p className="text-[11px] text-muted-foreground">
                    {/* F-2 — % of goal uses each day's frozen target
                        when a snapshot exists. Pre-migration days
                        use the current target and get an "(approx)"
                        tag so the user knows the comparison is
                        retroactive. */}
                    {d.calories > 0
                      ? `${Math.round((d.calories / Math.max(d.targetCalories, 1)) * 100)}% of goal${!d.isSnapshot && d.key !== todayDk ? " (approx)" : ""}`
                      : "Nothing logged"}
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
            <div className={`rounded-xl bg-card p-3 ${cardCls}`}>
              <p className="text-[11px] text-muted-foreground font-semibold">Avg / day</p>
              <p className="text-2xl font-extrabold text-[var(--macro-protein)] tabular-nums mt-1">{weekStats.avgProtein}g</p>
            </div>
            <div className={`rounded-xl bg-card p-3 ${cardCls}`}>
              <p className="text-[11px] text-muted-foreground font-semibold">On target</p>
              <p className="text-2xl font-extrabold text-primary-solid tabular-nums mt-1">{weekStats.proteinOnTarget}/7</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Weekly protein adherence vs goal: {weekStats.proteinAdherence}%. Carbs {weekStats.carbsAdherence}% · Fat {weekStats.fatAdherence}%
          </p>

          {weekStats.days.map((d) => {
            // F-2 — per-day protein target.
            const dayProteinTarget = d.targetProtein > 0 ? d.targetProtein : targets.protein;
            const hit = dayProteinTarget > 0 && d.protein >= dayProteinTarget * 0.9;
            const pct = dayProteinTarget > 0 ? Math.round((d.protein / dayProteinTarget) * 100) : 0;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => openDay(d.key)}
                className={`w-full flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3.5 mb-2 text-left hover:bg-muted/40 transition-colors ${cardCls}`}
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
          {/* 2026-05-08 ui-critic F11 web parity: hide the giant `0` headline when
              there's no streak yet — empty-state copy below carries the message. */}
          {streakDays > 0 ? (
            <div className={`rounded-xl bg-card p-5 mb-4 ${cardCls}`}>
              <p className="text-4xl font-black text-primary-solid tabular-nums">{streakDays}</p>
              <p className="text-sm font-semibold text-foreground mt-1">
                consecutive logging day{streakDays !== 1 ? "s" : ""}
              </p>
            </div>
          ) : null}

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
                  className={`w-full flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 mb-2 text-left hover:bg-muted/40 transition-colors ${cardCls}`}
                >
                  <div>
                    <p className="text-sm font-bold text-foreground">{formatLongDate(row.key)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {row.mealCount} item{row.mealCount !== 1 ? "s" : ""} · {row.calories.toLocaleString()} kcal
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
