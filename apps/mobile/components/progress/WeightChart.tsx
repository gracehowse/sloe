import { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { Accent, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { WeightPoint, WeightTrendResult } from "@/lib/progress/weightTrend";

const CHART_HEIGHT = 180;
const PAD_TOP = 12;
const PAD_BOTTOM = 20;
const PAD_LEFT = 8;
const PAD_RIGHT = 48;

type Props = {
  trend: WeightTrendResult;
  goalKg: number | null;
};

function toX(i: number, count: number, plotW: number): number {
  if (count <= 1) return plotW / 2;
  return PAD_LEFT + (i / (count - 1)) * plotW;
}

function toY(kg: number, yMin: number, yMax: number, plotH: number): number {
  const span = yMax - yMin || 1;
  return PAD_TOP + plotH - ((kg - yMin) / span) * plotH;
}

function buildLinePath(
  xs: number[],
  ys: number[],
  mask: boolean[],
): string {
  let d = "";
  let inSegment = false;
  for (let i = 0; i < xs.length; i++) {
    if (!mask[i]) { inSegment = false; continue; }
    if (!inSegment) {
      d += `M ${xs[i]!.toFixed(1)} ${ys[i]!.toFixed(1)} `;
      inSegment = true;
    } else {
      d += `L ${xs[i]!.toFixed(1)} ${ys[i]!.toFixed(1)} `;
    }
  }
  return d.trim();
}

function buildAreaPath(
  xs: number[],
  ys: number[],
  mask: boolean[],
  bottom: number,
): string {
  const validIdx = xs.map((_, i) => i).filter((i) => mask[i]);
  if (validIdx.length < 2) return "";
  const first = validIdx[0]!;
  const last = validIdx[validIdx.length - 1]!;
  let d = `M ${xs[first]!.toFixed(1)} ${ys[first]!.toFixed(1)} `;
  for (const i of validIdx.slice(1)) {
    d += `L ${xs[i]!.toFixed(1)} ${ys[i]!.toFixed(1)} `;
  }
  d += `L ${xs[last]!.toFixed(1)} ${bottom.toFixed(1)} `;
  d += `L ${xs[first]!.toFixed(1)} ${bottom.toFixed(1)} Z`;
  return d;
}

export function WeightChart({ trend, goalKg }: Props) {
  const colors = useThemeColors();
  const [chartWidth, setChartWidth] = useState(300);

  const onLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  const { points, movingAvg, yDomain } = trend;
  const [yMin, yMax] = yDomain;
  const plotW = chartWidth - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const bottom = PAD_TOP + plotH;
  const count = points.length;

  const xs = points.map((_, i) => toX(i, count, plotW));
  const ys = points.map((p) => toY(p.kg, yMin, yMax, plotH));
  const maMask = movingAvg.map((v) => v !== null);
  const maYs = movingAvg.map((v) => (v !== null ? toY(v, yMin, yMax, plotH) : 0));

  const latestIdx = points.length - 1;
  const latestX = latestIdx >= 0 ? xs[latestIdx]! : 0;
  const latestY = latestIdx >= 0 ? ys[latestIdx]! : 0;
  const latestKg = latestIdx >= 0 ? points[latestIdx]!.kg : null;

  const goalY = goalKg != null ? toY(goalKg, yMin, yMax, plotH) : null;

  const lineColor =
    trend.trendDirection === "worsening" ? Accent.warning : Accent.primary;

  // 3 horizontal gridlines
  const gridValues = [
    yMin + (yMax - yMin) * 0.25,
    yMin + (yMax - yMin) * 0.5,
    yMin + (yMax - yMin) * 0.75,
  ];

  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);

  return (
    <View onLayout={onLayout} style={{ height: CHART_HEIGHT + 24 }}>
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.12" />
            <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Gridlines */}
        {gridValues.map((v, i) => {
          const gy = toY(v, yMin, yMax, plotH);
          return (
            <Line
              key={i}
              x1={PAD_LEFT}
              y1={gy}
              x2={chartWidth - PAD_RIGHT + 4}
              y2={gy}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Grid labels (right-aligned inside plot) */}
        {gridValues.map((v, i) => {
          const gy = toY(v, yMin, yMax, plotH);
          return (
            <SvgText
              key={i}
              x={chartWidth - PAD_RIGHT + 6}
              y={gy + 4}
              fontSize={10}
              fill={colors.textTertiary}
              textAnchor="start"
            >
              {v.toFixed(1)}
            </SvgText>
          );
        })}

        {/* Goal line */}
        {goalY != null && goalKg != null && (
          <>
            <Line
              x1={PAD_LEFT}
              y1={goalY}
              x2={chartWidth - PAD_RIGHT}
              y2={goalY}
              stroke={colors.textSecondary}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <SvgText
              x={chartWidth - PAD_RIGHT + 6}
              y={goalY + 4}
              fontSize={10}
              fill={colors.textSecondary}
              textAnchor="start"
            >
              {`Goal ${goalKg.toFixed(1)}`}
            </SvgText>
          </>
        )}

        {/* MA area fill */}
        {count >= 3 && (
          <Path
            d={buildAreaPath(xs, maYs, maMask, bottom)}
            fill="url(#areaGrad)"
          />
        )}

        {/* MA line */}
        {count >= 3 && (
          <Path
            d={buildLinePath(xs, maYs, maMask)}
            stroke={lineColor}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Raw dots (4px, accent stroke, 60% opacity) */}
        {points.map((p, i) => {
          if (i === latestIdx) return null;
          const isPinned = pinnedIdx === i;
          return (
            <Circle
              key={p.dateISO + i}
              cx={xs[i]!}
              cy={ys[i]!}
              r={isPinned ? 5 : 4}
              fill={colors.card}
              stroke={lineColor}
              strokeWidth={1.5}
              opacity={0.6}
              onPress={() => setPinnedIdx(isPinned ? null : i)}
            />
          );
        })}

        {/* Latest dot — prominent */}
        {latestIdx >= 0 && (
          <Circle
            cx={latestX}
            cy={latestY}
            r={8}
            fill={lineColor}
            onPress={() => setPinnedIdx(pinnedIdx === latestIdx ? null : latestIdx)}
          />
        )}
      </Svg>

      {/* Floating latest label */}
      {latestKg != null && pinnedIdx === null && (
        <View
          style={[
            styles.floatingLabel,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              left: Math.max(0, latestX - 30),
              top: latestY - 28,
            },
          ]}
        >
          <Text style={[styles.floatingText, { color: colors.text }]}>
            {latestKg.toFixed(1)} · Today
          </Text>
        </View>
      )}

      {/* Pinned caption */}
      {pinnedIdx !== null && points[pinnedIdx] && (
        <View
          style={[
            styles.floatingLabel,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              left: Math.max(0, xs[pinnedIdx]! - 40),
              top: Math.max(0, ys[pinnedIdx]! - 28),
            },
          ]}
        >
          <Text style={[styles.floatingText, { color: colors.text }]}>
            {`${points[pinnedIdx]!.kg.toFixed(1)} kg · ${new Date(points[pinnedIdx]!.dateISO + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`}
          </Text>
        </View>
      )}

      {/* X-axis date labels */}
      {count >= 2 && (
        <View style={[styles.xAxis, { width: chartWidth - PAD_LEFT - PAD_RIGHT, marginLeft: PAD_LEFT }]}>
          <Text style={[styles.axisLabel, { color: colors.textTertiary }]}>
            {new Date(points[0]!.dateISO + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </Text>
          <Text style={[styles.axisLabel, { color: colors.textTertiary }]}>
            {new Date(points[count - 1]!.dateISO + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  floatingLabel: {
    position: "absolute",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  floatingText: {
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  axisLabel: {
    fontSize: 10,
  },
});
