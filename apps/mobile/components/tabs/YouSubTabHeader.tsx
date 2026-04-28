import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import * as Haptics from "expo-haptics";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * YouSubTabHeader — segmented sub-tab pill bar shown at the top of
 * the Progress + Settings screens.
 *
 * History: shipped 2026-04-27 with three pills (Progress / Settings /
 * More) per the 6→4 tab collapse. Group G IA decision (2026-04-28,
 * `docs/decisions/2026-04-28-group-g-ia-collapse.md`) collapsed to
 * two pills — More is gone as a distinct destination; its sections
 * fold into Settings across batches B-E. The "/more" route stays
 * alive as a redirect so push-notification deep links don't break
 * mid-migration.
 *
 * Default sub-tab is Progress (story-led, per D-2026-04-27-17).
 * Settings is the canonical configuration surface (the consolidated
 * page that Batches B-E build out).
 */
export function YouSubTabHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useThemeColors();

  const onProgress = pathname?.startsWith("/progress") ?? false;
  // Group G IA Batch A (2026-04-28): treat /more as Settings for the
  // purposes of pill highlighting so the redirect from /more →
  // /settings doesn't briefly de-highlight the You tab.
  const onSettings =
    (pathname?.startsWith("/settings") ?? false) ||
    (pathname?.startsWith("/more") ?? false);

  const handleSelect = (target: "progress" | "settings") => {
    if (process.env.EXPO_OS === "ios") {
      void Haptics.selectionAsync();
    }
    if (target === "progress" && onProgress) return;
    if (target === "settings" && onSettings) return;
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
