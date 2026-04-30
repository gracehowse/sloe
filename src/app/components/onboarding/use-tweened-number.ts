"use client";

import * as React from "react";

/**
 * useTweenedNumber — smoothly animates a numeric value toward a
 * target over `duration` ms using easeOutCubic. Used by the Pace
 * step's live projection numbers so they don't snap integer-by-integer
 * with each slider tick.
 *
 * Returns the current display value, which can be safely formatted
 * with `toLocaleString()` etc. The hook cancels in-flight animations
 * when the target changes mid-tween, so rapid drags don't queue up.
 */
export function useTweenedNumber(target: number, duration = 220): number {
  const [display, setDisplay] = React.useState(target);
  const startRef = React.useRef(target);
  const startTimeRef = React.useRef<number | null>(null);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    startRef.current = display;
    startTimeRef.current = null;

    const tick = (now: number) => {
      if (startTimeRef.current == null) startTimeRef.current = now;
      const t = Math.min(1, (now - startTimeRef.current) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const next = startRef.current + (target - startRef.current) * e;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // `display` is intentionally not a dep — we capture it as the
    // start point on each target change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}
