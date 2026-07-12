"use client";

import { useTheme } from "next-themes";

import type { FallbackScheme } from "../recipe/recipeHeroFallback";

/**
 * ENG-1528 — the web read of the active surface scheme for recipe / food
 * fallback art. Maps next-themes' `resolvedTheme` (the same signal that
 * flips the `.dark` class + every CSS token) to the shared
 * {@link FallbackScheme}. Anything that is not resolved to `"dark"` —
 * including the `undefined` first-paint before hydration — reads `"light"`,
 * so the light output stays byte-identical and a dark-preference user sees
 * at most a one-frame light tile that corrects on hydration (strictly
 * better than the permanent cream glow it replaces).
 *
 * Mobile parity: components read `useResolvedScheme()` from
 * `@/context/theme` directly (it already returns `"light" | "dark"`).
 */
export function useFallbackScheme(): FallbackScheme {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? "dark" : "light";
}
