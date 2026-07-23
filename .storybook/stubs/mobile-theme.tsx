/**
 * Lightweight ThemeProvider for mobile Storybook (react-native-web).
 * Avoids AsyncStorage + AppLaunchScreen from the real mobile theme context.
 */
import * as React from "react";
import {
  Accent,
  AccentWinGradient,
  Colors,
  type WinGradient,
} from "../../apps/mobile/constants/theme";

type ResolvedTheme = "light" | "dark";

type StoryThemeContextValue = {
  preference: ResolvedTheme;
  resolved: ResolvedTheme;
  colors: (typeof Colors)["light"];
  accent: typeof Accent;
  winGradient: WinGradient;
  setPreference: (p: ResolvedTheme) => void;
};

const StoryThemeContext = React.createContext<StoryThemeContextValue | null>(
  null,
);

export function MobileStoryThemeProvider({
  children,
  scheme = "light",
}: {
  children: React.ReactNode;
  scheme?: ResolvedTheme;
}) {
  const value = React.useMemo<StoryThemeContextValue>(
    () => ({
      preference: scheme,
      resolved: scheme,
      colors: Colors[scheme],
      accent: Accent,
      winGradient: AccentWinGradient,
      setPreference: () => undefined,
    }),
    [scheme],
  );

  return (
    <StoryThemeContext.Provider value={value}>
      {children}
    </StoryThemeContext.Provider>
  );
}

/** Drop-in stubs matching `@/context/theme` exports used by UI primitives. */
export function useTheme() {
  const ctx = React.useContext(StoryThemeContext);
  if (!ctx) {
    throw new Error("MobileStoryThemeProvider required for mobile stories");
  }
  return ctx;
}

export function useAccent() {
  return useTheme().accent;
}

export function useResolvedScheme(): ResolvedTheme {
  return useTheme().resolved;
}

export function useWinGradient(): WinGradient {
  return useTheme().winGradient;
}
