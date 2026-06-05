import { StyleSheet, type ViewStyle } from "react-native";

import { Elevation } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useTheme } from "@/context/theme";

/**
 * Resting-card elevation + border treatment — ENG-795 (Redesign — Design
 * Direction 2026, 2026-05-31 design-director review + approved prototypes).
 *
 * This is the spreadable form of the branching already baked into
 * `components/ui/SupprCard.tsx`. The card-sweep phase consumes the returned
 * object so non-SupprCard resting surfaces (rows, tiles, hand-rolled card
 * Views) pick up the same soft-elevation treatment without each caller
 * re-deriving the dark/light logic.
 *
 * SLOE soft-lift is the UNCONDITIONAL default (2026-06-04, Grace: "sim cards
 * are blending into the background, figma does not do this"). The Sloe Figma
 * separates `#F6F5F2` cards from the `#FFFFFF` page with a SOFT DROP SHADOW,
 * not a heavier border (Grace rejected the 1pt border as "too heavy" — the
 * shadow is the separation).
 *
 * Why it's NOT flag-gated. The treatment USED to gate on
 * `design_system_elevation`, but that read is removed here for two reasons:
 *  1. Grace's directive "turn everything on; never flag-gate again" — every
 *     redesign flag already resolves ON via `REDESIGN_DEFAULT_ON`, and
 *     flag-FORCE is dead in a bundled app (ENG-840: Metro can't inline a
 *     computed env key), so on the sim the gate could never be exercised to
 *     turn the lift OFF anyway. The cards read flat NOT because the gate was
 *     off but because the shadow was clipped (see the iOS note below).
 *  2. Keeping any `@/lib/analytics` read here is the opposite of trivial: the
 *     hook is consumed by ~30 components whose tests `vi.mock("@/lib/analytics")`
 *     with only `isFeatureEnabled`; vitest throws a strict "No export is
 *     defined" on any access (named OR namespace) of a flag fn the mock omits.
 *     An unconditional default keeps the hook dependency-free + every consumer
 *     test green, and makes the soft lift the literal default the parent's
 *     idb-capture verifies.
 * The flat `Elevation.card` token still exists for any direct consumer that
 * wants it; this hook simply no longer routes to it.
 *
 * Behaviour:
 *   - LIGHT → soft drop shadow (`Elevation.cardSoft`), NO border. The shadow
 *     carries the separation, so the hairline is dropped to avoid a double
 *     edge. NOTE for consumers: RN `overflow: 'hidden'` clips iOS shadows, so
 *     the spreader MUST apply `shadowStyle` to an OUTER wrapper when the card
 *     clips its children (the reason SupprCard wraps; fixed 2026-06-04 in
 *     TodayMealsSection slot cards, TodayPlannedMealsCard, and
 *     HydrationStimulantsCard's SloeCard, which previously self-clipped).
 *   - DARK → no shadow (RN renders shadows poorly on dark surfaces); a tonal
 *     lift (`cardElevated` background via `liftBg`) plus a hairline carry the
 *     separation instead.
 *
 * Returned shape is intentionally small + typed so the sweep can spread it:
 *   - `shadowStyle` — spread into the (outer) card style; `undefined` when no
 *     shadow applies (dark), so spreading it is a safe no-op.
 *   - `useBorder`   — whether to draw the `StyleSheet.hairlineWidth` border.
 *   - `liftBg`      — the tonal-lift background to use (dark only), or
 *     `undefined` to keep the caller's existing background (light).
 */
export type CardElevationVariant = "soft" | "flat";

export interface UseCardElevationOptions {
  /** `soft` (default) — soft lift off the page. `flat` — Figma Today slab. */
  variant?: CardElevationVariant;
}

export interface CardElevation {
  /** Drop-shadow style to spread onto the (outer) card. `undefined` = none. */
  shadowStyle: ViewStyle | undefined;
  /** Whether the card should draw a hairline border. */
  useBorder: boolean;
  /** Tonal-lift background (dark soft-elevation only), else `undefined`. */
  liftBg: string | undefined;
}

/** Figma `654:2` Today — `#F6F5F2` slab, no border, no resting shadow. */
export function useTodayCardElevation(): CardElevation {
  return useCardElevation({ variant: "flat" });
}

export function useCardElevation(
  options?: UseCardElevationOptions,
): CardElevation {
  const colors = useThemeColors();
  const { resolved } = useTheme();
  const isDark = resolved === "dark";
  const variant = options?.variant ?? "soft";

  if (variant === "flat") {
    return {
      shadowStyle: undefined,
      useBorder: false,
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

  // Light soft-elevation (DEFAULT) — soft shadow carries the separation, NO
  // border. The shadow lifts the `#F6F5F2` card off the `#FFFFFF` page so it
  // never blends in (the bug). Consumers that clip children with
  // `overflow: 'hidden'` must spread this onto an OUTER wrapper or iOS clips it.
  return {
    shadowStyle: Elevation.cardSoft,
    useBorder: false,
    liftBg: undefined,
  };
}

/** Convenience: the hairline width consumers should use when `useBorder`. */
export const CARD_HAIRLINE = StyleSheet.hairlineWidth;
