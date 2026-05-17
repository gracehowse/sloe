import * as React from "react";
import { View, ViewStyle, StyleProp, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Brand mark — the Tare bowl (two concentric circles).
 *
 * Component is still exported as `SupprMark` to avoid touching every
 * import site during the suppr → tare rebrand; the visual content is
 * the new mark. Mirrors `src/app/components/ui/suppr-mark.tsx`. The
 * canonical SVG lives at `docs/brand/tare/mark.svg`.
 *
 * Stroke colour follows `colors.text` so the mark inverts cleanly
 * between light + dark themes (ink on cream, cream on ink). Override
 * via the `color` prop for fixed-tone surfaces (splash, paywall hero).
 */

export interface SupprMarkProps {
  size?: number;
  /** Override the stroke colour (defaults to themed text colour). */
  color?: string;
  /** Legacy aliases kept so existing callsites don't break — the new
   *  mark is a stroked outline; background/foreground are mapped to a
   *  single `color` (foreground takes precedence). */
  background?: string;
  foreground?: string;
}

export function SupprMark({
  size = 32,
  color,
  background,
  foreground,
}: SupprMarkProps) {
  const colors = useThemeColors();
  const stroke = color ?? foreground ?? background ?? colors.text;
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel="Tare"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle
          cx={50}
          cy={50}
          r={40}
          fill="none"
          stroke={stroke}
          strokeWidth={6}
        />
        <Circle
          cx={50}
          cy={50}
          r={24}
          fill="none"
          stroke={stroke}
          strokeWidth={3.5}
        />
      </Svg>
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
      accessibilityLabel="Tare"
      style={[{ flexDirection: "row", alignItems: "center", gap: 10 }, style]}
    >
      <SupprMark size={size} />
      <Text
        style={{
          color: colors.text,
          // Tare wordmark setting (docs/brand/tare/README.md):
          // Inter Medium 500, uppercase, letter-spacing 0.42em. Mobile
          // RN doesn't accept em units in letterSpacing — convert to
          // px from the rendered font size.
          fontSize: Math.round(size * 0.55),
          fontWeight: "500",
          letterSpacing: Math.round(size * 0.55 * 0.42),
          textTransform: "uppercase",
          includeFontPadding: false,
        }}
      >
        Tare
      </Text>
    </View>
  );
}

export default SupprMark;
