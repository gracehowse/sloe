"use client";

/**
 * useCommitPulse — the web colour/scale analog of the mobile commit haptic
 * (ENG-1016).
 *
 * Web has no haptics. Mobile fires a Medium "confirm" impact on every durable
 * commit (log meal / save) via `useWinMoment.confirmLog` (gated behind
 * `redesign_motion`). This hook is the web counterpart: it surfaces a short
 * `pulse` boolean the caller maps to a brief, subtle scale + brand-soft glow on
 * the primary commit surface (the Today calorie ring), so a successful log
 * "lands" visually the way it lands in the hand on mobile.
 *
 * This is DISTINCT from the win-moment pulse (`useWebWinMoment`): that one is
 * the loud gold celebration on a landmark (the analog of the SUCCESS
 * notification, fired at most once per day). This one is the quiet per-commit
 * beat that fires on EVERY log — the analog of the ordinary commit haptic.
 *
 * Parity:
 *   - Gated behind the SAME `redesign_motion` flag as mobile `confirmLog`, so
 *     web + mobile ramp the commit feedback together. Flag off → inert.
 *   - Honours `prefers-reduced-motion` (no pulse), matching the odometer +
 *     win-moment hooks.
 *
 * Usage:
 *   const { pulse, trigger } = useCommitPulse();
 *   // at the log funnel:
 *   addLoggedMeal(...); trigger();
 *   // on the ring:
 *   <DailyRing commitPulse={pulse} ... />
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { isFeatureEnabled } from "../analytics/track";

/** How long the commit colour/scale pulse lasts (ms). Kept short + subtle —
 *  the analog of a <100ms haptic tap, not the 200ms win celebration. */
export const WEB_COMMIT_PULSE_MS = 160;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface UseCommitPulse {
  /** `true` for ~160ms after `trigger()` — drives the ring commit pulse. */
  pulse: boolean;
  /** Fire the commit pulse. No-op when `redesign_motion` is off or the user
   *  prefers reduced motion. Safe to call on every durable commit. */
  trigger: () => void;
}

export function useCommitPulse(): UseCommitPulse {
  const [pulse, setPulse] = useState(false);
  const timerRef = useRef<number | null>(null);

  const trigger = useCallback(() => {
    if (!isFeatureEnabled("redesign_motion")) return;
    if (prefersReducedMotion()) return;
    // Re-arm cleanly if a second commit lands inside the window so the pulse
    // restarts rather than ending early.
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    setPulse(true);
    timerRef.current = window.setTimeout(() => {
      setPulse(false);
      timerRef.current = null;
    }, WEB_COMMIT_PULSE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return { pulse, trigger };
}

export default useCommitPulse;
