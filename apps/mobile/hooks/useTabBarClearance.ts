import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * ENG-1247 — the floating pill tab bar OVERLAYS scroll content (`tabBarStyle:
 * position:absolute` in `_layout`) and the bar zone is see-through, so scroll
 * content passes BEHIND it. Every `(tabs)` screen pads its main scroll by the
 * bar height so the LAST row can still scroll clear of the floating pill (the
 * navigator does NOT inset the scene when the bar is absolutely positioned).
 *
 * Returns the bar's lift + height computed straight from safe-area insets
 * (rather than `useBottomTabBarHeight()`) so it (a) never throws when a screen
 * mounts outside the tab navigator (unit tests + deep-linked standalone mounts)
 * and (b) doesn't drag the whole `@react-navigation/bottom-tabs` navigator into
 * every screen's module graph.
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  // Floating pill: bottom lift `max(inset,8)+10` + pill height 72 + breathing,
  // so the last scroll row clears the pill's top edge while content remains
  // visible BEHIND the bar as it scrolls (see `_layout.tsx` tabBarStyle note).
  return 82 + Math.max(insets.bottom, 8);
}
