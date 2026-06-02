/**
 * Suppr motion foundation — MOBILE side — ENG-812 (Redesign — Design
 * Direction 2026).
 *
 * The 2026-05-31 design-director review's 4th spine rule is **one motion
 * vocabulary**: a single spring system, odometer-style number tweens, and an
 * element→sheet morph on open. This file is the React-Native / Reanimated
 * idiomatic surface of that vocabulary.
 *
 * IMPORTANT — single source of truth. The spring NUMBERS and the odometer
 * tween MATH are NOT defined here. They live once in `src/lib/motion.ts` and
 * are imported via `@suppr/shared/motion` (Metro + vitest both alias
 * `@suppr/shared/*` → `src/lib/*`). That guarantees the web CSS easings and
 * these Reanimated springs describe the SAME personality and can never drift.
 * See `src/lib/motion.ts` for the documented spring/odometer description.
 *
 * What's added on top here (mobile-only, framework-idiomatic):
 *   - `SPRING_DEFAULT` / `SPRING_SNAPPY` re-exported as ready-to-spread
 *     `withSpring` configs.
 *   - `useOdometer(value)` — a RAF-driven count-up hook for the calorie /
 *     macro counters (matches the proven CalorieRing `useAnimatedNumber`
 *     pattern; a single Text-node React-state loop, no TextInput swap).
 *   - `useSheetMorph(open)` — drives a trigger element's scale-down as a
 *     sheet opens, plus the sheet panel's own translate/spring, for the
 *     element→sheet morph.
 *
 * Consumers gate usage behind `redesign_motion` / `redesign_winmoment`; these
 * helpers are unflagged primitives.
 */
import { useEffect, useRef, useState } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type WithSpringConfig,
} from "react-native-reanimated";

import {
  ODOMETER_MS,
  SHEET_MORPH_SCALE,
  SPRING_DEFAULT as SHARED_SPRING_DEFAULT,
  SPRING_SNAPPY as SHARED_SPRING_SNAPPY,
  odometerProgress,
  odometerValue,
} from "@suppr/shared/motion";

// ── Spring configs (Reanimated-ready; numbers come from the shared source) ──

/** Calm, settled spring — sheet/card/resting transitions. */
export const SPRING_DEFAULT: WithSpringConfig = {
  damping: SHARED_SPRING_DEFAULT.damping,
  stiffness: SHARED_SPRING_DEFAULT.stiffness,
  mass: SHARED_SPRING_DEFAULT.mass,
};

/** Quick, confident spring with a touch of overshoot — morphs + press pops. */
export const SPRING_SNAPPY: WithSpringConfig = {
  damping: SHARED_SPRING_SNAPPY.damping,
  stiffness: SHARED_SPRING_SNAPPY.stiffness,
  mass: SHARED_SPRING_SNAPPY.mass,
};

// Re-export the shared math/duration so mobile callers have one import.
export { ODOMETER_MS, SHEET_MORPH_SCALE, odometerProgress, odometerValue };

// ── useOdometer — RAF count-up for the calorie / macro counters ─────────────

export interface UseOdometerOptions {
  /** Tween duration in ms. Default `ODOMETER_MS` (900). */
  duration?: number;
  /**
   * When this value changes identity the displayed number SNAPS to the new
   * target instead of tweening — used to suppress count-up across a display
   * mode switch (e.g. remaining ↔ consumed), where rolling between two
   * different metrics is confusing rather than delightful.
   */
  snapOn?: unknown;
  /** Start from 0 on first paint and count up to `target`. Default false. */
  animateFromZeroOnMount?: boolean;
  /**
   * Snap (no tween) regardless of progress. Pass `useReduceMotion()` here so
   * reduced-motion users get an instant value. Default false.
   */
  reduceMotion?: boolean;
}

/**
 * `useOdometer(target)` — tweens the displayed integer toward `target` over
 * `duration` with the shared cubic-out odometer curve, via a single RAF loop
 * on one React state value. Drop-in for the bespoke `useAnimatedNumber` RAF
 * loop currently inlined in `CalorieRing.tsx` so the calorie + macro counters
 * share one curve.
 *
 * Why RAF + React state rather than `useSharedValue` + animated text: animated
 * text in Reanimated needs `Animated.createAnimatedComponent(TextInput)` with
 * the value driven from a worklet — a TextInput where a Text is wanted
 * (different line-height / styling defaults). A 60fps RAF loop on a single
 * Text node is cheap for an ~900ms count and sidesteps the swap. (Same
 * trade-off the CalorieRing comment documents.)
 */
export function useOdometer(
  target: number,
  options?: UseOdometerOptions,
): number {
  const duration = options?.duration ?? ODOMETER_MS;
  const snapOn = options?.snapOn;
  const animateFromZeroOnMount = options?.animateFromZeroOnMount ?? false;
  const reduceMotion = options?.reduceMotion ?? false;

  const [value, setValue] = useState(animateFromZeroOnMount ? 0 : target);
  const valueRef = useRef(target);
  const lastSnapRef = useRef(snapOn);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    // Mode toggle (snapOn identity change) — jump to target, never tween.
    if (snapOn !== lastSnapRef.current) {
      lastSnapRef.current = snapOn;
      setValue(target);
      return;
    }
    if (valueRef.current === target) return;
    if (reduceMotion) {
      setValue(target);
      return;
    }

    const from = valueRef.current;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = odometerProgress(start, Date.now(), duration);
      setValue(odometerValue(from, target, t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, snapOn, reduceMotion]);

  return value;
}

// ── useSheetMorph — element→sheet open morph ────────────────────────────────

export interface SheetMorph {
  /** Animated style for the SHEET panel: translateY from off-screen → rest. */
  sheetStyle: ReturnType<typeof useAnimatedStyle>;
  /** Animated style for the TRIGGER element: scales to SHEET_MORPH_SCALE while open. */
  triggerStyle: ReturnType<typeof useAnimatedStyle>;
}

/**
 * `useSheetMorph(open, sheetHeight)` — the element→sheet morph.
 *
 * While `open` is true the sheet panel springs from `translateY(sheetHeight)`
 * to `0` with `SPRING_DEFAULT`, and the triggering element scales to
 * `SHEET_MORPH_SCALE` (-4%) with the snappier `SPRING_SNAPPY`, so the sheet
 * reads as expanding out of the element the user tapped. Returns two animated
 * styles: spread `sheetStyle` onto the sheet panel and `triggerStyle` onto the
 * trigger row.
 *
 * `sheetHeight` defaults to a large value so the panel starts fully off-screen
 * even before layout is measured; pass the measured height for an exact morph.
 */
export function useSheetMorph(open: boolean, sheetHeight = 800): SheetMorph {
  // progress: 0 = closed, 1 = open. Springs interpolate position from it.
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(open ? 1 : 0, SPRING_DEFAULT);
  }, [open, progress]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetHeight }],
  }));

  const triggerStyle = useAnimatedStyle(() => {
    // Trigger uses the snappy personality independently of the sheet spring.
    const scale = 1 - (1 - SHEET_MORPH_SCALE) * progress.value;
    return { transform: [{ scale }] };
  });

  return { sheetStyle, triggerStyle };
}
