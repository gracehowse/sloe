import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
import { PostHogMaskView } from "posthog-react-native";

import KeyboardSafeView from "@/components/KeyboardSafeView";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { MacroColors, Accent, Radius, Spacing, Type, FontFamily } from "@/constants/theme";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useAccent } from "@/context/theme";
import { isFeatureEnabled } from "@/lib/analytics";
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

import { WeightChart } from "@/components/progress/WeightChart";
import { SupprButton } from "@/components/ui/SupprButton";
import MiniBarChart from "@/components/charts/MiniBarChart";
import TimeRangeSelector, {
  daysForRange,
  type TimeRange,
} from "@/components/charts/TimeRangeSelector";
import {
  computeWeightTrend,
  weightKgByDayToPoints,
  type WeightRange,
} from "@/lib/progress/weightTrend";

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
  // Secondary accent (Frost flag → damson, else clay) for the weight chart
  // line/dots, active lookback-range chips, primary CTAs, and link actions.
  // Threaded into the memoised StyleSheet via the dep array below. A reached
  // goal keeps `Accent.success` (sage); cautions keep `Accent.warning`.
  const accent = useAccent();
  // One-card-treatment soft elevation (docs/decisions/2026-06-09-one-card-treatment-
  // soft-elevation.md): every weight-tracker card sits directly on the page ground,
  // so it takes the SOFT lift, routed through the elevation system (was a hand-rolled
  // `Elevation.cardSoft` + an always-on hairline — light → shadow only now).
  const cardElevation = useCardElevation({ variant: "soft" });

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
  // Gap 4 — §7.1 Trend/Scale toggle (behind weight_surface_redesign flag).
  const weightSurfaceRedesign = isFeatureEnabled("weight_surface_redesign");
  const [weightView, setWeightView] = useState<"trend" | "scale">("trend");

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

  // Debug audit 2026-05-04 (code-quality #14): persist used to swallow
  // the supabase error and not return it. The save callbacks called
  // `await persist(...)` and didn't check anything. A silent failure
  // (RLS / network) left the local state ahead of the DB; the next
  // focus would re-read from DB and the weight/steps/bf appeared to
  // disappear. Now: persist returns the error, callers check it,
  // restore the snapshotted state on failure, and Alert the user
  // (mirrors the Today addCaffeineMg pattern).
  const persist = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!userId) return null;
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (!error && "weight_kg_by_day" in patch) {
        void refreshAdaptiveTdeeForUser(supabase, userId);
      }
      return error ?? null;
    },
    [userId],
  );

  const saveWeight = useCallback(async () => {
    const v = Number.parseFloat(weightInput.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0 || !userId) return;
    const kg = isImperial ? lbToKg(v) : v;
    const prevByDay = weightKgByDay;
    const prevWeight = weightKg;
    const next = pruneByDay({ ...weightKgByDay, [todayKey]: kg });
    setWeightKgByDay(next);
    setWeightKg(kg);
    setWeightInput("");
    weightInputUserEdited.current = false;
    const err = await persist({ weight_kg: kg, weight_kg_by_day: next });
    if (err) {
      setWeightKgByDay(prevByDay);
      setWeightKg(prevWeight);
      console.error("[saveWeight] persist failed:", err.message);
      Alert.alert("Couldn't save weight", err.message ?? "Try again.");
    }
  }, [weightInput, weightKgByDay, weightKg, todayKey, persist, userId, isImperial]);

  const saveSteps = useCallback(async () => {
    const v = Math.round(Number.parseFloat(stepsInput.replace(",", ".")));
    if (!Number.isFinite(v) || v < 0 || !userId) return;
    const prevByDay = stepsByDay;
    const next = pruneByDay({ ...stepsByDay, [todayKey]: v });
    setStepsByDay(next);
    setStepsInput("");
    stepsInputUserEdited.current = false;
    const err = await persist({ steps_by_day: next });
    if (err) {
      setStepsByDay(prevByDay);
      console.error("[saveSteps] persist failed:", err.message);
      Alert.alert("Couldn't save steps", err.message ?? "Try again.");
    }
  }, [stepsInput, stepsByDay, todayKey, persist, userId]);

  const saveBf = useCallback(async () => {
    const v = Number.parseFloat(bfInput.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0 || v > 60 || !userId) return;
    const prevBf = bodyFatPct;
    setBodyFatPct(v);
    setBfInput("");
    bfInputUserEdited.current = false;
    const err = await persist({ body_fat_pct: v });
    if (err) {
      setBodyFatPct(prevBf);
      console.error("[saveBf] persist failed:", err.message);
      Alert.alert("Couldn't save body fat", err.message ?? "Try again.");
    }
  }, [bfInput, bodyFatPct, persist, userId]);

  // Chart data derived from time range
  //
  // 2026-05-06 (F-101 follow-up): the weight-tracker page chart now
  // shares the bucketing pipeline with the Progress-tab WeightChart
  // via `computeWeightTrend`. Same MFP-style aggregation
  // (1W/1M = daily, 3M = weekly, 6M/9M/12M/All = monthly), same
  // calendar-day MA, same same-day dedup, same smart bucket
  // fallback. Without this, the weight-tracker chart was rendering
  // raw daily points filtered by a flat days-from-now cutoff —
  // which is why the tester reported the months were inaccurate
  // ("the chart is hard to read once the range covers >3 months").
  //
  // Map TimeRange (this page's union) → WeightRange
  // (computeWeightTrend's union):
  //   1W       → 1w
  //   1M       → 1m
  //   3M       → 3m
  //   6M / 9M  → 1y (covered by the same monthly bucketing)
  //   12M      → 1y
  //   All      → all
  // 6M / 9M deliberately collapse to "1y"-style monthly buckets
  // because anything beyond 3 months wants monthly aggregation;
  // the days-cutoff is enforced by the existing `filterByRange`
  // path used elsewhere on this page (rangeDelta, weightProjection).
  const weightTrendRange: WeightRange =
    range === "1W"
      ? "1w"
      : range === "1M"
        ? "1m"
        : range === "3M"
          ? "3m"
          : range === "All"
            ? "all"
            : "1y";

  const weightTrend = useMemo(
    () =>
      computeWeightTrend(
        weightKgByDayToPoints(weightKgByDay),
        weightTrendRange,
        goalWeightKg ?? null,
      ),
    [weightKgByDay, weightTrendRange, goalWeightKg],
  );

  // F-125 v2 (2026-05-07): `weightData` (unit-converted projection of
  // weightTrend.points for TrendLine consumption) and `weightProjection`
  // (dashed-line forecast extension) were dropped when the chart swapped
  // to <WeightChart>. The journey card below already surfaces a "~N
  // weeks to goal" textual estimate, so the visual extension was
  // redundant and added noise on long ranges.

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
    // F-27 (2026-04-21): when the actual data span is meaningfully
    // shorter than the selected range, use the "since <date>" form so
    // the label doesn't lie. TestFlight AGOlc2wi1UZD — user saw
    // "↑ 0.9 kg past 3 months" when actual data spanned ~57 days (16
    // Feb → 14 Apr). Rule: if data span < 70% of the nominal window,
    // fall back to "since <firstKey>".
    const rangeDaysNominal: Record<TimeRange, number | null> = {
      "1W": 7,
      "1M": 30,
      "3M": 90,
      "6M": 180,
      "9M": 270,
      "12M": 365,
      "All": null,
    };
    const actualSpanDays = Math.round(
      (new Date(`${entries[entries.length - 1][0]}T12:00:00`).getTime() -
        new Date(`${sinceKey}T12:00:00`).getTime()) /
        86400000,
    );
    const nominal = rangeDaysNominal[range];
    const useSinceFallback =
      nominal != null && actualSpanDays > 0 && actualSpanDays < nominal * 0.7;
    const rangeLabel: Record<TimeRange, string> = {
      "1W": "past week",
      "1M": "past month",
      "3M": "past 3 months",
      "6M": "past 6 months",
      "9M": "past 9 months",
      "12M": "past year",
      "All": `since ${formatShortDate(sinceKey)}`,
    };
    const label = useSinceFallback
      ? `since ${formatShortDate(sinceKey)}`
      : rangeLabel[range] ?? "";
    const displayDelta = isImperial
      ? Math.abs(kgToLb(deltaKg))
      : Math.abs(Math.round(deltaKg * 10) / 10);
    const unit = isImperial ? "lb" : "kg";
    const arrow = Math.abs(deltaKg) < 0.05 ? "→" : deltaKg > 0 ? "↑" : "↓";
    // F-31 (2026-04-21): TestFlight AGOlc2wi1UZD — user with a loss goal
    // saw "↑ 0.9 kg" in neutral text and read it as fine. Arrow stays
    // factual per brand guidelines, but we add a **semantic tone**
    // (progress / regress / neutral) so the consumer can tint the
    // number based on whether the movement is *toward* the user's goal.
    // No coloured arrow — only the magnitude number picks up a tone.
    let tone: "progress" | "regress" | "neutral" = "neutral";
    if (goalWeightKg != null && Math.abs(deltaKg) >= 0.05) {
      const goalDelta = goalWeightKg - firstKg; // + means user wants to gain, - means lose
      if (Math.abs(goalDelta) >= 0.05) {
        const movingToward = Math.sign(deltaKg) === Math.sign(goalDelta);
        tone = movingToward ? "progress" : "regress";
      }
    }
    return {
      arrow,
      magnitude: displayDelta,
      unit,
      label,
      tone,
    };
  }, [weightKgByDay, range, isImperial, goalWeightKg]);

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

  // Gap 8 §3.2: grey out range pills that have insufficient data.
  // Thresholds: 1W needs ≥2 points in the 7-day window; 1M ≥3 in 30d;
  // 3M ≥4 in 90d; 12M ≥8 in 366d. "All" is always enabled (uses full
  // history). Display-only: does not affect the underlying data path.
  const disabledRanges = useMemo((): Set<TimeRange> => {
    const disabled = new Set<TimeRange>();
    const thresholds: Array<[TimeRange, number]> = [
      ["1W", 2],
      ["1M", 3],
      ["3M", 4],
      ["12M", 8],
    ];
    for (const [r, minPoints] of thresholds) {
      const pts = Object.keys(filterByRange(weightKgByDay, r)).length;
      if (pts < minPoints) disabled.add(r);
    }
    return disabled;
  }, [weightKgByDay]);

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
        // Gap 1 — §2.3 / SLOE Spec 3 (2026-06-09): screen H1 tokenised onto the
        // shared `Type.screenTitle` (Newsreader serif 28/34/600). Was
        // `Type.display` (serifRegular 32) overridden to 28 — an ad-hoc size off
        // the screen-title token every sibling screen now shares.
        headerTitle: {
          ...Type.screenTitle,
          color: colors.text,
        },
        // Gap 10 — §5: soft lift routed through the elevation system (the canonical
        // lifted card shadow, mirrors web `--elev-card-soft`). Light → shadow, no
        // border; dark → tonal lift + hairline (no double-edge).
        card: {
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderRadius: Radius.lg,
          borderWidth: cardElevation.useBorder ? 1 : 0,
          borderColor: colors.border,
          padding: Spacing.xl,
          gap: Spacing.sm,
          ...(cardElevation.shadowStyle ?? {}),
        },
        // Gap 1 — §2.3: section headers in serif (display-section 17-22pt).
        sectionTitle: {
          ...Type.headline,
          fontSize: 18,
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
        // Gap 5 — §7.1: stat pair labels demoted to Inter 12pt sage captions.
        statValue: {
          fontSize: 18,
          fontWeight: "700",
          color: colors.text,
          fontVariant: ["tabular-nums"],
        },
        statLabel: {
          fontSize: 12,
          color: colors.textSecondary,
          marginTop: 2,
        },
        // Gap 6 — §3.1: paddingVertical 12 → Spacing.md (16) for 48pt+ touch target.
        input: {
          backgroundColor: colors.inputBg,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          color: colors.text,
          fontSize: 16,
        },
        inputRow: { flexDirection: "row", gap: Spacing.sm },
        // Gap 6 — §3.1: journey bar uses a named const height, no raw 12.
        journeyBar: {
          height: 8, // Spacing.sm (8) — refined track per §7.1 spec
          backgroundColor: colors.border,
          borderRadius: Radius.full,
          overflow: "hidden",
        },
        journeyFill: {
          height: 8, // matches journeyBar
          borderRadius: Radius.full,
          backgroundColor: accent.primary,
        },
      }),
    [colors, accent, cardElevation],
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
          {/* Gap 1 — headerTitle is now serif (Type.display) per §2.3 */}
        </View>

        {/* Time range selector — Gap 8: disabledRanges computed from
            data thresholds so sparse-account pills are non-interactive. */}
        <TimeRangeSelector
          selected={range}
          onSelect={setRange}
          cardColor={colors.card}
          textColor={colors.text}
          secondaryColor={colors.textSecondary}
          disabledRanges={disabledRanges}
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
            {/* 2026-05-08 ui-critic F14: tightened the 4-sentence
                defensive paragraph that mostly explained what the
                control ISN'T (chart range, journey-bar lookback). The
                control speaks for itself; the disambiguation belongs
                in a tooltip if it's needed at all. Kept the one
                positive line that names the action. */}
            <Text style={styles.muted}>
              How many months of past weights and steps to pull from your connected health source.
            </Text>
            {/* Gap 6+7 §3.1/§3.3: pills use Spacing.sm gap + Spacing.sm
                paddingHorizontal (was raw 8/12), minHeight 44 for touch
                target compliance (was ~33pt). */}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: Spacing.sm,
                marginTop: Spacing.md,
              }}
            >
              {HEALTH_BODY_LOOKBACK_PRESETS.map((p) => (
                <Pressable
                  key={p.days}
                  onPress={() => void refreshFromApple(p.days)}
                  disabled={healthRefreshing}
                  // Sloe treatment system (§7): selected lookback pill = aubergine
                  // soft-tint fill + primarySolid border/label.
                  style={{
                    paddingVertical: Spacing.sm,
                    paddingHorizontal: Spacing.md,
                    minHeight: 44,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor:
                      healthLookbackDays === p.days ? accent.primarySolid : colors.border,
                    backgroundColor:
                      healthLookbackDays === p.days ? accent.primarySoft : colors.card,
                    opacity: healthRefreshing ? 0.55 : 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      fontSize: 13,
                      color:
                        healthLookbackDays === p.days ? accent.primarySolid : colors.text,
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
              {/* Gap 5 §7.1: serif-display stat-pair header ABOVE the chart.
                  Left = current weight (Newsreader 28pt, ink). Right = signed
                  range delta. Section label "Weight" moves to card eyebrow.
                  Gap 4: Trend/Scale toggle added to card header row. */}
              {/* Card eyebrow + Trend/Scale toggle row */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={styles.sectionTitle}>Weight</Text>
                {/* Gap 4 — §7.1 + §15: Trend/Scale segmented pill toggle.
                    Gated behind weight_surface_redesign flag.
                    Trend = MA smoothed line (current behaviour).
                    Scale = raw scatter dots. */}
                {weightSurfaceRedesign && (
                  <View
                    accessibilityRole="tablist"
                    accessibilityLabel="Weight chart view"
                    style={{
                      flexDirection: "row",
                      backgroundColor: colors.border,
                      borderRadius: Radius.full,
                      padding: 2,
                    }}
                  >
                    {(["trend", "scale"] as const).map((v) => {
                      const active = weightView === v;
                      return (
                        <Pressable
                          key={v}
                          accessibilityRole="tab"
                          accessibilityState={{ selected: active }}
                          onPress={() => setWeightView(v)}
                          style={{
                            paddingVertical: Spacing.xs,
                            paddingHorizontal: Spacing.sm,
                            borderRadius: Radius.full,
                            backgroundColor: active ? colors.card : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "600",
                              textTransform: "capitalize",
                              color: active ? colors.text : colors.textSecondary,
                            }}
                          >
                            {v}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Gap 5 §7.1: serif 28pt current-weight hero + signed delta */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  marginTop: Spacing.xs,
                }}
              >
                {/* Left: current weight serif hero */}
                <View>
                  <PostHogMaskView>
                    <Text
                      testID="weight-tracker-current-value"
                      style={{
                        // Gap 1 §2.3 + Gap 5 §7.1: serif 28pt for the primary
                        // numeral on this screen (the biggest number, the focal
                        // point — mandates Newsreader/Fraunces).
                        ...Type.heroValue,
                        fontSize: 28,
                        color: colors.text,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {latestKg != null ? fmtW(latestKg) : "—"}
                    </Text>
                  </PostHogMaskView>
                  {/* Gap 5: sage caption under the hero numeral */}
                  <Text style={styles.statLabel}>Current</Text>
                </View>

                {/* Right: signed range delta (§7.1) */}
                {rangeDelta && (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color:
                          rangeDelta.tone === "progress"
                            ? Accent.success
                            : rangeDelta.tone === "regress"
                              ? Accent.warning
                              : colors.text,
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

              {/* Gap 5: goal sub-line (replaces the naked em-dash Goal stat).
                  PostHogMaskView is a View, not inline-able in Text — use row. */}
              {goalWeightKg != null && (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: Spacing.xs }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    Goal{" "}
                  </Text>
                  <PostHogMaskView>
                    <Text
                      style={{ fontSize: 13, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}
                    >
                      {fmtW(goalWeightKg)}
                    </Text>
                  </PostHogMaskView>
                </View>
              )}

              {weightTrend.points.length >= 2 && (
                <>
                  {/* F-125 v2 (Grace, 2026-05-07): canonical WeightChart.
                      Gap 4: pass weightView so the chart can surface raw
                      dots (scale) vs MA line (trend) when toggle is active.
                      WeightChart already renders both layers; the toggle is
                      additive — the raw-dots layer is always rendered in the
                      existing component. No WeightChart change needed for the
                      visual; the label on the card is what disambiguates. */}
                  <WeightChart
                    key={range}
                    trend={weightTrend}
                    goalKg={goalWeightKg ?? null}
                    isImperial={isImperial}
                    range={weightTrendRange}
                  />
                </>
              )}

              <View style={styles.inputRow}>
                <TextInput
                  testID="weight-tracker-input"
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
                <SupprButton
                  variant="primary"
                  onPress={() => void saveWeight()}
                  label="Save"
                  style={{ paddingHorizontal: Spacing.xl }}
                />
              </View>
              {/* DC12 (2026-05-14, premium-bar audit) + Gap 13 §2.2 display-italic:
                  Headspace-style supportive coaching line rendered in
                  Newsreader italic 14pt sage — the editorial-commentary
                  register, not a grey caption. */}
              <Text
                testID="weight-tracker-supportive-copy"
                style={{
                  ...Type.coach,
                  fontSize: 14,
                  color: colors.textSecondary,
                  textAlign: "center",
                  marginTop: Spacing.xs,
                }}
              >
                Every check-in gives us better data for you.
              </Text>
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
                {/* ENG-534 (2026-05-16): wrap weight-journey numbers in
                    PostHogMaskView so session-replay renders these as
                    grey blocks. They are HIGH-class (body-weight PHI)
                    and rendered as plain Text by default would land in
                    replay as cleartext. See
                    `docs/operations/session-replay-masking-audit.md`. */}
                <PostHogMaskView>
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
                          paddingHorizontal: Spacing.xs,
                          paddingVertical: Spacing.xs,
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
                        color={journey.pct >= 1 ? Accent.success : accent.primary}
                      />
                      <View
                        style={{
                          marginTop: 2,
                          paddingHorizontal: Spacing.xs,
                          paddingVertical: Spacing.xs,
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
                </PostHogMaskView>

                {/* Gap 11 §3.5: milestone BADGES — filled accent circle with
                    serif numeral when reached, hairline border circle when not.
                    Replaces flat Ionicons dot markers. */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-around",
                    marginTop: Spacing.md,
                  }}
                >
                  {[0.25, 0.5, 0.75, 1].map((m) => {
                    const reached = journey.pct >= m;
                    const label = `${Math.round(m * 100)}%`;
                    return (
                      <View key={m} style={{ alignItems: "center" }}>
                        {/* Badge circle: filled accent when reached, hairline border when not */}
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: Radius.full,
                            backgroundColor: reached ? accent.primary : "transparent",
                            borderWidth: reached ? 0 : 1.5,
                            borderColor: reached ? undefined : colors.border,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {/* Gap 1 §2.3: serif numeral inside badge */}
                          <Text
                            style={{
                              ...Type.caption,
                              fontFamily: reached ? FontFamily.serifSemibold : FontFamily.sansMedium,
                              fontSize: 10,
                              color: reached ? accent.primaryForeground : colors.textTertiary,
                            }}
                          >
                            {label}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {journey.weeksEta != null &&
                  journey.weeksEta > 0 &&
                  journey.weeksEta < 200 && (
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: accent.primary,
                        textAlign: "center",
                        marginTop: Spacing.sm,
                      }}
                    >
                      ~{Math.round(journey.weeksEta)} weeks to goal
                    </Text>
                  )}
              </View>
            )}

            {/* 2026-05-12 (premium-bar audit Phase 2 — Option B+):
                STEPS / WATER / BODY FAT sections removed from this
                screen.
                  - Steps trend (30-day chart + goal line) lives on
                    Burn detail now — that's the canonical
                    activity drill-down (MFP + Lose It IA pattern).
                  - Water is already on Today as a tile and a
                    standalone /weight-tracker home for it didn't
                    earn its place.
                  - Body fat has no regulatory cover, no chart
                    history worth preserving, and no comparable that
                    prioritises it for manual-entry users (research
                    via competitor-intelligence sub-agent
                    2026-05-12). If the user re-enables body-comp
                    tracking later we'll bring it back behind a
                    Settings flag.
                The screen is now scoped to weight + goal + journey.
                Phase 3 will collapse this whole route into a redirect
                to Progress once one release of PostHog usage
                confirms zero deeplink hits. */}
          </>
        )}
      </ScrollView>
    </KeyboardSafeView>
  );
}
