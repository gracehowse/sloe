import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { MacroColors, Neon, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";

import TrendLine from "@/components/charts/TrendLine";
import MiniBarChart from "@/components/charts/MiniBarChart";
import TimeRangeSelector, {
  daysForRange,
  type TimeRange,
} from "@/components/charts/TimeRangeSelector";

const MAX_JSONB_DAYS = 400;
function pruneByDay(map: Record<string, number>): Record<string, number> {
  const keys = Object.keys(map).sort().reverse().slice(0, MAX_JSONB_DAYS);
  const pruned: Record<string, number> = {};
  for (const k of keys) pruned[k] = map[k];
  return pruned;
}

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

function filterByRange(
  map: Record<string, number>,
  range: TimeRange,
): Record<string, number> {
  const maxDays = daysForRange(range);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const entries = Object.entries(map)
    .filter(([k]) => k >= cutoffStr)
    .sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  const colors = useThemeColors();

  const [loading, setLoading] = useState(true);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [startWeightKg, setStartWeightKg] = useState<number | null>(null);
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null);
  const [weightKgByDay, setWeightKgByDay] = useState<Record<string, number>>(
    {},
  );
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [dailyStepsGoal, setDailyStepsGoal] = useState(10000);
  const [bodyFatPct, setBodyFatPct] = useState<number | null>(null);
  const [waterByDay, setWaterByDay] = useState<Record<string, number>>({});
  const [waterGoalMl, setWaterGoalMl] = useState(2000);
  const [weightInput, setWeightInput] = useState("");
  const [stepsInput, setStepsInput] = useState("");
  const [bfInput, setBfInput] = useState("");
  const [isImperial, setIsImperial] = useState(false);
  const [range, setRange] = useState<TimeRange>("3M");

  const kgToLb = (kg: number) => Math.round(kg * 2.20462 * 10) / 10;
  const lbToKg = (lb: number) => Math.round((lb / 2.20462) * 10) / 10;
  const fmtW = (kg: number) =>
    isImperial
      ? `${Math.round(kgToLb(kg) * 10) / 10} lb`
      : `${Math.round(kg * 10) / 10} kg`;

  const [todayKey, setTodayKey] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  useEffect(() => {
    const refreshAtMidnight = () => {
      const d = new Date();
      setTodayKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    };
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const timer = setTimeout(refreshAtMidnight, msUntilMidnight + 500);
    return () => clearTimeout(timer);
  }, [todayKey]);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "weight_kg, goal_weight_kg, weight_kg_by_day, steps_by_day, daily_steps_goal, body_fat_pct, measurement_system, extra_water_by_day, target_water_ml",
      )
      .eq("id", userId)
      .maybeSingle();
    if (!error && data) {
      setIsImperial(data.measurement_system === "imperial");
      const w = data.weight_kg != null ? Number(data.weight_kg) : null;
      const gw =
        data.goal_weight_kg != null ? Number(data.goal_weight_kg) : null;
      setWeightKg(Number.isFinite(w) ? w : null);
      setGoalWeightKg(Number.isFinite(gw) ? gw : null);
      const wByDay = parseNumMap(data.weight_kg_by_day);
      setWeightKgByDay(wByDay);
      const sortedWeights = Object.entries(wByDay).sort(([a], [b]) =>
        a.localeCompare(b),
      );
      if (sortedWeights.length > 0)
        setStartWeightKg(sortedWeights[0][1]);
      setStepsByDay(parseNumMap(data.steps_by_day));
      const sg = Number(data.daily_steps_goal);
      setDailyStepsGoal(
        Number.isFinite(sg) && sg > 0 ? Math.round(sg) : 10000,
      );
      const bf =
        data.body_fat_pct != null ? Number(data.body_fat_pct) : null;
      setBodyFatPct(Number.isFinite(bf) ? bf : null);
      setWaterByDay(parseNumMap(data.extra_water_by_day));
      const tw =
        data.target_water_ml != null ? Number(data.target_water_ml) : 2000;
      setWaterGoalMl(Number.isFinite(tw) && tw > 0 ? Math.round(tw) : 2000);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const latestKg = useMemo(() => {
    const sorted = Object.entries(weightKgByDay).sort(([a], [b]) =>
      b.localeCompare(a),
    );
    const v = sorted[0]?.[1];
    return v != null && Number.isFinite(v) ? v : weightKg;
  }, [weightKgByDay, weightKg]);

  const persist = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!userId) return;
      await supabase.from("profiles").update(patch).eq("id", userId);
    },
    [userId],
  );

  const saveWeight = useCallback(async () => {
    const v = Number.parseFloat(weightInput.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0 || !userId) return;
    const kg = isImperial ? lbToKg(v) : v;
    const next = pruneByDay({ ...weightKgByDay, [todayKey]: kg });
    setWeightKgByDay(next);
    setWeightKg(kg);
    setWeightInput("");
    await persist({ weight_kg: kg, weight_kg_by_day: next });
  }, [weightInput, weightKgByDay, todayKey, persist, userId, isImperial]);

  const saveSteps = useCallback(async () => {
    const v = Math.round(Number.parseFloat(stepsInput.replace(",", ".")));
    if (!Number.isFinite(v) || v < 0 || !userId) return;
    const next = pruneByDay({ ...stepsByDay, [todayKey]: v });
    setStepsByDay(next);
    setStepsInput("");
    await persist({ steps_by_day: next });
  }, [stepsInput, stepsByDay, todayKey, persist, userId]);

  const saveBf = useCallback(async () => {
    const v = Number.parseFloat(bfInput.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0 || v > 60 || !userId) return;
    setBodyFatPct(v);
    setBfInput("");
    await persist({ body_fat_pct: v });
  }, [bfInput, persist, userId]);

  // Chart data derived from time range
  const weightData = useMemo(() => {
    const filtered = filterByRange(weightKgByDay, range);
    return Object.entries(filtered).map(([k, v]) => ({
      label: formatShortDate(k),
      value: isImperial ? kgToLb(v) : Math.round(v * 10) / 10,
    }));
  }, [weightKgByDay, range, isImperial]);

  const weightProjection = useMemo(() => {
    if (
      !goalWeightKg ||
      !latestKg ||
      weightData.length < 2
    )
      return undefined;
    const entries = Object.entries(weightKgByDay)
      .sort(([a], [b]) => a.localeCompare(b));
    if (entries.length < 2) return undefined;
    const first = entries[0][1];
    const last = entries[entries.length - 1][1];
    const daysBetween = Math.max(
      1,
      (new Date(entries[entries.length - 1][0]).getTime() -
        new Date(entries[0][0]).getTime()) /
        86400000,
    );
    const dailyRate = (last - first) / daysBetween;
    if (Math.abs(dailyRate) < 0.001) return undefined;
    const daysToGoal = Math.abs((goalWeightKg - last) / dailyRate);
    if (daysToGoal > 365) return undefined;
    const pts: { label: string; value: number }[] = [];
    const weeks = Math.min(12, Math.ceil(daysToGoal / 7));
    for (let w = 1; w <= weeks; w++) {
      const projected = last + dailyRate * w * 7;
      const d = new Date();
      d.setDate(d.getDate() + w * 7);
      pts.push({
        label: formatShortDate(d.toISOString().slice(0, 10)),
        value: isImperial
          ? kgToLb(projected)
          : Math.round(projected * 10) / 10,
      });
    }
    return pts;
  }, [weightKgByDay, goalWeightKg, latestKg, weightData.length, isImperial]);

  const stepsData = useMemo(() => {
    const filtered = filterByRange(stepsByDay, range);
    return Object.entries(filtered).map(([k, v]) => ({
      label: formatShortDate(k),
      value: v,
    }));
  }, [stepsByDay, range]);

  const waterData = useMemo(() => {
    const filtered = filterByRange(waterByDay, range);
    return Object.entries(filtered).map(([k, v]) => ({
      label: formatShortDate(k),
      value: v,
    }));
  }, [waterByDay, range]);

  // Journey / milestone
  const journey = useMemo(() => {
    if (!startWeightKg || !goalWeightKg || !latestKg) return null;
    const totalToLose = Math.abs(startWeightKg - goalWeightKg);
    if (totalToLose < 0.1) return null;
    const lost = Math.abs(startWeightKg - latestKg);
    const pct = Math.min(1, lost / totalToLose);
    const remaining = Math.max(0, totalToLose - lost);

    const entries = Object.entries(weightKgByDay).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    let weeksEta: number | null = null;
    if (entries.length >= 2) {
      const first = entries[0][1];
      const last = entries[entries.length - 1][1];
      const daysBetween = Math.max(
        1,
        (new Date(entries[entries.length - 1][0]).getTime() -
          new Date(entries[0][0]).getTime()) /
          86400000,
      );
      const weeklyRate = Math.abs(((last - first) / daysBetween) * 7);
      if (weeklyRate > 0.01) weeksEta = Math.round(remaining / weeklyRate);
    }

    return { totalToLose, lost, pct, remaining, weeksEta };
  }, [startWeightKg, goalWeightKg, latestKg, weightKgByDay]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: {
          paddingHorizontal: Spacing.xl,
          paddingBottom: 120,
          gap: Spacing.lg,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          paddingVertical: Spacing.md,
        },
        headerTitle: {
          fontSize: 22,
          fontWeight: "800",
          color: Neon.purple,
          letterSpacing: 3,
        },
        card: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.xl,
          gap: Spacing.sm,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        },
        sectionTitle: {
          fontSize: 16,
          fontWeight: "700",
          color: colors.text,
        },
        muted: { fontSize: 12, color: colors.textSecondary },
        big: {
          fontSize: 28,
          fontWeight: "800",
          color: colors.text,
          fontVariant: ["tabular-nums"],
        },
        row: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        stat: { alignItems: "center" },
        statValue: {
          fontSize: 18,
          fontWeight: "700",
          color: colors.text,
          fontVariant: ["tabular-nums"],
        },
        statLabel: {
          fontSize: 10,
          color: colors.textSecondary,
          marginTop: 2,
        },
        input: {
          backgroundColor: colors.inputBg,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.lg,
          paddingVertical: 12,
          color: colors.text,
          fontSize: 16,
        },
        inputRow: { flexDirection: "row", gap: Spacing.sm },
        btn: {
          backgroundColor: Neon.purple,
          borderRadius: Radius.md,
          paddingVertical: 12,
          alignItems: "center",
        },
        btnText: { color: "#fff", fontWeight: "700" },
        journeyBar: {
          height: 12,
          backgroundColor: colors.border,
          borderRadius: 6,
          overflow: "hidden",
        },
        journeyFill: {
          height: 12,
          borderRadius: 6,
          backgroundColor: Neon.purple,
        },
      }),
    [colors],
  );

  if (!userId) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, padding: Spacing.xl },
        ]}
      >
        <Text style={styles.muted}>Sign in to track progress.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>PROGRESS</Text>
        </View>

        {/* Time range selector */}
        <TimeRangeSelector
          selected={range}
          onSelect={setRange}
          cardColor={colors.card}
          textColor={colors.text}
          secondaryColor={colors.textSecondary}
        />

        {loading ? (
          <Text style={styles.muted}>Loading...</Text>
        ) : (
          <>
            {/* WEIGHT */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Weight</Text>
              <View style={styles.row}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {latestKg != null ? fmtW(latestKg) : "—"}
                  </Text>
                  <Text style={styles.statLabel}>Current</Text>
                </View>
                <View style={styles.stat}>
                  <Text
                    style={[styles.statValue, { color: Neon.green }]}
                  >
                    {goalWeightKg != null ? fmtW(goalWeightKg) : "—"}
                  </Text>
                  <Text style={styles.statLabel}>Goal</Text>
                </View>
              </View>

              {weightData.length >= 2 && (
                <TrendLine
                  data={weightData}
                  projectedData={weightProjection}
                  goalValue={
                    goalWeightKg != null
                      ? isImperial
                        ? kgToLb(goalWeightKg)
                        : Math.round(goalWeightKg * 10) / 10
                      : undefined
                  }
                  color={Neon.purple}
                  labelColor={colors.textTertiary}
                  trackColor={colors.border}
                  goalColor={Neon.green}
                />
              )}

              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder={
                    isImperial ? "Weight (lb)" : "Weight (kg)"
                  }
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={weightInput}
                  onChangeText={setWeightInput}
                />
                <Pressable
                  style={[styles.btn, { paddingHorizontal: Spacing.xl }]}
                  onPress={() => void saveWeight()}
                >
                  <Text style={styles.btnText}>Save</Text>
                </Pressable>
              </View>
            </View>

            {/* JOURNEY / MILESTONES */}
            {journey && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Journey</Text>
                <View style={styles.journeyBar}>
                  <View
                    style={[
                      styles.journeyFill,
                      { width: `${Math.round(journey.pct * 100)}%` },
                    ]}
                  />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 4,
                  }}
                >
                  <Text style={styles.muted}>
                    {isImperial
                      ? `${Math.round(kgToLb(journey.lost) * 10) / 10} lb lost`
                      : `${Math.round(journey.lost * 10) / 10} kg lost`}
                  </Text>
                  <Text style={styles.muted}>
                    {isImperial
                      ? `${Math.round(kgToLb(journey.remaining) * 10) / 10} lb to go`
                      : `${Math.round(journey.remaining * 10) / 10} kg to go`}
                  </Text>
                </View>

                {/* Milestone markers */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-around",
                    marginTop: Spacing.md,
                  }}
                >
                  {[0.25, 0.5, 0.75, 1].map((m) => (
                    <View key={m} style={{ alignItems: "center" }}>
                      <Ionicons
                        name={
                          journey.pct >= m
                            ? "checkmark-circle"
                            : "ellipse-outline"
                        }
                        size={20}
                        color={
                          journey.pct >= m ? Neon.green : colors.textTertiary
                        }
                      />
                      <Text
                        style={{
                          fontSize: 10,
                          color: colors.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {Math.round(m * 100)}%
                      </Text>
                    </View>
                  ))}
                </View>

                {journey.weeksEta != null &&
                  journey.weeksEta > 0 &&
                  journey.weeksEta < 200 && (
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: Neon.purple,
                        textAlign: "center",
                        marginTop: Spacing.sm,
                      }}
                    >
                      ~{Math.round(journey.weeksEta)} weeks to goal
                    </Text>
                  )}
              </View>
            )}

            {/* STEPS */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Steps</Text>
              <View style={styles.row}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {(stepsByDay[todayKey] ?? 0).toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Today</Text>
                </View>
                <View style={styles.stat}>
                  <Text
                    style={[styles.statValue, { color: Neon.green }]}
                  >
                    {dailyStepsGoal.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Goal</Text>
                </View>
              </View>

              {stepsData.length >= 2 && (
                <MiniBarChart
                  data={stepsData}
                  goalLine={dailyStepsGoal}
                  color={Neon.green}
                  trackColor={colors.border}
                  labelColor={colors.textTertiary}
                  goalColor={Neon.green}
                />
              )}

              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Steps today"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  value={stepsInput}
                  onChangeText={setStepsInput}
                />
                <Pressable
                  style={[styles.btn, { paddingHorizontal: Spacing.xl }]}
                  onPress={() => void saveSteps()}
                >
                  <Text style={styles.btnText}>Save</Text>
                </Pressable>
              </View>
            </View>

            {/* WATER */}
            {waterData.length >= 2 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Water</Text>
                <MiniBarChart
                  data={waterData}
                  goalLine={waterGoalMl}
                  color={MacroColors.water}
                  trackColor={colors.border}
                  labelColor={colors.textTertiary}
                  goalColor={MacroColors.water}
                />
              </View>
            )}

            {/* BODY FAT */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Body Fat</Text>
              <Text style={styles.big}>
                {bodyFatPct != null ? `${Math.round(bodyFatPct * 10) / 10}%` : "—"}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Body fat %"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={bfInput}
                  onChangeText={setBfInput}
                />
                <Pressable
                  style={[styles.btn, { paddingHorizontal: Spacing.xl }]}
                  onPress={() => void saveBf()}
                >
                  <Text style={styles.btnText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
