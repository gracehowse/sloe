import React, { createContext, useContext, useMemo } from "react";

import {
  Accent,
  AccentWinGradient,
  Colors,
  type WinGradient,
} from "@/constants/theme";
import type { ResolvedTheme, ThemePreference } from "@/context/theme";

const DARK_ACCENT: typeof Accent = {
  ...Accent,
  primary: Accent.primaryDark,
  primaryLight: Accent.purpleLight,
  primarySolid: Accent.primarySolidDark,
  primarySoft: Accent.primarySoftDark,
  primarySoftStrong: Accent.primarySoftStrongDark,
  brandBlue: Accent.primaryDark,
  brandBlueLight: Accent.purpleLight,
  cyanSolid: Accent.cyanSolidDark,
  successSolid: Accent.successSolidDark,
  alcoholSolid: Accent.alcoholSolidDark,
  successSoft: Accent.successSoftDark,
  successSoftStrong: Accent.successSoftStrongDark,
  warningSoft: Accent.warningSoftDark,
  warningSoftStrong: Accent.warningSoftStrongDark,
  destructiveSoft: Accent.destructiveSoftDark,
  destructiveSoftStrong: Accent.destructiveSoftStrongDark,
  cyanSoft: Accent.cyanSoftDark,
  cyanSoftStrong: Accent.cyanSoftStrongDark,
  infoSoft: Accent.infoSoftDark,
  infoSoftStrong: Accent.infoSoftStrongDark,
  winSoft: Accent.winSoftDark,
  winSoftStrong: Accent.winSoftStrongDark,
};

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  colors: typeof Colors.dark;
  setPreference: (pref: ThemePreference) => void;
  accent: typeof Accent;
  winGradient: WinGradient;
  isProviderMounted: boolean;
};

const noop = () => {};

const ThemeContext = createContext<ThemeContextValue>({
  preference: "light",
  resolved: "light",
  colors: Colors.light,
  setPreference: noop,
  accent: Accent,
  winGradient: AccentWinGradient,
  isProviderMounted: false,
});

/** Storybook-only ThemeProvider — sync, no AsyncStorage boot gate. */
export function ThemeProvider({
  scheme,
  children,
}: {
  scheme: ResolvedTheme;
  children: React.ReactNode;
}) {
  const colors = scheme === "light" ? Colors.light : Colors.dark;
  const accent = scheme === "dark" ? DARK_ACCENT : Accent;

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference: scheme,
      resolved: scheme,
      colors,
      setPreference: noop,
      accent,
      winGradient: AccentWinGradient,
      isProviderMounted: true,
    }),
    [scheme, colors, accent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useResolvedScheme(): ResolvedTheme {
  const ctx = useContext(ThemeContext);
  return ctx.isProviderMounted ? ctx.resolved : "light";
}

export function useAccent(): typeof Accent {
  return useContext(ThemeContext).accent;
}

export function useWinGradient(): WinGradient {
  return useContext(ThemeContext).winGradient;
}

export type { ResolvedTheme, ThemePreference };
