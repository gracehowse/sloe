import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { formatMacro, formatKcalDisplay } from "@suppr/nutrition-core/formatMacro";
import {
  ProgressMetricCaloriesSection,
  ProgressMetricProteinSection,
  ProgressMetricStreakSection,
} from "@/components/progress/ProgressMetricSections";

import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useSafeBack } from "@/hooks/use-safe-back";
import { supabase } from "@/lib/supabase";
import { Accent, FontFamily, MacroColors, MacroColorsDark, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent, useResolvedScheme } from "@/context/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { dateKeyFromDate, type ByDay, type JournalMeal } from "@/lib/nutritionJournal";
import { buildWeekStats, getStreakContributingDays } from "@/lib/progressWeekReport";
import { getDailyTargets, type DailyTarget } from "@suppr/nutrition-core/dailyTargetRead";
import { computeProtectedStreak, readFreezeLedger, type FreezeLedger } from "@/lib/streakFreeze";
import { syncHealthDataThrottled, isHealthSyncAvailable } from "@/lib/healthSync";

const DEFAULT_TARGETS = {
  calories: NUTRITION_DEFAULTS.calories,
  protein: NUTRITION_DEFAULTS.protein,
  carbs: NUTRITION_DEFAULTS.carbs,
  fat: NUTRITION_DEFAULTS.fat,
};

type Metric = "calories" | "protein" | "streak";

export default function ProgressMetricDetailScreen() {
  const { metric: metricParam } = useLocalSearchParams<{ metric?: string | string[] }>();
  const metricRaw = Array.isArray(metricParam) ? metricParam[0] : metricParam;
  const metric: Metric =
    metricRaw === "protein" || metricRaw === "streak" || metricRaw === "calories" ? metricRaw : "calories";

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)/progress");
  const colors = useThemeColors(), mc = useResolvedScheme() === "dark" ? MacroColorsDark : MacroColors;
  // Secondary accent (Frost flag → damson, else clay) for the local accent
  // token. Status keeps success/warning/destructive; macros keep `MacroColors`.
  const accent = useAccent();
  const cardElevation = useCardElevation();

  // ENG-822 (2026-05-31 design-director review) — this screen only renders the
  // calories / protein / streak drill-downs. Weight has its own surface (the
  // Progress tab chart + LogWeightSheet), so a `metric=weight` deep-link was
  // silently falling through to the calories default and rendering a "CALORIES
  // THIS WEEK" screen mislabelled as weight (deep-link capture proof:
  // `metric-calories-s00.png` === `metric-weight-s00.png` byte-for-byte).
  // Redirect weight to the Progress tab instead of rendering a wrong chart.
  const isWeightMetric = metricRaw === "weight";
  useEffect(() => {
    if (isWeightMetric) {
      router.replace("/(tabs)/progress" as never);
    }
  }, [isWeightMetric, router]);
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
      accent: accent.primary,
      green: Accent.success,
      amber: Accent.warning,
      red: Accent.destructive,
      protein: mc.protein,
    }),
    [colors, accent, mc],
  );

  // ENG-822 — soft resting-card elevation (or the flag-off flat/hairline
  // fallback) applied to every card on the detail screen. Mirrors the parent
  // Progress tab so the detail screen stops reading as a flatter, less-finished
  // surface than the tab it drilled in from. `bg` lets dark soft-elevation use
  // the tonal lift; `border`/`borderWidth` collapse the hairline when the soft
  // shadow carries separation. Spread `...cardSurface` onto each card View.
  const cardSurface = useMemo(
    () => ({
      ...(cardElevation.shadowStyle ?? {}),
      backgroundColor: cardElevation.liftBg ?? t.elevated,
      borderColor: t.border,
      borderWidth: cardElevation.useBorder ? 1 : 0,
    }),
    [cardElevation, t.elevated, t.border],
  );

  const title = metric === "calories" ? "Calories this week" : metric === "protein" ? "Protein consistency" : "Logging streak";

  const subtitle =
    metric === "calories"
      ? `Average across days you logged food: ${formatKcalDisplay(weekStats.avgCalories)} kcal vs ${formatKcalDisplay(targets.calories)} kcal target.`
      : metric === "protein"
        ? `A day counts as “on target” when protein is at least 90% of your ${formatMacro(targets.protein, "protein", "g")} goal.`
        : "Consecutive days (ending today or yesterday) where you logged at least one meal.";

  // While redirecting a `metric=weight` deep-link, render a neutral spinner —
  // never the calories chart — so the wrong surface never flashes.
  if (loading || isWeightMetric) {
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
        <PressableScale haptic="selection" onPress={goBack} hitSlop={12}>
          <ArrowLeft size={22} color={t.text} strokeWidth={1.75} />
        </PressableScale>
        {/* ENG-822 (2026-05-31 design-director review): calmed the header.
            Was a shouty saturated-blue, ALL-CAPS, letter-spaced (2px) banner
            ("CALORIES THIS WEEK") that the review flagged as the loudest,
            least-calm element on the detail screens. Now a normal-case,
            text-coloured, lightly-tracked title — the page subtitle below
            already carries the context, so the title doesn't need to shout. */}
        <Text
          style={{
            flex: 1,
            fontSize: 20,
            fontWeight: "700",
            color: t.text,
            letterSpacing: -0.2,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      <Text style={{ fontSize: 14, color: t.sub, lineHeight: 20 }}>{subtitle}</Text>

      {metric === "calories" && (
        <ProgressMetricCaloriesSection
          weekStats={weekStats}
          targets={targets}
          todayKey={todayKey}
          t={t}
          cardSurface={cardSurface}
          onOpenDay={openDay}
        />
      )}

      {metric === "protein" && (
        <ProgressMetricProteinSection
          weekStats={weekStats}
          targets={targets}
          todayKey={todayKey}
          t={t}
          cardSurface={cardSurface}
          onOpenDay={openDay}
        />
      )}

      {metric === "streak" && (
        <ProgressMetricStreakSection
          streakDays={streakDays}
          streakDaysDetail={streakDaysDetail}
          t={t}
          cardSurface={cardSurface}
          onOpenDay={openDay}
        />
      )}

    </ScrollView>
  );
}
