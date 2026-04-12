import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/theme";

export type ThemePreference = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  colors: typeof Colors.dark;
  setPreference: (pref: ThemePreference) => void;
};

const STORAGE_KEY = "platemate_theme";

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

  // Load saved preference
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "light" || val === "dark" || val === "auto") {
        setPreferenceState(val);
      }
      setLoaded(true);
    });
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

  // Don't render until we've loaded the preference to avoid flash
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ preference, resolved, colors, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
