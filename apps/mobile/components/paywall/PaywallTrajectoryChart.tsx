import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { SupprCard } from "@/components/ui/SupprCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { getEffectiveTDEE } from "@/lib/calcTargets";
import {
  computeTrajectory,
  resolveLatestWeightKg,
  type TrajectoryState,
} from "@/lib/weightProjection";

/**
 * `<PaywallTrajectoryChart>` — ENG-969 (mobile).
 *
 * A calm, single-line projected-weight chart for the Pro paywall. Answers
 * the same question the Progress `<TrajectoryCard>` answers ("if you keep
 * this pace you'll be X"), rendered as a line you can SEE rather than a
 * single numeral — a quiet reason the goal is reachable, placed before the
 * sell.
 *
 * Honest framing (mirrors `TrajectoryCard.tsx`):
 *   - The PROJECTION maths is the shared `computeTrajectory()` helper — no
 *     re-derived numbers, no web ↔ mobile drift, and the 5-week linear cap
 *     (`MAX_LINEAR_PROJECTION_WEEKS`) is enforced by that helper.
 *   - The line is the secondary accent (a forecast tone, never red/green
 *     verdict colours). The projected segment is dashed + the marker is a
 *     hollow ring so it reads "estimate", not "fact".
 *   - Copy is "An estimate, not a promise." — never a guarantee.
 *
 * On a CONVERSION surface we only render when there is a REAL projection to
 * show (`state.kind === "projection"`): ≥5 food-logged days AND a current
 * weight. For a brand-new (e.g. onboarding) user with no log yet the chart
 * renders NOTHING — we never fabricate a forecast to sell against, and the
 * paywall is not the place to nag "log 5 more days". Net-neutral when there's
 * nothing honest to draw.
 *
 * Flag: `paywall_trajectory_chart_v1` (default-ON since 2026-06-30, ENG-1279; the host gates the mount).
 *
 * The presentation component (`PaywallTrajectoryChartView`) is pure and
 * data-prop-driven so it's unit-testable without Supabase; the exported
 * `PaywallTrajectoryChart` adds the mobile data load on top.
 *
 * Mirror: `app/pricing/PaywallTrajectoryChart.tsx`.
 */

const CHART_HEIGHT = 96;
const PAD_TOP = 14;
const PAD_BOTTOM = 14;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const CHART_WIDTH = 280;

export interface PaywallTrajectoryChartViewProps {
  byDay: Record<string, { calories?: number | null }[]>;
  latestWeightKg: number | null;
  targetCalories: number;
  maintenanceTdeeKcal?: number | null;
  goal?: string | null;
  style?: ViewStyle;
  testID?: string;
}

/** Pure presentation. Renders the single-line projected-weight chart only for
 *  the `projection` state; placeholder / null both render nothing. */
