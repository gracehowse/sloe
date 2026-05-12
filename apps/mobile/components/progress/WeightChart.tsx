import { useMemo, useState } from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { Accent, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { WeightTrendResult } from "@/lib/progress/weightTrend";

// 2026-05-11 (Grace TF feedback — "looking squished on phone"):
// chart container shrunk 200→170 so it doesn't take up so much
// vertical real-estate in the card. Combined with the tighter
// Y-domain padding (computeYDomain), the data line now fills ~70%
// of the plot height vs ~50% before.
const CHART_HEIGHT = 170;
const PAD_TOP = 8;
const PAD_BOTTOM = 22;
const PAD_LEFT = 8;
const PAD_RIGHT = 48;

type Props = {
  trend: WeightTrendResult;
  goalKg: number | null;
  /**
   * F-125 v2 (Grace, 2026-05-07): when true, render values in lb +
   * suffix labels with " lb" instead of " kg". Internally the chart
   * still computes layout against kg (the trend payload is always kg),
   * just the displayed numbers are converted at the label-render step.
   * Default false preserves existing Progress-tab callers byte-for-byte.
   */
  isImperial?: boolean;
};

/** kg → lb at the canonical 2.20462 factor used elsewhere in mobile. */
function kgToLb(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

/** Display + unit suffix for a kg value. */
function formatWeight(kg: number, isImperial: boolean): string {
  const v = isImperial ? kgToLb(kg) : Math.round(kg * 10) / 10;
  return `${v.toFixed(1)} ${isImperial ? "lb" : "kg"}`;
}

function toX(i: number, count: number, plotW: number): number {
  if (count <= 1) return PAD_LEFT + plotW / 2;
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
    if (!mask[i]) {
      inSegment = false;
      continue;
    }
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

/**
 * 2026-05-06: derive x-axis tick labels from the bucket strategy.
 * Daily ranges (1W / 1M) show start + end dates only — too dense to
 * label every day. Weekly (3M) shows month labels at month boundaries.
 * Monthly (1Y / All) shows year/month labels at year boundaries (or
 * every other month for shorter spans within a year).
 *
 * Returns array of { label, position } where position is 0..1 along
 * the plot width, allowing the renderer to place the label
 * proportionally.
 */
function buildXAxisTicks(
  points: { dateISO: string }[],
  bucket: "daily" | "weekly" | "monthly",
): Array<{ label: string; position: number }> {
  const count = points.length;
  if (count < 2) return [];
  if (bucket === "daily") {
    return [
      {
        label: new Date(points[0]!.dateISO + "T12:00:00").toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
        position: 0,
      },
      {
        label: new Date(points[count - 1]!.dateISO + "T12:00:00").toLocaleDateString(
          "en-GB",
          { day: "numeric", month: "short" },
        ),
        position: 1,
      },
    ];
  }
  // For bucketed ranges: emit a tick whenever the month changes vs
  // the previous emitted tick. Cap at ~6 ticks to avoid overflow.
  const ticks: Array<{ label: string; position: number }> = [];
  let lastMonth = "";
  for (let i = 0; i < count; i++) {
    const month = points[i]!.dateISO.slice(0, 7);
    if (month !== lastMonth) {
      const d = new Date(points[i]!.dateISO + "T12:00:00");
      ticks.push({
        label: d.toLocaleDateString("en-GB", { month: "short" }),
        position: i / (count - 1),
      });
      lastMonth = month;
    }
  }
  // Decimate if too many.
  if (ticks.length > 6) {
    const stride = Math.ceil(ticks.length / 6);
    return ticks.filter((_, i) => i % stride === 0);
  }
  return ticks;
}

export function WeightChart({ trend, goalKg, isImperial = false }: Props) {
  const colors = useThemeColors();
  const [chartWidth, setChartWidth] = useState(300);
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  const { points, movingAvg, yDomain, bucket } = trend;
  const [yMin, yMax] = yDomain;
  const plotW = chartWidth - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const bottom = PAD_TOP + plotH;
  const count = points.length;

  const xs = useMemo(() => points.map((_, i) => toX(i, count, plotW)), [points, count, plotW]);
  const ys = useMemo(
    () => points.map((p) => toY(p.kg, yMin, yMax, plotH)),
    [points, yMin, yMax, plotH],
  );
  const maMask = useMemo(() => movingAvg.map((v) => v !== null), [movingAvg]);
  const maYs = useMemo(
    () => movingAvg.map((v) => (v !== null ? toY(v, yMin, yMax, plotH) : 0)),
    [movingAvg, yMin, yMax, plotH],
  );
  const xTicks = useMemo(() => buildXAxisTicks(points, bucket), [points, bucket]);

  const latestIdx = points.length - 1;
  const latestX = latestIdx >= 0 ? xs[latestIdx]! : 0;
  const latestY = latestIdx >= 0 ? ys[latestIdx]! : 0;
  const latestKg = latestIdx >= 0 ? points[latestIdx]!.kg : null;
  const latestDateISO = latestIdx >= 0 ? points[latestIdx]!.dateISO : null;

  const goalY = goalKg != null ? toY(goalKg, yMin, yMax, plotH) : null;
  // F-133 (`AFlB4oMfwQGIFx-w0DxOofE`, 2026-05-08): when computeYDomain
  // excluded the goal because it was too far from data, goalY falls
  // outside the plot area. Render an edge chip indicating direction
  // so the goal stays visible (vs disappearing entirely).
  const goalIsBelowChart = goalY != null && goalY > PAD_TOP + plotH;
  const goalIsAboveChart = goalY != null && goalY < PAD_TOP;
  const goalIsOffChart = goalIsBelowChart || goalIsAboveChart;

  const lineColor =
    trend.trendDirection === "worsening" ? Accent.warning : Accent.primary;

  // 2026-05-11 (mockup signed off): 4 gridlines + their Y-axis
  // labels, evenly spaced from yMax to yMin so the user has a finer
  // visual scale to read against (was 3 internal lines, looked sparse
  // on Withings-style cards).
  const gridValues = [
    yMin + (yMax - yMin) * 0.85,
    yMin + (yMax - yMin) * 0.6,
    yMin + (yMax - yMin) * 0.35,
    yMin + (yMax - yMin) * 0.1,
  ];

  /**
   * 2026-05-06: tap-and-drag scrubber. Maps the touch x-coord to the
   * nearest bucket index so the user can read the date + kg at any
   * point along the line, MFP-style. Active when the user is touching
   * the chart; releases on touch-end.
   */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => count >= 2,
        onMoveShouldSetPanResponder: () => count >= 2,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const x = e.nativeEvent.locationX;
          const idx = nearestIndex(x, plotW, count);
          setScrubIdx(idx);
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const x = e.nativeEvent.locationX;
          const idx = nearestIndex(x, plotW, count);
          setScrubIdx(idx);
        },
        onPanResponderRelease: () => setScrubIdx(null),
        onPanResponderTerminate: () => setScrubIdx(null),
      }),
    [count, plotW],
  );

  /**
   * 2026-05-06: bucket-aware label for floating tag. Daily renders
   * "76.2 · Today" (or "Yesterday" / weekday for ≤6 days back) based
   * on the actual latest entry's date — was hardcoded to "Today"
   * regardless of when the entry was logged. Bucketed renders show
   * "76.2 · w/c 5 May" or "76.2 · May" so the user knows the bar is
   * an aggregate, not a single weigh-in.
   */
  const latestCaption = useMemo(() => {
    if (latestKg == null || latestDateISO == null) return null;
    const date = new Date(latestDateISO + "T12:00:00");
    const valueStr = formatWeight(latestKg, isImperial);
    if (bucket === "monthly") {
      return `${valueStr} · ${date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}`;
    }
    if (bucket === "weekly") {
      return `${valueStr} · w/c ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    }
    // Daily — relative if recent, otherwise short date.
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return `${valueStr} · Today`;
    if (diffDays === 1) return `${valueStr} · Yesterday`;
    if (diffDays > 0 && diffDays < 7) {
      return `${valueStr} · ${date.toLocaleDateString("en-GB", { weekday: "short" })}`;
    }
    return `${valueStr} · ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  }, [latestKg, latestDateISO, bucket, isImperial]);

  /**
   * 2026-05-06: avoid goal-line label colliding with grid labels.
   * If the goal is within ~7 px of a grid value, push the label up
   * by 8 px so it's still readable.
   */
  const goalLabelY = useMemo(() => {
    if (goalY == null) return null;
    for (const v of gridValues) {
      const gy = toY(v, yMin, yMax, plotH);
      if (Math.abs(gy - goalY) < 7) return goalY - 8;
    }
    return goalY + 4;
  }, [goalY, gridValues, yMin, yMax, plotH]);

  const scrubPoint = scrubIdx != null && points[scrubIdx] ? points[scrubIdx] : null;
  const scrubMa = scrubIdx != null ? movingAvg[scrubIdx] : null;

  return (
    <View
      onLayout={onLayout}
      style={{ height: CHART_HEIGHT + 24 }}
      {...panResponder.panHandlers}
    >
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.12" />
            <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Gridlines — 2026-05-12 (Grace TF chart polish): solid
            hairlines at 0.5 alpha replace the dashed pattern.
            Withings ships solid horizontal hairlines, never dashed —
            dashed gridlines read busy at small chart heights. */}
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
              opacity={0.5}
            />
          );
        })}

        {/* Grid labels (right-aligned inside plot) */}
        {gridValues.map((v, i) => {
          const gy = toY(v, yMin, yMax, plotH);
          // F-125 v2: convert to lb when imperial. No unit suffix on
          // gridlines (already implied by the `Goal X.X lb` line + the
          // floating latest pill); avoids label overflow into PAD_RIGHT.
          const display = isImperial ? kgToLb(v) : Math.round(v * 10) / 10;
          return (
            <SvgText
              key={i}
              x={chartWidth - PAD_RIGHT + 6}
              y={gy + 4}
              fontSize={10}
              fill={colors.textTertiary}
              textAnchor="start"
            >
              {display.toFixed(1)}
            </SvgText>
          );
        })}

        {/* Goal line — only when the goal sits inside the visible
            data domain. F-133: when goal is far from data, the line
            is replaced by an off-chart edge chip below (or above) so
            the data line uses the full plot height. */}
        {goalY != null && goalKg != null && goalLabelY != null && !goalIsOffChart && (
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
              y={goalLabelY}
              fontSize={10}
              fill={colors.textSecondary}
              textAnchor="start"
            >
              {`Goal ${formatWeight(goalKg, isImperial)}`}
            </SvgText>
          </>
        )}

        {/* 2026-05-11 (Grace TF feedback — chart "messy / illogical"):
            the F-133 off-chart goal indicator was rendering as a
            floating "Goal X kg ↓" string near the bottom-right of the
            plot, with no visual anchor. Looked unmoored and confused
            the chart-reader. Dropped entirely — the goal weight is
            already visible in Today / Settings / Onboarding, and
            when the goal is far from data the in-chart goal line is
            already suppressed by computeYDomain. */}

        {/* MA area fill */}
        {count >= 3 && (
          <Path
            d={buildAreaPath(xs, maYs, maMask, bottom)}
            fill="url(#areaGrad)"
          />
        )}

        {/* MA line — 2026-05-12 (Grace TF chart polish): 2.0pt → 2.25pt
            for more presence at small chart heights. The smoothed line
            is the headline element of this chart; Withings's spec is
            ~2pt and ours was just under it. */}
        {count >= 3 && (
          <Path
            d={buildLinePath(xs, maYs, maMask)}
            stroke={lineColor}
            strokeWidth={2.25}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/*
          Raw dots — 2026-05-06: only rendered for `daily` bucket. On
          weekly / monthly each point IS already an aggregate, so
          rendering them as dots smudges into a blob and misleads
          (looks like raw weigh-ins). MFP shows just the smoothed line
          on long ranges.
        */}
        {/* 2026-05-11 (mockup signed off): sparse raw dots when there
            are 14+ daily points. The smoothed line carries the story;
            dots become sample markers, not noise. `stride` makes sure
            we keep the first + last + roughly 6 evenly-spaced dots in
            between, plus the actively-scrubbed point regardless. */}
        {/* Raw dots — 2026-05-12 (Grace TF chart polish): solid filled
            dots in the line colour at 35% alpha instead of hollow
            rings. Withings pattern: filled markers carry less visual
            weight than rings AND keep the dot reading "data point",
            not "interactive target". Smaller (r=3) and lower opacity
            so the smoothed line stays the headline element. Scrubbed
            dot stays r=5 + full opacity as the active anchor. */}
        {bucket === "daily" &&
          points.map((p, i) => {
            if (i === latestIdx) return null;
            const isScrubbed = scrubIdx === i;
            const stride = count > 14 ? Math.ceil(count / 6) : 1;
            const keep = isScrubbed || i === 0 || i % stride === 0;
            if (!keep) return null;
            return (
              <Circle
                key={p.dateISO + i}
                cx={xs[i]!}
                cy={ys[i]!}
                r={isScrubbed ? 5 : 3}
                fill={lineColor}
                opacity={isScrubbed ? 1 : 0.35}
              />
            );
          })}

        {/* Scrubber crosshair (active during pan) */}
        {scrubIdx != null && scrubPoint != null && (
          <>
            <Line
              x1={xs[scrubIdx]!}
              y1={PAD_TOP}
              x2={xs[scrubIdx]!}
              y2={bottom}
              stroke={colors.textTertiary}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <Circle
              cx={xs[scrubIdx]!}
              cy={ys[scrubIdx]!}
              r={5}
              fill={lineColor}
              stroke={colors.card}
              strokeWidth={2}
            />
          </>
        )}

        {/* Latest dot — prominent with halo ring (Withings parity).
            Soft outer ring (radius 10, 16% alpha) behind a solid
            smaller dot (radius 5) — emphasises "you are here". */}
        {latestIdx >= 0 && (
          <>
            <Circle cx={latestX} cy={latestY} r={10} fill={lineColor} opacity={0.16} />
            <Circle cx={latestX} cy={latestY} r={5} fill={lineColor} />
          </>
        )}

        {/* X-axis tick marks (calendar-aware) */}
        {xTicks.map((t, i) => {
          const tx = PAD_LEFT + t.position * plotW;
          return (
            <SvgText
              key={`tick-${i}`}
              x={tx}
              y={CHART_HEIGHT - 8}
              fontSize={10}
              fill={colors.textTertiary}
              textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            >
              {t.label}
            </SvgText>
          );
        })}

        {/* Tap-target overlay — captures pan but doesn't render */}
        <Rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={plotW}
          height={plotH}
          fill="transparent"
        />
      </Svg>

      {/* 2026-05-11 (Grace TF feedback — chart "messy / illogical"):
          The floating tooltip and scrubber tooltip had two collision
          problems:
            1. `left: latestX - 36` is a guessed half-width that
               doesn't center the actual text — text wider than 72px
               sits right-of-center.
            2. `top: latestY - 28` clamped at 0 — when the latest dot
               is near the top of the plot, the tooltip pins to y=0
               and overlaps the Y-axis labels.
          Both labels now:
            - center horizontally using a fixed approximate width
              with `clampX` to stay inside the plot bounds
            - position vertically using a "flip" — above the dot when
              there's room, below the dot when there isn't
            - never extend into the right gutter where the Y-axis
              ticks live */}
      {(() => {
        const showScrub = scrubIdx != null && scrubPoint != null;
        const showLatest = !showScrub && latestCaption != null;
        if (!showScrub && !showLatest) return null;
        const TOOLTIP_W = 130;
        const TOOLTIP_H = 22;
        const anchorX = showScrub ? xs[scrubIdx!]! : latestX;
        const anchorY = showScrub ? ys[scrubIdx!]! : latestY;
        // 2026-05-12 (Grace TF chart polish): bump the clearance gap
        // from 6/12px to 14px so the tooltip never crowds the line
        // it's anchored to. Withings's spec is a ~12pt clear floating
        // pill; tightening this was the audit gap.
        const GAP = 14;
        const flipBelow = anchorY - TOOLTIP_H - GAP < PAD_TOP;
        const tipTop = flipBelow ? anchorY + GAP : anchorY - TOOLTIP_H - GAP;
        // Right gutter (where the Y-axis tick labels live) starts at
        // `chartWidth - PAD_RIGHT`. Keep the tooltip's right edge at
        // least 4px left of that line so the text never overlaps.
        const maxLeft = chartWidth - PAD_RIGHT - TOOLTIP_W - 4;
        const tipLeft = clampX(anchorX - TOOLTIP_W / 2, Math.max(0, maxLeft));
        const text = showScrub
          ? `${formatWeight(scrubPoint!.kg, isImperial)} · ${formatScrubDate(scrubPoint!.dateISO, bucket)}${scrubMa != null ? `  ·  avg ${(isImperial ? kgToLb(scrubMa) : Math.round(scrubMa * 10) / 10).toFixed(1)}` : ""}`
          : latestCaption!;
        return (
          <View
            style={[
              styles.floatingLabel,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                left: tipLeft,
                top: tipTop,
                width: TOOLTIP_W,
              },
            ]}
            pointerEvents="none"
          >
            <Text
              style={[styles.floatingText, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {text}
            </Text>
          </View>
        );
      })()}
    </View>
  );
}

function nearestIndex(touchX: number, plotW: number, count: number): number {
  if (count <= 1) return 0;
  const ratio = (touchX - PAD_LEFT) / plotW;
  const clamped = Math.max(0, Math.min(1, ratio));
  return Math.round(clamped * (count - 1));
}

function clampX(x: number, max: number): number {
  return Math.max(0, Math.min(max, x));
}

function formatScrubDate(
  dateISO: string,
  bucket: "daily" | "weekly" | "monthly",
): string {
  const d = new Date(dateISO + "T12:00:00");
  if (bucket === "monthly") {
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  }
  if (bucket === "weekly") {
    return `w/c ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  }
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
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
    textAlign: "center",
  },
});
