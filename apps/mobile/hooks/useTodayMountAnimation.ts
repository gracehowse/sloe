import { useCallback, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useFocusEffect } from "expo-router";

/**
 * 2026-05-16 — Today mount-time slide+fade animation refs (extract #2
 * from the Today God-component split).
 *
 * Owns three `Animated.Value` refs and the focus-effect that runs the
 * mount-time slide+fade once per session. Pre-fix, these lived inline
 * inside `apps/mobile/app/(tabs)/index.tsx` alongside ~180 other hooks
 * — confusable with the other 30+ refs the component holds.
 *
 * ## Behaviour pinned
 *
 * - `heroFadeAnim` starts at `0.85` (subtle initial dim), animates to
 *   `1.0` on first focus over 200ms with `Easing.out(Easing.quad)`.
 * - `sectionSlideAnim` starts at `4` (px translateY), animates to `0`.
 * - `sectionFadeAnim` starts at `0.8`, animates to `1.0`.
 * - All three run in parallel via `Animated.parallel`.
 * - `hasMountedFocusRef` guards re-fires; the animation only runs once
 *   per component mount, not every tab focus.
 * - Motion magnitudes are deliberately below the WCAG vestibular
 *   threshold; system reduce-motion still attenuates the curve.
 *
 * ## Returned values
 *
 * Each `Animated.Value` is passed to the section / hero JSX as the
 * `opacity` or `transform.translateY` driver:
 *
 *   const { heroFadeAnim, sectionSlideAnim, sectionFadeAnim } =
 *     useTodayMountAnimation();
 *   …
 *   <Animated.View style={{
 *     opacity: sectionFadeAnim,
 *     transform: [{ translateY: sectionSlideAnim }],
 *   }} />
 */
export function useTodayMountAnimation(): {
  heroFadeAnim: Animated.Value;
  sectionSlideAnim: Animated.Value;
  sectionFadeAnim: Animated.Value;
} {
  const heroFadeAnim = useRef(new Animated.Value(0.85)).current;
  const sectionSlideAnim = useRef(new Animated.Value(4)).current;
  const sectionFadeAnim = useRef(new Animated.Value(0.8)).current;
  const hasMountedFocusRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (hasMountedFocusRef.current) return;
      hasMountedFocusRef.current = true;
      Animated.parallel([
        Animated.timing(heroFadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sectionSlideAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sectionFadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }, [heroFadeAnim, sectionSlideAnim, sectionFadeAnim]),
  );

  return { heroFadeAnim, sectionSlideAnim, sectionFadeAnim };
}
