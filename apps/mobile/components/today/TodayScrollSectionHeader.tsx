import React from "react";
import { Text, View } from "react-native";

import { Layout } from "@/constants/layout";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Sloe Today scroll section header — Figma TD1/TD2 (`today-activity.html`,
 * `today-hydration.html`): Newsreader section title, then `mb-5` (20px)
 * before the first card. The long date subline is optional — on the full
 * Today scroll (`654:2`) the hero already shows the date; TD1/TD2 isolated
 * frames include a date under the section title for crop context only.
 */
export interface TodayScrollSectionHeaderProps {
  title: string;
  /** Omit on full Today scroll when the hero already shows the date. */
  subtitle?: string;
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
        gap: subtitle ? Layout.chromeTitleGap : 0,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ ...Type.title, color: colors.navPrimary }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ ...Type.bodyMuted, color: colors.textSecondary }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export default TodayScrollSectionHeader;
