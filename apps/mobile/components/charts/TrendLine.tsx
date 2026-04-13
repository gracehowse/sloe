import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { Neon } from "@/constants/theme";

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

type DataPoint = { label: string; value: number };

type Props = {
  data: DataPoint[];
  goalValue?: number;
  projectedData?: DataPoint[];
  color: string;
  height?: number;
  labelColor: string;
  goalColor?: string;
  trackColor: string;
};

export default function TrendLine({
  data,
  goalValue,
  projectedData,
  color,
  height = 140,
  labelColor,
  goalColor,
  trackColor,
}: Props) {
  if (data.length === 0) return null;

  const allValues = [
    ...data.map((d) => d.value),
    ...(projectedData?.map((d) => d.value) ?? []),
    ...(goalValue != null ? [goalValue] : []),
  ];
  const minVal = Math.min(...allValues) * 0.98;
  const maxVal = Math.max(...allValues) * 1.02;
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

  return (
    <View style={{ height, width: "100%" }}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${viewW} ${height}`}
      >
        {/* Goal line */}
        {goalY != null && (
          <>
            <Line
              x1={0}
              y1={goalY}
              x2={viewW}
              y2={goalY}
              stroke={goalColor ?? Neon.green}
              strokeWidth={1}
              strokeDasharray="4,3"
              opacity={0.5}
            />
          </>
        )}

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

        {/* Current dot */}
        <Circle cx={lastX} cy={lastY} r={4} fill={color} />
        <Circle cx={lastX} cy={lastY} r={6} fill={color} opacity={0.25} />
      </Svg>

      {/* X-axis labels */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingTop: 2,
        }}
      >
        <Text style={{ fontSize: 9, color: labelColor }}>
          {data[0].label}
        </Text>
        {projectedData && projectedData.length > 0 ? (
          <Text style={{ fontSize: 9, color: labelColor }}>
            {projectedData[projectedData.length - 1].label}
          </Text>
        ) : (
          <Text style={{ fontSize: 9, color: labelColor }}>
            {data[data.length - 1].label}
          </Text>
        )}
      </View>
    </View>
  );
}
