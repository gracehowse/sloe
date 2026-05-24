import * as React from "react";
import { View, Text } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { Brand } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Circular profile avatar — default **ink** fill (premium chrome).
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
}: {
  size: number;
  initial: string;
  fontSize: number;
  borderColor?: string;
  gradientIdSuffix: string;
  variant?: "ink" | "brand";
}) {
  const colors = useThemeColors();

  if (variant === "ink") {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.icon,
          borderWidth: borderColor ? 1 : 0,
          borderColor,
        }}
        accessible={false}
      >
        <Text
          style={{
            fontSize,
            fontWeight: "700",
            color: colors.primaryForeground,
          }}
        >
          {initial}
        </Text>
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
      <Text style={{ fontSize, fontWeight: "700", color: "#fff" }}>
        {initial}
      </Text>
    </View>
  );
}
