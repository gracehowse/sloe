import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2, ChevronRight } from "lucide-react-native";

import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { supabase } from "@/lib/supabase";
import { Accent, MacroColors, Radius, Spacing } from "@/constants/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { dateKeyFromDate, type ByDay, type JournalMeal } from "@/lib/nutritionJournal";
import { buildWeekStats, getStreakContributingDays } from "@/lib/progressWeekReport";
import { getDailyTargets, type DailyTarget } from "../../../src/lib/nutrition/dailyTargetRead";
import { computeProtectedStreak, readFreezeLedger, type FreezeLedger } from "@/lib/streakFreeze";
import { syncHealthDataThrottled, isHealthSyncAvailable } from "@/lib/healthSync";

const DEFAULT_TARGETS = {
  calories: NUTRITION_DEFAULTS.calories,
  protein: NUTRITION_DEFAULTS.protein,
  carbs: NUTRITION_DEFAULTS.carbs,
  fat: NUTRITION_DEFAULTS.fat,
};

type Metric = "calories" | "protein" | "streak";

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function ProgressMetricDetailScreen() {
  const { metric: metricParam } = useLocalSearchParams<{ metric?: string | string[] }>();
  const metricRaw = Array.isArray(metricParam) ? metricParam[0] : metricParam;
  const metric: Metric =
    metricRaw === "protein" || metricRaw === "streak" || metricRaw === "calories" ? metricRaw : "calories";

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)/progress");
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [byDay, setByDay] = useState<ByDay>({});
  const [weekStartDay, setWeekStartDay] = useState<"monday" | "sunday">("monday");
  // Numbers audit 2026-05-04 #4 — load alongside targets below.
  const [freezeLedger, setFreezeLedger] = useState<FreezeLedger>({ earnedAt: [], usedHistory: [] });
  const [freezeBudgetMax, setFreezeBudgetMax] = useState<number>(3);
  // F-2 — daily target snapshots so past days render against the
  // target that was active on that day (TestFlight `AEyOuUJrB4l`).
  const [dailyTargetsByDay, setDailyTargetsByDay] = useState<Record<string, DailyTarget | null>>({});

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // Debug audit 2026-05-04 (code-quality #6): the body had no
    // try/catch around the two serial supabase awaits. A rejection on
    // either threw out and `setLoading(false)` (line ~145) never ran.
    // Now: full-body try/finally so the spinner always resolves.
    try {
    if (isHealthSyncAvailable()) {
      try {
        await syncHealthDataThrottled(userId);
      } catch {
        /* ignore */
      }
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "target_calories, target_protein, target_carbs, target_fat, week_start_day, streak_freezes_earned_at, streak_freezes_used_history, streak_freeze_budget_max",
      )
      .eq("id", userId)
      .maybeSingle();
    if (profile) {
      setTargets({
        calories: (profile.target_calories as number) ?? DEFAULT_TARGETS.calories,
        protein: (profile.target_protein as number) ?? DEFAULT_TARGETS.protein,
        carbs: (profile.target_carbs as number) ?? DEFAULT_TARGETS.carbs,
        fat: (profile.target_fat as number) ?? DEFAULT_TARGETS.fat,
      });
      if (profile.week_start_day === "sunday" || profile.week_start_day === "monday") {
        setWeekStartDay(profile.week_start_day);
      }
      // Numbers audit 2026-05-04 #4: hydrate freeze ledger so streak math
      // matches Today / Progress / Recap. Without this, opening the
      // "Logging streak" detail dropped the displayed count after a
      // freeze auto-applied.
      setFreezeLedger(
        readFreezeLedger({
          earnedAt: (profile as { streak_freezes_earned_at?: unknown }).streak_freezes_earned_at,
          usedHistory: (profile as { streak_freezes_used_history?: unknown }).streak_freezes_used_history,
        }),
      );
      const budget = (profile as { streak_freeze_budget_max?: unknown }).streak_freeze_budget_max;
      if (typeof budget === "number" && Number.isFinite(budget) && budget >= 0) {
        setFreezeBudgetMax(budget);
      }
    }
    const { data: rows } = await supabase
      .from("nutrition_entries")
      .select("date_key, calories, protein, carbs, fat")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
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
        } as JournalMeal);
      }
      setByDay(loaded);
    }

    // F-2 — fetch snapshots for this week. `weekStartDay` was set above
    // if the column was present.
    const nowD = new Date();
    const wsd = profile?.week_start_day === "sunday" ? "sunday" : "monday";
    const dow = nowD.getDay();
    const startOffset = wsd === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
    const weekFirst = new Date(nowD);
    weekFirst.setDate(nowD.getDate() + startOffset);
    const weekKeys: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekFirst);
      d.setDate(weekFirst.getDate() + i);
      weekKeys.push(dateKeyFromDate(d));
    }
    const snapshots = await getDailyTargets(supabase, userId, weekKeys);
    setDailyTargetsByDay(snapshots);
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[progress-metric] load failed:", err instanceof Error ? err.message : err);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
  const weekStats = useMemo(
    () => buildWeekStats(byDay, targets, weekStartDay, new Date(), weekTargetsByDay),
    [byDay, targets, weekStartDay, weekTargetsByDay],
  );
  const streakDays = useMemo(
    () => computeProtectedStreak(byDay as never, freezeLedger, freezeBudgetMax).streakLength,
    [byDay, freezeLedger, freezeBudgetMax],
  );
  const streakDaysDetail = useMemo(() => getStreakContributingDays(byDay), [byDay]);

  const t = useMemo(
    () => ({
      text: colors.text,
      sub: colors.textSecondary,
      dim: colors.textTertiary,
      bg: colors.background,
      elevated: colors.card,
      border: colors.cardBorder,
      accent: Accent.primary,
      green: Accent.success,
      amber: Accent.warning,
      red: Accent.destructive,
      protein: MacroColors.protein,
    }),
    [colors],
  );

  const title = metric === "calories" ? "Calories this week" : metric === "protein" ? "Protein consistency" : "Logging streak";

  const subtitle =
    metric === "calories"
      ? `Average across days you logged food: ${weekStats.avgCalories.toLocaleString()} kcal vs ${targets.calories.toLocaleString()} kcal target.`
      : metric === "protein"
        ? `A day counts as “on target” when protein is at least 90% of your ${Math.round(targets.protein)}g goal.`
        : "Consecutive days (ending today or yesterday) where you logged at least one meal.";

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.bg,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: insets.top,
        }}
      >
        <ActivityIndicator size="large" color={t.accent} />
      </View>
    );
  }

  const openDay = (dateKey: string) => {
    router.navigate({ pathname: "/(tabs)" as any, params: { date: dateKey, _t: String(Date.now()) } });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.sm,
        paddingHorizontal: Spacing.xl,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          marginBottom: Spacing.md,
        }}
      >
        <Pressable onPress={goBack} hitSlop={12}>
          <ArrowLeft size={22} color={t.text} strokeWidth={1.75} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            fontSize: 18,
            fontWeight: "800",
            color: Accent.primary,
            letterSpacing: 2,
          }}
          numberOfLines={1}
        >
          {title.toUpperCase()}
        </Text>
      </View>
      <Text style={{ fontSize: 14, color: t.sub, lineHeight: 20 }}>{subtitle}</Text>

      {metric === "calories" && (
        <>
          <View style={{ marginTop: Spacing.lg, backgroundColor: t.elevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.border, padding: Spacing.lg }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: t.text, marginBottom: Spacing.md }}>Daily intake</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 120 }}>
              {weekStats.days.map((d) => {
                const maxCal = Math.max(targets.calories, ...weekStats.days.map((x) => x.calories), 1);
                const barH = maxCal > 0 ? Math.max(6, (d.calories / (maxCal * 1.15)) * 88) : 6;
                // F-2 — over/under judged against each day's own target.
                const over = d.calories > d.targetCalories;
                const isToday = d.key === todayKey;
                return (
                  <Pressable key={d.key} onPress={() => openDay(d.key)} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 10, color: t.dim, fontVariant: ["tabular-nums"] }}>
                      {d.calories > 0 ? (d.calories >= 1000 ? `${(d.calories / 1000).toFixed(1)}k` : String(d.calories)) : "—"}
                    </Text>
                    <View
                      style={{
                        width: "100%",
                        height: barH,
                        borderRadius: 6,
                        // Audit 2026-05-12 (premium-bar DC10): bars now follow
                        // the calorie-ring 3-state rule — empty = border tint
                        // (no judgment), logged-and-under = success green,
                        // logged-and-over = destructive red. Previously over
                        // used `t.amber` which collapsed under/over into the
                        // same warning hue on dark backgrounds.
                        backgroundColor: d.calories === 0 ? t.border : over ? t.red : t.green,
                        opacity: isToday ? 1 : 0.85,
                      }}
                    />
                    <Text style={{ fontSize: 11, fontWeight: isToday ? "800" : "600", color: isToday ? t.accent : t.dim }}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {/* 2026-05-07 ui-critic F8: removed "Tap a day to open it on Today."
                trailing helper. The day rows below are visibly tappable
                (Pressable + chevron), so the affordance speaks for itself
                — same fix shape as the meal-nutrition footer cleanup. */}
          </View>

          {weekStats.days.map((d) => (
            <Pressable
              key={`row-${d.key}`}
              onPress={() => openDay(d.key)}
              style={{
                marginTop: Spacing.sm,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 14,
                paddingHorizontal: Spacing.md,
                backgroundColor: t.elevated,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: t.border,
              }}
            >
              <View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: t.text }}>{formatLongDate(d.key)}</Text>
                <Text style={{ fontSize: 12, color: t.dim, marginTop: 2 }}>{d.label}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: t.text, fontVariant: ["tabular-nums"] }}>
                  {d.calories.toLocaleString()} kcal
                </Text>
                <Text style={{ fontSize: 11, color: d.calories > 0 ? t.sub : t.dim }}>
                  {/* F-2 — % of goal uses each day's frozen target. Past
                      days without a snapshot (pre-migration) use the
                      current target and get an "(approx)" tag so the
                      user knows the comparison is retroactive. */}
                  {d.calories > 0
                    ? `${Math.round((d.calories / Math.max(d.targetCalories, 1)) * 100)}% of goal${!d.isSnapshot && d.key !== todayKey ? " (approx)" : ""}`
                    : "No meals"}
                </Text>
              </View>
              <ChevronRight size={18} color={t.dim} strokeWidth={1.75} />
            </Pressable>
          ))}
        </>
      )}

      {metric === "protein" && (
        <>
          <View style={{ marginTop: Spacing.lg, flexDirection: "row", gap: Spacing.md }}>
            <View style={{ flex: 1, padding: Spacing.md, backgroundColor: t.elevated, borderRadius: Radius.md, borderWidth: 1, borderColor: t.border }}>
              <Text style={{ fontSize: 11, color: t.dim, fontWeight: "600" }}>AVG / DAY</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: t.protein, marginTop: 4, fontVariant: ["tabular-nums"] }}>{weekStats.avgProtein}g</Text>
            </View>
            <View style={{ flex: 1, padding: Spacing.md, backgroundColor: t.elevated, borderRadius: Radius.md, borderWidth: 1, borderColor: t.border }}>
              <Text style={{ fontSize: 11, color: t.dim, fontWeight: "600" }}>ON TARGET</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: t.accent, marginTop: 4, fontVariant: ["tabular-nums"] }}>
                {weekStats.proteinOnTarget}/7
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: t.sub, marginTop: Spacing.md, lineHeight: 18 }}>
            Weekly protein adherence vs goal: {weekStats.proteinAdherence}%. Carbs {weekStats.carbsAdherence}% · Fat {weekStats.fatAdherence}%
          </Text>

          {weekStats.days.map((d) => {
            // F-2 — per-day protein target.
            const dayProteinTarget = d.targetProtein > 0 ? d.targetProtein : targets.protein;
            const hit = dayProteinTarget > 0 && d.protein >= dayProteinTarget * 0.9;
            const pct = dayProteinTarget > 0 ? Math.round((d.protein / dayProteinTarget) * 100) : 0;
            return (
              <Pressable
                key={d.key}
                onPress={() => openDay(d.key)}
                style={{
                  marginTop: Spacing.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  paddingHorizontal: Spacing.md,
                  backgroundColor: t.elevated,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: t.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: t.text }}>{formatLongDate(d.key)}</Text>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: t.border, marginTop: 8, overflow: "hidden" }}>
                    <View style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 3, backgroundColor: hit ? t.green : t.amber }} />
                  </View>
                </View>
                <View style={{ alignItems: "flex-end", marginLeft: Spacing.md }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: t.protein, fontVariant: ["tabular-nums"] }}>{Math.round(d.protein)}g</Text>
                  <Text style={{ fontSize: 11, color: hit ? t.green : t.dim }}>{hit ? "On target" : `${pct}% of goal`}</Text>
                </View>
                <ChevronRight size={18} color={t.dim} strokeWidth={1.75} style={{ marginLeft: 8 }} />
              </Pressable>
            );
          })}
        </>
      )}

      {metric === "streak" && (
        <>
          {/* 2026-05-07 ui-critic F11: hide the giant `0` headline when
              there's no streak yet — the empty-state copy below carries
              the message on its own. A 36/900 zero with "consecutive
              logging days" reads as a placeholder, not a stat. */}
          {streakDays > 0 ? (
            <View style={{ marginTop: Spacing.lg, padding: Spacing.lg, backgroundColor: t.elevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.border }}>
              <Text style={{ fontSize: 36, fontWeight: "900", color: t.accent, fontVariant: ["tabular-nums"] }}>{streakDays}</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: t.text, marginTop: 4 }}>consecutive logging day{streakDays !== 1 ? "s" : ""}</Text>
            </View>
          ) : null}

          {streakDaysDetail.length === 0 ? (
            <Text style={{ fontSize: 14, color: t.sub, marginTop: Spacing.lg }}>Log a meal on Today to start a streak.</Text>
          ) : (
            <>
              <Text style={{ fontSize: 13, fontWeight: "700", color: t.text, marginTop: Spacing.lg }}>Days in this streak</Text>
              {streakDaysDetail.map((row) => (
                <Pressable
                  key={row.key}
                  onPress={() => openDay(row.key)}
                  style={{
                    marginTop: Spacing.sm,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 12,
                    paddingHorizontal: Spacing.md,
                    backgroundColor: t.elevated,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor: t.border,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: t.text }}>{formatLongDate(row.key)}</Text>
                    <Text style={{ fontSize: 12, color: t.dim, marginTop: 2 }}>
                      {row.mealCount} meal{row.mealCount !== 1 ? "s" : ""} · {row.calories.toLocaleString()} kcal
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <CheckCircle2 size={22} color={t.green} strokeWidth={1.75} />
                    <ChevronRight size={18} color={t.dim} strokeWidth={1.75} />
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
