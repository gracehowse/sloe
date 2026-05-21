import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, Radius, Spacing } from "@/constants/theme";

/**
 * ProgressHeroMetric — Oura-style "one big thing" for the Progress tab.
 *
 * ENG-616: single dominant metric with ring gauge showing calorie
 * adherence for the selected time range.
 *
 * Mirror: `src/app/components/suppr/progress-hero-metric.tsx` (web).
 */

export interface ProgressHeroMetricProps {
  adherencePct: number | null;
  avgCaloriesPerDay: number | null;
  targetCalories: number;
  daysLogged: number;
  streak: number;
}

const RING_SIZE = 120;
const STROKE = 8;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function adherenceTone(pct: number): { color: string; label: string } {
  if (pct >= 90 && pct <= 110) {
    return { color: Accent.success, label: "On target" };
  }
  if (pct < 90 && pct >= 75) {
    return { color: Accent.warning, label: "Under target" };
  }
  if (pct < 75) {
    return { color: Accent.warning, label: "Under target" };
  }
  // Over target (>110%) is always destructive red
  return { color: Accent.destructive, label: "Over target" };
}

export function ProgressHeroMetric({
  adherencePct,
  avgCaloriesPerDay,
  targetCalories,
  daysLogged,
  streak,
}: ProgressHeroMetricProps) {
  const colors = useThemeColors();

  if (adherencePct == null || daysLogged === 0) {
    return (
      <View
        testID="progress-hero-metric"
        style={{
          alignItems: "center",
          paddingVertical: 24,
          marginBottom: 14,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          backgroundColor: colors.card,
        }}
      >
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          Log meals on Today to see your score here.
        </Text>
      </View>
    );
  }

  const clamped = Math.min(adherencePct, 150);
  const fillPct = Math.min(clamped / 100, 1);
  const offset = CIRCUMFERENCE * (1 - fillPct);
  const tone = adherenceTone(adherencePct);

  const statLine: string[] = [];
  if (avgCaloriesPerDay != null) {
    statLine.push(`${avgCaloriesPerDay.toLocaleString()} avg/day`);
  }
  statLine.push(`Target ${targetCalories.toLocaleString()}`);
  if (streak > 0) {
    statLine.push(`${streak}-day streak`);
  }

  return (
    <View
      testID="progress-hero-metric"
      style={{
        alignItems: "center",
        paddingVertical: 24,
        marginBottom: 14,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        backgroundColor: colors.card,
      }}
    >
      <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" }}>
        <Svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
        >
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={colors.border}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={tone.color}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE}`}
            strokeDashoffset={offset}
          />
        </Svg>
        <Text
          testID="progress-hero-pct"
          style={{
            fontSize: 28,
            fontWeight: "800",
            fontVariant: ["tabular-nums"],
            color: tone.color,
          }}
        >
          {adherencePct}%
        </Text>
      </View>

      <Text style={{ marginTop: 8, fontSize: 13, fontWeight: "600", color: tone.color }}>
        {tone.label}
      </Text>

      <Text
        style={{
          marginTop: Spacing.sm,
          fontSize: 11,
          color: colors.textTertiary,
          fontVariant: ["tabular-nums"],
        }}
      >
        {statLine.join("  ·  ")}
      </Text>
    </View>
  );
}
