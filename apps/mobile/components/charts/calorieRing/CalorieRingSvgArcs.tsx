import Svg, { Circle } from "react-native-svg";
import Animated, {
  type SharedValue,
  useAnimatedProps,
} from "react-native-reanimated";
import { Accent } from "@/constants/theme";
import { CalorieRingMacroRing } from "./CalorieRingMacroRing";
import { ringCircumference } from "./ringGeometry";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type CalorieRingSvgArcsProps = {
  size: number;
  cx: number;
  r: number;
  stroke: number;
  macroStroke: number;
  macroR: [number, number, number];
  outerTrackColor: string;
  emptyTrackColor: string;
  ringStateColor: string;
  isEmpty: boolean;
  expanded: boolean;
  emptyMacroParityOn: boolean;
  baseGoal?: number;
  goal: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  mc: { protein: string; carbs: string; fat: string };
  progress: SharedValue<number>;
};

export function CalorieRingSvgArcs({
  size,
  cx,
  r,
  stroke,
  macroStroke,
  macroR,
  outerTrackColor,
  emptyTrackColor,
  ringStateColor,
  isEmpty,
  expanded,
  emptyMacroParityOn,
  baseGoal,
  goal,
  proteinPct,
  carbsPct,
  fatPct,
  mc,
  progress,
}: CalorieRingSvgArcsProps) {
  const mainCirc = ringCircumference(r);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: mainCirc * (1 - progress.value),
  }));

  return (
    <Svg width={size} height={size} style={{ position: "absolute" }}>
      <Circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={outerTrackColor}
        strokeWidth={stroke}
        opacity={1}
      />
      {isEmpty && !(emptyMacroParityOn && expanded) ? (
        <Circle
          cx={cx}
          cy={cx}
          r={r - stroke / 2 - 1}
          fill="none"
          stroke={emptyTrackColor}
          strokeWidth={1}
          opacity={0.7}
        />
      ) : null}
      {!isEmpty && baseGoal && baseGoal < goal && goal > 0 ? (
        (() => {
          const bonusFraction = (goal - baseGoal) / goal;
          const bonusLen = mainCirc * bonusFraction;
          return (
            <Circle
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={Accent.activity}
              strokeWidth={stroke}
              strokeDasharray={`${bonusLen} ${mainCirc}`}
              strokeDashoffset={-(mainCirc - bonusLen)}
              rotation="-90"
              origin={`${cx},${cx}`}
            />
          );
        })()
      ) : null}
      <AnimatedCircle
        cx={cx}
        cy={cx}
        r={r}
        stroke={isEmpty ? outerTrackColor : ringStateColor}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${mainCirc}`}
        animatedProps={animatedProps}
        strokeLinecap="round"
        rotation="-90"
        origin={`${cx},${cx}`}
      />
      {expanded ? (
        <>
          <CalorieRingMacroRing
            cx={cx}
            strokeW={macroStroke}
            radius={macroR[0]}
            pct={proteinPct}
            color={mc.protein}
            delay={100}
          />
          <CalorieRingMacroRing
            cx={cx}
            strokeW={macroStroke}
            radius={macroR[1]}
            pct={carbsPct}
            color={mc.carbs}
            delay={200}
          />
          <CalorieRingMacroRing
            cx={cx}
            strokeW={macroStroke}
            radius={macroR[2]}
            pct={fatPct}
            color={mc.fat}
            delay={300}
          />
        </>
      ) : null}
    </Svg>
  );
}
