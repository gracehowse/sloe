import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * ENG-1247 — the floating pill tab bar no longer OVERLAYS scroll content. With
 * `tabBarStyle.position` left at its default (NOT `absolute`), react-navigation
 * reserves the bar's height and insets the scene above it automatically, so
 * screens must NOT add their own bottom padding — that would double the gap.
 *
 * This hook is retained (every `(tabs)` screen calls it) but now returns 0: the
 * navigator owns the clearance. Kept as a single seam so if the overlay model
 * ever returns (e.g. a real blur backdrop is added) we restore the bar-height
 * value here rather than re-threading padding through 8 screens.
 *
 * `insets` is still read so the signature/behaviour stays a pure function of the
 * safe area should the value need to change.
 */
export function useTabBarClearance(): number {
  useSafeAreaInsets();
  // Non-overlay bar: react-navigation insets the scene by the bar height, so no
  // additional scroll padding is needed. See `_layout.tsx` tabBarStyle note.
  return 0;
}
