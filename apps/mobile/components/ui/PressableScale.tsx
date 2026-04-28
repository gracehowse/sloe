/**
 * PressableScale — production-design-spec §1.1 micro-interaction primitive
 * (mobile).
 *
 * Wraps `Pressable` so every consumer gets the same press feedback —
 * scale 1 → 0.97 with light haptic, 100ms ease — instead of the
 * opacity-only press default that React Native ships. The visual-qa
 * audit flagged opacity-only press as one of the 5 button-level gaps
 * across the app (`docs/audits/2026-04-28-ui-critic-button-level.md`).
 *
 * The scale value is reanimated (rather than CSS-style animated) so the
 * gesture is buttery on both press-in and release; release uses
 * `withSpring` so the bounce-back feels organic, not snap.
 *
 * Web mirror at `src/app/components/ui/pressable-scale.tsx`.
 */
import * as React from "react";
import { Pressable, type PressableProps } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleHaptic = "selection" | "confirm" | "success" | "none";

export interface PressableScaleProps
  extends Omit<PressableProps, "style"> {
  /** Scale to drop to on press-in. Default 0.97 (per spec §1.1). */
  scaleTo?: number;
  /** Haptic to fire on press-in. iOS-only; web mirror is silent. */
  haptic?: PressableScaleHaptic;
  /** Style passed through to the underlying Pressable. Animated style
   *  layered on top so callers don't have to wire transforms. */
  style?: PressableProps["style"];
  children?: React.ReactNode;
}

function fireHaptic(haptic: PressableScaleHaptic): void {
  if (haptic === "none") return;
  try {
    if (haptic === "selection") {
      void Haptics.selectionAsync();
    } else if (haptic === "confirm") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (haptic === "success") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch {
    // Haptics unavailable (e.g. Expo Go without permission) — silent fail.
  }
}

export function PressableScale({
  scaleTo = 0.97,
  haptic = "selection",
  onPressIn,
  onPressOut,
  style,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = React.useCallback(
    (e: Parameters<NonNullable<PressableProps["onPressIn"]>>[0]) => {
      scale.value = withTiming(scaleTo, { duration: 100 });
      fireHaptic(haptic);
      onPressIn?.(e);
    },
    [scale, scaleTo, haptic, onPressIn],
  );

  const handlePressOut = React.useCallback(
    (e: Parameters<NonNullable<PressableProps["onPressOut"]>>[0]) => {
      scale.value = withSpring(1, { damping: 14, stiffness: 220, mass: 0.6 });
      onPressOut?.(e);
    },
    [scale, onPressOut],
  );

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

export default PressableScale;
