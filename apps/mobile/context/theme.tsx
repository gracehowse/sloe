import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppLaunchScreen } from "@/components/AppLaunchScreen";
import {
  Accent,
  AccentFrost,
  AccentWinGradient,
  AccentWinGradientFrost,
  Colors,
  type WinGradient,
} from "@/constants/theme";
import { getPostHogClient, isFeatureEnabled } from "@/lib/analytics";

export type ThemePreference = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

/** Frost secondary-colour exploration flag (`brand_frost_secondary`). When ON,
 *  the accent moves clay → Damson via `AccentFrost`. NOT in `REDESIGN_DEFAULT_ON`
 *  — the clay `Accent` is the default and ramps later via PostHog. Web mirror:
 *  the `.flag-frost` class on `<html>` (`FrostFlagToggle`). */
const FROST_FLAG = "brand_frost_secondary";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  colors: typeof Colors.dark;
  setPreference: (pref: ThemePreference) => void;
  /** Active secondary-accent palette — `AccentFrost` when `brand_frost_secondary`
   *  is ON, else clay `Accent`. Migrated high-visibility consumers read this via
   *  {@link useAccent}; the long tail still imports `Accent` directly (= clay)
   *  until the flag proves out. */
  accent: typeof Accent;
  /** Win-moment gradient stops — Frost variant when the flag is ON. */
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

  // Frost flag — read through the central `isFeatureEnabled` so the dev-force
  // layer + `REDESIGN_DEFAULT_ON` parity are honoured (same source of truth as
  // every other mobile consumer). PostHog resolves flags asynchronously after
  // boot, so seed with the mount read and re-read when flags arrive — mirrors
  // the web `posthog.onFeatureFlags` re-sync in `FrostFlagToggle`.
  const [frostOn, setFrostOn] = useState<boolean>(() => isFeatureEnabled(FROST_FLAG));

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      setFrostOn(isFeatureEnabled(FROST_FLAG));
    };
    sync();
    let unsub: (() => void) | undefined;
    try {
      // `onFeatureFlags` is a real runtime method on the posthog-react-native
      // client (it's what the SDK's own `useFeatureFlags` hook subscribes to)
      // but it's absent from the package's published `.d.ts`, so narrow to the
      // method shape rather than assert the whole client type.
      const client = getPostHogClient() as
        | { onFeatureFlags?: (cb: () => void) => (() => void) | undefined }
        | null;
      unsub = client?.onFeatureFlags?.(() => sync());
    } catch {
      /* PostHog cold / consent declined — mount read stands */
    }
    return () => {
      cancelled = true;
      try {
        unsub?.();
      } catch {
        /* noop */
      }
    };
  }, []);

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

  const accent = frostOn ? AccentFrost : Accent;
  const winGradient = frostOn ? AccentWinGradientFrost : AccentWinGradient;

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

/** Active secondary-accent palette — `AccentFrost` when `brand_frost_secondary`
 *  is ON, else clay `Accent`. Use this in high-visibility accent consumers
 *  (primary buttons, tab active tint, FAB glow, links, win-moment gradient) so
 *  the Frost flag flips them in lockstep; the long tail keeps importing `Accent`
 *  directly (= clay) until the flag proves out. Carbs/sugar/status/nav/honey are
 *  NOT secondary-accent and must keep their own (`MacroColors`, `Accent.warning`,
 *  `navPrimary`, `Accent.activity`, …) imports regardless of this hook. */
export function useAccent(): typeof Accent {
  return useContext(ThemeContext).accent;
}

/** Active win-moment gradient — Frost variant when the flag is ON. */
export function useWinGradient(): WinGradient {
  return useContext(ThemeContext).winGradient;
}
