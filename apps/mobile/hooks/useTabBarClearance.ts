import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Spacing } from "@/constants/theme";

/**
 * Floating glass pill metrics — single source of truth for `SupprTabBar`,
 * `(tabs)/_layout` tabBarStyle.height, and scroll clearance padding.
 *
 * Proportional intent (2026-06-28, Grace):
 *   - Side inset = `Spacing.lg` (20) — matches `Layout.todayScreenPaddingX` so
 *     the pill aligns with page cards, not bleeds 4px past them.
 *   - Pill height 64 = 56pt FAB + 4pt vertical padding — NC/IG slim bar vs the
 *     old 72pt block.
 *   - Bottom gap 8pt above the home indicator — v3 `.tabbar` bottom:16 feel.
 */
export const TAB_BAR_METRICS = {
  pillHeight: 64,
  sideInset: Spacing.lg,
  bottomGap: Spacing.sm,
  hostBreathing: Spacing.sm,
  /** v3 `.tab--fab-slot` — fixed width so tabs get equal flex space. */
  fabSlotWidth: 64,
  pillPaddingVertical: Spacing.xs,
  pillPaddingHorizontal: Spacing.sm,
} as const;

/** Navigator overlay host height — must match `SupprTabBar` outer View. */
export function tabBarOuterHeight(bottomInset: number): number {
  const { pillHeight, bottomGap, hostBreathing } = TAB_BAR_METRICS;
  return pillHeight + bottomGap + hostBreathing + bottomInset;
}

/**
 * ENG-1247 — the floating pill tab bar OVERLAYS scroll content (`tabBarStyle:
 * position:absolute` in `_layout`) and the bar zone is see-through, so scroll
 * content passes BEHIND it. Every `(tabs)` screen pads its main scroll by the
 * bar height so the LAST row can still scroll clear of the floating pill (the
 * navigator does NOT inset the scene when the bar is absolutely positioned).
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  const { pillHeight, bottomGap } = TAB_BAR_METRICS;
  return pillHeight + bottomGap + insets.bottom;
}
