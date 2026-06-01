"use client";

/**
 * Web odometer hook (RAF-driven) — ENG-812 (Redesign — Design Direction 2026).
 *
 * Extracted from `./motion` so that module stays FRAMEWORK-FREE: mobile imports
 * the shared numeric motion constants via `@suppr/shared/motion` (→ src/lib/motion)
 * and must not pull in `react`. This web-only hook lives here instead, importing
 * the framework-free curve helpers from `./motion`.
 */
import { useEffect, useRef, useState } from "react";

import { ODOMETER_MS, odometerProgress, odometerValue } from "./motion";

export interface UseOdometerOptions {
  /** Tween duration in ms. Default `ODOMETER_MS` (900). */
  duration?: number;
  /**
   * When this value changes identity, the displayed number SNAPS to the new
   * target instead of tweening. Used to suppress count-up across a display-mode
   * switch (e.g. remaining ↔ consumed) where rolling between two different
   * metrics is confusing rather than delightful.
   */
  snapOn?: unknown;
  /** Start from 0 on first paint and count up to `target`. Default false. */
  animateFromZeroOnMount?: boolean;
  /**
   * Force-snap (no tween) regardless of progress. Pass the result of a
   * reduced-motion check here. Default false. When omitted the hook also
   * honours the `prefers-reduced-motion: reduce` media query itself.
   */
  reduceMotion?: boolean;
}

/**
 * `useOdometer(target)` — tweens the displayed number toward `target` over
 * `duration` with the shared cubic-out odometer curve, via a single RAF loop
 * on one React state value.
 *
 * Mirrors (and is intended to replace) the bespoke `useAnimatedNumber` RAF
 * loops currently inlined in `daily-ring.tsx` and `CalorieRing.tsx`, so the
 * calorie + macro counters all share one curve. Honours reduced-motion (snap),
 * snaps on `snapOn` identity change, and optionally counts up from zero on
 * mount.
 */
export function useOdometer(
  target: number,
  options?: UseOdometerOptions,
): number {
  const duration = options?.duration ?? ODOMETER_MS;
  const snapOn = options?.snapOn;
  const animateFromZeroOnMount = options?.animateFromZeroOnMount ?? false;
  const forcedReduce = options?.reduceMotion ?? false;

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

    const reduce =
      forcedReduce ||
      (typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (reduce) {
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
  }, [target, duration, snapOn, forcedReduce]);

  return value;
}
