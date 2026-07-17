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
 *  was RETIRED 2026-06-08 (brand-manager). The accent is the aubergine system
 *  (docs/decisions/2026-06-08-aubergine-accent-system.md).
 *
 *  SCHEME RESOLUTION (2026-06-09 design-director review): the accent now
 *  INVERTS on dark, mirroring web `theme.css` `.dark` exactly — deep plum
 *  `#3B2A4D` is invisible on a near-black ground, so dark lifts to the
 *  OLED-contrast aubergines (`#7E5C92` fill / `#C4ACD0` text-solid). Every
 *  component must read the accent via `useAccent()` (never the static
 *  `Accent` constant) so titles, eyebrows, outline CTAs and selected pills
 *  stay legible on dark. */

/** Dark-scheme accent — value-for-value mirror of web `.dark` (`theme.css`):
 *  `--accent-primary #7E5C92` / `-lift #9A7BAA` / `-solid #C4ACD0` /
 *  `-soft rgba(154,123,170,0.18)`. Non-primary keys (success/warning/
 *  destructive/activity…) keep their shared values — components already
 *  scheme-switch those via their `*Light` variants where needed — EXCEPT the
 *  `-solid` TEXT inks, which lighten in dark (ENG-1275) the same way
 *  `primarySolid` does. */
const DARK_ACCENT: typeof Accent = {
  ...Accent,
  primary: Accent.primaryDark, // #7E5C92 (ENG-1013: named in constants/theme.ts)
  primaryLight: Accent.purpleLight, // #9A7BAA
  primarySolid: Accent.primarySolidDark, // #C4ACD0
  primarySoft: Accent.primarySoftDark, // rgba(154,123,170,0.18)
  primarySoftStrong: Accent.primarySoftStrongDark, // rgba(154,123,170,0.28) — ENG-1087 hero import slab
  brandBlue: Accent.primaryDark, // #7E5C92
  brandBlueLight: Accent.purpleLight, // #9A7BAA
  // ENG-1275 — `-solid` TEXT inks are dark hues in light, which collapse to
  // ~2.4:1 on a dark card. Dark lifts them so the freeze/info/added Badge labels,
  // the streak headline and the alcohol chip label stay AA in dark. Mirrors web
  // `.dark` --macro-water-solid / --accent-success-solid / --stimulant-alcohol-solid.
  cyanSolid: Accent.cyanSolidDark, // #7FAAB8 (freeze/info Badge + Got-it link)
  successSolid: Accent.successSolidDark, // #83A57E (added Badge + streak headline)
  alcoholSolid: Accent.alcoholSolidDark, // #D6A24A (alcohol quick-add chip label)
  // ENG-1521 — the sanctioned soft-tint scale is scheme-resolved here exactly
  // like primarySoft: `useAccent().<family>Soft` returns the 12% light / 18%
  // dark step (SoftStrong = 20/28) without call sites touching the *Dark names.
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
  /** Functional secondary accent — always clay `Accent` (the Frost flag is
   *  retired). Migrated high-visibility consumers read this via {@link
   *  useAccent}; the long tail imports `Accent` directly (also clay). */
  accent: typeof Accent;
  /** Win-moment gradient stops — always the clay Sloe brand gradient. */
  winGradient: WinGradient;
  /** True only inside a mounted <ThemeProvider>. Lets scheme hooks fall back
   *  to the SYSTEM scheme (instead of the static default below) when read
   *  outside the provider (boot path, tests without the provider). */
  isProviderMounted: boolean;
};

const STORAGE_KEY = "suppr_theme";

const ThemeContext = createContext<ThemeContextValue>({
  preference: "auto",
  resolved: "dark",
  colors: Colors.dark,
  setPreference: () => {},
  accent: Accent,
  winGradient: AccentWinGradient,
  isProviderMounted: false,
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

  // Scheme-resolved accent (2026-06-09): dark inverts the aubergine family to
  // the OLED-contrast values, exactly like web's `.dark` block. Light keeps
  // the canonical deep plum.
  const accent = resolved === "dark" ? DARK_ACCENT : Accent;
  const winGradient = AccentWinGradient;

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, colors, setPreference, accent, winGradient, isProviderMounted: true }),
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

/**
 * THE canonical scheme read for styling (2026-06-09). Returns the APP's
 * resolved theme — the user's in-app preference (light/dark/auto) resolved
 * against the system — NOT the raw OS scheme. Components must never style off
 * react-native's useColorScheme() directly: when the phone is dark but the
 * app preference is light, raw reads paint dark fragments onto light screens
 * (Grace, 2026-06-09 — dark toggle/chip/ring-track on a light Today).
 * Outside a mounted provider (boot, bare tests) falls back to the system
 * scheme rather than the static context default.
 */
export function useResolvedScheme(): ResolvedTheme {
  const ctx = useContext(ThemeContext);
  const system = useColorScheme();
  if (ctx.isProviderMounted) return ctx.resolved;
  return system === "light" ? "light" : "dark";
}

/** SCHEME-RESOLVED accent palette (2026-06-09): light → deep plum `#3B2A4D`
 *  family; dark → the OLED-lifted aubergines (`#7E5C92` fill / `#C4ACD0`
 *  text-solid), mirroring web `.dark`. ALWAYS read the accent through this
 *  hook in components — a static `Accent.primary*` import renders deep plum
 *  on dark (invisible). Status colours (success/warning/destructive),
 *  `MacroColors`, and `Accent.activity` are NOT scheme-inverted here —
 *  components keep their existing `*Light`-variant switches for those. */
export function useAccent(): typeof Accent {
  return useContext(ThemeContext).accent;
}

/** Win-moment gradient — always the clay Sloe brand gradient (Frost retired). */
export function useWinGradient(): WinGradient {
  return useContext(ThemeContext).winGradient;
}
