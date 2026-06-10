import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { useAccent, useTheme } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

import { LogTabBarButton } from "./LogTabBarButton";

/**
 * SupprTabBar — custom bottom tab bar that renders the four primary
 * tabs (Today / Recipes / Plan / You) plus a centered raised Plus
 * button in the visual middle slot.
 *
 * 2026-04-30 (customer-lens audit): replaces the side `<LogFab>`
 * (right: 18, bottom: 100) with a centered raised tab-bar button.
 * The raised button is purely a UI element — it is NOT a 5th screen
 * route, so the 4-tab IA from D-2026-04-27-02 is preserved. Tapping
 * the raised button navigates to `/(tabs)?openLog=1` and the Today
 * screen consumes the `openLog` param via `useFocusEffect` to open
 * the canonical `<LogSheet>`.
 *
 * Why a custom bar (not `tabBarButton` injection):
 *   - We need the raised button BETWEEN tab 2 (Recipes) and tab 3
 *     (Plan), not as one of the 4 tabs. Re-styling an existing
 *     tabBarButton would reduce the user to 3 visible labels +
 *     1 raised icon, breaking the IA. A custom bar gives us the
 *     5-slot layout (4 labelled tabs + 1 raised button) cleanly.
 *   - We keep the standard tab routing semantics: `state` from
 *     `BottomTabBarProps` is the source of truth for active route;
 *     `navigation.emit('tabPress', { ... })` lets per-screen listeners
 *     (e.g. the Recipes / You "return to default sub-tab" intercepts
 *     in `_layout.tsx`) keep working.
 *
 * The raised button is globally available — every primary tab shows
 * the same custom bar, so the user can open the log sheet from any
 * tab. The Today screen owns the LogSheet open state because it owns
 * the journal data the sheet writes into; navigating to Today first
 * is the right (and only sensible) UX.
 */
export function SupprTabBar({
  state,
  descriptors,
  navigation,
  insets: _insets,
}: BottomTabBarProps) {
  const colors = useThemeColors();
  // Active-tab tint follows the secondary accent (Frost flag → damson, else
  // clay). `colors.tabIconSelected` is pinned to the clay `Accent` in the theme
  // const, so read the live accent here instead so the flag flips the active tab
  // in lockstep. Dark mode uses the lifted accent (`primaryLight`) to match the
  // `tabIconSelected = Accent.primaryLight` it replaces.
  const accent = useAccent();
  const { resolved } = useTheme();
  const activeTint = resolved === "dark" ? accent.primaryLight : accent.primary;
  const safeInsets = useSafeAreaInsets();
  const router = useRouter();

  // Filter out hidden routes (`href: null` in `_layout.tsx`). Those
  // descriptors live in `state.routes` for routing purposes but we
  // never render them in the bar.
  const visibleRoutes = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    // expo-router maps `href: null` to a tabBarButton that returns
    // null. Detect either signal.
    if ((options as { href?: string | null }).href === null) return false;
    if (options.tabBarButton) {
      // We can't easily check the rendered output, but expo-router
      // sets a sentinel function for href:null. Conservative default:
      // include the route if it has a tabBarIcon (the public API our
      // visible tabs use).
      if (!options.tabBarIcon) return false;
    }
    return true;
  });

  const handleLogButtonPress = () => {
    // Navigate to Today with `?openLog=1`. The Today screen consumes
    // the param via useFocusEffect, opens the LogSheet, then clears
    // the param so a back-nav doesn't re-open the sheet.
    //
    // `router.push` (vs `replace`) so the back stack reflects the
    // user's navigation if they came from another tab.
    router.push({ pathname: "/(tabs)" as never, params: { openLog: "1" } });
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        backgroundColor: colors.background,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        height: 56 + Math.max(safeInsets.bottom, 8),
        paddingBottom: Math.max(safeInsets.bottom, 8),
        paddingTop: 8,
      }}
    >
      {visibleRoutes.map((route, visibleIndex) => {
        const { options } = descriptors[route.key];
        const realIndex = state.routes.findIndex((r) => r.key === route.key);
        const isFocused = state.index === realIndex;

        const onPress = () => {
          if (process.env.EXPO_OS === "ios") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          // emit tabPress so per-screen listeners (e.g. the
          // Recipes/You "return to default sub-tab" intercepts) fire
          // exactly as they would with the stock tab bar.
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: "tabLongPress", target: route.key });
        };

        const tintColor = isFocused ? activeTint : colors.tabIconDefault;
        const label =
          typeof options.tabBarLabel === "string"
            ? options.tabBarLabel
            : (options.title ?? route.name);
        const accessibilityLabel =
          options.tabBarAccessibilityLabel ??
          (typeof label === "string" ? label : undefined);

        // Inject the raised Log button between the 2nd and 3rd visible
        // tab (i.e. between Recipes and Plan). Render the tab first,
        // then the button, then the next tabs follow.
        const showLogButtonAfterThis = visibleIndex === 1;

        return (
          <React.Fragment key={route.key}>
            <Pressable
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={accessibilityLabel}
              testID={
                (options as { tabBarButtonTestID?: string }).tabBarButtonTestID
              }
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
              }}
            >
              {options.tabBarIcon
                ? options.tabBarIcon({
                    focused: isFocused,
                    color: tintColor,
                    size: 22,
                  })
                : null}
              {typeof label === "string" ? (
                <Text
                  style={{
                    // SLOE (2026-06-04) — match the Figma tab bar
                    // (`_gen.mjs` tabBar): 10px, uppercase, tracked,
                    // medium weight. Calmer than the prior 11pt/600
                    // non-uppercase chrome; the active TODAY label reads
                    // clay, the rest ink-faint, so the tab bar recedes
                    // and the centre plum FAB owns the hierarchy.
                    fontSize: 10,
                    fontWeight: "500",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    color: tintColor,
                  }}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              ) : null}
            </Pressable>
            {showLogButtonAfterThis ? (
              <LogTabBarButton onPress={handleLogButtonPress} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export default SupprTabBar;
