import * as React from "react";
import { View, Text } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { Accent, Brand, FontFamily, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Rule 7 monogram treatments (DESIGN-CONSTITUTION.md, `docs/ux/redesign/v3/`):
 * "People may use serif initials only with the frost-ring treatment, as a
 * stated placeholder until real photography lands." `"legacy"` (default) is
 * today's sans initial, no ring — unchanged rendering. `"frostRing"` is the
 * Rule 7-compliant treatment; ships behind `avatar_monogram_frost_ring_v1`
 * (ENG-1593, default-OFF) — gate at the call site, this prop is
 * presentation-only and carries no flag knowledge itself.
 */
export type AvatarMonogramTreatment = "legacy" | "frostRing";

/** Frost-ring geometry — lifted verbatim from the ratified prototype spec
 *  (`docs/ux/redesign/v3/Sloe-App.html` L1728, the "placeholder kill" rule):
 *  `box-shadow: 0 0 0 2px var(--card), 0 0 0 3.5px var(--accent-frost)` — a
 *  2px card-coloured gap ring, then a 3.5px frost ring. Sub-4px
 *  micro-decoration mirroring a ratified source spec, not an inter-element
 *  rhythm value — same carve-out class as the Rule 6a corollary's exempted
 *  underline indicators, so intentionally off the `Spacing` scale. Driven
 *  via `width`/`height` (not `padding`/`margin`/`gap`), so
 *  `check:spacing-scale` — which only scans those props — never flags it. */
const FROST_RING_GAP = 2;
const FROST_RING_WIDTH = 3.5;

/**
 * Circular profile avatar — default **identity** fill: solid damson
 * (`Accent.purple`, Figma `654:6`) + white initial. The ONE identity fill
 * per the S5 avatar ruling (2026-07-10, ENG-1375) — the old grey-ink
 * default is retired. Web twin: `src/app/components/ui/avatar-disc.tsx`.
 * `variant="brand"` keeps the blue→magenta gradient for marketing-only
 * surfaces; product UI should use the default.
 */
export function GradientAvatar({
  size,
  initial,
  fontSize,
  borderColor,
  gradientIdSuffix,
  variant = "ink",
  fill,
  textColor,
  treatment = "legacy",
}: {
  size: number;
  initial: string;
  fontSize: number;
  borderColor?: string;
  gradientIdSuffix: string;
  variant?: "ink" | "brand";
  /** Optional solid fill override for the identity (`ink`) variant —
   *  defaults to the damson identity fill. No effect on `brand`. */
  fill?: string;
  /** Optional initial-text colour override (pairs with `fill`). */
  textColor?: string;
  /** Rule 7 monogram treatment — `"legacy"` (default, unchanged) or
   *  `"frostRing"` (serif initial + the prototype's double-ring halo). No
   *  effect on `brand`. See `AvatarMonogramTreatment`. */
  treatment?: AvatarMonogramTreatment;
}) {
  const colors = useThemeColors();

  if (variant === "ink") {
    const frostRing = treatment === "frostRing";
    const circle = (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: Radius.full,
          alignItems: "center",
          justifyContent: "center",
          // S5 (ENG-1375): identity default = solid damson, was colors.icon.
          backgroundColor: fill ?? Accent.purple,
          borderWidth: borderColor ? 1 : 0,
          borderColor,
        }}
        accessible={false}
      >
        <Text
          style={{
            fontSize,
            // Rule 7: serif initial only under the frost-ring treatment —
            // the legacy sans initial stays sans (no ring to pair it with).
            fontFamily: frostRing ? FontFamily.serifMedium : undefined,
            fontWeight: frostRing ? "500" : "700",
            color: textColor ?? colors.primaryForeground,
          }}
        >
          {initial}
        </Text>
      </View>
    );

    if (!frostRing) {
      return circle;
    }

    const gapSize = size + FROST_RING_GAP * 2;
    const ringSize = gapSize + FROST_RING_WIDTH * 2;
    return (
      <View
        style={{
          width: ringSize,
          height: ringSize,
          borderRadius: Radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: Accent.frost,
        }}
        accessible={false}
      >
        <View
          style={{
            width: gapSize,
            height: gapSize,
            borderRadius: Radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.card,
          }}
        >
          {circle}
        </View>
      </View>
    );
  }

  const gradientId = `suppr-avatar-grad-${gradientIdSuffix}`;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: borderColor ? 1 : 0,
        borderColor,
      }}
      accessible={false}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={Brand.primary} />
            <Stop offset="100%" stopColor={Brand.accent} />
          </LinearGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${gradientId})`} />
      </Svg>
      <Text style={{ fontSize, fontWeight: "700", color: colors.primaryForeground }}>
        {initial}
      </Text>
    </View>
  );
}
