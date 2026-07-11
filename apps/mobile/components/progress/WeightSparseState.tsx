import { Text, View } from "react-native";
import { Scale } from "lucide-react-native";
import { FontFamily, Spacing, Radius, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprButton } from "@/components/ui/SupprButton";
import type { WeightPoint } from "@/lib/progress/weightTrend";
import Svg, { Circle, Line } from "react-native-svg";

type Props = {
  points: WeightPoint[];
  goalKg?: number | null;
  onLogWeight: () => void;
};

// ENG-1372 slice 2 — the weight chart-frame ALWAYS renders (law 1: no
// hero at zero visual weight). These constants keep the sparse-state
// plot geometry legible without pulling in the full WeightChart (which
// requires >=2 points for its toX/toY maths). The frame is intentionally
// simpler than the canonical chart — an axis baseline, an optional goal
// band, and (at 1 point) a dotted projection line toward the goal.
const FRAME_WIDTH = 260;
const FRAME_HEIGHT = 120;
const FRAME_PAD_X = 24;
const FRAME_PAD_TOP = 16;
const FRAME_PAD_BOTTOM = 28;

export function WeightSparseState({ points, goalKg, onLogWeight }: Props) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the Log-weight CTAs
  // and the sparse data-point stroke.
  const accent = useAccent();

  const plotTop = FRAME_PAD_TOP;
  const plotBottom = FRAME_HEIGHT - FRAME_PAD_BOTTOM;
  const plotLeft = FRAME_PAD_X;
  const plotRight = FRAME_WIDTH - FRAME_PAD_X;

  if (points.length === 0) {
    // 0 weigh-ins — ALWAYS render the chart frame (axis + optional goal
    // band); the invitation sits INSIDE the plot area (law 2: one filled
    // action inside the hero, not floating beside a ghost of the data).
    const goalY = goalKg != null ? plotTop + (plotBottom - plotTop) * 0.25 : null;
    return (
      <View
        testID="weight-sparse-state"
        style={[styles.frameContainer, { backgroundColor: colors.backgroundSecondary }]}
      >
        <Svg width={FRAME_WIDTH} height={FRAME_HEIGHT}>
          {/* Baseline axis */}
          <Line
            x1={plotLeft}
            y1={plotBottom}
            x2={plotRight}
            y2={plotBottom}
            stroke={colors.border}
            strokeWidth={1}
          />
          {/* Goal band — a dashed reference line, shown whenever a goal is
              set, so the empty frame still orients the user toward it. */}
          {goalY != null ? (
            <Line
              x1={plotLeft}
              y1={goalY}
              x2={plotRight}
              y2={goalY}
              stroke={colors.textTertiary}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ) : null}
        </Svg>
        {goalKg != null ? (
          <Text style={[styles.goalCaption, { color: colors.textTertiary, top: (goalY ?? 0) - 14 }]}>
            Goal {goalKg.toFixed(1)} kg
          </Text>
        ) : null}
        <View style={styles.ctaOverlay} pointerEvents="box-none">
          <Scale size={22} color={colors.textTertiary} strokeWidth={1.5} />
          {/* fit-and-finish (Grace 2026-07-11): compact in-frame CTA — the
              full-size pill dwarfed the chart frame. */}
          <SupprButton
            variant="primary"
            size="sm"
            label="Log your first weigh-in"
            onPress={onLogWeight}
            style={{ marginTop: Spacing.sm, alignSelf: "center" }}
          />
        </View>
      </View>
    );
  }

  if (points.length === 1) {
    // 1 weigh-in — the single point PLUS a dotted projection line toward the
    // goal marker (contract: "the point + dotted projection toward the goal
    // marker"). No trend claim yet — "unlocks" framing, not a verdict.
    const kg = points[0]!.kg;
    const pointX = plotLeft + (plotRight - plotLeft) * 0.22;
    const pointY = plotTop + (plotBottom - plotTop) * 0.55;
    const hasGoal = goalKg != null;
    // Projection direction is purely illustrative (toward the goal side of
    // the point) — no data-driven slope exists yet with a single point.
    const goalY = hasGoal
      ? pointY + (goalKg! < kg ? (plotBottom - plotTop) * 0.28 : -(plotBottom - plotTop) * 0.28)
      : pointY;
    const clampedGoalY = Math.max(plotTop, Math.min(plotBottom, goalY));

    return (
      <View
        testID="weight-sparse-state"
        style={[styles.frameContainer, { backgroundColor: colors.backgroundSecondary }]}
      >
        <Svg width={FRAME_WIDTH} height={FRAME_HEIGHT}>
          <Line
            x1={plotLeft}
            y1={plotBottom}
            x2={plotRight}
            y2={plotBottom}
            stroke={colors.border}
            strokeWidth={1}
          />
          {hasGoal ? (
            <Line
              x1={pointX}
              y1={pointY}
              x2={plotRight}
              y2={clampedGoalY}
              stroke={accent.primary}
              strokeWidth={1.5}
              strokeDasharray="3 4"
              strokeOpacity={0.6}
            />
          ) : null}
          <Circle cx={pointX} cy={pointY} r={5} fill={colors.card} stroke={accent.primary} strokeWidth={2} />
        </Svg>
        <Text
          style={[styles.pointLabel, { color: colors.text, left: pointX - 30, top: pointY - 34 }]}
        >
          {kg.toFixed(1)}
          <Text style={{ fontFamily: FontFamily.sansBold, fontSize: 11, fontWeight: "700" }}> kg</Text>
        </Text>
        <View style={styles.captionOverlay}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            One more weigh-in unlocks your trend.
          </Text>
          {/* fit-and-finish (Grace 2026-07-11): compact in-frame CTA — the
              full-size pill dwarfed the chart frame. */}
          <SupprButton
            variant="primary"
            size="sm"
            label="Log weight"
            onPress={onLogWeight}
            style={{ marginTop: Spacing.sm, alignSelf: "center" }}
          />
        </View>
      </View>
    );
  }

  // Fallback — 2+ points should never reach this component (the host mounts
  // the canonical WeightChart once points.length >= 2), but keep a inert
  // render rather than crashing if a caller regresses the gate.
  return null;
}

const styles = {
  frameContainer: {
    borderRadius: Radius.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    alignItems: "center" as const,
    overflow: "hidden" as const,
  },
  ctaOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: FRAME_PAD_BOTTOM,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: Spacing.xs,
  },
  captionOverlay: {
    alignItems: "center" as const,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  goalCaption: {
    position: "absolute" as const,
    right: FRAME_PAD_X,
    fontSize: 10,
  },
  pointLabel: {
    position: "absolute" as const,
    fontFamily: FontFamily.serifRegular,
    fontSize: 16,
    fontVariant: ["tabular-nums" as const],
    width: 70,
    textAlign: "center" as const,
  },
  headline: {
    fontFamily: Type.bodyLarge.fontFamily,
    fontSize: Type.bodyLarge.fontSize,
    lineHeight: Type.bodyLarge.lineHeight,
    fontWeight: "600" as const,
    textAlign: "center" as const,
  },
  body: {
    fontSize: 13,
    textAlign: "center" as const,
    lineHeight: 18,
  },
};

export default WeightSparseState;
