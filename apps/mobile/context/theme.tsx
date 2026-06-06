import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppLaunchScreen } from "@/components/AppLaunchScreen";
import { Colors } from "@/constants/theme";

export type ThemePreference = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  colors: typeof Colors.dark;
  setPreference: (pref: ThemePreference) => void;
};

const STORAGE_KEY = "suppr_theme";

const ThemeContext = createContext<ThemeContextValue>({
  preference: "auto",
  resolved: "dark",
  colors: Colors.dark,
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("auto");
  const [loaded, setLoaded] = useState(false);

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

  if (!loaded) {
    const bootScheme: ResolvedTheme =
      systemScheme === "light" ? "light" : "dark";
    return (
      <AppLaunchScreen scheme={bootScheme} message="Starting Sloe…" />
    );
  }

  return (
    <ThemeContext.Provider value={{ preference, resolved, colors, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
