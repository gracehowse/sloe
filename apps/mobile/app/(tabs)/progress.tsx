import { useCallback, useEffect, useMemo, useState } from "react";
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

/* ── Helpers ── */
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

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);

    // Profile targets + weight + steps
    const { data: profile } = await supabase
      .from("profiles")
      .select("target_calories, target_protein, target_carbs, target_fat, weight_kg, goal_weight_kg, weight_kg_by_day, steps_by_day, daily_steps_goal, week_start_day")
      .eq("id", userId)
      .maybeSingle();

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
    }

    // Nutrition entries
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
        });
      }
      setByDay(loaded);
    }

    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  // Weekly stats: current week based on weekStartDay setting
  const weekStats = useMemo(() => {
    const days: { key: string; label: string; calories: number; protein: number; carbs: number; fat: number }[] = [];
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Find start of current week
    const today = new Date();
    const dow = today.getDay(); // 0=Sun
    const startOffset = weekStartDay === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
    const weekFirst = new Date(today);
    weekFirst.setDate(today.getDate() + startOffset);

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekFirst);
      d.setDate(weekFirst.getDate() + i);
      const key = dateKeyFromDate(d);
      const meals = byDay[key] ?? [];
      const totals = meals.reduce(
        (acc, m) => ({
          calories: acc.calories + Math.max(0, m.calories),
          protein: acc.protein + Math.max(0, m.protein),
          carbs: acc.carbs + Math.max(0, m.carbs),
          fat: acc.fat + Math.max(0, m.fat),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      days.push({ key, label: dayLabels[d.getDay()], ...totals });
    }

    const daysWithFood = days.filter((d) => d.calories > 0).length || 1;
    const avgCalories = Math.round(days.reduce((s, d) => s + d.calories, 0) / daysWithFood);
    const avgProtein = Math.round(days.reduce((s, d) => s + d.protein, 0) / daysWithFood);
    const avgCarbs = Math.round(days.reduce((s, d) => s + d.carbs, 0) / daysWithFood);
    const avgFat = Math.round(days.reduce((s, d) => s + d.fat, 0) / daysWithFood);

    const proteinOnTarget = days.filter((d) => d.protein >= targets.protein * 0.9).length;
    const proteinAdherence = daysWithFood > 0 ? Math.round((avgProtein / targets.protein) * 100) : 0;
    const carbsAdherence = daysWithFood > 0 ? Math.round((avgCarbs / targets.carbs) * 100) : 0;
    const fatAdherence = daysWithFood > 0 ? Math.round((avgFat / targets.fat) * 100) : 0;

    return { days, avgCalories, avgProtein, proteinOnTarget, daysWithFood, proteinAdherence, carbsAdherence, fatAdherence };
  }, [byDay, targets]);

  const streakDays = useMemo(() => computeLoggingStreak(byDay as any), [byDay]);

  // Weight trend (last entries)
  const weightTrend = useMemo(() => {
    const keys = Object.keys(weightKgByDay).sort();
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
        <View style={{ padding: 24, borderRadius: 14, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border, alignItems: "center", gap: Spacing.md }}>
          <IconBox color={t.accent} size={40}>
            <Ionicons name="bar-chart-outline" size={20} color={t.accent} />
          </IconBox>
          <Text style={{ fontSize: 15, fontWeight: "600", color: t.text, textAlign: "center" }}>No data yet</Text>
          <Text style={{ fontSize: 13, color: t.sub, textAlign: "center", maxWidth: 260, lineHeight: 18 }}>
            Start logging meals on the Today tab to see your weekly progress, macro adherence, and trends here.
          </Text>
        </View>
      ) : (
        <>
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
                `${weekStats.proteinOnTarget}/7`,
                "days on target",
                weekStats.proteinOnTarget >= 5 ? t.green : t.amber,
                "checkmark-circle-outline",
              ],
              [
                "Streak",
                `${streakDays} day${streakDays !== 1 ? "s" : ""}`,
                "logging streak",
                streakDays >= 3 ? t.green : t.accent,
                "trophy-outline",
              ],
              [
                "Trend",
                weightTrend ? `${weightTrend.diff > 0 ? "+" : ""}${weightTrend.diff} kg` : weightKg ? `${weightKg} kg` : "—",
                weightTrend
                  ? weightTrend.direction === "down" ? "losing" : weightTrend.direction === "up" ? "gaining" : "maintaining"
                  : "no weight data",
                weightTrend?.direction === "down" ? t.green : weightTrend?.direction === "up" ? t.amber : t.accent,
                weightTrend?.direction === "down" ? "trending-down-outline" : weightTrend?.direction === "up" ? "trending-up-outline" : "analytics-outline",
              ],
            ] as const).map(([title, val, sub, color, iconName], i) => (
              <View key={i} style={{ width: "48.5%", padding: 14, borderRadius: 14, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <IconBox color={color as string} size={24}>
                    <Ionicons name={iconName as any} size={12} color={color as string} />
                  </IconBox>
                  <Text style={{ fontSize: 10, color: t.dim, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</Text>
                </View>
                <Text style={{ fontSize: 22, fontWeight: "700", color: color as string, fontVariant: ["tabular-nums"] }}>{val}</Text>
                <Text style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>{sub}</Text>
              </View>
            ))}
          </View>

          {/* Daily Calories Bar Chart */}
          <View style={{ backgroundColor: t.elevated, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
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
                    <Text style={{ fontSize: 9, color: t.dim, fontVariant: ["tabular-nums"] }}>
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
          <View style={{ backgroundColor: t.elevated, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
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

          {/* Steps Card */}
          <View style={{ backgroundColor: t.elevated, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
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
          {(weightKg != null || Object.keys(weightKgByDay).length > 0) && (
            <View style={{ backgroundColor: t.elevated, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <IconBox color={t.accent} size={28}>
                  <Ionicons name="scale-outline" size={14} color={t.accent} />
                </IconBox>
                <Text style={{ fontSize: 13, fontWeight: "600", color: t.text }}>Weight</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                <Text style={{ fontSize: 28, fontWeight: "700", color: t.text, fontVariant: ["tabular-nums"] }}>
                  {weightKg ?? "—"}
                </Text>
                <Text style={{ fontSize: 13, color: t.sub }}>kg{goalWeightKg ? ` → ${goalWeightKg} kg goal` : ""}</Text>
              </View>
              {weightTrend && (
                <Text style={{ fontSize: 12, color: weightTrend.direction === "down" ? t.green : t.amber, marginTop: 4 }}>
                  {weightTrend.diff > 0 ? "+" : ""}{weightTrend.diff} kg overall trend
                </Text>
              )}
            </View>
          )}

          {/* Weekly Insight */}
          <View style={{ padding: 14, borderRadius: 14, backgroundColor: t.accent + "08", borderWidth: 1, borderColor: t.accent + "22" }}>
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
                  ? `Protein on target ${weekStats.proteinOnTarget} of 7 days — aim for 5+ next week.`
                  : "Start tracking protein to build your weekly insights."
              }
              {" "}Average intake is {weekStats.avgCalories.toLocaleString()} kcal vs your {targets.calories.toLocaleString()} target.
              {streakDays > 0 ? ` ${streakDays}-day logging streak — keep it going!` : ""}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}
