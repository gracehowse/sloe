import * as React from "react";
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Elevation, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

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

  const toneStyle = computeToneStyle(tone, gradient, border, colors);
  const elev = elevationStyle[elevation];

  return (
    <View
      testID={testID}
      accessibilityRole={Platform.OS === "web" ? undefined : undefined}
      style={[
        styles.base,
        {
          padding: paddingValues[padding],
          borderRadius: radiusValues[radius],
          borderWidth: border ? StyleSheet.hairlineWidth : 0,
        },
        toneStyle,
        elev,
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
        backgroundColor: "rgba(224, 72, 136, 0.08)",
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
