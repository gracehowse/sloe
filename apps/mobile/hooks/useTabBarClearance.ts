import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * ENG-1247 — the frosted tab bar (`SupprTabBar`) overlays scroll content
 * (`tabBarStyle: position:absolute` in `_layout`), so every `(tabs)` screen pads
 * its main scroll by the bar height to keep the last rows clear of the bar.
 *
 * Returns the bar's full height using the SAME formula `SupprTabBar` and
 * `_layout` use for the bar itself — `56` (content) plus the bottom safe-area
 * inset, floored at `8`. Computed straight from safe-area insets rather than
 * `useBottomTabBarHeight()` so it (a) never throws when a screen mounts outside
 * the tab navigator (unit tests + deep-linked standalone mounts) and (b) doesn't
 * drag the whole `@react-navigation/bottom-tabs` navigator into every screen's
 * module graph. The value matches what `useBottomTabBarHeight()` returns inside
 * the navigator, so on-device padding is unchanged.
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return 56 + Math.max(insets.bottom, 8);
}
