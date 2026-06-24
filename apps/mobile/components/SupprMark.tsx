import * as React from "react";
import { Text, View, ViewStyle, StyleProp } from "react-native";
import { FontFamily } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Sloe brand mark — wordmark only.
 *
 * Lowercase "sloe" in **Fraunces Light** + plum (scheme-resolved). No berry
 * glyph, no plate ring, no lockup. Family + casing + weight match the v3
 * prototype's LOCKED type-split (Fraunces = wordmark only; `.wordmark` =
 * lowercase, light ~360). Supersedes the 2026-06-08 Newsreader-semibold
 * capital-"Sloe" Figma treatment (Figma is no longer the source of truth —
 * 2026-06-24). Web parity: `src/app/components/ui/suppr-mark.tsx`. Historical
 * `Suppr*` export names stay until a rename pass.
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
  // ENG-1010: scheme-resolved plum (static plum near-vanishes on dark).
  const colors = useThemeColors();
  return (
    <Text
      // Accessible name stays the proper-noun brand ("Sloe"); the lowercase
      // is a purely visual wordmark treatment.
      accessibilityRole="image"
      accessibilityLabel="Sloe"
      style={{
        fontFamily: FontFamily.brand,
        fontSize: sloeFontSize(size),
        color: colors.navPrimary,
        fontWeight: "300",
        letterSpacing: sloeFontSize(size) * -0.01,
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
