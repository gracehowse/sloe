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
import { persistWeightDayPatch, pruneWeightKgByDay } from "../../lib/progress/weightData.ts";
import { useAuthSession } from "../../context/AuthSessionContext.tsx";
import { kgToLb, calculateTDEE, getEffectiveTDEE, type PlanPace, type Sex, type ActivityLevel } from "../../lib/nutrition/tdee.ts";
import { avgCaloriesOverRecentLoggedDays, calcGoalTimeline, computeWeightJourneyProgressPct, formatWeightJourneyProgressCopy, hasGoalWeightData, projectWeight, resolveLatestWeightKg, shouldRenderDailyProjection } from "../../lib/weightProjection.ts";
import { resolveMaintenance } from "../../lib/nutrition/resolveMaintenance.ts";
import { ENERGY_NUMBERS_V1_FLAG, expenditureFromResolved, maintenanceQualifier, selectMaintenance } from "../../lib/nutrition/energyNumbers.ts";
import { computeAdaptiveDataProgressFromMeals } from "../../lib/nutrition/adaptiveDataProgress.ts";
import { MEASURED_TDEE_CHECK_IN_FLAG } from "../../lib/nutrition/measuredTdee.ts";
import { MaintenanceExplainer } from "./progress/MaintenanceExplainer.tsx";
import { useAppData } from "../../context/AppDataContext.tsx";
import { normalizeMacroTargets, DEFAULT_STEPS_GOAL } from "../../types/profile.ts";
import { computeLoggingStreak } from "../../lib/nutrition/trackerStats.ts";
import { todayKey } from "../../lib/nutrition/trackerDate.ts";
import { buildWeekStats, formatAvgCaloriesLabel, type WeekActivityAdjustment } from "../../lib/nutrition/progressWeekReport.ts";
import {
  buildCaloriesRangeStatsForWindow,
  buildMacroAdherenceRangeStatsForWindow,
  buildWeightRangeStatsForWindow,
} from "../../lib/nutrition/progressRangeStats.ts";
import {
  DEFAULT_PERIOD,
  PERIOD_TYPES,
  periodChartAnchorISO,
  periodLabel,
  periodWindow,
  progressPeriodToWeightRange,
  type ProgressPeriod,
} from "../../lib/nutrition/progressPeriod.ts";
import { ProgressPeriodControl, usePeriodSwipe } from "./suppr/progress-period-control.tsx";
import { computeWeightTrendCopy } from "../../lib/nutrition/weightTrendTile.ts";
import {
  computeWeightTrend,
  weightKgByDayToPoints,
  type WeightRange,
} from "../../lib/progress/weightTrend.ts";
import { weightDeltaTone } from "../../lib/progress/progressRangeChart.ts";
import { getDailyTargets, type DailyTarget } from "../../lib/nutrition/dailyTargetRead.ts";
import { availableFreezes, computeProtectedStreak, readFreezeLedger, type FreezeLedger } from "../../lib/nutrition/streakFreeze.ts";
import {
  buildUsualMealRecapInsight,
  buildDigestWeekView,
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
import { isFeatureEnabled } from "../../lib/analytics/track.ts";
import { useTrendOnlyWeight } from "../../lib/preferences/useTrendOnlyWeight.ts";
import { describeTrendOnly, trendOnlyDirection, resolveEffectiveWeightSurfaceMode, TREND_ONLY_MODE_NOTE } from "../../lib/preferences/trendOnlyWeight.ts";
import { WinMomentPlayer } from "./ui/win-moment-player.tsx";
import { WeightChartTooltip } from "./progress/WeightChartTooltip.tsx";
import { WeightPlateauInsight } from "./progress/WeightPlateauInsight.tsx";
import { WeightMilestoneMoment } from "./progress/WeightMilestoneMoment.tsx";
import { useWeightCelebration } from "./progress/useWeightCelebration.ts";
import { resolveWeightSaveCelebration } from "../../lib/nutrition/weightWinMoment.ts";
import { formatRecapForShare } from "../../lib/nutrition/weeklyRecap.ts";
import {
  formatMaintenanceRecapLine,
} from "../../lib/nutrition/resolveMaintenance.ts";
import { buildWeeklyCheckin } from "../../lib/nutrition/weeklyCheckin.ts";
import { selectMostFrequentSlotSeed } from "../../lib/nutrition/usualMealHint.ts";
import { ProgressMetricDetail, type ProgressMetric } from "./ProgressMetricDetail.tsx";
// Note: `ProgressHeroMetric` (the Oura-style adherence ring) is removed in
// the Sloe Figma 492:2 reskin — the "Average Adherence" card is the single
// adherence surface now. Its mobile mirror is similarly retired.
// HouseholdBar — 2026-04-20 Claude Design prototype port. Rendered at
// the top of Progress (mirrors `screens-mobile.jsx` L580) when the
// user is in a household. Hidden for solo users so the range-picker
// pills stay flush against the header.
import { HouseholdBar } from "./HouseholdBar.tsx";
import { ProgressTabChrome } from "./suppr/progress-tab-chrome.tsx";
// Phase 4 (B3.1, 2026-04-27) — Surface E "Progress hero (story-led)".
// Authority: D-2026-04-27-17 (Progress is a story not a stat-card
// dashboard) + D-2026-04-27-12 (adaptive TDEE always-on).
import { ProgressHeadline } from "./suppr/progress-headline.tsx";
import { ProgressStoryGate } from "./suppr/progress-story-gate.tsx";
// Sloe Figma 492:2 — frame sections (web + mobile parity).
import { ProgressAverageAdherence } from "./suppr/progress-average-adherence.tsx";
import { ProgressEnergyTriad } from "./suppr/progress-energy-triad.tsx";
import { ProgressOnTargetRibbon } from "./suppr/progress-ontarget-ribbon.tsx";
import { ExpenditureTrendCard } from "./suppr/expenditure-trend-card.tsx";
import { BodyCompositionTrendCard } from "./suppr/body-composition-trend-card.tsx";
import { pruneBodyFatPctByDay } from "../../lib/progress/bodyCompositionTrends.ts";
import { hasEnoughDataForStory } from "../../lib/nutrition/progressStoryGate.ts";
import { DigestStoryCard } from "./suppr/digest-story-card.tsx";
import { TrajectoryCard } from "./suppr/trajectory-card.tsx";
import { generateProgressCommentary } from "../../lib/nutrition/progressCommentary.ts";
import { useMilestone30DayOnProgress } from "../../hooks/useMilestone30DayOnProgress.ts";
import { useNutritionHistoryWindow } from "../../hooks/useNutritionHistoryWindow.ts";
import { Milestone30DayDialog } from "./suppr/milestone-30-day-dialog.tsx";
import { SupprCard } from "./ui/suppr-card.tsx";
import { SegmentedTrack } from "./ui/segmented-track.tsx";
import { ProgressActivitySection } from "./suppr/progress-activity-section.tsx";
import { ProgressWeightEmptyState } from "./suppr/progress-weight-empty-state.tsx";
import { ProgressWeightLogRow } from "./suppr/progress-weight-log-row.tsx";
import { StreakFreezeCard } from "./suppr/streak-freeze-card.tsx";
import { WeightStatRow } from "./suppr/weight-stat-row.tsx";
import { getLatestHealthSnapshot } from "../../lib/health/healthSnapshots.ts";

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
    // ENG-787 — per-day burn + preference so the Daily Calories chart
    // judges each bar against the day's effective budget (base + earned
    // activity bonus), reconciling with the Today ring.
    preferActivityAdjustedCalories,
    activityBurnByDay,
    basalBurnByDay,
    workoutsByDay,
    profileTier,
  } = useAppData();
  // ENG-1324 — streaks, period stats, and the 30-day milestone look past the
  // 35-day boot window; widen the shared journal to 90 days (mobile parity).
  useNutritionHistoryWindow();

  // ENG-713 — body-neutral "Trend-only weight" opt-in (client-side pref; flag
  // `progress_trend_only_v1`). Composition lives in the shared helper.
  const [trendOnlyWeight] = useTrendOnlyWeight();
  const effectiveWeightSurfaceMode = resolveEffectiveWeightSurfaceMode(profileWeightSurfaceMode, trendOnlyWeight, isFeatureEnabled("progress_trend_only_v1"));

  const [loading, setLoading] = useState(true);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null);
  const [planPace, setPlanPace] = useState<PlanPace>("steady");
  const [weightKgByDay, setWeightKgByDay] = useState<Record<string, number>>({});
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [dailyStepsGoal, setDailyStepsGoal] = useState(DEFAULT_STEPS_GOAL);
  const [bodyFatPct, setBodyFatPct] = useState<number | null>(null);
  const [bodyFatPctByDay, setBodyFatPctByDay] = useState<Record<string, number>>({});
  const [bodyCompositionRefreshKey, setBodyCompositionRefreshKey] = useState(0);
  const [userGoal, setUserGoal] = useState<string | null>(null);

  // Adaptive TDEE state
  const [staticTdee, setStaticTdee] = useState<number | null>(null);
  const [adaptiveTdee, setAdaptiveTdee] = useState<number | null>(null);
  const [adaptiveConfidence, setAdaptiveConfidence] = useState<string | null>(null);
  const [adaptiveUpdatedAt, setAdaptiveUpdatedAt] = useState<string | null>(null);
  const [measuredTdee, setMeasuredTdee] = useState<number | null>(null);
  const [measuredTdeeConfidence, setMeasuredTdeeConfidence] = useState<string | null>(null);
  const [measuredTdeeUpdatedAt, setMeasuredTdeeUpdatedAt] = useState<string | null>(null);
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
  const weightInputRef = useRef<HTMLInputElement | null>(null); // ENG-1372 slice 2 CTA target
  // ENG-1504 — the sparse/empty weight state renders ONE affordance (the
  // in-frame filled CTA, ENG-1372 law 2); the inline input + "Log weight"
  // row stays hidden until that CTA reveals it (then focuses the input).
  // Non-empty states always render the row. Mirrors mobile, where the
  // "Log weight" button lives inside the non-empty branch only and the
  // sparse-state CTA opens the LogWeightSheet.
  const [weightEntryRevealed, setWeightEntryRevealed] = useState(false);
  useEffect(() => {
    if (weightEntryRevealed) weightInputRef.current?.focus();
  }, [weightEntryRevealed]);
  const [stepsInput, setStepsInput] = useState("");
  const [bodyFatInput, setBodyFatInput] = useState("");
  // ENG-824 / ENG-952 — weight-save celebration state + side-effects (loud
  // new-all-time-low player + pulse; quiet milestone player), extracted to
  // `useWeightCelebration`. `fireCelebration` runs the matching tier on a save.
  const {
    weightWinActive,
    setWeightWinActive,
    weightPulse,
    milestoneWinOrdinal,
    setMilestoneWinOrdinal,
    fireCelebration,
  } = useWeightCelebration();
  // ENG-1030 — Apple Health range grammar. Replaces the `7d/30d/90d/All`
  // relative-window picker with the calendar-anchored period model
  // (D/W/M/6M/Y + horizontal paging). Default = current week, matching
  // Apple Health's default and the mobile Progress tab. "All" is removed —
  // Y + paging covers history (Apple has no All either). Shared period helper
  // (`progressPeriod.ts`) feeds both platforms identical windows + labels.
  const [period, setPeriod] = useState<ProgressPeriod>(DEFAULT_PERIOD);
  // ENG-1031 — horizontal swipe accelerator on the chart area. Additive on top
  // of the segmented control + chevron paging (ENG-1030); chevrons remain the
  // primary/accessible path. Threshold 64px (both platforms). Direction: swipe
  // RIGHT = previous period (past), swipe LEFT = next period (future), clamped
  // at the current period (no-future) inside the hook. Same `setPeriod` the
  // chevrons/segments use → identical period model + clamp. Mirror of the
  // mobile chart-swipe lane.
  const periodSwipe = usePeriodSwipe(period, setPeriod, 64);
  // Sloe Figma 492:2 — weight card Trend/Scale segmented toggle. "trend"
  // renders the smoothed moving-average line (calm Withings-style trend);
  // "scale" renders the raw weigh-ins. Mirrors mobile.
  const [weightView, setWeightView] = useState<"trend" | "scale">("trend");
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
        "weight_kg, goal_weight_kg, plan_pace, weight_kg_by_day, steps_by_day, daily_steps_goal, goal, sex, height_cm, age, activity_level, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, measured_tdee, measured_tdee_confidence, measured_tdee_updated_at, week_start_day, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history, weekly_recap_last_seen_week_key, milestone_30_shown_at",
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
      const mTdee = (data as any).measured_tdee != null ? Number((data as any).measured_tdee) : null;
      setMeasuredTdee(Number.isFinite(mTdee) ? mTdee : null);
      setMeasuredTdeeConfidence(((data as any).measured_tdee_confidence as string) ?? null);
      setMeasuredTdeeUpdatedAt(((data as any).measured_tdee_updated_at as string | null) ?? null);
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

  // ENG-1030 — the selected period resolves to an inclusive local window.
  // `weekStartDay` honours the user's DayStrip setting. Memoised on the period
  // + weekStart so a re-render with the same selection is stable.
  const periodWin = useMemo(
    () => periodWindow(period, weekStartDay, new Date()),
    [period, weekStartDay],
  );
  const periodWindowLabel = useMemo(
    () => periodLabel(period, weekStartDay, new Date()),
    [period, weekStartDay],
  );

  // 2026-05-06 audit (D2): web parity for the mobile weight chart
  // rewrite (PRs #106 + #107). Use the shared `computeWeightTrend`
  // so web gets the same MFP-style bucket aggregation, calendar-day
  // moving-average, same-day dedup, smart bucket fallback, and
  // iterative min/max as mobile.
  // ENG-1030: the chart range now derives from the period type, and its
  // trailing window is anchored to the period's end day so paging actually
  // moves the chart window (not always "today").
  const weightTrendRange: WeightRange = progressPeriodToWeightRange(period.type);
  const weightChartAnchorISO = useMemo(
    () => periodChartAnchorISO(period, weekStartDay, new Date()),
    [period, weekStartDay],
  );
  const weightTrend = useMemo(
    () =>
      computeWeightTrend(
        weightKgByDayToPoints(weightKgByDay),
        weightTrendRange,
        goalWeightKg ?? null,
        weightChartAnchorISO,
      ),
    [weightKgByDay, weightTrendRange, goalWeightKg, weightChartAnchorISO],
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
    // ENG-1030 — steps follow the same calendar period window as everything
    // else on the page (was a `now − rangeDays` cutoff).
    return Object.entries(stepsByDay)
      .filter(([k]) => k >= periodWin.startKey && k <= periodWin.endKey)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ date: k.slice(5), value: v }));
  }, [stepsByDay, periodWin.startKey, periodWin.endKey]);

  const persistProfilePatch = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!authedUserId) return;
      const { error } = await supabase.from("profiles").update(patch).eq("id", authedUserId);
      if (error) console.error("[progress] save failed", error.message);
    },
    [authedUserId],
  );

  // ENG-1225 gap #21: feed the v3 AppleHealthCard. Reads the latest snapshot the
  // iOS app wrote to `health_snapshots` (web has no HealthKit). Stable supabase
  // import → deps are just the user id.
  const fetchHealthSnapshot = useCallback(
    () => getLatestHealthSnapshot(supabase, authedUserId ?? ""),
    [authedUserId],
  );

  const saveTodayWeight = useCallback(async () => {
    const v = Number.parseFloat(weightInput.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return;
    const kg = profileMeasurementSystem === "imperial" ? v / 2.20462 : v;
    const tk = todayKey();
    // ENG-824 / ENG-952 — resolve the celebration tier against the PRE-save map
    // (excluding today's key so re-saving today doesn't compare to itself). The
    // loud new-all-time-low owns precedence over the quieter milestone tier;
    // the shared resolver keeps that decision identical to mobile. Each tier is
    // flag-gated (`redesign_winmoment` / `progress_milestone_celebration_v1`);
    // flag-off keeps the silent save.
    const celebration = resolveWeightSaveCelebration({
      savedKg: kg,
      priorByDay: weightKgByDay,
      targetDateKey: tk,
      goalKg: goalWeightKg,
      winMomentEnabled: isFeatureEnabled("redesign_winmoment"),
      milestoneEnabled: isFeatureEnabled("progress_milestone_celebration_v1"),
    });
    const nextMap = pruneWeightKgByDay({ ...weightKgByDay, [tk]: kg });
    setWeightKgByDay(nextMap);
    setWeightKg(kg);
    setWeightInput("");
    fireCelebration(celebration); // ENG-824/952 — loud new-low or quiet milestone; no-op when "none".
    if (!authedUserId) return;
    // ENG-1306 — per-day patch through the upsert_body_metric_days RPC (no
    // full-map clobber); rehydrate from the server-merged result so a
    // concurrent HealthKit sync's days survive locally too.
    const merged = await persistWeightDayPatch({ supabase, userId: authedUserId, patch: { [tk]: kg } });
    setWeightKgByDay(merged.weightKgByDay);
    setWeightKg(merged.weightKg);
    setBodyCompositionRefreshKey((v) => v + 1);
  }, [weightInput, profileMeasurementSystem, weightKgByDay, goalWeightKg, authedUserId, fireCelebration]);

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
    const rounded = Math.round(v * 10) / 10;
    const tk = todayKey();
    const nextMap = pruneBodyFatPctByDay({ ...bodyFatPctByDay, [tk]: rounded });
    setBodyFatPct(rounded);
    setBodyFatPctByDay(nextMap);
    setBodyFatInput("");
    if (!authedUserId) return;
    // ENG-1306 — per-day patch via the upsert_body_metric_days RPC (no
    // full-map clobber vs a racing HealthKit body-fat sync); the scalar
    // body_fat_pct is derived server-side from the merged map.
    const { data, error } = await supabase.rpc("upsert_body_metric_days", {
      p_body_fat_patch: { [tk]: rounded },
    });
    if (error) {
      console.error("[progress] save failed", error.message);
      return;
    }
    const mergedMap = (data as { body_fat_pct_by_day?: Record<string, number> } | null)
      ?.body_fat_pct_by_day;
    if (mergedMap) setBodyFatPctByDay(pruneBodyFatPctByDay(mergedMap));
    setBodyCompositionRefreshKey((v) => v + 1);
  }, [bodyFatInput, bodyFatPctByDay, authedUserId]);

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
  // from these shared helpers so mobile + web can't drift.
  // ENG-1030: scoped to the selected period's inclusive window (was the
  // relative `rangeKey`). Empty periods return honest nulls / [] — no faked 0%.
  const weightRange = useMemo(
    () => buildWeightRangeStatsForWindow(weightKgByDay, periodWin),
    [weightKgByDay, periodWin],
  );
  const caloriesRange = useMemo(
    () => buildCaloriesRangeStatsForWindow(nutritionByDay, nutritionTargets.calories, periodWin),
    [nutritionByDay, nutritionTargets.calories, periodWin],
  );
  // Sloe Figma 492:2 — range-scoped macro adherence so the AVERAGE
  // ADHERENCE card's four bars describe the SAME window as the headline
  // calorie adherence (responds to the period control), not just the
  // current week. Shared helper → web + mobile read identical figures.
  const macroRange = useMemo(
    () =>
      buildMacroAdherenceRangeStatsForWindow(
        nutritionByDay,
        normalizeMacroTargets(nutritionTargets),
        periodWin,
      ),
    [nutritionByDay, nutritionTargets, periodWin],
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
  // Action 5 Item 7 (2026-04-19) — resolved maintenance for the recap
  // card's adaptive-vs-formula one-liner. Computed at the host level
  // (not inside the WeeklyRecapCard) so we can pass it as a plain prop;
  // the card stays presentational and the resolver stays a pure call.
  //
  // ENG-787 — hoisted above `weekStatsBundle` so the effective-target
  // activity bundle can reuse its resolved kcal as the maintenance fallback.
  // ENG-1506 — flag ON: canonical `buildMaintenanceInputs` policy (latest
  // weigh-in beats the lagging `profiles.weight_kg` snapshot — the input
  // skew behind the 1,778-vs-1,567 audit split — and no `?? 70`
  // fabrication). Legacy assembly stays in the else (kill switch).
  const recapMaintenance = useMemo(
    () =>
      isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG)
        ? selectMaintenance(
            {
              adaptive_tdee: adaptiveTdee, adaptive_tdee_confidence: adaptiveConfidence,
              adaptive_tdee_updated_at: adaptiveUpdatedAt, measured_tdee: measuredTdee,
              measured_tdee_confidence: measuredTdeeConfidence, measured_tdee_updated_at: measuredTdeeUpdatedAt,
              sex: profileSexCached, weight_kg: weightKg, height_cm: profileHeightCmCached,
              age: profileAgeCached, activity_level: profileActivityLevelCached, weight_kg_by_day: weightKgByDay,
            },
            { enableMeasured: isFeatureEnabled(MEASURED_TDEE_CHECK_IN_FLAG) },
          )
        : resolveMaintenance(
            {
              adaptive_tdee: adaptiveTdee, adaptive_tdee_confidence: adaptiveConfidence,
              adaptive_tdee_updated_at: adaptiveUpdatedAt, measured_tdee: measuredTdee,
              measured_tdee_confidence: measuredTdeeConfidence, measured_tdee_updated_at: measuredTdeeUpdatedAt,
              sex: profileSexCached, weight_kg: weightKg ?? 70, height_cm: profileHeightCmCached,
              age: profileAgeCached, activity_level: profileActivityLevelCached,
            },
            { enableMeasured: isFeatureEnabled(MEASURED_TDEE_CHECK_IN_FLAG) },
          ),
    [adaptiveTdee, adaptiveConfidence, adaptiveUpdatedAt, measuredTdee, measuredTdeeConfidence, measuredTdeeUpdatedAt, profileSexCached, weightKg, weightKgByDay, profileHeightCmCached, profileAgeCached, profileActivityLevelCached],
  );

  // ENG-787 — per-day activity bundle for the Daily Calories chart. Mirrors
  // the Today ring's `dayActivityBudgetAddonWeb`: each bar is judged against
  // base target + that day's earned bonus, not the bare base target.
  // Maintenance prefers the day's frozen snapshot, falling back to the
  // resolved value. Undefined when the preference is off → the chart
  // collapses to plain base-target colouring (no behaviour change).
  const weekActivity = useMemo<WeekActivityAdjustment | undefined>(() => {
    if (!preferActivityAdjustedCalories) return undefined;
    const maintenanceByDay: Record<string, number> = {};
    for (const [k, v] of Object.entries(dailyTargetsByDay)) {
      if (v?.maintenanceTdee != null) maintenanceByDay[k] = v.maintenanceTdee;
    }
    const workoutKcalByDay: Record<string, number> = {};
    for (const [k, list] of Object.entries(workoutsByDay)) {
      workoutKcalByDay[k] = (list ?? []).reduce((s, w) => s + (w.calories ?? 0), 0);
    }
    return {
      prefer: true,
      maintenanceSource: recapMaintenance?.source ?? null,
      restingByDay: basalBurnByDay,
      activeByDay: activityBurnByDay,
      workoutKcalByDay,
      maintenanceByDay,
      maintenanceFallback: recapMaintenance?.kcal ?? 0,
    };
  }, [
    preferActivityAdjustedCalories,
    dailyTargetsByDay,
    workoutsByDay,
    basalBurnByDay,
    activityBurnByDay,
    recapMaintenance,
  ]);

  const weekStatsBundle = useMemo(
    () => buildWeekStats(nutritionByDay, targets, weekStartDay, new Date(), weekTargetsByDay, weekActivity),
    [nutritionByDay, targets, weekStartDay, weekTargetsByDay, weekActivity],
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
    // ENG-787 — the budget the day was actually judged against (base +
    // earned activity bonus). The chart colours over/under against THIS,
    // not the bare base target. Equals `target` when activity adjustment
    // is off.
    effectiveTarget: d.effectiveTargetCalories,
    // Action 13 Item #11 (2026-04-19) — surface whether this day's
    // target is a real `daily_targets` snapshot or the current-target
    // fallback. The chart uses this to add a subtle striped border on
    // approximate days so the user can tell the bar's colour decision
    // wasn't necessarily made against the target they had at the time.
    isSnapshot: d.isSnapshot,
  }));
  const todayDateKey = todayKey();
  // Macro adherence now reads range-scoped figures (`macroRange`) for the
  // AVERAGE ADHERENCE card; the per-week `weekStatsBundle.*Adherence`
  // values are still consumed by the weekly recap / digest below.

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

  // ENG-1373 — previous-week-anchored (matches `recap` below), used ONLY
  // for `proteinOnTargetDays` (which `recap`/`WeeklyRecap` doesn't carry).
  // Never source daysLogged/avgCalories from `weekStatsBundle` (current
  // week) here — that was the "929 vs 1,402" avg-divergence bug.
  const digestWeekStats = useMemo(() => {
    const previousWeekAnchor = new Date();
    previousWeekAnchor.setDate(previousWeekAnchor.getDate() - 7);
    return buildWeekStats(nutritionByDay, targets, weekStartDay, previousWeekAnchor, prevWeekTargetsByDay);
  }, [nutritionByDay, targets, weekStartDay, prevWeekTargetsByDay]);

  // ENG-1373 — `buildDigestWeekView`: headline numbers + day-of-week pattern share one anchor/gate.
  const recap = useMemo(
    () =>
      buildDigestWeekView({
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

  // ENG-740 — blended Week-Digest flag. PostHog flags can resolve after
  // first paint, so we read once on mount + cannot tell "off" from
  // "not-loaded-yet"; default-false keeps the legacy two-card layout.
  // The blended card is an always-on card with a per-week dismiss, so we
  // gate it on `recap.daysLogged > 0` (real data to narrate) rather than
  // the Sat→Tue recap window.
  const [digestBlendEnabled, setDigestBlendEnabled] = useState(false);
  useEffect(() => {
    setDigestBlendEnabled(isFeatureEnabled("progress_digest_blend"));
  }, []);
  // Always-on visibility for the blended card: real data to narrate +
  // not dismissed this week. NO Sat→Tue window (ENG-740 approved spec).
  const digestBlendVisible =
    digestBlendEnabled &&
    recap.daysLogged > 0 &&
    recapLastSeenWeekKey !== currentWeekKey;

  // ENG-741 — Trajectory card flag. Same read-once-on-mount,
  // default-false-until-loaded posture as the blended-digest flag above
  // (PostHog flags can resolve after first paint). Default-off keeps the
  // current Progress layout; on → the calm "if you keep this pace you'll
  // be X" card renders directly under the weight chart.
  const [trajectoryBoxEnabled, setTrajectoryBoxEnabled] = useState(false);
  useEffect(() => {
    setTrajectoryBoxEnabled(isFeatureEnabled("progress_trajectory_box"));
  }, []);

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

  // ENG-822 — card elevation is now delegated to the canonical SupprCard
  // primitive, which reads `design_system_elevation` internally and applies
  // the soft shadow + border-drop on flag-ON, or the flat border on flag-OFF.
  // The manual progressCardClass / progressCardsElevated vars are removed.

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
        {/* v3 prototype (ENG-1247, node 4946): "Your trends" overline above
            the serif "Progress" title. Supersedes the Figma-era subtitle. */}
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-tertiary mb-1">
          Your trends
        </p>
        <h1
          data-testid="progress-header"
          className="font-[family-name:var(--font-headline)] text-3xl font-medium tracking-tight text-foreground-brand"
        >
          Progress
        </h1>
      </div>
      {progressCalendarButton}
    </div>
  );

  if (!authedUserId) {
    return (
      <div className="product-shell py-pm-6 text-muted-foreground">
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
        <ProgressTabChrome overline="Your trends" trailing={progressLoadingCalendar} />
      <div
        className="product-shell py-pm-6"
        data-testid="progress-loading-skeleton"
      >
        {progressDesktopHeader}
        {/* Skeleton mirrors the live period control exactly (ENG-1030 segments
            + a label-row placeholder), so `loading` → loaded has no jump. */}
        <div className="opacity-60 mb-5">
          <div className="flex gap-1.5">
            {PERIOD_TYPES.map((seg) => (
              <span
                key={seg}
                className={[
                  "flex-1 rounded-full py-1.5 text-[13px] text-center",
                  seg === period.type
                    ? "bg-primary-soft text-primary-solid font-semibold"
                    : "bg-card text-muted-foreground font-medium",
                ].join(" ")}
              >
                {seg}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-4">
            <span className="h-5 w-5 rounded-full bg-border" aria-hidden />
            <span className="h-4 w-28 rounded bg-border" aria-hidden />
            <span className="h-5 w-5 rounded-full bg-border" aria-hidden />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <SupprCard
              key={i}
              data-testid={`progress-skeleton-tile-${i}`}
              padding="md"
              radius="lg"
              className="min-h-[86px]"
            >
              <div className="h-3 w-16 rounded bg-border mb-2" />
              <div className="h-5 w-20 rounded bg-border mb-1.5" />
              <div className="h-3 w-24 rounded bg-border" />
            </SupprCard>
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
      <ProgressTabChrome overline="Your trends" trailing={progressCalendarButton} />
    <div className="product-shell py-pm-6">
      {progressDesktopHeader}

      {/* HouseholdBar — 2026-04-20 prototype port. Appears immediately
          under the header on Progress (mirrors mobile Plan/Progress
          + web Plan). Renders nothing for solo users. */}
      <HouseholdBar />

      {/* ── Sloe Figma 492:2 — frame layout (single production path) ──
          Order: range toggle → THIS WEEK insight (lilac) → AVERAGE
          ADHERENCE → weight card → AVG/TDEE/DEFICIT triad → DAILY
          CALORIES → on-target ribbon. Every previously-wired surface
          (maintenance, journey, steps, body fat, streak freezes, week
          digest, weight-surface opt-out, milestone) is preserved below
          the frame's above-fold story. No migration flags, no duplicate
          components, no alternate versions. */}

      {/* 1. TIME PERIOD — Apple Health range grammar (ENG-1030): D / W / M /
          6M / Y segments + ‹ label › paging. Default = current week. Drives
          the range stats below + the weight/steps chart windows. Mirror of
          the mobile `ProgressPeriodControl`; shared period model. */}
      <div className="mb-4">
        <ProgressPeriodControl
          period={period}
          weekStart={weekStartDay}
          onChange={setPeriod}
        />
      </div>

      {/* 2. THIS WEEK insight card (lilac wash + sparkle). Engine-led
          commentary; the StoryGate placeholder shares the same wash until
          the user crosses the 3-day data floor (geometry matches so the
          slot doesn't jump). Authority: D-2026-04-27-12 (always-on TDEE)
          + D-2026-04-27-17 (Progress is a story).

          prevWeekTdee / avgIntakeOnLossWeeks: the weekly aggregate stream
          isn't persisted yet, so the commentary collapses to steady /
          calibrating — documented data gap (deferred: see ENG-741 weekly
          aggregate stream), never faked. */}
      {(() => {
        const daysLogged = weekStatsBundle.daysWithFood;
        if (!hasEnoughDataForStory(daysLogged)) {
          return (
            <div className="mb-4">
              <ProgressStoryGate
                daysLogged={daysLogged}
                // Any logged day in the journal store → new-week copy, not
                // cold-start copy (mirror of mobile; fresh-eyes P0-2).
                hasHistory={Object.keys(nutritionByDay).some(
                  (k) => (nutritionByDay[k] ?? []).length > 0,
                )}
              />
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

      {/* WEIGHT DIRECTION (trends_only) — opt-out users keep a lightweight
          weight signal here (no absolute numbers). Average Adherence moved to
          AFTER Daily Calories per the v3 prototype order (ENG-1247). */}
      {effectiveWeightSurfaceMode === "trends_only" && (
        <div className="mb-4">
          <WeightTrendOnlyCardWeb
            weekDeltaKg={weightRange.weekDeltaKg}
            windowLabel={periodWindowLabel}
          />
        </div>
      )}

      {/* 4. WEIGHT CARD (Sloe Figma 492:2) — Newsreader kg headline +
          "↓ N this week" + Trend/Scale segmented toggle, clay line chart
          with dashed goal line, START/CURRENT/GOAL/RATE stat row, and a
          centred "＋ Log weight" button. The single canonical weight
          surface — win-moment + chart wiring + measurement system all
          preserved. Gated on `weight_surface_mode === "show"` (opt-out
          users see the direction tile above instead). */}
      {effectiveWeightSurfaceMode === "show" ? (() => {
        const sortedWeightDays = Object.entries(weightKgByDay).sort(([a], [b]) => a.localeCompare(b));
        const showWeightEmpty = weightChartData.length < 2 && isFeatureEnabled("empty_state_grammar_v1"); // ENG-1372 slice 2
        const startKg = sortedWeightDays.length > 0 ? sortedWeightDays[0][1] : null;
        const weekDeltaKg = weightRange.weekDeltaKg;
        const rateKgPerWeek = goalTimeline?.weeklyRateKg ?? null;
        // 2026-06-10 (premium-audit #3, web parity with mobile progress.tsx):
        // tone the "this week" delta magnitude toward-goal = sage /
        // away-from-goal = warning, via the shared `weightDeltaTone`. The week
        // baseline is the weigh-in 7 days ago = latest − weekDeltaKg. The arrow
        // icon stays factual/uncoloured (anti-shame brand rule).
        const weekDeltaTone =
          weekDeltaKg != null && latestWeightKg != null
            ? weightDeltaTone(weekDeltaKg, latestWeightKg - weekDeltaKg, goalWeightKg)
            : "neutral";
        const weekDeltaToneClass =
          weekDeltaTone === "progress"
            ? "text-success"
            : weekDeltaTone === "regress"
              ? "text-warning-solid"
              : "text-muted-foreground";
        return (
        <SupprCard elevation="card" padding="lg" radius="lg" className="relative mb-4" data-testid="progress-weight-card">
          {/* Reserved weight win-moment overlay (ENG-824) — plays once on a
              new all-time low, then unmounts. */}
          {weightWinActive ? (
            <WinMomentPlayer
              celebration="goal-hit"
              fullBleed
              onComplete={() => setWeightWinActive(false)}
              testID="progress-weight-win-moment"
            />
          ) : null}
          {/* ENG-952 — the QUIETER milestone tier (extracted overlay). */}
          <WeightMilestoneMoment
            ordinal={milestoneWinOrdinal}
            onComplete={() => setMilestoneWinOrdinal(null)}
          />
          {/* Section eyebrow — parity with mobile (progress.tsx) + the web
              "Daily Calories" / "Average Adherence" cards, so the weight card
              is no longer the only Progress card without a header. */}
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary-solid mb-2">Weight</p>
          {showWeightEmpty ? (
            <ProgressWeightEmptyState
              points={weightChartData.map((d) => ({ kg: d.value }))}
              goalKg={goalWeightChart ?? null}
              // ENG-1504 — first tap reveals the (otherwise hidden) inline
              // log row below; the reveal effect focuses the input.
              onLogWeight={() => {
                if (weightEntryRevealed) weightInputRef.current?.focus();
                else setWeightEntryRevealed(true);
              }}
            />
          ) : (<>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="ph-mask">
                <span
                  data-testid="progress-current-weight"
                  className={`font-[family-name:var(--font-headline)] text-[28px] font-medium leading-none tabular-nums transition-colors duration-200 ${weightPulse ? "text-success" : "text-foreground"}`}
                >
                  {latestWeightKg != null
                    ? (profileMeasurementSystem === "imperial"
                        ? Math.round(kgToLb(latestWeightKg) * 10) / 10
                        : Math.round(latestWeightKg * 10) / 10)
                    : "—"}
                </span>
                <span className="ml-1.5 text-[15px] text-muted-foreground">
                  {profileMeasurementSystem === "imperial" ? "lb" : "kg"}
                </span>
              </p>
              {weekDeltaKg != null && Math.abs(weekDeltaKg) >= 0.05 ? (
                <p className="mt-1 flex items-center gap-1 text-[13px] text-muted-foreground tabular-nums">
                  {weekDeltaKg < 0 ? (
                    <Icons.trendDown className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Icons.trendUp className="h-3.5 w-3.5" aria-hidden />
                  )}
                  <span className={weekDeltaToneClass}>
                    {formatRatePerWeek(weekDeltaKg).replace("/week", "")} this week
                  </span>
                </p>
              ) : null}
            </div>
            {/* Trend/Scale segmented toggle — the canonical §8 SegmentedTrack
                (ENG-1375 S2; this toggle was one of the conforming treatments
                the primitive absorbed). */}
            <SegmentedTrack
              role="tablist"
              ariaLabel="Weight chart view"
              testId="progress-weight-view-toggle"
              className="shrink-0"
              size="sm"
              fit="hug"
              options={(["trend", "scale"] as const).map((v) => ({
                value: v,
                label: v === "trend" ? "Trend" : "Scale",
                testId: `progress-weight-view-${v}`,
              }))}
              value={weightView}
              onChange={setWeightView}
            />
          </div>
          {goalWeightKg != null ? (
            <p className="mt-1.5 text-[13px] text-muted-foreground ph-mask">
              Goal {profileMeasurementSystem === "imperial" ? Math.round(kgToLb(goalWeightKg) * 10) / 10 : Math.round(goalWeightKg * 10) / 10}{" "}
              {profileMeasurementSystem === "imperial" ? "lb" : "kg"}
              {goalDateLabel ? ` · on track for ~${goalDateLabel}` : ""}
            </p>
          ) : null}
          {weightChartData.length >= 2 && (
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={weightChartData} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                  {/* ENG-1526 — removed the `weight-trend-fill` gradient: a
                      <Line> never fills (fill:"none"), so it was dead defs. */}
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                  <Tooltip cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} content={<WeightChartTooltip unit={profileMeasurementSystem === "imperial" ? "lb" : "kg"} />} />
                  {/* Trend = MA line; Scale = raw weigh-ins. Brand-plum line —
                      parity w/ mobile WeightChart; was carbs-amber (ENG-1225). */}
                  {weightView === "scale" || showRawDots ? (
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--macro-protein)"
                      strokeWidth={2.25}
                      dot={weightView === "scale" ? { r: 3, fill: "var(--card)", stroke: "var(--macro-protein)", strokeWidth: 2 } : false}
                      activeDot={{ r: 5, fill: "var(--macro-protein)", stroke: "var(--card)", strokeWidth: 2 }}
                      connectNulls
                    />
                  ) : (
                    <Line
                      type="monotone"
                      dataKey="ma"
                      stroke="var(--macro-protein)"
                      strokeWidth={2.25}
                      dot={false}
                      connectNulls
                    />
                  )}
                  {goalWeightChart != null && (
                    <ReferenceLine y={goalWeightChart} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.5} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* ENG-954 — calm plateau insight (extracted component). */}
          <WeightPlateauInsight plateauInsight={weightTrend.plateauInsight} />
          {/* START / CURRENT / GOAL / RATE stat row (ENG-1225 #22). ENG-1373: GOAL/RATE gate on shared `hasGoalWeightData` (matches Journey gate below). */}
          <WeightStatRow
            start={startKg != null ? formatWeight(startKg) : "—"}
            current={latestWeightKg != null ? formatWeight(latestWeightKg) : "—"}
            goal={hasGoalWeightData({ goalWeightKg, latestWeightKg }) ? formatWeight(goalWeightKg as number) : "—"}
            rate={hasGoalWeightData({ goalWeightKg, latestWeightKg }) && rateKgPerWeek != null && rateKgPerWeek !== 0 ? `${rateKgPerWeek < 0 ? "−" : "+"}${formatRatePerWeek(rateKgPerWeek).replace("/week", "/wk")}` : "—"}
          />
          </>)}
          {/* Inline log row (extracted, ENG-1504): hidden on the sparse/empty
              state until its in-frame CTA reveals it — the empty card shows
              exactly one log-weigh-in affordance (ENG-1372 law 2). */}
          {!showWeightEmpty || weightEntryRevealed ? (
            <ProgressWeightLogRow
              inputRef={weightInputRef}
              value={weightInput}
              onChange={setWeightInput}
              isImperial={profileMeasurementSystem === "imperial"}
              onSave={() => void saveTodayWeight()}
            />
          ) : null}
        </SupprCard>
        );
      })() : null}

      {/* 5. AVG INTAKE / EST. TDEE (ADAPTIVE) / DEFICIT triad — real range
          intake + resolved maintenance (`recapMaintenance`); deficit =
          maintenance − intake. Sage TDEE/deficit, amber surplus. */}
      <ProgressEnergyTriad
        className="mb-4"
        avgIntakeKcal={caloriesRange.avgCaloriesPerDay}
        // ENG-1506 — flag ON: no full-activity staticTdee fallback (it was
        // computed from `?? 70`/`|| 170`/`|| 30` fabricated basics at a THIRD
        // activity policy); an unresolvable maintenance renders "—" honestly.
        maintenanceKcal={recapMaintenance?.kcal ?? (isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG) ? null : staticTdee)}
        isAdaptive={recapMaintenance?.source === "adaptive"}
        // ENG-1506 — explicit source qualifier under the MAINTENANCE operand +
        // the REAL selected-period label (the header hard-coded "7-day average"
        // while avg intake followed the period control). Flag-gated inside.
        qualifierLine={recapMaintenance ? maintenanceQualifier(recapMaintenance.source, recapMaintenance.confidence).line : null}
        periodLabel={periodWindowLabel}
      />

      {/* 6. DAILY CALORIES (Sloe Figma 492:2) — M–S bars, sage = on target,
          amber = over, a small goal dot above each bar. Reads the same
          `dailyCaloriesData` (effective-target colouring) the detailed
          chart used; this is the frame-styled primary surface. */}
      {/* ENG-1031 — chart-area swipe accelerator. Pointer handlers from
          `usePeriodSwipe` page prev/next on a >64px horizontal drag (swipe
          right = past, left = future, clamped at the current period). Purely
          additive to the chevrons/segments above; a tap (dx≈0) no-ops below
          threshold so it never hijacks the card's own controls. */}
      <SupprCard
        elevation="card"
        padding="lg"
        radius="lg"
        className="mb-4 touch-pan-y"
        data-testid="progress-daily-calories-card"
        {...periodSwipe}
      >
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary-solid">
              Daily Calories
            </p>
            <p className="mt-1 font-[family-name:var(--font-headline)] text-[24px] font-medium leading-none text-foreground tabular-nums">
              {avgCalories.toLocaleString()}
              <span className="ml-1 text-[13px] text-muted-foreground">avg</span>
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--macro-carbs)" }} />
            goal
          </span>
        </div>
        {(() => {
          const chartHeight = 96;
          const dotReserve = 10;
          const barMax = chartHeight * 0.72;
          const maxCal = Math.max(
            targets.calories,
            ...dailyCaloriesData.map((dd) => dd.calories),
            1,
          );
          const scaleMax = maxCal * 1.15;
          return (
            <div className="mt-4 flex items-end gap-2" style={{ height: chartHeight }}>
              {dailyCaloriesData.map((d) => {
                const overTarget = d.calories > d.effectiveTarget;
                const barH = maxCal > 0 ? Math.max(4, (d.calories / scaleMax) * barMax) : 4;
                const goalDotBottom = d.effectiveTarget > 0 ? dotReserve + (d.effectiveTarget / scaleMax) * barMax : null;
                const isDayToday = d.key === todayDateKey;
                const bg = d.calories === 0
                  ? "var(--border)"
                  : overTarget
                    ? "var(--warning)"
                    : "var(--macro-protein)";
                return (
                  <div key={d.key} className="relative flex-1 flex flex-col items-center justify-end" style={{ height: chartHeight }}>
                    {/* goal dot above the bar */}
                    {goalDotBottom != null ? (
                      <span
                        aria-hidden
                        className="absolute left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full"
                        style={{ bottom: Math.min(goalDotBottom, chartHeight - 16), background: "var(--macro-carbs)" }}
                      />
                    ) : null}
                    <div
                      className="w-full rounded-[6px]"
                      data-testid={`progress-day-bar-${d.key}`}
                      data-today={isDayToday ? "true" : "false"}
                      style={{ height: barH, background: bg, opacity: isDayToday ? 1 : 0.85 }}
                    />
                    <span className={["mt-1.5 text-[10px] font-medium leading-none", isDayToday ? "text-foreground font-bold" : "text-muted-foreground"].join(" ")}>
                      {d.day.charAt(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
        <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--macro-protein)" }} />
            On target
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--warning)" }} />
            Over
          </span>
        </div>
      </SupprCard>

      {/* AVERAGE ADHERENCE — ENG-1247 (Grace 2026-06-26): the v3 prototype
          places Adherence LAST (after Daily Calories), not above the Weight
          hero. Big adherence % + on-target streak + four macro bars; every
          figure is real. Parity with mobile progress.tsx. */}
      <ProgressAverageAdherence
        className="mb-4"
        adherencePct={
          hasEnoughDataForStory(caloriesRange.daysLogged) ? caloriesRange.adherencePct : null
        }
        onTargetDays={weekStatsBundle.days.map(
          (d) => d.calories > 0 && d.calories <= d.effectiveTargetCalories,
        )}
        macros={[
          { name: "Protein", pct: macroRange.proteinPct, color: "var(--macro-protein)" },
          { name: "Carbs", pct: macroRange.carbsPct, color: "var(--macro-carbs)" },
          { name: "Fat", pct: macroRange.fatPct, color: "var(--macro-fat)" },
          { name: "Fibre", pct: macroRange.fiberPct, color: "var(--macro-fiber)" },
        ]}
      />

      {/* 7. ON-TARGET RIBBON — real count of on-target days this week. */}
      {(() => {
        const onTargetCount = weekStatsBundle.days.filter(
          (d) => d.calories > 0 && d.calories <= d.effectiveTargetCalories,
        ).length;
        return (
          <ProgressOnTargetRibbon
            className="mb-6"
            onTargetCount={onTargetCount}
            subtitle={`That's ${onTargetCount} of 7 days.`}
          />
        );
      })()}

      {/* ── Preserved detail (below the frame's above-fold story) ──
          Everything wired but not part of the 492:2 frame stays here so
          no functionality is lost: week digest, streak freezes, full
          macro-adherence breakdown, adaptive-maintenance card + explainer,
          journey/projection, steps, body fat. */}

      {/* WEEK DIGEST (D3) — replaces the legacy WeeklyRecapCard. Host
          computes headline + flattens usual-meal insight into the
          shared `DigestProps` shape so web + mobile cannot drift. See
          `docs/design/digest-primitive.md`.

          ENG-740 — when `progress_digest_blend` is on, this single
          block renders the merged premium card (blended hero + metric
          strip + PATTERN row) gated on always-on `digestBlendVisible`;
          the legacy `<DigestStoryCard>` below is suppressed. When the
          flag is off, the legacy recap renders on the Sat→Tue window
          and the story card renders below it. */}
      {(digestBlendEnabled ? digestBlendVisible : recapVisible) ? (() => {
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
        // ENG-740/1373 — PATTERN row reads `recap.dayOfWeekPattern` (same anchored+gated value the legacy story card below reads). Hero track reads the closest day's per-day target.
        const blendedExtras: import("../../lib/nutrition/digest").DigestBlendedExtras = {
          dayOfWeekPattern: recap.dayOfWeekPattern,
          closestDayTargetCalories: recap.bestDay?.targetCalories ?? null,
          patternWindowLabel: recap.patternWindowLabel,
        };
        return (
          <Digest
            blended={digestBlendEnabled}
            blendedExtras={blendedExtras}
            onAdjustPace={() => router.push("/settings#targets")}
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
            weightSurfaceMode={effectiveWeightSurfaceMode}
            // ENG-1019/1020 — history-aware empty + check-in copy. Any logged
            // day in the journal store → returning user, not a cold start
            // (same derivation as the Progress story gate above; mirror of
            // mobile `weekly-recap.tsx`).
            hasHistory={Object.keys(nutritionByDay).some(
              (k) => (nutritionByDay[k] ?? []).length > 0,
            )}
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

      {/* Week digest — narrative LEAD card (customer-lens audit 2026-04-30 +
          D-2026-04-27-17). ENG-740 — suppressed when `progress_digest_blend`
          is on (blended card above absorbs this). `dayOfWeekPattern` (Lose
          It "Closer" parity slot) reads `recap.dayOfWeekPattern`, same
          anchored+gated value as above (ENG-1373). */}
      {digestBlendEnabled ? null : (
        <div className="mb-4">
          <DigestStoryCard
            weekLabel={recap.weekLabel}
            daysLogged={recap.daysLogged}
            avgCalories={recap.avgCalories}
            targetCalories={targets.calories}
            avgProtein={recap.avgProtein}
            targetProtein={targets.protein}
            proteinOnTargetDays={digestWeekStats.proteinOnTarget}
            closestToTarget={recap.bestDay
              ? {
                  label: recap.bestDay.label,
                  calories: recap.bestDay.calories,
                  protein: recap.bestDay.protein,
                }
              : null}
            dayOfWeekPattern={recap.dayOfWeekPattern}
          />
        </div>
      )}

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
          <Icons.calories className="h-3.5 w-3.5 text-warning-solid shrink-0" aria-hidden />
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
              {`${streakDays} day${streakDays === 1 ? "" : "s"}`}
              {freezesAvailable > 0 ? (
                <span className="ml-1.5 text-[11px] font-normal text-primary-solid">
                  {`· ${freezesAvailable} freeze${freezesAvailable === 1 ? "" : "s"}`}
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

      {/* STREAK FREEZES (Batch 4.11) — extracted to StreakFreezeCard
          (ENG-1372 slice 2) so the zero-collapse addition stays within the
          pinned line budget. Component owns its own freezeBudgetMax<=0 hide
          + zero-triad collapse (law 3). */}
      <StreakFreezeCard
        freezeBudgetMax={freezeBudgetMax}
        freezesAvailable={freezesAvailable}
        freezeLedger={freezeLedger}
        protectedDateKeys={protectedStreakInfo.protectedDateKeys}
        rawStreakDays={rawStreakDays}
        streakDays={streakDays}
        emptyStateGrammarOn={isFeatureEnabled("empty_state_grammar_v1")}
      />

      {/* DAILY CALORIES + MACRO ADHERENCE detail grid — REMOVED in the
          492:2 reskin. It duplicated the same `dailyCaloriesData` +
          `weekStatsBundle` adherence data now owned by the frame's primary
          "Daily Calories" card (sage/amber + goal dots) and the "Average
          Adherence" card (the four macro bars Protein/Carbs/Fat/Fibre)
          above. No duplicate competing surfaces. The per-metric drill-down
          (`ProgressMetricDetail`) is still reachable from the demoted stat
          chips below — calories/protein/streak entry points preserved. */}

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
        // ENG-1506 — reuse the SAME `recapMaintenance` every sibling reads
        // (was a duplicated, driftable resolveMaintenance input block).
        const resolved = recapMaintenance;
        if (!resolved) return null;
        const showAdaptiveExtras = resolved.source === "adaptive";
        const showMeasuredExtras = resolved.source === "measured";
        // ENG-1189: honest "how close to adaptive?" status, measured against
        // the SAME gate the engine uses (gated full days + weigh-ins in the
        // trailing window, medium-confidence engage thresholds) — not the old
        // lifetime any-entry counts against the high-confidence /7 + /21 bars.
        const adaptiveProgress = computeAdaptiveDataProgressFromMeals({
          mealsByDay: nutritionByDay,
          weightByDay: weightKgByDay,
          sex: profileSexCached,
          weightKg: weightKg ?? null,
          heightCm: profileHeightCmCached,
          age: profileAgeCached,
        });
        return (
        <SupprCard elevation="card" padding="lg" radius="lg" className="mb-6 mt-6" data-testid="progress-maintenance-card">
          <div className="flex items-center gap-2 mb-3">
            <IconBox size="sm" tone="primary"><Icons.calories /></IconBox>
            <p className="font-[family-name:var(--font-headline)] text-[18px] font-medium text-foreground-brand">Maintenance</p>
            {showMeasuredExtras ? (
              <span
                data-testid="maintenance-source-pill"
                data-source="measured"
                className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success text-foreground"
              >
                Apple Health
              </span>
            ) : showAdaptiveExtras ? (
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
            {/* SLOE Phase 0: the maintenance hero kcal reads in the Newsreader
                serif display face (big numerals are a serif moment); the
                `kcal/day` unit stays sans. Mirrors mobile progress.tsx. */}
            <p className={`font-[family-name:var(--font-headline)] text-[28px] font-medium leading-none tabular-nums ${showAdaptiveExtras || showMeasuredExtras ? "text-success" : "text-foreground"}`}>
              {resolved.kcal.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">kcal/day</p>
          </div>

          {resolved.adaptiveRejectedBelowFormula && resolved.rejectedAdaptiveKcal != null && (
            <p className="text-xs text-muted-foreground mb-2">
              Adaptive estimate was {resolved.rejectedAdaptiveKcal.toLocaleString()} kcal — below your formula floor, so we&apos;re showing the formula estimate until logging catches up.
            </p>
          )}

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
                {" "}
                <span data-testid="maintenance-adaptive-status">{adaptiveProgress.message}</span>
              </>
            )}
          </p>

          {/* G-4 — "How this works" expandable (BMR → Maintenance → Calorie
              goal → projected loss). Extracted to `MaintenanceExplainer`
              (ENG-953 touch) to keep this screen under budget; same chain,
              same collapsed default, same testid, no new DB reads. */}
          <MaintenanceExplainer
            sex={profileSexCached}
            weightKg={weightKg ?? null}
            heightCm={profileHeightCmCached}
            age={profileAgeCached}
            activityLevel={profileActivityLevelCached}
            resolved={resolved}
            planPace={planPace}
            userGoal={userGoal}
            goalCalories={targets.calories}
            open={maintenanceExplainerOpen}
            onToggle={() => setMaintenanceExplainerOpen((v) => !v)}
          />

          {/* Data progress for non-adaptive users.
              ENG-1189 — counts + targets now come from the shared
              `computeAdaptiveDataProgressFromMeals` helper, which mirrors the
              engine's gate exactly: weigh-ins + GATED full logging days in the
              trailing 28-day window, against the MEDIUM-confidence engage
              thresholds (the bar at which adaptive actually surfaces). Was
              hardcoded `/7` + `/21` (the high-confidence tier) against lifetime
              any-entry counts, which let the bars read "full" while the engine
              was still gated. */}
          {!showAdaptiveExtras && (
            <div className="mt-3 pt-3 border-t border-border" data-testid="maintenance-data-progress">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">Weigh-ins</span>
                    <span className="text-[10px] font-semibold tabular-nums text-foreground" data-testid="maintenance-weighin-count">{adaptiveProgress.weighIns}/{adaptiveProgress.weighInsTarget}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (adaptiveProgress.weighIns / adaptiveProgress.weighInsTarget) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">Full logging days</span>
                    <span className="text-[10px] font-semibold tabular-nums text-foreground" data-testid="maintenance-logging-count">{adaptiveProgress.loggingDays}/{adaptiveProgress.loggingDaysTarget}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (adaptiveProgress.loggingDays / adaptiveProgress.loggingDaysTarget) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </SupprCard>
        );
      })()}

      {/* ENG-953 — calm "Expenditure" trend card (self-gates on default-ON `expenditure_trend_card`; parity: mobile `ExpenditureTrendCard`).
          ENG-1506 — behind `energy_numbers_v1` the copy comes from the SAME resolved maintenance as the card above (`expenditureFromResolved`);
          off → the legacy raw-column decision path inside the card. */}
      <ExpenditureTrendCard adaptiveTdee={adaptiveTdee} adaptiveConfidence={adaptiveConfidence} adaptiveUpdatedAt={adaptiveUpdatedAt} measuredTdee={measuredTdee}
        resolvedCopy={isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG) ? expenditureFromResolved(recapMaintenance, adaptiveUpdatedAt) : undefined} />

      {/* ENG-1237 — body fat + lean-mass trends (Pro-gated). */}
      <BodyCompositionTrendCard userTier={profileTier} refreshKey={bodyCompositionRefreshKey} />

      {/* WEIGHT TRACKING card — RELOCATED to frame position 4 above
          (Sloe Figma 492:2: Newsreader headline + Trend/Scale toggle +
          clay chart + START/CURRENT/GOAL/RATE row + Log weight). The
          win-moment overlay, measurement-system formatting, chart wiring,
          and the `weight_surface_mode === "show"` gate are all preserved
          there — this is the single canonical weight surface. */}

      {/* ENG-741 — Trajectory card. Sits directly under the weight chart.
          Flag-gated (`progress_trajectory_box`); default-off preserves the
          current layout. Same `effectiveWeightSurfaceMode === "show"` gate as the
          weight chart + Journey card so a single opt-out (T13 or the ENG-713
          trend-only pref) hides every absolute-weight surface. Reuses the
          top-level `latestWeightKg` +
          `goalTimeline` memos and the shared `computeTrajectory` helper —
          no projection maths is re-derived here. */}
      {trajectoryBoxEnabled && effectiveWeightSurfaceMode === "show" ? (
        <TrajectoryCard
          byDay={nutritionByDay}
          latestWeightKg={latestWeightKg}
          targetCalories={targets.calories}
          maintenanceTdeeKcal={isAdaptive && adaptiveTdee != null ? adaptiveTdee : staticTdee}
          goal={userGoal}
          timeline={goalTimeline}
          goalWeightKg={goalWeightKg}
        />
      ) : null}

      {/* JOURNEY / WEIGHT PROJECTION — also gated on profileWeightSurfaceMode
          (T13.2): the projection visualises absolute weight progression
          toward a goal kg, which is the exact thing trends_only / hide
          users opted out of. ENG-1373: gate now `hasGoalWeightData` (shared w/ GOAL/RATE row above) instead of inline `!= null`. */}
      {effectiveWeightSurfaceMode === "show" && weightKg != null && hasGoalWeightData({ goalWeightKg, latestWeightKg: weightKg }) && goalWeightKg !== weightKg && (() => {
        const goalWeightKg2 = goalWeightKg as number; // narrowed: hasGoalWeightData isn't a type predicate
        const timeline = calcGoalTimeline({ currentWeightKg: weightKg, goalWeightKg: goalWeightKg2, weightKgByDay });
        // F-4a (TestFlight `AHEeeC9a4-lKIyW5n7HgJxs`): canonical
        // `(start - current) / (start - goal)`, `start` = earliest logged
        // weight (falls back to current) — so `start === current` renders
        // a truly empty bar + "Just starting" copy.
        const sortedDays = Object.entries(weightKgByDay).sort(([a], [b]) => a.localeCompare(b));
        const startKg = sortedDays.length > 0 ? sortedDays[0][1] : weightKg;
        const pctFrac = computeWeightJourneyProgressPct({
          startKg,
          currentKg: weightKg,
          goalKg: goalWeightKg2,
        });
        const progressPct = pctFrac != null ? pctFrac * 100 : 0;
        const progressCopy = formatWeightJourneyProgressCopy(pctFrac);
        // ENG-1053 — shared with TrajectoryCard so Journey + Projected Weight
        // show the same "last 7 days averaged" kcal on one screen.
        const { avgCalories: avgRecentCals, daysWithFood: foodLoggedDayCount } =
          avgCaloriesOverRecentLoggedDays(nutritionByDay, 7);
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
        const projectionEligible = shouldRenderDailyProjection(foodLoggedDayCount);
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
              normalizeGoalVocabulary: isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG), // ENG-1506 — OFF keeps the legacy 'lose'/'gain'-only fallback
            })
          : null;

        return (
          <SupprCard elevation="card" padding="lg" radius="lg" className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <IconBox size="sm" tone="success"><Icons.check /></IconBox>
                <p className="font-[family-name:var(--font-headline)] text-[18px] font-medium text-foreground-brand">Journey</p>
              </div>
              {timeline.daysToGoal != null ? (
                <p className="text-right">
                  {/* SLOE Phase 0: days-to-goal hero numeral in serif; label stays sans. */}
                  <span className="font-[family-name:var(--font-headline)] text-[22px] font-medium text-primary-solid tabular-nums">{timeline.daysToGoal}</span>
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
                ? `${formatWeight(timeline.remainingKg)} to go until your ${formatWeight(goalWeightKg2)} goal.`
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
              <span className="text-[11px] font-semibold text-muted-foreground tabular-nums ph-mask">{formatWeight(goalWeightKg2)}</span>
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
            {dailyProjection && maintenanceTdeeKcal != null && (() => {
              const avgDeficit = Math.round(maintenanceTdeeKcal - avgRecentCals);
              const deficitLabel =
                avgDeficit > 0
                  ? `avg deficit ${avgDeficit.toLocaleString()} kcal/day`
                  : avgDeficit < 0
                    ? `avg surplus ${Math.abs(avgDeficit).toLocaleString()} kcal/day`
                    : "at maintenance";
              return (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {/* Deficit is what drives the projection — show it so the
                        user can see why the estimate moves at this rate. */}
                    Last 7 days averaged {avgRecentCals.toLocaleString()} kcal/day — {deficitLabel}. On that trend you&apos;d reach{" "}
                    <span className="font-bold text-primary-solid ph-mask">{formatWeight(dailyProjection.projectedWeightKg)}</span> in ~{dailyProjection.projectionWeeks} weeks.
                  </p>
                </div>
              );
            })()}
          </SupprCard>
        );
      })()}

      {/* Activity feeding maintenance — v3 read-only AppleHealthCard behind
          `web_apple_health_card` (parity with mobile), else the legacy manual
          Steps + Body-Fat inputs. Extracted to a child so this pinned host
          shrinks (ENG-1225 gap #21). */}
      <ProgressActivitySection
        fetchSnapshot={fetchHealthSnapshot}
        useImperial={profileMeasurementSystem === "imperial"}
        stepsByDay={stepsByDay}
        dailyStepsGoal={dailyStepsGoal}
        stepsChartData={stepsChartData}
        stepsInput={stepsInput}
        setStepsInput={setStepsInput}
        saveTodaySteps={saveTodaySteps}
        bodyFatPct={bodyFatPct}
        bodyFatInput={bodyFatInput}
        setBodyFatInput={setBodyFatInput}
        saveBodyFat={saveBodyFat}
      />
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

/* ── Sloe Figma 492:2 reskin ──────────────────────────────────────
   The desktop Phase-2 card set (WeightSparkline, WeightRangeCardWeb,
   CaloriesRangeCardWeb, ProteinRangeCardWeb, TrendSummaryCardWeb) is
   removed — its data is now owned by the frame's Average Adherence card,
   the AVG/TDEE/DEFICIT triad, and the relocated weight card. Only the
   `trends_only` direction tile survives (it's the body-neutral opt-out
   surface, not part of the removed dense grid). */

/**
 * T13.2: trends-only weight card, shown whenever the EFFECTIVE weight-surface
 * mode is `trends_only` — the DB-backed `weight_surface_mode` (T13) OR the
 * client-side "Trend-only weight" opt-in (ENG-713). Never emits an absolute kg
 * value. Copy comes from the shared `describeTrendOnly` helper so web + mobile
 * can't drift; those strings need diversity-inclusion + legal sign-off before ramp.
 */
function WeightTrendOnlyCardWeb({
  weekDeltaKg,
  windowLabel,
}: {
  weekDeltaKg: number | null;
  /** Period label for the window descriptor (ENG-1030), e.g. "15–21 Jun". */
  windowLabel: string;
}) {
  // ENG-713 — direction + neutral copy come from the shared trend-only helper so
  // web + mobile can't drift and the strings live in one reviewable place (the
  // copy needs diversity-inclusion + legal sign-off before ramp).
  const direction = trendOnlyDirection(weekDeltaKg);
  // ENG-713 — no directional glyph. The neutral phrase carries the direction; an
  // ↗/↘ shape would re-add the visual up/down valence this mode exists to remove
  // (legal review 2026-07-01). `direction` still drives the shared neutral copy.
  const label = describeTrendOnly(direction);
  return (
    <SupprCard
      data-testid="progress-weight-trend-only-card"
      elevation="card"
      padding="lg"
      radius="lg"
      className="mb-4"
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Weight trend
      </p>
      <p className="mt-2">
        <span className="text-[15px] font-semibold text-foreground">{label}</span>
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {TREND_ONLY_MODE_NOTE} · {windowLabel}
      </p>
    </SupprCard>
  );
}


/**
 * 2026-04-20 prototype port — Suspense fallback mirrors the header
 * chrome used in the inner `loading` branch so React's lazy-load
 * boundary doesn't flash a text-only "Loading…" line before the
 * client-side supabase fetch-driven skeleton mounts. The fallback shows
 * header chrome only; the period control (ENG-1030) appears in the inner
 * `loading` skeleton once `ProgressDashboardContent` mounts.
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
      <ProgressTabChrome overline="Your trends" trailing={calendarPlaceholder} />
      <div
        className="hidden md:block product-shell py-pm-6"
        data-testid="progress-suspense-fallback"
      >
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-tertiary mb-1">
              Your trends
            </p>
            <h1
              data-testid="progress-header"
              className="font-[family-name:var(--font-headline)] text-3xl font-medium tracking-tight text-foreground-brand"
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
