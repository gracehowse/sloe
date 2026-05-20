import React from "react";
import { Pressable, View } from "react-native";
import { Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Elevation } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

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
 *   - Theme `colors.tint` (warm ink) background.
 *   - Lucide `Plus` icon, 24pt, white, strokeWidth 2.5.
 *   - Raised 16pt above the tab bar fill line via `top: -16`.
 *   - `Elevation.floatPrimary` (primary-blue glow drop-shadow).
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
  const colors = useThemeColors();
  const handlePress = () => {
    if (process.env.EXPO_OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  // The wrapping View takes a fixed slot width matching a normal tab
  // so the four real tabs flow around it on equal-width terms. The
  // raised button itself is absolutely positioned within the slot so
  // it can overflow above the bar fill line without expanding the
  // bar's height.
  return (
    <View
      pointerEvents="box-none"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
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
            position: "absolute",
            top: -16,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.tint,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
          Elevation.floatPrimary,
        ]}
      >
        <Plus size={24} color={colors.primaryForeground} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

export default LogTabBarButton;
