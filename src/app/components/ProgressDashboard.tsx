"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { IconBox } from "./ui/icon-box";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
} from "recharts";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { refreshAdaptiveTdeeForUser } from "../../lib/nutrition/refreshAdaptiveTdee.ts";
import { useAuthSession } from "../../context/AuthSessionContext.tsx";
import { weeksToGoal, kgToLb, calculateTDEE, getEffectiveTDEE, type PlanPace, type Sex, type ActivityLevel } from "../../lib/nutrition/tdee.ts";
import { calcGoalTimeline, projectWeight } from "../../lib/weightProjection.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { normalizeMacroTargets, DEFAULT_STEPS_GOAL } from "../../types/profile.ts";
import { computeLoggingStreak } from "../../lib/nutrition/trackerStats.ts";
import type { LoggedMeal } from "../../types/recipe.ts";

const PACES: PlanPace[] = ["relaxed", "steady", "accelerated", "vigorous"];

function parseNumMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function coercePace(v: string | null | undefined): PlanPace {
  const s = (v ?? "steady").toLowerCase();
  return (PACES as string[]).includes(s) ? (s as PlanPace) : "steady";
}

export function ProgressDashboard() {
  const { authedUserId } = useAuthSession();
  const { profileMeasurementSystem, nutritionByDay, nutritionTargets } = useAppData();

  const [loading, setLoading] = useState(true);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null);
  const [planPace, setPlanPace] = useState<PlanPace>("steady");
  const [weightKgByDay, setWeightKgByDay] = useState<Record<string, number>>({});
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [dailyStepsGoal, setDailyStepsGoal] = useState(DEFAULT_STEPS_GOAL);
  const [bodyFatPct, setBodyFatPct] = useState<number | null>(null);
  const [userGoal, setUserGoal] = useState<string | null>(null);

  // Adaptive TDEE state
  const [staticTdee, setStaticTdee] = useState<number | null>(null);
  const [adaptiveTdee, setAdaptiveTdee] = useState<number | null>(null);
  const [adaptiveConfidence, setAdaptiveConfidence] = useState<string | null>(null);
  const [isAdaptive, setIsAdaptive] = useState(false);

  const [weightInput, setWeightInput] = useState("");
  const [stepsInput, setStepsInput] = useState("");
  const [bodyFatInput, setBodyFatInput] = useState("");
  const [range, setRange] = useState<"1W" | "1M" | "3M" | "6M" | "All">("3M");

  const todayKey = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }, []);

  const load = useCallback(async () => {
    if (!authedUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "weight_kg, goal_weight_kg, plan_pace, weight_kg_by_day, steps_by_day, daily_steps_goal, body_fat_pct, goal, sex, height_cm, age, activity_level, adaptive_tdee, adaptive_tdee_confidence",
      )
      .eq("id", authedUserId)
      .maybeSingle();
    if (error) {
      console.error("[progress] load failed", error.message);
      setLoading(false);
      return;
    }
    if (data) {
      const w = data.weight_kg != null ? Number(data.weight_kg) : null;
      const gw = data.goal_weight_kg != null ? Number(data.goal_weight_kg) : null;
      setWeightKg(Number.isFinite(w) ? w : null);
      setGoalWeightKg(Number.isFinite(gw) ? gw : null);
      setPlanPace(coercePace(data.plan_pace as string | undefined));
      setWeightKgByDay(parseNumMap(data.weight_kg_by_day));
      setStepsByDay(parseNumMap(data.steps_by_day));
      const sg = data.daily_steps_goal != null ? Number(data.daily_steps_goal) : DEFAULT_STEPS_GOAL;
      setDailyStepsGoal(Number.isFinite(sg) && sg > 0 ? Math.round(sg) : DEFAULT_STEPS_GOAL);
      const bf = data.body_fat_pct != null ? Number(data.body_fat_pct) : null;
      setBodyFatPct(Number.isFinite(bf) ? bf : null);
      setUserGoal((data as any).goal ?? null);

      // Compute TDEE values
      const sex = ((data as any).sex as Sex) ?? "unspecified";
      const heightCm = Number((data as any).height_cm) || 170;
      const age = Number((data as any).age) || 30;
      const actLevel = ((data as any).activity_level as ActivityLevel) ?? "moderate";
      const wForTdee = Number.isFinite(w) ? w! : 70;
      const sTdee = calculateTDEE(sex, wForTdee, heightCm, age, actLevel);
      setStaticTdee(sTdee);
      const aTdee = (data as any).adaptive_tdee != null ? Number((data as any).adaptive_tdee) : null;
      setAdaptiveTdee(Number.isFinite(aTdee) ? aTdee : null);
      const aConf = ((data as any).adaptive_tdee_confidence as string) ?? null;
      setAdaptiveConfidence(aConf);
      const eff = getEffectiveTDEE({
        adaptive_tdee: aTdee,
        adaptive_tdee_confidence: aConf,
        sex, weight_kg: wForTdee, height_cm: heightCm, age, activity_level: actLevel,
      });
      setIsAdaptive(eff.isAdaptive);
    }
    setLoading(false);
  }, [authedUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const latestWeightKg = useMemo(() => {
    const fromLog = Object.entries(weightKgByDay).sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))[0]?.[1];
    if (fromLog != null && Number.isFinite(fromLog)) return fromLog;
    return weightKg;
  }, [weightKgByDay, weightKg]);

  const weeksToGoalVal = useMemo(() => {
    if (latestWeightKg == null || goalWeightKg == null) return null;
    if (latestWeightKg <= goalWeightKg) return 0;
    return weeksToGoal(latestWeightKg, goalWeightKg, planPace);
  }, [latestWeightKg, goalWeightKg, planPace]);

  const goalDateLabel = useMemo(() => {
    if (weeksToGoalVal == null || weeksToGoalVal <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + weeksToGoalVal * 7);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }, [weeksToGoalVal]);

  const todaySteps = stepsByDay[todayKey] ?? 0;

  const rangeDays = range === "1W" ? 7 : range === "1M" ? 30 : range === "3M" ? 90 : range === "6M" ? 180 : 9999;

  const weightChartData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    const cutStr = cutoff.toISOString().slice(0, 10);
    return Object.entries(weightKgByDay)
      .filter(([k]) => k >= cutStr)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        date: k.slice(5),
        value: profileMeasurementSystem === "imperial" ? Math.round(kgToLb(v) * 10) / 10 : Math.round(v * 10) / 10,
      }));
  }, [weightKgByDay, rangeDays, profileMeasurementSystem]);

  const stepsChartData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    const cutStr = cutoff.toISOString().slice(0, 10);
    return Object.entries(stepsByDay)
      .filter(([k]) => k >= cutStr)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ date: k.slice(5), value: v }));
  }, [stepsByDay, rangeDays]);

  const persistProfilePatch = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!authedUserId) return;
      const { error } = await supabase.from("profiles").update(patch).eq("id", authedUserId);
      if (error) console.error("[progress] save failed", error.message);
      else if ("weight_kg_by_day" in patch) {
        void refreshAdaptiveTdeeForUser(supabase, authedUserId);
      }
    },
    [authedUserId],
  );

  const saveTodayWeight = useCallback(async () => {
    const v = Number.parseFloat(weightInput.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return;
    const kg = profileMeasurementSystem === "imperial" ? v / 2.20462 : v;
    const nextMap = { ...weightKgByDay, [todayKey]: kg };
    setWeightKgByDay(nextMap);
    setWeightKg(kg);
    setWeightInput("");
    await persistProfilePatch({ weight_kg: kg, weight_kg_by_day: nextMap });
  }, [weightInput, profileMeasurementSystem, weightKgByDay, todayKey, persistProfilePatch]);

  const saveTodaySteps = useCallback(async () => {
    const v = Math.round(Number.parseFloat(stepsInput.replace(",", ".")));
    if (!Number.isFinite(v) || v < 0) return;
    const nextMap = { ...stepsByDay, [todayKey]: v };
    setStepsByDay(nextMap);
    setStepsInput("");
    await persistProfilePatch({ steps_by_day: nextMap });
  }, [stepsInput, stepsByDay, todayKey, persistProfilePatch]);

  const saveStepsGoal = useCallback(
    async (next: number) => {
      const g = Math.max(1000, Math.round(next));
      setDailyStepsGoal(g);
      await persistProfilePatch({ daily_steps_goal: g });
    },
    [persistProfilePatch],
  );

  const saveBodyFat = useCallback(async () => {
    const v = Number.parseFloat(bodyFatInput.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0 || v > 60) return;
    setBodyFatPct(v);
    setBodyFatInput("");
    await persistProfilePatch({ body_fat_pct: v });
  }, [bodyFatInput, persistProfilePatch]);

  const formatWeight = (kg: number) =>
    profileMeasurementSystem === "imperial" ? `${Math.round(kgToLb(kg) * 10) / 10} lb` : `${Math.round(kg * 10) / 10} kg`;

  if (!authedUserId) {
    return (
      <div className="max-w-3xl mx-auto px-pm-6 py-pm-8 text-muted-foreground">
        Sign in to track progress.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-pm-6 py-pm-8 text-muted-foreground">Loading progress…</div>
    );
  }

  const goalWeightChart = goalWeightKg != null
    ? profileMeasurementSystem === "imperial" ? Math.round(kgToLb(goalWeightKg) * 10) / 10 : Math.round(goalWeightKg * 10) / 10
    : undefined;

  // Compute real weekly data from nutritionByDay
  const targets = normalizeMacroTargets(nutritionTargets);
  const weeklyStats = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date();
    const dailyCals: { day: string; calories: number; target: number }[] = [];
    let totalProtein = 0, totalCarbs = 0, totalFat = 0;
    let targetProteinTotal = 0, targetCarbsTotal = 0, targetFatTotal = 0;
    let proteinDaysHit = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const meals: LoggedMeal[] = nutritionByDay[key] ?? [];
      const dayCal = meals.reduce((s, m) => s + m.calories, 0);
      const dayP = meals.reduce((s, m) => s + m.protein, 0);
      const dayC = meals.reduce((s, m) => s + m.carbs, 0);
      const dayF = meals.reduce((s, m) => s + m.fat, 0);

      dailyCals.push({ day: dayNames[d.getDay()], calories: Math.round(dayCal), target: targets.calories });
      totalProtein += dayP;
      totalCarbs += dayC;
      totalFat += dayF;
      targetProteinTotal += targets.protein;
      targetCarbsTotal += targets.carbs;
      targetFatTotal += targets.fat;
      if (meals.length > 0 && dayP >= targets.protein * 0.9) proteinDaysHit++;
    }

    const proteinAdh = targetProteinTotal > 0 ? Math.round((totalProtein / targetProteinTotal) * 100) : 0;
    const carbsAdh = targetCarbsTotal > 0 ? Math.round((totalCarbs / targetCarbsTotal) * 100) : 0;
    const fatAdh = targetFatTotal > 0 ? Math.round((totalFat / targetFatTotal) * 100) : 0;

    return { dailyCals, proteinAdh, carbsAdh, fatAdh, proteinDaysHit };
  }, [nutritionByDay, targets]);

  const dailyCaloriesData = weeklyStats.dailyCals;
  const proteinAdherence = weeklyStats.proteinAdh;
  const carbsAdherence = weeklyStats.carbsAdh;
  const fatAdherence = weeklyStats.fatAdh;

  const avgCalories = dailyCaloriesData.length > 0
    ? Math.round(dailyCaloriesData.reduce((sum, d) => sum + d.calories, 0) / dailyCaloriesData.length)
    : 0;
  const proteinOnTarget = weeklyStats.proteinDaysHit;
  const streakDays = computeLoggingStreak(nutritionByDay);

  return (
    <div className="max-w-4xl mx-auto px-pm-6 py-pm-8">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-[22px] font-bold text-foreground mb-1">Progress</h1>
        <p className="text-sm text-muted-foreground">Weekly report</p>
      </div>

      {/* 2x2 STAT GRID */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <div className="rounded-xl bg-card border border-border p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <IconBox size="sm" tone="warning"><Icons.calories /></IconBox>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Avg Calories</span>
          </div>
          <p className="text-[22px] font-bold text-warning tabular-nums mb-0.5">{avgCalories}</p>
          <p className="text-[11px] text-muted-foreground">vs {targets.calories.toLocaleString()} target</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <IconBox size="sm" tone="success"><Icons.check /></IconBox>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Protein Hit</span>
          </div>
          <p className="text-[22px] font-bold text-success tabular-nums mb-0.5">{proteinOnTarget}/7</p>
          <p className="text-[11px] text-muted-foreground">days on target</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <IconBox size="sm" tone="success"><Icons.trophy /></IconBox>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Streak</span>
          </div>
          <p className="text-[22px] font-bold text-success tabular-nums mb-0.5">{streakDays} days</p>
          <p className="text-[11px] text-muted-foreground">logging streak</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <IconBox size="sm" tone="primary"><Icons.progress /></IconBox>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Trend</span>
          </div>
          <p className="text-[22px] font-bold text-primary tabular-nums mb-0.5">{(() => {
            const entries = Object.entries(weightKgByDay).sort(([a], [b]) => b.localeCompare(a));
            if (entries.length < 2) return "—";
            const recent = entries[0][1];
            const weekAgo = entries.find(([k]) => k <= (() => { const d = new Date(); d.setDate(d.getDate() - 7); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })())?.[1] ?? entries[entries.length - 1][1];
            const delta = recent - weekAgo;
            const val = profileMeasurementSystem === "imperial" ? Math.round(kgToLb(Math.abs(delta)) * 10) / 10 : Math.round(Math.abs(delta) * 10) / 10;
            const unit = profileMeasurementSystem === "imperial" ? "lb" : "kg";
            return `${delta <= 0 ? "−" : "+"}${val} ${unit}`;
          })()}</p>
          <p className="text-[11px] text-muted-foreground">{(() => {
            const entries = Object.entries(weightKgByDay).sort(([a], [b]) => b.localeCompare(a));
            if (entries.length < 2) return "no data yet";
            const delta = entries[0][1] - (entries.find(([k]) => k <= (() => { const d = new Date(); d.setDate(d.getDate() - 7); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })())?.[1] ?? entries[entries.length - 1][1]);
            return goalWeightKg != null && ((goalWeightKg < (weightKg ?? Infinity) && delta <= 0) || (goalWeightKg > (weightKg ?? 0) && delta >= 0)) ? "on track" : entries.length < 2 ? "no data yet" : "this week";
          })()}</p>
        </div>
      </div>

      {/* DAILY CALORIES CHART */}
      <div className="rounded-xl bg-card border border-border p-4 mb-6">
        <p className="text-sm font-semibold text-foreground mb-3">Daily Calories</p>
        <div className="flex items-end gap-2" style={{ height: 90 }}>
          {dailyCaloriesData.map((d, i) => {
            const overTarget = d.calories > d.target;
            const barH = (d.calories / Math.max(targets.calories * 1.15, 1)) * 70;
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  {d.calories >= 1000 ? `${(d.calories / 1000).toFixed(1)}k` : d.calories}
                </span>
                <div
                  className="w-full rounded-md"
                  style={{
                    height: barH,
                    background: overTarget ? "var(--warning)" : "var(--success)",
                    opacity: i === 6 ? 0.4 : 0.75,
                  }}
                />
                <span className="text-[10px] text-muted-foreground font-medium">{d.day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* MACRO ADHERENCE */}
      <div className="rounded-xl bg-card border border-border p-4 mb-6">
        <p className="text-sm font-semibold text-foreground mb-3">Macro Adherence</p>
        <div className="space-y-2">
          {([
            ["Protein", proteinAdherence, "var(--macro-protein)"],
            ["Carbs", carbsAdherence, "var(--macro-carbs)"],
            ["Fat", fatAdherence, "var(--macro-fat)"],
          ] as const).map(([name, pct, color]) => (
            <div key={name} className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
              <span className="text-xs text-muted-foreground w-12">{name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="text-xs font-semibold tabular-nums w-8 text-right" style={{ color }}>{pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* WEEKLY INSIGHT */}
      {avgCalories > 0 ? (
        <div className="rounded-xl p-3.5" style={{ background: "var(--primary-soft, rgba(76,108,224,0.06))", border: "1px solid rgba(76,108,224,0.13)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <IconBox size="sm" tone="primary"><Icons.star /></IconBox>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Weekly insight</span>
          </div>
          <p className="text-xs text-foreground leading-relaxed">
            {proteinOnTarget >= 5
              ? `Protein on target ${proteinOnTarget} of 7 days this week.`
              : proteinOnTarget > 0
              ? `Protein on target ${proteinOnTarget} of 7 days this week.`
              : "Protein target not reached on any tracked day this week."}{" "}
            Average intake is {avgCalories} kcal vs your {targets.calories.toLocaleString()} target.{" "}
            {avgCalories <= targets.calories * 1.1 && avgCalories >= targets.calories * 0.9 ? "Calories within 10% of target this week." : avgCalories < targets.calories * 0.9 ? "Average intake below target this week." : "Average intake above target this week."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl p-3.5" style={{ background: "var(--primary-soft, rgba(76,108,224,0.06))", border: "1px solid rgba(76,108,224,0.13)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <IconBox size="sm" tone="primary"><Icons.star /></IconBox>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Get started</span>
          </div>
          <p className="text-xs text-foreground leading-relaxed">
            Log your meals on the Today tab to see weekly stats, macro adherence, and personalized insights here.
          </p>
        </div>
      )}

      {/* ADAPTIVE TDEE INSIGHT */}
      {staticTdee != null && (
        <div className="rounded-xl bg-card border border-border p-4 mb-6 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <IconBox size="sm" tone="primary"><Icons.calories /></IconBox>
            <p className="text-sm font-semibold text-foreground">Your TDEE</p>
            {isAdaptive && (
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/10 text-success">
                Adaptive
              </span>
            )}
          </div>

          <div className="flex gap-6 mb-3">
            <div className="text-center">
              <p className={`text-[28px] font-bold tabular-nums ${isAdaptive ? "text-success" : "text-foreground"}`}>
                {isAdaptive && adaptiveTdee ? adaptiveTdee.toLocaleString() : staticTdee.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isAdaptive ? "Adaptive TDEE" : "Estimated TDEE"}
              </p>
            </div>
            {isAdaptive && adaptiveTdee && staticTdee && (
              <div className="text-center">
                <p className="text-[22px] font-bold text-muted-foreground tabular-nums">
                  {staticTdee.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Formula estimate</p>
              </div>
            )}
          </div>

          {/* Confidence indicator */}
          {adaptiveConfidence && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">Confidence:</span>
              <div className="flex gap-1">
                {["low", "medium", "high"].map((level) => (
                  <div
                    key={level}
                    className="h-1.5 rounded-full"
                    style={{
                      width: 24,
                      background:
                        (level === "low" && ["low", "medium", "high"].includes(adaptiveConfidence ?? ""))
                        || (level === "medium" && ["medium", "high"].includes(adaptiveConfidence ?? ""))
                        || (level === "high" && adaptiveConfidence === "high")
                          ? "var(--success)"
                          : "var(--muted)",
                    }}
                  />
                ))}
              </div>
              <span className="text-xs font-medium capitalize" style={{ color: adaptiveConfidence === "high" ? "var(--success)" : adaptiveConfidence === "medium" ? "var(--warning)" : "var(--muted-foreground)" }}>
                {adaptiveConfidence}
              </span>
            </div>
          )}

          {/* Explanation */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isAdaptive ? (
              <>
                Your TDEE is calculated from your actual intake and weight changes — more accurate than a formula estimate.
                {adaptiveTdee && staticTdee && Math.abs(adaptiveTdee - staticTdee) >= 50 && (
                  <> Your real expenditure is <strong className="text-foreground">{Math.abs(adaptiveTdee - staticTdee)} kcal {adaptiveTdee > staticTdee ? "higher" : "lower"}</strong> than the formula predicted.</>
                )}
              </>
            ) : (
              <>
                Based on the Mifflin-St Jeor formula. Log meals and weigh in regularly to unlock your adaptive TDEE — calculated from your actual intake and weight trend.
                {(() => {
                  const weightDays = Object.keys(weightKgByDay).length;
                  if (weightDays < 3) return <> You need at least 3 weigh-ins and 7 days of food logging to get started.</>;
                  return <> Keep logging — your adaptive TDEE will activate once enough data accumulates.</>;
                })()}
              </>
            )}
          </p>

          {/* Data progress for non-adaptive users */}
          {!isAdaptive && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">Weigh-ins</span>
                    <span className="text-[10px] font-semibold tabular-nums text-foreground">{Object.keys(weightKgByDay).length}/7</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (Object.keys(weightKgByDay).length / 7) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">Logging days</span>
                    <span className="text-[10px] font-semibold tabular-nums text-foreground">{Object.keys(nutritionByDay).filter((k) => (nutritionByDay[k] ?? []).length > 0).length}/21</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (Object.keys(nutritionByDay).filter((k) => (nutritionByDay[k] ?? []).length > 0).length / 21) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WEIGHT TRACKING */}
      <div className="rounded-xl bg-card border border-border p-4 mb-6 mt-6">
        <p className="text-sm font-semibold text-foreground mb-3">Weight</p>
        <div className="flex gap-6 mb-3">
          <div className="text-center">
            <p className="text-[22px] font-bold text-foreground tabular-nums">{weightKg != null ? formatWeight(weightKg) : "—"}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Current</p>
          </div>
          <div className="text-center">
            <p className="text-[22px] font-bold text-success tabular-nums">{goalWeightKg != null ? formatWeight(goalWeightKg) : "—"}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Goal</p>
          </div>
        </div>
        {weightChartData.length >= 2 && (
          <div className="mb-3">
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={weightChartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} />
                {goalWeightChart != null && <ReferenceLine y={goalWeightChart} stroke="var(--success)" strokeDasharray="4 4" />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder={profileMeasurementSystem === "imperial" ? "Weight (lb)" : "Weight (kg)"}
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            type="number"
            step="0.1"
          />
          <button onClick={() => void saveTodayWeight()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">Save</button>
        </div>
      </div>

      {/* JOURNEY / WEIGHT PROJECTION */}
      {weightKg != null && goalWeightKg != null && goalWeightKg !== weightKg && (() => {
        const timeline = calcGoalTimeline({ currentWeightKg: weightKg, goalWeightKg, weightKgByDay });
        const progressPct = Math.max(0, Math.min(100,
          timeline.remainingKg > 0
            ? ((Math.abs(weightKg - goalWeightKg) - timeline.remainingKg) / Math.abs(weightKg - goalWeightKg)) * 100
            : 100
        ));
        // Recent 7-day average calories
        const recentKeys = Object.keys(nutritionByDay).sort().slice(-7);
        const daysWithFood = recentKeys.filter((k) => (nutritionByDay[k] ?? []).length > 0);
        const avgRecentCals = daysWithFood.length > 0
          ? Math.round(daysWithFood.reduce((s, k) => s + (nutritionByDay[k] ?? []).reduce((a, m) => a + m.calories, 0), 0) / daysWithFood.length)
          : 0;
        const dailyProjection = avgRecentCals > 0
          ? projectWeight({ currentWeightKg: weightKg, todayCalories: avgRecentCals, targetCalories: targets.calories, goal: userGoal })
          : null;

        return (
          <div className="rounded-xl bg-card border border-border p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <IconBox size="sm" tone="success"><Icons.check /></IconBox>
                <p className="text-sm font-semibold text-foreground">Journey</p>
              </div>
              {timeline.daysToGoal != null && (
                <p className="text-right">
                  <span className="text-[22px] font-bold text-primary tabular-nums">{timeline.daysToGoal}</span>
                  <span className="text-xs text-muted-foreground ml-1">days to goal</span>
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              {timeline.remainingKg > 0.1
                ? `${timeline.remainingKg} kg to go until your ${formatWeight(goalWeightKg)} goal.`
                : "You\u2019ve reached your goal weight."}
              {timeline.weeklyRateKg !== 0 && ` Trending ${timeline.trendDirection} at ${Math.abs(timeline.weeklyRateKg)} kg/week.`}
            </p>

            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">{formatWeight(weightKg)}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(progressPct, 3)}%`,
                    background: progressPct >= 100 ? "var(--success)" : "var(--primary)",
                  }}
                />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">{formatWeight(goalWeightKg)}</span>
            </div>

            {/* Projection based on recent average */}
            {dailyProjection && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Weekly trajectory: averaging {avgRecentCals.toLocaleString()} kcal/day puts you on track for{" "}
                  <span className="font-bold text-primary">{formatWeight(dailyProjection.projectedWeightKg)}</span> in ~{dailyProjection.projectionWeeks} weeks.
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* STEPS */}
      <div className="rounded-xl bg-card border border-border p-4 mb-6">
        <p className="text-sm font-semibold text-foreground mb-3">Steps</p>
        <div className="flex gap-6 mb-3">
          <div className="text-center">
            <p className="text-[22px] font-bold text-foreground tabular-nums">{(stepsByDay[todayKey] ?? 0).toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Today</p>
          </div>
          <div className="text-center">
            <p className="text-[22px] font-bold text-success tabular-nums">{dailyStepsGoal.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Goal</p>
          </div>
        </div>
        {stepsChartData.length >= 2 && (
          <div className="mb-3">
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={stepsChartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <ReferenceLine y={dailyStepsGoal} stroke="var(--success)" strokeDasharray="4 4" />
                <Bar dataKey="value" fill="var(--success)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Steps today"
            value={stepsInput}
            onChange={(e) => setStepsInput(e.target.value)}
            type="number"
          />
          <button onClick={() => void saveTodaySteps()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">Save</button>
        </div>
      </div>

      {/* BODY FAT */}
      <div className="rounded-xl bg-card border border-border p-4">
        <p className="text-sm font-semibold text-foreground mb-3">Body Fat</p>
        <p className="text-[28px] font-bold text-foreground tabular-nums mb-3">{bodyFatPct != null ? `${Math.round(bodyFatPct * 10) / 10}%` : "—"}</p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Body fat %"
            value={bodyFatInput}
            onChange={(e) => setBodyFatInput(e.target.value)}
            type="number"
            step="0.1"
          />
          <button onClick={() => void saveBodyFat()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">Save</button>
        </div>
      </div>
    </div>
  );
}
