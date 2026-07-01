import { useCallback, useState } from "react";

import { isFeatureEnabled } from "@/lib/analytics";
import { useReduceMotion } from "@/hooks/use-reduce-motion";

/**
 * useLogConfirmCheck — the mobile half of the log-confirm checkmark
 * micro-animation (ENG-722, Noom interaction teardown element D "per-meal
 * completion feel").
 *
 * The light commit haptic on all six meal-add paths shipped 2026-04-28; this is
 * the VISUAL half so the core logging loop *lands* on screen, not only in the
 * hand. Calm-delight direction (restraint, not confetti): a sage checkmark that
 * scale-fades in over ~420ms then fades — NOT the loud gold win-moment (that
 * stays reserved for the once-per-day landmark, `useWinMoment`).
 *
 * This is DISTINCT from `confirmLog()` (the Medium commit haptic): the two are
 * complementary, both fire on the same durable-commit beat. This hook owns the
 * VISUAL trigger; the caller mounts `<LogConfirmCheck bump={bump} />` over the
 * ring and calls `trigger()` on the SAME persist beat `confirmLog()` fires on.
 *
 * Gating:
 *   - Behind the NEW `log_confirm_check_v1` flag (registered default-ON in
 *     `REDESIGN_DEFAULT_ON`, web + mobile — the growth/delight beta-window
 *     policy). Flag off → the hook is inert (the kill switch); the old
 *     no-animation path is preserved.
 *   - Honours `useReduceMotion()` — trigger is a no-op when reduce-motion is on,
 *     so the check never plays (matching the web `prefers-reduced-motion` gate).
 *
 * Web mirror: `src/lib/preferences/useLogConfirmCheck.ts`. Same flag, same
 * reduce-motion contract.
 */
export interface UseLogConfirmCheck {
  /** Monotonic play counter. Increments on each successful `trigger()`. Feed it
   *  to `<LogConfirmCheck bump={bump} />` as the re-mount key so a rapid second
   *  log restarts the animation. `0` = never fired (nothing mounts). */
  bump: number;
  /** Fire the confirm checkmark. No-op when `log_confirm_check_v1` is off or the
   *  user prefers reduced motion. Safe to call on every durable commit. */
  trigger: () => void;
}

export function useLogConfirmCheck(): UseLogConfirmCheck {
  const reduceMotion = useReduceMotion();
  const [bump, setBump] = useState(0);

  const trigger = useCallback(() => {
    if (!isFeatureEnabled("log_confirm_check_v1")) return;
    if (reduceMotion) return;
    setBump((n) => n + 1);
  }, [reduceMotion]);

  return { bump, trigger };
}

export default useLogConfirmCheck;
