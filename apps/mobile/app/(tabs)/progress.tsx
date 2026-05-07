import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, Pressable, View, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Flag,
  Flame,
  Footprints,
  LineChart,
  Scale,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import Svg, { Polyline, Circle } from "react-native-svg";

import { AppleHealthCard, type AppleHealthCardStatus } from "@/components/AppleHealthCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { dateKeyFromDate, type ByDay } from "@/lib/nutritionJournal";
import { computeLoggingStreak } from "@/lib/trackerStats";
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
import { resolveMaintenance , formatMaintenanceRecapLine } from "../../../../src/lib/nutrition/resolveMaintenance";
import { buildMaintenanceChain } from "../../../../src/lib/nutrition/maintenanceChain";
import type { PlanPace } from "../../../../src/lib/nutrition/tdee";
import {
  coerceMeasurementSystem,
  formatWeightForUnit,
  type MeasurementSystem,
} from "../../../../src/lib/measurements";
import {
  coerceWeightSurfaceMode,
  type WeightSurfaceMode,
} from "../../../../src/lib/nutrition/weightSurfaceMode";
import { computeWeightTrendCopy } from "../../../../src/lib/nutrition/weightTrendTile";
import { syncHealthDataThrottled, isHealthSyncAvailable } from "@/lib/healthSync";
import { buildWeekStats, formatAvgCaloriesLabel, formatMacroAdherenceBar } from "@/lib/progressWeekReport";
import {
  buildCaloriesRangeStats,
  buildWeightRangeStats,
  type RangeKey,
} from "../../../../src/lib/nutrition/progressRangeStats";
import { getDailyTargets, type DailyTarget } from "../../../../src/lib/nutrition/dailyTargetRead";
import {
  availableFreezes,
  computeProtectedStreak,
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
import { listSavedMeals, type SavedMeal, type SavedMealItem } from "../../../../src/lib/nutrition/savedMeals";
import { normaliseRecipeTitle, selectMostFrequentSlotSeed } from "../../../../src/lib/nutrition/usualMealHint";
import {
  PENDING_USUAL_MEAL_SAVE_KEY,
  serializePendingUsualMealSave,
} from "../../../../src/lib/nutrition/pendingUsualMealSave";
import { formatRecapForShare } from "@/lib/weeklyRecap";
import { resolveDigestHeadline } from "../../../../src/lib/nutrition/digest";
import { Digest, type DigestUsualMeal } from "@/components/Digest";
import { HouseholdBar } from "@/components/HouseholdBar";
// Phase 4 (B3.1, 2026-04-27) — Surface E "Progress hero (story-led)".
// Authority: D-2026-04-27-17 (Progress is a story not a stat-card
// dashboard) + D-2026-04-27-12 (adaptive TDEE always-on).
import { ProgressHeadline } from "@/components/today/ProgressHeadline";
import { ProgressStoryGate } from "@/components/today/ProgressStoryGate";
import { hasEnoughDataForStory } from "@/lib/progressStoryGate";
import { DigestStoryCard } from "@/components/progress/DigestStoryCard";
import { computeDayOfWeekPattern } from "../../../../src/lib/nutrition/dayOfWeekPattern";
import { generateProgressCommentary } from "@/lib/progressCommentary";
import { WeightChart } from "@/components/progress/WeightChart";
import { WeightRangeToggle } from "@/components/progress/WeightRangeToggle";
import { WeightSparseState } from "@/components/progress/WeightSparseState";
import {
  computeWeightTrend,
  weightKgByDayToPoints,
  type WeightRange,
} from "@/lib/progress/weightTrend";
import { YouSubTabHeader } from "@/components/tabs/YouSubTabHeader";

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

const DEFAULT_TARGETS = { calories: NUTRITION_DEFAULTS.calories, protein: NUTRITION_DEFAULTS.protein, carbs: NUTRITION_DEFAULTS.carbs, fat: NUTRITION_DEFAULTS.fat };

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [byDay, setByDay] = useState<ByDay>({});
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null);
  const [weightKgByDay, setWeightKgByDay] = useState<Record<string, number>>({});
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [dailyStepsGoal, setDailyStepsGoal] = useState(NUTRITION_DEFAULTS.steps);
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

  // Batch 4.11 — streak freeze + weekly recap state
  const [freezeLedger, setFreezeLedger] = useState<FreezeLedger>({
    earnedAt: [],
    usedHistory: [],
  });
  const [freezeBudgetMax, setFreezeBudgetMax] = useState<number>(3);
  const [recapLastSeenWeekKey, setRecapLastSeenWeekKey] = useState<string | null>(null);
  const [recapPushEnabled, setRecapPushEnabled] = useState<boolean>(true);

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

  const [weightChartRange, setWeightChartRange] = useState<WeightRange>("1m");

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
  // sparse-logger users still see something useful (single-day bars
  // are still plotted). Selected range drives both the overline text
  // in the header (`LAST 30 DAYS`) and — in a follow-up pass — the
  // downstream chart windows. Below-the-fold cards currently still
  // use their own scoped windows (weekly recap = week, maintenance =
  // configurable); the deeper card restructure is deferred.
  const [rangeKey, setRangeKey] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const rangeLabel = rangeKey === "7d" ? "LAST 7 DAYS" : rangeKey === "30d" ? "LAST 30 DAYS" : rangeKey === "90d" ? "LAST 90 DAYS" : "ALL TIME";

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
    setStepsSyncStatus("pending");
    const syncPromise: Promise<void> = isHealthSyncAvailable()
      ? syncHealthDataThrottled(userId).then(
          () => {
            setStepsSyncStatus("success");
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
        .select("date_key, calories, protein, carbs, fat")
        .eq("user_id", userId)
        .gte("date_key", ninetyDaysAgo)
        .order("created_at", { ascending: true }))();
    const profilePromise = (async () =>
      await supabase
        .from("profiles")
        .select("target_calories, target_protein, target_carbs, target_fat, weight_kg, goal_weight_kg, weight_kg_by_day, steps_by_day, daily_steps_goal, week_start_day, goal, plan_pace, sex, height_cm, age, activity_level, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history, weekly_recap_last_seen_week_key, weekly_recap_push_enabled, measurement_system, weight_surface_mode")
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
    void syncPromise.then(async () => {
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
    });

    if (profile) {
      setTargets({
        calories: (profile.target_calories as number) ?? DEFAULT_TARGETS.calories,
        protein: (profile.target_protein as number) ?? DEFAULT_TARGETS.protein,
        carbs: (profile.target_carbs as number) ?? DEFAULT_TARGETS.carbs,
        fat: (profile.target_fat as number) ?? DEFAULT_TARGETS.fat,
      });
      const w = profile.weight_kg != null ? Number(profile.weight_kg) : null;
      const gw = profile.goal_weight_kg != null ? Number(profile.goal_weight_kg) : null;
      setWeightKg(Number.isFinite(w) ? w : null);
      setGoalWeightKg(Number.isFinite(gw) ? gw : null);
      setWeightKgByDay(parseNumMap(profile.weight_kg_by_day));
      setStepsByDay(parseNumMap(profile.steps_by_day));
      const sg = profile.daily_steps_goal != null ? Number(profile.daily_steps_goal) : NUTRITION_DEFAULTS.steps;
      setDailyStepsGoal(Number.isFinite(sg) && sg > 0 ? Math.round(sg) : NUTRITION_DEFAULTS.steps);
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
      const rawPushEnabled = (profile as any).weekly_recap_push_enabled;
      setRecapPushEnabled(rawPushEnabled !== false);

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
  const weekStats = useMemo(
    () => buildWeekStats(byDay, targets, weekStartDay, new Date(), weekTargetsByDay),
    [byDay, targets, weekStartDay, weekTargetsByDay],
  );

  // Raw streak retained so the "Raw streak" disclosure row can surface it
  // alongside the protected value — never misrepresented.
  const rawStreakDays = useMemo(() => computeLoggingStreak(byDay as any), [byDay]);
  const protectedStreakInfo = useMemo(
    () => computeProtectedStreak(byDay as any, freezeLedger, freezeBudgetMax),
    [byDay, freezeLedger, freezeBudgetMax],
  );
  const streakDays = protectedStreakInfo.streakLength;
  const freezesAvailable = useMemo(
    () => availableFreezes(freezeLedger, freezeBudgetMax),
    [freezeLedger, freezeBudgetMax],
  );

  // Action 5 Item 7 (2026-04-19) — resolved maintenance for the recap
  // card's adaptive-vs-formula one-liner. Computed at host level so the
  // card stays presentational and the shared `formatMaintenanceRecapLine`
  // helper drives identical render conditions on web + mobile.
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
  // installs with a synced Expo push token; installs without a token
  // receive no weekly push (the upstream fix is token registration —
  // TODO P0-1). The `weekly_recap_push_sent` / `_scheduled` analytics
  // used to fire from this effect with a `currentWeekKey` payload that
  // carried a week-boundary off-by-one bug; removing the schedule also
  // removes the bug. Server-side emit remains the canonical signal.

  // Weight trend (last entries)
  const weightTrend = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = dateKeyFromDate(cutoff);
    const keys = Object.keys(weightKgByDay)
      .filter((k) => k >= cutoffStr)
      .sort();
    if (keys.length < 2) return null;
    const first = weightKgByDay[keys[0]];
    const last = weightKgByDay[keys[keys.length - 1]];
    const diff = last - first;
    return { diff: Math.round(diff * 10) / 10, direction: diff < 0 ? "down" : diff > 0 ? "up" : "flat" as const };
  }, [weightKgByDay]);

  // Weight chart trend — drives WeightChart + WeightRangeToggle
  const weightChartTrend = useMemo(
    () => computeWeightTrend(weightKgByDayToPoints(weightKgByDay), weightChartRange, goalWeightKg),
    [weightKgByDay, weightChartRange, goalWeightKg],
  );

  // Steps today
  const stepsToday = stepsByDay[todayKey] ?? 0;

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

  const t = {
    text: colors.text,
    sub: colors.textSecondary,
    dim: colors.textTertiary,
    bg: colors.background,
    elevated: colors.card,
    border: colors.cardBorder,
    accent: Accent.primary,
    green: Accent.success,
    amber: Accent.warning,
    protein: MacroColors.protein,
    carbs: MacroColors.carbs,
    fat: MacroColors.fat,
  };

  const hasData = Object.keys(byDay).length > 0;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
        {/* Phase 2 / B1.1 — You sub-tab pill bar (Progress default,
            Settings + More siblings). */}
        <YouSubTabHeader />
      <ScrollView
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}
        testID="progress-skeleton"
      >
        {/* Header chrome — same position as post-load render so the
            layout doesn't jump when data arrives. 2026-04-20 prototype
            port: uppercase overline + large "Progress" title + round
            calendar-icon button top-right. Pill calendar button is a
            no-op during load — it becomes interactive once data lands. */}
        <View
          testID="progress-header"
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}
        >
          <View>
            <Text testID="progress-overline" style={{ fontSize: 11, color: t.dim, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 }}>{rangeLabel}</Text>
            <Text style={{ fontSize: 28, fontWeight: "700", color: t.text, letterSpacing: -0.6, marginTop: 2 }}>Progress</Text>
          </View>
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel="Open calendar"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: t.elevated,
              borderWidth: 1,
              borderColor: t.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.6,
            }}
          >
            <CalendarDays size={16} color={t.sub} strokeWidth={1.75} />
          </View>
        </View>
        {/* Range-picker pills — disabled-look during load so the
            skeleton doesn't look interactive. */}
        <View
          testID="progress-range-picker-skeleton"
          style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}
        >
          {(["7d", "30d", "90d", "all"] as const).map((k) => (
            <View
              key={k}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: "center",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: t.border,
                backgroundColor: k === rangeKey ? t.elevated : "transparent",
                opacity: 0.6,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: t.sub }}>{k === "all" ? "All" : k}</Text>
            </View>
          ))}
        </View>

        {/* 2x2 tile skeletons — match real tile footprint (47% width,
            padding 14, radius). No numbers are shown; placeholders are
            a neutral block so we never invent data. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              testID={`progress-skeleton-tile-${i}`}
              style={{
                width: "47%",
                padding: 14,
                borderRadius: Radius.lg,
                backgroundColor: t.elevated,
                borderWidth: 1,
                borderColor: t.border,
                minHeight: 86,
              }}
            >
              <View style={{ width: 60, height: 10, borderRadius: 3, backgroundColor: t.border, marginBottom: 10 }} />
              <View style={{ width: 80, height: 18, borderRadius: 3, backgroundColor: t.border, marginBottom: 6 }} />
              <View style={{ width: 100, height: 10, borderRadius: 3, backgroundColor: t.border }} />
            </View>
          ))}
        </View>

        {/* Inline spinner under the skeleton — reassures the user that
            the view is live without starving the initial paint. */}
        {/* P3 dark-mode fix (2026-04-28): the previous `t.accent`
            resolves to `Accent.primary` (#4c6ce0) regardless of
            scheme; in dark mode that's the wrong tone (too saturated
            against the dark canvas). `colors.tint` resolves to
            `Accent.primaryLight` in dark, matching the system tint. */}
        <View style={{ alignItems: "center", paddingVertical: 12 }}>
          <ActivityIndicator size="small" color={colors.tint} />
        </View>
      </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      {/* Phase 2 / B1.1 — You sub-tab pill bar (Progress default,
          Settings + More siblings). */}
      <YouSubTabHeader />
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }} keyboardShouldPersistTaps="handled">
      {/* Header — 2026-04-20 Claude Design prototype port.
          Uppercase overline reflects the currently-selected range,
          large "Progress" title (28pt / -0.6 tracking), round
          icon button top-right.

          Debug audit 2026-05-04 (visual-qa P1): the icon was
          `CalendarDays` routing to /weight-tracker — a calendar glyph
          that opens a weight log is a false affordance. Until a
          dedicated date-range picker is built, the icon now matches
          its destination (`Scale`) so the user gets what the icon
          promises. */}
      <View
        testID="progress-header"
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}
      >
        <View>
          <Text testID="progress-overline" style={{ fontSize: 11, color: t.dim, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 }}>{rangeLabel}</Text>
          <Text style={{ fontSize: 28, fontWeight: "700", color: t.text, letterSpacing: -0.6, marginTop: 2 }}>Progress</Text>
        </View>
        <Pressable
          testID="progress-calendar-button"
          accessibilityRole="button"
          accessibilityLabel="Open weight tracker"
          onPress={() => router.push("/weight-tracker" as const)}
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
      </View>

      {/* HouseholdBar — 2026-04-20 prototype port. Appears between
          the header and the range-picker pills for household users;
          hidden otherwise (mirror of `screens-mobile.jsx` L580). */}
      <HouseholdBar />

      {/* Phase 4 / B3.1 — Progress story headline (Surface E).
          Engine-led commentary line replacing the stat-card dashboard
          as the visual focus. The maintenance card / charts / stat
          chips beneath remain (demoted) — this card is the lead.
          Authority: D-2026-04-27-12 (always-on TDEE) +
          D-2026-04-27-17 (Progress is a story).

          customer-lens audit (2026-04-30): the live story renders
          even when `adaptiveTdee == null` and the user has < 3
          logged days, which produces narrative based on null. Gate
          via `hasEnoughDataForStory(daysLogged)` and render the
          `<ProgressStoryGate>` placeholder card instead until the
          floor is reached. Geometry matches so the slot doesn't jump.

          See ProgressDashboard.tsx (web) for the deferred-data notes
          on `prevWeekTdee` / `avgIntakeOnLossWeeksKcal`. */}
      <View style={{ marginBottom: 14 }}>
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
      </View>

      {/* Range-picker segmented control — [7d, 30d, 90d, All]. Port
          of prototype `screens-mobile.jsx:581-591` (2026-04-21 D5):
          single muted container with an inset active chip that uses
          `t.elevated` (card) + a subtle shadow. Replaces the earlier
          individual outlined pills so the selector reads as a modern
          segmented control on both platforms. Selection drives the
          overline text in the header. */}
      <View
        testID="progress-range-picker"
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          gap: 6,
          marginBottom: 14,
          backgroundColor: t.border,
          borderRadius: 10,
          padding: 4,
        }}
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
              onPress={() => setRangeKey(k)}
              style={({ pressed }) => [{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 4,
                alignItems: "center",
                borderRadius: 7,
                backgroundColor: active ? t.elevated : "transparent",
                // Prototype: `0 1px 2px rgba(0,0,0,0.1)` on the active chip only.
                shadowColor: "#000",
                shadowOpacity: active ? 0.1 : 0,
                shadowRadius: active ? 2 : 0,
                shadowOffset: { width: 0, height: 1 },
                elevation: active ? 1 : 0,
                opacity: pressed ? 0.8 : 1,
              }]}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: active ? t.text : t.sub }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── 2026-04-20 Prototype Phase 2 cards ──
          Inserted below the range picker and above every legacy card
          (freeze panel, maintenance, journey, daily calories bar,
          weekly recap, macro adherence) so the two new hero cards are
          the first thing a user sees after picking a range. Each card
          reads from the shared `progressRangeStats` helpers so web +
          mobile numbers can't drift. Household bar sits elsewhere
          (owned by another agent). */}
      {/* T13.2 — gate the absolute-weight surface on profile.weight_surface_mode.
          "show": full WeightRangeCard with kg/lb numbers (legacy default).
          "trends_only": direction tile only (arrow + "Slightly down/up/Stable").
          "hide": skip entirely. Same gate applies to the WeightChart and
          Weight Projection / Journey cards lower in the screen so a single
          opt-out reflects everywhere on Progress. */}
      {weightSurfaceMode === "hide" ? null : weightSurfaceMode === "trends_only" ? (
        <WeightTrendOnlyCard
          // P1-14 (TestFlight `AOVuCyOCNB1pI_TjMGNiAeg`, `AHEeeC9a4-lKIyW5n7HgJxs`,
          // 2026-04-22): when there's no weigh-in in the past 7 days,
          // `weekDeltaKg` is null. The previous fallback to the
          // whole-range `deltaKg` then labelled a month-old delta as
          // "this week" — pure fiction. Drop the fallback: if no recent
          // data, the card shows direction copy only ("Stable this
          // week"-style — see WeightTrendOnlyCard for the threshold).
          weekDeltaKg={weightRange.weekDeltaKg}
          rangeKey={rangeKey}
          theme={t}
        />
      ) : (
        <WeightRangeCard
          series={weightRange.series}
          latestKg={weightRange.latestKg}
          weekDeltaKg={weightRange.weekDeltaKg}
          deltaKg={weightRange.deltaKg}
          rangeKey={rangeKey}
          goalWeightKg={goalWeightKg}
          measurementSystem={measurementSystem}
          theme={t}
        />
      )}
      <CaloriesRangeCard
        avgCaloriesPerDay={caloriesRange.avgCaloriesPerDay}
        deltaVsTargetKcal={caloriesRange.deltaVsTargetKcal}
        adherencePct={caloriesRange.adherencePct}
        daysLogged={caloriesRange.daysLogged}
        targetCalories={targets.calories}
        theme={t}
      />

      {!hasData ? (
        <View style={{ padding: 24, borderRadius: Radius.lg, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border, alignItems: "center", gap: Spacing.md }}>
          <IconBox color={t.accent} size={40}>
            <BarChart3 size={20} color={t.accent} strokeWidth={1.75} />
          </IconBox>
          <Text style={{ fontSize: 15, fontWeight: "600", color: t.text, textAlign: "center" }}>Your progress will appear here</Text>
          <Text style={{ fontSize: 13, color: t.sub, textAlign: "center", maxWidth: 260, lineHeight: 18 }}>
            Log meals on the Today tab and your weekly trends, macro adherence, and charts will populate.
          </Text>
        </View>
      ) : (
        <>
          {/* WEEK DIGEST (D3) — replaces WeeklyRecapCard. Host flattens
              the weekly-recap data + usual-meal insight into the shared
              `DigestProps` shape so web + mobile cannot drift. See
              `docs/design/digest-primitive.md`. */}
          {recapVisible ? (() => {
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
              ? {
                  label: recap.bestDay.label,
                  protein: recap.bestDay.protein,
                  calories: recap.bestDay.calories,
                }
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

          {/* Week digest — narrative LEAD card. Replaces the 2x2 grid
              as the visual focus. customer-lens audit 2026-04-30 +
              D-2026-04-27-17.

              `dayOfWeekPattern` is the Lose It "Closer" parity slot
              (audit 2026-04-30) — observational pattern across the
              rolling 4-week window. Helper enforces the 14-day +
              200-kcal-delta gates so we don't surface noise. */}
          <View style={{ marginBottom: 14 }}>
            <DigestStoryCard
              weekLabel={recap.weekLabel}
              daysLogged={weekStats.daysWithFood}
              avgCalories={weekStats.avgCalories}
              targetCalories={targets.calories}
              avgProtein={recap.avgProtein}
              targetProtein={targets.protein}
              proteinOnTargetDays={weekStats.proteinOnTarget}
              closestToTarget={recap.bestDay
                ? {
                    label: recap.bestDay.label,
                    calories: recap.bestDay.calories,
                    protein: recap.bestDay.protein,
                  }
                : null}
              dayOfWeekPattern={computeDayOfWeekPattern(byDay as any)}
            />
          </View>

          {/* DEMOTED stat chips (D-2026-04-27-17 — tiles demoted, not
              deleted). Was a 4-tile 2x2 grid that anchored the page;
              now a compact 2-row chip list of small KPIs that still
              link out to per-metric drill-downs (`progress-metric` +
              `weight-tracker`). Smaller padding, smaller numerals,
              no IconBox tinted backgrounds — reads as a footer
              summary, not the lead. */}
          <View
            testID="progress-demoted-chips"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}
          >
            {([
              [
                formatAvgCaloriesLabel(weekStats.daysWithFood),
                String(weekStats.avgCalories.toLocaleString()),
                `vs ${targets.calories.toLocaleString()} target`,
                weekStats.avgCalories > targets.calories ? t.amber : t.green,
                Flame,
              ],
              [
                "Protein Hit",
                `${weekStats.proteinOnTarget}/${weekStats.daysWithFood || 0}`,
                `day${weekStats.daysWithFood !== 1 ? "s" : ""} on target`,
                weekStats.daysWithFood > 0 && weekStats.proteinOnTarget >= weekStats.daysWithFood * 0.7 ? t.green : t.amber,
                CheckCircle2,
              ],
              [
                "Streak",
                `${streakDays} day${streakDays !== 1 ? "s" : ""}`,
                freezesAvailable > 0
                  ? `· ${freezesAvailable} freeze${freezesAvailable === 1 ? "" : "s"}`
                  : "logging streak",
                streakDays >= 3 ? t.green : t.accent,
                Trophy,
              ],
              [
                "Trend",
                weightTrend
                  ? formatWeightForUnit({ kg: weightTrend.diff, system: measurementSystem, signed: true })
                  : latestWeightKg != null
                    ? formatWeightForUnit({ kg: latestWeightKg, system: measurementSystem })
                    : "—",
                weightTrend
                  ? weightTrend.direction === "down"
                    ? "losing (90d)"
                    : weightTrend.direction === "up"
                      ? "gaining (90d)"
                      : "maintaining (90d)"
                  : "no weight data",
                weightTrend?.direction === "down" ? t.green : weightTrend?.direction === "up" ? t.amber : t.accent,
                weightTrend?.direction === "down" ? TrendingDown : weightTrend?.direction === "up" ? TrendingUp : LineChart,
              ],
            ] as const).map(([title, val, sub, color, IconCmp], i) => {
              const Icon = IconCmp as LucideIcon;
              // Match by prefix — `formatAvgCaloriesLabel` returns
              // either "Avg Calories" or "Avg on logged days (X/7)".
              const isAvgCaloriesTile =
                title === "Avg Calories" || title.startsWith("Avg on logged days");
              const openTile = () => {
                if (title === "Trend") {
                  router.push("/weight-tracker" as const);
                  return;
                }
                const metric =
                  isAvgCaloriesTile ? "calories" : title === "Protein Hit" ? "protein" : title === "Streak" ? "streak" : null;
                if (metric) {
                  router.push({ pathname: "/progress-metric" as any, params: { metric } });
                }
              };
              const a11yLabel =
                title === "Trend"
                  ? `Weight trend, ${val}, ${sub}`
                  : isAvgCaloriesTile
                    ? `Average calories ${val}, ${sub}`
                    : title === "Protein Hit"
                      ? `Protein on target ${val}, ${sub}`
                      : `Logging streak ${val}, ${sub}`;
              return (
                <Pressable
                  key={i}
                  testID={`progress-demoted-chip-${i}`}
                  onPress={openTile}
                  accessibilityRole="button"
                  accessibilityLabel={a11yLabel}
                  accessibilityHint="Opens detailed breakdown"
                  style={({ pressed }) => [
                    {
                      width: "48%",
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: Radius.md,
                      backgroundColor: "transparent",
                      borderWidth: 1,
                      borderColor: t.border,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Icon size={12} color={color as string} strokeWidth={1.75} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 10,
                        color: t.dim,
                        fontWeight: "500",
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                      }}
                    >
                      {title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 13,
                        color: t.text,
                        fontWeight: "600",
                        fontVariant: ["tabular-nums"],
                        marginTop: 1,
                      }}
                    >
                      {val}
                      <Text style={{ fontSize: 11, color: t.sub, fontWeight: "400" }}>
                        {sub ? `  ${sub}` : ""}
                      </Text>
                    </Text>
                  </View>
                  <ChevronRight size={12} color={t.dim} strokeWidth={1.75} />
                </Pressable>
              );
            })}
          </View>

          {/* H-4 — `chartsReady` defers mounting the heavy chart + card
              stack by one frame after load so the stat-grid + recap
              paint first. Placeholder card keeps the scroll position
              stable; swap happens within ~16ms on warm focus. */}
          {!chartsReady ? (
            <View
              testID="progress-charts-pending"
              style={{
                backgroundColor: t.elevated,
                borderRadius: Radius.lg,
                borderWidth: 1,
                borderColor: t.border,
                padding: 16,
                marginBottom: 14,
                minHeight: 140,
              }}
            >
              <View style={{ width: 110, height: 12, borderRadius: 3, backgroundColor: t.border, marginBottom: 16 }} />
              {/* P3 dark-mode fix — see note above the loading spinner. */}
              <ActivityIndicator size="small" color={colors.tint} />
            </View>
          ) : (
          <>
          {/* Daily Calories Bar Chart
              TestFlight `AISAWnLgU9cjRBOuEY-HuJU` (2026-04-18) — tester
              said "not intuitive". The bars were green/amber with no
              intake-target line on the chart itself + no legend for what
              the colours meant. Added: (a) dashed target line across the
              full chart at `targets.calories`, with its value labelled
              at the right edge; (b) a one-line legend under the chart
              stating exactly what each colour means. */}
          <View style={{ backgroundColor: t.elevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: t.text, marginBottom: 12 }}>Daily Calories</Text>
            {(() => {
              const chartHeight = 90;
              const maxCal = Math.max(targets.calories, ...weekStats.days.map((dd) => dd.calories));
              const barMax = chartHeight * 0.78; // leaves room above for value labels
              const targetY = maxCal > 0 ? (targets.calories / (maxCal * 1.15)) * barMax : 0;
              return (
                <View style={{ height: chartHeight }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: chartHeight, position: "relative" }}>
                    {weekStats.days.map((d) => {
                      const barH = maxCal > 0 ? Math.max(4, (d.calories / (maxCal * 1.15)) * barMax) : 4;
                      // F-2 — colour each bar against the target that
                      // was active *on that day*. `d.targetCalories`
                      // resolves to the snapshot when one exists, else
                      // the current profile target (pre-migration).
                      const overTarget = d.calories > d.targetCalories;
                      const isDayToday = d.key === todayKey;
                      // Action 13 Item #11 (2026-04-19) — past days
                      // without a snapshot render with a dashed border
                      // so the user can tell the bar's colour was
                      // judged against today's target (the current
                      // fallback) rather than the target they actually
                      // had on that day. Today and future days don't
                      // have historical-target ambiguity, so skip the
                      // cue there.
                      const isPast = d.key < todayKey;
                      const showApproxCue = isPast && !d.isSnapshot && d.calories > 0;
                      return (
                        <Pressable
                          key={d.key}
                          onPress={() => {
                            router.navigate({ pathname: "/(tabs)" as any, params: { date: d.key, _t: String(Date.now()) } });
                          }}
                          accessibilityHint={showApproxCue ? "Compared against today's target. No saved target for that day." : undefined}
                          style={{ flex: 1, alignItems: "center", gap: 4 }}
                        >
                          <Text style={{ fontSize: 11, color: t.dim, fontVariant: ["tabular-nums"] }}>
                            {d.calories > 0 ? (d.calories >= 1000 ? `${(d.calories / 1000).toFixed(1)}k` : String(d.calories)) : ""}
                          </Text>
                          <View
                            testID={`progress-day-bar-${d.key}`}
                            style={{
                              width: "100%",
                              height: barH,
                              borderRadius: 5,
                              backgroundColor: d.calories === 0 ? t.border : overTarget ? t.amber : t.green,
                              opacity: isDayToday ? 1 : 0.75,
                              ...(showApproxCue
                                ? {
                                    borderWidth: 1,
                                    borderStyle: "dashed",
                                    borderColor: t.dim,
                                  }
                                : {}),
                            }}
                          />
                          <Text style={{ fontSize: 10, color: isDayToday ? t.accent : t.dim, fontWeight: isDayToday ? "700" : "500" }}>{d.label}</Text>
                        </Pressable>
                      );
                    })}
                    {/* Dashed target line — positioned from the bar base up
                        to the target y. Pointer-events off so the bars stay
                        tappable. */}
                    {targets.calories > 0 && maxCal > 0 && (
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: 16 /* room for day label */ + targetY,
                          height: 1,
                          borderTopWidth: 1,
                          borderStyle: "dashed",
                          borderColor: t.accent,
                          opacity: 0.7,
                        }}
                      />
                    )}
                  </View>
                </View>
              );
            })()}
            {/* Legend + target label */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: t.green }} />
                  <Text style={{ fontSize: 10, color: t.dim }}>At or under target</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: t.amber }} />
                  <Text style={{ fontSize: 10, color: t.dim }}>Over target</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 10, height: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: t.accent }} />
                  <Text style={{ fontSize: 10, color: t.dim }}>Target {targets.calories.toLocaleString()} kcal</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Macro Adherence */}
          <View style={{ backgroundColor: t.elevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: t.text, marginBottom: 12 }}>Macro Adherence</Text>
            <Text style={{ fontSize: 10, color: t.dim, marginBottom: 8 }}>
              Based on {weekStats.daysWithFood} day{weekStats.daysWithFood !== 1 ? "s" : ""} with logged food
            </Text>
            {([
              // Action 13 Item #4 (2026-04-19) — pass the raw adherence
              // through `formatMacroAdherenceBar` so the bar fill caps
              // at 150% and the label preserves the actual value with
              // a "(capped at 150)" suffix when over the cap. Identical
              // helper drives web `ProgressDashboard.tsx` so the figure
              // can't drift between platforms.
              ["Protein", weekStats.proteinAdherence, t.protein],
              ["Carbs", weekStats.carbsAdherence, t.carbs],
              ["Fat", weekStats.fatAdherence, t.fat],
            ] as const).map(([name, pct, color]) => {
              const bar = formatMacroAdherenceBar({ adherencePct: pct });
              return (
                <View key={name} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
                  <Text style={{ fontSize: 12, color: t.sub, width: 50 }}>{name}</Text>
                  {/* F-117 v2 (Grace, 2026-05-07): bar fill is now
                      pre-clamped at 100 in `formatMacroAdherenceBar`,
                      and the over-budget signal moved into the label
                      colour (destructive instead of macro). The
                      "(capped at 150)" suffix is gone. `overflow:hidden`
                      stays as a defence-in-depth guard. */}
                  <View
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: t.border,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      testID={`macro-adherence-bar-${name.toLowerCase()}`}
                      style={{
                        width: `${bar.barFillPct}%`,
                        height: "100%",
                        borderRadius: 3,
                        backgroundColor: bar.isOver ? Accent.destructive : color,
                      }}
                    />
                  </View>
                  <Text
                    testID={`macro-adherence-label-${name.toLowerCase()}`}
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: bar.isOver ? Accent.destructive : color,
                      minWidth: 56,
                      textAlign: "right",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {bar.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* D4 (2026-04-21) — Apple Health card. Sits below the weekly
              protein bar (Macro Adherence above) per the prototype.
              Component is pure; host pulls today's values from the
              profile maps we already hydrate on focus. */}
          {userId ? (
            <AppleHealthCardHost
              userId={userId}
              stepsToday={stepsByDay[todayKey] ?? null}
              latestWeightKg={latestWeightKg}
              useImperial={measurementSystem === "imperial"}
            />
          ) : null}

          {/* Maintenance card — F-3 (2026-04-19, TestFlight
              `ADFYpDgEEb0QH-j3BXshPTo`). Was "Your TDEE"; value + label
              now read from the shared `resolveMaintenance` so Today's
              Activity Bonus card and this card can't drift. Adaptive
              badge, confidence bars, and the "Formula estimate / +N
              actual" subline are preserved so power users still see
              the underlying spread. */}
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
              style={{ backgroundColor: t.elevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <IconBox color={t.accent} size={28}>
                    <Zap size={14} color={t.accent} strokeWidth={1.75} />
                  </IconBox>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: t.text }}>Maintenance</Text>
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
                  /* Action 13 Item #14 (2026-04-19) — explicit
                     "Formula estimate" pill when the resolver fell
                     back to the formula. Previously formula-fallback
                     users got no source label at all; coupled with
                     the prior confidence-bar layout this read as if
                     the displayed kcal was a low-confidence adaptive
                     number when in fact it was the formula. The
                     confidence bar below remains gated on
                     `showAdaptiveExtras` so it still hides for
                     formula. */
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
                <Text style={{ fontSize: 32, fontWeight: "700", color: showAdaptiveExtras ? t.green : t.text, fontVariant: ["tabular-nums"] }}>
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

              {/* Confidence bars — only meaningful when adaptive won. */}
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

              {/* Data progress for non-adaptive users */}
              {!showAdaptiveExtras && (
                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.border }}>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={{ fontSize: 10, color: t.dim }}>Weigh-ins</Text>
                        <Text style={{ fontSize: 10, fontWeight: "600", color: t.text, fontVariant: ["tabular-nums"] }}>{Object.keys(weightKgByDay).length}/7</Text>
                      </View>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: t.border }}>
                        <View style={{ width: `${Math.min(100, (Object.keys(weightKgByDay).length / 7) * 100)}%` as any, height: "100%", borderRadius: 2, backgroundColor: t.accent }} />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={{ fontSize: 10, color: t.dim }}>Log days</Text>
                        <Text style={{ fontSize: 10, fontWeight: "600", color: t.text, fontVariant: ["tabular-nums"] }}>{Object.keys(byDay).filter((k) => (byDay[k] ?? []).length > 0).length}/21</Text>
                      </View>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: t.border }}>
                        <View style={{ width: `${Math.min(100, (Object.keys(byDay).filter((k) => (byDay[k] ?? []).length > 0).length / 21) * 100)}%` as any, height: "100%", borderRadius: 2, backgroundColor: t.accent }} />
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* G-4 (2026-04-19, TestFlight `ALcwMFPjfmJvyBLjs4CRt1k`)
                  — "How this works" expandable. Chain from BMR through
                  Maintenance, Calorie goal, and projected weekly loss
                  so the tester can see how every number connects. No
                  new DB reads; all inputs are already loaded for this
                  screen. Parity pinned by
                  `tests/unit/maintenanceChain.test.ts`. */}
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
                      <Text style={{ fontSize: 12, fontWeight: "600", color: t.accent }}>
                        {maintenanceExplainerOpen ? "Hide" : "How this works"}
                      </Text>
                      {maintenanceExplainerOpen ? (
                        <ChevronUp size={14} color={t.accent} strokeWidth={1.75} />
                      ) : (
                        <ChevronDown size={14} color={t.accent} strokeWidth={1.75} />
                      )}
                    </Pressable>
                    {maintenanceExplainerOpen && (
                      <View style={{ marginTop: 10, gap: 6 }}>
                        {chain.steps.map((step, i) => {
                          const isSummary = step.kind === "summary" || step.kind === "weeklyLoss";
                          return (
                            <View
                              key={`${step.kind}-${i}`}
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 12,
                              }}
                            >
                              <Text
                                style={{
                                  flex: 1,
                                  fontSize: 12,
                                  lineHeight: 17,
                                  color: isSummary ? t.sub : t.text,
                                  fontWeight: step.emphasis ? "700" : "500",
                                }}
                              >
                                {step.label}
                              </Text>
                              {step.value ? (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: step.emphasis ? t.text : t.sub,
                                    fontWeight: step.emphasis ? "700" : "500",
                                    fontVariant: ["tabular-nums"],
                                  }}
                                >
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

          {/* Steps Card
              Action 13 Item #10 (2026-04-19) — render the card against
              the HK sync status, not just the raw `stepsByDay` map.
                - pending: skeleton (we haven't asked HK yet — never
                  show "0" we can't justify)
                - failed:  honest "Steps sync paused — open Health
                  permissions" with a tap-to-retry; never a 0
                - success: real count (0 = legitimate 0)
              Previous version always rendered "(stepsByDay[todayKey]
              ?? 0)", which made a permissions failure look like a
              normal "you haven't walked yet". */}
          <View
            testID="progress-steps-card"
            style={{ backgroundColor: t.elevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <IconBox color={t.green} size={28}>
                <Footprints size={14} color={t.green} strokeWidth={1.75} />
              </IconBox>
              <Text style={{ fontSize: 13, fontWeight: "600", color: t.text }}>Steps Today</Text>
            </View>
            {stepsSyncStatus === "pending" ? (
              <View testID="progress-steps-skeleton" style={{ height: 30, justifyContent: "center" }}>
                <ActivityIndicator size="small" color={t.accent} />
              </View>
            ) : stepsSyncStatus === "failed" ? (
              <View testID="progress-steps-sync-failed">
                <Text style={{ fontSize: 13, color: t.amber, marginBottom: 6 }}>
                  Steps sync paused — open Health permissions
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry activity sync"
                  testID="progress-steps-sync-retry"
                  disabled={stepsSyncRetrying}
                  onPress={async () => {
                    if (!userId) return;
                    setStepsSyncRetrying(true);
                    setStepsSyncStatus("pending");
                    try {
                      await syncHealthDataThrottled(userId, { bypassThrottle: true });
                      setStepsSyncStatus("success");
                      // Re-read steps so the card reflects the new value.
                      const { data: refreshed } = await supabase
                        .from("profiles")
                        .select("steps_by_day")
                        .eq("id", userId)
                        .maybeSingle();
                      if (refreshed) setStepsByDay(parseNumMap((refreshed as any).steps_by_day));
                    } catch {
                      setStepsSyncStatus("failed");
                    } finally {
                      setStepsSyncRetrying(false);
                    }
                  }}
                  style={({ pressed }) => ({
                    alignSelf: "flex-start",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: t.accent + "18",
                    borderWidth: 1,
                    borderColor: t.accent + "40",
                    opacity: pressed || stepsSyncRetrying ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: t.accent }}>
                    {stepsSyncRetrying ? "Retrying…" : "Retry sync"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                  <Text style={{ fontSize: 28, fontWeight: "700", color: stepsToday >= dailyStepsGoal ? t.green : t.text, fontVariant: ["tabular-nums"] }}>
                    {stepsToday.toLocaleString()}
                  </Text>
                  <Text style={{ fontSize: 13, color: t.sub }}>/ {dailyStepsGoal.toLocaleString()}</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: t.border, marginTop: 8 }}>
                  <View style={{ width: `${Math.min((stepsToday / dailyStepsGoal) * 100, 100)}%`, height: "100%", borderRadius: 3, backgroundColor: t.green }} />
                </View>
              </>
            )}
          </View>

          {/* Weight Chart Card — T13.2: only render in full "show" mode.
              The chart visualises absolute kg progression, which is
              exactly what trends_only / hide users opted out of. */}
          {weightSurfaceMode === "show" ? (
          <View
            style={{
              backgroundColor: t.elevated,
              borderRadius: Radius.lg,
              borderWidth: 1,
              borderColor: t.border,
              padding: 16,
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              {/* 2026-04-26 polish (round 2): per docs/ux/design-tokens.md
                  card / section headers are Sentence Case (matches "Daily
                  Calories" + "Macro Adherence" further down the same screen).
                  WEIGHT was the lone UPPERCASE outlier on this surface. */}
              <Text style={{ fontSize: 13, fontWeight: "600", color: t.text }}>Weight</Text>
              {weightChartTrend.daysSinceLatest != null && weightChartTrend.daysSinceLatest > 10 && (
                <View style={{ backgroundColor: colors.inputBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, color: t.sub }}>{weightChartTrend.daysSinceLatest}d since last log</Text>
                </View>
              )}
            </View>
            <WeightRangeToggle value={weightChartRange} onChange={setWeightChartRange} />
            <View style={{ marginTop: 12 }}>
              {/*
                2026-05-06: relaxed >=3 → >=2 so the chart renders a
                line as soon as the user has two weigh-ins. The chart
                code already handles low-count cases (no MA below 3
                points), and the smart bucket fallback in
                computeWeightTrend prevents long ranges from
                collapsing short histories into <3 buckets.
              */}
              {weightChartTrend.points.length >= 2 ? (
                <WeightChart trend={weightChartTrend} goalKg={goalWeightKg} />
              ) : (
                <WeightSparseState
                  points={weightChartTrend.points}
                  onLogWeight={() => router.push("/weight-tracker" as const)}
                />
              )}
            </View>
            {weightChartTrend.points.length >= 2 && (
              <Text style={{ fontSize: 12, color: t.sub, marginTop: 6 }}>
                {weightChartTrend.trendCopy} {weightChartTrend.sinceLabel}.
              </Text>
            )}
          </View>
          ) : null}

          {/* Weight Projection / Journey Card — T13.2: also gated on
              weightSurfaceMode === "show". Projection visualises absolute
              kg vs goal kg, which is the exact thing opt-out users hide. */}
          {weightSurfaceMode === "show" &&
            latestWeightKg != null &&
            goalWeightKg != null &&
            Math.abs(goalWeightKg - latestWeightKg) > 0.05 && (
            (() => {
              const timeline = calcGoalTimeline({
                currentWeightKg: latestWeightKg,
                goalWeightKg: goalWeightKg,
                weightKgByDay,
              });
              const journeyProg = weightJourneyProgress({
                goalKg: goalWeightKg,
                latestKg: latestWeightKg,
                weightKgByDay,
              });
              // F-4a (2026-04-19, TestFlight `AHEeeC9a4-lKIyW5n7HgJxs`):
              // formula is `(start - current) / (start - goal)` clamped
              // to [0, 1], via the shared helper. The old
              // `Math.max(3, …)` floor made 0% render as 3% which looked
              // like a broken progress bar on day-one accounts. At 0 we
              // now render an empty bar + "Just starting" copy.
              const pctFrac = journeyProg
                ? computeWeightJourneyProgressPct({
                    startKg: journeyProg.baselineKg,
                    currentKg: latestWeightKg,
                    goalKg: goalWeightKg,
                  })
                : null;
              const progressPct = pctFrac != null ? Math.round(pctFrac * 100) : 0;
              const progressCopy = formatWeightJourneyProgressCopy(pctFrac);
              // Also show daily projection based on average recent intake
              const daysWithFood = Object.keys(byDay).filter((k) => (byDay[k] ?? []).length > 0);
              const recentDays = daysWithFood.slice(-7);
              const avgCals = recentDays.length > 0
                ? Math.round(recentDays.reduce((s, k) => s + (byDay[k] ?? []).reduce((a, m) => a + Math.max(0, (m as any).calories ?? 0), 0), 0) / recentDays.length)
                : 0;
              // Prefer the user's real TDEE (adaptive when available, else static
              // Mifflin) as the break-even number so the projection respects
              // actual burn and doesn't flag a genuine deficit as a gain. See
              // TestFlight `ALkK-XrcMz_V-D6NrjuVYbo`.
              const maintenanceTdeeKcal = isAdaptiveTdee && adaptiveTdee != null ? adaptiveTdee : staticTdee;
              // Action 13 Item #8 (2026-04-19) — gate the projection on
              // ≥5 recent food-logged days via the shared
              // `shouldRenderDailyProjection`. Projecting from 2 days
              // of food was dishonest — a single high or low day
              // dragged the projection ±2-3 kg out. Below the floor we
              // suppress the entire projection line; the journey card
              // still renders progress + days-to-goal.
              const projectionEligible = shouldRenderDailyProjection(daysWithFood.length);
              // F-126 (Grace, 2026-05-07): prefer the observed weekly
              // weight rate over the formula deficit when it's
              // reliable. The Journey card already shows
              // "Currently losing ~0.3 kg/week" derived from
              // `timeline.weeklyRateKg`; pass that in so the
              // projection respects the scale instead of forecasting
              // from a stale TDEE estimate. Sign convention: negative
              // for loss (user's actual rate × goal direction).
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
                  onPress={() => router.push("/weight-tracker" as const)}
                  accessibilityRole="button"
                  accessibilityLabel="Weight journey and charts"
                  accessibilityHint="Opens detailed weight progress"
                  style={({ pressed }) => ({
                    backgroundColor: t.elevated,
                    borderRadius: Radius.lg,
                    borderWidth: 1,
                    borderColor: t.border,
                    padding: 16,
                    marginBottom: 14,
                    opacity: pressed ? 0.94 : 1,
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <IconBox color={t.green} size={28}>
                        <Flag size={14} color={t.green} strokeWidth={1.75} />
                      </IconBox>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: t.text }}>Journey</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {timeline.daysToGoal != null ? (
                        <Text style={{ fontSize: 22, fontWeight: "700", color: t.accent, fontVariant: ["tabular-nums"] }}>
                          {timeline.daysToGoal}<Text style={{ fontSize: 12, fontWeight: "500", color: t.sub }}> days to goal</Text>
                        </Text>
                      ) : timeline.cappedAtMaxDays ? (
                        /* Action 13 Item #15 (2026-04-19) — > 365 days
                           projected, surface honest "more than 1 year"
                           copy instead of an empty headline. Rate
                           continues to render in the line below so the
                           user can see the current pace. */
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

                  {/* Progress description */}
                  <Text style={{ fontSize: 13, color: t.sub, marginBottom: 10, lineHeight: 18 }}>
                    {timeline.remainingKg > 0.1
                      ? `${timeline.remainingKg} kg left to reach ${goalWeightKg} kg.`
                      : "You've reached your goal weight!"}
                    {timeline.weeklyRateKg !== 0 && ` Currently ${timeline.trendDirection === "losing" ? "losing" : timeline.trendDirection === "gaining" ? "gaining" : "maintaining"} ~${Math.abs(timeline.weeklyRateKg)} kg/week.`}
                  </Text>

                  {/* Progress bar with start weight label */}
                  {journeyProg && (
                    <View style={{ marginBottom: 4 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={{ fontSize: 10, color: t.dim }}>Start: {journeyProg.baselineKg} kg</Text>
                        <Text style={{ fontSize: 10, color: t.dim }}>Goal: {goalWeightKg} kg</Text>
                      </View>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.border }}>
                        <View style={{
                          width: `${progressPct}%` as any,
                          height: "100%",
                          borderRadius: 3,
                          backgroundColor: progressPct >= 100 ? t.green : t.accent,
                        }} />
                      </View>
                      <Text
                        testID="progress-journey-copy"
                        style={{ fontSize: 10, color: t.dim, marginTop: 4, textAlign: "center" }}
                      >
                        {progressCopy
                          ? `Now: ${latestWeightKg} kg \u00B7 ${progressCopy}`
                          : `Now: ${latestWeightKg} kg`}
                      </Text>
                    </View>
                  )}

                  {/* Daily projection */}
                  {dailyProjection && (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.border }}>
                      <Text style={{ fontSize: 12, color: t.sub, lineHeight: 18 }}>
                        Your recent 7-day average is {avgCals.toLocaleString()} kcal/day vs {targets.calories.toLocaleString()} target, putting you on track for{" "}
                        <Text style={{ fontWeight: "700", color: t.accent }}>{dailyProjection.projectedWeightKg} kg</Text> in ~{dailyProjection.projectionWeeks} weeks.
                      </Text>
                      <Text style={{ fontSize: 10, color: t.dim, marginTop: 4 }}>
                        Based on 7,700 kcal per kg. This uses your weekly average, so it may differ from single-day projections.
                      </Text>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: t.accent }}>View weight trends</Text>
                    <ChevronRight size={12} color={t.accent} strokeWidth={1.75} />
                  </View>
                </Pressable>
              );
            })()
          )}

          {/* Weekly Insight — removed (Action 5 Item 1, 2026-04-19).
              The card restated numbers already on screen above (avg
              calories, protein on target, streak). Replacement is being
              scoped by `ui-product-designer` as a card-grammar-conformant
              component; re-introduce when the new spec lands. */}
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
    </ScrollView>
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

function pillStyle(bg: string) {
  return {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: bg,
  } as const;
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
      style={{
        backgroundColor: theme.elevated,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        marginBottom: 14,
      }}
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

function WeightRangeCard({
  series,
  latestKg,
  weekDeltaKg,
  deltaKg,
  rangeKey,
  goalWeightKg,
  measurementSystem,
  theme,
}: {
  series: { dateKey: string; kg: number }[];
  latestKg: number | null;
  weekDeltaKg: number | null;
  deltaKg: number | null;
  rangeKey: "7d" | "30d" | "90d" | "all";
  goalWeightKg: number | null;
  measurementSystem: MeasurementSystem;
  theme: CardTheme;
}) {
  // Do not render the card at all until we know the user has logged a
  // weight — otherwise we'd surface "— kg" which invents no value but
  // looks broken.
  if (latestKg == null) {
    return (
      <View
        testID="progress-weight-range-card-empty"
        style={{
          backgroundColor: theme.elevated,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 16,
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: "600", color: theme.dim, textTransform: "uppercase", letterSpacing: 0.8 }}>Weight</Text>
        <Text style={{ fontSize: 13, color: theme.sub, marginTop: 8, lineHeight: 18 }}>
          Log a weight on the tracker to see your trend here.
        </Text>
      </View>
    );
  }
  const weekDelta = weekDeltaKg ?? deltaKg;
  // "On track" pill: losing weight toward a lower goal, or gaining
  // toward a higher goal. When we have no goal we keep the tone
  // neutral rather than guessing a direction.
  let onTrackPill: { label: string; tone: "green" | "neutral" } = { label: "", tone: "neutral" };
  if (goalWeightKg != null && weekDelta != null) {
    const towardGoal =
      (goalWeightKg < latestKg && weekDelta < -0.05) ||
      (goalWeightKg > latestKg && weekDelta > 0.05);
    onTrackPill = towardGoal
      ? { label: "On track", tone: "green" }
      : { label: "", tone: "neutral" };
  }
  const latestDisplay = formatWeightForUnit({ kg: latestKg, system: measurementSystem });
  const weekDeltaDisplay =
    weekDelta != null && Math.abs(weekDelta) >= 0.05
      ? formatWeightForUnit({ kg: weekDelta, system: measurementSystem, signed: true })
      : null;
  const windowLabel =
    rangeKey === "7d" ? "last 7 days" : rangeKey === "30d" ? "last 30 days" : rangeKey === "90d" ? "last 90 days" : "all time";

  return (
    <View
      testID="progress-weight-range-card"
      style={{
        backgroundColor: theme.elevated,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: theme.dim, textTransform: "uppercase", letterSpacing: 1.1 }}>
          Weight
        </Text>
        {onTrackPill.label ? (
          <View testID="progress-weight-on-track-pill" style={pillStyle(theme.green + "22")}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: theme.green }}>{onTrackPill.label}</Text>
          </View>
        ) : null}
      </View>
      <Text
        testID="progress-weight-range-value"
        style={{ fontSize: 24, fontWeight: "700", color: theme.text, fontVariant: ["tabular-nums"], letterSpacing: -0.3 }}
      >
        {latestDisplay}
      </Text>
      {weekDeltaDisplay ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
          {weekDelta! < 0 ? (
            <TrendingDown size={12} color={theme.sub} strokeWidth={1.75} />
          ) : (
            <TrendingUp size={12} color={theme.sub} strokeWidth={1.75} />
          )}
          <Text style={{ fontSize: 12, color: theme.sub, fontVariant: ["tabular-nums"] }}>
            {weekDeltaDisplay} this week
          </Text>
        </View>
      ) : null}
      <View style={{ marginTop: 10 }}>
        <Sparkline
          points={series.map((p) => p.kg)}
          color={theme.accent}
          width={280}
          height={48}
        />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        {series.length >= 2 ? (
          <>
            <Text style={{ fontSize: 10, color: theme.dim }}>{series[0].dateKey.slice(5)}</Text>
            <Text style={{ fontSize: 10, color: theme.dim }}>{series[series.length - 1].dateKey.slice(5)}</Text>
          </>
        ) : (
          <Text style={{ fontSize: 10, color: theme.dim }}>Need at least 2 weigh-ins</Text>
        )}
      </View>
      <Text style={{ fontSize: 11, color: theme.dim, marginTop: 8, lineHeight: 16 }}>
        Trend across the {windowLabel}. Projection appears in the Journey card below once you have enough data.
      </Text>
    </View>
  );
}

function CaloriesRangeCard({
  avgCaloriesPerDay,
  deltaVsTargetKcal,
  adherencePct,
  daysLogged,
  targetCalories,
  theme,
}: {
  avgCaloriesPerDay: number | null;
  deltaVsTargetKcal: number | null;
  adherencePct: number | null;
  daysLogged: number;
  targetCalories: number;
  theme: CardTheme;
}) {
  return (
    <View testID="progress-calories-range-wrapper" style={{ marginBottom: 14 }}>
      {/* 17pt bold header sits OUTSIDE the card per the prototype. */}
      <Text
        testID="progress-calories-range-header"
        style={{ fontSize: 17, fontWeight: "700", color: theme.text, letterSpacing: -0.2, marginBottom: 8 }}
      >
        Calories
      </Text>
      <View
        testID="progress-calories-range-card"
        style={{
          backgroundColor: theme.elevated,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 16,
        }}
      >
        {avgCaloriesPerDay == null ? (
          <Text style={{ fontSize: 13, color: theme.sub, lineHeight: 18 }}>
            Log meals on Today to see your average calories for this range.
          </Text>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text
                  testID="progress-calories-range-avg"
                  style={{ fontSize: 24, fontWeight: "700", color: theme.text, fontVariant: ["tabular-nums"], letterSpacing: -0.3 }}
                >
                  {avgCaloriesPerDay.toLocaleString()}<Text style={{ fontSize: 13, fontWeight: "500", color: theme.sub }}> avg/day</Text>
                </Text>
              </View>
              {deltaVsTargetKcal != null ? (
                <View
                  testID="progress-calories-range-delta-pill"
                  style={pillStyle(deltaVsTargetKcal <= 0 ? theme.green + "22" : theme.amber + "22")}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: deltaVsTargetKcal <= 0 ? theme.green : theme.amber,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {deltaVsTargetKcal > 0 ? "+" : "−"}
                    {Math.abs(deltaVsTargetKcal).toLocaleString()} vs target
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              testID="progress-calories-range-subtitle"
              style={{ fontSize: 12, color: theme.sub, marginTop: 6, fontVariant: ["tabular-nums"] }}
            >
              Target {targetCalories.toLocaleString()}
              {adherencePct != null ? ` · ${adherencePct}% avg` : ""}
              {daysLogged > 0 ? ` · ${daysLogged} logged day${daysLogged === 1 ? "" : "s"}` : ""}
            </Text>
          </>
        )}
      </View>
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
