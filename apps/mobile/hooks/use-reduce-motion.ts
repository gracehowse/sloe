import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * `useReduceMotion()` — reactive hook over
 * `AccessibilityInfo.isReduceMotionEnabled()`.
 *
 * Production design spec — 2026-04-27 §1.1 reduce-motion fallbacks.
 * Components that drive their own animations (Reanimated worklets,
 * `Animated.timing`, gorhom-bottom-sheet, etc.) should branch on this
 * value to skip the spring/translate paths in favour of an
 * opacity-only fallback.
 *
 * Web-side equivalent is the global
 * `@media (prefers-reduced-motion: reduce)` rule in
 * `src/styles/theme.css` plus framer-motion's `useReducedMotion()`
 * for component-driven animations.
 *
 * Returns `false` until the initial async query resolves so the first
 * paint defaults to the full-motion path (matching the system
 * convention — opt-in, not opt-out).
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(Boolean(enabled));
    });
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (enabled) => {
        if (mounted) setReduce(Boolean(enabled));
      },
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return reduce;
}

export default useReduceMotion;
