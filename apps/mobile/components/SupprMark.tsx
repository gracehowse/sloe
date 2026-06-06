import * as React from "react";
import { Text, View, ViewStyle, StyleProp } from "react-native";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { FontFamily, MacroColors } from "@/constants/theme";

/**
 * Sloe brand mark — wordmark only (2026-06-04 Grace decision).
 *
 * Lowercase "sloe" in Newsreader + plum (`MacroColors.calories`). No berry
 * glyph, no plate ring, no lockup. Historical `Suppr*` export names stay
 * until a rename pass.
 */

export interface SupprMarkProps {
  size?: number;
  /** Ignored — kept for backward-compatible call-sites. */
  background?: string;
  /** Ignored — kept for backward-compatible call-sites. */
  foreground?: string;
}

function sloeFontSize(size: number) {
  return Math.round(size * 0.72);
}

function SloeWordmarkText({ size = 28 }: { size?: number }) {
  return (
    <Text
      accessibilityRole="image"
      accessibilityLabel="Sloe"
      style={{
        fontFamily: FontFamily.serifRegular,
        fontSize: sloeFontSize(size),
        color: MacroColors.calories,
        fontWeight: "500",
        letterSpacing: -0.4,
        includeFontPadding: false,
      }}
    >
      sloe
    </Text>
  );
}

/** Compact Sloe wordmark — canonical brand mark entry point (mobile). */
export function SupprMark({ size = 32 }: SupprMarkProps) {
  return <SloeWordmarkText size={size} />;
}

export interface SupprWordmarkProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function SupprWordmark({ size = 28, style }: SupprWordmarkProps) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Sloe"
      style={[{ flexDirection: "row", alignItems: "center" }, style]}
    >
      <SloeWordmarkText size={size} />
    </View>
  );
}

/** @deprecated Alias — plate motif retired; renders the Sloe wordmark. */
export function SupprPlateMark(props: SupprMarkProps) {
  return <SupprMark {...props} />;
}

export function SupprPlateWordmark({ size = 28, style }: SupprWordmarkProps) {
  return <SupprWordmark size={size} style={style} />;
}

export default SupprMark;
