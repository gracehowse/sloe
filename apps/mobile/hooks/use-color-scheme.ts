/**
 * App-resolved colour scheme (2026-06-09). This wrapper used to re-export
 * react-native's useColorScheme (the raw OS scheme), which made every
 * consumer (use-theme-color, nav theme, screen chrome) ignore the in-app
 * Light/Dark/Auto preference — when the phone was dark but the app was set
 * light, dark fragments spilled onto light screens. It now returns the
 * APP-resolved scheme (with a system fallback outside the provider).
 * For the literal OS scheme (boot screen, the provider itself), import
 * useColorScheme from 'react-native' directly.
 */
import { useResolvedScheme } from "@/context/theme";

export function useColorScheme(): "light" | "dark" {
  return useResolvedScheme();
}
