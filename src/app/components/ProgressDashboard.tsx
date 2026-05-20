"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
import { kgToLb, calculateTDEE, getEffectiveTDEE, type PlanPace, type Sex, type ActivityLevel } from "../../lib/nutrition/tdee.ts";
import { calcGoalTimeline, computeWeightJourneyProgressPct, formatWeightJourneyProgressCopy, projectWeight, resolveLatestWeightKg, shouldRenderDailyProjection } from "../../lib/weightProjection.ts";
import { resolveMaintenance } from "../../lib/nutrition/resolveMaintenance.ts";
import { buildMaintenanceChain } from "../../lib/nutrition/maintenanceChain.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { normalizeMacroTargets, DEFAULT_STEPS_GOAL } from "../../types/profile.ts";
import { computeLoggingStreak } from "../../lib/nutrition/trackerStats.ts";
import { todayKey } from "../../lib/nutrition/trackerDate.ts";
import { buildWeekStats, formatAvgCaloriesLabel, formatMacroAdherenceBar } from "../../lib/nutrition/progressWeekReport.ts";
import {
  buildCaloriesRangeStats,
  buildWeightRangeStats,
  type RangeKey,
} from "../../lib/nutrition/progressRangeStats.ts";
import { computeWeightTrendCopy } from "../../lib/nutrition/weightTrendTile.ts";
import {
  computeWeightTrend,
  weightKgByDayToPoints,
  type WeightRange,
} from "../../lib/progress/weightTrend.ts";
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
import { listSavedMeals, type SavedMeal, type SavedMealItem } from "../../lib/nutrition/savedMeals.ts";
import { normaliseRecipeTitle } from "../../lib/nutrition/usualMealHint.ts";
import {
  PENDING_USUAL_MEAL_SAVE_KEY,
  serializePendingUsualMealSave,
} from "../../lib/nutrition/pendingUsualMealSave.ts";
import { Digest } from "./suppr/digest.tsx";
import { resolveDigestHeadline } from "../../lib/nutrition/digest.ts";
import { formatRecapForShare } from "../../lib/nutrition/weeklyRecap.ts";
import {
  formatMaintenanceRecapLine,
} from "../../lib/nutrition/resolveMaintenance.ts";
import { buildWeeklyCheckin } from "../../lib/nutrition/weeklyCheckin.ts";
import { selectMostFrequentSlotSeed } from "../../lib/nutrition/usualMealHint.ts";
import { ProgressMetricDetail, type ProgressMetric } from "./ProgressMetricDetail.tsx";
// HouseholdBar — 2026-04-20 Claude Design prototype port. Rendered at
// the top of Progress (mirrors `screens-mobile.jsx` L580) when the
// user is in a household. Hidden for solo users so the range-picker
// pills stay flush against the header.
import { HouseholdBar } from "./HouseholdBar.tsx";
import { ProgressTabChrome } from "./suppr/progress-tab-chrome.tsx";
import { ProgressHeroMetric } from "./suppr/progress-hero-metric.tsx";
// Phase 4 (B3.1, 2026-04-27) — Surface E "Progress hero (story-led)".
// Authority: D-2026-04-27-17 (Progress is a story not a stat-card
// dashboard) + D-2026-04-27-12 (adaptive TDEE always-on).
import { ProgressHeadline } from "./suppr/progress-headline.tsx";
import { ProgressStoryGate } from "./suppr/progress-story-gate.tsx";
import { hasEnoughDataForStory } from "../../lib/nutrition/progressStoryGate.ts";
import { DigestStoryCard } from "./suppr/digest-story-card.tsx";
import { computeDayOfWeekPattern } from "../../lib/nutrition/dayOfWeekPattern.ts";
import { generateProgressCommentary } from "../../lib/nutrition/progressCommentary.ts";
import { useMilestone30DayOnProgress } from "../../hooks/useMilestone30DayOnProgress.ts";
import { Milestone30DayDialog } from "./suppr/milestone-30-day-dialog.tsx";

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
  const {
    profileMeasurementSystem,
    nutritionByDay,
    nutritionTargets,
    profileWeightSurfaceMode,
  } = useAppData();

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
  // Weekly Check-in (MacroFactor parity, 2026-04-30) — TDEE recorded
  // at the start of the previous week. Sourced from `daily_targets`
  // snapshots so we don't need a parallel storage layer; falls back
  // to `null` when the snapshot wasn't captured yet (first week).
  const [previousWeekTdeeKcal, setPreviousWeekTdeeKcal] = useState<number | null>(null);
  // Numbers audit 2026-05-04 #9 — full prev-week snapshot map for recap.
  const [previousWeekDailyTargetsByDay, setPreviousWeekDailyTargetsByDay] = useState<
    Record<string, DailyTarget | null>
  >({});
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
  // 2026-04-20 Claude Design prototype port — range picker pills.
  // Prior shape was `1W / 1M / 3M / 6M / All`, default `3M`, with no
  // UI to switch. Mirrors the mobile ProgressScreen prototype
  // (`[7d, 30d, 90d, All]` chips) so the two surfaces speak the same
  // ranges. Default `30d` matches mobile. Downstream `rangeDays`
  // arithmetic is preserved (still drives the weight + steps chart
  // windows); All remains ~infinite (26+ years).
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const rangeLabel = range === "7d" ? "LAST 7 DAYS" : range === "30d" ? "LAST 30 DAYS" : range === "90d" ? "LAST 90 DAYS" : "ALL TIME";
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
  const [milestone30ShownAt, setMilestone30ShownAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authedUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // Skeleton-gate fix (2026-04-20, Claude Design prototype port):
    // the prior shape had no try/catch around the supabase fetch. A
    // thrown network error mid-call would exit this function before
    // `setLoading(false)` ran, leaving the "Loading progress…" text
    // pinned indefinitely. Wrap the whole path in try/finally so the
    // loading flag ALWAYS flips once, even on the sad path, and the
    // post-load tree falls through to the existing empty / populated
    // states. The explicit `setLoading(false)` that gates the H-4
    // first-paint order (before the `daily_targets` background fetch)
    // is preserved in the happy path; `finally` acts as a backstop.
    try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "weight_kg, goal_weight_kg, plan_pace, weight_kg_by_day, steps_by_day, daily_steps_goal, body_fat_pct, goal, sex, height_cm, age, activity_level, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, week_start_day, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history, weekly_recap_last_seen_week_key, milestone_30_shown_at",
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
      const rawMilestone = (data as { milestone_30_shown_at?: unknown }).milestone_30_shown_at;
      setMilestone30ShownAt(typeof rawMilestone === "string" ? rawMilestone : null);

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

      // Weekly Check-in (MacroFactor parity, 2026-04-30) — read the
      // *previous* week's snapshot so the Digest can show "TDEE moved
      // from X → Y". We pull the FIRST day of the previous week
      // (most reliable signal: that's the maintenance value on file
      // when last week opened). Falls back gracefully to null when no
      // snapshot exists, which lands the Digest on `first_week`.
      const prevWeekFirst = new Date(weekFirst);
      prevWeekFirst.setDate(weekFirst.getDate() - 7);
      const prevWeekKeys: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(prevWeekFirst);
        d.setDate(prevWeekFirst.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        prevWeekKeys.push(`${y}-${m}-${day}`);
      }
      void getDailyTargets(supabase, authedUserId, prevWeekKeys)
        .then((snapshots) => {
          // Numbers audit 2026-05-04 #9: cache the prev-week snapshots
          // so `buildWeeklyRecap` can score each day against the target
          // that was active that day, not the user's *current* target.
          // Without this, a mid-week target edit produced one adherence
          // value on the recap card and a different one on Progress.
          setPreviousWeekDailyTargetsByDay(snapshots);
          // Walk the prev-week keys in order; the first non-null
          // `maintenanceTdee` we find is the baseline.
          for (const k of prevWeekKeys) {
            const snap = snapshots[k];
            if (snap?.maintenanceTdee != null && snap.maintenanceTdee > 0) {
              setPreviousWeekTdeeKcal(snap.maintenanceTdee);
              return;
            }
          }
          setPreviousWeekTdeeKcal(null);
        })
        .catch(() => {
          setPreviousWeekTdeeKcal(null);
          setPreviousWeekDailyTargetsByDay({});
        });
    }
    } catch (err) {
      // Skeleton-gate fix (2026-04-20): surface failures so we still
      // flip `loading` → false. User sees the "hasData = false" empty
      // state rather than a pinned "Loading progress…" line.
      console.error("[progress] load threw", err);
    } finally {
      setLoading(false);
    }
  }, [authedUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Numbers audit 2026-05-04 #15: route through shared `resolveLatestWeightKg`
  // helper so behaviour stays in lockstep if the resolver evolves (e.g. to
  // filter zero-valued days). Inline implementation was functionally
  // equivalent but invisible to refactors.
  const latestWeightKg = useMemo(
    () => resolveLatestWeightKg(weightKgByDay, weightKg ?? null),
    [weightKgByDay, weightKg],
  );

  // Numbers audit 2026-05-04 #2: headline ETA was computing
  // `weeksToGoal(currentKg, goalKg, planPace)` — a *prescriptive* rate
  // from the pace preset (e.g. "steady" → 0.5 kg/wk). Every other goal-date
  // surface (mobile Targets, mobile Progress, web Targets, the deeper
  // projection card on this same page at line ~1730) uses
  // `calcGoalTimeline`, which derives the rate from actual `weight_kg_by_day`
  // entries. Result: a user losing faster than prescribed saw an *earlier*
  // ETA on mobile vs a *later* prescriptive ETA on web — and two ETAs on
  // this same web page once the deeper card rendered. Now both call sites
  // route through the same observed-rate helper.
  const goalTimeline = useMemo(() => {
    if (latestWeightKg == null || goalWeightKg == null) return null;
    return calcGoalTimeline({
      currentWeightKg: latestWeightKg,
      goalWeightKg,
      weightKgByDay,
    });
  }, [latestWeightKg, goalWeightKg, weightKgByDay]);

  const goalDateLabel = useMemo(() => {
    if (!goalTimeline || goalTimeline.daysToGoal == null) return null;
    if (goalTimeline.daysToGoal <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + goalTimeline.daysToGoal);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }, [goalTimeline]);

  const rangeDays = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 9999;

  // 2026-05-06 audit (D2): web parity for the mobile weight chart
  // rewrite (PRs #106 + #107). Use the shared `computeWeightTrend`
  // so web gets the same MFP-style bucket aggregation, calendar-day
  // moving-average, same-day dedup, smart bucket fallback, and
  // iterative min/max as mobile.
  const weightTrendRange: WeightRange =
    range === "7d" ? "1w" : range === "30d" ? "1m" : range === "90d" ? "3m" : "all";
  const weightTrend = useMemo(
    () =>
      computeWeightTrend(
        weightKgByDayToPoints(weightKgByDay),
        weightTrendRange,
        goalWeightKg ?? null,
      ),
    [weightKgByDay, weightTrendRange, goalWeightKg],
  );

  const weightChartData = useMemo(() => {
    const isImperial = profileMeasurementSystem === "imperial";
    const conv = (kg: number) =>
      isImperial ? Math.round(kgToLb(kg) * 10) / 10 : Math.round(kg * 10) / 10;
    // 2026-05-13 (Withings parity): expose `isToday` per point so the
    // chart can render a "you are here" vertical indicator. Match by
    // the underlying ISO date (the rendered label is bucket-aware so
    // matching on `date` is unsafe).
    const tk = todayKey();
    return weightTrend.points.map((p, i) => {
      // 2026-05-06: bucket-aware date label.
      // daily   → "MM-DD" (matches the previous behaviour)
      // weekly  → "DD MMM" (week-anchor date)
      // monthly → "MMM" (month name)
      const d = new Date(p.dateISO + "T12:00:00");
      const date =
        weightTrend.bucket === "monthly"
          ? d.toLocaleDateString("en-GB", { month: "short" })
          : weightTrend.bucket === "weekly"
            ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            : p.dateISO.slice(5);
      const ma = weightTrend.movingAvg[i];
      return {
        date,
        value: conv(p.kg),
        // Smoothed MA — null entries left as undefined so Recharts
        // skips them rather than drawing a flatline at zero.
        ma: ma != null ? conv(ma) : undefined,
        isToday: p.dateISO === tk,
      };
    });
  }, [weightTrend, profileMeasurementSystem]);

  // Hide raw dots on bucketed views — each point is an aggregate,
  // not a single weigh-in, so dots would mislead. MFP / Cronometer
  // do the same.
  const showRawDots = weightTrend.bucket === "daily";

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

  // 2026-04-20 Phase 2 prototype — WEIGHT + Calories range cards read
  // from these shared helpers so mobile + web can't drift. Range feed
  // comes from the `range` state set by the range-picker pills.
  const weightRange = useMemo(
    () => buildWeightRangeStats(weightKgByDay, range as RangeKey, new Date()),
    [weightKgByDay, range],
  );
  const caloriesRange = useMemo(
    () => buildCaloriesRangeStats(nutritionByDay, nutritionTargets.calories, range as RangeKey, new Date()),
    [nutritionByDay, nutritionTargets.calories, range],
  );

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
  // Numbers audit 2026-05-04 #9 — shape prev-week snapshots into the
  // override map `buildWeekStats` consumes. Without this the recap
  // judged past days against the user's *current* target, while
  // Progress judged them against the per-day snapshot — same week,
  // different "% adherence".
  const prevWeekTargetsByDay = useMemo(() => {
    const out: Record<
      string,
      { targetCalories: number | null; targetProtein: number | null; targetCarbs: number | null; targetFat: number | null } | null
    > = {};
    for (const [k, v] of Object.entries(previousWeekDailyTargetsByDay)) {
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
  }, [previousWeekDailyTargetsByDay]);

  const recap = useMemo(
    () =>
      buildWeeklyRecap({
        byDay: nutritionByDay,
        weightKgByDay,
        targets,
        weekStartDay,
        ledger: freezeLedger,
        budgetMax: freezeBudgetMax,
        dayTargetOverrides: prevWeekTargetsByDay,
      }),
    [nutritionByDay, weightKgByDay, targets, weekStartDay, freezeLedger, freezeBudgetMax, prevWeekTargetsByDay],
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

  // `weekly_recap_shown` fires inside <Digest/> on mount; the host no
  // longer tracks it (single source of truth).

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
      router.replace(`/home?${p.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const closeMetric = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("metric");
    router.replace(`/home?${p.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const milestone30 = useMilestone30DayOnProgress({
    active: !loading && !metricParam && Boolean(authedUserId),
    authedUserId,
    nutritionByDay: nutritionByDay as never,
    weightKgByDay,
    milestone30ShownAt,
    onShownAtPersisted: setMilestone30ShownAt,
  });

  const progressCalendarButton = (
    <button
      type="button"
      data-testid="progress-calendar-button"
      aria-label="Open calendar"
      onClick={() => router.replace("/home?view=weight-tracker")}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted/40 transition-colors"
    >
      <Icons.calendar className="h-4 w-4" aria-hidden />
    </button>
  );

  const progressDesktopHeader = (
    <div className="hidden md:flex mb-6 items-start justify-between gap-3">
      <div>
        <p
          data-testid="progress-overline"
          className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
        >
          {rangeLabel}
        </p>
        <h1
          data-testid="progress-header"
          className="text-[28px] font-bold text-foreground tracking-tight mt-0.5"
        >
          Progress
        </h1>
      </div>
      {progressCalendarButton}
    </div>
  );

  if (!authedUserId) {
    return (
      <div className="max-w-2xl mx-auto px-pm-6 py-pm-6 text-muted-foreground">
        Sign in to track progress.
      </div>
    );
  }

  if (loading) {
    // 2026-04-20 prototype port: the pinned "Loading progress…" line
    // looked broken when supabase was slow. Now we paint the real
    // header chrome (overline + title + calendar button) + a
    // disabled-look range picker + a 2x2 skeleton grid so the user
    // sees the screen is alive and laying out. When `loading` flips
    // the existing post-load tree mounts without a layout jump.
    const progressLoadingCalendar = (
      <span
        aria-hidden
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card opacity-60"
      >
        <Icons.calendar className="h-4 w-4 text-muted-foreground" />
      </span>
    );

    return (
      <>
        <ProgressTabChrome overline={rangeLabel} trailing={progressLoadingCalendar} />
      <div
        className="max-w-2xl mx-auto px-pm-6 py-pm-6"
        data-testid="progress-loading-skeleton"
      >
        {progressDesktopHeader}
        <div className="flex gap-2 mb-5 p-1 rounded-[10px] bg-muted opacity-60">
          {(["7d", "30d", "90d", "all"] as const).map((k) => (
            <span
              key={k}
              className={[
                "flex-1 rounded-[7px] px-3 py-1.5 text-[12px] font-semibold text-center",
                k === range ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              ].join(" ")}
            >
              {k === "all" ? "All" : k}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              data-testid={`progress-skeleton-tile-${i}`}
              className="rounded-xl bg-card border border-border p-3 min-h-[86px]"
            >
              <div className="h-3 w-16 rounded bg-border mb-2" />
              <div className="h-5 w-20 rounded bg-border mb-1.5" />
              <div className="h-3 w-24 rounded bg-border" />
            </div>
          ))}
        </div>
      </div>
      </>
    );
  }

  if (metricParam) {
    return <ProgressMetricDetail metric={metricParam} weekStartDay={weekStartDay} onClose={closeMetric} />;
  }

  const goalWeightChart = goalWeightKg != null
    ? profileMeasurementSystem === "imperial" ? Math.round(kgToLb(goalWeightKg) * 10) / 10 : Math.round(goalWeightKg * 10) / 10
    : undefined;

  return (
    <>
      <ProgressTabChrome overline={rangeLabel} trailing={progressCalendarButton} />
    <div className="max-w-2xl mx-auto px-pm-6 py-pm-6">
      {progressDesktopHeader}

      {/* HouseholdBar — 2026-04-20 prototype port. Appears immediately
          under the header on Progress (mirrors mobile Plan/Progress
          + web Plan). Renders nothing for solo users. */}
      <HouseholdBar />

      {/* Phase 4 / B3.1 — Progress story headline (Surface E).
          Engine-led commentary line replacing the stat-card dashboard
          as the visual focus. The maintenance card / charts / stat
          cards beneath remain (demoted) — this card is the lead.
          Authority: D-2026-04-27-12 (always-on TDEE) +
          D-2026-04-27-17 (Progress is a story).

          Note on prevWeekTdee: the weekly TDEE history isn't yet
          persisted, so the commentary collapses to `steady` /
          `calibrating` for now. When `progress_weekly_tdee_history`
          (a future migration) lands, pass the prior-week value here
          and the `adjustment` regime auto-engages.

          Note on avgIntakeOnLossWeeksKcal: similarly deferred until
          the weekly aggregate stream is in place. */}
      {/* customer-lens audit (2026-04-30): the live story renders even
          when `adaptiveTdee == null` and the user has < 3 days of
          logging — narrative based on null is broken UX. Gate via
          `hasEnoughDataForStory(daysLogged)` and render the
          `<ProgressStoryGate>` placeholder card until the floor is
          reached. Geometry matches so the slot doesn't jump. */}
      {/* ENG-616: Oura-style hero metric — one big number at the top. */}
      <ProgressHeroMetric
        adherencePct={caloriesRange.adherencePct}
        avgCaloriesPerDay={caloriesRange.avgCaloriesPerDay}
        targetCalories={nutritionTargets.calories}
        daysLogged={caloriesRange.daysLogged}
        streak={streakDays}
      />

      {(() => {
        const daysLogged = weekStatsBundle.daysWithFood;
        if (!hasEnoughDataForStory(daysLogged)) {
          return (
            <div className="mb-4">
              <ProgressStoryGate daysLogged={daysLogged} />
            </div>
          );
        }
        const commentary = generateProgressCommentary({
          current:
            adaptiveTdee != null && adaptiveConfidence != null
              ? {
                  tdee: adaptiveTdee,
                  confidence:
                    adaptiveConfidence === "high" ||
                    adaptiveConfidence === "medium" ||
                    adaptiveConfidence === "low"
                      ? adaptiveConfidence
                      : "low",
                  loggingDays: Object.keys(nutritionByDay ?? {}).length,
                  weighInCount: Object.keys(weightKgByDay ?? {}).length,
                  avgDailyIntake: 0,
                  smoothedWeightChangeKgPerDay: 0,
                  windowDays: 28,
                }
              : null,
          loggingDays: daysLogged,
        });
        return (
          <div className="mb-4">
            <ProgressHeadline commentary={commentary} />
          </div>
        );
      })()}

      {/* RANGE-PICKER SEGMENTED CONTROL — [7d, 30d, 90d, All].
          2026-04-21 D5 port of prototype `screens-mobile.jsx:581-591`.
          Single muted container with an inset `bg-card` chip + subtle
          shadow marking the active range (replaces the earlier
          accent-filled outlined pills). Tapping updates the selected
          range and the header overline; it feeds `rangeDays` used by
          the weight + steps chart windows below. */}
      <div
        role="tablist"
        aria-label="Progress time range"
        data-testid="progress-range-picker"
        className="flex gap-1.5 mb-4 p-1 rounded-[10px] bg-muted"
      >
        {(["7d", "30d", "90d", "all"] as const).map((k) => {
          const active = range === k;
          const label = k === "all" ? "All" : k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`Range ${label}`}
              data-testid={`progress-range-pill-${k}`}
              onClick={() => setRange(k)}
              className={[
                "flex-1 rounded-[7px] px-3 py-1.5 text-[12px] font-semibold transition-colors",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── 2026-04-20 Prototype Phase 2 cards ──
          Sit directly under the range picker so the two hero cards are
          the first thing a user sees. Every legacy card (recap, freeze,
          maintenance, journey, daily-calories, macro adherence) stays
          intact below. Shared helper output → web + mobile numbers are
          identical. Household bar sits elsewhere (another agent owns
          it).

          2026-04-20 desktop prototype port
          (`docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
          `WebProgress`): at `md+` the Phase 2 cards lay out as a 2×2
          grid (Weight / Calories / Protein / Trend summary). Below
          `md` they stack vertically — mobile-web parity with the
          existing mobile tab layout. The Protein avg/day + Trend
          summary cards only exist on desktop today; the narrow view
          still has Protein Hit / Streak tiles in the legacy 2×2
          (kept intact for parity) so we don't need mobile duplicates. */}
      <div
        data-testid="progress-phase2-grid"
        className="md:grid md:grid-cols-2 md:gap-3"
      >
        {/*
          T13.2 (full-sweep follow-up, 2026-04-25): honour
          profileWeightSurfaceMode on Progress — release-gate C1
          gate for cohort expand. "hide" suppresses the card; "trends_only"
          renders the lightweight WeightTrendOnlyCard with a direction
          label (no absolute kg). "show" keeps the legacy behaviour.
          Helper: decideWeightSurface in src/lib/nutrition/weightSurfaceMode.ts.
        */}
        {/* 2026-05-11 (Grace TF feedback — "this is duplicative"): the
            full `<WeightRangeCardWeb>` ("show" mode) was rendering a
            second weight surface above the big Weight chart card lower
            on this dashboard — same data, smaller chart, same
            time-range scope. Killed in show mode for parity with the
            mobile change. The body-neutral `trends_only` mode keeps
            its lightweight tile because that's intentionally not the
            big chart; users opt into trends-only to hide absolute
            numbers. */}
        {profileWeightSurfaceMode === "trends_only" && (
          <WeightTrendOnlyCardWeb
            weekDeltaKg={weightRange.weekDeltaKg}
            rangeKey={range as RangeKey}
          />
        )}
        <CaloriesRangeCardWeb
          avgCaloriesPerDay={caloriesRange.avgCaloriesPerDay}
          deltaVsTargetKcal={caloriesRange.deltaVsTargetKcal}
          adherencePct={caloriesRange.adherencePct}
          daysLogged={caloriesRange.daysLogged}
          targetCalories={nutritionTargets.calories}
        />
        {/* Desktop-only: Protein avg/day + Trend summary. These mirror
            the right-hand column of the prototype's 2×2 grid. Values
            are pulled from the already-computed `weekStatsBundle`
            (shared helper output) so mobile/web numbers can't drift. */}
        <ProteinRangeCardWeb
          avgProteinPerDay={Math.round(weekStatsBundle.avgProtein ?? 0)}
          targetProteinG={targets.protein}
          series={weekStatsBundle.days.map((d) => Math.round(d.protein))}
        />
        <TrendSummaryCardWeb
          daysHitCalorieTarget={(() => {
            // "Hit calorie target" = within ±10% of day's target
            // calories (whichever target the week bundle resolved —
            // snapshot or fallback). Matches the band used by the
            // daily calories chart.
            let n = 0;
            for (const d of weekStatsBundle.days) {
              if (d.targetCalories <= 0) continue;
              const pct = Math.abs(d.calories - d.targetCalories) / d.targetCalories;
              if (pct <= 0.1 && d.calories > 0) n += 1;
            }
            return n;
          })()}
          totalDaysInWindow={weekStatsBundle.days.length}
          daysHitProteinTarget={weekStatsBundle.proteinOnTarget}
          weighInsThisWeek={weekStatsBundle.days.filter((d) => (weightKgByDay[d.key] ?? 0) > 0).length}
          goalWeightKg={goalWeightKg}
          goalDateLabel={goalDateLabel}
          measurementSystem={profileMeasurementSystem}
        />
      </div>

      {/* WEEK DIGEST (D3) — replaces the legacy WeeklyRecapCard. Host
          computes headline + flattens usual-meal insight into the
          shared `DigestProps` shape so web + mobile cannot drift. See
          `docs/design/digest-primitive.md`. */}
      {recapVisible ? (() => {
        const digestSeed = (() => {
          if (usualMealInsight?.kind !== "prompt") return null;
          const seed = selectMostFrequentSlotSeed(nutritionByDay, usualMealInsight.suggestedSlot);
          if (!seed || seed.seedItems.length < 2) return null;
          return seed;
        })();
        const digestSeedItems = digestSeed
          ? digestSeed.seedItems.map((it) => {
              const row: Omit<SavedMealItem, "id" | "position"> = {
                recipeTitle: it.recipeTitle,
                calories: it.calories,
                protein: it.protein,
                carbs: it.carbs,
                fat: it.fat,
                portionMultiplier: 1,
              };
              if (it.fiber != null) row.fiber = it.fiber;
              if (it.source) row.source = it.source;
              return row;
            })
          : undefined;
        const usualMeal: import("./suppr/digest").DigestUsualMeal | null =
          usualMealInsight?.kind === "celebration"
            ? { kind: "celebration", name: usualMealInsight.name, count: usualMealInsight.count }
            : usualMealInsight?.kind === "prompt"
              ? {
                  kind: "prompt",
                  suggestedSlot: digestSeed?.slot ?? usualMealInsight.suggestedSlot,
                  ...(usualMealInsight.repeats != null ? { repeats: usualMealInsight.repeats } : {}),
                  ...(digestSeedItems ? { seedItems: digestSeedItems } : {}),
                }
              : null;
        const closestToTarget = recap.bestDay
          ? {
              label: recap.bestDay.label,
              protein: recap.bestDay.protein,
              calories: recap.bestDay.calories,
            }
          : null;
        const maintenanceLine = formatMaintenanceRecapLine(recapMaintenance);
        const mealsLogged = Object.values(nutritionByDay).reduce(
          (total, day) => total + (Array.isArray(day) ? day.length : 0),
          0,
        );
        const headline = resolveDigestHeadline({
          weightDeltaKg: recap.weightDeltaKg,
          closestToTargetLabel: closestToTarget?.label ?? null,
          streakDays: recap.streakLength,
          daysLogged: recap.daysLogged,
        });
        const digestState: "success" | "empty" | "partial" =
          recap.daysLogged === 0 ? "empty" : recap.daysLogged < 4 ? "partial" : "success";

        // Weekly Check-in payload — MacroFactor parity (2026-04-30).
        // Inputs come from the existing recap + the prior-week TDEE
        // snapshot we fetch alongside `daily_targets`. We pass
        // `null` weight endpoints when the recap doesn't have ≥2
        // weigh-ins (the cascade handles the missing-weight branch).
        const currentTdeeForCheckin =
          adaptiveTdee != null && adaptiveTdee > 0 &&
          (adaptiveConfidence === "medium" || adaptiveConfidence === "high")
            ? adaptiveTdee
            : staticTdee;
        const weeklyIntakeKcal = recap.avgCalories * recap.daysLogged;
        const weighInsThisWeek = recap.weightDeltaKg != null ? 2 : 0; // ≥2 → has both endpoints
        // F-129 (Grace, 2026-05-07): pass engine confidence so the
        // weeklyCheckin gate can skip the weighInsThisWeek floor when
        // the engine already trusts the long-term TDEE — mirrors the
        // F-124 carve-out on the calibrating-card.
        const engineConfidenceForCheckin: "low" | "medium" | "high" | null =
          adaptiveConfidence === "low" ||
          adaptiveConfidence === "medium" ||
          adaptiveConfidence === "high"
            ? adaptiveConfidence
            : null;
        const weeklyCheckin = currentTdeeForCheckin
          ? buildWeeklyCheckin({
              previousTdeeKcal: previousWeekTdeeKcal,
              currentTdeeKcal: currentTdeeForCheckin,
              weeklyIntakeKcal,
              dailyTargetKcal: targets.calories,
              weightStartKg: recap.weightFirstKg,
              weightEndKg: recap.weightLastKg,
              weighInsThisWeek,
              daysLogged: recap.daysLogged,
              adaptiveTdeeConfidence: engineConfidenceForCheckin,
            })
          : null;
        return (
          <Digest
            weekKey={recap.weekKey}
            weekLabel={recap.weekLabel}
            daysLogged={recap.daysLogged}
            mealsLogged={mealsLogged}
            headline={headline}
            stats={{
              streakDays: recap.streakLength,
              streakFreezesAvailable: recap.freezesAvailable,
              avgCalories: recap.avgCalories,
              avgProtein: recap.avgProtein,
              proteinAdherencePct: recap.proteinAdherencePct > 0 ? recap.proteinAdherencePct : null,
              weightDeltaKg: recap.weightDeltaKg,
              weightFirstKg: recap.weightFirstKg,
              weightLastKg: recap.weightLastKg,
            }}
            narrative={{ closestToTarget, maintenanceLine, usualMeal, weeklyCheckin }}
            onAdjustGoalPace={() => {
              // Web routes to existing Settings → Targets surface;
              // we don't ship a parallel modal sheet on web.
              router.push("/settings#targets");
            }}
            shareText={formatRecapForShare(recap)}
            state={digestState}
            weightSurfaceMode={profileWeightSurfaceMode}
            onShare={() => { /* Digest handles share sheet + analytics */ }}
            onDismiss={dismissRecap}
            onOpenSaveCombo={(slot, items) => {
              const serialized = serializePendingUsualMealSave(slot, items);
              if (serialized && typeof window !== "undefined") {
                try {
                  window.sessionStorage.setItem(PENDING_USUAL_MEAL_SAVE_KEY, serialized);
                } catch {
                  /* sessionStorage can throw in private modes — ignore. */
                }
              }
              router.replace("/home?view=today");
            }}
            onStartUsualMealSave={() => {
              router.replace("/home?view=today");
            }}
          />
        );
      })() : null}

      {/* Week digest — narrative LEAD card. Replaces the 2x2 grid as
          the visual focus. customer-lens audit 2026-04-30 +
          D-2026-04-27-17.

          `dayOfWeekPattern` is the Lose It "Closer" parity slot
          (audit 2026-04-30). The helper enforces the 14-day +
          200-kcal-delta gates so the line never surfaces on noise. */}
      <div className="mb-4">
        <DigestStoryCard
          weekLabel={recap.weekLabel}
          daysLogged={weekStatsBundle.daysWithFood}
          avgCalories={weekStatsBundle.avgCalories}
          targetCalories={targets.calories}
          avgProtein={recap.avgProtein}
          targetProtein={targets.protein}
          proteinOnTargetDays={weekStatsBundle.proteinOnTarget}
          closestToTarget={recap.bestDay
            ? {
                label: recap.bestDay.label,
                calories: recap.bestDay.calories,
                protein: recap.bestDay.protein,
              }
            : null}
          dayOfWeekPattern={computeDayOfWeekPattern(nutritionByDay)}
        />
      </div>

      {/* DEMOTED stat chips (D-2026-04-27-17 — tiles demoted, not
          deleted). Was a 4-tile 2x2 grid that anchored the page; now
          a compact chip row of small KPIs that still link out to per-
          metric drill-downs. Smaller padding, subtler border, no
          tinted backgrounds — reads as a footer summary, not the
          lead. Trend is non-clickable on web (matches mobile). */}
      <div
        data-testid="progress-demoted-chips"
        className="grid grid-cols-2 gap-2 mb-6"
      >
        <button
          type="button"
          onClick={() => openMetric("calories")}
          data-testid="progress-demoted-chip-calories"
          className="rounded-lg border border-border bg-transparent px-3 py-2 text-left hover:bg-muted/30 transition-colors flex items-center gap-2"
        >
          <Icons.calories className="h-3.5 w-3.5 text-warning shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <p
              data-testid="progress-avg-calories-label"
              className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate"
            >
              {avgCaloriesTileLabel}
            </p>
            <p className="text-[13px] font-semibold tabular-nums text-foreground truncate">
              {avgCalories}
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                vs {targets.calories.toLocaleString()}
              </span>
            </p>
          </div>
          <Icons.forward className="h-3 w-3 text-muted-foreground/60 shrink-0" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => openMetric("protein")}
          data-testid="progress-demoted-chip-protein"
          className="rounded-lg border border-border bg-transparent px-3 py-2 text-left hover:bg-muted/30 transition-colors flex items-center gap-2"
        >
          <Icons.check className="h-3.5 w-3.5 text-success shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
              Protein Hit
            </p>
            <p className="text-[13px] font-semibold tabular-nums text-foreground truncate">
              {proteinOnTarget}/7
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                days on target
              </span>
            </p>
          </div>
          <Icons.forward className="h-3 w-3 text-muted-foreground/60 shrink-0" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => openMetric("streak")}
          data-testid="progress-demoted-chip-streak"
          className="rounded-lg border border-border bg-transparent px-3 py-2 text-left hover:bg-muted/30 transition-colors flex items-center gap-2"
        >
          <Icons.trophy className="h-3.5 w-3.5 text-success shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
              Streak
            </p>
            <p className="text-[13px] font-semibold tabular-nums text-foreground truncate">
              {streakDays} day{streakDays === 1 ? "" : "s"}
              {freezesAvailable > 0 ? (
                <span className="ml-1.5 text-[11px] font-normal text-primary">
                  · {freezesAvailable} freeze{freezesAvailable === 1 ? "" : "s"}
                </span>
              ) : null}
            </p>
          </div>
          <Icons.forward className="h-3 w-3 text-muted-foreground/60 shrink-0" aria-hidden />
        </button>
        <div
          data-testid="progress-demoted-chip-trend"
          className="rounded-lg border border-border bg-transparent px-3 py-2 flex items-center gap-2"
        >
          <Icons.progress className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
              Trend
            </p>
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
                <p
                  data-testid="progress-trend-headline"
                  className="text-[13px] font-semibold tabular-nums text-foreground truncate"
                >
                  {headline}
                  <span
                    data-testid="progress-trend-copy"
                    className="ml-1.5 text-[11px] font-normal text-muted-foreground"
                  >
                    {trend.copy}
                  </span>
                </p>
              );
            })()}
          </div>
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
        <div className="relative flex items-end gap-2" style={{ height: 90 }}>
          {/* Dashed target line — mirror of mobile chart. Pointer-events
              off so the bars stay clickable. */}
          {(() => {
            const maxCalForLine = Math.max(
              targets.calories,
              ...dailyCaloriesData.map((dd) => dd.calories),
              1,
            );
            if (targets.calories <= 0) return null;
            const lineY = (targets.calories / maxCalForLine) * 70;
            return (
              <div
                aria-hidden
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-primary/70"
                style={{ bottom: lineY }}
              />
            );
          })()}
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
              // Audit 2026-05-12 (premium-bar #16 — DC10): match the
              // calorie-ring 3-state rule — empty=border tint,
              // under=success green, over=destructive red. Web was
              // using `var(--warning)` (amber) for over which broke
              // parity with mobile and collapsed the over-budget signal
              // with the under-target state in dark mode.
              const bg = d.calories === 0
                ? "var(--border)"
                : overTarget
                  ? "var(--destructive)"
                  : "var(--success)";
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
                      background: bg,
                      opacity: isDayToday ? 1 : 0.75,
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
        {/* Legend — mirror of mobile progress.tsx. TestFlight feedback
            (2026-04-18 AISAWnLgU9cjRBOuEY-HuJU) "not intuitive"
            without a colour key. */}
        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "var(--success)" }} />
            At or under target
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "var(--destructive)" }} />
            Over target
          </span>
          {targets.calories > 0 ? (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-px border-t border-dashed border-primary" />
              Target {targets.calories.toLocaleString()} kcal
            </span>
          ) : null}
        </div>
      </div>

      {/* MACRO ADHERENCE — F-117 v2 (Grace, 2026-05-07): bar fill
          clamps to 100% via `formatMacroAdherenceBar`; over-target
          rows render the % in destructive (red) so the bar + label
          together communicate "over budget". The "(capped at 150)"
          parenthetical is gone. */}
      <div className="rounded-xl bg-card border border-border p-4 mb-6">
        <p className="text-sm font-semibold text-foreground mb-3">Macro Adherence</p>
        <div className="space-y-2">
          {([
            ["Protein", proteinAdherence, "var(--macro-protein)"],
            ["Carbs", carbsAdherence, "var(--macro-carbs)"],
            ["Fat", fatAdherence, "var(--macro-fat)"],
          ] as const).map(([name, pct, color]) => {
            const bar = formatMacroAdherenceBar({ adherencePct: pct });
            const tone = bar.isOver ? "var(--destructive)" : color;
            return (
              <div key={name} className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
                <span className="text-xs text-muted-foreground w-12">{name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    data-testid={`macro-adherence-bar-${name.toLowerCase()}`}
                    style={{ width: `${bar.barFillPct}%`, background: tone }}
                  />
                </div>
                <span
                  className="text-xs font-semibold tabular-nums text-right text-foreground"
                  style={{ minWidth: "3.5rem" }}
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
                className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success text-foreground"
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
              <span className="text-xs font-medium capitalize text-foreground">
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

      {/* WEIGHT TRACKING — T13.2 (full-sweep follow-up, 2026-04-25):
          gate the whole tracker section on profileWeightSurfaceMode.
          "hide" + "trends_only" suppress the absolute kg displays,
          the goal kg, and the weight-line chart. The trends-only
          card at the top of Progress (WeightTrendOnlyCardWeb) covers
          direction. Users who want to log a weight while in opt-out
          mode flip back to "show" in Settings — that's the explicit
          opt-in we want, not a secondary side-channel here. */}
      {profileWeightSurfaceMode === "show" ? (
      <div className="rounded-xl bg-card border border-border p-4 mb-6 mt-6">
        <p className="text-sm font-semibold text-foreground mb-3">Weight</p>
        {/* ENG-534 (2026-05-16): current + goal weight are HIGH-class
            body-stats. `ph-mask` makes PostHog session-replay render
            these as grey blocks. See
            `docs/operations/session-replay-masking-audit.md`. */}
        <div className="flex gap-6 mb-3">
          <div className="text-center">
            <p className="text-[22px] font-bold text-foreground tabular-nums ph-mask">{weightKg != null ? formatWeight(weightKg) : "—"}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Current</p>
          </div>
          <div className="text-center">
            <p className="text-[22px] font-bold text-success tabular-nums ph-mask">{goalWeightKg != null ? formatWeight(goalWeightKg) : "—"}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Goal</p>
          </div>
        </div>
        {weightChartData.length >= 2 && (
          <div className="mb-3">
            {/* 2026-05-13 (premium-bar audit web parity, Withings polish):
                hollow rings on data points (was filled r=2 dots) +
                vertical "today" indicator line + thicker smoothed
                trend line. Same Withings Health Mate parity that
                mobile got in dd043c3 + 7b0b9b6, ported to the
                Recharts surface so the web chart no longer reads
                as the cheap default. */}
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={weightChartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                {/*
                  2026-05-06 audit (D2): bucket-aware rendering.
                  Daily ranges keep the raw point line + dots.
                  Weekly / monthly ranges render only the smoothed
                  MA line — each `value` point IS an aggregate, so
                  dots would mislead.
                */}
                {showRawDots ? (
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--primary)"
                    strokeWidth={2.25}
                    dot={{
                      r: 3.5,
                      fill: "var(--card)",
                      stroke: "var(--primary)",
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 5,
                      fill: "var(--primary)",
                      stroke: "var(--card)",
                      strokeWidth: 2,
                    }}
                  />
                ) : (
                  <Line
                    type="monotone"
                    dataKey="ma"
                    stroke="var(--primary)"
                    strokeWidth={2.25}
                    dot={false}
                    connectNulls
                  />
                )}
                {goalWeightChart != null && (
                  <ReferenceLine
                    y={goalWeightChart}
                    stroke="var(--success)"
                    strokeDasharray="4 4"
                  />
                )}
                {/* 2026-05-13 — "today" vertical indicator. Same
                    Withings "you are here" marker mobile uses. Renders
                    when `weightChartData` contains a point whose
                    underlying ISO date matches today, identified by
                    the `isToday` flag on each point. */}
                {weightChartData.some((p) => p.isToday) ? (
                  <ReferenceLine
                    x={weightChartData.find((p) => p.isToday)?.date}
                    stroke="var(--foreground)"
                    strokeWidth={1}
                    strokeOpacity={0.3}
                  />
                ) : null}
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
          <button onClick={() => void saveTodayWeight()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">Save</button>
        </div>
        {/* DC12 (2026-05-14, premium-bar audit) — Headspace-style
            supportive moment-of-truth line. Mirrors the mobile
            LogWeightSheet / weight-tracker copy so the
            high-emotion weigh-in surface reads the same way on
            both platforms. */}
        <p
          data-testid="weight-input-supportive-copy"
          className="mt-1 text-center text-xs text-muted-foreground"
        >
          Every check-in gives us better data for you.
        </p>
      </div>
      ) : null}

      {/* JOURNEY / WEIGHT PROJECTION — also gated on profileWeightSurfaceMode
          (T13.2): the projection visualises absolute weight progression
          toward a goal kg, which is the exact thing trends_only / hide
          users opted out of. */}
      {profileWeightSurfaceMode === "show" && weightKg != null && goalWeightKg != null && goalWeightKg !== weightKg && (() => {
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
        // F-126 / F-113 web parity (2026-05-07): mirror the mobile
        // Progress fix from a117789. Mobile passes
        // `timeline.weeklyRateKg` so the projection respects the
        // observed scale rate when it's reliable; web was forecasting
        // from a stale TDEE estimate, which is exactly the
        // "Journey numbers are wrong" complaint (`AMg4BaMwZWZ8`).
        const observedKgPerWeek =
          typeof timeline.weeklyRateKg === "number"
            ? timeline.trendDirection === "losing"
              ? -Math.abs(timeline.weeklyRateKg)
              : timeline.trendDirection === "gaining"
                ? Math.abs(timeline.weeklyRateKg)
                : 0
            : 0;
        const dailyProjection = projectionEligible && avgRecentCals > 0
          ? projectWeight({
              currentWeightKg: weightKg,
              todayCalories: avgRecentCals,
              targetCalories: targets.calories,
              maintenanceTdeeKcal,
              goal: userGoal,
              observedKgPerWeek,
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
              {/* ENG-534 (2026-05-16): weight bookends on the progress
                  bar are HIGH-class. `ph-mask` makes replay render
                  them as grey blocks; the bar fill stays visible. */}
              <span className="text-[11px] font-semibold text-muted-foreground tabular-nums ph-mask">{formatWeight(weightKg)}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: progressPct >= 100 ? "var(--success)" : "var(--primary)",
                  }}
                />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground tabular-nums ph-mask">{formatWeight(goalWeightKg)}</span>
            </div>
            {progressCopy && (
              <p className="text-[11px] text-muted-foreground text-center mt-1" data-testid="progress-journey-copy">
                {progressCopy}
              </p>
            )}

            {/* Projection based on recent average.
                2026-05-12 (premium-bar DC12 voice audit, web parity with
                mobile progress.tsx): split past-fact from future-projection.
                Previously a single sentence read as past observation +
                future promise; now it's separated into two clauses,
                conditional. */}
            {dailyProjection && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Last 7 days averaged {avgRecentCals.toLocaleString()} kcal/day. On that trend you&apos;d reach{" "}
                  <span className="font-bold text-primary ph-mask">{formatWeight(dailyProjection.projectedWeightKg)}</span> in ~{dailyProjection.projectionWeeks} weeks.
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
          <button onClick={() => void saveTodaySteps()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">Save</button>
        </div>
      </div>

      {/* BODY FAT */}
      <div className="rounded-xl bg-card border border-border p-4">
        <p className="text-sm font-semibold text-foreground mb-3">Body Fat</p>
        {/* ENG-534 (2026-05-16): body-fat % is HIGH-class. `ph-mask`
            makes PostHog session-replay render this as a grey block. */}
        <p className="text-[28px] font-bold text-foreground tabular-nums mb-3 ph-mask">{bodyFatPct != null ? `${Math.round(bodyFatPct * 10) / 10}%` : "—"}</p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Body fat %"
            value={bodyFatInput}
            onChange={(e) => setBodyFatInput(e.target.value)}
            type="number"
            step="0.1"
          />
          <button onClick={() => void saveBodyFat()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">Save</button>
        </div>
      </div>
      <p
        data-testid="progress-nutrition-estimate-footer"
        className="mt-6 text-[11px] text-muted-foreground text-center leading-snug"
      >
        Nutrition data are estimates. Not medical or dietetic advice.
      </p>
    </div>
    <Milestone30DayDialog
      open={milestone30.open}
      content={milestone30.content}
      onDismiss={milestone30.dismiss}
    />
    </>
  );
}

/* ── 2026-04-20 Prototype Phase 2 cards ──────────────────────────── */

/**
 * Tiny inline SVG sparkline for the Weight card. We intentionally do
 * not reach for recharts here — this line doesn't need axes, tooltips,
 * or a resize observer. Pure component, deterministic output.
 */
function WeightSparkline({
  points,
  color,
  width,
  height,
}: {
  points: number[];
  color: string;
  width: number;
  height: number;
}) {
  if (points.length < 2) {
    return <svg width={width} height={height} aria-hidden />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const rangeSpan = max - min === 0 ? 1 : max - min;
  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = innerW / (points.length - 1);
  const xy = points.map((v, i) => {
    const x = pad + i * step;
    const y = pad + innerH - ((v - min) / rangeSpan) * innerH;
    return [x, y] as const;
  });
  const polyline = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = xy[xy.length - 1];
  return (
    <svg width={width} height={height} role="img" aria-label="Weight trend sparkline">
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </svg>
  );
}

/**
 * T13.2 (full-sweep follow-up, 2026-04-25): trends-only weight card
 * for users who chose `weight_surface_mode = "trends_only"`. Shows
 * a direction label ("Slightly down this week" / "Stable" / "Up") +
 * a window note. Never emits an absolute kg value — that's the whole
 * point of the opt-out. Mirrors the Digest's trends-only behaviour
 * (see decideWeightSurface in src/lib/nutrition/weightSurfaceMode.ts).
 */
function WeightTrendOnlyCardWeb({
  weekDeltaKg,
  rangeKey,
}: {
  weekDeltaKg: number | null;
  rangeKey: RangeKey;
}) {
  const direction =
    weekDeltaKg == null || !Number.isFinite(weekDeltaKg)
      ? null
      : Math.abs(weekDeltaKg) < 0.3
        ? "stable"
        : weekDeltaKg < 0
          ? "down"
          : "up";
  const arrow =
    direction === "up" ? "↑" : direction === "down" ? "↓" : direction === "stable" ? "→" : "—";
  const label =
    direction === "up"
      ? "Slightly up this week"
      : direction === "down"
        ? "Slightly down this week"
        : direction === "stable"
          ? "Stable this week"
          : "Log a weight to see your trend";
  const windowLabel =
    rangeKey === "7d"
      ? "last 7 days"
      : rangeKey === "30d"
        ? "last 30 days"
        : rangeKey === "90d"
          ? "last 90 days"
          : "all time";
  return (
    <div
      data-testid="progress-weight-trend-only-card"
      className="rounded-xl bg-card border border-border p-4 mb-4"
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Weight trend
      </p>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-[24px] font-bold text-foreground" aria-hidden>
          {arrow}
        </span>
        <span className="text-[15px] font-semibold text-foreground">{label}</span>
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Showing direction only · {windowLabel}. Switch to numbers in Settings if you want them back.
      </p>
    </div>
  );
}

function WeightRangeCardWeb({
  series,
  latestKg,
  weekDeltaKg,
  deltaKg,
  rangeKey,
  goalWeightKg,
  measurementSystem,
}: {
  series: { dateKey: string; kg: number }[];
  latestKg: number | null;
  weekDeltaKg: number | null;
  deltaKg: number | null;
  rangeKey: RangeKey;
  goalWeightKg: number | null;
  measurementSystem: "metric" | "imperial";
}) {
  const formatWeight = (kg: number, signed = false) => {
    const sign = signed ? (kg < 0 ? "−" : kg > 0 ? "+" : "") : "";
    const abs = Math.abs(kg);
    if (measurementSystem === "imperial") {
      const lb = kgToLb(abs);
      return `${sign}${Math.round(lb * 10) / 10} lb`;
    }
    return `${sign}${Math.round(abs * 10) / 10} kg`;
  };
  if (latestKg == null) {
    return (
      <div
        data-testid="progress-weight-range-card-empty"
        className="rounded-xl bg-card border border-border p-4 mb-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Weight</p>
        <p className="text-sm text-muted-foreground mt-2">
          Log a weight on the tracker to see your trend here.
        </p>
      </div>
    );
  }
  const weekDelta = weekDeltaKg ?? deltaKg;
  let onTrack = false;
  if (goalWeightKg != null && weekDelta != null) {
    onTrack =
      (goalWeightKg < latestKg && weekDelta < -0.05) ||
      (goalWeightKg > latestKg && weekDelta > 0.05);
  }
  const windowLabel =
    rangeKey === "7d" ? "last 7 days" : rangeKey === "30d" ? "last 30 days" : rangeKey === "90d" ? "last 90 days" : "all time";
  const weekDeltaDisplay =
    weekDelta != null && Math.abs(weekDelta) >= 0.05 ? formatWeight(weekDelta, true) : null;
  return (
    <div
      data-testid="progress-weight-range-card"
      className="rounded-xl bg-card border border-border p-4 mb-4"
    >
      <div className="flex items-start justify-between mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Weight</p>
        {onTrack ? (
          <span
            data-testid="progress-weight-on-track-pill"
            className="inline-flex items-center rounded-full bg-success/15 text-success text-[11px] font-semibold px-2 py-0.5"
          >
            On track
          </span>
        ) : null}
      </div>
      <p
        data-testid="progress-weight-range-value"
        className="text-[24px] font-bold text-foreground tabular-nums -tracking-[0.01em]"
      >
        {formatWeight(latestKg)}
      </p>
      {weekDeltaDisplay ? (
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          {weekDelta! < 0 ? (
            <Icons.trendDown className="w-3 h-3" aria-hidden />
          ) : (
            <Icons.trendUp className="w-3 h-3" aria-hidden />
          )}
          <span className="tabular-nums">{weekDeltaDisplay} this week</span>
        </p>
      ) : null}
      <div className="mt-2.5">
        <WeightSparkline
          points={series.map((p) => p.kg)}
          color="var(--primary)"
          width={280}
          height={48}
        />
      </div>
      <div className="flex justify-between mt-1">
        {series.length >= 2 ? (
          <>
            <span className="text-[10px] text-muted-foreground">{series[0].dateKey.slice(5)}</span>
            <span className="text-[10px] text-muted-foreground">{series[series.length - 1].dateKey.slice(5)}</span>
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground">Need at least 2 weigh-ins</span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
        Trend across the {windowLabel}. Projection appears in the Journey card below once you have enough data.
      </p>
    </div>
  );
}

function CaloriesRangeCardWeb({
  avgCaloriesPerDay,
  deltaVsTargetKcal,
  adherencePct,
  daysLogged,
  targetCalories,
}: {
  avgCaloriesPerDay: number | null;
  deltaVsTargetKcal: number | null;
  adherencePct: number | null;
  daysLogged: number;
  targetCalories: number;
}) {
  return (
    <div data-testid="progress-calories-range-wrapper" className="mb-4">
      {/* 17pt bold header OUTSIDE the card per prototype. */}
      <h2
        data-testid="progress-calories-range-header"
        className="text-[17px] font-bold text-foreground -tracking-[0.01em] mb-2"
      >
        Calories
      </h2>
      <div
        data-testid="progress-calories-range-card"
        className="rounded-xl bg-card border border-border p-4"
      >
        {avgCaloriesPerDay == null ? (
          <p className="text-sm text-muted-foreground">
            Log meals on Today to see your average calories for this range.
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <p
                data-testid="progress-calories-range-avg"
                className="text-[24px] font-bold text-foreground tabular-nums -tracking-[0.01em]"
              >
                {avgCaloriesPerDay.toLocaleString()}
                <span className="text-sm font-medium text-muted-foreground"> avg/day</span>
              </p>
              {deltaVsTargetKcal != null ? (
                <span
                  data-testid="progress-calories-range-delta-pill"
                  className={[
                    "shrink-0 inline-flex items-center rounded-full text-[11px] font-semibold px-2 py-0.5 tabular-nums",
                    deltaVsTargetKcal <= 0
                      ? "bg-success text-foreground"
                      : "bg-warning text-foreground",
                  ].join(" ")}
                >
                  {deltaVsTargetKcal > 0 ? "+" : "−"}
                  {Math.abs(deltaVsTargetKcal).toLocaleString()} vs target
                </span>
              ) : null}
            </div>
            <p
              data-testid="progress-calories-range-subtitle"
              className="text-xs text-muted-foreground mt-1.5 tabular-nums"
            >
              Target {targetCalories.toLocaleString()}
              {adherencePct != null ? ` · ${adherencePct}% avg` : ""}
              {daysLogged > 0 ? ` · ${daysLogged} logged day${daysLogged === 1 ? "" : "s"}` : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 2026-04-20 desktop prototype port
 * (`docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
 * `WebProgress` → Protein card): avg protein per day value + target
 * subtitle + 7-bar protein chart (reads directly from the week
 * bundle so mobile + web can't drift). Lighter-weight than the
 * Calories card — no delta pill — because protein adherence shows
 * up in the legacy macro adherence bar below and we don't want two
 * competing "% of target" readings on the same page.
 */
function ProteinRangeCardWeb({
  avgProteinPerDay,
  targetProteinG,
  series,
}: {
  avgProteinPerDay: number;
  targetProteinG: number;
  series: number[];
}) {
  const max = Math.max(1, targetProteinG, ...series);
  return (
    <div data-testid="progress-protein-range-wrapper" className="mb-4">
      <h2
        data-testid="progress-protein-range-header"
        className="text-[17px] font-bold text-foreground -tracking-[0.01em] mb-2"
      >
        Protein
      </h2>
      <div
        data-testid="progress-protein-range-card"
        className="rounded-xl bg-card border border-border p-4"
      >
        <p
          data-testid="progress-protein-range-avg"
          className="text-[24px] font-bold text-foreground tabular-nums -tracking-[0.01em]"
        >
          {avgProteinPerDay}
          <span className="text-sm font-medium text-muted-foreground"> g avg/day</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
          Target {targetProteinG} g
        </p>
        {series.length > 0 ? (
          <div className="mt-3 flex items-end gap-1" style={{ height: 70 }}>
            {series.map((p, i) => {
              const h = Math.max(2, Math.round((p / max) * 64));
              return (
                <div
                  key={`protein-bar-${i}`}
                  data-testid={`progress-protein-bar-${i}`}
                  className="flex-1 rounded-[3px]"
                  style={{
                    height: h,
                    background: "var(--macro-protein)",
                    opacity: i === series.length - 1 ? 1 : 0.7,
                  }}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * 2026-04-20 desktop prototype port — Trend summary card. Key/value
 * list reusing numbers the rest of the page already computed (week
 * bundle hit-counts + weigh-ins + goal date) so this card can't
 * disagree with the others above.
 */
function TrendSummaryCardWeb({
  daysHitCalorieTarget,
  totalDaysInWindow,
  daysHitProteinTarget,
  weighInsThisWeek,
  goalWeightKg,
  goalDateLabel,
  measurementSystem,
}: {
  daysHitCalorieTarget: number;
  totalDaysInWindow: number;
  daysHitProteinTarget: number;
  weighInsThisWeek: number;
  goalWeightKg: number | null;
  goalDateLabel: string | null;
  measurementSystem: "metric" | "imperial";
}) {
  const goalDisplay =
    goalWeightKg == null
      ? null
      : measurementSystem === "imperial"
        ? `${Math.round(kgToLb(goalWeightKg) * 10) / 10} lb`
        : `${Math.round(goalWeightKg * 10) / 10} kg`;
  return (
    <div data-testid="progress-trend-summary-wrapper" className="mb-4">
      <h2
        data-testid="progress-trend-summary-header"
        className="text-[17px] font-bold text-foreground -tracking-[0.01em] mb-2"
      >
        Trend summary
      </h2>
      <div
        data-testid="progress-trend-summary-card"
        className="rounded-xl bg-card border border-border p-4"
      >
        <dl className="flex flex-col gap-2.5 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Days hit calorie target</dt>
            <dd className="font-bold text-foreground tabular-nums">
              {daysHitCalorieTarget} of {totalDaysInWindow}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Days hit protein target</dt>
            <dd className="font-bold text-foreground tabular-nums">
              {daysHitProteinTarget} of {totalDaysInWindow}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Weigh-ins</dt>
            <dd className="font-bold text-foreground tabular-nums">
              {weighInsThisWeek} of {totalDaysInWindow}
            </dd>
          </div>
          {goalDisplay != null ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">
                Projected {goalDisplay} by
              </dt>
              <dd className="font-bold text-foreground tabular-nums">
                {goalDateLabel ?? "—"}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

/**
 * 2026-04-20 prototype port — Suspense fallback mirrors the header
 * chrome used in the inner `loading` branch so React's lazy-load
 * boundary doesn't flash a text-only "Loading…" line before the
 * client-side supabase fetch-driven skeleton mounts. Overline is
 * the default range (`LAST 30 DAYS`), matching the initial `range`
 * state inside `ProgressDashboardContent`.
 */
function ProgressSuspenseFallback() {
  const calendarPlaceholder = (
    <span
      aria-hidden
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card opacity-60"
    >
      <Icons.calendar className="h-4 w-4 text-muted-foreground" />
    </span>
  );

  return (
    <>
      <ProgressTabChrome overline="LAST 30 DAYS" trailing={calendarPlaceholder} />
      <div
        className="hidden md:block max-w-2xl mx-auto px-pm-6 py-pm-6"
        data-testid="progress-suspense-fallback"
      >
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p
              data-testid="progress-overline"
              className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              LAST 30 DAYS
            </p>
            <h1
              data-testid="progress-header"
              className="text-[28px] font-bold text-foreground tracking-tight mt-0.5"
            >
              Progress
            </h1>
          </div>
          {calendarPlaceholder}
        </div>
      </div>
    </>
  );
}

export function ProgressDashboard() {
  return (
    <Suspense fallback={<ProgressSuspenseFallback />}>
      <ProgressDashboardContent />
    </Suspense>
  );
}
