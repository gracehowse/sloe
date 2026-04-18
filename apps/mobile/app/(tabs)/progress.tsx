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
  projectWeight,
  resolveLatestWeightKg,
  weightJourneyProgress,
} from "@/lib/weightProjection";
import { calculateTDEE, getEffectiveTDEE } from "@/lib/calcTargets";
import { syncHealthDataThrottled, isHealthSyncAvailable } from "@/lib/healthSync";
import { buildWeekStats } from "@/lib/progressWeekReport";
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
import { listSavedMeals, type SavedMeal } from "../../../../src/lib/nutrition/savedMeals";
import { normaliseRecipeTitle } from "../../../../src/lib/nutrition/usualMealHint";
import { scheduleWeeklyRecapPush } from "@/lib/weeklyRecapPush";
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
  const [isAdaptiveTdee, setIsAdaptiveTdee] = useState(false);

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  const latestWeightKg = useMemo(
    () => resolveLatestWeightKg(weightKgByDay, weightKg),
    [weightKgByDay, weightKg],
  );

  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);

    // Run Health sync and DB queries in parallel for faster loading
    const [, { data: profile }, { data: rows }] = await Promise.all([
      isHealthSyncAvailable() ? syncHealthDataThrottled(userId).catch(() => {}) : Promise.resolve(),
      supabase
        .from("profiles")
        .select("target_calories, target_protein, target_carbs, target_fat, weight_kg, goal_weight_kg, weight_kg_by_day, steps_by_day, daily_steps_goal, week_start_day, goal, sex, height_cm, age, activity_level, adaptive_tdee, adaptive_tdee_confidence, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history, weekly_recap_last_seen_week_key, weekly_recap_push_enabled")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("nutrition_entries")
        .select("date_key, calories, protein, carbs, fat")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);

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
      const actLevel = ((profile as any).activity_level as string) ?? "moderate";
      const wForTdee = Number.isFinite(w) ? w! : 70;
      const sTdee = calculateTDEE(sex, wForTdee, heightCm, ageVal, actLevel);
      setStaticTdee(sTdee);
      const aTdee = (profile as any).adaptive_tdee != null ? Number((profile as any).adaptive_tdee) : null;
      setAdaptiveTdee(Number.isFinite(aTdee) ? aTdee : null);
      const aConf = ((profile as any).adaptive_tdee_confidence as string) ?? null;
      setAdaptiveConfidence(aConf);
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

    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  const weekStats = useMemo(() => buildWeekStats(byDay, targets, weekStartDay), [byDay, targets, weekStartDay]);

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
    return buildUsualMealRecapInsight({
      byDay: byDay as any,
      weekKeys,
      savedMeals: hostSavedMealsForRecap,
      logCountBySavedMealId,
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

  // Schedule / cancel the Sunday-18:00 push whenever the opt-in flag or
  // week_start_day changes. Idempotent — the helper cancels any prior
  // scheduled notification before installing a fresh one.
  const pushSchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    const ledgerKey = `${recapPushEnabled ? "on" : "off"}|${weekStartDay}`;
    if (pushSchedRef.current === ledgerKey) return;
    pushSchedRef.current = ledgerKey;
    (async () => {
      const scheduled = await scheduleWeeklyRecapPush({
        enabled: recapPushEnabled,
        weekStartDay,
      });
      if (scheduled) {
        track(AnalyticsEvents.weekly_recap_push_sent, { weekKey: currentWeekKey });
      }
    })();
  }, [userId, recapPushEnabled, weekStartDay, currentWeekKey]);

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
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={t.accent} />
      </View>
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
          {/* Weekly Recap Card (Batch 4.11; Ship M1 usual-meal line). */}
          {recapVisible ? (
            <WeeklyRecapCard
              recap={recap}
              onDismiss={dismissRecap}
              usualMealInsight={usualMealInsight}
              onStartUsualMealSave={() => {
                // Ship M1 — route to Today; canonical save flow lives on
                // the meal-slot section. Direct deep-link to the sheet
                // pre-seeded with most-frequent items is a follow-up.
                router.navigate({ pathname: "/(tabs)" as any });
              }}
            />
          ) : null}

          {/* 2x2 Stat Grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {([
              [
                "Avg Calories",
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
                weightTrend
                  ? `${weightTrend.diff > 0 ? "+" : ""}${weightTrend.diff} kg`
                  : latestWeightKg != null
                    ? `${latestWeightKg} kg`
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
              const openTile = () => {
                if (title === "Trend") {
                  router.push("/weight-tracker" as const);
                  return;
                }
                const metric =
                  title === "Avg Calories" ? "calories" : title === "Protein Hit" ? "protein" : title === "Streak" ? "streak" : null;
                if (metric) {
                  router.push({ pathname: "/progress-metric" as any, params: { metric } });
                }
              };
              const a11yLabel =
                title === "Trend"
                  ? `Weight trend, ${val} kilograms, ${sub}`
                  : title === "Avg Calories"
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

          {/* Daily Calories Bar Chart */}
          <View style={{ backgroundColor: t.elevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: t.text, marginBottom: 12 }}>Daily Calories</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 90 }}>
              {weekStats.days.map((d, i) => {
                const maxCal = Math.max(targets.calories, ...weekStats.days.map((dd) => dd.calories));
                const barH = maxCal > 0 ? Math.max(4, (d.calories / (maxCal * 1.15)) * 70) : 4;
                const overTarget = d.calories > targets.calories;
                const isDayToday = d.key === todayKey;
                return (
                  <Pressable
                    key={d.key}
                    onPress={() => {
                      // Navigate to Today tab with this date selected
                      // Include a timestamp to force the effect to re-fire even if date is the same
                      router.navigate({ pathname: "/(tabs)" as any, params: { date: d.key, _t: String(Date.now()) } });
                    }}
                    style={{ flex: 1, alignItems: "center", gap: 4 }}
                  >
                    <Text style={{ fontSize: 11, color: t.dim, fontVariant: ["tabular-nums"] }}>
                      {d.calories > 0 ? (d.calories >= 1000 ? `${(d.calories / 1000).toFixed(1)}k` : String(d.calories)) : ""}
                    </Text>
                    <View style={{ width: "100%", height: barH, borderRadius: 5, backgroundColor: d.calories === 0 ? t.border : overTarget ? t.amber : t.green, opacity: isDayToday ? 1 : 0.75 }} />
                    <Text style={{ fontSize: 10, color: isDayToday ? t.accent : t.dim, fontWeight: isDayToday ? "700" : "500" }}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontSize: 10, color: t.dim, textAlign: "right", marginTop: 6 }}>
              Daily goal: {targets.calories.toLocaleString()} kcal
            </Text>
          </View>

          {/* Macro Adherence */}
          <View style={{ backgroundColor: t.elevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: t.text, marginBottom: 12 }}>Macro Adherence</Text>
            <Text style={{ fontSize: 10, color: t.dim, marginBottom: 8 }}>
              Based on {weekStats.daysWithFood} day{weekStats.daysWithFood !== 1 ? "s" : ""} with logged food
            </Text>
            {([
              ["Protein", Math.min(weekStats.proteinAdherence, 150), t.protein],
              ["Carbs", Math.min(weekStats.carbsAdherence, 150), t.carbs],
              ["Fat", Math.min(weekStats.fatAdherence, 150), t.fat],
            ] as const).map(([name, pct, color]) => (
              <View key={name} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
                <Text style={{ fontSize: 12, color: t.sub, width: 50 }}>{name}</Text>
                <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.border }}>
                  <View style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 3, backgroundColor: color }} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: "600", color, width: 36, textAlign: "right", fontVariant: ["tabular-nums"] }}>{pct}%</Text>
              </View>
            ))}
          </View>

          {/* Adaptive TDEE Insight Card */}
          {staticTdee != null && (
            <View style={{ backgroundColor: t.elevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <IconBox color={t.accent} size={28}>
                    <Ionicons name="flash-outline" size={14} color={t.accent} />
                  </IconBox>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: t.text }}>Your TDEE</Text>
                </View>
                {isAdaptiveTdee && (
                  <View style={{ backgroundColor: t.green + "18", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: t.green, textTransform: "uppercase", letterSpacing: 0.5 }}>Adaptive</Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                <Text style={{ fontSize: 32, fontWeight: "700", color: isAdaptiveTdee ? t.green : t.text, fontVariant: ["tabular-nums"] }}>
                  {(isAdaptiveTdee && adaptiveTdee ? adaptiveTdee : staticTdee).toLocaleString()}
                </Text>
                <Text style={{ fontSize: 13, color: t.sub }}>kcal/day</Text>
              </View>

              {isAdaptiveTdee && adaptiveTdee && staticTdee && (
                <Text style={{ fontSize: 12, color: t.sub, marginBottom: 6 }}>
                  Formula estimate: {staticTdee.toLocaleString()} kcal
                  {Math.abs(adaptiveTdee - staticTdee) >= 50 && (
                    <Text style={{ fontWeight: "600", color: t.text }}>
                      {" "}({adaptiveTdee > staticTdee ? "+" : ""}{adaptiveTdee - staticTdee} actual)
                    </Text>
                  )}
                </Text>
              )}

              {/* Confidence bars */}
              {adaptiveConfidence && (
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
                {isAdaptiveTdee
                  ? "Calculated from your actual intake and weight changes — more accurate than a formula."
                  : "Based on the Mifflin-St Jeor formula. Log meals and weigh in regularly to unlock your personalised adaptive TDEE."
                }
              </Text>

              {/* Data progress for non-adaptive users */}
              {!isAdaptiveTdee && (
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
            </View>
          )}

          {/* Steps Card */}
          <View style={{ backgroundColor: t.elevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <IconBox color={t.green} size={28}>
                <Ionicons name="footsteps-outline" size={14} color={t.green} />
              </IconBox>
              <Text style={{ fontSize: 13, fontWeight: "600", color: t.text }}>Steps Today</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
              <Text style={{ fontSize: 28, fontWeight: "700", color: stepsToday >= dailyStepsGoal ? t.green : t.text, fontVariant: ["tabular-nums"] }}>
                {stepsToday.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 13, color: t.sub }}>/ {dailyStepsGoal.toLocaleString()}</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: t.border, marginTop: 8 }}>
              <View style={{ width: `${Math.min((stepsToday / dailyStepsGoal) * 100, 100)}%`, height: "100%", borderRadius: 3, backgroundColor: t.green }} />
            </View>
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
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                <Text style={{ fontSize: 28, fontWeight: "700", color: t.text, fontVariant: ["tabular-nums"] }}>
                  {latestWeightKg ?? "—"}
                </Text>
                <Text style={{ fontSize: 13, color: t.sub }}>kg{goalWeightKg ? ` → ${goalWeightKg} kg goal` : ""}</Text>
              </View>
              {weightTrend && (
                <Text style={{ fontSize: 12, color: weightTrend.direction === "down" ? t.green : t.amber, marginTop: 4 }}>
                  {weightTrend.diff > 0 ? "+" : ""}{weightTrend.diff} kg overall trend
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
              const progressPct = journeyProg
                ? Math.max(3, Math.min(100, Math.round(journeyProg.pct * 100)))
                : timeline.remainingKg <= 0.1
                  ? 100
                  : 3;
              // Also show daily projection based on average recent intake
              const daysWithFood = Object.keys(byDay).filter((k) => (byDay[k] ?? []).length > 0);
              const recentDays = daysWithFood.slice(-7);
              const avgCals = recentDays.length > 0
                ? Math.round(recentDays.reduce((s, k) => s + (byDay[k] ?? []).reduce((a, m) => a + Math.max(0, (m as any).calories ?? 0), 0), 0) / recentDays.length)
                : 0;
              const dailyProjection =
                avgCals > 0 && latestWeightKg != null
                  ? projectWeight({
                      currentWeightKg: latestWeightKg,
                      todayCalories: avgCals,
                      targetCalories: targets.calories,
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
                      {timeline.daysToGoal != null && (
                        <Text style={{ fontSize: 22, fontWeight: "700", color: t.accent, fontVariant: ["tabular-nums"] }}>
                          {timeline.daysToGoal}<Text style={{ fontSize: 12, fontWeight: "500", color: t.sub }}> days to goal</Text>
                        </Text>
                      )}
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
                          width: `${Math.max(progressPct, 3)}%` as any,
                          height: "100%",
                          borderRadius: 3,
                          backgroundColor: progressPct >= 100 ? t.green : t.accent,
                        }} />
                      </View>
                      <Text style={{ fontSize: 10, color: t.dim, marginTop: 4, textAlign: "center" }}>
                        Now: {latestWeightKg} kg ({progressPct}% of the way)
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

          {/* Weekly Insight */}
          <View style={{ padding: 14, borderRadius: Radius.lg, backgroundColor: t.accent + "08", borderWidth: 1, borderColor: t.accent + "22" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <IconBox color={t.accent} size={24}>
                <Ionicons name="star-outline" size={12} color={t.accent} />
              </IconBox>
              <Text style={{ fontSize: 10, fontWeight: "600", color: t.accent, letterSpacing: 0.5, textTransform: "uppercase" }}>Weekly insight</Text>
            </View>
            <Text style={{ fontSize: 12, color: t.text, lineHeight: 18 }}>
              {weekStats.proteinOnTarget >= 5
                ? `Protein consistency is strong — ${weekStats.proteinOnTarget} of 7 days on target.`
                : weekStats.proteinOnTarget > 0
                  ? `Protein on target ${weekStats.proteinOnTarget} of 7 days.`
                  : "Start tracking protein to build your weekly insights."
              }
              {" "}Average intake is {weekStats.avgCalories.toLocaleString()} kcal vs your {targets.calories.toLocaleString()} target.
              {streakDays > 0 ? ` ${streakDays}-day logging streak.` : ""}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}
