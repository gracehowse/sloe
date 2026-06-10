import { useEffect, useLayoutEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
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
 * Loads Newsreader + Inter for branded UI. Does **not** block the router tree —
 * blocking here previously stacked with `ThemeProvider` + auth gates and, via a
 * require cycle through `AppLaunchScreen`, could strand cold boot on the logo.
 */
export function FontGate({ children }: { children: React.ReactNode }) {
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

  return children;
}
