import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, ScrollView, Text, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  BarChart3,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Flag,
  Scale,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react-native";
import Svg, { Polyline, Circle } from "react-native-svg";

import { AppleHealthCard, type AppleHealthCardStatus } from "@/components/AppleHealthCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useHaptics } from "@/hooks/useHaptics";
import { useCardElevation } from "@/hooks/useCardElevation";
import { CARD_RADIUS, SupprCard } from "@/components/ui/SupprCard";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { Layout } from "@/constants/layout";
import { ProgressTabChrome } from "@/components/tabs/ProgressTabChrome";
import { Milestone30DayModal } from "@/components/today/Milestone30DayModal";
import { useMilestone30DayOnProgress } from "@/hooks/useMilestone30DayOnProgress";
import { Accent, FontFamily, MacroColors, Spacing, Radius, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useEntranceAnimation } from "@/hooks/useEntranceAnimation";
import ReAnimated from "react-native-reanimated";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { dateKeyFromDate, type ByDay } from "@/lib/nutritionJournal";
import {
  calcGoalTimeline,
  computeWeightJourneyProgressPct,
  formatWeightJourneyProgressCopy,
  projectWeight,
  resolveLatestWeightKg,
  shouldRenderDailyProjection,
  weightJourneyProgress,
} from "@/lib/weightProjection";
import { calculateTDEE, getEffectiveTDEE } from "@/lib/calcTargets";
import { resolveMaintenance , formatMaintenanceRecapLine } from "@suppr/shared/nutrition/resolveMaintenance";
import { buildMaintenanceChain } from "@suppr/shared/nutrition/maintenanceChain";
import type { PlanPace } from "@suppr/shared/nutrition/tdee";
import {
  coerceMeasurementSystem,
  formatWeightForUnit,
  type MeasurementSystem,
} from "@suppr/shared/measurements";
import {
  coerceWeightSurfaceMode,
  type WeightSurfaceMode,
} from "@suppr/shared/nutrition/weightSurfaceMode";
import { syncHealthDataThrottled, isHealthSyncAvailable } from "@/lib/healthSync";
import { buildWeekStats, type WeekActivityAdjustment } from "@/lib/progressWeekReport";
import {
  buildCaloriesRangeStats,
  buildMacroAdherenceRangeStats,
  buildWeightRangeStats,
  type RangeKey,
} from "@suppr/shared/nutrition/progressRangeStats";
import { getDailyTargets, type DailyTarget } from "@suppr/shared/nutrition/dailyTargetRead";
import {
  readFreezeLedger,
  type FreezeLedger,
} from "@/lib/streakFreeze";
import {
  buildUsualMealRecapInsight,
  buildWeeklyRecap,
  shouldShowRecap,
  weekKeyFor,
  type UsualMealRecapInsight,
} from "@/lib/weeklyRecap";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listSavedMeals, type SavedMeal, type SavedMealItem } from "@suppr/shared/nutrition/savedMeals";
import { normaliseRecipeTitle, selectMostFrequentSlotSeed } from "@suppr/shared/nutrition/usualMealHint";
import {
  PENDING_USUAL_MEAL_SAVE_KEY,
  serializePendingUsualMealSave,
} from "@suppr/shared/nutrition/pendingUsualMealSave";
import { formatRecapForShare } from "@/lib/weeklyRecap";
import { resolveDigestHeadline } from "@suppr/shared/nutrition/digest";
import type { DigestBlendedExtras } from "@suppr/shared/nutrition/digest";
import { isFeatureEnabled, track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { WinMomentPlayer, type WinMomentCelebration } from "@/components/ui/WinMomentPlayer";
import { Digest, type DigestUsualMeal } from "@/components/Digest";
import { HouseholdBar } from "@/components/HouseholdBar";
// Phase 4 (B3.1, 2026-04-27) — Surface E "Progress hero (story-led)".
// Authority: D-2026-04-27-17 (Progress is a story not a stat-card
// dashboard) + D-2026-04-27-12 (adaptive TDEE always-on).
import { ProgressHeadline } from "@/components/today/ProgressHeadline";
import { ProgressStoryGate } from "@/components/today/ProgressStoryGate";
import { hasEnoughDataForStory } from "@/lib/progressStoryGate";
import { DigestStoryCard } from "@/components/progress/DigestStoryCard";
import { TrajectoryCard } from "@/components/progress/TrajectoryCard";
import { computeDayOfWeekPattern } from "@suppr/shared/nutrition/dayOfWeekPattern";
import { generateProgressCommentary } from "@/lib/progressCommentary";
import { LogWeightSheet } from "@/components/progress/LogWeightSheet";
import { AllWeightDataSheet } from "@/components/progress/AllWeightDataSheet";
// Sloe Figma 492:2 — frame sections (web + mobile parity).
import { ProgressAverageAdherence } from "@/components/progress/ProgressAverageAdherence";
import { ProgressEnergyTriad } from "@/components/progress/ProgressEnergyTriad";
import { ProgressOnTargetRibbon } from "@/components/progress/ProgressOnTargetRibbon";
import {
  computeWeightTrend,
  weightKgByDayToPoints,
  type WeightRange,
} from "@/lib/progress/weightTrend";

/* ── Helpers ── */
function parseNumMap(raw: unknown): Record<string, number> {
  let o: Record<string, unknown> | null = null;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) o = p as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    o = raw as Record<string, unknown>;
  }
  if (!o) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function IconBox({ color, size = 28, children }: { color: string; size?: number; children: React.ReactNode }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 3.5, backgroundColor: color + "18", alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}

