import React from "react";
import { ActivityIndicator, Text, useColorScheme, View } from "react-native";

import { SloeLaunchWordmark } from "@/components/SloeLaunchWordmark";
import { Accent, Colors, Spacing, Type } from "@/constants/theme";

type ThemeColors = typeof Colors.light;
export type LaunchScheme = "light" | "dark";

/**
 * Splash continuity colours — MUST match the native splash background colorset
 * (ios/Suppr/Images.xcassets/SplashScreenBackground.colorset, kept in sync by
 * apps/mobile/scripts/sync-ios-brand-assets.mjs) and the expo-splash-screen
 * config in app.json. Using these (not the theme page background) makes the
 * native-splash → JS-boot handoff seamless, so the cream/plum field holds
 * steady until the real app content is ready.
 */
// ENG-1013 (2026-06-10): three of these six splash hexes equal theme tokens, so
// they reference them statically (#3B2A4D = Accent.primary, #F5F3F4 =
// Colors.dark.text, #6A6072 = Colors.light.textSecondary). The two that match no
// token (#FBF8F3 cream, #D9D5DC) stay literal with the app.json cross-ref above,
// since they MUST mirror the native splash colorset, not the product palette.
const SPLASH_BG = { light: "#FBF8F3", dark: Accent.primary } as const;
/** Spinner colour that contrasts with each splash field (plum on cream, cream on plum). */
const SPLASH_SPINNER = { light: Accent.primary, dark: Colors.dark.text } as const;

export type AppLaunchScreenProps = {
  /** Short status line under the spinner — keep calm, not technical. */
  message?: string;
  /** Boot gates run before `ThemeProvider` — pass scheme explicitly when known. */
  scheme?: LaunchScheme;
  /** Optional override when rendering outside `ThemeProvider`. */
  colors?: ThemeColors;
};

/**
 * Branded cold-start / auth gate — replaces bare spinners and the faint native
 * splash gap. Renders the same Fraunces "sloe" wordmark on the same cream/plum
 * field as the native splash, so the two are visually continuous.
 *
 * Intentionally does NOT import `useThemeColors` / `context/theme` — that
 * created a require cycle (theme → AppLaunchScreen → use-theme-colors → theme)
 * that could strand cold boot on the native logo screen with uninitialized modules.
 */
export function AppLaunchScreen({
  message = "Loading…",
  scheme,
  colors: colorsOverride,
}: AppLaunchScreenProps) {
  const systemScheme = useColorScheme();
  const resolvedScheme: LaunchScheme =
    scheme ?? (systemScheme === "light" ? "light" : "dark");
  const colors: ThemeColors =
    colorsOverride ??
    (resolvedScheme === "light" ? Colors.light : Colors.dark);
  const isDark = colors.background === Colors.dark.background;
  const splashBackground = isDark ? SPLASH_BG.dark : SPLASH_BG.light;
  const spinnerColor = isDark ? SPLASH_SPINNER.dark : SPLASH_SPINNER.light;
  const messageColor = isDark ? "#D9D5DC" : Colors.light.textSecondary;

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
          ...Type.bodyLarge,
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
