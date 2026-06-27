import React from "react";
import { Pressable, View } from "react-native";
import { Plus } from "lucide-react-native";

import { Accent, Elevation } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useHaptics } from "@/hooks/useHaptics";

/**
 * LogTabBarButton — the centered, raised round Plus button that lives
 * inside the custom `<SupprTabBar>` between Recipes and Plan.
 *
 * 2026-04-30: replaces the side-positioned `<LogFab>` (right: 18,
 * bottom: 100) on Today. The customer-lens audit flagged the side FAB
 * as overlapping right-edge meal cards + macro tile column and as the
 * wrong genre for iOS — Cal AI / Lifesum / MyFitnessPal converged on
 * a centered raised tab-bar button years ago. Twitter X uses the same
 * pattern. Placing it in the tab bar (not as a 5th screen route)
 * preserves the 4-tab IA from D-2026-04-27-02 (Today / Recipes /
 * Plan / You) — the button is purely a UI element that opens the
 * canonical `<LogSheet>` from any tab.
 *
 * Visual:
 *   - 56pt diameter circle (matches the legacy LogFab).
 *   - Aubergine `accent.primary` (#5B3B6E) background — the brand accent fill.
 *     The FAB is the ONE filled-accent moment in the system (2026-06-08
 *     aubergine review); everyday inline CTAs are an aubergine OUTLINE.
 *     (Supersedes the 2026-06-04 plum-FAB / clay-CTA split.)
 *   - Lucide `Plus` icon, 24pt, white, strokeWidth 2.5.
 *   - CONTAINED in the floating pill, bottom-aligned (v3 `.fab`: in-flow,
 *     `margin-bottom: 2px`) — the pill grows to hold the 56pt circle. Not raised.
 *   - `Elevation.floatPrimary` glow, re-tinted to the plum nav primary so the
 *     drop-shadow matches the fill (floatPrimary's base shadowColor is clay).
 *
 * Interaction:
 *   - Medium haptic on iOS (matches the legacy LogFab) — heavier than
 *     the Light haptic the standard tabs use, because this is the
 *     primary action.
 *   - Press scale 1 → 0.94 (matches the legacy LogFab).
 *   - `accessibilityRole="button"`, `accessibilityLabel="Log a meal"`,
 *     `testID="today-log-fab"` — the testID is intentionally retained
 *     from the old FAB so existing Maestro flows (e.g.
 *     `02_today_screen.yaml`, `22_barcode_scanner.yaml`,
 *     `32_food_search_modal.yaml`) keep matching without edits.
 *
 * Analytics: the legacy LogFab does not fire any tracking event of
 * its own (open-of-LogSheet is captured downstream by the LogSheet's
 * own analytics, if any). No event-continuity work was required.
 */
export interface LogTabBarButtonProps {
  /** Tap handler. The host (SupprTabBar) wires this to navigate Today
   *  with `?openLog=1`, which the Today screen consumes via
   *  `useFocusEffect` to open the canonical LogSheet. */
  onPress: () => void;
}

export function LogTabBarButton({ onPress }: LogTabBarButtonProps) {
  const accent = useAccent();
  const colors = useThemeColors();
  const haptics = useHaptics();
  const handlePress = () => {
    haptics.confirm();
    onPress();
  };

  // The wrapping View is an equal-width slot (flex:1) matching a normal tab.
  // The button is IN-FLOW + bottom-aligned (NOT raised/absolute) — the v3 `.fab`
  // (Sloe-App.html L726) sits INSIDE the floating pill with `margin-bottom: 2px`,
  // contained; the pill (`.tabbar` align-items:flex-end) grows to hold the 56pt
  // circle. The old `top:-16` raise was calibrated for the legacy edge-to-edge
  // bar; on the new slim floating pill it left the FAB hanging out the BOTTOM
  // (the wrapper is zero-height when the child is absolute, so -16 from the row
  // midline wasn't enough to clear the 56pt circle). ENG-1247.
  return (
    <View
      pointerEvents="box-none"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Log a meal"
        accessibilityHint="Opens the log sheet for searching foods, scanning barcodes, or quick logging"
        testID="today-log-fab"
        hitSlop={8}
        style={({ pressed }) => [
          {
            marginBottom: 2,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: accent.primary,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
          Elevation.floatPrimary,
          // Re-tint the glow to the aubergine accent fill.
          { shadowColor: accent.primary },
        ]}
      >
        <Plus size={24} color={colors.primaryForeground} strokeWidth={2.5} />
      </Pressable>
      {/* Canonical 2026-05-22 C11: no label below the FAB. The added
          label flattened the FAB into "just another tab" — Cal AI /
          Instagram / Twitter / X all leave their primary action button
          unlabeled. The FAB's position + size + colour IS its
          hierarchy. Reverted from the earlier "+ Log" label addition
          (same session). */}
    </View>
  );
}

export default LogTabBarButton;
