import { useEffect, useMemo, useRef, useState } from "react";
import { TurboModuleRegistry, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/useHaptics";
import Animated, {
  Easing,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  PREMIUM_MOTION_RING_MS,
  PREMIUM_MOTION_V1_FLAG,
} from "@suppr/shared/preferences/premiumMotion";

import { Accent, AccentWinGradient, Colors, MacroColors, MacroColorsDark, RING_EMPTY_GRADIENT_OPACITY } from "@/constants/theme";
import { ringPhase, ringPhaseEvent } from "@/lib/ringPhase";
import type { SkiaRingArcs as SkiaRingArcsT } from "./SkiaRingArcs";
import { SkiaRingErrorBoundary } from "./SkiaRingErrorBoundary";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { RING_LABELS } from "@suppr/shared/copy/today";
import { PressableScale } from "@/components/ui/PressableScale";
import { CalorieRingCenter } from "./calorieRing/CalorieRingCenter";
import { CalorieRingSvgArcs } from "./calorieRing/CalorieRingSvgArcs";
import { ringGeometry } from "./calorieRing/ringGeometry";
import { PREMIUM_MOTION_COUNT_MS, useAnimatedNumber } from "./calorieRing/useAnimatedNumber";

export { ringGeometry } from "./calorieRing/ringGeometry";

type DisplayMode = "remaining" | "consumed";

type Props = {
  consumed: number;
  goal: number;
  baseGoal?: number;
  textColor: string;
  secondaryColor: string;
  trackColor: string;
  proteinPct?: number;
  carbsPct?: number;
  fatPct?: number;
  expanded?: boolean;
  onToggle?: () => void;
  displayMode?: DisplayMode;
  onToggleDisplayMode?: () => void;
  onLongPressExplain?: () => void;
};

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
  displayMode: _displayMode = "consumed",
  onToggleDisplayMode: _onToggleDisplayMode,
  onLongPressExplain: _onLongPressExplain,
}: Props) {
  const haptics = useHaptics();
  const diff = Math.round(goal - consumed);
  const isOver = consumed > goal;
  const isEmpty = consumed === 0 || goal <= 0;
  const { SIZE, STROKE, MACRO_STROKE, CX, R, MACRO_R } = ringGeometry(false, !expanded);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const mc = isDark ? MacroColorsDark : MacroColors;
  const calorieRingColor = useThemeColors().navPrimary;
  const ringStateColor = calorieRingColor;
  const emptyTrackColor = isDark ? Colors.dark.borderStrong : Colors.light.borderStrong;
  const populatedTrackColor = isDark ? Colors.dark.ringTrackBold : Colors.light.ringTrackBold;
  const outerTrackColor = isEmpty ? emptyTrackColor : populatedTrackColor;
  const centerValue = goal > 0 ? Math.abs(diff) : Math.round(consumed);
  const centerLabel =
    goal <= 0 ? RING_LABELS.logged : isOver ? RING_LABELS.over : RING_LABELS.remaining;
  const budgetLine = `of ${Math.round(goal).toLocaleString()} kcal`;
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;

  const skiaFlagOn = isFeatureEnabled("ring_skia_v1");
  const emptyGradientOn = isFeatureEnabled("ring_empty_gradient_v1");
  const emptyMacroParityOn = isFeatureEnabled("ring_empty_macro_parity_v1");
  const showEmptyLoop = isEmpty && emptyGradientOn && !(emptyMacroParityOn && expanded);
  const [skiaRenderFailed, setSkiaRenderFailed] = useState(false);
  const SkiaArcs: typeof SkiaRingArcsT | null = useMemo(() => {
    if (!skiaFlagOn || skiaRenderFailed) return null;
    let hasSkiaNative = false;
    try {
      hasSkiaNative = TurboModuleRegistry?.get?.("RNSkiaModule") != null;
    } catch {
      hasSkiaNative = false;
    }
    if (!hasSkiaNative) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require("./SkiaRingArcs").SkiaRingArcs as typeof SkiaRingArcsT;
    } catch {
      return null;
    }
  }, [skiaFlagOn, skiaRenderFailed]);
  const overFrac = !isEmpty && isOver && goal > 0 ? Math.min(consumed / goal - 1, 1) : 0;
  const bonusFrac = !isEmpty && baseGoal && baseGoal < goal && goal > 0 ? (goal - baseGoal) / goal : 0;
  const emptyBoldStroke = Math.round(SIZE * 0.085);

  const [goalHitCount, setGoalHitCount] = useState(0);
  const prevPhaseRef = useRef(ringPhase(consumed, goal));
  useEffect(() => {
    if (!SkiaArcs) return;
    const next = ringPhase(consumed, goal);
    const ev = ringPhaseEvent(prevPhaseRef.current, next);
    prevPhaseRef.current = next;
    if (!ev) return;
    if (ev === "near") {
      haptics.confirm();
    } else if (ev === "hit") {
      setGoalHitCount((c) => c + 1);
      haptics.confirm();
      setTimeout(() => {
        haptics.success();
      }, 80);
    } else if (ev === "overflow") {
      haptics.confirm();
    }
  }, [consumed, goal, SkiaArcs, haptics]);

  const overflowFrom = isDark ? Colors.dark.navPrimary : Accent.primaryLight;
  const overflowTo = isDark ? Colors.dark.ringOverflowTo : Colors.light.ringOverflowTo;
  const winGlowColor = isDark ? Accent.primarySolidDark : Accent.primaryDark;

  const progress = useSharedValue(0);
  const reduceMotion = useReduceMotion();
  const premiumMotion = isFeatureEnabled(PREMIUM_MOTION_V1_FLAG);

  useEffect(() => {
    if (premiumMotion && !reduceMotion) {
      progress.value = withSpring(pct, { damping: 22, stiffness: 120 });
      return;
    }
    progress.value = withTiming(pct, {
      duration: PREMIUM_MOTION_RING_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, premiumMotion, reduceMotion, progress]);

  const prevConsumedRef = useRef(consumed);
  useEffect(() => {
    if (consumed !== prevConsumedRef.current && consumed > 0) {
      haptics.select();
    }
    prevConsumedRef.current = consumed;
  }, [consumed, haptics]);

  const animatedCenterValue = useAnimatedNumber(centerValue, {
    snapOn: "remaining",
    reduceMotion,
    duration: premiumMotion ? PREMIUM_MOTION_COUNT_MS : 400,
    animateFromZeroOnMount: premiumMotion && !reduceMotion,
  });

  return (
    <PressableScale
      haptic="selection"
      onPress={onToggle}
      onLongPress={onToggle}
      disabled={!onToggle}
      style={{ alignItems: "center" }}
    >
      <View
        style={{
          width: SIZE,
          height: SIZE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {SkiaArcs ? (
          <SkiaRingErrorBoundary onFallback={() => setSkiaRenderFailed(true)}>
            <SkiaArcs
              geom={{
                SIZE,
                STROKE: showEmptyLoop ? emptyBoldStroke : STROKE,
                MACRO_STROKE,
                CX,
                R,
                MACRO_R,
              }}
              fillPct={pct}
              overFrac={overFrac}
              bonusFrac={bonusFrac}
              macroPcts={[proteinPct, carbsPct, fatPct]}
              macroColors={[mc.protein, mc.carbs, mc.fat]}
              trackColor={outerTrackColor}
              emptyInnerColor={emptyTrackColor}
              ringColor={isEmpty ? outerTrackColor : ringStateColor}
              bonusColor={Accent.activity}
              overflowFrom={overflowFrom}
              overflowTo={overflowTo}
              glowColor={winGlowColor}
              isEmpty={isEmpty}
              isOver={isOver}
              expanded={expanded}
              goalHitCount={goalHitCount}
              emptyGradient={showEmptyLoop}
              emptyMacroParity={emptyMacroParityOn}
              emptyGradientStops={AccentWinGradient.stops}
              emptyGradientOpacity={RING_EMPTY_GRADIENT_OPACITY}
            />
          </SkiaRingErrorBoundary>
        ) : (
          <CalorieRingSvgArcs
            size={SIZE}
            cx={CX}
            r={R}
            stroke={STROKE}
            macroStroke={MACRO_STROKE}
            macroR={MACRO_R}
            outerTrackColor={outerTrackColor}
            emptyTrackColor={emptyTrackColor}
            ringStateColor={ringStateColor}
            isEmpty={isEmpty}
            expanded={expanded}
            emptyMacroParityOn={emptyMacroParityOn}
            baseGoal={baseGoal}
            goal={goal}
            proteinPct={proteinPct}
            carbsPct={carbsPct}
            fatPct={fatPct}
            mc={mc}
            progress={progress}
          />
        )}
        <CalorieRingCenter
          animatedCenterValue={animatedCenterValue}
          textColor={textColor}
          secondaryColor={secondaryColor}
          centerLabel={centerLabel}
          budgetLine={budgetLine}
          goal={goal}
          expanded={expanded}
        />
      </View>
    </PressableScale>
  );
}
