import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import * as Haptics from "expo-haptics";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * RecipesSubTabHeader — segmented sub-tab pill bar shown at the top of
 * the Library and Discover screens once the 6→4 tab collapse landed
 * (Phase 2 / B1.1, 2026-04-27 strategic spec).
 *
 * The "Recipes" primary tab is a logical group of two screens. Library
 * is the default sub-tab (per D-2026-04-27-02 — Library is what the
 * user actually came back for). Discover is the second sub-tab, kept
 * accessible without inflating to six primary tabs.
 *
 * Rationale (D-2026-04-27-02):
 *   "Six tabs is a tell that nothing is canonical. Best-in-class apps
 *    run 3-5 tabs. Merging Library+Discover fixes the 'Library is
 *    hard to find' tester feedback without inflating to six."
 *
 * The tab bar in `(tabs)/_layout.tsx` exposes a "Recipes" entry that
 * routes to `/(tabs)/library` by default. Once the user is on
 * `/library` or `/discover`, this header lets them swap between the
 * two without leaving the Recipes group. The tab bar highlights
 * "Recipes" for either pathname (custom button logic in `_layout`).
 *
 * Styling deliberately mirrors the existing Plan ↔ Shop segmented
 * control on web (`src/app/App.tsx`) so the pattern is consistent
 * across the redesign.
 */
export function RecipesSubTabHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useThemeColors();

  const onLibrary = pathname?.startsWith("/library") ?? false;
  const onDiscover = pathname?.startsWith("/discover") ?? false;

  const handleSelect = (target: "library" | "discover") => {
    if (process.env.EXPO_OS === "ios") {
      void Haptics.selectionAsync();
    }
    if (target === "library" && onLibrary) return;
    if (target === "discover" && onDiscover) return;
    router.replace(`/(tabs)/${target}` as never);
  };

  return (
    <View
      style={{
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.sm,
        backgroundColor: colors.background,
      }}
      accessibilityRole="tablist"
      accessibilityLabel="Recipes sections"
    >
      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.cardBorder,
          borderRadius: Radius.md,
          padding: 4,
          gap: 4,
        }}
      >
        <SubTabPill
          label="Library"
          active={onLibrary}
          onPress={() => handleSelect("library")}
          activeBg={colors.card}
          activeText={Accent.primary}
          inactiveText={colors.textSecondary}
        />
        <SubTabPill
          label="Discover"
          active={onDiscover}
          onPress={() => handleSelect("discover")}
          activeBg={colors.card}
          activeText={Accent.primary}
          inactiveText={colors.textSecondary}
        />
      </View>
    </View>
  );
}

interface SubTabPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
  activeBg: string;
  activeText: string;
  inactiveText: string;
}

function SubTabPill({ label, active, onPress, activeBg, activeText, inactiveText }: SubTabPillProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: Radius.sm,
        backgroundColor: active ? activeBg : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: active ? "700" : "600",
          color: active ? activeText : inactiveText,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default RecipesSubTabHeader;
