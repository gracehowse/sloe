import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { SupprPlateWordmark } from "@/components/SupprMark";
import { Colors, Spacing } from "@/constants/theme";
import type { ResolvedTheme } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

type ThemeColors = typeof Colors.light;

export type AppLaunchScreenProps = {
  /** Short status line under the spinner — keep calm, not technical. */
  message?: string;
  /** Boot gate in `ThemeProvider` runs before context exists — pass scheme explicitly. */
  scheme?: ResolvedTheme;
  /** Optional override when rendering outside `ThemeProvider`. */
  colors?: ThemeColors;
};

/**
 * Branded cold-start / auth gate — replaces bare spinners and the
 * faint native splash gap. Matches Today’s warm cream + plate mark.
 */
export function AppLaunchScreen({
  message = "Loading…",
  scheme,
  colors: colorsOverride,
}: AppLaunchScreenProps) {
  const themeColors = useThemeColors();
  const colors: ThemeColors =
    colorsOverride ??
    (scheme ? (scheme === "light" ? Colors.light : Colors.dark) : themeColors);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: Spacing.xl,
      }}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <SupprPlateWordmark size={48} />
      <ActivityIndicator
        size="small"
        color={colors.tint}
        style={{ marginTop: Spacing.xl }}
      />
      <Text
        style={{
          marginTop: Spacing.md,
          fontSize: 15,
          lineHeight: 20,
          color: colors.textSecondary,
          fontWeight: "500",
          textAlign: "center",
        }}
      >
        {message}
      </Text>
    </View>
  );
}
