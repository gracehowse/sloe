/**
 * useSettingsWinMoment — ENG-824 (Redesign — Design Direction 2026, win-moments
 * in Settings).
 *
 * The 2026-05-31 design-director review reserved the LOUD day-landmark
 * celebration (`useWinMoment` + `<WinMomentPlayer/>`) for Today landmarks ONLY.
 * Settings has its own, smaller class of "you did a good thing" moments —
 * connecting Apple Health, saving new daily targets — that deserve a quiet,
 * positive confirm without hijacking the reserved full-screen win-moment.
 *
 * This hook is that quiet confirm, in one place so health-sync + targets fire an
 * identical beat:
 *   - **Success haptic.** `Haptics.notificationAsync(Success)` — the same beat
 *     the win-moment uses, but with no overlay/Lottie. Distinct from the
 *     ordinary tap/select haptics.
 *   - **Win-colour flash.** `celebrate()` flips `active` true for ~1.4s; callers
 *     spread the returned `flashStyle` onto the just-saved card to wash it in
 *     `Accent.winSoft` with an `Accent.win` hairline. Colour is the dedicated
 *     WIN token (amber `#F2A93B`), NOT the static success-green — green stays
 *     reserved for the calorie-ring state per the spine rules.
 *
 * Flag gate: the whole hook is gated behind `redesign_winmoment`. Flag OFF →
 * `celebrate()` is inert (no haptic, `active` never flips, `flashStyle` is
 * `undefined`), so today's behaviour is preserved exactly until ramp.
 *
 * Parity: the web analog is `useSettingsWinMoment` semantics expressed as the
 * `settings-win-flash` CSS animation on the saved card + no haptic (haptics are
 * not a web concept). Same flag, same trigger points (Health connect success +
 * target save success).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

import { Accent } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";

/** How long the win-colour wash lingers before fading back to the resting card. */
const FLASH_MS = 1400;

export interface SettingsWinMoment {
  /** True while the win-colour wash is showing. */
  active: boolean;
  /** Style to spread onto the just-saved card — `undefined` when not flashing,
   *  so spreading it is a safe no-op. */
  flashStyle: ViewStyle | undefined;
  /** Fire the win-moment: success haptic + start the colour wash. No-op when
   *  `redesign_winmoment` is off. Safe to call from a confirmed-success branch. */
  celebrate: () => void;
}

export function useSettingsWinMoment(): SettingsWinMoment {
  const enabled = isFeatureEnabled("redesign_winmoment");
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any in-flight timer on unmount so a celebrate() right before the user
  // navigates away can't setState on an unmounted screen.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const celebrate = useCallback(() => {
    if (!enabled) return;
    if (Platform.OS === "ios" || Platform.OS === "android") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setActive(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActive(false), FLASH_MS);
  }, [enabled]);

  const flashStyle: ViewStyle | undefined = active
    ? { backgroundColor: Accent.winSoft, borderColor: Accent.win }
    : undefined;

  return { active, flashStyle, celebrate };
}

export default useSettingsWinMoment;
