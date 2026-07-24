import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { useAccent, useTheme } from "@/context/theme";
import { PressableScale } from "@/components/ui/PressableScale";
import {
  TAB_BAR_METRICS,
  tabBarOuterHeight,
} from "@/hooks/useTabBarClearance";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import { Radius } from "@/constants/theme";

import { LogTabBarButton } from "./LogTabBarButton";

/**
 * Liquid-glass pill — IG/NC° reference: heavy blur, low wash, light rim, soft lift.
 *
 * KILL-SWITCH PATH (`design_consistency_v1` off). The 0.32/0.42 wash is the
 * treatment the 2026-07-24 design-consistency drive faulted: on Recipes, food
 * photography scrolls straight under the bar and a third-opacity wash lets it
 * through, dropping the inactive "Today"/"Plan" labels to near-illegible over a
 * bright plate. Kept intact so the flag can roll back; see `tabBarGlass()`.
 */
const TAB_BAR_GLASS = {
  light: {
    blurIntensity: 72,
    tint: "systemUltraThinMaterialLight" as const,
    washColor: "#FFFFFF",
    washOpacity: 0.32,
    borderColor: "rgba(255,255,255,0.78)",
    shadowOpacity: 0.1,
  },
  dark: {
    blurIntensity: 80,
    tint: "systemUltraThinMaterialDark" as const,
    washColor: "#1C1628",
    washOpacity: 0.42,
    borderColor: "rgba(255,255,255,0.14)",
    shadowOpacity: 0.22,
  },
} as const;

/**
 * Design-consistency pass (2026-07-24), behind `design_consistency_v1`.
 *
 * The bar floats OVER scroll content, so its ground is whatever the user
 * happens to be scrolling — a bright food photo on Recipes, a cream card on
 * Today. The legacy config made the pill's contrast a function of that content,
 * which is the one property a persistent navigation chrome must not have.
 *
 * The fix is the MATERIAL, not the fill. The legacy failure was
 * `systemUltraThinMaterial` at intensity 72: too little blur, so sharp
 * high-frequency photo detail survived directly behind the labels and the
 * inactive ink fell apart over a bright plate. `systemThickMaterial` at 100
 * removes that detail, leaving a smooth low-frequency field — which is what lets
 * the wash stay genuinely translucent.
 *
 * Wash sits at 0.55/0.60, NOT the near-opaque 0.92 an earlier pass reached for.
 * Grace's reference apps (MyFitnessPal, Natural Cycles) are both visibly
 * see-through — text and colour bleed softly through the pill — and that soft
 * bleed is the point of the treatment. An opaque pill is just a card with
 * rounded ends; the glass identity comes from letting the content register
 * underneath while the blur guarantees it never competes with the labels.
 *
 * Wash + rim come from `colors.card` / `colors.border` rather than the literal
 * white/plum of the legacy config — one surface language with the cards the
 * pill sits above.
 */
