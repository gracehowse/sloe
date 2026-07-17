import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, Spacing } from "@/constants/theme";
import { formatAdherenceHeadline } from "@suppr/nutrition-core/adherenceDisplay";

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
  /**
   * Sloe Figma 492:2 — per-day on-target booleans for the dot ribbon
   * (filled sage = logged at/under the day's effective budget, hollow =
   * off-target or unlogged). Real days from `weekStatsBundle.days`; never
   * fabricated. Optional so legacy callers keep the dot-less hero. Web
   * mirror: `src/app/components/suppr/progress-hero-metric.tsx`.
   */
  onTargetDays?: boolean[];
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

// 2026-05-22 evening (Grace): ring tone mirrors Today's calorie ring —
// green when in 90-110%, green-when-under. ENG-1296 (2026-07-01
// re-ratification): over-target is the AMBER warning family product-wide —
// the dossier D-2 destructive-red carve-out is RETIRED (matches ENG-1431
// and `Accent.warning` in ProgressAverageAdherence's over-budget bars).
function adherenceTone(pct: number): { color: string; label: string } {
  if (pct >= 90 && pct <= 110) {
    return { color: Accent.success, label: "On target" };
  }
  if (pct < 90) {
    return { color: Accent.success, label: "Under target" };
  }
  // Over (> 110%) — amber, never red (ENG-1296).
  return { color: Accent.warning, label: "Over target" };
}

export function ProgressHeroMetric({
  adherencePct,
  avgCaloriesPerDay,
  targetCalories,
  daysLogged,
  streak,
  onTargetDays,
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
  // Audit P1-3 (ENG-1073): above the 110% band the ring centre-number
  // flips to an overshoot reading ("11% over", amber) so a >100% figure
  // can't read as a *better* score. Ring fill geometry + the supporting
  // "Over target" label are unchanged, and the ≤110% path is untouched.
  // Mirror: web.
  const overDisplay =
    adherencePct > 110 ? formatAdherenceHeadline(adherencePct) : null;

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
            // Over target: amber overshoot ("11% over") instead of the raw
            // "111%". Else = the tone colour (amber over / sage on/under —
            // ENG-1296: never red).
            color: overDisplay ? Accent.warning : tone.color,
          }}
        >
          {overDisplay ? `${overDisplay.value}${overDisplay.suffix}` : `${adherencePct}%`}
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
        {/* Sloe Figma 492:2 — on-target days ribbon. Filled sage dot = a
            logged day at/under its effective budget; hollow border dot =
            off-target or unlogged. Renders only the real days the host
            supplies (no fabricated days). */}
        {onTargetDays && onTargetDays.length > 0 ? (
          <View
            testID="progress-hero-ontarget-dots"
            accessibilityLabel={`${onTargetDays.filter(Boolean).length} of ${onTargetDays.length} days on target`}
            style={{ flexDirection: "row", gap: Spacing.sm, marginTop: 4 }}
          >
            {onTargetDays.map((on, i) => (
              <View
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: on ? Accent.success : colors.border,
                }}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
