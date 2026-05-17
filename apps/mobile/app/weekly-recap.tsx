/**
 * Weekly recap screen — the destination for the StreakPip tap.
 *
 * Authority: 2026-04-30 audit verdict ("cut OR finish") — the pip was
 * decorative dead UI. We finished it: the pip is now a tappable entry
 * point to a focused weekly surface that holds the calm-streak
 * posture (D-2026-04-27-07).
 *
 * 2026-04-30 (Weekly Check-in / MacroFactor parity):
 *   The screen now also hosts the Weekly Check-in section — TDEE
 *   delta + plain-English why-line + a goal-pace re-tune CTA. See
 *   `src/lib/nutrition/weeklyCheckin.ts` for the cascade and
 *   `src/lib/nutrition/goalPaceRetune.ts` for the math. The pip
 *   route + the existing recap cards are unchanged; the check-in
 *   sits above the streak/days/macros rollups so the user lands on
 *   the most actionable signal first.
 *
 * Posture rules pinned by `selectClosestToTargetDay` and the existing
 * Digest primitive:
 *   - Observational copy. "You logged 5 of 7 days." Never "You missed
 *     2 days" or "You're crushing it!".
 *   - No flame, no confetti, no "🔥" or other gamification glyphs in
 *     copy. The lucide `Flame` glyph already lives inside the
 *     `<StreakPip>`; we never add another beside it.
 *   - Streak freeze ledger is surfaced as a calm "freezes available"
 *     line, not a currency. Zero earned freezes → suppress the line.
 *   - Empty / first-week / zero-day-streak state lands here with a
 *     calm explainer instead of a broken card.
 *
 * Data shape:
 *   - Reads `nutrition_entries` for the last 90 days so the current
 *     week is always in scope. Mirrors the Progress tab's window so
 *     a user landing here sees exactly the same numbers.
 *   - Reads `profiles.streak_freezes_*` for the freeze ledger.
 *   - Reads `profiles.adaptive_tdee*` + body stats for the Check-in
 *     section's TDEE rendering.
 *   - Reads the previous-week TDEE snapshot from AsyncStorage (no
 *     schema change). On exit we capture the current TDEE under the
 *     *current* week's key so next week's visit has a baseline.
 *   - Builds the *current* week (not the previous week the Digest
 *     covers) — the user just tapped their live pip and expects to
 *     see "where I'm at this week".
 *
 * Web parity: intentionally partial. The check-in subsection is
 * mirrored on web inside the <Digest/> card (see
 * `src/app/components/suppr/digest.tsx`); the goal-pace re-tune on
 * web routes to Settings → Targets (already shipped). Mobile gets
 * the dedicated route + sheet because the entry point (StreakPip)
 * and the modal-sheet pattern are mobile-native idioms.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { formatMacro } from "@suppr/shared/nutrition/formatMacro";
import { supabase } from "@/lib/supabase";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import {
  dateKeyFromDate,
  type ByDay,
  type JournalMeal,
} from "@/lib/nutritionJournal";
import { buildWeekStats } from "@/lib/progressWeekReport";
import { getDailyTargets, type DailyTarget } from "@suppr/shared/nutrition/dailyTargetRead";
import {
  selectClosestToTargetDay,
  formatWeekLabel,
  weekKeyFor,
} from "@/lib/weeklyRecap";
import {
  availableFreezes,
  computeProtectedStreak,
  readFreezeLedger,
  type FreezeLedger,
} from "@/lib/streakFreeze";
import { StreakPip } from "@/components/today/StreakPip";
import {
  buildWeeklyCheckin,
  type WeeklyCheckin,
} from "@/lib/weeklyCheckin";
import {
  readTdeeSnapshot,
  writeTdeeSnapshot,
} from "@/lib/lastWeekTdee";
import { calculateTDEE } from "@/lib/calcTargets";
import { GoalPaceRetuneSheet } from "@/components/recap/GoalPaceRetuneSheet";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import type { Sex, NutritionStrategy } from "@suppr/shared/nutrition/tdee";

type LoadState = "loading" | "ready" | "empty" | "error";

const DEFAULT_TARGETS = {
  calories: NUTRITION_DEFAULTS.calories,
  protein: NUTRITION_DEFAULTS.protein,
  carbs: NUTRITION_DEFAULTS.carbs,
  fat: NUTRITION_DEFAULTS.fat,
};

export default function WeeklyRecapScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [state, setState] = useState<LoadState>("loading");
  const [byDay, setByDay] = useState<ByDay>({});
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [weekStartDay, setWeekStartDay] = useState<"monday" | "sunday">("monday");
  const [freezeLedger, setFreezeLedger] = useState<FreezeLedger>({
    earnedAt: [],
    usedHistory: [],
  });
  const [freezeBudgetMax, setFreezeBudgetMax] = useState<number>(3);
  // ── Weekly Check-in state (MacroFactor parity, 2026-04-30) ──
  // We hold the full body-stats slice so the goal-pace re-tune sheet
  // has everything it needs without a second profile fetch.
  const [bodyStats, setBodyStats] = useState<{
    weight_kg: number | null;
    height_cm: number | null;
    sex: Sex | null;
    age: number | null;
    activity_level: string | null;
    goal: "cut" | "maintain" | "bulk" | null;
    plan_pace: string | null;
    nutrition_strategy: NutritionStrategy | null;
    adaptive_tdee: number | null;
    adaptive_tdee_confidence: string | null;
    adaptive_tdee_updated_at: string | null;
    weight_kg_by_day: Record<string, number>;
  } | null>(null);
  const [previousTdeeKcal, setPreviousTdeeKcal] = useState<number | null>(null);
  const [retuneSheetVisible, setRetuneSheetVisible] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId) {
      setState("empty");
      return;
    }
    setState("loading");

    // 90-day window matches the Progress tab so the numbers can never
    // disagree by source. Anything older isn't displayed on this
    // screen so there's no point pulling it.
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);

    try {
      const [{ data: rows, error: rowsErr }, { data: profile, error: profErr }] =
        await Promise.all([
          supabase
            .from("nutrition_entries")
            .select("date_key, calories, protein, carbs, fat")
            .eq("user_id", userId)
            .gte("date_key", ninetyDaysAgo)
            .order("created_at", { ascending: true }),
          supabase
            .from("profiles")
            .select(
              "target_calories, target_protein, target_carbs, target_fat, week_start_day, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history, weight_kg, height_cm, sex, age, dob, activity_level, goal, plan_pace, nutrition_strategy, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, weight_kg_by_day",
            )
            .eq("id", userId)
            .maybeSingle(),
        ]);

      if (rowsErr || profErr) {
        setState("error");
        return;
      }

      if (profile) {
        const p = profile as Record<string, unknown>;
        setTargets({
          calories: (p.target_calories as number) ?? DEFAULT_TARGETS.calories,
          protein: (p.target_protein as number) ?? DEFAULT_TARGETS.protein,
          carbs: (p.target_carbs as number) ?? DEFAULT_TARGETS.carbs,
          fat: (p.target_fat as number) ?? DEFAULT_TARGETS.fat,
        });
        if (p.week_start_day === "sunday" || p.week_start_day === "monday") {
          setWeekStartDay(p.week_start_day);
        }
        const rawBudget = Number(p.streak_freeze_budget_max);
        setFreezeBudgetMax(Number.isFinite(rawBudget) ? Math.max(0, Math.min(10, rawBudget)) : 3);
        setFreezeLedger(
          readFreezeLedger({
            earnedAt: p.streak_freezes_earned_at,
            usedHistory: p.streak_freezes_used_history,
          }),
        );

        // Body stats slice for the Check-in section + re-tune sheet.
        // `age` falls back to dob when present (mirrors calcTargets).
        let age: number | null = null;
        if (typeof p.age === "number" && Number.isFinite(p.age)) {
          age = p.age;
        } else if (typeof p.dob === "string") {
          const dobMs = new Date(p.dob).getTime();
          if (Number.isFinite(dobMs)) {
            age = Math.floor((Date.now() - dobMs) / 31_557_600_000);
          }
        }
        const sex = (typeof p.sex === "string" ? p.sex : null) as Sex | null;
        const weightByDay: Record<string, number> = {};
        if (
          p.weight_kg_by_day &&
          typeof p.weight_kg_by_day === "object" &&
          !Array.isArray(p.weight_kg_by_day)
        ) {
          for (const [k, v] of Object.entries(
            p.weight_kg_by_day as Record<string, unknown>,
          )) {
            const n = typeof v === "number" ? v : Number(v);
            if (Number.isFinite(n) && n > 0) weightByDay[k] = n;
          }
        }
        const dbGoal = ((): "cut" | "maintain" | "bulk" | null => {
          const g = typeof p.goal === "string" ? p.goal.toLowerCase() : "";
          if (g === "cut" || g === "lose") return "cut";
          if (g === "maintain" || g === "health") return "maintain";
          if (g === "bulk" || g === "gain" || g === "strength") return "bulk";
          return null;
        })();
        const strategy = ((): NutritionStrategy | null => {
          const s = typeof p.nutrition_strategy === "string" ? p.nutrition_strategy : null;
          if (
            s === "balanced" ||
            s === "high_protein" ||
            s === "high_satisfaction" ||
            s === "low_carb"
          ) {
            return s;
          }
          return null;
        })();
        setBodyStats({
          weight_kg: typeof p.weight_kg === "number" ? p.weight_kg : null,
          height_cm: typeof p.height_cm === "number" ? p.height_cm : null,
          sex,
          age,
          activity_level: typeof p.activity_level === "string" ? p.activity_level : null,
          goal: dbGoal,
          plan_pace: typeof p.plan_pace === "string" ? p.plan_pace : null,
          nutrition_strategy: strategy,
          adaptive_tdee:
            typeof p.adaptive_tdee === "number" ? p.adaptive_tdee : null,
          adaptive_tdee_confidence:
            typeof p.adaptive_tdee_confidence === "string"
              ? p.adaptive_tdee_confidence
              : null,
          adaptive_tdee_updated_at:
            typeof p.adaptive_tdee_updated_at === "string"
              ? p.adaptive_tdee_updated_at
              : null,
          weight_kg_by_day: weightByDay,
        });
      }

      const loaded: ByDay = {};
      if (rows) {
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
          } as JournalMeal);
        }
      }
      setByDay(loaded);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Previous-week TDEE snapshot lookup (Weekly Check-in) ──
  // We store one entry per (user, weekKey) in AsyncStorage. The
  // "previous" week's value is what we want to compare today's
  // adaptive TDEE against. We read after the profile has loaded so
  // we know `weekStartDay`.
  useEffect(() => {
    if (state !== "ready" || !userId) return;
    const previousWeekAnchor = new Date();
    previousWeekAnchor.setDate(previousWeekAnchor.getDate() - 7);
    const prevWeekKey = weekKeyFor(previousWeekAnchor, weekStartDay);
    let cancelled = false;
    void readTdeeSnapshot(userId, prevWeekKey).then((snap) => {
      if (cancelled) return;
      setPreviousTdeeKcal(
        snap && Number.isFinite(snap.tdee) && snap.tdee > 0 ? snap.tdee : null,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [state, userId, weekStartDay]);

  // Numbers audit 2026-05-04 #9 — per-day target snapshots so a
  // mid-week target edit doesn't retroactively re-judge past days.
  // Mirrors the same path Progress + ProgressMetricDetail already use.
  const [dailyTargetsByDay, setDailyTargetsByDay] = useState<Record<string, DailyTarget | null>>({});
  useEffect(() => {
    if (!userId) {
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
    void getDailyTargets(supabase, userId, weekKeys).then((snapshots) => {
      if (!cancelled) setDailyTargetsByDay(snapshots);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, weekStartDay]);

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

  // Current-week stats. `buildWeekStats` defaults to "now" so we get
  // Mon–Sun (or Sun–Sat) of the active week — exactly what the user
  // expects when they tap a live pip.
  const weekStats = useMemo(
    () => buildWeekStats(byDay, targets, weekStartDay, new Date(), weekTargetsByDay),
    [byDay, targets, weekStartDay, weekTargetsByDay],
  );

  const protectedStreak = useMemo(
    () => computeProtectedStreak(byDay as never, freezeLedger, freezeBudgetMax, new Date()),
    [byDay, freezeLedger, freezeBudgetMax],
  );
  const streakDays = protectedStreak.streakLength;
  const freezesAvailableNow = useMemo(
    () => availableFreezes(freezeLedger, freezeBudgetMax),
    [freezeLedger, freezeBudgetMax],
  );

  const closestToTarget = useMemo(
    () => selectClosestToTargetDay(weekStats.days),
    [weekStats.days],
  );

  // Days logged in the current 7-day window. Mirrors the Digest's
  // `daysLogged` definition so the two surfaces never disagree.
  const daysLogged = useMemo(
    () => weekStats.days.filter((d) => d.calories > 0).length,
    [weekStats.days],
  );

  const weekLabel = useMemo(() => {
    if (weekStats.days.length === 0) return "";
    return formatWeekLabel(weekStats.days[0].key, weekStats.days[weekStats.days.length - 1].key);
  }, [weekStats.days]);

  // Protein hit threshold matches the existing convention used on
  // `progress-metric.tsx` (≥90% of target counts as "hit"). Kept inline
  // so we don't introduce a new shared helper for a single readout.
  const proteinHitDays = useMemo(() => {
    if (targets.protein <= 0) return 0;
    const threshold = targets.protein * 0.9;
    return weekStats.days.filter((d) => d.protein >= threshold).length;
  }, [weekStats.days, targets.protein]);

  const avgProteinHitDays = useMemo(() => {
    if (daysLogged === 0) return 0;
    return Math.round(weekStats.avgProtein);
  }, [weekStats.avgProtein, daysLogged]);

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  // ── Weekly Check-in payload (MacroFactor parity, 2026-04-30) ──
  const currentTdeeKcal = useMemo<number | null>(() => {
    if (!bodyStats) return null;
    // Prefer adaptive when present and confident; fallback to formula.
    if (
      bodyStats.adaptive_tdee != null &&
      bodyStats.adaptive_tdee > 0 &&
      (bodyStats.adaptive_tdee_confidence === "medium" ||
        bodyStats.adaptive_tdee_confidence === "high")
    ) {
      return Math.round(bodyStats.adaptive_tdee);
    }
    // Formula fallback — only when all inputs are present.
    if (
      bodyStats.sex &&
      bodyStats.weight_kg != null &&
      bodyStats.height_cm != null &&
      bodyStats.age != null &&
      bodyStats.activity_level
    ) {
      return calculateTDEE(
        bodyStats.sex,
        bodyStats.weight_kg,
        bodyStats.height_cm,
        bodyStats.age,
        bodyStats.activity_level,
      );
    }
    return null;
  }, [bodyStats]);

  // Weight first/last in the recap window — same logic as
  // `buildWeeklyRecap` (≥2 entries required), but we look at the
  // *current* week the user is on, not the previous one.
  const weeklyWeightStats = useMemo(() => {
    if (!bodyStats || weekStats.days.length === 0) {
      return {
        startKg: null as number | null,
        endKg: null as number | null,
        weighIns: 0,
      };
    }
    const firstKey = weekStats.days[0].key;
    const lastKey = weekStats.days[weekStats.days.length - 1].key;
    const within = Object.entries(bodyStats.weight_kg_by_day)
      .filter(([k]) => k >= firstKey && k <= lastKey)
      .sort(([a], [b]) => a.localeCompare(b));
    if (within.length === 0) {
      return { startKg: null, endKg: null, weighIns: 0 };
    }
    const startKg = within[0][1];
    const endKg = within[within.length - 1][1];
    return {
      startKg: Number.isFinite(startKg) ? startKg : null,
      endKg: Number.isFinite(endKg) ? endKg : null,
      weighIns: within.length,
    };
  }, [bodyStats, weekStats.days]);

  const weeklyIntakeKcal = useMemo(
    () => weekStats.days.reduce((s, d) => s + (d.calories ?? 0), 0),
    [weekStats.days],
  );

  const checkin = useMemo<WeeklyCheckin | null>(() => {
    // Requires the body-stats slice to be present at all.
    if (!bodyStats || currentTdeeKcal == null) return null;
    // F-129 (Grace, 2026-05-07): pass the engine confidence so the
    // weeklyCheckin gate can skip the weighInsThisWeek floor when the
    // engine already trusts the long-term TDEE — mirrors F-124 on the
    // Progress tab.
    const engineConfidence: "low" | "medium" | "high" | null =
      bodyStats.adaptive_tdee_confidence === "low" ||
      bodyStats.adaptive_tdee_confidence === "medium" ||
      bodyStats.adaptive_tdee_confidence === "high"
        ? bodyStats.adaptive_tdee_confidence
        : null;
    return buildWeeklyCheckin({
      previousTdeeKcal,
      currentTdeeKcal,
      weeklyIntakeKcal,
      dailyTargetKcal: targets.calories,
      weightStartKg: weeklyWeightStats.startKg,
      weightEndKg: weeklyWeightStats.endKg,
      weighInsThisWeek: weeklyWeightStats.weighIns,
      daysLogged,
      adaptiveTdeeConfidence: engineConfidence,
    });
  }, [
    bodyStats,
    currentTdeeKcal,
    previousTdeeKcal,
    weeklyIntakeKcal,
    targets.calories,
    weeklyWeightStats,
    daysLogged,
  ]);

  // Fire `weekly_checkin_viewed` once per visible weekKey. Mirrors the
  // legacy `weekly_recap_shown` gate on the Digest.
  const weekKeyForView = useMemo(
    () => weekKeyFor(new Date(), weekStartDay),
    [weekStartDay],
  );
  const checkinViewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (state !== "ready" || !checkin) return;
    if (checkinViewedRef.current === weekKeyForView) return;
    checkinViewedRef.current = weekKeyForView;
    try {
      track(AnalyticsEvents.weekly_checkin_viewed, {
        weekKey: weekKeyForView,
        kind: checkin.kind,
        direction: checkin.direction,
        tdeeDeltaKcal: checkin.tdeeDeltaKcal,
      });
    } catch {
      /* fire-and-forget */
    }
  }, [state, checkin, weekKeyForView]);

  // Capture the current TDEE under the *current* week's key when the
  // screen unmounts (or the user changes weekStartDay). Next week,
  // when the user lands here again, this value is the "previous"
  // baseline. Idempotent and self-pruning (the read path only ever
  // looks at the previous week's key).
  useEffect(() => {
    return () => {
      if (!userId || currentTdeeKcal == null) return;
      void writeTdeeSnapshot(userId, weekKeyForView, currentTdeeKcal);
    };
  }, [userId, currentTdeeKcal, weekKeyForView]);

  // ── Render ──

  if (state === "loading") {
    return (
      <View
        testID="weekly-recap-loading"
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: insets.top,
        }}
      >
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }

  if (state === "error") {
    return (
      <View
        testID="weekly-recap-error"
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          padding: Spacing.xl,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 15, textAlign: "center", marginBottom: Spacing.sm }}>
          Couldn&rsquo;t load your week.
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center" }}>
          Pull down or tap back to try again.
        </Text>
      </View>
    );
  }

  // ── Empty / zero-streak explainer ──
  // Pip days === 0 lands here with a calm, observational explainer per
  // the audit spec Step 1: "press should still work but route to a
  // 'your streak starts when you log on 2 different days this week'
  // explainer". We show this when the user has no logged days this
  // week AT ALL — including for streak === 1 if it's just today, the
  // explainer is still right (their streak starts when they keep
  // going). The threshold is "no logged days this week" because
  // that's the most conservative empty signal.
  const isEmpty = state === "empty" || daysLogged === 0;

  const sectionLabel = (txt: string) => (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        color: colors.textTertiary,
        letterSpacing: 0.88,
        textTransform: "uppercase",
        marginBottom: Spacing.sm,
      }}
    >
      {txt}
    </Text>
  );

  const card = (children: React.ReactNode, testID?: string) => (
    <View
      testID={testID}
      style={{
        backgroundColor: colors.card,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
      }}
    >
      {children}
    </View>
  );

  return (
    <>
    <ScrollView
      testID="weekly-recap-screen"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xxxl,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header — calm, observational. */}
      <View style={{ marginBottom: Spacing.xl }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: colors.textTertiary,
            letterSpacing: 0.88,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          This week
        </Text>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: colors.text,
            letterSpacing: -0.5,
          }}
        >
          {weekLabel}
        </Text>
        {/* Pip headline — same component, larger, non-tappable here
            (we're already on the destination). Sits inline with the
            range so the user sees the streak as part of the frame. */}
        <View style={{ marginTop: Spacing.md, alignSelf: "flex-start" }}>
          <StreakPip days={streakDays} size="lg" />
        </View>
      </View>

      {/* Weekly Check-in — TDEE delta + goal-pace re-tune (MacroFactor
          parity, 2026-04-30). Shown above the existing recap rollups
          so the user lands on the most actionable signal first. */}
      {checkin
        ? card(
            <View testID="weekly-checkin-card">
              {sectionLabel("Your TDEE this week")}
              <Text
                testID="weekly-checkin-headline"
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 4,
                  letterSpacing: -0.2,
                }}
              >
                {checkin.headline}
              </Text>
              {checkin.deltaLine ? (
                <Text
                  testID="weekly-checkin-delta"
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginBottom: Spacing.sm,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {checkin.deltaLine}
                </Text>
              ) : null}
              {checkin.whyLine ? (
                <Text
                  testID="weekly-checkin-why"
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    lineHeight: 19,
                    marginBottom: Spacing.sm,
                  }}
                >
                  {checkin.whyLine}
                </Text>
              ) : null}
              {checkin.intakeLine ? (
                <Text
                  testID="weekly-checkin-intake"
                  style={{
                    fontSize: 13,
                    color: colors.textTertiary,
                    lineHeight: 19,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {checkin.intakeLine}
                </Text>
              ) : null}
              {checkin.weightLine ? (
                <Text
                  testID="weekly-checkin-weight"
                  style={{
                    fontSize: 13,
                    color: colors.textTertiary,
                    lineHeight: 19,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {checkin.weightLine}
                </Text>
              ) : null}
              {/* Adjust goal pace — only when the body-stats slice
                  has enough data to make the re-tune sheet honest. We
                  hide the CTA on first_week (no signal) but keep it
                  available on low_confidence (the math still works,
                  the user can still pick a new pace). */}
              {checkin.kind !== "first_week" &&
              bodyStats?.weight_kg != null &&
              bodyStats?.sex &&
              currentTdeeKcal != null &&
              bodyStats.goal != null ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Adjust goal pace"
                  onPress={() => setRetuneSheetVisible(true)}
                  testID="weekly-checkin-retune-cta"
                  style={{
                    marginTop: Spacing.md,
                    paddingVertical: Spacing.sm,
                    paddingHorizontal: Spacing.md,
                    borderRadius: Radius.md,
                    borderWidth: 1.5,
                    borderColor: Accent.primary,
                    alignSelf: "flex-start",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: Accent.primary,
                      letterSpacing: 0.2,
                    }}
                  >
                    Adjust goal pace
                  </Text>
                </Pressable>
              ) : null}
            </View>,
            "weekly-checkin-section",
          )
        : null}

      {isEmpty ? (
        // Empty state — explainer per audit Step 1. Calm copy, no
        // pressure language. Pinned by test
        // "weekly-recap empty state explains how the streak starts".
        card(
          <>
            <Text
              testID="weekly-recap-empty-headline"
              style={{
                fontSize: 17,
                fontWeight: "700",
                color: colors.text,
                marginBottom: Spacing.sm,
              }}
            >
              Your streak starts here.
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                lineHeight: 20,
              }}
            >
              A streak begins when you log on two different days in the same
              week. There&rsquo;s nothing to recap yet — log a meal today and
              come back to see it grow.
            </Text>
          </>,
          "weekly-recap-empty-card",
        )
      ) : (
        <>
          {/* DAYS LOGGED — small dot grid + plain summary. */}
          {card(
            <>
              {sectionLabel("Days logged")}
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: Spacing.sm,
                }}
              >
                {daysLogged} of 7 days
              </Text>
              <View
                testID="weekly-recap-day-grid"
                style={{
                  flexDirection: "row",
                  gap: 8,
                  marginTop: Spacing.xs,
                }}
              >
                {weekStats.days.map((d) => {
                  const filled = d.calories > 0;
                  const isToday = d.key === todayKey;
                  return (
                    <View
                      key={d.key}
                      testID={`weekly-recap-day-dot-${d.key}`}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <View
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          backgroundColor: filled
                            ? Accent.primary
                            : "transparent",
                          borderWidth: 1.5,
                          borderColor: filled ? Accent.primary : colors.cardBorder,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: isToday ? "700" : "500",
                          color: isToday ? colors.text : colors.textTertiary,
                          letterSpacing: 0.2,
                        }}
                      >
                        {d.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>,
            "weekly-recap-days-card",
          )}

          {/* CALORIES — average vs target, observational copy. */}
          {card(
            <>
              {sectionLabel("Average daily calories")}
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 4,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {weekStats.avgCalories.toLocaleString()} kcal
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  lineHeight: 18,
                }}
              >
                {(() => {
                  const diff = weekStats.avgCalories - targets.calories;
                  const abs = Math.abs(Math.round(diff));
                  if (targets.calories <= 0 || daysLogged === 0) {
                    return `Across ${daysLogged} day${daysLogged === 1 ? "" : "s"} you logged.`;
                  }
                  if (abs <= 50) {
                    return `On target (${targets.calories.toLocaleString()} kcal).`;
                  }
                  if (diff < 0) {
                    return `${abs.toLocaleString()} under your ${targets.calories.toLocaleString()} kcal target.`;
                  }
                  return `${abs.toLocaleString()} over your ${targets.calories.toLocaleString()} kcal target.`;
                })()}
              </Text>
            </>,
            "weekly-recap-calories-card",
          )}

          {/* PROTEIN — average + days hit. */}
          {card(
            <>
              {sectionLabel("Protein")}
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 4,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {avgProteinHitDays}g average
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  lineHeight: 18,
                }}
              >
                {targets.protein > 0
                  ? `Hit your ${formatMacro(targets.protein, "protein", "g")} goal on ${proteinHitDays} of 7 days.`
                  : "No protein target set."}
              </Text>
            </>,
            "weekly-recap-protein-card",
          )}

          {/* CLOSEST TO TARGET — per memory, "Best Day → Closest to target". */}
          {closestToTarget
            ? card(
                <>
                  {sectionLabel("Closest to target")}
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: "700",
                      color: colors.text,
                      marginBottom: 4,
                    }}
                  >
                    {closestToTarget.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.textSecondary,
                      lineHeight: 18,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {closestToTarget.calories.toLocaleString()} kcal
                    {targets.calories > 0
                      ? ` vs ${targets.calories.toLocaleString()} target`
                      : ""}
                    {" · "}
                    {closestToTarget.protein}g protein
                  </Text>
                </>,
                "weekly-recap-closest-card",
              )
            : null}

          {/* STREAK + FREEZES — calm ledger. Suppress the freeze line
              entirely when the user has earned 0; gamifying it would
              break the calm-streak posture. */}
          {card(
            <>
              {sectionLabel("Streak")}
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 4,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {streakDays} day{streakDays === 1 ? "" : "s"} in a row
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  lineHeight: 18,
                }}
              >
                {streakDays === 0
                  ? "Log on two different days this week to start it."
                  : streakDays === 1
                    ? "Log again tomorrow to keep it going."
                    : "Counts every day with at least one meal logged."}
              </Text>
              {freezesAvailableNow > 0 ? (
                <Text
                  testID="weekly-recap-freezes-line"
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    lineHeight: 18,
                    marginTop: Spacing.sm,
                  }}
                >
                  {freezesAvailableNow} freeze{freezesAvailableNow === 1 ? "" : "s"} available
                  {protectedStreak.freezesConsumed > 0
                    ? ` (${protectedStreak.freezesConsumed} used to protect this streak).`
                    : "."}
                </Text>
              ) : null}
            </>,
            "weekly-recap-streak-card",
          )}
        </>
      )}
    </ScrollView>

    {/* Goal-pace re-tune sheet — opened by the "Adjust goal pace"
        CTA inside the Check-in card. Mounted at the screen root so
        the modal overlay can size itself against the full window
        rather than the ScrollView's content height. */}
    {bodyStats &&
    userId &&
    bodyStats.weight_kg != null &&
    bodyStats.sex &&
    bodyStats.goal != null &&
    currentTdeeKcal != null ? (
      <GoalPaceRetuneSheet
        visible={retuneSheetVisible}
        onClose={() => setRetuneSheetVisible(false)}
        tdeeKcal={currentTdeeKcal}
        dbGoal={bodyStats.goal}
        strategy={bodyStats.nutrition_strategy}
        weightKg={bodyStats.weight_kg}
        sex={bodyStats.sex}
        currentTargetKcal={targets.calories}
        userId={userId}
        onSaved={() => {
          // Refetch so the screen reflects the new target
          // immediately. The data load is cheap (a single profile
          // row + the 90-day entries window the user just saw).
          void loadData();
        }}
      />
    ) : null}
    </>
  );
}
