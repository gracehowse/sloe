import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppLaunchScreen } from "@/components/AppLaunchScreen";
import {
  Accent,
  AccentWinGradient,
  Colors,
  type WinGradient,
} from "@/constants/theme";

export type ThemePreference = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

/** The Frost secondary-colour exploration (`brand_frost_secondary`, ENG-997)
 *  was RETIRED 2026-06-08 (brand-manager): Clay `#C8794E` is now the
 *  UNCONDITIONAL functional accent. `accent` / `winGradient` below always
 *  resolve to the clay palette; the flag read + PostHog/forced-flag listener
 *  and the web `.flag-frost` mirror were removed in the same change. The
 *  `accent` / `winGradient` shape on the context (and `useAccent()` /
 *  `useWinGradient()`) is kept so the ~90 migrated consumers keep working —
 *  they now simply always get clay. */

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  colors: typeof Colors.dark;
  setPreference: (pref: ThemePreference) => void;
  /** Functional secondary accent — always clay `Accent` (the Frost flag is
   *  retired). Migrated high-visibility consumers read this via {@link
   *  useAccent}; the long tail imports `Accent` directly (also clay). */
  accent: typeof Accent;
  /** Win-moment gradient stops — always the clay Sloe brand gradient. */
  winGradient: WinGradient;
};

const STORAGE_KEY = "suppr_theme";

const ThemeContext = createContext<ThemeContextValue>({
  preference: "auto",
  resolved: "dark",
  colors: Colors.dark,
  setPreference: () => {},
  accent: Accent,
  winGradient: AccentWinGradient,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("auto");
  // Start open — preference hydrates in the background. Blocking here stacked
  // with FontGate and left some devices on the logo screen for seconds+.
  const [loaded, setLoaded] = useState(true);

  // Load saved preference — never hang boot: if AsyncStorage stalls (seen
  // on some devices), `loaded` must still flip or the whole tree stays
  // `null` and the user sees an endless blank screen above the tab bar.
  useEffect(() => {
    let cancelled = false;
    const BOOT_STORAGE_TIMEOUT_MS = 3000;
    const timer = setTimeout(() => {
      if (!cancelled) setLoaded(true);
    }, BOOT_STORAGE_TIMEOUT_MS);

    void AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        if (cancelled) return;
        if (val === "light" || val === "dark" || val === "auto") {
          setPreferenceState(val);
        }
      })
      .catch(() => {
        /* keep defaults */
      })
      .finally(() => {
        clearTimeout(timer);
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref);
  }, []);

  const resolved: ResolvedTheme =
    preference === "auto"
      ? (systemScheme === "light" ? "light" : "dark")
      : preference;

  const colors = resolved === "light" ? Colors.light : Colors.dark;

  // Clay is the unconditional functional accent (Frost flag retired, ENG-997).
  const accent = Accent;
  const winGradient = AccentWinGradient;

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, colors, setPreference, accent, winGradient }),
    [preference, resolved, colors, setPreference, accent, winGradient],
  );

  if (!loaded) {
    const bootScheme: ResolvedTheme =
      systemScheme === "light" ? "light" : "dark";
    return (
      <AppLaunchScreen scheme={bootScheme} message="Starting Sloe…" />
    );
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Functional secondary-accent palette — always clay `Accent` (the Frost flag
 *  is retired; clay is the unconditional accent, ENG-997). Use this in
 *  high-visibility accent consumers (primary buttons, tab active tint, FAB glow,
 *  links, win-moment gradient); the long tail imports `Accent` directly (also
 *  clay). Carbs/sugar/status/nav/honey are NOT secondary-accent and must keep
 *  their own (`MacroColors`, `Accent.warning`, `navPrimary`, `Accent.activity`,
 *  …) imports regardless of this hook. */
export function useAccent(): typeof Accent {
  return useContext(ThemeContext).accent;
}

/** Win-moment gradient — always the clay Sloe brand gradient (Frost retired). */
export function useWinGradient(): WinGradient {
  return useContext(ThemeContext).winGradient;
}
