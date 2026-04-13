import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type DataPoint = { label: string; value: number };

type Props = {
  data: DataPoint[];
  goalLine?: number;
  color: string;
  height?: number;
  trackColor: string;
  labelColor: string;
  goalColor?: string;
};

function AnimatedBar({
  x,
  width,
  chartHeight,
  barHeight,
  color,
  index,
}: {
  x: number;
  width: number;
  chartHeight: number;
  barHeight: number;
  color: string;
  index: number;
}) {
  const animHeight = useSharedValue(0);

  useEffect(() => {
    animHeight.value = 0;
    animHeight.value = withTiming(barHeight, {
      duration: 500 + index * 60,
      easing: Easing.out(Easing.cubic),
    });
  }, [barHeight]);

  const animatedProps = useAnimatedProps(() => ({
    y: chartHeight - animHeight.value,
    height: Math.max(0, animHeight.value),
  }));

  return (
    <AnimatedRect
      x={x}
      width={width}
      rx={3}
      fill={color}
      animatedProps={animatedProps}
    />
  );
}

export default function MiniBarChart({
  data,
  goalLine,
  color,
  height = 120,
  trackColor,
  labelColor,
  goalColor,
}: Props) {
  if (data.length === 0) return null;

  const maxVal = Math.max(
    ...data.map((d) => d.value),
    goalLine ?? 0,
  );
  const chartH = height - 20;
  const barGap = 3;
  const totalWidth = 100;
  const barW = Math.max(
    4,
    (totalWidth - barGap * (data.length - 1)) / data.length,
  );

  const goalY =
    goalLine != null && maxVal > 0
      ? chartH - (goalLine / maxVal) * chartH
      : null;

  return (
    <View style={{ height, width: "100%" }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${totalWidth} ${height}`}>
        {data.map((d, i) => {
          const bh = maxVal > 0 ? Math.max(2, (d.value / maxVal) * chartH) : 2;
          const x = i * (barW + barGap);
          return (
            <AnimatedBar
              key={`${d.label}-${i}`}
              x={x}
              width={barW}
              chartHeight={chartH}
              barHeight={bh}
              color={d.value > 0 ? color : trackColor}
              index={i}
            />
          );
        })}
        {goalY != null && (
          <Line
            x1={0}
            y1={goalY}
            x2={totalWidth}
            y2={goalY}
            stroke={goalColor ?? color}
            strokeWidth={1}
            strokeDasharray="4,3"
            opacity={0.6}
          />
        )}
      </Svg>
      {/* Labels */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingTop: 2,
        }}
      >
        {data.length <= 14 ? (
          data.map((d, i) => (
            <Text
              key={`lbl-${i}`}
              style={{
                fontSize: 8,
                color: labelColor,
                textAlign: "center",
                width: barW,
              }}
              numberOfLines={1}
            >
              {d.label}
            </Text>
          ))
        ) : (
          <>
            <Text style={{ fontSize: 8, color: labelColor }}>
              {data[0].label}
            </Text>
            <Text style={{ fontSize: 8, color: labelColor }}>
              {data[data.length - 1].label}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
