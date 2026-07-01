/**
 * LogConfirmCheck — the calm log-confirm checkmark micro-animation (mobile).
 *
 * ENG-722 (Noom interaction teardown element D, "per-meal completion feel").
 * A subtle sage checkmark disc that scale-fades in over ~420ms then fades out,
 * overlaid on the Today calorie ring at the confirm moment so a successful log
 * *lands* visually — the visual half of the commit feedback whose haptic half
 * shipped 2026-04-28. Restraint by design: NOT confetti, NOT the gold
 * `WinMomentPlayer` (that stays reserved for the once-per-day landmark).
 *
 * Gating + reduce-motion live in the caller (`useLogConfirmCheck`): this
 * component only re-plays when `bump` increments, and the caller never bumps
 * under reduce-motion or when `log_confirm_check_v1` is off. As a second guard,
 * the component itself short-circuits to a no-op under `useReduceMotion()`.
 *
 * Tokens only: the disc is `Accent.success` at a low animated opacity (the calm
 * sage glow), the glyph `useAccent().successSolid` (scheme-correct sage). Sizing
 * from a fixed 44px disc (touch-target rhythm) with `IconSize.hero` glyph.
 * Radius via `Radius.full`.
 *
 * Web mirror: `src/app/components/suppr/log-confirm-check.tsx` (CSS keyframe).
 */
import * as React from "react";
import { View, type ViewStyle } from "react-native";
import { Check } from "lucide-react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Accent, IconSize, Radius } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";

/** Total visible window (ms). Scale-fade-in (~280ms) + brief hold + fade-out.
 *  Keep in sync with the web `LOG_CONFIRM_CHECK_MS` + `log-confirm-check`
 *  keyframe. Calm, not a celebration. */
export const LOG_CONFIRM_CHECK_MS = 480;

const DISC_SIZE = 44;

export interface LogConfirmCheckProps {
  /** Monotonic play counter from `useLogConfirmCheck`. Each increment re-plays
   *  the check once. `0` (never fired) renders nothing. */
  bump: number;
  /** Test id override. */
  testID?: string;
}

/**
 * Absolute-fill overlay centred over its parent (mount inside the ring's
 * relative container). `pointerEvents="none"` so it never blocks ring taps.
 */
export function LogConfirmCheck({ bump, testID }: LogConfirmCheckProps) {
  const reduceMotion = useReduceMotion();
  const accent = useAccent();
  const progress = useSharedValue(0);

  React.useEffect(() => {
    if (bump === 0 || reduceMotion) return;
    // Scale-fade in with a soft overshoot, hold, then fade out — a single
    // non-looping run per bump. The caller only bumps on a durable commit.
    progress.value = 0;
    progress.value = withSequence(
      withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 60, easing: Easing.linear }),
      withTiming(0, { duration: 140, easing: Easing.in(Easing.quad) }),
    );
    return () => cancelAnimation(progress);
  }, [bump, reduceMotion, progress]);

  const discStyle = useAnimatedStyle(() => {
    const p = progress.value;
    // Soft overshoot: peak ~1.06 at the top of the in-curve, settle to 1.
    const scale = 0.5 + p * (p < 1 ? 0.62 : 0.5);
    return {
      opacity: p * 0.16,
      transform: [{ scale }],
    };
  });

  const glyphStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p,
      transform: [{ scale: 0.5 + p * 0.55 }],
    };
  });

  // Never mounted before the first bump, and inert under reduce-motion (the
  // caller also guards this — belt and braces).
  if (bump === 0 || reduceMotion) return null;

  const wrapperStyle: ViewStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  };

  return (
    <View style={wrapperStyle} testID={testID ?? "log-confirm-check"} accessibilityElementsHidden>
      {/* Calm sage glow disc. */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: DISC_SIZE,
            height: DISC_SIZE,
            borderRadius: Radius.full,
            backgroundColor: Accent.success,
          },
          discStyle,
        ]}
      />
      {/* Sage check glyph. */}
      <Animated.View style={glyphStyle}>
        <Check size={IconSize.hero} color={accent.successSolid} strokeWidth={2.75} />
      </Animated.View>
    </View>
  );
}

export default LogConfirmCheck;
