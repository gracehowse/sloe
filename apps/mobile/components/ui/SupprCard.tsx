import * as React from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Elevation, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useTheme } from "@/context/theme";
import { isFeatureEnabled } from "@/lib/analytics";

/**
 * Mobile `<SupprCard>` — single card primitive.
 *
 * Production design spec — 2026-04-27 §Part 3 "New components".
 * Mirror of `src/app/components/ui/suppr-card.tsx` (same prop names,
 * same variants, same defaults). Phase 1 ships the primitive only;
 * callers are NOT swept here.
 *
 * Variants:
 *  - `tone`: `neutral` (default) / `primary` / `success` / `warning` / `magenta`
 *  - `elevation`: `none` / `card` (default) / `sheet` / `float`
 *  - `gradient`: bool — when true + `tone='primary'`, the SupprCard
 *                 renders a subtle linear-gradient surface for the
 *                 north-star block.
 *  - `border`: bool (default true)
 *  - `padding`: `none` / `sm` (8) / `md` (12, default) / `lg` (16) / `xl` (20)
 *  - `radius`: `sm` / `md` / `lg` (default — Radius.lg = 16) / `xl`
 *
 * Note on gradient: RN does not support CSS-style linear-gradient
 * backgrounds natively. Phase 1 ships a tinted-flat fallback for the
 * north-star variant; Phase 2 swaps in `expo-linear-gradient` when the
 * `<NorthStarBlock>` lands. Documented at `docs/ux/design-tokens.md`.
 */

export type SupprCardTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "magenta";

export type SupprCardElevation = "none" | "card" | "sheet" | "float";

export type SupprCardPadding = "none" | "sm" | "md" | "lg" | "xl";

export type SupprCardRadius = "sm" | "md" | "lg" | "xl";

export interface SupprCardProps {
  tone?: SupprCardTone;
  elevation?: SupprCardElevation;
  gradient?: boolean;
  border?: boolean;
  padding?: SupprCardPadding;
  radius?: SupprCardRadius;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: React.ReactNode;
}

const paddingValues: Record<SupprCardPadding, number> = {
  none: 0,
  sm: Spacing.sm,
  md: Spacing.md,
  lg: Spacing.lg,
  xl: Spacing.xl,
};

const radiusValues: Record<SupprCardRadius, number> = {
  sm: Radius.sm,
  md: Radius.md,
  lg: Radius.lg,
  xl: Radius.xl,
};

const elevationStyle: Record<SupprCardElevation, ViewStyle | undefined> = {
  none: undefined,
  card: Elevation.card,
  sheet: Elevation.sheet,
  float: Elevation.float,
};

export function SupprCard({
  tone = "neutral",
  elevation = "card",
  gradient = false,
  border = true,
  padding = "md",
  radius = "lg",
  style,
  testID,
  children,
}: SupprCardProps) {
  const colors = useThemeColors();
  const { resolved } = useTheme();
  const isDark = resolved === "dark";

  // ENG-795 (Redesign): flag-gated soft elevation on resting cards.
  // Flag OFF → unchanged flat/hairline (2026-05-22 lock). Flag ON:
  //  - light → soft shadow, drawn on an OUTER wrapper because RN
  //    `overflow: hidden` (styles.base) clips iOS shadows; hairline dropped.
  //  - dark  → tonal lift (`cardElevated`) + a subtle hairline, no shadow
  //    (RN renders shadows poorly on dark surfaces).
  const softElevation =
    elevation === "card" && isFeatureEnabled("design_system_elevation");
  const effectiveBorder = softElevation ? isDark : border;
  const toneStyle = computeToneStyle(tone, gradient, effectiveBorder, colors);

  if (softElevation && !isDark) {
    return (
      <View
        testID={testID}
        style={[
          {
            borderRadius: radiusValues[radius],
            backgroundColor: toneStyle.backgroundColor,
          },
          Elevation.cardSoft,
          style,
        ]}
      >
        <View
          style={[
            styles.base,
            { padding: paddingValues[padding], borderRadius: radiusValues[radius] },
            toneStyle,
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  // Flag-off (flat/hairline) OR dark soft-elevation (tonal lift, no shadow).
  const neutralLift =
    softElevation && isDark && tone === "neutral"
      ? { backgroundColor: colors.cardElevated }
      : undefined;

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        {
          padding: paddingValues[padding],
          borderRadius: radiusValues[radius],
          borderWidth: effectiveBorder ? StyleSheet.hairlineWidth : 0,
        },
        toneStyle,
        neutralLift,
        softElevation ? undefined : elevationStyle[elevation],
        style,
      ]}
    >
      {children}
    </View>
  );
}

function computeToneStyle(
  tone: SupprCardTone,
  gradient: boolean,
  border: boolean,
  colors: ReturnType<typeof useThemeColors>,
): ViewStyle {
  if (tone === "primary" && gradient) {
    return {
      backgroundColor: colors.northStarBgFrom,
      borderColor: border ? colors.northStarBorder : "transparent",
    };
  }
  switch (tone) {
    case "primary":
      return {
        backgroundColor: colors.northStarBgFrom,
        borderColor: border ? colors.northStarBorder : "transparent",
      };
    case "success":
      return {
        backgroundColor: "rgba(34, 168, 96, 0.08)",
        borderColor: border ? colors.sourceUsda : "transparent",
      };
    case "warning":
      return {
        backgroundColor: colors.overBudgetSoft,
        borderColor: border ? colors.overBudgetFg : "transparent",
      };
    case "magenta":
      return {
        backgroundColor: "rgba(223, 94, 188, 0.08)",
        borderColor: border ? colors.sourceAi : "transparent",
      };
    case "neutral":
    default:
      return {
        backgroundColor: colors.card,
        borderColor: border ? colors.cardBorder : "transparent",
      };
  }
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
});

export default SupprCard;
