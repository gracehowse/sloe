import { useEffect, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import * as Haptics from "expo-haptics";

import { Accent } from "@/constants/theme";

type DataPoint = { label: string; value: number };

type Props = {
  data: DataPoint[];
  goalValue?: number;
  projectedData?: DataPoint[];
  color: string;
  /** Chart height in px. Default 180. */
  height?: number;
  labelColor: string;
  goalColor?: string;
  trackColor: string;
  /** When set, tap-to-inspect shows this string for the selected point. */
  formatValue?: (value: number) => string;
};

export default function TrendLine({
  data,
  goalValue,
  projectedData,
  color,
  height = 180,
  labelColor,
  goalColor,
  trackColor,
  formatValue,
}: Props) {
  const [chartWidthPx, setChartWidthPx] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(() =>
    Math.max(0, data.length - 1),
  );

  const dataSig = data.map((d) => `${d.label}:${d.value}`).join("|");

  useEffect(() => {
    if (data.length > 0) {
      setSelectedIndex(data.length - 1);
    }
  }, [dataSig, data.length]);

  if (data.length === 0) return null;

  const allValues = [
    ...data.map((d) => d.value),
    ...(projectedData?.map((d) => d.value) ?? []),
    ...(goalValue != null ? [goalValue] : []),
  ];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  // Ensure at least 2 units of visible range so small changes don't look exaggerated
  const padding = Math.max((rawMax - rawMin) * 0.08, 1);
  const minVal = rawMin - padding;
  const maxVal = rawMax + padding;
  const range = maxVal - minVal || 1;

  const chartH = height - 24;
  const viewW = 200;
  const paddingX = 4;
  const usableW = viewW - paddingX * 2;

  const totalPts = data.length + (projectedData?.length ?? 0);
  const stepX = totalPts > 1 ? usableW / (totalPts - 1) : usableW;

  function toY(v: number) {
    return chartH - ((v - minVal) / range) * chartH;
  }

  const points = data.map(
    (d, i) => `${paddingX + i * stepX},${toY(d.value)}`,
  );
  const pointsStr = points.join(" ");

  let projPointsStr = "";
  if (projectedData && projectedData.length > 0) {
    const startIdx = data.length - 1;
    const projPts = [
      `${paddingX + startIdx * stepX},${toY(data[data.length - 1].value)}`,
      ...projectedData.map(
        (d, i) =>
          `${paddingX + (startIdx + 1 + i) * stepX},${toY(d.value)}`,
      ),
    ];
    projPointsStr = projPts.join(" ");
  }

  const goalY = goalValue != null ? toY(goalValue) : null;

  const lastPt = data[data.length - 1];
  const lastX = paddingX + (data.length - 1) * stepX;
  const lastY = toY(lastPt.value);

  const safeIdx = Math.min(
    Math.max(0, selectedIndex),
    data.length - 1,
  );
  const selPt = data[safeIdx];
  const selX = paddingX + safeIdx * stepX;
  const selY = toY(selPt.value);

  const pickNearestFromX = (locationX: number, widthPx: number) => {
    if (widthPx <= 0 || data.length < 2) return;
    const xSvg = (locationX / widthPx) * viewW;
    let bestI = 0;
    let bestDist = Infinity;
    for (let i = 0; i < data.length; i++) {
      const px = paddingX + i * stepX;
      const dist = Math.abs(px - xSvg);
      if (dist < bestDist) {
        bestDist = dist;
        bestI = i;
      }
    }
    setSelectedIndex((prev) => {
      if (prev !== bestI) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return bestI;
    });
  };

  const valueLabel =
    formatValue != null ? formatValue(selPt.value) : String(selPt.value);

  return (
    <View style={{ width: "100%" }}>
      <View
        style={{ width: "100%" }}
        onLayout={(e: LayoutChangeEvent) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setChartWidthPx(w);
        }}
      >
        <Pressable
          accessibilityRole="image"
          accessibilityLabel="Weight trend chart"
          accessibilityHint="Tap the chart to see weight on a date"
          style={{ height }}
          onPressIn={(e) => {
            if (chartWidthPx > 0) {
              pickNearestFromX(e.nativeEvent.locationX, chartWidthPx);
            }
          }}
        >
          <Svg
            width="100%"
            height={height}
            viewBox={`0 0 ${viewW} ${height}`}
          >
            {/* Goal line + inline goal value label at the right edge.
                The label mirrors LoseIt's reference (see TestFlight
                `AF7bS2DQrH_wZWxGosBJ3K8`, 2026-04-18) so the goal
                number is legible on the chart itself, not only in the
                legend underneath. */}
            {goalY != null && (
              <>
                <Line
                  x1={0}
                  y1={goalY}
                  x2={viewW}
                  y2={goalY}
                  stroke={goalColor ?? Accent.success}
                  strokeWidth={1}
                  strokeDasharray="4,3"
                  opacity={0.5}
                />
                <SvgText
                  x={viewW - 2}
                  y={goalY - 4}
                  fontSize={10}
                  fontWeight="700"
                  textAnchor="end"
                  fill={goalColor ?? Accent.success}
                >
                  {formatValue ? formatValue(goalValue!) : String(goalValue)}
                </SvgText>
              </>
            )}

            {/* Vertical guide at selected historical point */}
            {data.length >= 2 && (
              <Line
                x1={selX}
                y1={0}
                x2={selX}
                y2={height}
                stroke={trackColor}
                strokeWidth={1}
                opacity={0.65}
              />
            )}

            {/* Start-of-range callout pill — mirrors LoseIt reference in
                TestFlight `AF7bS2DQrH_wZWxGosBJ3K8` so the user can see
                both ends of the range without tapping. Only renders when
                the range spans at least 2 points. */}
            {data.length >= 2 && (() => {
              const firstPt = data[0];
              const firstX = paddingX;
              const firstY = toY(firstPt.value);
              const label = formatValue
                ? formatValue(firstPt.value)
                : String(firstPt.value);
              // Approximate pill width from label character count.
              const pillW = Math.max(32, 8 + label.length * 6);
              const pillH = 14;
              const pillX = Math.min(viewW - pillW - 2, Math.max(0, firstX - 6));
              const pillY = Math.min(
                chartH - pillH - 2,
                Math.max(2, firstY - pillH - 4),
              );
              return (
                <>
                  <SvgText
                    x={pillX + pillW / 2}
                    y={pillY + 10}
                    fontSize={10}
                    fontWeight="700"
                    textAnchor="middle"
                    fill={color}
                  >
                    {label}
                  </SvgText>
                  <Circle cx={firstX} cy={firstY} r={3} fill={color} />
                </>
              );
            })()}

            {/* Main line */}
            <Polyline
              points={pointsStr}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Projected line */}
            {projPointsStr.length > 0 && (
              <Polyline
                points={projPointsStr}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeDasharray="5,4"
                opacity={0.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Latest point (faded when inspecting an earlier day) */}
            {safeIdx !== data.length - 1 && (
              <Circle cx={lastX} cy={lastY} r={3} fill={color} opacity={0.35} />
            )}

            {/* Selected point */}
            {data.length >= 2 && (
              <>
                <Circle cx={selX} cy={selY} r={5} fill={color} />
                <Circle cx={selX} cy={selY} r={8} fill={color} opacity={0.22} />
              </>
            )}
          </Svg>
        </Pressable>
      </View>

      <Text
        style={{
          textAlign: "center",
          fontSize: 13,
          fontWeight: "700",
          color,
          marginTop: 6,
          height: 20,
          lineHeight: 20,
          fontVariant: ["tabular-nums"],
        }}
        numberOfLines={1}
      >
        {selPt.label} · {valueLabel}
      </Text>

      {/* X-axis labels */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 4 }}>
        <Text style={{ fontSize: 11, color: labelColor }}>{data[0].label}</Text>
        {projectedData && projectedData.length > 0 ? (
          <Text style={{ fontSize: 11, color: labelColor }}>{projectedData[projectedData.length - 1].label}</Text>
        ) : (
          <Text style={{ fontSize: 11, color: labelColor }}>{data[data.length - 1].label}</Text>
        )}
      </View>
      {/* Y-axis context */}
      {data.length >= 2 && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 2 }}>
          <Text style={{ fontSize: 10, color: labelColor }}>
            Range: {formatValue ? formatValue(Math.min(...data.map(d => d.value))) : Math.round(Math.min(...data.map(d => d.value)) * 10) / 10}
            {" – "}
            {formatValue ? formatValue(Math.max(...data.map(d => d.value))) : Math.round(Math.max(...data.map(d => d.value)) * 10) / 10}
          </Text>
          {goalValue != null && (
            <Text style={{ fontSize: 10, color: goalColor ?? Accent.success }}>
              Goal: {formatValue ? formatValue(goalValue) : goalValue}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
