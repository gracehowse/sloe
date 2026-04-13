import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  value: number;
  goal: number;
  color: string;
  label: string;
  unit?: string;
  size?: number;
  strokeWidth?: number;
  trackColor: string;
  labelColor: string;
};

export default function MacroRingSmall({
  value,
  goal,
  color,
  label,
  unit = "g",
  size = 52,
  strokeWidth = 5,
  trackColor,
  labelColor,
}: Props) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(pct, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - progress.value),
  }));

  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circ}`}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2},${size / 2}`}
          />
        </Svg>
        <Text style={{ color, fontSize: 11, fontWeight: "700" }}>
          {Math.round(value)}
          {unit}
        </Text>
      </View>
      <Text style={{ color: labelColor, fontSize: 10, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}
