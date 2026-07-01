"use client";

/**
 * useLogConfirmCheck — the web half of the log-confirm checkmark micro-animation
 * (ENG-722, Noom interaction teardown element D "per-meal completion feel").
 *
 * The light commit haptic on all six meal-add paths shipped 2026-04-28; this is
 * the VISUAL half so the core logging loop *lands* on screen, not only in the
 * hand. Calm-delight direction (restraint, not confetti): a checkmark that
 * scale-fades in over ~420ms, then fades out — NOT the loud gold win-moment
 * (that stays reserved for the once-per-day landmark, `useWebWinMoment`).
 *
 * This is DISTINCT from `useCommitPulse`: that hook pulses the ring itself on
 * every commit (the analog of the haptic tap). This one draws a discrete
 * checkmark glyph over the ring so the confirm reads as an unambiguous "logged"
 * beat. The two are complementary and both fire on the same rising edge.
 *
 * Gating:
 *   - Behind the NEW `log_confirm_check_v1` flag (registered default-ON in
 *     `REDESIGN_DEFAULT_ON`, web + mobile — the growth/delight beta-window
 *     policy). Flag off → the hook is inert (the kill switch); the old
 *     no-animation path is preserved.
 *   - Honours `prefers-reduced-motion` (no check) — matching `useCommitPulse`,
 *     the odometer, and the win-moment hooks. The global CSS reduce-motion rule
 *     in `src/styles/theme.css` collapses the keyframe to ~instant anyway; this
 *     JS gate additionally avoids even mounting the glyph.
 *
 * Mobile mirror: `apps/mobile/hooks/useLogConfirmCheck.ts` (+ the Reanimated
 * `LogConfirmCheck` component). Same flag, same reduce-motion contract.
 *
 * Usage:
 *   const { visible, trigger } = useLogConfirmCheck();
 *   // at the log funnel (meal-count rising edge):
 *   trigger();
 *   // over the ring:
 *   <LogConfirmCheck visible={visible} />
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { isFeatureEnabled } from "../analytics/track";

/** How long the checkmark stays mounted (ms). Covers the ~420ms scale-fade-in
 *  keyframe plus a brief hold + fade — calm, not a celebration. Keep in sync
 *  with the mobile `LOG_CONFIRM_CHECK_MS` and the `log-confirm-check-*`
 *  keyframes in `src/styles/theme.css`. */
export const LOG_CONFIRM_CHECK_MS = 480;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface UseLogConfirmCheck {
  /** `true` for ~480ms after `trigger()` — mount `<LogConfirmCheck>` while set. */
  visible: boolean;
  /** Fire the confirm checkmark. No-op when `log_confirm_check_v1` is off or the
   *  user prefers reduced motion. Safe to call on every durable commit. */
  trigger: () => void;
}

export function useLogConfirmCheck(): UseLogConfirmCheck {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const trigger = useCallback(() => {
    if (!isFeatureEnabled("log_confirm_check_v1")) return;
    if (prefersReducedMotion()) return;
    // Re-arm cleanly if a second commit lands inside the window so the check
    // restarts (re-mount via the key bump in the component) rather than
    // ending early.
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    setVisible(false);
    // Flip on the next frame so a rapid second log re-triggers the CSS
    // animation from its first frame (React coalesces same-tick state).
    setVisible(true);
    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, LOG_CONFIRM_CHECK_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return { visible, trigger };
}

export default useLogConfirmCheck;
