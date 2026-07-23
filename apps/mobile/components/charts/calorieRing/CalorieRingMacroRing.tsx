import { useEffect, useRef } from "react";
import Svg, { Circle, G } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { ringCircumference } from "./ringGeometry";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function CalorieRingMacroRing({
  radius,
  pct,
  color,
  delay,
  cx,
  strokeW,
}: {
  radius: number;
  pct: number;
  color: string;
  delay: number;
  cx: number;
  strokeW: number;
}) {
  const circ = ringCircumference(radius);
  const progress = useSharedValue(0);
  const prevPctRef = useRef(pct);

  useEffect(() => {
    const prevPct = prevPctRef.current;
    prevPctRef.current = pct;
    if (prevPct === 0 && pct > 0) {
      progress.value = 0;
      progress.value = withDelay(
        delay,
        withTiming(Math.min(pct, 0.999), {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        }),
      );
    } else {
      progress.value = withTiming(Math.min(pct, 0.999), {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [pct, delay, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - progress.value),
  }));

  return (
    <G>
      <Circle
        cx={cx}
        cy={cx}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeW}
        opacity={0.28}
      />
      <AnimatedCircle
        cx={cx}
        cy={cx}
        r={radius}
        stroke={color}
        strokeWidth={strokeW}
        fill="none"
        strokeDasharray={`${circ}`}
        animatedProps={animatedProps}
        strokeLinecap="round"
        rotation="-90"
        origin={`${cx},${cx}`}
      />
    </G>
  );
}