export function PaywallTrajectoryChartView(props: PaywallTrajectoryChartViewProps) {
  const { style, testID, ...input } = props;
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the forecast line —
  // matches the Progress TrajectoryCard's projection tone.
  const accent = useAccent();
  const state: TrajectoryState | null = computeTrajectory(input);

  // Conversion surface: only ever draw a REAL projection. No placeholder nag,
  // no fabricated forecast.
  if (!state || state.kind !== "projection") return null;

  const startKg = input.latestWeightKg as number;
  const endKg = state.projectedKg;

  // y-domain: current + projected, padded so a flat line still reads.
  const lo = Math.min(startKg, endKg);
  const hi = Math.max(startKg, endKg);
  const span = hi - lo;
  const padY = Math.max(span * 0.35, 0.4);
  const yMin = lo - padY;
  const yMax = hi + padY;

  const plotW = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const toY = (kg: number) => {
    const d = yMax - yMin || 1;
    return PAD_TOP + plotH - ((kg - yMin) / d) * plotH;
  };
  const x0 = PAD_LEFT;
  const x1 = PAD_LEFT + plotW;
  const y0 = toY(startKg);
  const y1 = toY(endKg);

  const projectedLine = `M ${x0.toFixed(1)} ${y0.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  const areaPath = `${projectedLine} L ${x1.toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} L ${x0.toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} Z`;

  return (
    <SupprCard
      testID={testID ?? "paywall-trajectory-chart"}
      accessibilityLabel={`Projected weight ${endKg} kilograms in about ${state.weeks} weeks if you keep your current pace. An estimate, not a promise.`}
      lift="soft"
      padding="none"
      style={[styles.card, style]}
      innerStyle={styles.cardInner}
    >
      <View style={styles.eyebrowRow}>
        <View style={[styles.dot, { backgroundColor: accent.primary }]} />
        <Text style={[Type.label, { color: colors.textTertiary }]}>PROJECTED WEIGHT</Text>
      </View>

      <View style={styles.headlineRow}>
        <Text
          testID="paywall-trajectory-hero-kg"
          style={{
            fontFamily: FontFamily.serifRegular,
            fontSize: 26,
            letterSpacing: -0.5,
            color: accent.primary,
            fontVariant: ["tabular-nums"],
          }}
        >
          {endKg}
          <Text style={{ fontFamily: FontFamily.sansSemibold, fontSize: 15, fontWeight: "600" }}>
            {" "}
            kg
          </Text>
        </Text>
        <Text
          testID="paywall-trajectory-when"
          style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginLeft: Spacing.sm }}
        >
          in ~{state.weeks} weeks
        </Text>
      </View>

      <Svg testID="paywall-trajectory-svg" width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="paywallTrajGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={accent.primary} stopOpacity="0.14" />
            <Stop offset="1" stopColor={accent.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Soft fill under the projection line. */}
        <Path d={areaPath} fill="url(#paywallTrajGrad)" />

        {/* Projected segment — dashed so it reads "estimate", not "fact". */}
        <Path
          d={projectedLine}
          stroke={accent.primary}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeDasharray="6 5"
          fill="none"
        />

        {/* "Now" anchor — solid dot at current weight. */}
        <Circle cx={x0} cy={y0} r={4.5} fill={accent.primary} />

        {/* Projected end — hollow ring (filled with card colour) = an estimate. */}
        <Circle cx={x1} cy={y1} r={5} fill={colors.card} stroke={accent.primary} strokeWidth={2} />
      </Svg>

      <Text style={[styles.basis, { color: colors.textSecondary }]}>
        If you keep your current pace — last 7 days averaged{" "}
        <Text style={{ color: colors.text, fontWeight: "700" }}>
          {state.avgCalories.toLocaleString()} kcal/day
        </Text>
        .
      </Text>
      <Text style={[styles.footnote, { color: colors.textTertiary }]}>
        Based on 7,700 kcal {"≈"} 1 kg. An estimate, not a promise.
      </Text>
    </SupprCard>
  );
}

/** Mobile data loader → feeds {@link PaywallTrajectoryChartView}. Reads the
 *  user's last-90-day food log + profile (weight, target, goal, TDEE inputs)
 *  in one round-trip. Renders nothing until the data resolves (and nothing
 *  ever, for a signed-out user or a user without a real projection). */
export function PaywallTrajectoryChart({ style }: { style?: ViewStyle }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [data, setData] = useState<{
    byDay: Record<string, { calories?: number | null }[]>;
    latestWeightKg: number | null;
    targetCalories: number;
    maintenanceTdeeKcal: number | null;
    goal: string | null;
  } | null>(null);

  useEffect(() => {
    if (!userId) {
      setData(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const ninetyDaysAgo = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 90);
        return d.toISOString().slice(0, 10);
      })();
      const [entriesRes, profileRes] = await Promise.all([
        supabase
          .from("nutrition_entries")
          .select("date_key, calories")
          .eq("user_id", userId)
          .gte("date_key", ninetyDaysAgo),
        supabase
          .from("profiles")
          .select(
            "target_calories, weight_kg, weight_kg_by_day, goal, sex, height_cm, age, activity_level, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at",
          )
          .eq("id", userId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const profile = profileRes.data as {
        target_calories?: number | null;
        weight_kg?: number | null;
        weight_kg_by_day?: Record<string, number> | null;
        goal?: string | null;
        sex?: string | null;
        height_cm?: number | null;
        age?: number | null;
        activity_level?: string | null;
        adaptive_tdee?: number | null;
        adaptive_tdee_confidence?: string | null;
        adaptive_tdee_updated_at?: string | null;
      } | null;
      const targetCalories = profile?.target_calories;
      if (entriesRes.error || profileRes.error || !profile || typeof targetCalories !== "number") {
        setData(null);
        return;
      }

      const byDay: Record<string, { calories?: number | null }[]> = {};
      for (const row of (entriesRes.data ?? []) as { date_key: string; calories: number | null }[]) {
        (byDay[row.date_key] ??= []).push({ calories: row.calories });
      }

      const weightKgByDay = (profile.weight_kg_by_day ?? {}) as Record<string, number>;
      const latestWeightKg = resolveLatestWeightKg(weightKgByDay, profile.weight_kg ?? null);

      // Maintenance TDEE via the shared resolver (adaptive when fresh + confident,
      // else Mifflin from profile). Falls back to null when inputs are incomplete
      // — `computeTrajectory` then uses its coarse goal-based estimate.
      let maintenanceTdeeKcal: number | null = null;
      if (
        profile.sex != null &&
        typeof profile.weight_kg === "number" &&
        typeof profile.height_cm === "number" &&
        typeof profile.age === "number" &&
        profile.activity_level != null
      ) {
        try {
          maintenanceTdeeKcal = getEffectiveTDEE({
            adaptive_tdee: profile.adaptive_tdee,
            adaptive_tdee_confidence: profile.adaptive_tdee_confidence,
            adaptive_tdee_updated_at: profile.adaptive_tdee_updated_at,
            sex: profile.sex,
            weight_kg: profile.weight_kg,
            height_cm: profile.height_cm,
            age: profile.age,
            activity_level: profile.activity_level,
          }).tdee;
        } catch {
          maintenanceTdeeKcal = null;
        }
      }

      setData({
        byDay,
        latestWeightKg,
        targetCalories,
        maintenanceTdeeKcal,
        goal: profile.goal ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!data) return null;

  return (
    <PaywallTrajectoryChartView
      byDay={data.byDay}
      latestWeightKg={data.latestWeightKg}
      targetCalories={data.targetCalories}
      maintenanceTdeeKcal={data.maintenanceTdeeKcal}
      goal={data.goal}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.lg,
  },
  cardInner: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  dot: { width: 7, height: 7, borderRadius: Radius.full },
  headlineRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: Spacing.sm,
  },
  basis: { ...Type.captionSmall, lineHeight: 18, marginTop: Spacing.sm },
  footnote: { fontSize: 10.5, marginTop: Spacing.sm },
});

export default PaywallTrajectoryChart;
