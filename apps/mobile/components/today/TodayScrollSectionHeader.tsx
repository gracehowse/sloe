import React from "react";
import { Text, View } from "react-native";

import { Layout } from "@/constants/layout";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Sloe Today scroll section header — Figma TD1/TD2 (`today-activity.html`,
 * `today-hydration.html`): Newsreader section title + long date subline,
 * then `mb-5` (20px) before the first card in the section.
 */
export interface TodayScrollSectionHeaderProps {
  title: string;
  subtitle: string;
  testID?: string;
}

export function TodayScrollSectionHeader({
  title,
  subtitle,
  testID,
}: TodayScrollSectionHeaderProps) {
  const colors = useThemeColors();

  return (
    <View
      testID={testID}
      style={{
        marginTop: Spacing.xs,
        marginBottom: Layout.todaySectionHeaderGap,
        gap: Layout.chromeTitleGap,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ ...Type.title, color: colors.navPrimary }}
      >
        {title}
      </Text>
      <Text style={{ ...Type.bodyMuted, color: colors.textSecondary }}>
        {subtitle}
      </Text>
    </View>
  );
}

export default TodayScrollSectionHeader;
