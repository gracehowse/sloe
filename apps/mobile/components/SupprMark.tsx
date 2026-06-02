import * as React from "react";
import { View, ViewStyle, StyleProp, Text } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";

/**
 * SupprMark — the single canonical brand mark entry point for mobile.
 *
 * ENG-797 (design-direction 2026-05-31): the product previously shipped
 * THREE mark treatments. `SupprPlateMark` (the concentric-ring "empty
 * plate" motif) is now the one canonical mark per the approved
 * prototype direction. `SupprMark` is the canonical entry point every
 * consumer calls; when the `design_system_brandmark` flag is on it
 * renders the canonical ring motif, otherwise it falls back to the
 * legacy S-glyph so the old path stays alive until the flag is at 100%.
 *
 * 2026-05-19: Logo is black-on-cream (light) and white-on-black (dark),
 * not brand blue. Mirrors web `suppr-mark.tsx` + `--brand-mark-*` tokens.
 */

export interface SupprMarkProps {
  size?: number;
  /** Override tile fill (defaults to theme background / off-white). */
  background?: string;
  /** Override glyph / ring colour (defaults to theme brandMarkRing). */
  foreground?: string;
}

/**
 * @deprecated The S-glyph mark is the non-canonical variant (ENG-797).
 * Use the ring motif (`SupprPlateMark`) for all new call-sites. This
 * renderer is kept only as the flag-off fallback inside `SupprMark`.
 */
function SupprGlyphMark({
  size = 32,
  background,
  foreground,
}: SupprMarkProps) {
  const colors = useThemeColors();
  const tileBg = background ?? colors.background;
  const glyph = foreground ?? colors.brandMarkRing;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel="Suppr"
    >
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Rect width="32" height="32" rx="8" fill={tileBg} />
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
            color: glyph,
            fontSize: Math.round(size * 0.625),
            fontWeight: "800",
            letterSpacing: -0.5,
            includeFontPadding: false,
            marginTop: -Math.round(size * 0.04),
          }}
        >
          S
        </Text>
      </View>
    </View>
  );
}

/**
 * SupprMark — canonical brand mark entry point (ENG-797).
 *
 * Renders the canonical ring motif when `design_system_brandmark` is
 * enabled; falls back to the legacy S-glyph otherwise. Existing
 * call-sites need no change — the flag flips the visual.
 */
export function SupprMark(props: SupprMarkProps) {
  if (isFeatureEnabled("design_system_brandmark")) {
    return <SupprPlateMark {...props} />;
  }
  return <SupprGlyphMark {...props} />;
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
          fontSize: Math.round(size * 0.72),
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

/** Empty-plate mark — concentric rings on cream / black tile. */
export function SupprPlateMark({ size = 32, background, foreground }: SupprMarkProps) {
  const colors = useThemeColors();
  const tileBg = background ?? colors.background;
  const ring = foreground ?? colors.brandMarkRing;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel="Suppr"
    >
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Rect width="32" height="32" rx="8" fill={tileBg} />
        <Circle
          cx="16"
          cy="16"
          r="9.5"
          stroke={ring}
          strokeWidth="2"
          fill="none"
          opacity={0.95}
        />
        <Circle
          cx="16"
          cy="16"
          r="5.5"
          stroke={ring}
          strokeWidth="1"
          fill="none"
          opacity={0.35}
        />
      </Svg>
    </View>
  );
}

export function SupprPlateWordmark({ size = 28, style }: SupprWordmarkProps) {
  const colors = useThemeColors();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Suppr"
      style={[{ flexDirection: "row", alignItems: "center", gap: 10 }, style]}
    >
      <SupprPlateMark size={size} />
      <Text
        style={{
          color: colors.text,
          fontSize: Math.round(size * 0.72),
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
