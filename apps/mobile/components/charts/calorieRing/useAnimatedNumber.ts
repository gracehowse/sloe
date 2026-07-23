import { useEffect, useRef, useState } from "react";
import { PREMIUM_MOTION_COUNT_MS } from "@suppr/shared/preferences/premiumMotion";

/**
 * Tween a displayed integer toward `target` — see CalorieRing for full contract.
 */
export function useAnimatedNumber(
  target: number,
  options?: {
    snapOn?: unknown;
    duration?: number;
    reduceMotion?: boolean;
    animateFromZeroOnMount?: boolean;
  },
): number {
  const duration = options?.duration ?? 400;
  const snapOn = options?.snapOn;
  const reduceMotion = options?.reduceMotion ?? false;
  const animateFromZeroOnMount = options?.animateFromZeroOnMount ?? false;
  const [value, setValue] = useState(animateFromZeroOnMount ? 0 : target);
  const valueRef = useRef(target);
  const lastSnapRef = useRef(snapOn);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
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
    let raf: number;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (target - from) * eased);
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, snapOn, reduceMotion]);

  return value;
}

/** Default count duration when premium motion is on. */
export { PREMIUM_MOTION_COUNT_MS };
