import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { useAccent, useTheme } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Radius } from "@/constants/theme";

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
    // ENG-1009 (2026-06-10): `_t` cache-buster + `navigate` mirror the
    // proven `date`-param contract (`index.tsx` date effect) — repeat
    // taps re-fire the consumer even if a previous `openLog=1` is still
    // in the params, and `navigate` dedupes onto the existing Today
    // entry instead of stacking copies.
    router.navigate({
      pathname: "/(tabs)" as never,
      params: { openLog: "1", _t: String(Date.now()) },
    });
  };

  return (
    // ENG-1247 — the v3 `.tabbar` (Sloe-App.html L1697) is a FLOATING ROUNDED
    // PILL, not an edge-to-edge square bar: inset 14px L/R, lifted off the
    // bottom, fully rounded, 1px border + a soft warm shadow so it floats above
    // content. The outer View is the react-navigation container (transparent,
    // full-bleed); the pill sits at its bottom and the raised Log button
    // protrudes from centre — so the pill must NOT clip (no `overflow:hidden`).
    // The blur lets content show faintly through; the ~88% theme wash keeps the
    // tabs legible + warm (a cold chrome material read as "un-updated").
    //
    // ⚠️ The root height MUST be a fixed pixel value matching the `_layout`
    // tabBarStyle.height — NOT `flex:1` / `height:'100%'`. A non-deterministic
    // custom-tab-bar height makes react-navigation re-measure + re-render the
    // navigator on every layout pass, which thrashes the JS thread and STALLS
    // the scenes' Reanimated entrance animations (`useEntranceAnimation`) — they
    // never reach opacity 1, so screen content renders INVISIBLE (a grey void
    // below the header). Keep this height in lockstep with `_layout`.
    <View
      pointerEvents="box-none"
      style={{
        height: 88 + Math.max(safeInsets.bottom, 8),
        justifyContent: "flex-end",
        paddingHorizontal: 14,
        paddingBottom: Math.max(safeInsets.bottom, 8) + 12,
      }}
    >
      {/* ENG-1247 — the pill height (72pt) is pinned on a PLAIN View, NOT the
          BlurView. A plain View re-measures reliably on hot reload; expo-blur's
          BlurView caches its mount-time height and does NOT re-measure, so an
          explicit height on the BlurView left the 56pt FAB bisected by the pill
          edge after any hot reload (Grace flagged it repeatedly while the dev
          sim only hot-reloaded). The plain View owns layout; the BlurView fills
          it via flex:1. 72 = 56 FAB + 8·2 padding; fits the outer View's
          88+inset − (inset+12) = 76 budget. */}
      <View style={{ height: 72 }}>
      <BlurView
        intensity={resolved === "dark" ? 56 : 44}
        tint={resolved === "dark" ? "dark" : "light"}
        style={{
          flex: 1,
          flexDirection: "row",
          // v3 `.tabbar` is `align-items: flex-end`; the 56pt FAB sits CONTAINED,
          // centred in the 72pt pill (see LogTabBarButton). ENG-1247.
          alignItems: "flex-end",
          borderRadius: Radius.full,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: 8,
          paddingHorizontal: 8,
          // soft warm float — v3 `box-shadow: 0 12px 30px rgba(36,23,51,.16)`.
          shadowColor: "#241733",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.16,
          shadowRadius: 16,
        }}
      >
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.background,
              opacity: 0.88,
              borderRadius: Radius.full,
            },
          ]}
        />
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
              {/* v3 active-tab treatment (Sloe-App.html L723): the focused
                  glyph lifts 1px and scales 1.06 so the active tab pops. */}
              <View
                style={
                  isFocused
                    ? { transform: [{ translateY: -1 }, { scale: 1.06 }] }
                    : undefined
                }
              >
                {options.tabBarIcon
                  ? options.tabBarIcon({
                      focused: isFocused,
                      color: tintColor,
                      size: 23,
                    })
                  : null}
              </View>
              {typeof label === "string" ? (
                <Text
                  style={{
                    // Sloe v3 (ENG-1247): the v3 prototype `.tab` label is
                    // sentence-case + untracked (Sloe-App.html L717 — 10.5px
                    // semibold, no text-transform). The prior 2026-06-04
                    // uppercase/tracked treatment matched the FIGMA, which is
                    // dead — Grace (2026-06-24) made the v3 prototype canonical
                    // and it supersedes the Figma. Matches the web mobile-web
                    // nav (10px / medium / no-transform), so the platforms agree.
                    fontSize: 10.5,
                    fontWeight: "600",
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
      </BlurView>
      </View>
    </View>
  );
}

export default SupprTabBar;
