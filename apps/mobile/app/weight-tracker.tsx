import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import KeyboardSafeView from "@/components/KeyboardSafeView";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { MacroColors, Accent, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { supabase } from "@/lib/supabase";
import { refreshAdaptiveTdeeForUser } from "@/lib/refreshAdaptiveTdee";
import {
  syncHealthDataThrottled,
  getHealthBodyLookbackDays,
  setHealthBodyLookbackDays,
  HEALTH_BODY_LOOKBACK_PRESETS,
  isHealthSyncAvailable,
} from "@/lib/healthSync";
import {
  filterByDateRangeDays,
  resolveLatestWeightKg,
  weightJourneyProgress,
} from "@/lib/weightProjection";
import { dateKeyFromDate } from "@/lib/nutritionJournal";

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

/**
 * Thin bridge — the range-button helper lives in the shared
 * `weightProjection` module so that the unit test at
 * `apps/mobile/tests/unit/weightChartRangeFilter.test.ts` can pin the
 * per-range behaviour. Previously the filter was inlined here which
 * made "range buttons don't change the chart" (TestFlight
 * `ACoMvhUoe_riUvOp5XZ3Sow`, 2026-04-18) unverifiable at the filter
 * level. See `src/lib/weightProjection.ts :: filterByDateRangeDays`.
 */
function filterByRange(
  map: Record<string, number>,
  range: TimeRange,
): Record<string, number> {
  return filterByDateRangeDays(map, daysForRange(range));
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function ProgressScreen() {
  const goBack = useSafeBack("/(tabs)/progress");
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  const colors = useThemeColors();

  const [loading, setLoading] = useState(true);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null);
  const [weightKgByDay, setWeightKgByDay] = useState<Record<string, number>>(
    {},
  );
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [dailyStepsGoal, setDailyStepsGoal] = useState(NUTRITION_DEFAULTS.steps);
  const [bodyFatPct, setBodyFatPct] = useState<number | null>(null);
  const [waterByDay, setWaterByDay] = useState<Record<string, number>>({});
  const [waterGoalMl, setWaterGoalMl] = useState(NUTRITION_DEFAULTS.water);
  const [weightInput, setWeightInput] = useState("");
  const [stepsInput, setStepsInput] = useState("");
  const [bfInput, setBfInput] = useState("");
  const [isImperial, setIsImperial] = useState(false);
  const [range, setRange] = useState<TimeRange>("3M");
  const [healthLookbackDays, setHealthLookbackDays] = useState(366);
  const [healthRefreshing, setHealthRefreshing] = useState(false);

  const weightInputUserEdited = useRef(false);
  const stepsInputUserEdited = useRef(false);
  const bfInputUserEdited = useRef(false);

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

  useEffect(() => {
    weightInputUserEdited.current = false;
    stepsInputUserEdited.current = false;
    bfInputUserEdited.current = false;
  }, [userId]);

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
      const stepsParsed = parseNumMap(data.steps_by_day);
      setStepsByDay(stepsParsed);
      const sg = Number(data.daily_steps_goal);
      setDailyStepsGoal(
        Number.isFinite(sg) && sg > 0 ? Math.round(sg) : NUTRITION_DEFAULTS.steps,
      );
      const bf =
        data.body_fat_pct != null ? Number(data.body_fat_pct) : null;
      setBodyFatPct(Number.isFinite(bf) ? bf : null);
      setWaterByDay(parseNumMap(data.extra_water_by_day));
      const tw =
        data.target_water_ml != null ? Number(data.target_water_ml) : NUTRITION_DEFAULTS.water;
      setWaterGoalMl(Number.isFinite(tw) && tw > 0 ? Math.round(tw) : NUTRITION_DEFAULTS.water);

      const imperial = data.measurement_system === "imperial";
      const tk = dateKeyFromDate(new Date());
      const todaySteps = stepsParsed[tk];
      if (
        !stepsInputUserEdited.current &&
        todaySteps != null &&
        todaySteps > 0
      ) {
        setStepsInput(String(Math.round(todaySteps)));
      }

      if (!weightInputUserEdited.current) {
        let displayKg: number | null =
          w != null && Number.isFinite(w) ? w : null;
        const sorted = Object.entries(wByDay).sort(([a], [b]) =>
          b.localeCompare(a),
        );
        if (sorted[0]?.[1] != null && Number.isFinite(sorted[0][1])) {
          displayKg = sorted[0][1];
        }
        if (displayKg != null && displayKg > 0) {
          const shown = imperial
            ? Math.round(displayKg * 2.20462 * 10) / 10
            : Math.round(displayKg * 10) / 10;
          setWeightInput(String(shown));
        }
      }

      if (
        !bfInputUserEdited.current &&
        bf != null &&
        Number.isFinite(bf) &&
        bf > 0
      ) {
        setBfInput(String(Math.round(bf * 10) / 10));
      }
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void getHealthBodyLookbackDays().then(setHealthLookbackDays);
  }, []);

  const refreshFromApple = useCallback(
    async (days?: number) => {
      if (!userId || !isHealthSyncAvailable()) return;
      setHealthRefreshing(true);
      try {
        if (days != null) await setHealthBodyLookbackDays(days);
        await syncHealthDataThrottled(userId, { bypassThrottle: true });
        const d = await getHealthBodyLookbackDays();
        setHealthLookbackDays(d);
        await load();
      } finally {
        setHealthRefreshing(false);
      }
    },
    [userId, load],
  );

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      void (async () => {
        if (isHealthSyncAvailable()) await syncHealthDataThrottled(userId);
        await load();
      })();
    }, [userId, load]),
  );

  const latestKg = useMemo(
    () => resolveLatestWeightKg(weightKgByDay, weightKg),
    [weightKgByDay, weightKg],
  );

  const persist = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!userId) return;
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (!error && "weight_kg_by_day" in patch) {
        void refreshAdaptiveTdeeForUser(supabase, userId);
      }
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
    weightInputUserEdited.current = false;
    await persist({ weight_kg: kg, weight_kg_by_day: next });
  }, [weightInput, weightKgByDay, todayKey, persist, userId, isImperial]);

  const saveSteps = useCallback(async () => {
    const v = Math.round(Number.parseFloat(stepsInput.replace(",", ".")));
    if (!Number.isFinite(v) || v < 0 || !userId) return;
    const next = pruneByDay({ ...stepsByDay, [todayKey]: v });
    setStepsByDay(next);
    setStepsInput("");
    stepsInputUserEdited.current = false;
    await persist({ steps_by_day: next });
  }, [stepsInput, stepsByDay, todayKey, persist, userId]);

  const saveBf = useCallback(async () => {
    const v = Number.parseFloat(bfInput.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0 || v > 60 || !userId) return;
    setBodyFatPct(v);
    setBfInput("");
    bfInputUserEdited.current = false;
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

  // Range delta — prominent "↑ 1.4 kg past three months" header stat.
  // TestFlight `AF7bS2DQrH_wZWxGosBJ3K8` (2026-04-18): tester attached
  // LoseIt-style references showing this delta in the chart-card corner.
  // Direction arrow is purely informational; no colour cue (matches the
  // factual-only copy rule in `docs/ux/brand-guidelines.md`).
  const rangeDelta = useMemo(() => {
    const filtered = filterByRange(weightKgByDay, range);
    const entries = Object.entries(filtered).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    if (entries.length < 2) return null;
    const firstKg = entries[0][1];
    const lastKg = entries[entries.length - 1][1];
    const deltaKg = lastKg - firstKg;
    const sinceKey = entries[0][0];
    const rangeLabel: Record<TimeRange, string> = {
      "1W": "past week",
      "1M": "past month",
      "3M": "past 3 months",
      "6M": "past 6 months",
      "9M": "past 9 months",
      "12M": "past year",
      "All": `since ${formatShortDate(sinceKey)}`,
    };
    const displayDelta = isImperial
      ? Math.abs(kgToLb(deltaKg))
      : Math.abs(Math.round(deltaKg * 10) / 10);
    const unit = isImperial ? "lb" : "kg";
    const arrow = Math.abs(deltaKg) < 0.05 ? "→" : deltaKg > 0 ? "↑" : "↓";
    return {
      arrow,
      magnitude: displayDelta,
      unit,
      label: rangeLabel[range] ?? "",
    };
  }, [weightKgByDay, range, isImperial]);

  const weightProjection = useMemo(() => {
    if (!goalWeightKg || latestKg == null || weightData.length < 2)
      return undefined;
    const filtered = filterByRange(weightKgByDay, range);
    const entries = Object.entries(filtered).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    if (entries.length < 2) return undefined;
    const firstKey = entries[0][0];
    const lastKey = entries[entries.length - 1][0];
    const first = entries[0][1];
    const last = entries[entries.length - 1][1];
    const daysBetween = Math.max(
      1,
      Math.round(
        (new Date(`${lastKey}T12:00:00`).getTime() -
          new Date(`${firstKey}T12:00:00`).getTime()) /
          86400000,
      ),
    );
    const dailyRate = (last - first) / daysBetween;
    if (Math.abs(dailyRate) < 0.001) return undefined;
    const deltaToGoal = goalWeightKg - last;
    if (Math.sign(deltaToGoal) !== Math.sign(dailyRate)) return undefined;
    const daysToGoal = Math.abs(deltaToGoal / dailyRate);
    if (daysToGoal > 365) return undefined;
    const pts: { label: string; value: number }[] = [];
    const weeks = Math.min(12, Math.ceil(daysToGoal / 7));
    for (let w = 1; w <= weeks; w++) {
      const projected = last + dailyRate * w * 7;
      const future = new Date();
      future.setHours(12, 0, 0, 0);
      future.setDate(future.getDate() + w * 7);
      const futureKey = dateKeyFromDate(future);
      pts.push({
        label: formatShortDate(futureKey),
        value: isImperial
          ? kgToLb(projected)
          : Math.round(projected * 10) / 10,
      });
    }
    return pts;
  }, [weightKgByDay, goalWeightKg, latestKg, range, weightData.length, isImperial]);

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

  // Journey / milestone (baseline = peak when losing, trough when gaining — uses full history)
  const journey = useMemo(() => {
    if (!goalWeightKg || latestKg == null) return null;
    const jp = weightJourneyProgress({
      goalKg: goalWeightKg,
      latestKg,
      weightKgByDay,
    });
    if (!jp) return null;
    const { lostKg, pct, remainingKg, totalKg } = jp;

    const trendMap = filterByRange(weightKgByDay, range);
    const entries = Object.entries(trendMap).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    let weeksEta: number | null = null;
    if (entries.length >= 2) {
      const firstKey = entries[0][0];
      const lastKey = entries[entries.length - 1][0];
      const first = entries[0][1];
      const last = entries[entries.length - 1][1];
      const daysBetween = Math.max(
        1,
        Math.round(
          (new Date(`${lastKey}T12:00:00`).getTime() -
            new Date(`${firstKey}T12:00:00`).getTime()) /
            86400000,
        ),
      );
      const weeklyRateKg = ((last - first) / daysBetween) * 7;
      if (
        Math.abs(weeklyRateKg) > 0.01 &&
        (goalWeightKg - last) * weeklyRateKg > 0
      ) {
        weeksEta = Math.round(remainingKg / Math.abs(weeklyRateKg));
      }
    }

    const losingPhysique = goalWeightKg < latestKg - 0.05;

    return {
      totalToLose: totalKg,
      lost: lostKg,
      pct,
      remaining: remainingKg,
      weeksEta,
      losingPhysique,
    };
  }, [goalWeightKg, latestKg, weightKgByDay, range]);

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
          fontWeight: "700",
          color: colors.text,
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
          backgroundColor: Accent.primary,
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
          backgroundColor: Accent.primary,
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
    <KeyboardSafeView
      scroll={false}
      dismissOnBackgroundTap={false}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={goBack} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Weight &amp; Trends</Text>
        </View>

        {/* Time range selector */}
        <TimeRangeSelector
          selected={range}
          onSelect={setRange}
          cardColor={colors.card}
          textColor={colors.text}
          secondaryColor={colors.textSecondary}
        />

        {isHealthSyncAvailable() && (
          <View style={styles.card}>
            {/* Deliberately NOT another chart-zoom range. G-3
                (TestFlight `AGJmliHTxnmt7sC1VpTZz5E`, build 11): the
                tester read the two stacked pill rows as duplicate
                chart filters. This card controls *import depth* —
                how far back HealthKit is queried on sync — and does
                not change what is visible on the chart above.
                Relabel + helper copy disambiguate the two surfaces.
                "All" reads up to ~11 years (HealthKit cap). */}
            <Text style={styles.sectionTitle}>Historical import depth</Text>
            <Text style={styles.muted}>
              Choose how many months of past weights and steps to pull from your connected health source. Doesn&apos;t change what&apos;s
              visible on the chart above — use the range pills at the top for that. Journey &quot;lost&quot; uses roughly
              the last 18 months of saved weights and trims statistical outliers so one bad reading does not
              dominate the bar.
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: Spacing.md,
              }}
            >
              {HEALTH_BODY_LOOKBACK_PRESETS.map((p) => (
                <Pressable
                  key={p.days}
                  onPress={() => void refreshFromApple(p.days)}
                  disabled={healthRefreshing}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor:
                      healthLookbackDays === p.days ? Accent.primary : colors.border,
                    backgroundColor:
                      healthLookbackDays === p.days ? Accent.primary + "18" : colors.card,
                    opacity: healthRefreshing ? 0.55 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      fontSize: 13,
                      color:
                        healthLookbackDays === p.days ? Accent.primary : colors.text,
                    }}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {healthRefreshing ? (
              <Text style={[styles.muted, { marginTop: Spacing.sm }]}>
                Syncing from your connected health source…
              </Text>
            ) : null}
          </View>
        )}

        {loading ? (
          <Text style={styles.muted}>Loading...</Text>
        ) : (
          <>
            {/* WEIGHT */}
            <View style={styles.card}>
              {/* Title row: "Weight" on the left, range delta on the right.
                  TestFlight `AF7bS2DQrH_wZWxGosBJ3K8` (2026-04-18). */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                }}
              >
                <Text style={styles.sectionTitle}>Weight</Text>
                {rangeDelta && (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: colors.text,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {rangeDelta.arrow} {rangeDelta.magnitude}
                      <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textSecondary }}>
                        {" "}
                        {rangeDelta.unit}
                      </Text>
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                      {rangeDelta.label}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.row}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {latestKg != null ? fmtW(latestKg) : "—"}
                  </Text>
                  <Text style={styles.statLabel}>Current</Text>
                </View>
                <View style={styles.stat}>
                  <Text
                    style={[styles.statValue, { color: Accent.success }]}
                  >
                    {goalWeightKg != null ? fmtW(goalWeightKg) : "—"}
                  </Text>
                  <Text style={styles.statLabel}>Goal</Text>
                </View>
              </View>

              {weightData.length >= 2 && (
                <>
                  <Text style={[styles.muted, { marginBottom: 4 }]}>
                    Tap the chart to see weight on that day.
                  </Text>
                  <TrendLine
                    key={range}
                    data={weightData}
                    projectedData={weightProjection}
                    height={200}
                    goalValue={
                      goalWeightKg != null
                        ? isImperial
                          ? kgToLb(goalWeightKg)
                          : Math.round(goalWeightKg * 10) / 10
                        : undefined
                    }
                    color={Accent.primary}
                    labelColor={colors.textTertiary}
                    trackColor={colors.border}
                    goalColor={Accent.success}
                    formatValue={(v) =>
                      `${Math.round(v * 10) / 10}${isImperial ? " lb" : " kg"}`
                    }
                  />
                </>
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
                  onChangeText={(t) => {
                    weightInputUserEdited.current = true;
                    setWeightInput(t);
                  }}
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
                {/* Start-of-journey + goal anchors with pill amounts either
                    side of the fill bar — mirrors the LoseIt reference in
                    TestFlight `AF7bS2DQrH_wZWxGosBJ3K8`. F-12 (TestFlight
                    `AOOBv-1OwtDIoRVDRwH-S5k`, 2026-04-19) flipped the
                    original tent / flag / trophy emoji to Ionicons vectors
                    so they render crisp on every device. */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: Spacing.sm,
                    marginTop: Spacing.xs,
                  }}
                >
                  <View style={{ alignItems: "center", width: 52 }}>
                    <Ionicons
                      name="flag-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                    <View
                      style={{
                        marginTop: 2,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 8,
                        backgroundColor: Accent.success + "22",
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "700", color: Accent.success }}>
                        0 {isImperial ? "lb" : "kg"}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.journeyBar, { flex: 1 }]}>
                    <View
                      style={[
                        styles.journeyFill,
                        { width: `${Math.round(journey.pct * 100)}%` },
                      ]}
                    />
                  </View>
                  <View style={{ alignItems: "center", width: 52 }}>
                    <Ionicons
                      name={journey.pct >= 1 ? "trophy-outline" : "flag"}
                      size={20}
                      color={journey.pct >= 1 ? Accent.success : Accent.primary}
                    />
                    <View
                      style={{
                        marginTop: 2,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 8,
                        backgroundColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textSecondary }}>
                        {isImperial
                          ? `${Math.round(kgToLb(journey.totalToLose) * 10) / 10} lb`
                          : `${Math.round(journey.totalToLose * 10) / 10} kg`}
                      </Text>
                    </View>
                  </View>
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
                      ? `${Math.round(kgToLb(journey.lost) * 10) / 10} lb ${journey.losingPhysique ? "lost" : "gained"}`
                      : `${Math.round(journey.lost * 10) / 10} kg ${journey.losingPhysique ? "lost" : "gained"}`}
                  </Text>
                  <Text style={styles.muted}>
                    {isImperial
                      ? `${Math.round(kgToLb(journey.remaining) * 10) / 10} lb to goal`
                      : `${Math.round(journey.remaining * 10) / 10} kg to goal`}
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
                          journey.pct >= m ? Accent.success : colors.textTertiary
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
                        color: Accent.primary,
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
                    style={[styles.statValue, { color: Accent.success }]}
                  >
                    {dailyStepsGoal.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Goal</Text>
                </View>
              </View>

              {stepsData.length >= 2 && (
                <MiniBarChart
                  key={`steps-${range}`}
                  data={stepsData}
                  goalLine={dailyStepsGoal}
                  color={Accent.success}
                  trackColor={colors.border}
                  labelColor={colors.textTertiary}
                  goalColor={Accent.success}
                />
              )}
              <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: Spacing.sm }}>
                Steps sync automatically from your connected health source.
              </Text>
            </View>

            {/* WATER */}
            {waterData.length >= 2 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Water</Text>
                <MiniBarChart
                  key={`water-${range}`}
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
                  onChangeText={(t) => {
                    bfInputUserEdited.current = true;
                    setBfInput(t);
                  }}
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
    </KeyboardSafeView>
  );
}
