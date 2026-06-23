import { MacroColors, MacroColorsDark } from "@/constants/theme";
import { useResolvedScheme } from "@/context/theme";

export type MacroColorKey = keyof typeof MacroColors;

/**
 * Canonical fill colour for a macro role — use everywhere (tiles, rings, bars).
 *
 * Scheme-aware (ENG-1223): pass `isDark` so protein (plum) lightens on the
 * Nocturne dark ground instead of vanishing. Components in a render scope should
 * prefer the `useMacroColors()` hook (reads the scheme from context); pass
 * `isDark` explicitly only from non-hook call sites (e.g. a `StyleSheet.create`
 * helper that already has the scheme threaded in). Omitting `isDark` keeps the
 * light map — correct for genuinely light-only surfaces, back-compat otherwise.
 */
export function macroColorFor(key: string, isDark = false): string {
  const map = isDark ? MacroColorsDark : MacroColors;
  if (key in map) {
    return map[key as MacroColorKey];
  }
  return map.protein;
}

/**
 * useMacroColors — the scheme-resolved macro map + resolver for the current
 * theme (ENG-1223). Mirrors how web resolves `var(--macro-*)` per `.dark`
 * automatically. Returns the map (`m.colors.protein`) and a `colorFor(key)`
 * bound to the active scheme.
 */
export function useMacroColors(): {
  colors: typeof MacroColors;
  colorFor: (key: string) => string;
} {
  const isDark = useResolvedScheme() === "dark";
  const colors = isDark ? MacroColorsDark : MacroColors;
  return { colors, colorFor: (key: string) => macroColorFor(key, isDark) };
}

export { MacroColors, MacroColorsDark };
