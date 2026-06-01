import { StyleSheet, type ViewStyle } from "react-native";

import { Elevation } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useTheme } from "@/context/theme";
import { isFeatureEnabled } from "@/lib/analytics";

/**
 * Flag-aware resting-card elevation + border treatment — ENG-795 (Redesign —
 * Design Direction 2026, 2026-05-31 design-director review + approved
 * prototypes).
 *
 * This is the spreadable form of the branching already baked into
 * `components/ui/SupprCard.tsx`. The card-sweep phase consumes the returned
 * object so non-SupprCard resting surfaces (rows, tiles, hand-rolled card
 * Views) pick up the same soft-elevation treatment without each caller
 * re-deriving the dark/light/flag logic.
 *
 * Behaviour (mirrors SupprCard exactly):
 *   - Flag OFF (`design_system_elevation` off / cold) → today's behaviour:
 *     flat `Elevation.card` (a no-op shadow since the 2026-05-22 flat lock)
 *     + a hairline border. This is the flag-off fallback and must stay alive.
 *   - Flag ON, LIGHT → soft drop shadow (`Elevation.cardSoft`), NO border.
 *     The shadow carries the separation, so the hairline is dropped to avoid
 *     a double edge. NOTE for consumers: RN `overflow: 'hidden'` clips iOS
 *     shadows, so the spreader must apply `shadowStyle` to an OUTER wrapper
 *     when the card clips its children (same reason SupprCard wraps).
 *   - Flag ON, DARK → no shadow (RN renders shadows poorly on dark surfaces);
 *     a tonal lift (`cardElevated` background via `liftBg`) plus a hairline
 *     carry the separation instead.
 *
 * Returned shape is intentionally small + typed so the sweep can spread it:
 *   - `shadowStyle` — spread into the (outer) card style; `undefined` when no
 *     shadow applies (dark soft-elevation), so spreading it is a safe no-op.
 *   - `useBorder`   — whether to draw the `StyleSheet.hairlineWidth` border.
 *   - `liftBg`      — the tonal-lift background to use, or `undefined` to keep
 *     the caller's existing background (light + flag-off paths).
 */
export interface CardElevation {
  /** Drop-shadow style to spread onto the (outer) card. `undefined` = none. */
  shadowStyle: ViewStyle | undefined;
  /** Whether the card should draw a hairline border. */
  useBorder: boolean;
  /** Tonal-lift background (dark soft-elevation only), else `undefined`. */
  liftBg: string | undefined;
}

export function useCardElevation(): CardElevation {
  const colors = useThemeColors();
  const { resolved } = useTheme();
  const isDark = resolved === "dark";

  const softElevation = isFeatureEnabled("design_system_elevation");

  if (!softElevation) {
    // Flag-off fallback — today's flat/hairline behaviour (2026-05-22 lock).
    return {
      shadowStyle: Elevation.card,
      useBorder: true,
      liftBg: undefined,
    };
  }

  if (isDark) {
    // Dark soft-elevation — tonal lift + hairline, no shadow.
    return {
      shadowStyle: undefined,
      useBorder: true,
      liftBg: colors.cardElevated,
    };
  }

  // Light soft-elevation — soft shadow, no border.
  return {
    shadowStyle: Elevation.cardSoft,
    useBorder: false,
    liftBg: undefined,
  };
}

/** Convenience: the hairline width consumers should use when `useBorder`. */
export const CARD_HAIRLINE = StyleSheet.hairlineWidth;
