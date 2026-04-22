import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

import { Accent, MacroColors } from "@/constants/theme";
import { RING_LABELS } from "../../../../src/lib/copy/today";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// F-60 (2026-04-22): 160 → 140 to address repeat tester complaints
// ("calorie section still massive" / "cals still too big hasn't been
// fixed" on build 28). Macro-ring radii stay proportional.
const SIZE = 140;
const STROKE = 8;
const MACRO_STROKE = 5;
const CX = SIZE / 2;
const R = (SIZE - STROKE) / 2 - 2;
const MACRO_R = [R - 12, R - 22, R - 32];
const CIRC = (r: number) => 2 * Math.PI * r;

type DisplayMode = "remaining" | "consumed";

type Props = {
  consumed: number;
  goal: number;
  /** The base goal before activity bonus (used to show bonus segment in a different colour) */
  baseGoal?: number;
  textColor: string;
  secondaryColor: string;
  trackColor: string;
  /** Macro progress values 0-1 */
  proteinPct?: number;
  carbsPct?: number;
  fatPct?: number;
  /** Whether expanded state showing macro rings */
  expanded?: boolean;
  /** Toggle expanded */
  onToggle?: () => void;
  /** Show remaining or consumed calories */
  displayMode?: DisplayMode;
  /** Called when user long-presses to toggle display mode */
  onToggleDisplayMode?: () => void;
};

function MacroRing({
  radius,
  pct,
  color,
  trackColor,
  delay,
}: {
  radius: number;
  pct: number;
  color: string;
  trackColor: string;
  delay: number;
}) {
  const circ = CIRC(radius);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(Math.min(pct, 0.999), {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - progress.value),
  }));

  return (
    <G>
      <Circle
        cx={CX}
        cy={CX}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={MACRO_STROKE}
        opacity={0.4}
      />
      <AnimatedCircle
        cx={CX}
        cy={CX}
        r={radius}
        stroke={color}
        strokeWidth={MACRO_STROKE}
        fill="none"
        strokeDasharray={`${circ}`}
        animatedProps={animatedProps}
        strokeLinecap="round"
        rotation="-90"
        origin={`${CX},${CX}`}
      />
    </G>
  );
}

export default function CalorieRing({
  consumed,
  goal,
  baseGoal,
  textColor,
  secondaryColor,
  trackColor,
  proteinPct = 0,
  carbsPct = 0,
  fatPct = 0,
  expanded = true,
  onToggle,
  displayMode = "consumed",
  onToggleDisplayMode,
}: Props) {
  const diff = Math.round(goal - consumed);
  const isOver = consumed > goal;
  const centerValue = displayMode === "consumed"
    ? Math.round(consumed)
    : Math.abs(diff);
  const centerLabel = displayMode === "consumed"
    ? RING_LABELS.logged
    : isOver
      ? RING_LABELS.over
      : RING_LABELS.remaining;
  const budgetLine = `of ${Math.round(goal)} kcal`;
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const mainCirc = CIRC(R);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(pct, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: mainCirc * (1 - progress.value),
  }));

  return (
    <Pressable onPress={onToggle} onLongPress={onToggleDisplayMode} style={{ alignItems: "center" }}>
      <View
        style={{
          width: SIZE,
          height: SIZE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={SIZE} height={SIZE} style={{ position: "absolute" }}>
          {/* Main calorie ring track */}
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={trackColor}
            strokeWidth={STROKE}
          />
          {/* Main calorie ring progress */}
          <AnimatedCircle
            cx={CX}
            cy={CX}
            r={R}
            stroke={isOver ? Accent.destructive : Accent.success}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${mainCirc}`}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${CX},${CX}`}
          />
          {/* Macro rings (shown when expanded) */}
          {expanded && (
            <MacroRing
              radius={MACRO_R[0]}
              pct={proteinPct}
              color={MacroColors.protein}
              trackColor={trackColor}
              delay={80}
  
            />
          )}
          {expanded && (
            <MacroRing
              radius={MACRO_R[1]}
              pct={carbsPct}
              color={MacroColors.carbs}
              trackColor={trackColor}
              delay={160}
  
            />
          )}
          {expanded && (
            <MacroRing
              radius={MACRO_R[2]}
              pct={fatPct}
              color={MacroColors.fat}
              trackColor={trackColor}
              delay={240}
  
            />
          )}
        </Svg>
        {/* Center text */}
        <Text
          style={{
            fontSize: expanded ? 22 : 28,
            fontWeight: "700",
            color: isOver && displayMode !== "consumed" ? Accent.destructive : textColor,
            fontVariant: ["tabular-nums"],
          }}
        >
          {centerValue}
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: isOver && displayMode !== "consumed" ? Accent.destructive : secondaryColor,
            letterSpacing: 0.8,
            marginTop: 1,
          }}
        >
          {centerLabel}
        </Text>
        {/* Budget line hidden when the concentric macro rings are
            showing — Grace 2026-04-20: text + rings looked squished. */}
        {!expanded ? (
          <Text
            style={{
              fontSize: 10,
              color: secondaryColor,
              marginTop: 1,
              fontVariant: ["tabular-nums"],
            }}
          >
            {budgetLine}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
