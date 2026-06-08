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
 * Views) pick up the same treatment without each caller re-deriving the
 * variant + dark/light logic.
 *
 * FLAT is the default (2026-06-04 "flat slabs" sweep, commit 664df1cb). The
 * Sloe Figma `654:2` Today renders `#F6F5F2` cards AND tiles as borderless,
 * shadowless warm slabs — the card fill against the `#FFFFFF` page is the
 * separation. So the no-arg default (and the `SupprCard` `lift` default) is
 * `"flat"`, and `useTodayCardElevation()` is the named flat wrapper Today uses.
 *
 * SOFT is the opt-in for the few ELEVATED card surfaces that float off the
 * page rather than sit flush in a stack — the recipe-card grids/detail that
 * pass `{ variant: "soft" }` (Discover, Library, recipe detail) or a
 * `SupprCard` with `lift="soft"`. Soft adds the ambient drop shadow (light) /
 * tonal lift (dark); see Behaviour below.
 *
 * Why neither variant is flag-gated. The treatment USED to gate on
 * `design_system_elevation`, but that read is removed here for two reasons:
 *  1. Grace's directive "turn everything on; never flag-gate again" — every
 *     redesign flag already resolves ON via `REDESIGN_DEFAULT_ON`, and
 *     flag-FORCE is dead in a bundled app (ENG-840: Metro can't inline a
 *     computed env key), so on the sim the gate could never be exercised
 *     anyway.
 *  2. Keeping any `@/lib/analytics` read here is the opposite of trivial: the
 *     hook is consumed by ~30 components whose tests `vi.mock("@/lib/analytics")`
 *     with only `isFeatureEnabled`; vitest throws a strict "No export is
 *     defined" on any access (named OR namespace) of a flag fn the mock omits.
 *     An unconditional, variant-driven result keeps the hook dependency-free +
 *     every consumer test green.
 *
 * Behaviour:
 *   - FLAT (default, any theme) → no shadow, NO border, no tonal lift. The
 *     `#F6F5F2` card fill on the `#FFFFFF` page (or `colors.card` in dark) is
 *     the only separation — the Figma `654:2` slab.
 *   - SOFT, LIGHT → soft drop shadow (`Elevation.cardSoft`), NO border. The
 *     shadow carries the separation, so the hairline is dropped to avoid a
 *     double edge. NOTE for consumers: RN `overflow: 'hidden'` clips iOS
 *     shadows, so the spreader MUST apply `shadowStyle` to an OUTER wrapper
 *     when the card clips its children (the reason SupprCard wraps).
 *   - SOFT, DARK → no shadow (RN renders shadows poorly on dark surfaces); a
 *     tonal lift (`cardElevated` background via `liftBg`) plus a hairline carry
 *     the separation instead.
 *
 * Returned shape is intentionally small + typed so the sweep can spread it:
 *   - `shadowStyle` — spread into the (outer) card style; `undefined` when no
 *     shadow applies (flat, or dark), so spreading it is a safe no-op.
 *   - `useBorder`   — whether to draw the `StyleSheet.hairlineWidth` border.
 *   - `liftBg`      — the tonal-lift background to use (dark soft only), or
 *     `undefined` to keep the caller's existing background.
 */
export type CardElevationVariant = "soft" | "flat";

export interface UseCardElevationOptions {
  /** `flat` (default) — Figma `654:2` Today slab. `soft` — ambient lift off
   *  the page (the elevated recipe-card surfaces opt in). */
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
  const variant = options?.variant ?? "flat";

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

  // Light soft-elevation (opt-in via `variant: "soft"`) — soft shadow carries
  // the separation, NO border. The shadow lifts the `#F6F5F2` card off the
  // `#FFFFFF` page so it never blends in. Consumers that clip children with
  // `overflow: 'hidden'` must spread this onto an OUTER wrapper or iOS clips it.
  return {
    shadowStyle: Elevation.cardSoft,
    useBorder: false,
    liftBg: undefined,
  };
}

/** Convenience: the hairline width consumers should use when `useBorder`. */
export const CARD_HAIRLINE = StyleSheet.hairlineWidth;
