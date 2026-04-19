"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { calcGoalTimeline, computeWeightJourneyProgressPct, formatWeightJourneyProgressCopy, projectWeight, shouldRenderDailyProjection } from "../../lib/weightProjection.ts";
import { resolveMaintenance } from "../../lib/nutrition/resolveMaintenance.ts";
import { buildMaintenanceChain } from "../../lib/nutrition/maintenanceChain.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { normalizeMacroTargets, DEFAULT_STEPS_GOAL } from "../../types/profile.ts";
import { computeLoggingStreak } from "../../lib/nutrition/trackerStats.ts";
import { todayKey } from "../../lib/nutrition/trackerDate.ts";
import { buildWeekStats, formatAvgCaloriesLabel, formatMacroAdherenceBar } from "../../lib/nutrition/progressWeekReport.ts";
import { computeWeightTrendCopy } from "../../lib/nutrition/weightTrendTile.ts";
import { getDailyTargets, type DailyTarget } from "../../lib/nutrition/dailyTargetRead.ts";
import {
  availableFreezes,
  computeProtectedStreak,
  readFreezeLedger,
  type FreezeLedger,
} from "../../lib/nutrition/streakFreeze.ts";
import {
  buildUsualMealRecapInsight,
  buildWeeklyRecap,
  shouldShowRecap,
  weekKeyFor,
  type UsualMealRecapInsight,
} from "../../lib/nutrition/weeklyRecap.ts";
import { listSavedMeals, type SavedMeal } from "../../lib/nutrition/savedMeals.ts";
import { normaliseRecipeTitle } from "../../lib/nutrition/usualMealHint.ts";
import {
  PENDING_USUAL_MEAL_SAVE_KEY,
  serializePendingUsualMealSave,
} from "../../lib/nutrition/pendingUsualMealSave.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";
import { WeeklyRecapCard } from "./suppr/weekly-recap-card.tsx";
import { ProgressMetricDetail, type ProgressMetric } from "./ProgressMetricDetail.tsx";

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

/**
 * "Tue" / "Mar 12" compact date label for freeze-used rows. Uses the
 * local Date constructor so it lines up with the device timezone shown
 * on Today.
 */
function formatFreezeDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((n) => Number.parseInt(n, 10));
  if (![y, m, d].every(Number.isFinite)) return dateKey;
  const dt = new Date(y, m - 1, d);
  const now = new Date();
  const daysAgo = Math.round((now.getTime() - dt.getTime()) / 86_400_000);
  if (daysAgo >= 0 && daysAgo < 7) {
    return dt.toLocaleDateString(undefined, { weekday: "short" });
  }
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function FreezeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 border border-border/60 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
        {label}
      </p>
      <p className="text-[18px] font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function coerceProgressMetric(v: string | null): ProgressMetric | null {
  if (v === "calories" || v === "protein" || v === "streak") return v;
  return null;
}

function ProgressDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const metricParam = coerceProgressMetric(searchParams.get("metric"));
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
  const [adaptiveUpdatedAt, setAdaptiveUpdatedAt] = useState<string | null>(null);
  const [isAdaptive, setIsAdaptive] = useState(false);
  // Profile basics cached so `resolveMaintenance` can fall back to the
  // formula when adaptive isn't confident enough (F-3, 2026-04-19).
  const [profileSexCached, setProfileSexCached] = useState<Sex>("unspecified");
  const [profileHeightCmCached, setProfileHeightCmCached] = useState<number>(170);
  const [profileAgeCached, setProfileAgeCached] = useState<number>(30);
  const [profileActivityLevelCached, setProfileActivityLevelCached] = useState<ActivityLevel>("sedentary");

  // G-4 (2026-04-19) — controls the "How this works" expandable under
  // the Maintenance card. Default collapsed; persisted only in memory
  // so a user who just dismissed it doesn't get re-opened rows on next
  // render.
  const [maintenanceExplainerOpen, setMaintenanceExplainerOpen] = useState(false);

  const [weightInput, setWeightInput] = useState("");
  const [stepsInput, setStepsInput] = useState("");
  const [bodyFatInput, setBodyFatInput] = useState("");
  const [range, setRange] = useState<"1W" | "1M" | "3M" | "6M" | "All">("3M");
  const [weekStartDay, setWeekStartDay] = useState<"monday" | "sunday">("monday");

  // Batch 4.11 — streak freeze + weekly recap state
  const [freezeLedger, setFreezeLedger] = useState<FreezeLedger>({
    earnedAt: [],
    usedHistory: [],
  });
  const [freezeBudgetMax, setFreezeBudgetMax] = useState<number>(3);
  const [recapLastSeenWeekKey, setRecapLastSeenWeekKey] = useState<string | null>(null);

  // F-2 (2026-04-19) — daily target snapshots for past-day "% of goal".
  const [dailyTargetsByDay, setDailyTargetsByDay] = useState<Record<string, DailyTarget | null>>({});

  const load = useCallback(async () => {
    if (!authedUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "weight_kg, goal_weight_kg, plan_pace, weight_kg_by_day, steps_by_day, daily_steps_goal, body_fat_pct, goal, sex, height_cm, age, activity_level, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, week_start_day, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history, weekly_recap_last_seen_week_key",
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
      const wsd = String((data as { week_start_day?: string }).week_start_day ?? "").toLowerCase();
      setWeekStartDay(wsd === "sunday" ? "sunday" : "monday");

      // Batch 4.11 — freeze ledger + recap seen-state. Columns may be
      // missing if the migration hasn't run locally; fall back to the
      // defaults so the UI still renders.
      const rawFreezeEarned = (data as { streak_freezes_earned_at?: unknown })
        .streak_freezes_earned_at;
      const rawFreezeUsed = (data as { streak_freezes_used_history?: unknown })
        .streak_freezes_used_history;
      setFreezeLedger(
        readFreezeLedger({ earnedAt: rawFreezeEarned, usedHistory: rawFreezeUsed }),
      );
      const rawBudget = Number(
        (data as { streak_freeze_budget_max?: number }).streak_freeze_budget_max,
      );
      setFreezeBudgetMax(Number.isFinite(rawBudget) ? Math.max(0, Math.min(10, rawBudget)) : 3);
      const rawLastSeen = (data as { weekly_recap_last_seen_week_key?: string | null })
        .weekly_recap_last_seen_week_key;
      setRecapLastSeenWeekKey(typeof rawLastSeen === "string" ? rawLastSeen : null);

      // Compute TDEE values
      const sex = ((data as any).sex as Sex) ?? "unspecified";
      const heightCm = Number((data as any).height_cm) || 170;
      const age = Number((data as any).age) || 30;
      // Default to "sedentary" (1.2) when missing — "moderate" (1.55) silently
      // over-inflated TDEE by ~14% for users who never picked a level
      // (TestFlight `AIIm60nKi_sTu3-4YjR-WR4`, 2026-04-18).
      const actLevel = ((data as any).activity_level as ActivityLevel) ?? "sedentary";
      const wForTdee = Number.isFinite(w) ? w! : 70;
      const sTdee = calculateTDEE(sex, wForTdee, heightCm, age, actLevel);
      setStaticTdee(sTdee);
      const aTdee = (data as any).adaptive_tdee != null ? Number((data as any).adaptive_tdee) : null;
      setAdaptiveTdee(Number.isFinite(aTdee) ? aTdee : null);
      const aConf = ((data as any).adaptive_tdee_confidence as string) ?? null;
      setAdaptiveConfidence(aConf);
      setAdaptiveUpdatedAt(((data as any).adaptive_tdee_updated_at as string | null) ?? null);
      setProfileSexCached(sex);
      setProfileHeightCmCached(heightCm);
      setProfileAgeCached(age);
      setProfileActivityLevelCached(actLevel);
      const eff = getEffectiveTDEE({
        adaptive_tdee: aTdee,
        adaptive_tdee_confidence: aConf,
        sex, weight_kg: wForTdee, height_cm: heightCm, age, activity_level: actLevel,
      });
      setIsAdaptive(eff.isAdaptive);
    }

    // H-4 (build 12, 2026-04-19, TestFlight `AEb7NcjnvK`): unblock
    // first paint here. `daily_targets` was previously awaited in
    // series with the profile read — that turned `loading` into a
    // `profile + daily_targets` RTT, past the 1s budget on warm
    // loads. Mirrors the mobile fix in
    // `apps/mobile/app/(tabs)/progress.tsx` so web and mobile unblock
    // first paint at the same point. `buildWeekStats` inherits the
    // current `targets` wherever the snapshot map has no entry, so
    // initial numbers are correct; a past-day bar colour may briefly
    // reflect the current plan and flip once snapshots arrive (only
    // if the user edited their plan mid-week).
    setLoading(false);

    // F-2 — fetch `daily_targets` for this week's 7 day keys so past
    // days don't move when the user later edits their plan. Days with
    // no snapshot (pre-migration) keep `null` in the map and the UI
    // falls back to the current profile target.
    {
      const wsdResolved = String((data as { week_start_day?: string } | null)?.week_start_day ?? "").toLowerCase() === "sunday" ? "sunday" : "monday";
      const nowD = new Date();
      const dow = nowD.getDay();
      const startOffset = wsdResolved === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
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
      void getDailyTargets(supabase, authedUserId, weekKeys)
        .then((snapshots) => {
          setDailyTargetsByDay(snapshots);
        })
        .catch(() => {
          /* fallback already in place (empty map → current targets). */
        });
    }
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

  const todaySteps = stepsByDay[todayKey()] ?? 0;

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
    const tk = todayKey();
    const nextMap = { ...weightKgByDay, [tk]: kg };
    setWeightKgByDay(nextMap);
    setWeightKg(kg);
    setWeightInput("");
    await persistProfilePatch({ weight_kg: kg, weight_kg_by_day: nextMap });
  }, [weightInput, profileMeasurementSystem, weightKgByDay, persistProfilePatch]);

  const saveTodaySteps = useCallback(async () => {
    const v = Math.round(Number.parseFloat(stepsInput.replace(",", ".")));
    if (!Number.isFinite(v) || v < 0) return;
    const tk = todayKey();
    const nextMap = { ...stepsByDay, [tk]: v };
    setStepsByDay(nextMap);
    setStepsInput("");
    await persistProfilePatch({ steps_by_day: nextMap });
  }, [stepsInput, stepsByDay, persistProfilePatch]);

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

  const formatRatePerWeek = (rateKgPerWeek: number) => {
    const v = Math.abs(rateKgPerWeek);
    if (profileMeasurementSystem === "imperial") {
      const lb = kgToLb(v);
      return `${Math.round(lb * 10) / 10} lb/week`;
    }
    return `${Math.round(v * 100) / 100} kg/week`;
  };

  const targets = normalizeMacroTargets(nutritionTargets);
  // F-2 — shape snapshots into `DayTargetOverride` for `buildWeekStats`.
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
  const weekStatsBundle = useMemo(
    () => buildWeekStats(nutritionByDay, targets, weekStartDay, new Date(), weekTargetsByDay),
    [nutritionByDay, targets, weekStartDay, weekTargetsByDay],
  );

  // F-2 — each row carries its own target so the "over/under" colour
  // on the bar chart reflects the frozen target for the day.
  // Action 5 Item 2 (2026-04-19) — preserve `key` so the chart can dim
  // *today's* bar (matched on `dateKey === todayKey()`) rather than
  // hard-coding the last index. For Monday-start users on Wednesday the
  // last index is Sunday (a future day) — dimming index 6 was wrong.
  const dailyCaloriesData = weekStatsBundle.days.map((d) => ({
    key: d.key,
    day: d.label,
    calories: Math.round(d.calories),
    target: d.targetCalories,
    // Action 13 Item #11 (2026-04-19) — surface whether this day's
    // target is a real `daily_targets` snapshot or the current-target
    // fallback. The chart uses this to add a subtle striped border on
    // approximate days so the user can tell the bar's colour decision
    // wasn't necessarily made against the target they had at the time.
    isSnapshot: d.isSnapshot,
  }));
  const todayDateKey = todayKey();
  const proteinAdherence = weekStatsBundle.proteinAdherence;
  const carbsAdherence = weekStatsBundle.carbsAdherence;
  const fatAdherence = weekStatsBundle.fatAdherence;

  const avgCalories = weekStatsBundle.avgCalories;
  const proteinOnTarget = weekStatsBundle.proteinOnTarget;
  // Action 5 Item 3 (2026-04-19) — explicit denominator on partial weeks
  // (e.g. "Avg on logged days (2/7)") so the headline number isn't
  // misread as "average per day this week". Shared helper keeps web +
  // mobile copy identical.
  const avgCaloriesTileLabel = formatAvgCaloriesLabel(weekStatsBundle.daysWithFood);
  // Raw streak — `streak_freeze` only augments this; we never hide the
  // raw value from callers that need it.
  const rawStreakDays = computeLoggingStreak(nutritionByDay);
  const protectedStreakInfo = useMemo(
    () => computeProtectedStreak(nutritionByDay as any, freezeLedger, freezeBudgetMax),
    [nutritionByDay, freezeLedger, freezeBudgetMax],
  );
  const streakDays = protectedStreakInfo.streakLength;
  const freezesAvailable = useMemo(
    () => availableFreezes(freezeLedger, freezeBudgetMax),
    [freezeLedger, freezeBudgetMax],
  );

  // Action 5 Item 7 (2026-04-19) — resolved maintenance for the recap
  // card's adaptive-vs-formula one-liner. Computed at the host level
  // (not inside the WeeklyRecapCard) so we can pass it as a plain prop;
  // the card stays presentational and the resolver stays a pure call.
  const recapMaintenance = useMemo(
    () =>
      resolveMaintenance({
        adaptive_tdee: adaptiveTdee,
        adaptive_tdee_confidence: adaptiveConfidence,
        adaptive_tdee_updated_at: adaptiveUpdatedAt,
        sex: profileSexCached,
        weight_kg: weightKg ?? 70,
        height_cm: profileHeightCmCached,
        age: profileAgeCached,
        activity_level: profileActivityLevelCached,
      }),
    [
      adaptiveTdee,
      adaptiveConfidence,
      adaptiveUpdatedAt,
      profileSexCached,
      weightKg,
      profileHeightCmCached,
      profileAgeCached,
      profileActivityLevelCached,
    ],
  );

  // Batch 4.11 — build recap for the *previous* week and gate visibility.
  const currentWeekKey = useMemo(
    () => weekKeyFor(new Date(), weekStartDay),
    [weekStartDay],
  );
  const recap = useMemo(
    () =>
      buildWeeklyRecap({
        byDay: nutritionByDay,
        weightKgByDay,
        targets,
        weekStartDay,
        ledger: freezeLedger,
        budgetMax: freezeBudgetMax,
      }),
    [nutritionByDay, weightKgByDay, targets, weekStartDay, freezeLedger, freezeBudgetMax],
  );
  const recapVisible = useMemo(
    () =>
      shouldShowRecap(recapLastSeenWeekKey, currentWeekKey, new Date(), weekStartDay) &&
      recap.daysLogged > 0,
    [recapLastSeenWeekKey, currentWeekKey, weekStartDay, recap.daysLogged],
  );

  // Ship M1 — usual-meal growth-loop line on the recap card. Pull the
  // user's saved meals once and match them against the last 7 days of
  // journal history to count re-logs. Journal rows don't carry a
  // `savedMealId` today; instead we match on normalised title + round
  // kcal (same key used in the Quick Add "same item" detector).
  const [hostSavedMealsForRecap, setHostSavedMealsForRecap] = useState<SavedMeal[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!authedUserId) {
      setHostSavedMealsForRecap([]);
      return;
    }
    listSavedMeals(supabase, authedUserId)
      .then((rows) => {
        if (!cancelled) setHostSavedMealsForRecap(rows);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("ProgressDashboard listSavedMeals (recap) failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [authedUserId]);

  const usualMealInsight: UsualMealRecapInsight = useMemo(() => {
    if (!recapVisible) return null;

    // Rebuild the week's date keys the recap covers. `buildWeeklyRecap`
    // uses the previous-week anchor — replicate by subtracting 7 days
    // and asking `weekKeyFor` → cleaner to just derive inline.
    const prevAnchor = new Date();
    prevAnchor.setDate(prevAnchor.getDate() - 7);
    // Derive the 7 keys by walking from Monday-start / Sunday-start of
    // the prev-week anchor. We use the same rule `buildWeekStats` uses,
    // inlined here rather than refactoring the shared helper.
    const d = new Date(prevAnchor);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay();
    const offset = weekStartDay === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
    d.setDate(d.getDate() + offset);
    const weekKeys: string[] = [];
    for (let i = 0; i < 7; i++) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      weekKeys.push(`${y}-${m}-${day}`);
      d.setDate(d.getDate() + 1);
    }

    // Build per-saved-meal log count. A saved meal is "logged" if at
    // least one of its items appeared in the journal for that day.
    // Count distinct days it was re-logged across the window.
    const logCountBySavedMealId: Record<string, number> = {};
    for (const sm of hostSavedMealsForRecap) {
      const itemKeys = new Set<string>();
      for (const it of sm.items) {
        itemKeys.add(`${normaliseRecipeTitle(it.recipeTitle)}|${Math.round(it.calories)}`);
      }
      let dayMatches = 0;
      for (const dayKey of weekKeys) {
        const meals = nutritionByDay[dayKey] ?? [];
        const dayKeys = new Set<string>();
        for (const m of meals) {
          dayKeys.add(
            `${normaliseRecipeTitle(m.recipeTitle ?? "")}|${Math.round(m.calories)}`,
          );
        }
        // A day counts if every item in the saved meal is present in
        // that day's log (a tight match — stops single-item overlaps
        // from triggering the count). Empty saved meals never match.
        if (itemKeys.size > 0 && [...itemKeys].every((k) => dayKeys.has(k))) {
          dayMatches += 1;
        }
      }
      logCountBySavedMealId[sm.id] = dayMatches;
    }

    // Action 5 Item 8 (2026-04-19) — extend the gate to a 14-day window
    // so the loosened "user has saved meals but not in the most-repeated
    // unsaved slot" check has enough history to fire. Walks back 7
    // additional days from the start of the recap window.
    const extendedWeekKeys: string[] = [...weekKeys];
    const earliest = new Date(weekKeys[0]);
    for (let i = 1; i <= 7; i++) {
      const back = new Date(earliest);
      back.setDate(earliest.getDate() - i);
      const y = back.getFullYear();
      const m = String(back.getMonth() + 1).padStart(2, "0");
      const day = String(back.getDate()).padStart(2, "0");
      extendedWeekKeys.unshift(`${y}-${m}-${day}`);
    }

    return buildUsualMealRecapInsight({
      byDay: nutritionByDay,
      weekKeys,
      savedMeals: hostSavedMealsForRecap,
      logCountBySavedMealId,
      extendedWeekKeys,
    });
  }, [recapVisible, hostSavedMealsForRecap, nutritionByDay, weekStartDay]);

  // Fire the `weekly_recap_shown` event once per visible week.
  const recapShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!recapVisible) return;
    if (recapShownRef.current === recap.weekKey) return;
    recapShownRef.current = recap.weekKey;
    track(AnalyticsEvents.weekly_recap_shown, { weekKey: recap.weekKey });
  }, [recapVisible, recap.weekKey]);

  const dismissRecap = useCallback(async () => {
    setRecapLastSeenWeekKey(currentWeekKey);
    if (!authedUserId) return;
    await supabase
      .from("profiles")
      .update({ weekly_recap_last_seen_week_key: currentWeekKey } as never)
      .eq("id", authedUserId);
  }, [authedUserId, currentWeekKey]);

  const openMetric = useCallback(
    (m: ProgressMetric) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("view", "progress");
      p.set("metric", m);
      router.replace(`/?${p.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const closeMetric = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("metric");
    router.replace(`/?${p.toString()}`, { scroll: false });
  }, [router, searchParams]);

  if (!authedUserId) {
    return (
      <div className="max-w-2xl mx-auto px-pm-5 py-pm-5 text-muted-foreground">
        Sign in to track progress.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-pm-5 py-pm-5 text-muted-foreground">Loading progress…</div>
    );
  }

  if (metricParam) {
    return <ProgressMetricDetail metric={metricParam} weekStartDay={weekStartDay} onClose={closeMetric} />;
  }

  const goalWeightChart = goalWeightKg != null
    ? profileMeasurementSystem === "imperial" ? Math.round(kgToLb(goalWeightKg) * 10) / 10 : Math.round(goalWeightKg * 10) / 10
    : undefined;

  return (
    <div className="max-w-2xl mx-auto px-pm-5 py-pm-5">
      {/* HEADER */}
      <div className="mb-4">
        <h1 className="text-[22px] font-bold text-foreground mb-1">Progress</h1>
        <p className="text-sm text-muted-foreground">Weekly report</p>
      </div>

      {/* WEEKLY RECAP CARD (Batch 4.11) — surfaces at end of week and stays
          visible for the first few days of the new week until dismissed. */}
      {recapVisible ? (
        <WeeklyRecapCard
          recap={recap}
          onDismiss={dismissRecap}
          usualMealInsight={usualMealInsight}
          maintenance={recapMaintenance}
          // Post-ship #4 (2026-04-18) — deep-link the prompt CTA to the
          // `SaveMealDialog` on Today, pre-seeded with the user's most-
          // frequent items from their history. `byDay` lets the card
          // run the shared `selectMostFrequentSlotSeed` helper; when it
          // returns a seed, `onOpenSaveCombo` stashes `{slot, items}` in
          // sessionStorage and routes to Today — `NutritionTracker`
          // hydrates on mount and opens the dialog. When the helper
          // returns null (rare — user logged ≥5 days but items don't
          // cluster), we fall back to the legacy route-to-Today path.
          byDay={nutritionByDay}
          onOpenSaveCombo={(slot, items) => {
            const serialized = serializePendingUsualMealSave(slot, items);
            if (serialized && typeof window !== "undefined") {
              try {
                window.sessionStorage.setItem(PENDING_USUAL_MEAL_SAVE_KEY, serialized);
              } catch {
                /* sessionStorage can throw in private modes — ignore. */
              }
            }
            router.replace("/?view=today");
          }}
          onStartUsualMealSave={() => {
            // Fallback path — helper returned null, so just route to Today;
            // the slot-header save row is still reachable manually.
            router.replace("/?view=today");
          }}
        />
      ) : null}

      {/* 2x2 STAT GRID */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <button
          type="button"
          onClick={() => openMetric("calories")}
          className="rounded-xl bg-card border border-border p-3 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <IconBox size="sm" tone="warning"><Icons.calories /></IconBox>
            <span
              className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
              data-testid="progress-avg-calories-label"
            >
              {avgCaloriesTileLabel}
            </span>
          </div>
          <p className="text-[22px] font-bold text-warning tabular-nums mb-0.5">{avgCalories}</p>
          <p className="text-[11px] text-muted-foreground">vs {targets.calories.toLocaleString()} target</p>
        </button>
        <button
          type="button"
          onClick={() => openMetric("protein")}
          className="rounded-xl bg-card border border-border p-3 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <IconBox size="sm" tone="success"><Icons.check /></IconBox>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Protein Hit</span>
          </div>
          <p className="text-[22px] font-bold text-success tabular-nums mb-0.5">{proteinOnTarget}/7</p>
          <p className="text-[11px] text-muted-foreground">days on target</p>
        </button>
        <button
          type="button"
          onClick={() => openMetric("streak")}
          className="rounded-xl bg-card border border-border p-3 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <IconBox size="sm" tone="success"><Icons.trophy /></IconBox>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Streak</span>
          </div>
          <p className="text-[22px] font-bold text-success tabular-nums mb-0.5">{streakDays} days</p>
          <p className="text-[11px] text-muted-foreground">
            logging streak{freezesAvailable > 0 ? (
              <span className="inline-flex items-center gap-1 ml-1">
                <Icons.streakFreeze className="h-3 w-3 text-primary" aria-hidden />
                <span className="text-primary font-semibold">{freezesAvailable}</span>
              </span>
            ) : null}
          </p>
        </button>
        <div className="rounded-xl bg-card border border-border p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <IconBox size="sm" tone="primary"><Icons.progress /></IconBox>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Trend</span>
          </div>
          {/* Action 13 Item #2 (2026-04-19) — single shared
              `computeWeightTrendCopy` helper drives both the headline
              delta and the on-track copy so they can't diverge. The
              earlier two-IIFE version evaluated `weightKg ?? Infinity`
              and `weightKg ?? 0` independently, which trivially flagged
              a "gain" user with no logged weight as "on track"
              (Infinity > 0). Helper returns `{ delta: null, copy: "Log
              weight to see trend" }` when we don't have ≥2 weigh-ins. */}
          {(() => {
            const trend = computeWeightTrendCopy({
              weightKgByDay,
              weightKg,
              goalKg: goalWeightKg,
            });
            const headline = trend.delta == null
              ? "—"
              : (() => {
                  const abs = Math.abs(trend.delta);
                  const val = profileMeasurementSystem === "imperial"
                    ? Math.round(kgToLb(abs) * 10) / 10
                    : Math.round(abs * 10) / 10;
                  const unit = profileMeasurementSystem === "imperial" ? "lb" : "kg";
                  const sign = trend.delta < 0 ? "−" : trend.delta > 0 ? "+" : "";
                  return `${sign}${val} ${unit}`;
                })();
            return (
              <>
                <p
                  className="text-[22px] font-bold text-primary tabular-nums mb-0.5"
                  data-testid="progress-trend-headline"
                >
                  {headline}
                </p>
                <p
                  className="text-[11px] text-muted-foreground"
                  data-testid="progress-trend-copy"
                >
                  {trend.copy}
                </p>
              </>
            );
          })()}
        </div>
      </div>

      {/* STREAK FREEZES (Batch 4.11) — visible when the user can earn or has
          freezes, or has consumed any. Hidden entirely when budget = 0. */}
      {freezeBudgetMax > 0 ? (
        <div className="rounded-xl bg-card border border-border p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <IconBox size="sm" tone="primary"><Icons.streakFreeze /></IconBox>
            <p className="text-sm font-semibold text-foreground">Streak freezes</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Freezes cover one empty day each so a sick or travel day doesn&apos;t break your streak. You earn one every 7-day streak, up to a cap of {freezeBudgetMax}.
          </p>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <FreezeStat label="Available" value={String(freezesAvailable)} />
            <FreezeStat label="Earned" value={String(freezeLedger.earnedAt.length)} />
            <FreezeStat label="Used" value={String(freezeLedger.usedHistory.length)} />
          </div>
          {protectedStreakInfo.protectedDateKeys.length > 0 ? (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                Recent freezes used
              </p>
              <ul className="space-y-1">
                {protectedStreakInfo.protectedDateKeys.slice(0, 3).map((k) => (
                  <li key={k} className="text-xs text-muted-foreground tabular-nums">
                    Freeze used ({formatFreezeDate(k)})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {rawStreakDays !== streakDays ? (
            <p className="text-[11px] text-muted-foreground mt-2">
              Raw streak (without freezes): {rawStreakDays} day{rawStreakDays === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* DAILY CALORIES CHART
          Action 13 Item #5 (2026-04-19) — denominator scales to the
          largest day so over-target bars visually tower above target
          bars. Previous code hard-capped at `targets.calories * 1.15`,
          which made a 200%-of-target day clip identically to a 115%
          day. Mirrors mobile's `Math.max(targets.calories,
          ...weekStats.days.map(...))` rule.
          Action 13 Item #11 — past days that fall back to today's
          target (no `daily_targets` snapshot) render with a small
          striped border + tooltip so the user knows the bar's
          colour decision is approximate. */}
      <div className="rounded-xl bg-card border border-border p-4 mb-6">
        <p className="text-sm font-semibold text-foreground mb-3">Daily Calories</p>
        <div className="flex items-end gap-2" style={{ height: 90 }}>
          {(() => {
            const maxCal = Math.max(
              targets.calories,
              ...dailyCaloriesData.map((dd) => dd.calories),
              1,
            );
            return dailyCaloriesData.map((d) => {
              const overTarget = d.calories > d.target;
              const barH = (d.calories / maxCal) * 70;
              // Action 5 Item 2 — match by date key. Mirror of mobile's
              // `isDayToday = d.key === todayKey` rule in
              // `apps/mobile/app/(tabs)/progress.tsx`. Future days in
              // the week (e.g. Sunday for a Wednesday user) render at
              // the 0.75 baseline; only today renders dimmed.
              const isDayToday = d.key === todayDateKey;
              // Item #11 — past days without a target snapshot render
              // with a dashed outline. Today and future days are
              // skipped (no historical-target ambiguity for those).
              const isPast = d.key < todayDateKey;
              const showApproxCue = isPast && !d.isSnapshot && d.calories > 0;
              return (
                <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-muted-foreground tabular-nums">
                    {d.calories >= 1000 ? `${(d.calories / 1000).toFixed(1)}k` : d.calories}
                  </span>
                  <div
                    className="w-full rounded-md"
                    data-testid={`progress-day-bar-${d.key}`}
                    data-today={isDayToday ? "true" : "false"}
                    data-approx={showApproxCue ? "true" : "false"}
                    title={showApproxCue ? "Compared against today's target (no snapshot for that day)" : undefined}
                    style={{
                      height: barH,
                      background: overTarget ? "var(--warning)" : "var(--success)",
                      opacity: isDayToday ? 0.4 : 0.75,
                      ...(showApproxCue
                        ? {
                            border: "1px dashed var(--muted-foreground)",
                            outlineOffset: -1,
                          }
                        : {}),
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground font-medium">{d.day}</span>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* MACRO ADHERENCE — Action 13 Item #4 (2026-04-19): bar fill is
          now capped at 150% via the shared `formatMacroAdherenceBar`
          helper so a user at 200% protein renders as a 150%-wide bar
          with the literal figure preserved in the label
          ("200% (capped at 150)"). Mobile mirrors this via the same
          helper. */}
      <div className="rounded-xl bg-card border border-border p-4 mb-6">
        <p className="text-sm font-semibold text-foreground mb-3">Macro Adherence</p>
        <div className="space-y-2">
          {([
            ["Protein", proteinAdherence, "var(--macro-protein)"],
            ["Carbs", carbsAdherence, "var(--macro-carbs)"],
            ["Fat", fatAdherence, "var(--macro-fat)"],
          ] as const).map(([name, pct, color]) => {
            const bar = formatMacroAdherenceBar({ adherencePct: pct });
            return (
              <div key={name} className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
                <span className="text-xs text-muted-foreground w-12">{name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    data-testid={`macro-adherence-bar-${name.toLowerCase()}`}
                    style={{ width: `${bar.barFillPct}%`, background: color }}
                  />
                </div>
                <span
                  className="text-xs font-semibold tabular-nums text-right"
                  style={{ color, minWidth: "5rem" }}
                  data-testid={`macro-adherence-label-${name.toLowerCase()}`}
                >
                  {bar.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* WEEKLY INSIGHT — removed (Action 5 Item 1, 2026-04-19).
          The card restated numbers already on screen above (avg calories,
          protein on target). Replacement is being scoped by
          `ui-product-designer` as a card-grammar-conformant component;
          re-introduce when the new spec lands. The empty-week
          "Get started" hint also lives here, but the empty-state copy
          on the dashboard surrounding cards already covers that case. */}

      {/* MAINTENANCE CARD — F-3 (2026-04-19, TestFlight
          `ADFYpDgEEb0QH-j3BXshPTo`). Was "Your TDEE"; value + label now
          read from the shared `resolveMaintenance` helper so Today's
          Activity Bonus tile and this card can't disagree. Adaptive
          badge, confidence bars, formula estimate subline, and the
          "+N actual" delta are preserved so power users can still see
          the underlying spread. */}
      {staticTdee != null && (() => {
        const resolved = resolveMaintenance({
          adaptive_tdee: adaptiveTdee,
          adaptive_tdee_confidence: adaptiveConfidence,
          adaptive_tdee_updated_at: adaptiveUpdatedAt,
          sex: profileSexCached,
          weight_kg: weightKg ?? 70,
          height_cm: profileHeightCmCached,
          age: profileAgeCached,
          activity_level: profileActivityLevelCached,
        });
        if (!resolved) return null;
        const showAdaptiveExtras = resolved.source === "adaptive";
        return (
        <div className="rounded-xl bg-card border border-border p-4 mb-6 mt-6" data-testid="progress-maintenance-card">
          <div className="flex items-center gap-2 mb-3">
            <IconBox size="sm" tone="primary"><Icons.calories /></IconBox>
            <p className="text-sm font-semibold text-foreground">Maintenance</p>
            {showAdaptiveExtras ? (
              <span
                data-testid="maintenance-source-pill"
                data-source="adaptive"
                className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/10 text-success"
              >
                Adaptive
              </span>
            ) : (
              /* Action 13 Item #14 (2026-04-19) — explicit "Formula
                 estimate" pill when the resolver fell back to the
                 formula. Previously only the "Adaptive" pill rendered
                 and formula-fallback users saw a bare number with no
                 source label, while the "Confidence: low" badge (when
                 it was rendered conditionally on `adaptiveConfidence`)
                 implied the displayed kcal was the low-confidence
                 adaptive value — when in fact it was the formula. The
                 confidence bar block below stays gated on
                 `showAdaptiveExtras`, so it still hides for formula. */
              <span
                data-testid="maintenance-source-pill"
                data-source="formula"
                className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
              >
                Formula estimate
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <p className={`text-[32px] font-bold tabular-nums ${showAdaptiveExtras ? "text-success" : "text-foreground"}`}>
              {resolved.kcal.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">kcal/day</p>
          </div>

          {showAdaptiveExtras && resolved.formulaKcal != null && (
            <p className="text-xs text-muted-foreground mb-2">
              Formula estimate: {resolved.formulaKcal.toLocaleString()} kcal
              {Math.abs(resolved.kcal - resolved.formulaKcal) >= 50 && (
                <span className="font-semibold text-foreground">
                  {" "}({resolved.kcal > resolved.formulaKcal ? "+" : ""}{resolved.kcal - resolved.formulaKcal} actual)
                </span>
              )}
            </p>
          )}

          {/* Confidence indicator — only meaningful when adaptive won. */}
          {showAdaptiveExtras && adaptiveConfidence && (
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
            {showAdaptiveExtras ? (
              <>
                Maintenance is the calories you&apos;d burn in a normal day. Based on your actual intake and weight changes ({adaptiveConfidence ?? "medium"} confidence).
                {adaptiveTdee && staticTdee && Math.abs(adaptiveTdee - staticTdee) >= 50 && (
                  <> Your real expenditure is <strong className="text-foreground">{Math.abs(adaptiveTdee - staticTdee)} kcal {adaptiveTdee > staticTdee ? "higher" : "lower"}</strong> than the formula predicted.</>
                )}
              </>
            ) : (
              <>
                Maintenance is the calories you&apos;d burn in a normal day. Formula estimate from your stats and activity level. Log meals and weigh in regularly to unlock an adaptive value that adjusts to your real burn.
                {(() => {
                  const weightDays = Object.keys(weightKgByDay).length;
                  if (weightDays < 3) return <> You need at least 3 weigh-ins and 7 days of food logging to get started.</>;
                  return <> Keep logging — your adaptive maintenance will activate once enough data accumulates.</>;
                })()}
              </>
            )}
          </p>

          {/* G-4 (2026-04-19, TestFlight `ALcwMFPjfmJvyBLjs4CRt1k`) —
              "How this works" expandable. Shows the chain from BMR →
              Maintenance → Calorie goal → projected weekly loss so the
              user can see how every number in the app is derived. No
              new DB reads; numbers come from the same state the card
              already uses. */}
          {(() => {
            const chain = buildMaintenanceChain(
              {
                sex: profileSexCached,
                weight_kg: weightKg ?? 70,
                height_cm: profileHeightCmCached,
                age: profileAgeCached,
                activity_level: profileActivityLevelCached,
              },
              resolved,
              planPace,
              userGoal,
            );
            if (!chain) return null;
            return (
              <div className="mt-3 pt-3 border-t border-border" data-testid="maintenance-explainer">
                <button
                  type="button"
                  onClick={() => setMaintenanceExplainerOpen((v) => !v)}
                  aria-expanded={maintenanceExplainerOpen}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <span>{maintenanceExplainerOpen ? "Hide" : "How this works"}</span>
                  <span aria-hidden="true" className="text-[10px]">
                    {maintenanceExplainerOpen ? "▴" : "▾"}
                  </span>
                </button>
                {maintenanceExplainerOpen && (
                  <dl className="mt-3 space-y-1.5">
                    {chain.steps.map((step, i) => (
                      <div
                        key={`${step.kind}-${i}`}
                        className="flex items-baseline justify-between gap-3 text-xs"
                      >
                        <dt
                          className={
                            step.kind === "summary" || step.kind === "weeklyLoss"
                              ? "text-muted-foreground leading-snug"
                              : step.emphasis
                              ? "font-semibold text-foreground"
                              : "text-foreground"
                          }
                        >
                          {step.label}
                        </dt>
                        {step.value && (
                          <dd
                            className={`tabular-nums ${step.emphasis ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                          >
                            {step.value}
                          </dd>
                        )}
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            );
          })()}

          {/* Data progress for non-adaptive users */}
          {!showAdaptiveExtras && (
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
        );
      })()}

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
        // F-4a (2026-04-19, TestFlight `AHEeeC9a4-lKIyW5n7HgJxs`): use
        // the canonical `(start - current) / (start - goal)` formula
        // via the shared helper. `start` is the earliest recorded
        // weight in the user's log, falling back to the current weight
        // when there's no history. Replaces the previous
        // "|cur-goal|-remaining / |cur-goal|" approximation + 3% floor
        // so `start === current` renders a truly empty bar + "Just
        // starting" copy.
        const sortedDays = Object.entries(weightKgByDay).sort(([a], [b]) => a.localeCompare(b));
        const startKg = sortedDays.length > 0 ? sortedDays[0][1] : weightKg;
        const pctFrac = computeWeightJourneyProgressPct({
          startKg,
          currentKg: weightKg,
          goalKg: goalWeightKg,
        });
        const progressPct = pctFrac != null ? pctFrac * 100 : 0;
        const progressCopy = formatWeightJourneyProgressCopy(pctFrac);
        // Recent 7-day average calories
        const recentKeys = Object.keys(nutritionByDay).sort().slice(-7);
        const daysWithFood = recentKeys.filter((k) => (nutritionByDay[k] ?? []).length > 0);
        const avgRecentCals = daysWithFood.length > 0
          ? Math.round(daysWithFood.reduce((s, k) => s + (nutritionByDay[k] ?? []).reduce((a, m) => a + m.calories, 0), 0) / daysWithFood.length)
          : 0;
        // Prefer the user's real TDEE (adaptive when available, else static Mifflin) as
        // the break-even number, so the projection respects actual burn and doesn't
        // flag a genuine deficit as a gain. See TestFlight `ALkK-XrcMz_V-D6NrjuVYbo`.
        const maintenanceTdeeKcal = isAdaptive && adaptiveTdee != null ? adaptiveTdee : staticTdee;
        // Action 13 Item #8 (2026-04-19) — gate the projection on
        // `shouldRenderDailyProjection(daysWithFood.length)`. Below the
        // 5-day floor the recent average is too noisy to honestly
        // project from (a 2-day average can be 700 kcal off the
        // long-term mean). The block is suppressed entirely below the
        // floor — we don't backfill with placeholder copy.
        const projectionEligible = shouldRenderDailyProjection(daysWithFood.length);
        const dailyProjection = projectionEligible && avgRecentCals > 0
          ? projectWeight({
              currentWeightKg: weightKg,
              todayCalories: avgRecentCals,
              targetCalories: targets.calories,
              maintenanceTdeeKcal,
              goal: userGoal,
            })
          : null;

        return (
          <div className="rounded-xl bg-card border border-border p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <IconBox size="sm" tone="success"><Icons.check /></IconBox>
                <p className="text-sm font-semibold text-foreground">Journey</p>
              </div>
              {timeline.daysToGoal != null ? (
                <p className="text-right">
                  <span className="text-[22px] font-bold text-primary tabular-nums">{timeline.daysToGoal}</span>
                  <span className="text-xs text-muted-foreground ml-1">days to goal</span>
                </p>
              ) : timeline.cappedAtMaxDays ? (
                /* Action 13 Item #15 (2026-04-19) — past the 365-day
                   cap we render an honest "more than 1 year" copy
                   instead of an empty headline. The rate is surfaced
                   below the bar so the user can do their own math. */
                <p className="text-right" data-testid="progress-journey-capped">
                  <span className="text-xs font-semibold text-muted-foreground">More than 1 year at current rate</span>
                </p>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              {timeline.remainingKg > 0.1
                ? `${formatWeight(timeline.remainingKg)} to go until your ${formatWeight(goalWeightKg)} goal.`
                : "You\u2019ve reached your goal weight."}
              {timeline.weeklyRateKg !== 0 &&
                ` Trending ${timeline.trendDirection} at ${formatRatePerWeek(timeline.weeklyRateKg)}.`}
            </p>

            {/* Progress bar — width follows the real percentage (no
                min-3% floor) so `start === current` renders a truly
                empty bar + "Just starting" copy instead of a tiny
                sliver that looked like a broken 3% reading
                (TestFlight `AHEeeC9a4-lKIyW5n7HgJxs`). */}
            <div className="flex items-center gap-2 mb-1" data-testid="progress-journey-bar">
              <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">{formatWeight(weightKg)}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: progressPct >= 100 ? "var(--success)" : "var(--primary)",
                  }}
                />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">{formatWeight(goalWeightKg)}</span>
            </div>
            {progressCopy && (
              <p className="text-[11px] text-muted-foreground text-center mt-1" data-testid="progress-journey-copy">
                {progressCopy}
              </p>
            )}

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
            <p className="text-[22px] font-bold text-foreground tabular-nums">{(stepsByDay[todayKey()] ?? 0).toLocaleString()}</p>
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

export function ProgressDashboard() {
  return (
    <Suspense
      fallback={<div className="max-w-2xl mx-auto px-pm-5 py-pm-5 text-muted-foreground">Loading progress…</div>}
    >
      <ProgressDashboardContent />
    </Suspense>
  );
}
