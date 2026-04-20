import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, Pressable, View, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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
import { resolveMaintenance } from "../../../../src/lib/nutrition/resolveMaintenance";
import { buildMaintenanceChain } from "../../../../src/lib/nutrition/maintenanceChain";
import type { PlanPace } from "../../../../src/lib/nutrition/tdee";
import {
  coerceMeasurementSystem,
  formatWeightForUnit,
  type MeasurementSystem,
} from "../../../../src/lib/measurements";
import { computeWeightTrendCopy } from "../../../../src/lib/nutrition/weightTrendTile";
import { syncHealthDataThrottled, isHealthSyncAvailable } from "@/lib/healthSync";
import { buildWeekStats, formatAvgCaloriesLabel, formatMacroAdherenceBar } from "@/lib/progressWeekReport";
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
import { listSavedMeals, type SavedMeal } from "../../../../src/lib/nutrition/savedMeals";
import { normaliseRecipeTitle } from "../../../../src/lib/nutrition/usualMealHint";
import {
  PENDING_USUAL_MEAL_SAVE_KEY,
  serializePendingUsualMealSave,
} from "../../../../src/lib/nutrition/pendingUsualMealSave";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../../src/lib/analytics/events";
import { WeeklyRecapCard } from "@/components/WeeklyRecapCard";

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

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  const latestWeightKg = useMemo(
    () => resolveLatestWeightKg(weightKgByDay, weightKg),
    [weightKgByDay, weightKg],
  );

  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);

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

    const [{ data: rows }, { data: profile }] = await Promise.all([
      supabase
        .from("nutrition_entries")
        .select("date_key, calories, protein, carbs, fat")
        .eq("user_id", userId)
        .gte("date_key", ninetyDaysAgo)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("target_calories, target_protein, target_carbs, target_fat, weight_kg, goal_weight_kg, weight_kg_by_day, steps_by_day, daily_steps_goal, week_start_day, goal, plan_pace, sex, height_cm, age, activity_level, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history, weekly_recap_last_seen_week_key, weekly_recap_push_enabled, measurement_system")
        .eq("id", userId)
        .maybeSingle(),
    ]);

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
  }, [userId]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

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
  const recap = useMemo(
    () =>
      buildWeeklyRecap({
        byDay: byDay as any,
        weightKgByDay,
        targets,
        weekStartDay,
        ledger: freezeLedger,
        budgetMax: freezeBudgetMax,
      }),
    [byDay, weightKgByDay, targets, weekStartDay, freezeLedger, freezeBudgetMax],
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
        // eslint-disable-next-line no-console
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

  const recapShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!recapVisible) return;
    if (recapShownRef.current === recap.weekKey) return;
    recapShownRef.current = recap.weekKey;
    track(AnalyticsEvents.weekly_recap_shown, { weekKey: recap.weekKey });
  }, [recapVisible, recap.weekKey]);

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

  // Steps today
  const stepsToday = stepsByDay[todayKey] ?? 0;

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
      <ScrollView
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}
        testID="progress-skeleton"
      >
        {/* Header chrome — same position as post-load render so the
            layout doesn't jump when data arrives. */}
        <Text style={{ fontSize: 22, fontWeight: "700", color: t.text, letterSpacing: -0.4 }}>Progress</Text>
        <Text style={{ fontSize: 12, color: t.dim, marginTop: 1, marginBottom: 14 }}>Weekly report</Text>

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
        <View style={{ alignItems: "center", paddingVertical: 12 }}>
          <ActivityIndicator size="small" color={t.accent} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <Text style={{ fontSize: 22, fontWeight: "700", color: t.text, letterSpacing: -0.4 }}>Progress</Text>
      <Text style={{ fontSize: 12, color: t.dim, marginTop: 1, marginBottom: 14 }}>Weekly report</Text>

      {!hasData ? (
        <View style={{ padding: 24, borderRadius: Radius.lg, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border, alignItems: "center", gap: Spacing.md }}>
          <IconBox color={t.accent} size={40}>
            <Ionicons name="bar-chart-outline" size={20} color={t.accent} />
          </IconBox>
          <Text style={{ fontSize: 15, fontWeight: "600", color: t.text, textAlign: "center" }}>Your progress will appear here</Text>
          <Text style={{ fontSize: 13, color: t.sub, textAlign: "center", maxWidth: 260, lineHeight: 18 }}>
            Log meals on the Today tab and your weekly trends, macro adherence, and charts will populate.
          </Text>
        </View>
      ) : (
        <>
          {/* Weekly Recap Card (Batch 4.11; Ship M1 usual-meal line;
              post-ship #4 deep-link to SaveMealSheet pre-seeded). */}
          {recapVisible ? (
            <WeeklyRecapCard
              recap={recap}
              onDismiss={dismissRecap}
              usualMealInsight={usualMealInsight}
              maintenance={recapMaintenance}
              // Post-ship #4 (2026-04-18) — deep-link the prompt CTA to
              // the Today `SaveMealSheet` pre-seeded with the user's
              // most-frequent items. `byDay` enables the card to run
              // `selectMostFrequentSlotSeed`; `onOpenSaveCombo` stashes
              // the payload in AsyncStorage and navigates to Today. The
              // Today tab hydrates on focus and opens the sheet. When
              // the helper returns null, `onStartUsualMealSave` falls
              // back to the legacy route-to-Today behaviour.
              byDay={byDay}
              onOpenSaveCombo={(slot, items) => {
                const serialized = serializePendingUsualMealSave(slot, items);
                if (serialized) {
                  // Fire-and-forget — a set that races with the navigate
                  // still lands before focus effects fire on Today.
                  AsyncStorage.setItem(PENDING_USUAL_MEAL_SAVE_KEY, serialized).catch(
                    () => {
                      /* ignore storage failures */
                    },
                  );
                }
                router.navigate({ pathname: "/(tabs)" as any });
              }}
              onStartUsualMealSave={() => {
                // Fallback — helper returned null or props missing.
                router.navigate({ pathname: "/(tabs)" as any });
              }}
            />
          ) : null}

          {/* 2x2 Stat Grid
              Action 5 Item 3 (2026-04-19) — partial-week label uses
              `formatAvgCaloriesLabel(daysWithFood)` so the headline
              number isn't misread as "average per day this week".
              Shared helper keeps web + mobile copy identical. */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {([
              [
                formatAvgCaloriesLabel(weekStats.daysWithFood),
                String(weekStats.avgCalories.toLocaleString()),
                `vs ${targets.calories.toLocaleString()} target`,
                weekStats.avgCalories > targets.calories ? t.amber : t.green,
                "flame-outline",
              ],
              [
                "Protein Hit",
                `${weekStats.proteinOnTarget}/${weekStats.daysWithFood || 0}`,
                `day${weekStats.daysWithFood !== 1 ? "s" : ""} on target`,
                weekStats.daysWithFood > 0 && weekStats.proteinOnTarget >= weekStats.daysWithFood * 0.7 ? t.green : t.amber,
                "checkmark-circle-outline",
              ],
              [
                "Streak",
                `${streakDays} day${streakDays !== 1 ? "s" : ""}`,
                freezesAvailable > 0
                  ? `logging streak · ${freezesAvailable} freeze${freezesAvailable === 1 ? "" : "s"}`
                  : "logging streak",
                streakDays >= 3 ? t.green : t.accent,
                "trophy-outline",
              ],
              [
                "Trend",
                // Action 13 Item #6 (2026-04-19) — render the delta in
                // the user's preferred unit. Was hard-coded to "kg"
                // suffix even for imperial users, who saw "lb" on every
                // other weight surface — pure unit drift. The signed
                // formatter handles "+" / "−" so we don't repeat the
                // sign logic at the call site.
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
                weightTrend?.direction === "down" ? "trending-down-outline" : weightTrend?.direction === "up" ? "trending-up-outline" : "analytics-outline",
              ],
            ] as const).map(([title, val, sub, color, iconName], i) => {
              const tileBody = (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <IconBox color={color as string} size={24}>
                      <Ionicons name={iconName as any} size={12} color={color as string} />
                    </IconBox>
                    <Text style={{ fontSize: 11, color: t.dim, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</Text>
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: "700", color: color as string, fontVariant: ["tabular-nums"] }}>{val}</Text>
                  <Text style={{ fontSize: 12, color: t.sub, marginTop: 2 }}>{sub}</Text>
                </>
              );
              const shellStyle = {
                width: "47%" as const,
                padding: 14,
                borderRadius: Radius.lg,
                backgroundColor: t.elevated,
                borderWidth: 1,
                borderColor: t.border,
              };
              // Action 5 Item 3 — the "Avg Calories" tile title now varies
              // ("Avg Calories" full week, "Avg on logged days (X/7)"
               // partial). Match by prefix so the routing + a11y branches
              // still resolve cleanly without hard-coding both shapes.
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
              const footerLabel = title === "Trend" ? "Chart & breakdown" : "Tap for breakdown";
              return (
                <Pressable
                  key={i}
                  onPress={openTile}
                  accessibilityRole="button"
                  accessibilityLabel={a11yLabel}
                  accessibilityHint="Opens detailed breakdown"
                  style={({ pressed }) => [shellStyle, pressed && { opacity: 0.92 }]}
                >
                  {tileBody}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: t.accent }}>{footerLabel}</Text>
                    <Ionicons name="chevron-forward" size={12} color={t.accent} />
                  </View>
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
              <ActivityIndicator size="small" color={t.accent} />
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
                  <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.border }}>
                    <View
                      testID={`macro-adherence-bar-${name.toLowerCase()}`}
                      style={{ width: `${bar.barFillPct}%`, height: "100%", borderRadius: 3, backgroundColor: color }}
                    />
                  </View>
                  <Text
                    testID={`macro-adherence-label-${name.toLowerCase()}`}
                    style={{ fontSize: 12, fontWeight: "600", color, minWidth: 80, textAlign: "right", fontVariant: ["tabular-nums"] }}
                  >
                    {bar.label}
                  </Text>
                </View>
              );
            })}
          </View>

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
                    <Ionicons name="flash-outline" size={14} color={t.accent} />
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
                      <Ionicons
                        name={maintenanceExplainerOpen ? "chevron-up" : "chevron-down"}
                        size={14}
                        color={t.accent}
                      />
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
                <Ionicons name="footsteps-outline" size={14} color={t.green} />
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
                  accessibilityLabel="Retry Apple Health sync"
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

          {/* Weight Card */}
          {(latestWeightKg != null || Object.keys(weightKgByDay).length > 0) && (
            <Pressable
              onPress={() => router.push("/weight-tracker" as const)}
              accessibilityRole="button"
              accessibilityLabel="Weight details"
              accessibilityHint="Opens weight graph and history"
              style={({ pressed }) => ({
                backgroundColor: t.elevated,
                borderRadius: Radius.lg,
                borderWidth: 1,
                borderColor: t.border,
                padding: 16,
                marginBottom: 14,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <IconBox color={t.accent} size={28}>
                    <Ionicons name="scale-outline" size={14} color={t.accent} />
                  </IconBox>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: t.text }}>Weight</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={t.dim} />
              </View>
              {/* Action 13 Item #7 (2026-04-19) — weight readouts go
                  through the shared `formatWeightForUnit` helper so
                  imperial users see "lb" and the start/current/change
                  numbers on this card all use the same unit. The
                  goal-suffix used to be a separate template literal
                  with " kg" hard-coded — same drift class. */}
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                <Text style={{ fontSize: 28, fontWeight: "700", color: t.text, fontVariant: ["tabular-nums"] }}>
                  {latestWeightKg != null
                    ? formatWeightForUnit({ kg: latestWeightKg, system: measurementSystem })
                    : "—"}
                </Text>
                <Text style={{ fontSize: 13, color: t.sub }}>
                  {goalWeightKg
                    ? ` → ${formatWeightForUnit({ kg: goalWeightKg, system: measurementSystem })} goal`
                    : ""}
                </Text>
              </View>
              {weightTrend && (
                <Text style={{ fontSize: 12, color: weightTrend.direction === "down" ? t.green : t.amber, marginTop: 4 }}>
                  {formatWeightForUnit({ kg: weightTrend.diff, system: measurementSystem, signed: true })} overall trend
                </Text>
              )}
              <Text style={{ fontSize: 12, fontWeight: "600", color: t.accent, marginTop: 10 }}>Tap for graph & log weight</Text>
            </Pressable>
          )}

          {/* Weight Projection / Journey Card */}
          {latestWeightKg != null &&
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
              const dailyProjection =
                projectionEligible && avgCals > 0 && latestWeightKg != null
                  ? projectWeight({
                      currentWeightKg: latestWeightKg,
                      todayCalories: avgCals,
                      targetCalories: targets.calories,
                      maintenanceTdeeKcal,
                      goal: userGoal,
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
                        <Ionicons name="flag-outline" size={14} color={t.green} />
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
                      <Ionicons name="chevron-forward" size={18} color={t.dim} />
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
                    <Ionicons name="chevron-forward" size={12} color={t.accent} />
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
    </ScrollView>
  );
}