// `fiber: 28` mirrors the web `normalizeMacroTargets` default (src/types/
// profile.ts) so the AVERAGE ADHERENCE card's Fibre bar reads the SAME
// baseline on both platforms when the user has no explicit fibre target.
const DEFAULT_TARGETS = { calories: NUTRITION_DEFAULTS.calories, protein: NUTRITION_DEFAULTS.protein, carbs: NUTRITION_DEFAULTS.carbs, fat: NUTRITION_DEFAULTS.fat, fiber: 28 };

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the local accent
  // token + the "Daily Calories" section-header tint. The calorie data series
  // itself (goal dot / chart) keeps clay via `t.carbs`; status keeps
  // success/warning/destructive; macros keep `MacroColors`.
  const accent = useAccent();
  const haptics = useHaptics();
  const cardElevation = useCardElevation();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [byDay, setByDay] = useState<ByDay>({});
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null);
  const [weightKgByDay, setWeightKgByDay] = useState<Record<string, number>>({});
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [weekStartDay, setWeekStartDay] = useState<"monday" | "sunday">("monday");
  const [userGoal, setUserGoal] = useState<string | null>(null);
  // Plan pace is read from `profiles.plan_pace` alongside goal. Used by
  // the G-4 Maintenance chain explainer (2026-04-19) to derive the
  // daily-deficit row. Defaults to `steady` so the explainer can still
  // render on profiles predating the column.
  const [planPace, setPlanPace] = useState<PlanPace>("steady");
  // G-4 (2026-04-19) — "How this works" expandable under the
  // Maintenance card. In-memory only; a collapse on one visit shouldn't
  // persist past next focus.
  const [maintenanceExplainerOpen, setMaintenanceExplainerOpen] = useState(false);

  // F-2 (2026-04-19) — `daily_targets` snapshots keyed by `YYYY-MM-DD`.
  // Past days render "% of goal" against the target that was active
  // *on that day*. Days with no snapshot (pre-migration) fall back to
  // the current target and the UI marks that row as approximate.
  const [dailyTargetsByDay, setDailyTargetsByDay] = useState<Record<string, DailyTarget | null>>({});
  // ENG-787 (2026-05-30) — per-day burn + workout + preference maps so the
  // Daily Calories chart can judge each bar against that day's *effective*
  // calorie budget (base target + earned activity bonus), reconciling
  // exactly with the Today ring. `AppleHealthCardHost` loads its own copy
  // for the HK card; this host-level copy feeds `buildWeekStats`.
  const [activityBurnByDay, setActivityBurnByDay] = useState<Record<string, number>>({});
  const [basalBurnByDay, setBasalBurnByDay] = useState<Record<string, number>>({});
  const [workoutsByDay, setWorkoutsByDay] = useState<Record<string, { calories?: number }[]>>({});
  const [preferActivityAdjusted, setPreferActivityAdjusted] = useState(false);
  const [milestone30ShownAt, setMilestone30ShownAt] = useState<string | null>(null);
  const [progressTabFocused, setProgressTabFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setProgressTabFocused(true);
      return () => setProgressTabFocused(false);
    }, []),
  );

  // Batch 4.11 — streak freeze + weekly recap state
  const [freezeLedger, setFreezeLedger] = useState<FreezeLedger>({
    earnedAt: [],
    usedHistory: [],
  });
  const [freezeBudgetMax, setFreezeBudgetMax] = useState<number>(3);
  const [recapLastSeenWeekKey, setRecapLastSeenWeekKey] = useState<string | null>(null);

  // Adaptive TDEE
  const [staticTdee, setStaticTdee] = useState<number | null>(null);
  const [adaptiveTdee, setAdaptiveTdee] = useState<number | null>(null);
  const [adaptiveConfidence, setAdaptiveConfidence] = useState<string | null>(null);
  const [adaptiveUpdatedAt, setAdaptiveUpdatedAt] = useState<string | null>(null);
  const [isAdaptiveTdee, setIsAdaptiveTdee] = useState(false);
  // Profile basics cached for the shared `resolveMaintenance` resolver —
  // lets us fall back to the Mifflin formula when adaptive TDEE is
  // missing / low-confidence / stale (F-3, 2026-04-19).
  const [profileSexState, setProfileSexState] = useState<string>("unspecified");
  const [profileHeightCmState, setProfileHeightCmState] = useState<number>(170);
  const [profileAgeState, setProfileAgeState] = useState<number>(30);
  const [profileActivityLevelState, setProfileActivityLevelState] = useState<string>("sedentary");
  // Action 13 Item #6 + #7 (2026-04-19) — `measurement_system` column
  // drives every weight readout on this screen (Trend tile delta,
  // Weight card current/goal). Was previously unread on Progress;
  // every other weight surface respected the preference, so an imperial
  // user saw "lb" everywhere except here where it stuck on "kg".
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>("metric");
  // T13 (2026-04-24) — Digest + Progress + weight-chart opt-out mode.
  // Loaded from profiles.weight_surface_mode; defaults to "show" to
  // preserve legacy behaviour.
  const [weightSurfaceMode, setWeightSurfaceMode] = useState<WeightSurfaceMode>("show");

  // Weight sparkline window is fixed at 1 month (the frame's weight card
  // shows a recent trend, not a switchable range — the time-range pills at
  // the top drive the stat-row + adherence figures, not the mini chart).
  const weightChartRange: WeightRange = "1m";

  // Weight chart consolidation Phase 1 (2026-05-11, B6). Inline
  // log-weight sheet replaces the prior `/weight-tracker` push for the
  // 4 CTAs on this screen. The route itself is still alive for
  // backwards compat; Phase 3 deletes it.
  const [logWeightOpen, setLogWeightOpen] = useState(false);

  // ENG-748 #9 (2026-05-27): when set, the LogWeightSheet opens in
  // edit-in-place mode targeting this date (correct a mistyped past
  // weigh-in, keep its date) rather than logging a new entry for today.
  // Cleared whenever the sheet closes so the next plain "Log weight" CTA
  // is a fresh today-log.
  const [editWeightDate, setEditWeightDate] = useState<string | null>(null);

  // 2026-05-11 (Grace TF feedback): Withings-style "All data" list view
  // for weigh-ins. Opens from the list icon next to the Weight chart
  // header. Long-press a row to edit or delete that entry.
  const [allWeightDataOpen, setAllWeightDataOpen] = useState(false);

  // ENG-824 (Redesign — Design Direction 2026): the reserved weight
  // win-moment. Set to a celebration when a saved weigh-in is a new
  // all-time low; the WinMomentPlayer overlay plays it once then clears.
  // The LogWeightSheet owns the `redesign_winmoment` gate + the success
  // haptic; this only mounts the (lazy) Lottie celebration.
  const [weightWinCelebration, setWeightWinCelebration] =
    useState<WinMomentCelebration | null>(null);

  // H-4 (build 12, 2026-04-19, TestFlight `AEb7NcjnvK`): defer the
  // heavy below-the-fold blocks (daily-calories chart, maintenance
  // card, journey card) by one frame after data lands so the first
  // post-load paint is the cheap stat-grid + weekly-recap card. Prior
  // code rendered everything on the sync render path, which on warm
  // focus pushed first meaningful paint past the 1s budget even with
  // the data-fetch optimisations. `chartsReady` flips in an effect
  // after `loading` goes false, so the next render tree includes the
  // charts. Computed numbers are identical either way; this only
  // controls WHEN the chart JSX evaluates.
  const [chartsReady, setChartsReady] = useState(false);

  /**
   * Action 13 Item #10 (2026-04-19) — HealthKit sync status for the
   * Steps card. Tri-state so we can distinguish:
   *   - "pending"  — never called HK yet (initial mount, fresh focus)
   *                  → render skeleton, NOT a literal 0
   *   - "success"  — HK call resolved (with or without samples)
   *                  → render `stepsToday` honestly (0 means 0)
   *   - "failed"   — HK call rejected (permissions, native bridge)
   *                  → render "Steps sync paused — open Health
   *                    permissions" with a tap-to-retry, NOT a 0
   *
   * Previously the HK call was `.catch(() => {})` and the card always
   * rendered `(stepsByDay[todayKey] ?? 0)`. A failed sync looked
   * indistinguishable from "you haven't walked yet" — the user reads
   * "0 / 10,000" and assumes the count is real.
   */
  const [stepsSyncStatus, setStepsSyncStatus] = useState<"pending" | "success" | "failed">("pending");
  const [stepsSyncRetrying, setStepsSyncRetrying] = useState(false);

  // 2026-04-20 Claude Design prototype port — range picker pills.
  // Mirrors the `[7d, 30d, 90d, All]` chips in the prototype's
  // `ProgressScreen`. Default `30d` matches the prototype's most
  // common anchor state for a user who's been logging for a few weeks;
  // sparse-logger users still see something useful (single-day bars are
  // still plotted). Selected range drives the range-scoped stats + the
  // weight/calorie windows. Sloe Figma 492:2 retired the `LAST N DAYS`
  // overline — the calm header subtitle + the pills carry the context.
  const [rangeKey, setRangeKey] = useState<"7d" | "30d" | "90d" | "all">("30d");

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  const latestWeightKg = useMemo(
    () => resolveLatestWeightKg(weightKgByDay, weightKg),
    [weightKgByDay, weightKg],
  );

  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);

    // Skeleton-gate fix (2026-04-20, Claude Design prototype port):
    // the prior shape of this function had no try/catch. If any of the
    // `await`s threw — a supabase network blip, an auth-expiry-mid-call,
    // a `maybeSingle` RLS refusal — we would exit the function before
    // reaching `setLoading(false)`, leaving the screen stuck on the
    // 2x2 skeleton tiles + inline spinner indefinitely. Grace's
    // testflight screenshot (2026-04-20) showed exactly that symptom.
    // The fix wraps the whole fetch+hydrate path in try/finally so the
    // loading flag ALWAYS flips once, even on the sad path. Error
    // branches intentionally leave the existing state defaults in
    // place so the post-load render falls through to either the
    // hasData tree or the "Your progress will appear here" empty state.
    try {

    // Performance fix (P2-1, 2026-04-18): the previous version awaited
    // `syncHealthDataThrottled` for the entire render so the loading
    // spinner blocked on 6 serial HealthKit reads + 6 serial profile
    // updates (3-8s on a fresh focus). Now the sync fires in the
    // background; we render as soon as `nutrition_entries` + `profile`
    // resolve, then re-fetch `steps_by_day` once the sync finishes so
    // today's steps are still correct (the AD6_… steps-drift fix is
    // preserved by the follow-up read, just not paid for in TTI).
    //
    // Also caps `nutrition_entries` to the last 90 days — no card on
    // this screen looks back further (90d trend chart is the longest
    // window). Prior unbounded select pulled the user's entire history
    // every focus.
    //
    // Perf fix H-4 (build 12, 2026-04-19, TestFlight `AEb7NcjnvK`):
    // `getDailyTargets` used to run *after* the `profile` read and
    // before `setLoading(false)`. That made it a second serial RTT on
    // the critical path — total TTI was `profile + daily_targets`,
    // which on a cold/warm focus pushed the spinner past the 1-2s
    // budget. We now let the profile read unblock the first paint and
    // hydrate `daily_targets` in the background. Past-day bar colour
    // briefly uses the current target (shared `resolveDisplayTarget`
    // fallback is lossless) and reconciles the instant snapshots
    // arrive. Today's bar was never snapshot-dependent — `daily_targets`
    // only snapshots *past* days, so no computed number flips for the
    // current day.
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    // Action 13 Item #10 — track HK sync status so the Steps card
    // can render "Sync paused" instead of a misleading bare 0 when
    // HealthKit refuses (permissions, native bridge crash, etc.).
    // When HK isn't available at all (e.g. simulator without health,
    // Expo Go, Android), we treat the sync as "success" — the card
    // falls back to manual `stepsByDay` and the user-supplied value
    // is honestly what we know.
    //
    // F-147 (2026-05-10): the previous flow flipped `stepsSyncStatus`
    // to "success" immediately when the sync promise resolved, but
    // the steps_by_day re-read (line below) hadn't yet landed. The
    // success branch then rendered stale state — for users whose
    // initial profile load had no row for today, that meant a flash
    // of "0 steps" while Today (which has a different sync timing)
    // showed the correct count. The fix: defer the success flip
    // until AFTER the re-read writes the new state, so the moment
    // the success branch renders, the data is accurate. Failure
    // path is unchanged.
    setStepsSyncStatus("pending");
    const syncPromise: Promise<void> = isHealthSyncAvailable()
      ? syncHealthDataThrottled(userId).then(
          () => {
            // Status flip is intentionally deferred to the re-read
            // handler below so the big number paints with fresh data.
          },
          () => {
            setStepsSyncStatus("failed");
          },
        )
      : (setStepsSyncStatus("success"), Promise.resolve());

    // Debug audit 2026-05-04 (code-quality #1 CRITICAL): the existing
    // try/finally protects against rejected promises but NOT against a
    // hung PostgREST (NAT/Cloudflare wedge or RLS deadlock — the same
    // class of bug fixed on Today via `raceJournal`). A non-settling
    // await never reaches the finally block. Now: wrap each query in a
    // 30s timeout race. On timeout we surface a sentinel and fall
    // through to the empty/hasData branches with `setLoadError` set so
    // the user sees a recovery affordance instead of perpetual skeleton.
    const PROGRESS_QUERY_TIMEOUT_MS = 30_000;
    const progressTimeoutSentinel = Symbol("progress_query_timeout");
    async function raceProgress<T>(label: string, p: Promise<T>): Promise<T | typeof progressTimeoutSentinel> {
      const out = await Promise.race([
        p,
        new Promise<typeof progressTimeoutSentinel>((resolve) => {
          setTimeout(() => resolve(progressTimeoutSentinel), PROGRESS_QUERY_TIMEOUT_MS);
        }),
      ]);
      if (out === progressTimeoutSentinel) {
        console.warn(`[progress] ${label} timed out (${PROGRESS_QUERY_TIMEOUT_MS}ms)`);
      }
      return out;
    }
    const entriesPromise = (async () =>
      await supabase
        .from("nutrition_entries")
        // Sloe Figma 492:2 — `fiber_g` added so the AVERAGE ADHERENCE card's
        // Fibre bar reads a REAL value (matches web `nutritionByDay.fiberG`),
        // not a phantom 0. Legacy rows with null fibre count as 0 (never
        // fabricated).
        .select("date_key, calories, protein, carbs, fat, fiber_g")
        .eq("user_id", userId)
        .gte("date_key", ninetyDaysAgo)
        .order("created_at", { ascending: true }))();
    const profilePromise = (async () =>
      await supabase
        .from("profiles")
        .select("target_calories, target_protein, target_carbs, target_fat, target_fiber_g, weight_kg, goal_weight_kg, weight_kg_by_day, steps_by_day, daily_steps_goal, week_start_day, goal, plan_pace, sex, height_cm, age, activity_level, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history, weekly_recap_last_seen_week_key, weekly_recap_push_enabled, measurement_system, weight_surface_mode, milestone_30_shown_at, activity_burn_by_day, basal_burn_by_day, workouts_by_day, prefer_activity_adjusted_calories")
        .eq("id", userId)
        .maybeSingle())();
    const [entriesResult, profileResult] = await Promise.all([
      raceProgress("nutrition_entries", entriesPromise),
      raceProgress("profiles", profilePromise),
    ]);
    if (entriesResult === progressTimeoutSentinel || profileResult === progressTimeoutSentinel) {
      // Hung query — bail out of hydrate path so the spinner clears
      // and the user sees the existing empty/hasData fallback.
      return;
    }
    const { data: rows } = entriesResult;
    const { data: profile } = profileResult;

    // Re-read `steps_by_day` after the background HK sync completes so
    // today's steps are accurate even though we didn't await sync above.
    //
    // F-147 (2026-05-10): the success status flip moved here so the
    // big number doesn't paint while we're still waiting on the
    // re-read. If the sync resolved but the re-read failed (network
    // hiccup mid-flight), we still flip to success — the user has
    // the existing local state and a stale-but-honest number, which
    // is better than perpetual skeleton.
    void syncPromise.then(async () => {
      try {
        const { data: refreshed } = await supabase
          .from("profiles")
          .select("steps_by_day, weight_kg_by_day, weight_kg")
          .eq("id", userId)
          .maybeSingle();
        if (refreshed) {
          setStepsByDay(parseNumMap((refreshed as any).steps_by_day));
          setWeightKgByDay(parseNumMap((refreshed as any).weight_kg_by_day));
          const w = (refreshed as any).weight_kg != null ? Number((refreshed as any).weight_kg) : null;
          if (Number.isFinite(w)) setWeightKg(w);
        }
      } finally {
        // Only flip if the sync itself didn't already mark failed.
        setStepsSyncStatus((prev) => (prev === "failed" ? prev : "success"));
      }
    });

    if (profile) {
      setTargets({
        calories: (profile.target_calories as number) ?? DEFAULT_TARGETS.calories,
        protein: (profile.target_protein as number) ?? DEFAULT_TARGETS.protein,
        carbs: (profile.target_carbs as number) ?? DEFAULT_TARGETS.carbs,
        fat: (profile.target_fat as number) ?? DEFAULT_TARGETS.fat,
        // Sloe Figma 492:2 — real fibre target for the AVERAGE ADHERENCE
        // Fibre bar; falls back to the shared 28g default when unset.
        fiber: ((profile as { target_fiber_g?: number | null }).target_fiber_g as number) ?? DEFAULT_TARGETS.fiber,
      });
      const w = profile.weight_kg != null ? Number(profile.weight_kg) : null;
      const gw = profile.goal_weight_kg != null ? Number(profile.goal_weight_kg) : null;
      setWeightKg(Number.isFinite(w) ? w : null);
      setGoalWeightKg(Number.isFinite(gw) ? gw : null);
      setWeightKgByDay(parseNumMap(profile.weight_kg_by_day));
      setStepsByDay(parseNumMap(profile.steps_by_day));
      // ENG-787 — burn + workout + preference for the effective-target chart.
      setActivityBurnByDay(parseNumMap((profile as any).activity_burn_by_day));
      setBasalBurnByDay(parseNumMap((profile as any).basal_burn_by_day));
      setWorkoutsByDay(
        ((profile as any).workouts_by_day ?? {}) as Record<string, { calories?: number }[]>,
      );
      setPreferActivityAdjusted(Boolean((profile as any).prefer_activity_adjusted_calories));
      if (profile.week_start_day === "sunday" || profile.week_start_day === "monday") {
        setWeekStartDay(profile.week_start_day);
      }
      setUserGoal((profile as any).goal ?? null);
      // Coerce plan_pace to the PlanPace union; fall back to "steady"
      // when the column is missing or carries an unexpected value so
      // the explainer has a sensible default deficit to show.
      const pace = String((profile as any).plan_pace ?? "").toLowerCase();
      if (pace === "relaxed" || pace === "steady" || pace === "accelerated" || pace === "vigorous") {
        setPlanPace(pace);
      }

      // Batch 4.11 — freeze ledger + recap state
      const rawEarned = (profile as any).streak_freezes_earned_at;
      const rawUsed = (profile as any).streak_freezes_used_history;
      setFreezeLedger(readFreezeLedger({ earnedAt: rawEarned, usedHistory: rawUsed }));
      const rawBudget = Number((profile as any).streak_freeze_budget_max);
      setFreezeBudgetMax(Number.isFinite(rawBudget) ? Math.max(0, Math.min(10, rawBudget)) : 3);
      const rawLastSeen = (profile as any).weekly_recap_last_seen_week_key;
      setRecapLastSeenWeekKey(typeof rawLastSeen === "string" ? rawLastSeen : null);
      setMilestone30ShownAt(
        typeof (profile as { milestone_30_shown_at?: unknown }).milestone_30_shown_at === "string"
          ? (profile as { milestone_30_shown_at: string }).milestone_30_shown_at
          : null,
      );

      // Compute TDEE values
      const sex = ((profile as any).sex as string) ?? "unspecified";
      const heightCm = Number((profile as any).height_cm) || 170;
      const ageVal = Number((profile as any).age) || 30;
      // Default to "sedentary" (1.2) when missing — "moderate" (1.55) silently
      // over-inflated TDEE by ~14% for users who never picked a level
      // (TestFlight `AIIm60nKi_sTu3-4YjR-WR4`, 2026-04-18).
      const actLevel = ((profile as any).activity_level as string) ?? "sedentary";
      const wForTdee = Number.isFinite(w) ? w! : 70;
      const sTdee = calculateTDEE(sex, wForTdee, heightCm, ageVal, actLevel);
      setStaticTdee(sTdee);
      const aTdee = (profile as any).adaptive_tdee != null ? Number((profile as any).adaptive_tdee) : null;
      setAdaptiveTdee(Number.isFinite(aTdee) ? aTdee : null);
      const aConf = ((profile as any).adaptive_tdee_confidence as string) ?? null;
      setAdaptiveConfidence(aConf);
      setAdaptiveUpdatedAt(((profile as any).adaptive_tdee_updated_at as string | null) ?? null);
      setProfileSexState(sex);
      setProfileHeightCmState(heightCm);
      setProfileAgeState(ageVal);
      setProfileActivityLevelState(actLevel);
      // Action 13 #6 + #7 — single source for the imperial / metric
      // preference on every weight readout on this screen.
      setMeasurementSystem(coerceMeasurementSystem((profile as any).measurement_system));
      setWeightSurfaceMode(coerceWeightSurfaceMode((profile as any).weight_surface_mode));
      const eff = getEffectiveTDEE({
        adaptive_tdee: aTdee,
        adaptive_tdee_confidence: aConf,
        sex, weight_kg: wForTdee, height_cm: heightCm, age: ageVal, activity_level: actLevel,
      });
      setIsAdaptiveTdee(eff.isAdaptive);
    }

    if (rows) {
      const loaded: ByDay = {};
      for (const r of rows) {
        const k = r.date_key as string;
        if (!loaded[k]) loaded[k] = [];
        loaded[k].push({
          id: "",
          name: "",
          recipeTitle: "",
          time: "",
          calories: (r.calories as number) ?? 0,
          protein: (r.protein as number) ?? 0,
          carbs: (r.carbs as number) ?? 0,
          fat: (r.fat as number) ?? 0,
          // Sloe Figma 492:2 — fibre rollup for the AVERAGE ADHERENCE card.
          fiberG: ((r as { fiber_g?: number | null }).fiber_g as number) ?? 0,
        });
      }
      setByDay(loaded);
    }

    // H-4 — first paint unblocks here. `daily_targets` hydrates in the
    // background (see below); the UI renders with current-target
    // fallback until snapshots arrive.
    setLoading(false);

    // F-2 — fetch `daily_targets` for this week's 7 day keys so past
    // days render against their frozen target. Missing snapshots
    // (pre-migration) stay null → UI falls back to current target.
    // Deferred off the first-paint critical path (H-4). Safe because
    // `buildWeekStats` inherits the current `targets` for every day
    // the map doesn't have a snapshot for, so numbers are correct from
    // the very first frame — only a past-day bar's colour could briefly
    // flip if the user edited their plan mid-week.
    {
      const nowD = new Date();
      const dow = nowD.getDay();
      const wsd = (profile as any)?.week_start_day === "sunday" ? "sunday" : "monday";
      const startOffset = wsd === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
      const weekFirst = new Date(nowD);
      weekFirst.setDate(nowD.getDate() + startOffset);
      const weekKeys: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekFirst);
        d.setDate(weekFirst.getDate() + i);
        weekKeys.push(dateKeyFromDate(d));
      }
      void getDailyTargets(supabase, userId, weekKeys)
        .then((snapshots) => {
          setDailyTargetsByDay(snapshots);
        })
        .catch(() => {
          /* fallback already in place (map stays empty → current targets). */
        });
    }
    } catch (err) {
      // Skeleton-gate fix (2026-04-20): surface failures so we still
      // flip `loading` → false and the user gets the empty state +
      // a pull-to-refresh path rather than an indefinite skeleton.
       
      console.warn("Progress loadData failed", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  // Belt-and-braces: if `userId` arrives AFTER the screen is already
  // focused (auth resolved after tab landed), `useFocusEffect` won't
  // re-fire on its own and the skeleton would stick. Retrigger whenever
  // `userId` flips from null → defined. Grace 2026-04-21 TestFlight.
  useEffect(() => {
    if (userId) void loadData();
  }, [userId, loadData]);

  // H-4 — after the initial data-fetch unblocks, defer mounting the
  // heavy chart + journey blocks by one frame so the first post-load
  // paint shows header + stat grid + recap card only. RAF hands back
  // control to RN's render loop, then the second paint adds the charts.
  useEffect(() => {
    if (loading) {
      // Reset when we re-enter the loading state so a fresh focus
      // (e.g. pull-to-refresh) re-stages the paint.
      setChartsReady(false);
      return;
    }
    const handle = requestAnimationFrame(() => setChartsReady(true));
    return () => cancelAnimationFrame(handle);
  }, [loading]);

  // F-2 — shape snapshots into `DayTargetOverride` for `buildWeekStats`.
  // When a day has no snapshot, the helper falls back to the current
  // `targets` with `isSnapshot: false`.
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
  // card's adaptive-vs-formula one-liner. Computed at host level so the
  // card stays presentational and the shared `formatMaintenanceRecapLine`
  // helper drives identical render conditions on web + mobile.
  //
  // ENG-787 — hoisted above `weekStats` so the effective-target activity
  // bundle can reuse its resolved kcal as the maintenance fallback.
  const recapMaintenance = useMemo(
    () =>
      resolveMaintenance({
        adaptive_tdee: adaptiveTdee,
        adaptive_tdee_confidence: adaptiveConfidence,
        adaptive_tdee_updated_at: adaptiveUpdatedAt,
        sex: profileSexState as any,
        weight_kg: latestWeightKg ?? 70,
        height_cm: profileHeightCmState,
        age: profileAgeState,
        activity_level: profileActivityLevelState as any,
      }),
    [
      adaptiveTdee,
      adaptiveConfidence,
      adaptiveUpdatedAt,
      profileSexState,
      latestWeightKg,
      profileHeightCmState,
      profileAgeState,
      profileActivityLevelState,
    ],
  );

  // ENG-787 — per-day activity bundle for the Daily Calories chart. Mirrors
  // the Today ring's `dayActivityBudgetAddon`: each bar is judged against
  // base target + that day's earned bonus, not the bare base target.
  // Maintenance prefers the day's frozen snapshot, falling back to the
  // resolved value. Returns undefined when the preference is off → the
  // chart collapses to plain base-target colouring (no behaviour change).
  const weekActivity = useMemo<WeekActivityAdjustment | undefined>(() => {
    if (!preferActivityAdjusted) return undefined;
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
      restingByDay: basalBurnByDay,
      activeByDay: activityBurnByDay,
      workoutKcalByDay,
      maintenanceByDay,
      maintenanceFallback: recapMaintenance?.kcal ?? 0,
    };
  }, [
    preferActivityAdjusted,
    dailyTargetsByDay,
    workoutsByDay,
    basalBurnByDay,
    activityBurnByDay,
    recapMaintenance,
  ]);

  const weekStats = useMemo(
    () => buildWeekStats(byDay, targets, weekStartDay, new Date(), weekTargetsByDay, weekActivity),
    [byDay, targets, weekStartDay, weekTargetsByDay, weekActivity],
  );

  // Streak chips were demoted out of the Progress frame (Sloe Figma
  // 492:2); the streak + freeze figures now surface only inside the Week
  // Digest, which derives them from `recap` (streakLength / freezesAvailable)
  // below. `freezeLedger` + `freezeBudgetMax` are still fed into the recap.

  // Batch 4.11 — weekly recap derivation + visibility gating.
  const currentWeekKey = useMemo(
    () => weekKeyFor(new Date(), weekStartDay),
    [weekStartDay],
  );
  // Numbers audit 2026-05-04 #9: pass per-day target snapshots into the
  // recap. `weekStats` above already uses `weekTargetsByDay`; without
  // mirroring the same arg here, a user who edited targets mid-week saw
  // one adherence value on the recap card and a different one on
  // Progress for the same week. Now both surfaces use the same per-day
  // judgement.
  const recap = useMemo(
    () =>
      buildWeeklyRecap({
        byDay: byDay as any,
        weightKgByDay,
        targets,
        weekStartDay,
        ledger: freezeLedger,
        budgetMax: freezeBudgetMax,
        dayTargetOverrides: weekTargetsByDay,
      }),
    [byDay, weightKgByDay, targets, weekStartDay, freezeLedger, freezeBudgetMax, weekTargetsByDay],
  );
  const recapVisible = useMemo(
    () =>
      shouldShowRecap(recapLastSeenWeekKey, currentWeekKey, new Date(), weekStartDay) &&
      recap.daysLogged > 0,
    [recapLastSeenWeekKey, currentWeekKey, weekStartDay, recap.daysLogged],
  );

  // ENG-740 — blended Week-Digest flag. PostHog flags can resolve after
  // first paint; default-false keeps the legacy two-card layout. The
  // blended card is always-on with a per-week dismiss, so we gate it on
  // `recap.daysLogged > 0` (real data) + the seen-state — NO Sat→Tue
  // window (approved spec).
  const [digestBlendEnabled, setDigestBlendEnabled] = useState(false);
  useEffect(() => {
    setDigestBlendEnabled(isFeatureEnabled("progress_digest_blend"));
  }, []);
  const digestBlendVisible =
    digestBlendEnabled &&
    recap.daysLogged > 0 &&
    recapLastSeenWeekKey !== currentWeekKey;

  // ENG-741 — Trajectory card flag. Same read-once-on-mount,
  // default-false-until-loaded posture as the blended-digest flag above.
  // Default-off preserves the current Progress layout; on → the calm "if
  // you keep this pace you'll be X" card renders directly under the
  // weight chart. Dev override: EXPO_PUBLIC_FLAG_FORCE_PROGRESS_TRAJECTORY_BOX=true.
  const [trajectoryBoxEnabled, setTrajectoryBoxEnabled] = useState(false);
  useEffect(() => {
    setTrajectoryBoxEnabled(isFeatureEnabled("progress_trajectory_box"));
  }, []);

  // Sloe Figma 492:2 — the dual `progressLayoutV2` flag (ENG-773) is
  // retired. The frame layout is now the single production path (no flag,
  // no alternate version) per the redesign governance: range toggle →
  // THIS WEEK insight → AVERAGE ADHERENCE → weight card → AVG/TDEE/DEFICIT
  // triad → DAILY CALORIES → on-target ribbon, with Apple Health /
  // maintenance / journey / digest preserved below.

  // Weight card Trend/Scale segmented toggle (Sloe Figma 492:2). "trend"
  // renders the smoothed moving-average line; "scale" the raw weigh-ins.
  // Mirrors web `weightView`.
  const [weightView, setWeightView] = useState<"trend" | "scale">("trend");

  // Ship M1 — saved meals + usual-meal insight for the recap card.
  const [hostSavedMealsForRecap, setHostSavedMealsForRecap] = useState<SavedMeal[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setHostSavedMealsForRecap([]);
      return;
    }
    listSavedMeals(supabase, userId)
      .then((rows) => {
        if (!cancelled) setHostSavedMealsForRecap(rows);
      })
      .catch((err) => {
         
        console.warn("Progress listSavedMeals (recap) failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const usualMealInsight: UsualMealRecapInsight = useMemo(() => {
    if (!recapVisible) return null;
    const prevAnchor = new Date();
    prevAnchor.setDate(prevAnchor.getDate() - 7);
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
    const logCountBySavedMealId: Record<string, number> = {};
    for (const sm of hostSavedMealsForRecap) {
      const itemKeys = new Set<string>();
      for (const it of sm.items) {
        itemKeys.add(`${normaliseRecipeTitle(it.recipeTitle)}|${Math.round(it.calories)}`);
      }
      let dayMatches = 0;
      for (const dayKey of weekKeys) {
        const meals = byDay[dayKey] ?? [];
        const dayKeys = new Set<string>();
        for (const m of meals) {
          dayKeys.add(
            `${normaliseRecipeTitle(m.recipeTitle ?? "")}|${Math.round(m.calories)}`,
          );
        }
        if (itemKeys.size > 0 && [...itemKeys].every((k) => dayKeys.has(k))) {
          dayMatches += 1;
        }
      }
      logCountBySavedMealId[sm.id] = dayMatches;
    }
    // Action 5 Item 8 (2026-04-19) — extend window to 14 days so the
    // loosened gate has enough history. Mirror of the web derivation
    // in `ProgressDashboard.tsx`.
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
      byDay: byDay as any,
      weekKeys,
      savedMeals: hostSavedMealsForRecap,
      logCountBySavedMealId,
      extendedWeekKeys,
    });
  }, [recapVisible, hostSavedMealsForRecap, byDay, weekStartDay]);

  // `weekly_recap_shown` fires inside <Digest/> on mount; host no longer tracks it.

  const dismissRecap = useCallback(async () => {
    setRecapLastSeenWeekKey(currentWeekKey);
    if (!userId) return;
    await supabase
      .from("profiles")
      .update({ weekly_recap_last_seen_week_key: currentWeekKey } as never)
      .eq("id", userId);
  }, [currentWeekKey, userId]);

  // Mobile-local weekly recap scheduling was removed 2026-04-20
  // (see docs/decisions/2026-04-20-weekly-recap-mobile-local-killed.md).
  // Server cron `app/api/push/weekly-recap/route.ts` owns delivery for
  // installs with a synced Expo push token. Token registration IS wired
  // — `registerExpoPushTokenForUser` / `refreshExpoPushTokenIfChanged`
  // (apps/mobile/lib/expoPushToken.ts) run from the Today tab and write
  // `profiles.expo_push_token`, so synced installs receive the push.
  // The `weekly_recap_push_sent` / `_scheduled` analytics used to fire
  // from this effect with a `currentWeekKey` payload that carried a
  // week-boundary off-by-one bug; removing the schedule also removed the
  // bug. Server-side emit remains the canonical signal.

  // Weight chart trend — drives the weight card's clay sparkline (Trend =
  // smoothed moving-average, Scale = raw weigh-ins) + START/CURRENT/GOAL/RATE.
  const weightChartTrend = useMemo(
    () => computeWeightTrend(weightKgByDayToPoints(weightKgByDay), weightChartRange, goalWeightKg),
    [weightKgByDay, weightChartRange, goalWeightKg],
  );

  // 2026-04-20 prototype Phase 2 — WEIGHT + Calories cards read from
  // these shared helpers so web + mobile can't drift. Range window is
  // driven by the `rangeKey` state set by the range picker above.
  const weightRange = useMemo(
    () => buildWeightRangeStats(weightKgByDay, rangeKey as RangeKey, new Date()),
    [weightKgByDay, rangeKey],
  );
  const caloriesRange = useMemo(
    () => buildCaloriesRangeStats(byDay as any, targets.calories, rangeKey as RangeKey, new Date()),
    [byDay, targets.calories, rangeKey],
  );
  // Sloe Figma 492:2 — range-scoped macro adherence so the AVERAGE
  // ADHERENCE card's four bars describe the SAME window as the headline
  // calorie adherence (responds to the time-range toggle). Shared helper →
  // web + mobile read identical figures.
  const macroRange = useMemo(
    () =>
      buildMacroAdherenceRangeStats(
        byDay as any,
        { protein: targets.protein, carbs: targets.carbs, fat: targets.fat, fiber: targets.fiber },
        rangeKey as RangeKey,
        new Date(),
      ),
    [byDay, targets.protein, targets.carbs, targets.fat, targets.fiber, rangeKey],
  );

  const t = {
    text: colors.text,
    sub: colors.textSecondary,
    dim: colors.textTertiary,
    bg: colors.background,
    elevated: colors.card,
    border: colors.cardBorder,
    accent: accent.primary,
    // Sloe treatment system (2026-06-08): the selected range pill + segmented
    // active label now read in the deep aubergine `primarySolid` on a
    // `primarySoft` tint (§7/§8), superseding the solid-plum range-pill fill.
    accentSolid: accent.primarySolid,
    accentSoft: accent.primarySoft,
    // Sloe plum (nav/brand primary) — retained for any nav-brand chrome.
    plum: colors.navPrimary,
    green: Accent.success,
    amber: Accent.warning,
    red: Accent.destructive,
    protein: MacroColors.protein,
    carbs: MacroColors.carbs,
    fat: MacroColors.fat,
  };

  const hasData = Object.keys(byDay).length > 0;

  const milestone30 = useMilestone30DayOnProgress({
    active: progressTabFocused && !loading && hasData,
    userId,
    byDay,
    weightKgByDay,
    milestone30ShownAt,
    onShownAtPersisted: setMilestone30ShownAt,
  });

  const progressScrollStyle = {
    paddingTop: Spacing.md,
    paddingHorizontal: Layout.screenPaddingX,
    paddingBottom: insets.bottom + Spacing.xl,
    gap: Spacing.lg,  // 20px — consistent card rhythm (matches the entrance-wrapper gaps)
  };

  const heroEntrance = useEntranceAnimation({ delay: 0 });
  const chartsEntrance = useEntranceAnimation({ delay: 80 });
  const detailsEntrance = useEntranceAnimation({ delay: 160 });

  const progressLogWeightButton = (
    <Pressable
      testID="progress-calendar-button"
      accessibilityRole="button"
      accessibilityLabel="Log weight"
      onPress={() => setLogWeightOpen(true)}
      style={({ pressed }) => [{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: t.elevated,
        borderWidth: 1,
        borderColor: t.border,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      }]}
    >
      <Scale size={16} color={t.text} strokeWidth={1.75} />
    </Pressable>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <ProgressTabChrome trailing={progressLogWeightButton} />
      <ScrollView
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={progressScrollStyle}
        testID="progress-skeleton"
      >
        {/* Range-picker pills — disabled-look during load so the
            skeleton doesn't look interactive. */}
        <View
          testID="progress-range-picker-skeleton"
          style={{ flexDirection: "row", gap: 6, marginBottom: Spacing.md }}
        >
          {(["7d", "30d", "90d", "all"] as const).map((k) => {
            const active = k === rangeKey;
            return (
              <View
                key={k}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: "center",
                  borderRadius: 999,
                  borderWidth: 1,
                  // Skeleton mirrors the live range pill's soft-tint treatment
                  // (Sloe §7) so the load state doesn't flash a different shape.
                  borderColor: active ? t.accentSolid : t.border,
                  backgroundColor: active ? t.accentSoft : t.elevated,
                  opacity: 0.6,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "500", color: active ? t.accentSolid : t.sub }}>{k === "all" ? "All" : k}</Text>
              </View>
            );
          })}
        </View>

        {/* 2x2 tile skeletons — match real tile footprint (47% width,
            padding 14, radius). No numbers are shown; placeholders are
            a neutral block so we never invent data. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.md }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              testID={`progress-skeleton-tile-${i}`}
              style={[{
                width: "47%",
                padding: 14,
                borderRadius: Radius.lg,
                backgroundColor: cardElevation.liftBg ?? t.elevated,
                borderWidth: cardElevation.useBorder ? 1 : 0,
                borderColor: t.border,
                minHeight: 86,
              }, cardElevation.shadowStyle]}
            >
              <View style={{ width: 60, height: 10, borderRadius: 3, backgroundColor: t.border, marginBottom: 10 }} />
              <View style={{ width: 80, height: 18, borderRadius: 3, backgroundColor: t.border, marginBottom: 6 }} />
              <View style={{ width: 100, height: 10, borderRadius: 3, backgroundColor: t.border }} />
            </View>
          ))}
        </View>

        {/* Inline spinner under the skeleton — reassures the user that
            the view is live without starving the initial paint. */}
        {/* Spinner uses theme `colors.tint` (warm ink / light foreground). */}
        <View style={{ alignItems: "center", paddingVertical: 12 }}>
          <ActivityIndicator size="small" color={colors.tint} />
        </View>
      </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
    <ProgressTabChrome trailing={progressLogWeightButton} />
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={progressScrollStyle}
      keyboardShouldPersistTaps="handled"
    >
      {/* HouseholdBar — 2026-04-20 prototype port. Appears between
          the header and the range-picker pills for household users;
          hidden otherwise (mirror of `screens-mobile.jsx` L580). */}
      <HouseholdBar />

      {/* ── Sloe Figma 492:2 — single production layout (web + mobile
          parity). Order: range toggle → THIS WEEK insight (lilac) →
          AVERAGE ADHERENCE → weight card (Trend/Scale + stat row + log) →
          AVG/TDEE/DEFICIT triad → DAILY CALORIES → on-target ribbon. Every
          previously-wired surface (Apple Health, adaptive maintenance,
          journey/projection, week digest) is preserved below the frame's
          above-fold story. No feature flags, no duplicate components, no
          alternate versions — this is THE layout. */}

      {/* 1. TIME-RANGE TOGGLE — [7d, 30d, 90d, All]. Active = solid plum
          fill (`t.plum`) + white text; the rest bordered cream pills.
          Mirrors web `bg-foreground-brand`. Drives every range stat below
          + the weight/calorie windows. */}
      <ReAnimated.View style={heroEntrance.style}>
      <View
        testID="progress-range-picker"
        accessibilityRole="tablist"
        style={{ flexDirection: "row", gap: Spacing.sm }}
      >
        {(["7d", "30d", "90d", "all"] as const).map((k) => {
          const active = rangeKey === k;
          const label = k === "all" ? "All" : k;
          return (
            <Pressable
              key={k}
              testID={`progress-range-pill-${k}`}
              accessibilityRole="tab"
              accessibilityLabel={`Range ${label}`}
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (!active) haptics.select();
                setRangeKey(k);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
              style={({ pressed }) => [{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 4,
                alignItems: "center",
                borderRadius: Radius.full,
                // Sloe treatment system (2026-06-08, §7): selected range pill =
                // aubergine soft-tint fill + primarySolid border/label (was a
                // solid plum fill). The accent stays rationed — the fill is
                // reserved for the FAB + conversion CTAs.
                backgroundColor: active ? t.accentSoft : t.elevated,
                borderWidth: active ? 1 : 1,
                borderColor: active ? t.accentSolid : t.border,
                opacity: pressed ? 0.85 : 1,
              }]}
            >
              <Text style={{ fontSize: 13, fontWeight: "500", color: active ? t.accentSolid : t.sub }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 2. THIS WEEK insight card (lilac wash + sparkle). Engine-led
          commentary; the StoryGate placeholder shares the same lilac wash
          until the user crosses the 3-day data floor (geometry matches so
          the slot doesn't jump). On `trends_only` the direction tile still
          renders above so opt-out users keep a weight signal. */}
      {weightSurfaceMode === "trends_only" && (
        <WeightTrendOnlyCard weekDeltaKg={weightRange.weekDeltaKg} rangeKey={rangeKey} theme={t} />
      )}
      {hasEnoughDataForStory(weekStats.daysWithFood) ? (
        <ProgressHeadline
          commentary={generateProgressCommentary({
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
                    loggingDays: Object.keys(byDay ?? {}).length,
                    weighInCount: Object.keys(weightKgByDay ?? {}).length,
                    avgDailyIntake: 0,
                    smoothedWeightChangeKgPerDay: 0,
                    windowDays: 28,
                  }
                : null,
            loggingDays: weekStats.daysWithFood,
          })}
        />
      ) : (
        <ProgressStoryGate daysLogged={weekStats.daysWithFood} />
      )}
      </ReAnimated.View>

      <ReAnimated.View style={[chartsEntrance.style, { gap: Spacing.lg }]}>
      {/* 3. AVERAGE ADHERENCE — big calorie-adherence % + on-target dot
          streak + four macro bars (Protein sage / Carbs clay / Fat amber /
          Fibre teal). Every figure is real (range adherence + range macro
          adherence). The "up N%" trend chip stays hidden until the weekly
          aggregate stream lands (documented data gap) — never invented. */}
      <ProgressAverageAdherence
        adherencePct={caloriesRange.adherencePct}
        onTargetDays={weekStats.days.map(
          (d) => d.calories > 0 && d.calories <= d.effectiveTargetCalories,
        )}
        macros={[
          { name: "Protein", pct: macroRange.proteinPct, color: t.protein },
          { name: "Carbs", pct: macroRange.carbsPct, color: t.carbs },
          { name: "Fat", pct: macroRange.fatPct, color: t.fat },
          { name: "Fibre", pct: macroRange.fiberPct, color: MacroColors.fiber },
        ]}
      />

      {/* 4. WEIGHT CARD (Sloe Figma 492:2) — serif kg headline + "↓ N this
          week" + Trend/Scale segmented toggle, clay sparkline, dashed goal
          line, START/CURRENT/GOAL/RATE stat row, "＋ Log weight" button,
          "View all measurements". The detailed Withings-style chart +
          all-data list stay reachable via the sheets (no feature lost).
          Gated on `show` — opt-out users saw the direction tile above. */}
      {weightSurfaceMode === "show" && chartsReady ? (() => {
        const sortedWeightDays = Object.entries(weightKgByDay).sort(([a], [b]) => a.localeCompare(b));
        const startKg = sortedWeightDays.length > 0 ? sortedWeightDays[0][1] : null;
        const weekDeltaKg = weightRange.weekDeltaKg;
        const rateKgPerWeek =
          latestWeightKg != null && goalWeightKg != null
            ? (() => {
                const tl = calcGoalTimeline({ currentWeightKg: latestWeightKg, goalWeightKg, weightKgByDay });
                if (tl.weeklyRateKg === 0) return 0;
                return tl.trendDirection === "losing"
                  ? -Math.abs(tl.weeklyRateKg)
                  : tl.trendDirection === "gaining"
                    ? Math.abs(tl.weeklyRateKg)
                    : 0;
              })()
            : null;
        const goalDateLabel = (() => {
          if (latestWeightKg == null || goalWeightKg == null) return null;
          const tl = calcGoalTimeline({ currentWeightKg: latestWeightKg, goalWeightKg, weightKgByDay });
          if (tl.daysToGoal == null || tl.daysToGoal <= 0) return null;
          const d = new Date();
          d.setDate(d.getDate() + tl.daysToGoal);
          return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        })();
        // Trend = smoothed moving-average line; Scale = raw weigh-ins.
        const sparkSeries =
          weightView === "scale"
            ? weightChartTrend.points.map((p) => p.kg)
            : weightChartTrend.movingAvg
                .map((m, i) => (m != null ? m : weightChartTrend.points[i]?.kg))
                .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        const fmtW = (kg: number) => formatWeightForUnit({ kg, system: measurementSystem });
        return (
          <View
            testID="progress-weight-card"
            style={[{ backgroundColor: cardElevation.liftBg ?? t.elevated, borderRadius: CARD_RADIUS, borderWidth: cardElevation.useBorder ? 1 : 0, borderColor: t.border, padding: 20 }, cardElevation.shadowStyle]}
          >
            {/* Section eyebrow — matches the "Daily Calories" / "Average Adherence"
                cards (Sentence-Case source, rendered uppercase via style) so the
                weight card is no longer the one card on Progress without a header. */}
            <Text style={{ fontSize: 11, fontWeight: "700", color: accent.primarySolid, textTransform: "uppercase", letterSpacing: 0.88, marginBottom: 8 }}>Weight</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...Type.display, fontSize: 30, lineHeight: 34, color: t.text, fontVariant: ["tabular-nums"] }}>
                  {latestWeightKg != null ? fmtW(latestWeightKg) : "—"}
                </Text>
                {weekDeltaKg != null && Math.abs(weekDeltaKg) >= 0.05 ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    {weekDeltaKg < 0 ? (
                      <TrendingDown size={14} color={t.sub} strokeWidth={1.75} />
                    ) : (
                      <TrendingUp size={14} color={t.sub} strokeWidth={1.75} />
                    )}
                    <Text style={{ fontSize: 13, color: t.sub, fontVariant: ["tabular-nums"] }}>
                      {fmtW(Math.abs(weekDeltaKg))} this week
                    </Text>
                  </View>
                ) : null}
              </View>
              {/* Trend/Scale segmented toggle */}
              <View
                testID="progress-weight-view-toggle"
                accessibilityRole="tablist"
                style={{ flexDirection: "row", backgroundColor: t.border, borderRadius: 999, padding: 2 }}
              >
                {(["trend", "scale"] as const).map((v) => {
                  const active = weightView === v;
                  return (
                    <Pressable
                      key={v}
                      testID={`progress-weight-view-${v}`}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        if (!active) haptics.select();
                        setWeightView(v);
                      }}
                      style={({ pressed }) => [{
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 999,
                        // Sloe treatment §8: active segment = white lift +
                        // primarySolid label (was warm-ink text).
                        backgroundColor: active ? t.elevated : "transparent",
                        opacity: pressed ? 0.85 : 1,
                      }]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: active ? t.accentSolid : t.sub, textTransform: "capitalize" }}>{v}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {goalWeightKg != null ? (
              <Text style={{ fontSize: 13, color: t.sub, marginTop: 6 }}>
                Goal {fmtW(goalWeightKg)}
                {goalDateLabel ? ` · on track for ~${goalDateLabel}` : ""}
              </Text>
            ) : null}
            {/* Clay sparkline with a dashed goal line. */}
            {sparkSeries.length >= 2 ? (
              <View style={{ marginTop: 12, height: 110, position: "relative" }}>
                {(() => {
                  // Card inner width = screen − screen padding − card padding (20×2).
                  const chartW = Dimensions.get("window").width - Layout.screenPaddingX * 2 - 40;
                  const chartH = 110;
                  const goalKgConv = goalWeightKg;
                  const allVals = goalKgConv != null ? [...sparkSeries, goalKgConv] : sparkSeries;
                  const minV = Math.min(...allVals);
                  const maxV = Math.max(...allVals);
                  const span = maxV - minV === 0 ? 1 : maxV - minV;
                  const goalY = goalKgConv != null ? 4 + (chartH - 8) - ((goalKgConv - minV) / span) * (chartH - 8) : null;
                  return (
                    <>
                      {goalY != null ? (
                        <View
                          pointerEvents="none"
                          style={{ position: "absolute", left: 0, right: 0, top: goalY, height: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: t.sub, opacity: 0.5 }}
                        />
                      ) : null}
                      <Sparkline points={sparkSeries} color={t.carbs} width={chartW} height={chartH} />
                    </>
                  );
                })()}
              </View>
            ) : null}
            {/* START / CURRENT / GOAL / RATE stat row */}
            <View style={{ flexDirection: "row", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.border }}>
              {([
                ["Start", startKg != null ? fmtW(startKg) : "—"],
                ["Current", latestWeightKg != null ? fmtW(latestWeightKg) : "—"],
                ["Goal", goalWeightKg != null ? fmtW(goalWeightKg) : "—"],
                ["Rate", rateKgPerWeek != null && rateKgPerWeek !== 0
                  ? `${formatWeightForUnit({ kg: rateKgPerWeek, system: measurementSystem, signed: true })}/wk`
                  : "—"],
              ] as const).map(([label, val]) => (
                <View key={label} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: t.dim, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: t.text, marginTop: 4, fontVariant: ["tabular-nums"] }}>{val}</Text>
                </View>
              ))}
            </View>
            {/* ＋ Log weight (centred) + View all measurements */}
            <Pressable
              testID="progress-log-weight"
              accessibilityRole="button"
              accessibilityLabel="Log weight"
              onPress={() => setLogWeightOpen(true)}
              style={({ pressed }) => [{
                marginTop: 14,
                alignSelf: "center",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 18,
                paddingVertical: 9,
                borderRadius: 999,
                // Sloe treatment system (§1): primary inline CTA = aubergine
                // OUTLINE (transparent fill, 1.5px primarySolid border + label).
                backgroundColor: "transparent",
                borderWidth: 1.5,
                borderColor: t.accentSolid,
                opacity: pressed ? 0.9 : 1,
              }]}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: t.accentSolid }}>＋  Log weight</Text>
            </Pressable>
            {Object.keys(weightKgByDay).length > 0 ? (
              <Pressable
                onPress={() => setAllWeightDataOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="View all measurements"
                hitSlop={8}
                testID="progress-view-all-measurements"
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 4, marginTop: 10, opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ fontSize: 12, color: t.accentSolid, fontWeight: "600" }}>View all measurements</Text>
                <ArrowRight size={12} color={t.accentSolid} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
        );
      })() : weightSurfaceMode === "show" ? (
        <View
          testID="progress-weight-chart-pending"
          style={[{ backgroundColor: cardElevation.liftBg ?? t.elevated, borderRadius: CARD_RADIUS, borderWidth: cardElevation.useBorder ? 1 : 0, borderColor: t.border, padding: 20, minHeight: 140 }, cardElevation.shadowStyle]}
        >
          <View style={{ width: 110, height: 12, borderRadius: 3, backgroundColor: t.border, marginBottom: 16 }} />
          <ActivityIndicator size="small" color={colors.tint} />
        </View>
      ) : null}

      {/* 5. AVG INTAKE / EST. TDEE (ADAPTIVE) / DEFICIT triad — real range
          intake + resolved maintenance; deficit = maintenance − intake.
          Sage TDEE/deficit, amber surplus. Rendered via <ProgressEnergyTriad>
          (mirror: src/app/components/suppr/progress-energy-triad.tsx). */}
      {hasData ? (
        <ProgressEnergyTriad
          avgIntakeKcal={
            caloriesRange.avgCaloriesPerDay != null
              ? Math.round(caloriesRange.avgCaloriesPerDay)
              : null
          }
          maintenanceKcal={recapMaintenance?.kcal ?? staticTdee}
          isAdaptive={recapMaintenance?.source === "adaptive"}
        />
      ) : null}
      </ReAnimated.View>

      <ReAnimated.View style={[detailsEntrance.style, { gap: Spacing.lg }]}>
      {!hasData ? (
        <View style={[{ padding: 24, borderRadius: CARD_RADIUS, backgroundColor: cardElevation.liftBg ?? t.elevated, borderWidth: cardElevation.useBorder ? 1 : 0, borderColor: t.border, alignItems: "center", gap: Spacing.md }, cardElevation.shadowStyle]}>
          <IconBox color={t.accent} size={40}>
            <BarChart3 size={20} color={t.accent} strokeWidth={1.75} />
          </IconBox>
          <Text style={{ ...Type.headline, color: t.plum, textAlign: "center" }}>Your progress will appear here</Text>
          <Text style={{ ...Type.body, color: t.sub, textAlign: "center", maxWidth: 260, lineHeight: 18 }}>
            Log meals on the Today tab and your weekly trends, macro adherence, and charts will populate.
          </Text>
        </View>
      ) : (
        <>
        {/* 6. DAILY CALORIES (Sloe Figma 492:2) — M–S bars, sage = on
            target, amber = over, a goal dot above each bar + an "On target /
            Over" legend. Reads the same effective-target colouring as the
            Today ring. */}
        {!chartsReady ? (
          <View
            testID="progress-charts-pending"
            style={[{ backgroundColor: cardElevation.liftBg ?? t.elevated, borderRadius: CARD_RADIUS, borderWidth: cardElevation.useBorder ? 1 : 0, borderColor: t.border, padding: 20, minHeight: 140 }, cardElevation.shadowStyle]}
          >
            <View style={{ width: 110, height: 12, borderRadius: 3, backgroundColor: t.border, marginBottom: 16 }} />
            <ActivityIndicator size="small" color={colors.tint} />
          </View>
        ) : (
        <>
        <View style={[{ backgroundColor: cardElevation.liftBg ?? t.elevated, borderRadius: CARD_RADIUS, borderWidth: cardElevation.useBorder ? 1 : 0, borderColor: t.border, padding: 20 }, cardElevation.shadowStyle]} testID="progress-daily-calories-card">
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: accent.primarySolid, textTransform: "uppercase", letterSpacing: 0.88 }}>Daily Calories</Text>
              <Text style={{ ...Type.display, fontSize: 24, lineHeight: 28, color: t.text, marginTop: 4, fontVariant: ["tabular-nums"] }}>
                {weekStats.avgCalories.toLocaleString()}<Text style={{ fontSize: 14, color: t.sub }}> avg</Text>
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: t.carbs }} />
              <Text style={{ fontSize: 11, color: t.dim }}>goal</Text>
            </View>
          </View>
          {(() => {
            const chartHeight = 96;
            const dotReserve = 10;
            const barMax = chartHeight * 0.72;
            const maxCal = Math.max(targets.calories, ...weekStats.days.map((dd) => dd.calories), 1);
            const scaleMax = maxCal * 1.15;
            return (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: chartHeight, marginTop: 16 }}>
                {weekStats.days.map((d) => {
                  const overTarget = d.calories > d.effectiveTargetCalories;
                  const barH = maxCal > 0 ? Math.max(4, (d.calories / scaleMax) * barMax) : 4;
                  const goalDotBottom = d.effectiveTargetCalories > 0 ? Math.min(dotReserve + (d.effectiveTargetCalories / scaleMax) * barMax, chartHeight - 16) : null;
                  const isDayToday = d.key === todayKey;
                  return (
                    <Pressable
                      key={d.key}
                      onPress={() => {
                        router.navigate({ pathname: "/(tabs)" as any, params: { date: d.key, _t: String(Date.now()) } });
                      }}
                      style={{ flex: 1, height: chartHeight, justifyContent: "flex-end", alignItems: "center", position: "relative" }}
                    >
                      {goalDotBottom != null ? (
                        <View style={{ position: "absolute", bottom: goalDotBottom, width: 6, height: 6, borderRadius: 999, backgroundColor: t.carbs }} />
                      ) : null}
                      <View
                        testID={`progress-day-bar-${d.key}`}
                        style={{ width: "100%", height: barH, borderRadius: 6, backgroundColor: d.calories === 0 ? t.border : overTarget ? t.amber : t.green, opacity: isDayToday ? 1 : 0.85 }}
                      />
                      <Text style={{ fontSize: 10, fontWeight: isDayToday ? "700" : "500", color: isDayToday ? t.text : t.dim, marginTop: 6 }}>{d.label.charAt(0)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })()}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: t.green }} />
              <Text style={{ fontSize: 11, color: t.dim }}>On target</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: t.amber }} />
              <Text style={{ fontSize: 11, color: t.dim }}>Over</Text>
            </View>
          </View>
        </View>

        {/* 7. ON-TARGET RIBBON — real count of on-target days this week. */}
        <ProgressOnTargetRibbon
          onTargetCount={weekStats.days.filter((d) => d.calories > 0 && d.calories <= d.effectiveTargetCalories).length}
          subtitle="Your most consistent week this month."
        />

        {/* ── Preserved detail (below the frame's above-fold story) ──
            Apple Health, adaptive maintenance + explainer, journey /
            projection, week digest — every wired surface kept. */}

        {/* APPLE HEALTH */}
        {userId ? (
          <AppleHealthCardHost
            userId={userId}
            stepsToday={stepsByDay[todayKey] ?? null}
            latestWeightKg={latestWeightKg}
            useImperial={measurementSystem === "imperial"}
          />
        ) : null}

        {/* MAINTENANCE card */}
        {staticTdee != null && (() => {
          const resolved = resolveMaintenance({
            adaptive_tdee: adaptiveTdee,
            adaptive_tdee_confidence: adaptiveConfidence,
            adaptive_tdee_updated_at: adaptiveUpdatedAt,
            sex: profileSexState as any,
            weight_kg: latestWeightKg ?? 70,
            height_cm: profileHeightCmState,
            age: profileAgeState,
            activity_level: profileActivityLevelState as any,
          });
          if (!resolved) return null;
          const showAdaptiveExtras = resolved.source === "adaptive";
          return (
          <View
            testID="progress-maintenance-card"
            style={[{ backgroundColor: cardElevation.liftBg ?? t.elevated, borderRadius: CARD_RADIUS, borderWidth: cardElevation.useBorder ? 1 : 0, borderColor: t.border, padding: 20 }, cardElevation.shadowStyle]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <IconBox color={t.accent} size={28}>
                  <Zap size={14} color={t.accent} strokeWidth={1.75} />
                </IconBox>
                <Text style={{ ...Type.headline, color: t.plum }}>Maintenance</Text>
              </View>
              {showAdaptiveExtras ? (
                <View
                  testID="maintenance-source-pill"
                  accessibilityLabel="Maintenance source: adaptive"
                  style={{ backgroundColor: t.green + "18", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: t.green, textTransform: "uppercase", letterSpacing: 0.5 }}>Adaptive</Text>
                </View>
              ) : (
                <View
                  testID="maintenance-source-pill"
                  accessibilityLabel="Maintenance source: formula estimate"
                  style={{ backgroundColor: t.border, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: t.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>Formula estimate</Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
              <Text style={{ ...Type.display, color: showAdaptiveExtras ? t.green : t.text, fontVariant: ["tabular-nums"] }}>
                {resolved.kcal.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 13, color: t.sub }}>kcal/day</Text>
            </View>

            {showAdaptiveExtras && resolved.formulaKcal != null && (
              <Text style={{ fontSize: 12, color: t.sub, marginBottom: 6 }}>
                Formula estimate: {resolved.formulaKcal.toLocaleString()} kcal
                {Math.abs(resolved.kcal - resolved.formulaKcal) >= 50 && (
                  <Text style={{ fontWeight: "600", color: t.text }}>
                    {" "}({resolved.kcal > resolved.formulaKcal ? "+" : ""}{resolved.kcal - resolved.formulaKcal} actual)
                  </Text>
                )}
              </Text>
            )}

            {showAdaptiveExtras && adaptiveConfidence && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: t.dim }}>Confidence:</Text>
                <View style={{ flexDirection: "row", gap: 3 }}>
                  {(["low", "medium", "high"] as const).map((level) => {
                    const filled =
                      (level === "low" && ["low", "medium", "high"].includes(adaptiveConfidence ?? "")) ||
                      (level === "medium" && ["medium", "high"].includes(adaptiveConfidence ?? "")) ||
                      (level === "high" && adaptiveConfidence === "high");
                    return (
                      <View key={level} style={{ width: 20, height: 4, borderRadius: 2, backgroundColor: filled ? t.green : t.border }} />
                    );
                  })}
                </View>
                <Text style={{ fontSize: 11, fontWeight: "600", color: adaptiveConfidence === "high" ? t.green : adaptiveConfidence === "medium" ? t.amber : t.dim, textTransform: "capitalize" }}>
                  {adaptiveConfidence}
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 12, color: t.sub, lineHeight: 17 }}>
              {showAdaptiveExtras
                ? `Maintenance is the calories you'd burn in a normal day. Based on your actual intake and weight changes (${adaptiveConfidence ?? "medium"} confidence).`
                : "Maintenance is the calories you'd burn in a normal day. Formula estimate from your stats and activity level."
              }
            </Text>

            {(() => {
              const chain = buildMaintenanceChain(
                {
                  sex: profileSexState as any,
                  weight_kg: latestWeightKg ?? 70,
                  height_cm: profileHeightCmState,
                  age: profileAgeState,
                  activity_level: profileActivityLevelState as any,
                },
                resolved,
                planPace,
                userGoal,
              );
              if (!chain) return null;
              return (
                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.border }}>
                  <Pressable
                    onPress={() => setMaintenanceExplainerOpen((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={maintenanceExplainerOpen ? "Hide explanation" : "Show how this works"}
                    accessibilityState={{ expanded: maintenanceExplainerOpen }}
                    hitSlop={8}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: t.accentSolid }}>
                      {maintenanceExplainerOpen ? "Hide" : "How this works"}
                    </Text>
                    {maintenanceExplainerOpen ? (
                      <ChevronUp size={14} color={t.accentSolid} strokeWidth={1.75} />
                    ) : (
                      <ChevronDown size={14} color={t.accentSolid} strokeWidth={1.75} />
                    )}
                  </Pressable>
                  {maintenanceExplainerOpen && (
                    <View style={{ marginTop: 10, gap: 6 }}>
                      {chain.steps.map((step, i) => {
                        const isSummary = step.kind === "summary" || step.kind === "weeklyLoss";
                        return (
                          <View
                            key={`${step.kind}-${i}`}
                            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}
                          >
                            <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: isSummary ? t.sub : t.text, fontWeight: step.emphasis ? "700" : "500" }}>
                              {step.label}
                            </Text>
                            {step.value ? (
                              <Text style={{ fontSize: 12, color: step.emphasis ? t.text : t.sub, fontWeight: step.emphasis ? "700" : "500", fontVariant: ["tabular-nums"] }}>
                                {step.value}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
          );
        })()}

        {/* PROJECTED WEIGHT (trajectory) card — flag-gated feature kept. */}
        {trajectoryBoxEnabled && weightSurfaceMode === "show" ? (
          <TrajectoryCard
            byDay={byDay}
            latestWeightKg={latestWeightKg}
            targetCalories={targets.calories}
            maintenanceTdeeKcal={isAdaptiveTdee && adaptiveTdee != null ? adaptiveTdee : staticTdee}
            goal={userGoal}
            timeline={
              latestWeightKg != null && goalWeightKg != null
                ? calcGoalTimeline({ currentWeightKg: latestWeightKg, goalWeightKg, weightKgByDay })
                : null
            }
          />
        ) : null}

        {/* JOURNEY / projection card */}
        {weightSurfaceMode === "show" &&
          latestWeightKg != null &&
          goalWeightKg != null &&
          Math.abs(goalWeightKg - latestWeightKg) > 0.05 && (
          (() => {
            const timeline = calcGoalTimeline({ currentWeightKg: latestWeightKg, goalWeightKg: goalWeightKg, weightKgByDay });
            const journeyProg = weightJourneyProgress({ goalKg: goalWeightKg, latestKg: latestWeightKg, weightKgByDay });
            const pctFrac = journeyProg
              ? computeWeightJourneyProgressPct({ startKg: journeyProg.baselineKg, currentKg: latestWeightKg, goalKg: goalWeightKg })
              : null;
            const progressPct = pctFrac != null ? Math.round(pctFrac * 100) : 0;
            const progressCopy = formatWeightJourneyProgressCopy(pctFrac);
            const daysWithFood = Object.keys(byDay).filter((k) => (byDay[k] ?? []).length > 0);
            const recentDays = daysWithFood.slice(-7);
            const avgCals = recentDays.length > 0
              ? Math.round(recentDays.reduce((s, k) => s + (byDay[k] ?? []).reduce((a, m) => a + Math.max(0, (m as any).calories ?? 0), 0), 0) / recentDays.length)
              : 0;
            const maintenanceTdeeKcal = isAdaptiveTdee && adaptiveTdee != null ? adaptiveTdee : staticTdee;
            const projectionEligible = shouldRenderDailyProjection(daysWithFood.length);
            const observedKgPerWeek =
              typeof timeline.weeklyRateKg === "number"
                ? timeline.trendDirection === "losing"
                  ? -Math.abs(timeline.weeklyRateKg)
                  : timeline.trendDirection === "gaining"
                    ? Math.abs(timeline.weeklyRateKg)
                    : 0
                : 0;
            const dailyProjection =
              projectionEligible && avgCals > 0 && latestWeightKg != null
                ? projectWeight({
                    currentWeightKg: latestWeightKg,
                    todayCalories: avgCals,
                    targetCalories: targets.calories,
                    maintenanceTdeeKcal,
                    goal: userGoal,
                    observedKgPerWeek,
                  })
                : null;

            return (
              <Pressable
                onPress={() => setLogWeightOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Weight journey and charts"
                accessibilityHint="Opens detailed weight progress"
                style={({ pressed }) => [{
                  backgroundColor: cardElevation.liftBg ?? t.elevated,
                  borderRadius: CARD_RADIUS,
                  borderWidth: cardElevation.useBorder ? 1 : 0,
                  borderColor: t.border,
                  padding: 20,
                  opacity: pressed ? 0.94 : 1,
                }, cardElevation.shadowStyle]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <IconBox color={t.green} size={28}>
                      <Flag size={14} color={t.green} strokeWidth={1.75} />
                    </IconBox>
                    <Text style={{ ...Type.headline, color: t.plum }}>Journey</Text>
                  </View>
                  {/* SLOE Phase 0: the days-to-goal hero numeral reads in
                      Newsreader serif; the " days to goal" label stays sans. */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {timeline.daysToGoal != null ? (
                      <Text style={{ fontFamily: FontFamily.serifRegular, fontSize: 22, color: t.accent, fontVariant: ["tabular-nums"] }}>
                        {timeline.daysToGoal}<Text style={{ fontFamily: FontFamily.sansMedium, fontSize: 12, fontWeight: "500", color: t.sub }}> days to goal</Text>
                      </Text>
                    ) : timeline.cappedAtMaxDays ? (
                      <Text
                        testID="progress-journey-capped"
                        style={{ fontSize: 12, fontWeight: "600", color: t.sub }}
                      >
                        More than 1 year at current rate
                      </Text>
                    ) : null}
                    <ChevronRight size={18} color={t.dim} strokeWidth={1.75} />
                  </View>
                </View>

                <Text style={{ fontSize: 13, color: t.sub, marginBottom: 10, lineHeight: 18 }}>
                  {timeline.remainingKg > 0.1
                    ? `${timeline.remainingKg} kg left to reach ${goalWeightKg} kg.`
                    : "You've reached your goal weight."}
                  {timeline.weeklyRateKg !== 0 && ` Currently ${timeline.trendDirection === "losing" ? "losing" : timeline.trendDirection === "gaining" ? "gaining" : "maintaining"} ~${Math.abs(timeline.weeklyRateKg)} kg/week.`}
                </Text>

                {journeyProg && (
                  <View style={{ marginBottom: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ fontSize: 10, color: t.dim }}>Start: {journeyProg.baselineKg} kg</Text>
                      <Text style={{ fontSize: 10, color: t.dim }}>Goal: {goalWeightKg} kg</Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: t.border }}>
                      <View style={{ width: `${progressPct}%` as any, height: "100%", borderRadius: 3, backgroundColor: progressPct >= 100 ? t.green : t.accent }} />
                    </View>
                    <Text
                      testID="progress-journey-copy"
                      style={{ fontSize: 10, color: t.dim, marginTop: 4, textAlign: "center" }}
                    >
                      {progressCopy ? `Now: ${latestWeightKg} kg · ${progressCopy}` : `Now: ${latestWeightKg} kg`}
                    </Text>
                  </View>
                )}

                {dailyProjection && maintenanceTdeeKcal != null && (
                  <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.border }}>
                    {(() => {
                      const avgDeficit = Math.round(maintenanceTdeeKcal - avgCals);
                      const deficitLabel =
                        avgDeficit > 0
                          ? `avg deficit ${avgDeficit.toLocaleString()} kcal/day`
                          : avgDeficit < 0
                            ? `avg surplus ${Math.abs(avgDeficit).toLocaleString()} kcal/day`
                            : "at maintenance";
                      return (
                        <Text style={{ fontSize: 12, color: t.sub, lineHeight: 18 }}>
                          Last 7 days averaged {avgCals.toLocaleString()} kcal/day — {deficitLabel}. On that trend you&apos;d reach{" "}
                          <Text style={{ fontWeight: "700", color: t.accent }}>{dailyProjection.projectedWeightKg} kg</Text> in ~{dailyProjection.projectionWeeks} weeks.
                        </Text>
                      );
                    })()}
                    <Text style={{ fontSize: 10, color: t.dim, marginTop: 4 }}>
                      Based on 7,700 kcal ≈ 1 kg. An estimate, not a promise.
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: t.accentSolid }}>View weight trends</Text>
                  <ChevronRight size={12} color={t.accentSolid} strokeWidth={1.75} />
                </View>
              </Pressable>
            );
          })()
        )}

        {/* WEEK DIGEST */}
        {(digestBlendEnabled ? digestBlendVisible : recapVisible) ? (() => {
          const digestSeed = (() => {
            if (usualMealInsight?.kind !== "prompt") return null;
            const seed = selectMostFrequentSlotSeed(byDay as any, usualMealInsight.suggestedSlot);
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
          const usualMeal: DigestUsualMeal | null =
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
            ? { label: recap.bestDay.label, protein: recap.bestDay.protein, calories: recap.bestDay.calories }
            : null;
          const maintenanceLine = formatMaintenanceRecapLine(recapMaintenance);
          const mealsLogged = Object.values(byDay).reduce(
            (total: number, day: any) => total + (Array.isArray(day) ? day.length : 0),
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
          const blendedExtras: DigestBlendedExtras = {
            dayOfWeekPattern: computeDayOfWeekPattern(byDay as any),
            closestDayTargetCalories: recap.bestDay?.targetCalories ?? null,
          };
          return (
            <Digest
              blended={digestBlendEnabled}
              blendedExtras={blendedExtras}
              onAdjustPace={() => router.push("/targets" as any)}
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
              narrative={{ closestToTarget, maintenanceLine, usualMeal }}
              shareText={formatRecapForShare(recap)}
              state={digestState}
              weightSurfaceMode={weightSurfaceMode}
              onShare={() => { /* Digest owns share sheet + analytics */ }}
              onDismiss={dismissRecap}
              onOpenSaveCombo={(slot, items) => {
                const serialized = serializePendingUsualMealSave(slot, items);
                if (serialized) {
                  AsyncStorage.setItem(PENDING_USUAL_MEAL_SAVE_KEY, serialized).catch(() => {});
                }
                router.navigate({ pathname: "/(tabs)" as any });
              }}
              onStartUsualMealSave={() => {
                router.navigate({ pathname: "/(tabs)" as any });
              }}
            />
          );
        })() : null}

        {digestBlendEnabled ? null : (
          <DigestStoryCard
            weekLabel={recap.weekLabel}
            daysLogged={weekStats.daysWithFood}
            avgCalories={weekStats.avgCalories}
            targetCalories={targets.calories}
            avgProtein={recap.avgProtein}
            targetProtein={targets.protein}
            proteinOnTargetDays={weekStats.proteinOnTarget}
            closestToTarget={recap.bestDay
              ? { label: recap.bestDay.label, calories: recap.bestDay.calories, protein: recap.bestDay.protein }
              : null}
            dayOfWeekPattern={computeDayOfWeekPattern(byDay as any)}
          />
        )}
        </>
        )}
        </>
      )}
      <Text
        testID="progress-nutrition-estimate-footer"
        style={{
          fontSize: 11,
          color: colors.textTertiary,
          textAlign: "center",
          lineHeight: 16,
          marginTop: 16,
          marginBottom: 8,
          paddingHorizontal: 16,
        }}
      >
        Nutrition data are estimates. Not medical or dietetic advice.
      </Text>
      </ReAnimated.View>
    </ScrollView>
    <LogWeightSheet
      visible={logWeightOpen}
      onClose={() => {
        setLogWeightOpen(false);
        setEditWeightDate(null);
      }}
      userId={userId ?? null}
      isImperial={measurementSystem === "imperial"}
      weightKgByDay={weightKgByDay}
      weightKg={weightKg}
      editDate={editWeightDate}
      onSaved={({ weightKgByDay: next, weightKg: kg, isNewLow }) => {
        setWeightKgByDay(next);
        setWeightKg(kg);
        // ENG-824 — a new all-time low is the single weight landmark worth
        // the reserved celebration. The sheet already fired the loud success
        // haptic (gated on `redesign_winmoment`); mount the Lottie + emit the
        // shown event. `isNewLow` is only ever true when the flag is on.
        if (isNewLow) {
          setWeightWinCelebration("goal-hit");
          try {
            track(AnalyticsEvents.weight_new_low_win_moment_shown, { platform: "ios" });
          } catch {
            /* analytics fire-and-forget */
          }
        }
      }}
    />
    <AllWeightDataSheet
      visible={allWeightDataOpen}
      onClose={() => setAllWeightDataOpen(false)}
      userId={userId ?? null}
      isImperial={measurementSystem === "imperial"}
      weightKgByDay={weightKgByDay}
      onEditEntry={(dateISO) => {
        // The all-data sheet closes itself before calling this; open the
        // log sheet in edit mode for the chosen date.
        setEditWeightDate(dateISO);
        setLogWeightOpen(true);
      }}
      onEntryDeleted={(_dateISO, nextMap) => {
        setWeightKgByDay(nextMap);
        // Refresh the latest scalar in case we just deleted today's
        // entry — fall back to the newest remaining entry.
        const remaining = Object.entries(nextMap)
          .filter(([, kg]) => Number.isFinite(kg) && (kg as number) > 0)
          .sort(([a], [b]) => b.localeCompare(a));
        setWeightKg(remaining.length > 0 ? (remaining[0][1] as number) : null);
      }}
    />
    <Milestone30DayModal
      visible={milestone30.open}
      content={milestone30.content}
      onDismiss={milestone30.dismiss}
      cardColor={colors.card}
      textColor={colors.text}
      textSecondaryColor={colors.textSecondary}
      borderColor={colors.border}
    />
    {/* ENG-824 — reserved weight win-moment overlay. Mounted only while a
        celebration is active (new all-time low); plays once then unmounts.
        Full-bleed + pointerEvents none so it never blocks the Progress UI. */}
    {weightWinCelebration ? (
      <WinMomentPlayer
        celebration={weightWinCelebration}
        fullBleed
        onComplete={() => setWeightWinCelebration(null)}
        testID="progress-weight-win-moment"
      />
    ) : null}
    </View>
  );
}

/* ── 2026-04-20 Prototype Phase 2 cards ────────────────────────────── */

type CardTheme = {
  text: string;
  sub: string;
  dim: string;
  bg: string;
  elevated: string;
  border: string;
  accent: string;
  green: string;
  amber: string;
  red: string;
};

/**
 * Tiny inline sparkline driven by react-native-svg. Pure — no state,
 * no animation (adds weight we don't need for a Progress card). When
 * the series has <2 points we render an empty axis placeholder rather
 * than a 1-point polyline; consuming card decides whether to still
 * render the outer card shell.
 */
function Sparkline({
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
    return <View style={{ width, height }} />;
  }
  // F-24 (2026-04-21): on the "All" range a single bad weight reading
  // (e.g. a 100 kg typo among 55 kg values) was blowing out the y-axis
  // domain so the real series rendered as a flat line at the bottom
  // (TestFlight AOCd89_asuNA). Use a trimmed 5th–95th percentile domain
  // so normal values get visual space, then clamp outliers to the chart
  // bounds so the spike is still visible at the edge. Threshold bumped
  // to 8 points so short series (1w / 1m) keep their raw domain — the
  // bug only manifests on long series with outliers.
  const sorted = [...points].sort((a, b) => a - b);
  let min: number;
  let max: number;
  if (points.length >= 8) {
    const lo = Math.floor(sorted.length * 0.05);
    const hi = Math.ceil(sorted.length * 0.95) - 1;
    min = sorted[lo];
    max = sorted[hi];
    if (!(max > min)) {
      min = sorted[0];
      max = sorted[sorted.length - 1];
    }
  } else {
    min = sorted[0];
    max = sorted[sorted.length - 1];
  }
  const rangeSpan = max - min === 0 ? 1 : max - min;
  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = innerW / (points.length - 1);
  const xy = points.map((v, i) => {
    const x = pad + i * step;
    // Lower values → higher y (invert). For weight we render raw kg
    // so the sparkline trends down when the user loses weight.
    const rawY = pad + innerH - ((v - min) / rangeSpan) * innerH;
    // Clamp outliers that fell outside the trimmed domain so they
    // render at the chart edge rather than offscreen.
    const y = Math.max(pad, Math.min(pad + innerH, rawY));
    return [x, y] as const;
  });
  const polylinePoints = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = xy[xy.length - 1];
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={polylinePoints}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </Svg>
  );
}

/**
 * T13.2 — direction-only Weight tile rendered in `trends_only` mode.
 * Mirrors `WeightTrendOnlyCardWeb` in `src/app/components/ProgressDashboard.tsx`
 * so opt-out behaviour is identical across web and mobile.
 *
 * Never surfaces an absolute kg/lb — only "Slightly down/up/Stable this
 * week" + an arrow glyph. Threshold (0.3 kg) matches the web copy.
 */
function WeightTrendOnlyCard({
  weekDeltaKg,
  rangeKey,
  theme,
}: {
  weekDeltaKg: number | null;
  rangeKey: "7d" | "30d" | "90d" | "all";
  theme: CardTheme;
}) {
  const cardElev = useCardElevation();
  const direction =
    weekDeltaKg == null || !Number.isFinite(weekDeltaKg)
      ? null
      : Math.abs(weekDeltaKg) < 0.3
        ? "stable"
        : weekDeltaKg < 0
          ? "down"
          : "up";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : direction === "stable" ? "→" : "—";
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
    <View
      testID="progress-weight-trend-only-card"
      style={[{
        backgroundColor: cardElev.liftBg ?? theme.elevated,
        borderRadius: Radius.lg,
        borderWidth: cardElev.useBorder ? 1 : 0,
        borderColor: theme.border,
        padding: 16,
        marginBottom: Spacing.md,
      }, cardElev.shadowStyle]}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", color: theme.dim, textTransform: "uppercase", letterSpacing: 1.1 }}>
        Weight trend
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: "700", color: theme.text }} accessibilityElementsHidden>
          {arrow}
        </Text>
        <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 12, color: theme.sub, marginTop: 4, lineHeight: 16 }}>
        Showing direction only · {windowLabel}. Switch to numbers in Settings if you want them back.
      </Text>
    </View>
  );
}

