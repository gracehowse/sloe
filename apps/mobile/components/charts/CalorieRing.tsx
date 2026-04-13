import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { Neon, Spacing } from "@/constants/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 160;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

type Props = {
  consumed: number;
  goal: number;
  textColor: string;
  secondaryColor: string;
  trackColor: string;
};

export default function CalorieRing({
  consumed,
  goal,
  textColor,
  secondaryColor,
  trackColor,
}: Props) {
  const remaining = Math.round(goal - consumed);
  const isOver = remaining < 0;
  const displayConsumed = Math.round(consumed);
  const displayGoal = Math.round(goal);
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(pct, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progress.value),
  }));

  const ringColor = isOver ? Neon.red : Neon.purple;

  return (
    <View style={{ alignItems: "center", gap: Spacing.lg }}>
      {/* Ring */}
      <View
        style={{
          width: SIZE,
          height: SIZE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={SIZE} height={SIZE} style={{ position: "absolute" }}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={trackColor}
            strokeWidth={STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={ringColor}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${CIRC}`}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${SIZE / 2},${SIZE / 2}`}
          />
        </Svg>
        <Text
          style={{
            fontSize: 36,
            fontWeight: "800",
            color: isOver ? Neon.red : textColor,
            fontVariant: ["tabular-nums"],
          }}
        >
          {isOver ? `+${Math.abs(remaining)}` : remaining}
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            color: secondaryColor,
            letterSpacing: 1,
            marginTop: 2,
          }}
        >
          {isOver ? "OVER" : "LEFT"}
        </Text>
      </View>

      {/* Food / Goal / Remaining row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          width: "100%",
        }}
      >
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: textColor,
              fontVariant: ["tabular-nums"],
            }}
          >
            {displayConsumed}
          </Text>
          <Text style={{ fontSize: 11, color: secondaryColor, marginTop: 2 }}>
            Eaten
          </Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: Neon.purple,
              fontVariant: ["tabular-nums"],
            }}
          >
            {displayGoal}
          </Text>
          <Text style={{ fontSize: 11, color: secondaryColor, marginTop: 2 }}>
            Budget
          </Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: isOver ? Neon.red : Neon.green,
              fontVariant: ["tabular-nums"],
            }}
          >
            {isOver ? `+${Math.abs(remaining)}` : remaining}
          </Text>
          <Text style={{ fontSize: 11, color: secondaryColor, marginTop: 2 }}>
            {isOver ? "Over" : "Remaining"}
          </Text>
        </View>
      </View>
    </View>
  );
}
