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
import { weeksToGoal, kgToLb, type PlanPace } from "../../lib/nutrition/tdee.ts";
import { useAppData } from "../../context/AppDataContext.tsx";

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
  const { profileMeasurementSystem } = useAppData();

  const [loading, setLoading] = useState(true);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null);
  const [planPace, setPlanPace] = useState<PlanPace>("steady");
  const [weightKgByDay, setWeightKgByDay] = useState<Record<string, number>>({});
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [dailyStepsGoal, setDailyStepsGoal] = useState(10000);
  const [bodyFatPct, setBodyFatPct] = useState<number | null>(null);

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
        "weight_kg, goal_weight_kg, plan_pace, weight_kg_by_day, steps_by_day, daily_steps_goal, body_fat_pct",
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
      const sg = data.daily_steps_goal != null ? Number(data.daily_steps_goal) : 10000;
      setDailyStepsGoal(Number.isFinite(sg) && sg > 0 ? Math.round(sg) : 10000);
      const bf = data.body_fat_pct != null ? Number(data.body_fat_pct) : null;
      setBodyFatPct(Number.isFinite(bf) ? bf : null);
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

  // Mock data for protein, carbs, fat adherence
  const proteinAdherence = 75;
  const carbsAdherence = 62;
  const fatAdherence = 68;

  // Mock daily calories for the week (Mon-Sun)
  const dailyCaloriesData = [
    { day: "Mon", calories: 2100, target: 2200 },
    { day: "Tue", calories: 2350, target: 2200 },
    { day: "Wed", calories: 2050, target: 2200 },
    { day: "Thu", calories: 2280, target: 2200 },
    { day: "Fri", calories: 2100, target: 2200 },
    { day: "Sat", calories: 2450, target: 2200 },
    { day: "Sun", calories: 2180, target: 2200 },
  ];

  const avgCalories = Math.round(dailyCaloriesData.reduce((sum, d) => sum + d.calories, 0) / dailyCaloriesData.length);
  const proteinOnTarget = 5; // X/7 days
  const streakDays = 12; // X days protein goal

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
          <p className="text-[11px] text-muted-foreground">vs 2,100 target</p>
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
          <p className="text-[11px] text-muted-foreground">protein goal</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <IconBox size="sm" tone="primary"><Icons.progress /></IconBox>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Trend</span>
          </div>
          <p className="text-[22px] font-bold text-primary tabular-nums mb-0.5">−0.4 kg</p>
          <p className="text-[11px] text-muted-foreground">on track</p>
        </div>
      </div>

      {/* DAILY CALORIES CHART */}
      <div className="rounded-xl bg-card border border-border p-4 mb-6">
        <p className="text-sm font-semibold text-foreground mb-3">Daily Calories</p>
        <div className="flex items-end gap-2" style={{ height: 90 }}>
          {dailyCaloriesData.map((d, i) => {
            const overTarget = d.calories > d.target;
            const barH = (d.calories / 2400) * 70;
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
      <div className="rounded-xl p-3.5" style={{ background: "var(--primary-soft, rgba(76,108,224,0.06))", border: "1px solid rgba(76,108,224,0.13)" }}>
        <div className="flex items-center gap-1.5 mb-1">
          <IconBox size="sm" tone="primary"><Icons.star /></IconBox>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Weekly insight</span>
        </div>
        <p className="text-xs text-foreground leading-relaxed">
          Protein consistency is strong — {proteinOnTarget} of 7 days on target. Average intake is {avgCalories} kcal vs your 2,100 target. Keep it up!
        </p>
      </div>
    </div>
  );
}
