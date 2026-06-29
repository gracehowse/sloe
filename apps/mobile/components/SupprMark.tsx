import * as React from "react";
import { Image, View, ViewStyle, StyleProp } from "react-native";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Sloe brand mark — wordmark only.
 *
 * Renders the **canonical splash logotype asset** (`splash-icon.png`, the
 * high-optical-size Fraunces "sloe"), re-tinted to scheme-resolved plum — NOT a
 * live font. A static Fraunces face can't reproduce the splash's dramatic
 * stroke contrast, so only the asset truly matches it (Grace 2026-06-26 — a
 * font-weight match still "looked nothing like" the splash). Web parity:
 * `src/app/components/ui/suppr-mark.tsx`. Historical `Suppr*` export names stay
 * until a rename pass.
 */

const SLOE_WORDMARK = require("@/assets/images/splash-icon.png");
/** Intrinsic aspect of the wordmark asset (3088×1661 → height / width). */
const WORDMARK_ASPECT = 1661 / 3088;

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
  const colors = useThemeColors();
  const height = Math.round(sloeFontSize(size) * 1.15);
  const width = Math.round(height / WORDMARK_ASPECT);
  return (
    <Image
      accessibilityRole="image"
      accessibilityLabel="Sloe"
      source={SLOE_WORDMARK}
      // Asset ships plum; re-tint to scheme-resolved nav ink (ENG-1010).
      tintColor={colors.navPrimary}
      resizeMode="contain"
      style={{ width, height }}
    />
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
