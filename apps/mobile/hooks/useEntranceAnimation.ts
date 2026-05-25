import { useEffect } from "react";
import { type ViewStyle, type StyleProp } from "react-native";
import {
  useSharedValue, useAnimatedStyle, withSpring, useReducedMotion,
  type AnimatedStyle,
} from "react-native-reanimated";
import { Spring } from "@/constants/theme";

/**
 * Fade-in + slide-up entrance using the app's `Spring.softSheet` config.
 * Respects system reduced-motion preference.
 *
 * 2026-05-24 — return type widened to `StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>`
 * so `<ReAnimated.View style={hook.style}>` typechecks against the
 * recursive style-array shape View accepts. Plain `AnimatedStyle`
 * matched the old non-generic alias and tripped under strict mode.
 */
export function useEntranceAnimation(
  opts: { delay?: number } = {},
): { style: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>> } {
  const { delay = 0 } = opts;
  const reducedMotion = useReducedMotion();

  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const translateY = useSharedValue(reducedMotion ? 0 : 12);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setTimeout(() => {
      opacity.value = withSpring(1, Spring.softSheet);
      translateY.value = withSpring(0, Spring.softSheet);
    }, delay);
    return () => clearTimeout(id);
  }, [delay, reducedMotion, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return { style };
}
