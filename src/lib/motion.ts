/**
 * Suppr shared motion foundation — ENG-812 (Redesign — Design Direction 2026).
 *
 * This file is the SINGLE SOURCE OF TRUTH for the product's one motion
 * "personality". The 2026-05-31 design-director review scored Motion as the
 * biggest product-wide gap (Prototype/Cheap tier on most surfaces) and the
 * direction's 4th spine rule is: **one motion vocabulary** — a single spring
 * system, odometer-style number tweens, and an element→sheet morph on open.
 *
 * Web consumes this file directly (`@/lib/motion`). Mobile consumes the same
 * numeric constants via `@suppr/shared/motion` (the Metro / vitest alias maps
 * `@suppr/shared/*` → `src/lib/*`) and wraps them in Reanimated-idiomatic
 * helpers in `apps/mobile/lib/motion.ts`. Because both platforms read the
 * spring numbers from HERE, the personality cannot drift between them.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  THE SPRING PERSONALITY (documented so web ↔ mobile stay identical)
 * ──────────────────────────────────────────────────────────────────────────
 *  One tuned spring, two intensities. Numbers are Reanimated `withSpring`
 *  params; the web CSS easings below are hand-fitted to feel like the same
 *  spring resolving (slight settle, no perceptible overshoot on DEFAULT, a
 *  small confident overshoot on SNAPPY).
 *
 *    SPRING_DEFAULT  damping 18 · stiffness 200 · mass 0.7
 *      → calm, settled. Sheet opens, card reveals, resting transitions.
 *      → web analog: SPRING_EASE  cubic-bezier(0.32, 0.72, 0, 1)
 *
 *    SPRING_SNAPPY   damping 22 · stiffness 280 · mass 0.5
 *      → quick, confident, a hair of overshoot. Element→sheet morph,
 *        press-release, chip pops.
 *      → web analog: SPRING_SNAPPY_EASE  cubic-bezier(0.18, 0.89, 0.32, 1.28)
 *
 *  These DEFAULT numbers intentionally match the calmer half of the existing
 *  `PressableScale` release spring lineage and the CalorieRing sweep feel; the
 *  whole point of ENG-812 is to stop every surface inventing its own.
 *
 *  ODOMETER (number tweens) — `ODOMETER_MS` over `cubic-out` easing. This
 *  matches the proven count-up already shipping in CalorieRing /
 *  daily-ring (the `useAnimatedNumber` RAF loops) so the calorie + macro
 *  counters all share one count-up curve.
 */

// ── Spring constants (Reanimated `withSpring` params; read by mobile) ───────

export interface SpringConfig {
  damping: number;
  stiffness: number;
  mass: number;
}

/** Calm, settled spring. The default for sheet/card/resting transitions. */
export const SPRING_DEFAULT: SpringConfig = {
  damping: 18,
  stiffness: 200,
  mass: 0.7,
};

/** Quick, confident spring with a touch of overshoot. Morphs + press pops. */
export const SPRING_SNAPPY: SpringConfig = {
  damping: 22,
  stiffness: 280,
  mass: 0.5,
};

// ── Web CSS easing analogs (hand-fitted to the springs above) ───────────────

/** CSS easing that feels like `SPRING_DEFAULT` resolving. */
export const SPRING_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** CSS easing that feels like `SPRING_SNAPPY` (small confident overshoot). */
export const SPRING_SNAPPY_EASE = "cubic-bezier(0.18, 0.89, 0.32, 1.28)";

// ── Durations ───────────────────────────────────────────────────────────────

/**
 * Odometer / number-tween duration. The lane brief calls for ~900ms; we use
 * 900 so the calorie + macro counters read as a deliberate "rolling up to
 * the number" rather than a snap. Mobile reads this same constant.
 */
export const ODOMETER_MS = 900;

/** Sheet open/close translate + backdrop-fade duration (paired with SPRING_EASE). */
export const SHEET_OPEN_MS = 320;

/** Backdrop fade that accompanies a sheet open. */
export const BACKDROP_FADE_MS = 200;

/** Element→sheet morph: how far the trigger element scales down (0.96 = -4%). */
export const SHEET_MORPH_SCALE = 0.96;

// ── Pure odometer math (shared, framework-free, unit-tested both sides) ─────

/**
 * Cubic-out eased interpolation for a number tween. `t` is normalised
 * progress in `[0, 1]`. Returns the integer value to display at that frame.
 *
 * This is the EXACT curve the CalorieRing / daily-ring count-ups already use
 * (`1 - (1 - t)^3`, then `Math.round`). Pulling it out as a pure function
 * means every odometer on both platforms shares one curve and one rounding
 * rule, and the math is testable without a renderer.
 *
 *   odometerValue(from, to, 0)   === from   (rounded)
 *   odometerValue(from, to, 1)   === to     (exact, no rounding drift)
 *   odometerValue(from, to, t)   monotonic between the two for from ≤ to
 */
export function odometerValue(from: number, to: number, t: number): number {
  if (t <= 0) return Math.round(from);
  if (t >= 1) return to; // land exactly on target — no rounding drift at the end
  const eased = 1 - Math.pow(1 - t, 3); // cubic out — matches ring sweep
  return Math.round(from + (to - from) * eased);
}

/**
 * Normalised progress `[0, 1]` for an odometer tween that started at
 * `startMs` (epoch ms), given `now` (epoch ms) and a `duration`. Clamped.
 * Extracted so the RAF loop and the tests agree on the clock math.
 */
export function odometerProgress(
  startMs: number,
  now: number,
  duration: number = ODOMETER_MS,
): number {
  if (duration <= 0) return 1;
  const t = (now - startMs) / duration;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

// ── Web odometer hook (RAF-driven) ──────────────────────────────────────────

import { useEffect, useRef, useState } from "react";

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

// ── Web sheet transition helpers ────────────────────────────────────────────

export interface SheetTransitionStyle {
  /** `transform` for the sheet panel at the given open state. */
  transform: string;
  /** `opacity` for the backdrop at the given open state. */
  backdropOpacity: number;
  /** `transition` shorthand to apply to the sheet panel. */
  transition: string;
  /** `transition` shorthand to apply to the backdrop. */
  backdropTransition: string;
}

/**
 * `sheetTransition(open)` — the inline-style pair for an element→sheet open on
 * web. The panel slides up from fully off-screen (`translateY(100%)`) to rest
 * with `SPRING_EASE`; the backdrop fades with a plain ease over
 * `BACKDROP_FADE_MS`. Pair with `triggerMorphStyle()` on the element that
 * launched the sheet for the "expands from that element" feel.
 */
export function sheetTransition(open: boolean): SheetTransitionStyle {
  return {
    transform: open ? "translateY(0)" : "translateY(100%)",
    backdropOpacity: open ? 1 : 0,
    transition: `transform ${SHEET_OPEN_MS}ms ${SPRING_EASE}`,
    backdropTransition: `opacity ${BACKDROP_FADE_MS}ms ease`,
  };
}

/**
 * `triggerMorphStyle(active)` — inline style for the element that triggered a
 * sheet. While the sheet is opening (`active`), the trigger scales to
 * `SHEET_MORPH_SCALE` with the snappy easing so the sheet reads as expanding
 * out of it. Returns to identity on close.
 */
export function triggerMorphStyle(active: boolean): {
  transform: string;
  transition: string;
} {
  return {
    transform: active ? `scale(${SHEET_MORPH_SCALE})` : "scale(1)",
    transition: `transform ${SHEET_OPEN_MS}ms ${SPRING_SNAPPY_EASE}`,
  };
}
