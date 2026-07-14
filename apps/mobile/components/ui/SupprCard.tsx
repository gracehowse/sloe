import * as React from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { withAlpha, Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";

/**
 * Mobile `<SupprCard>` — THE single card primitive.
 *
 * One card chrome across the whole app. Every resting card surface (Today
 * hero, macro tiles, meal-slot cards, planned meals, hydration/stimulants,
 * energy-balance, the Progress stat row + dashboard cards, …) renders its
 * CHROME through this component. Surfaces keep their own inner contents; only
 * the shell — fill, radius, border, and the soft lift — is unified here, so a
 * fix lands in ONE place and the cards can never drift apart again (the
 * recurring "each card looks slightly different" bug, Grace 2026-06-04).
 *
 * Mirror: `src/app/components/ui/suppr-card.tsx` (same prop names + variants).
 *
 * ── The Sloe card shell (the look this encapsulates) ──
 *   - fill `colors.card` (#F6F5F2 light) — the warm-grey card on the white page
 *   - `borderRadius: 24` (the Sloe rounded-card radius; `size="tile"` = 24 too —
 *     the Figma chosen Today rounds cards AND tiles to 24, borderless warm slabs)
 *   - a FLAT tonal slab by default (`lift="flat"`, Figma `654:2` — no shadow,
 *     no border). The elevated recipe-card surfaces (Discover, Library, recipe
 *     detail) opt into `lift="soft"`, which adds a SOFT DROP SHADOW on an OUTER
 *     wrapper + the corner-clip on an INNER view. iOS clips shadows under
 *     `overflow: 'hidden'`, so the shadow MUST live on a wrapper separate from
 *     the clip.
 *   - dark mode: no shadow (RN renders dark shadows poorly) — a tonal lift
 *     (`cardElevated`) + a hairline border carry the separation instead.
 *
 * The soft lift is UN-GATED (2026-06-04). It comes from `useCardElevation`,
 * the un-gated source of truth; the old `design_system_elevation` read was
 * removed — flag-FORCE is dead in a bundled app (ENG-840), so the gate could
 * never be exercised on the sim and only hid the lift from the founder.
 *
 * Variants:
 *  - `tone`: `neutral` (default) / `primary` / `success` / `warning` / `magenta`
 *  - `size`:
 *      - `card` (default — radius 24, flat + hairline, the top-level resting
 *        card; one card grammar ENG-1497)
 *      - `tile` (radius 24, padding `md`, for the 2×2 macro tiles)
 *      - `inset` (radius 12, hairline border — a sub-panel nested ON a card,
 *        e.g. the burn-breakdown + 7-day-rolling panels inside the
 *        energy-balance card; the 12-inside-24 concentric standard)
 *  - `gradient`: bool — north-star tinted surface when `tone='primary'`
 *  - `border`: bool (default true) — only drawn when the elevation treatment
 *              calls for it (an `inset` sub-panel, or a `soft` card in dark via
 *              `useBorder`); the flat slab and the light soft-lift both drop it
 *              (the fill / shadow is the separation)
 *  - `padding`: `none` / `sm` (8) / `md` (16) / `lg` (20, default) / `xl` (24)
 *  - `radius`: explicit override of the size default (`sm`/`md`/`lg`/`xl`)
 *
 * Note on gradient: RN has no CSS linear-gradient; the north-star variant uses
 * a tinted-flat fallback (`northStarBgFrom`). Documented at
 * `docs/ux/design-system.md`.
 */

export type SupprCardTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "magenta";

export type SupprCardSize = "card" | "tile" | "inset";

/** Resting-card lift. `flat` = default (Figma Today slab); `soft` = the opt-in
 *  ambient lift for elevated recipe-card surfaces. */
export type SupprCardLift = "soft" | "flat";

export type SupprCardPadding = "none" | "sm" | "md" | "lg" | "xl";

export type SupprCardRadius = "sm" | "md" | "lg" | "xl";

export interface SupprCardProps {
  tone?: SupprCardTone;
  size?: SupprCardSize;
  /** Resting lift. Defaults to `flat` (Figma `654:2` slab); the elevated
   *  recipe-card surfaces pass `soft` to float off the page. */
  lift?: SupprCardLift;
  gradient?: boolean;
  border?: boolean;
  padding?: SupprCardPadding;
  /** Override the size's default radius. Omit to use the size default
   *  (`card`, `tile` and `inset` all → 24). */
  radius?: SupprCardRadius;
  /** Applied to the OUTER node (where tests + Maestro expect the testID). */
  testID?: string;
  accessibilityLabel?: string;
  /** Merged onto the OUTER wrapper (margins, width, flex-basis live here). */
  style?: StyleProp<ViewStyle>;
  /** Merged onto the INNER (clipping) view — for inner-only layout like
   *  `alignItems` / `gap` that should sit inside the clip. */
  innerStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const paddingValues: Record<SupprCardPadding, number> = {
  none: 0,
  sm: Spacing.sm, // 8
  md: Spacing.md, // 16
  lg: Spacing.lg, // 20
  xl: Spacing.xl, // 24
};

const radiusValues: Record<SupprCardRadius, number> = {
  sm: Radius.sm,
  md: Radius.md,
  lg: Radius.lg,
  xl: Radius.xl,
};

/** The Sloe card radius (rounded-xl in the prototype, scaled to mobile). Not a
 *  `Radius` token — the token ladder tops out at `xl: 12` (pre-Sloe, tuned for
 *  Linear/Stripe density). The Sloe Figma chosen Today rounds cards AND tiles to
 *  24 (borderless warm slabs — Grace, 2026-06-04). Centralised here so every
 *  card shares the exact corner. */
/** One sheet radius (2026-06-10 decision: docs/decisions/2026-06-10-sheet-
 * radius-and-nested-inset-standard.md) — sheets share the card corner so
 * "lifted warm surface" reads as one material at rest or risen. Replaces
 * six live ad-hoc top-corner styles (8/12/18/20/24/28). */
export const SHEET_RADIUS = Radius.card; // 24
/** Nested/inset sub-panel radius (2026-06-10 decision, same doc): inner
 * radius ≈ outer minus padding (concentric-corner principle) — a 24-inside-24
 * panel at 16pt padding clashes. The old inset spec (24) had zero adoption
 * because it was optically wrong. */
export const INSET_RADIUS = Radius.xl; // 12

export const CARD_RADIUS = Radius.card; // 24 — ENG-1497: tokenised
export const TILE_RADIUS = Radius.card; // 24

export function SupprCard({
  tone = "neutral",
  size = "card",
  lift = "flat",
  gradient = false,
  border = true,
  padding,
  radius,
  testID,
  accessibilityLabel,
  style,
  innerStyle,
  children,
}: SupprCardProps) {
  const colors = useThemeColors();
  const elevation = useCardElevation({ variant: lift });

  const isInset = size === "inset";
  const cornerRadius =
    radius != null
      ? radiusValues[radius]
      : size === "card"
        ? CARD_RADIUS
        : isInset
          ? INSET_RADIUS // 12 — concentric inner corner (2026-06-10 decision)
          : TILE_RADIUS;
  // Tiles + insets default to a tighter padding; cards to the airy `lg`.
  const pad = paddingValues[padding ?? (size === "card" ? "lg" : "md")];

  // The light soft-lift `card` drops the border (the shadow IS the separation —
  // no double edge). Dark keeps the hairline (no shadow there). An `inset`
  // sub-panel ALWAYS draws the hairline (it sits on a card, so it has no lift to
  // separate it). A flat caller (border=false) opts out entirely.
  const showBorder = border && (isInset || elevation.useBorder);
  const tone_ = computeToneStyle(tone, gradient, colors);
  const fill = tone_.backgroundColor;

  // `inset` skips the elevation treatment entirely (no dark tonal lift) —
  // its hairline + fill are the separation, same as every resting card
  // under the one card grammar (ENG-1497).
  const outerShadow = isInset ? undefined : elevation.shadowStyle;
  const outerFill = isInset ? fill : elevation.liftBg ?? fill;

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[
        // OUTER wrapper — owns the soft shadow + the fill. The shadow MUST be
        // here (not on the inner clip) or iOS swallows it under overflow:hidden.
        {
          backgroundColor: outerFill,
          borderRadius: cornerRadius,
        },
        outerShadow,
        style,
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            borderRadius: cornerRadius,
            padding: pad,
            borderWidth: showBorder ? StyleSheet.hairlineWidth : 0,
            borderColor: tone_.borderColor,
          },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function computeToneStyle(
  tone: SupprCardTone,
  gradient: boolean,
  colors: ReturnType<typeof useThemeColors>,
): { backgroundColor: string; borderColor: string } {
  if (tone === "primary" && gradient) {
    return {
      backgroundColor: colors.northStarBgFrom,
      borderColor: colors.northStarBorder,
    };
  }
  switch (tone) {
    case "primary":
      return {
        backgroundColor: colors.northStarBgFrom,
        borderColor: colors.northStarBorder,
      };
    case "success":
      return {
        backgroundColor: withAlpha(Accent.success, 0x1A), // Accent.success @ ~10%
        borderColor: colors.sourceUsda,
      };
    case "warning":
      return {
        backgroundColor: colors.overBudgetSoft,
        borderColor: colors.overBudgetFg,
      };
    case "magenta":
      return {
        backgroundColor: withAlpha(Accent.win, 0x1A), // Sloe damson (Accent.win) @ ~10%
        borderColor: colors.sourceAi,
      };
    case "neutral":
    default:
      return {
        backgroundColor: colors.card,
        borderColor: colors.border,
      };
  }
}

const styles = StyleSheet.create({
  inner: {
    overflow: "hidden",
  },
});

export default SupprCard;
