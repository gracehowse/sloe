import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import * as Haptics from "expo-haptics";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * YouSubTabHeader — segmented sub-tab pill bar shown at the top of
 * the Progress, Settings, and More screens once the 6→4 tab collapse
 * landed (Phase 2 / B1.1, 2026-04-27 strategic spec).
 *
 * The "You" primary tab merges what used to be three primary
 * destinations: Progress (now default), Settings, More. Per
 * D-2026-04-27-02:
 *   "Merging Progress+More resolves the indecision between two
 *    user-centric tabs."
 * and Surface E in the production design spec:
 *   "You is one tab combining identity, the weekly story, and
 *    settings depth."
 *
 * Default sub-tab is Progress (story-led, per D-2026-04-27-17). The
 * "Settings" sub-tab maps to the existing /(tabs)/settings screen.
 * The "More" sub-tab maps to /(tabs)/more — kept accessible because
 * many features (household, profile, paywall, support, etc.) are
 * still routed through it pending a Phase 4 settings consolidation.
 *
 * Three pills fit comfortably without horizontal scroll on a 320pt
 * device, so we don't need an overflow strategy. ScrollView is used
 * defensively so future additions (e.g. Subscription) won't truncate.
 */
export function YouSubTabHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useThemeColors();

  const onProgress = pathname?.startsWith("/progress") ?? false;
  const onSettings = pathname?.startsWith("/settings") ?? false;
  const onMore = pathname?.startsWith("/more") ?? false;

  const handleSelect = (target: "progress" | "settings" | "more") => {
    if (process.env.EXPO_OS === "ios") {
      void Haptics.selectionAsync();
    }
    if (target === "progress" && onProgress) return;
    if (target === "settings" && onSettings) return;
    if (target === "more" && onMore) return;
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
      accessibilityLabel="You sections"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.cardBorder,
            borderRadius: Radius.md,
            padding: 4,
            gap: 4,
            flex: 1,
          }}
        >
          <SubTabPill
            label="Progress"
            active={onProgress}
            onPress={() => handleSelect("progress")}
            activeBg={colors.card}
            activeText={Accent.primary}
            inactiveText={colors.textSecondary}
          />
          <SubTabPill
            label="Settings"
            active={onSettings}
            onPress={() => handleSelect("settings")}
            activeBg={colors.card}
            activeText={Accent.primary}
            inactiveText={colors.textSecondary}
          />
          <SubTabPill
            label="More"
            active={onMore}
            onPress={() => handleSelect("more")}
            activeBg={colors.card}
            activeText={Accent.primary}
            inactiveText={colors.textSecondary}
          />
        </View>
      </ScrollView>
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
        minWidth: 92,
        paddingVertical: 10,
        paddingHorizontal: Spacing.sm,
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

export default YouSubTabHeader;
