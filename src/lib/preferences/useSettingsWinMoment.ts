"use client";

/**
 * useSettingsWinMoment — web mirror of mobile
 * `apps/mobile/hooks/useSettingsWinMoment.ts` (ENG-824, Redesign — Design
 * Direction 2026, win-moments in Settings).
 *
 * The smaller "you did a good thing in Settings" beat — saving new daily
 * targets — distinct from the LOUD day-landmark celebration (`useWebWinMoment`
 * + `<WinMomentPlayer/>`), which stays reserved for Today landmarks.
 *
 * Web has no haptics, so the beat is a brief WIN-colour wash on the just-saved
 * card: `celebrate()` flips `active` true for ~1.4s; the caller spreads the
 * returned `flashClass` onto the saved card to wash it in `--accent-win-soft`
 * with an `--accent-win` border. Colour is the dedicated WIN token (amber),
 * NOT success-green — green stays reserved for the calorie-ring state.
 *
 * Flag gate: the whole hook is gated behind `redesign_winmoment`. Flag OFF →
 * `celebrate()` is inert and `flashClass` is `""`, so today's behaviour is
 * preserved exactly until ramp. Reduced-motion users still get the colour wash
 * (it's a static fill, not an animation) — no transform/opacity motion.
 *
 * Parity: same flag, same trigger point (target save success) as the mobile
 * hook. Health-connect is mobile-only (web has no Apple Health surface — the
 * documented `Apple Health / Apple Sign-In` carve-out), so only the target-save
 * trigger has a web analog.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { isFeatureEnabled } from "../analytics/track";

/** How long the win-colour wash lingers before fading back to the resting card. */
export const SETTINGS_WIN_FLASH_MS = 1400;

/**
 * The Tailwind classes a flashing card should add. Exported (not inlined in the
 * hook return) so the literal lives in a scanned source file the JIT always
 * sees, and callers can compose it however their card markup needs.
 */
export const SETTINGS_WIN_FLASH_CLASS =
  "bg-[var(--accent-win-soft)] border-[var(--accent-win)]";

export interface UseSettingsWinMoment {
  /** True while the win-colour wash is showing. */
  active: boolean;
  /** Class to add to the just-saved card while flashing — `""` when idle, so
   *  concatenating it is a safe no-op. */
  flashClass: string;
  /** Fire the win-moment: start the colour wash. No-op when `redesign_winmoment`
   *  is off. Safe to call from a confirmed-success branch. */
  celebrate: () => void;
}

export function useSettingsWinMoment(): UseSettingsWinMoment {
  const enabled = isFeatureEnabled("redesign_winmoment");
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const celebrate = useCallback(() => {
    if (!enabled) return;
    setActive(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActive(false), SETTINGS_WIN_FLASH_MS);
  }, [enabled]);

  const flashClass = active ? SETTINGS_WIN_FLASH_CLASS : "";

  return { active, flashClass, celebrate };
}
