import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, Spacing } from "@/constants/theme";

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

// 2026-05-22 evening (Grace): ring shrunk from 120 → 64 and pulled
// out of its bordered card wrapper. "Ring at the top seems way too
// intrusive" — at 120 it dominated the whole Progress viewport and
// out-shouted the charts that should lead the page. New scale lets
// the ring sit inline as a status badge next to the stat line, not
// a hero element. Stroke trimmed 8 → 5 to match the smaller radius.
const RING_SIZE = 64;
const STROKE = 5;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// 2026-05-22 evening (Grace): ring tone now mirrors Today's calorie
// ring — green when in 90-110%, red when over, green-when-under.
// Owns one rule across both rings instead of Today saying green/red
// and Progress saying green/amber.
function adherenceTone(pct: number): { color: string; label: string } {
  if (pct >= 90 && pct <= 110) {
    return { color: Accent.success, label: "On target" };
  }
  if (pct < 90) {
    return { color: Accent.success, label: "Under target" };
  }
  // Over (> 110%) — red, owning the same green/red rule Today uses.
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
          paddingVertical: Spacing.md,
          marginBottom: Spacing.md,
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

  // 2026-05-22 evening (Grace): inline horizontal layout — ring on
  // left, stack on right (adherence label + %, stat line below). No
  // bordered card wrapper. Sits flush on the page so the charts
  // below lead the visual hierarchy.
  return (
    <View
      testID="progress-hero-metric"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        marginBottom: Spacing.md,
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
            fontSize: 14,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
            color: tone.color,
          }}
        >
          {adherencePct}%
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
          {tone.label}
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: colors.textTertiary,
            fontVariant: ["tabular-nums"],
          }}
          numberOfLines={1}
        >
          {statLine.join("  ·  ")}
        </Text>
      </View>
    </View>
  );
}
