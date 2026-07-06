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
 * SOFT is the page-ground card treatment (Sloe v3, ENG-1222 P2 — decision:
 * docs/decisions/2026-06-25-v3-card-lift-reversal.md). v3 reverses the
 * 2026-06-12 flat-card decision: white resting cards LIFT off the white ground
 * on `Elevation.cardSoft` ("elevation, not warmth") — a flat white card on a
 * white page is invisible, so the lift IS the separation. The ~39 page-ground
 * card surfaces across Today/Plan/Progress/Recipes pass `{ variant: "soft" }`
 * (or `<SupprCard lift="soft">`). Soft adds the ambient drop shadow (light) /
 * tonal lift (dark); see Behaviour below.
 *
 * FLAT (the no-arg default, and `useTodayCardElevation()`) stays for the
 * surfaces the prototype keeps recessed/flush: macro tiles (`size="tile"`,
 * recessed `--bg-secondary` slab), inset card-on-card panels (`size="inset"`,
 * no double-shadow), and the Today tracker-half cards — ENG-1099's recipe-tier
 * flat treatment, unconditional since the always-on `today_tracker_tier_v1`
 * flag was collapsed (ENG-1356, 2026-07-06).
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

  // SOFT LIFT — Sloe v3 (ENG-1222 P2, 2026-06-25). v3 REVERSES the 2026-06-12
  // flat-card decision (docs/decisions/2026-06-12-flat-card-surfaces.md, now
  // superseded by docs/decisions/2026-06-25-v3-card-lift-reversal.md): page-
  // ground resting cards LIFT off the white ground on a soft ambient shadow.
  // A flat white card on a white page is invisible — the lift IS the separation
  // (Grace, 2026-06-25: "the cards not being raised as in the prototype"). The
  // prototype floats white cards on white via `--shadow-card`; web already
  // mirrors this (`.card-slab*` → `--elev-card-soft`). This was the lone
  // platform laggard: `soft` silently no-op'd in light, so all ~39 surfaces
  // that already opt into soft rendered flat. Now real — UNGATED per Grace's
  // standing elevation directive ("turn everything on; never flag-gate again").
  //
  // DARK keeps the tonal lift (`liftBg: cardElevated`) instead of a shadow — RN
  // renders dark drop shadows poorly, so fill-based separation carries it (an
  // accepted platform deviation from web's dark `--elev-card-soft`).
  if (isDark) {
    return {
      shadowStyle: undefined,
      useBorder: false,
      liftBg: colors.cardElevated,
    };
  }

  return {
    shadowStyle: Elevation.cardSoft,
    useBorder: false,
    liftBg: undefined,
  };
}

/** Convenience: the hairline width consumers should use when `useBorder`. */
export const CARD_HAIRLINE = StyleSheet.hairlineWidth;
