import * as React from "react";
import { View, ViewStyle, StyleProp, Text } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { Accent } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * SupprMark — the rounded-square "S" brand mark for mobile.
 *
 * Mirrors the web component at `src/app/components/ui/suppr-mark.tsx`.
 * Always blue background with white "S" regardless of theme — matches
 * `public/logo-mark.svg` and `docs/ux/brand-guidelines.md`.
 */

export interface SupprMarkProps {
  size?: number;
  /** Override the background colour (defaults to brand primary). */
  background?: string;
  /** Override the letter colour (defaults to white). */
  foreground?: string;
}

export function SupprMark({
  size = 32,
  background = Accent.primary,
  foreground = "#ffffff",
}: SupprMarkProps) {
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel="Suppr"
    >
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Rect width="32" height="32" rx="8" fill={background} />
      </Svg>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
        pointerEvents="none"
      >
        <Text
          style={{
            color: foreground,
            fontSize: Math.round(size * 0.625),
            fontWeight: "800",
            letterSpacing: -0.5,
            includeFontPadding: false,
            // Slight optical lift to match web SVG baseline.
            marginTop: -Math.round(size * 0.04),
          }}
        >
          S
        </Text>
      </View>
    </View>
  );
}

export interface SupprWordmarkProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function SupprWordmark({ size = 28, style }: SupprWordmarkProps) {
  const colors = useThemeColors();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Suppr"
      style={[{ flexDirection: "row", alignItems: "center", gap: 10 }, style]}
    >
      <SupprMark size={size} />
      <Text
        style={{
          color: colors.text,
          fontSize: Math.round(size * 0.64),
          fontWeight: "700",
          letterSpacing: -0.4,
          includeFontPadding: false,
        }}
      >
        Suppr
      </Text>
    </View>
  );
}

export default SupprMark;
