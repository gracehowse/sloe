import { useEffect, useLayoutEffect, useState } from "react";
import { View, useColorScheme } from "react-native";
import * as SplashScreen from "expo-splash-screen";

import { Colors } from "@/constants/theme";
import {
  useFonts,
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
} from "@expo-google-fonts/newsreader";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

function hideNativeSplash(): void {
  void SplashScreen.hideAsync().catch(() => {});
}

/**
 * Loads Newsreader + Inter for branded UI.
 *
 * 2026-06-10 (Grace's first-boot report): the non-blocking gate let the
 * login screen paint SYSTEM fonts for several seconds on a slow dev-tunnel
 * first load — the brand's first impression rendered unbranded. The gate
 * now holds children behind a theme-ground View until fonts resolve, with
 * a hard 4s timeout so the prior cold-boot strand class (ThemeProvider +
 * auth-gate stacking via AppLaunchScreen) cannot recur — after 4s we render
 * regardless and the System fallback covers it. Production builds bundle
 * fonts (ms load), so the hold is invisible outside dev.
 */
const FONT_HOLD_MAX_MS = 4000;

export function FontGate({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), FONT_HOLD_MAX_MS);
    return () => clearTimeout(t);
  }, []);
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useLayoutEffect(() => {
    hideNativeSplash();
  }, []);

  useEffect(() => {
    hideNativeSplash();
    const retry = setInterval(hideNativeSplash, 1500);
    return () => clearInterval(retry);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      hideNativeSplash();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError && !timedOut) {
    // Theme-ground hold — matches the splash so the wait reads as one
    // continuous launch, never a flash of unbranded type.
    return (
      <View
        style={{
          flex: 1,
          backgroundColor:
            scheme === "dark" ? Colors.dark.background : Colors.light.background,
        }}
      />
    );
  }

  return children;
}