/**
 * AppleHealthCardHost — Progress-tab wrapper for the Apple Health card.
 *
 * Lives on the Progress screen because the four metrics live in
 * `profiles.{steps_by_day, activity_burn_by_day, basal_burn_by_day,
 * weight_kg}` and we don't want to plumb them through the mega-host's
 * render. This host reads only what the card needs on focus and maps
 * `syncHealthData` crash/denial state to the card's status prop.
 */
function AppleHealthCardHost({
  userId,
  stepsToday,
  latestWeightKg,
  useImperial,
}: {
  userId: string;
  stepsToday: number | null;
  latestWeightKg: number | null;
  useImperial: boolean;
}) {
  const [status, setStatus] = useState<AppleHealthCardStatus>("loading");
  const [active, setActive] = useState<number | null>(null);
  const [resting, setResting] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    const todayKey = new Date().toISOString().slice(0, 10);
    (async () => {
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("activity_burn_by_day, basal_burn_by_day")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setStatus("error");
          return;
        }
        const act = (profile?.activity_burn_by_day ?? {}) as Record<string, number>;
        const bas = (profile?.basal_burn_by_day ?? {}) as Record<string, number>;
        const a = typeof act[todayKey] === "number" ? act[todayKey] : null;
        const r = typeof bas[todayKey] === "number" ? bas[todayKey] : null;
        setActive(a);
        setResting(r);
        // Denial heuristic: HealthKit is available but none of the
        // four metrics came back. The design brief specifies a
        // dedicated denied footer in that case.
        if (!isHealthSyncAvailable() || (stepsToday == null && a == null && r == null && latestWeightKg == null)) {
          setStatus(!isHealthSyncAvailable() ? "denied" : "ready");
        } else {
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
     
  }, [userId, reloadKey, stepsToday, latestWeightKg]);

  return (
    <AppleHealthCard
      status={status}
      steps={stepsToday}
      activeEnergyKcal={active}
      restingBurnKcal={resting}
      weightKg={latestWeightKg}
      useImperial={useImperial}
      onRetry={() => setReloadKey((k) => k + 1)}
    />
  );
}