function tabBarGlass(
  colors: ReturnType<typeof useThemeColors>,
  isDark: boolean,
): {
  blurIntensity: number;
  tint: "systemChromeMaterialLight" | "systemChromeMaterialDark";
  washColor: string;
  washOpacity: number;
  borderColor: string;
  shadowOpacity: number;
} {
  return {
    blurIntensity: 100,
    tint: isDark ? "systemThickMaterialDark" : "systemThickMaterialLight",
    washColor: colors.card,
    // The MATERIAL carries legibility; the wash only tints. Stacking a heavy
    // wash on top of `systemThickMaterial` at 100 lands back at opaque —
    // especially over Sloe's near-white ground, where a white wash has nothing
    // to contrast against and the pill reads as a plain card. Keep this LOW.
    washOpacity: isDark ? 0.3 : 0.22,
    borderColor: colors.border,
    shadowOpacity: isDark ? 0.28 : 0.12,
  };
}

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
  const isDark = resolved === "dark";
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  const glass = unifiedChrome
    ? tabBarGlass(colors, isDark)
    : isDark
      ? TAB_BAR_GLASS.dark
      : TAB_BAR_GLASS.light;
  // Inactive tab ink. `tabIconDefault` (#9B93A3 light) measures 2.96:1 on the
  // card fill — under the 4.5:1 body floor even once the ground is opaque, so
  // the photography bug was masking a second, always-on legibility failure at
  // the 10.5pt label size. The unified path reads `textSecondary` (#655C6E →
  // 6.3:1 light, #B8B0C4 on the dark card), the token this bar's labels should
  // have used all along: still visibly quieter than the selected accent, so the
  // active/inactive hierarchy is intact. Kill switch keeps the old grey.
  const inactiveTint = unifiedChrome ? colors.textSecondary : colors.tabIconDefault;
  const outerHeight = tabBarOuterHeight(safeInsets.bottom);
  const bottomLift = safeInsets.bottom + TAB_BAR_METRICS.bottomGap;

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
    // ENG-1247 — v3 `.tabbar` (Sloe-App.html L1697): floating rounded pill with
    // frosted glass (`backdrop-filter: blur(18px)`) over scroll content. Outer
    // host is transparent + absolutely positioned (custom tabBar bypasses RN's
    // BottomTabBar wrapper — we must own overlay positioning or a grey strip
    // appears). BlurView lives INSIDE an overflow:hidden clip so the frost
    // never blooms into a full-width square (Grace flagged that repeatedly).
    //
    // ⚠️ Root height MUST match `_layout` tabBarStyle.height — NOT flex:1.
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        height: outerHeight,
        justifyContent: "flex-end",
        paddingHorizontal: TAB_BAR_METRICS.sideInset,
        paddingBottom: bottomLift,
        backgroundColor: "transparent",
        elevation: 0,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      {/* Pill host — shadow lives here (pill-sized, inset 16px L/R) so it lifts
          without blooming into a full-width grey slab. */}
      <View
        style={{
          height: TAB_BAR_METRICS.pillHeight,
          borderRadius: Radius.full,
          backgroundColor: "transparent",
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: glass.shadowOpacity,
          shadowRadius: 10,
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: Radius.full,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: glass.borderColor,
          }}
        >
          <BlurView
            pointerEvents="none"
            intensity={glass.blurIntensity}
            tint={glass.tint}
            experimentalBlurMethod={
              Platform.OS === "android" ? "dimezisBlurView" : undefined
            }
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: glass.washColor,
                opacity: glass.washOpacity,
              },
            ]}
          />
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: TAB_BAR_METRICS.pillPaddingVertical,
              paddingHorizontal: TAB_BAR_METRICS.pillPaddingHorizontal,
              zIndex: 1,
            }}
          >
            {visibleRoutes.map((route, visibleIndex) => {
              const { options } = descriptors[route.key];
              const realIndex = state.routes.findIndex((r) => r.key === route.key);
              const isFocused = state.index === realIndex;

              const onPress = () => {
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

              const tintColor = isFocused ? activeTint : inactiveTint;
              const label =
                typeof options.tabBarLabel === "string"
                  ? options.tabBarLabel
                  : (options.title ?? route.name);
              const accessibilityLabel =
                options.tabBarAccessibilityLabel ??
                (typeof label === "string" ? label : undefined);

              const showLogButtonAfterThis = visibleIndex === 1;

              return (
                <React.Fragment key={route.key}>
                  <PressableScale
                    haptic={isFocused ? "none" : "selection"}
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
                          fontSize: 10.5,
                          // Raising the inactive ink to `textSecondary` narrows
                          // the selected/unselected value gap (was #9B93A3 →
                          // #3B2A4D, now #655C6E → #3B2A4D). Weight carries the
                          // difference the colour no longer has to: the selected
                          // label goes 700 alongside the icon's existing
                          // translateY(-1)/scale(1.06) lift. Fixing the
                          // selected state this way, rather than walking the
                          // inactive ink back, keeps all four labels legible.
                          fontWeight: unifiedChrome && isFocused ? "700" : "600",
                          color: tintColor,
                        }}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                    ) : null}
                  </PressableScale>
                  {showLogButtonAfterThis ? (
                    <LogTabBarButton onPress={handleLogButtonPress} />
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

export default SupprTabBar;
