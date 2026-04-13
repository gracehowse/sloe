"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Scale, Footprints, Percent, Activity } from "lucide-react";
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
      <div className="max-w-3xl mx-auto px-pm-6 py-pm-8 text-slate-600 dark:text-slate-400">
        Sign in to track progress.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-pm-6 py-pm-8 text-slate-600 dark:text-slate-400">Loading progress…</div>
    );
  }

  const goalWeightChart = goalWeightKg != null
    ? profileMeasurementSystem === "imperial" ? Math.round(kgToLb(goalWeightKg) * 10) / 10 : Math.round(goalWeightKg * 10) / 10
    : undefined;

  return (
    <div className="max-w-3xl mx-auto px-pm-6 py-pm-8">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-6 h-6 text-violet-600 dark:text-violet-400" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Progress</h1>
      </div>

      {/* Time range selector */}
      <div className="flex gap-1.5 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
        {(["1W", "1M", "3M", "6M", "All"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
              range === r
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* WEIGHT */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Weight</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm mb-4">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-4 border border-slate-200/80 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Current</p>
            <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {latestWeightKg != null ? formatWeight(latestWeightKg) : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-4 border border-slate-200/80 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Goal</p>
            <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {goalWeightKg != null ? formatWeight(goalWeightKg) : "—"}
            </p>
            {weeksToGoalVal != null && weeksToGoalVal > 0 && goalDateLabel && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                ~{weeksToGoalVal} weeks to goal ({goalDateLabel})
              </p>
            )}
          </div>
        </div>

        {weightChartData.length >= 2 && (
          <div className="h-48 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} stroke="#94a3b8" width={40} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 3, fill: "#a855f7" }} />
                {goalWeightChart != null && (
                  <ReferenceLine y={goalWeightChart} stroke="#22c55e" strokeDasharray="4 3" label={{ value: "Goal", position: "right", fill: "#22c55e", fontSize: 10 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Log today ({profileMeasurementSystem === "imperial" ? "lb" : "kg"})</label>
            <input type="text" inputMode="decimal" value={weightInput} onChange={(e) => setWeightInput(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              placeholder={profileMeasurementSystem === "imperial" ? "e.g. 165" : "e.g. 72.5"} />
          </div>
          <button type="button" onClick={() => void saveTodayWeight()} className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2">
            Save
          </button>
        </div>
      </section>

      {/* STEPS */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Footprints className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Steps</h2>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Today</p>
            <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {todaySteps.toLocaleString()} <span className="text-sm font-medium text-slate-500">/ {dailyStepsGoal.toLocaleString()}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700" onClick={() => void saveStepsGoal(dailyStepsGoal - 1000)}>−1k</button>
            <button type="button" className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700" onClick={() => void saveStepsGoal(dailyStepsGoal + 1000)}>+1k</button>
          </div>
        </div>

        {stepsChartData.length >= 2 && (
          <div className="h-40 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stepsChartData}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" width={40} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <ReferenceLine y={dailyStepsGoal} stroke="#22c55e" strokeDasharray="4 3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Steps today</label>
            <input type="text" inputMode="numeric" value={stepsInput} onChange={(e) => setStepsInput(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              placeholder="e.g. 8240" />
          </div>
          <button type="button" onClick={() => void saveTodaySteps()} className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2">
            Save
          </button>
        </div>
      </section>

      {/* BODY FAT */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Percent className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Body Fat</h2>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Current</p>
            <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">{bodyFatPct != null ? `${Math.round(bodyFatPct * 10) / 10}%` : "—"}</p>
          </div>
          <input type="text" inputMode="decimal" value={bodyFatInput} onChange={(e) => setBodyFatInput(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm w-28"
            placeholder="%" />
          <button type="button" onClick={() => void saveBodyFat()} className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2">
            Save
          </button>
        </div>
      </section>
    </div>
  );
}
