import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { SloeLaunchWordmark } from "@/components/SloeLaunchWordmark";
import { Colors, Spacing } from "@/constants/theme";
import type { ResolvedTheme } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

type ThemeColors = typeof Colors.light;

/**
 * Splash continuity colours — MUST match the native splash background colorset
 * (ios/Suppr/Images.xcassets/SplashScreenBackground.colorset, kept in sync by
 * apps/mobile/scripts/sync-ios-brand-assets.mjs) and the expo-splash-screen
 * config in app.json. Using these (not the theme page background) makes the
 * native-splash → JS-boot handoff seamless, so the cream/plum field holds
 * steady until the real app content is ready.
 */
const SPLASH_BG = { light: "#FBF8F3", dark: "#3B2A4D" } as const;
/** Spinner colour that contrasts with each splash field (plum on cream, cream on plum). */
const SPLASH_SPINNER = { light: "#3B2A4D", dark: "#F5F3F4" } as const;

export type AppLaunchScreenProps = {
  /** Short status line under the spinner — keep calm, not technical. */
  message?: string;
  /** Boot gate in `ThemeProvider` runs before context exists — pass scheme explicitly. */
  scheme?: ResolvedTheme;
  /** Optional override when rendering outside `ThemeProvider`. */
  colors?: ThemeColors;
};

/**
 * Branded cold-start / auth gate — replaces bare spinners and the faint native
 * splash gap. Renders the same Fraunces "sloe" wordmark on the same cream/plum
 * field as the native splash, so the two are visually continuous.
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
  const isDark = colors.background === Colors.dark.background;
  const splashBackground = isDark ? SPLASH_BG.dark : SPLASH_BG.light;
  const spinnerColor = isDark ? SPLASH_SPINNER.dark : SPLASH_SPINNER.light;
  const messageColor = isDark ? "#D9D5DC" : "#6A6072";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: splashBackground,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: Spacing.xl,
      }}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <SloeLaunchWordmark width={200} />
      <ActivityIndicator
        size="small"
        color={spinnerColor}
        style={{ marginTop: Spacing.xl }}
      />
      <Text
        style={{
          marginTop: Spacing.md,
          fontSize: 15,
          lineHeight: 20,
          color: messageColor,
          fontWeight: "500",
          textAlign: "center",
        }}
      >
        {message}
      </Text>
    </View>
  );
}
