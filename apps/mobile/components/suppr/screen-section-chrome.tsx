import React, { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { TodayBrandBar } from "@/components/today/TodayBrandBar";
import { Layout } from "@/constants/layout";
import { Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export interface ScreenSectionChromeProps {
  /** Eyebrow above the title. Pass an empty string / null to hide it
   *  entirely — useful on tabs where the tab bar already carries the
   *  surface name (Plan / Progress) and the overline reads as
   *  redundant shouting. (Grace 2026-05-22 continuity sweep.) */
  overline?: string | null;
  title: string;
  /** Optional line under the title (e.g. week range on Plan). */
  subtitle?: string;
  showBrand?: boolean;
  /** Trailing control aligned with the title row (e.g. calendar). */
  trailing?: ReactNode;
  /** Tighter title block for Plan / data-heavy tabs. */
  compact?: boolean;
  children?: ReactNode;
  testID?: string;
  overlineTestID?: string;
  titleTestID?: string;
}

/**
 * Sticky section header used on primary tabs — brand, overline,
 * large title, optional subtitle, then sub-tabs or actions.
 */
export function ScreenSectionChrome({
  overline,
  title,
  subtitle,
  showBrand = false,
  trailing,
  compact = false,
  children,
  testID,
  overlineTestID,
  titleTestID,
}: ScreenSectionChromeProps) {
  const colors = useThemeColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          backgroundColor: colors.background,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        titleBlock: {
          paddingHorizontal: Layout.screenPaddingX,
          paddingTop: Layout.chromePaddingTop,
          paddingBottom: subtitle ? Spacing.xs : Layout.chromeAfterTitle,
          gap: Layout.chromeTitleGap,
        },
        titleRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: Spacing.md,
        },
        titleCol: { flex: 1, gap: Layout.chromeTitleGap },
        overline: {
          fontSize: Layout.overlineSize,
          fontWeight: "700",
          color: colors.textTertiary,
          letterSpacing: Layout.overlineTracking,
          textTransform: "uppercase",
        },
        title: {
          fontSize: compact ? 22 : Layout.titleSize,
          fontWeight: "800",
          color: colors.text,
          letterSpacing: compact ? -0.4 : Layout.titleTracking,
        },
        subtitle: {
          fontSize: Layout.subtitleSize,
          fontWeight: "600",
          color: colors.textSecondary,
          letterSpacing: 0.2,
          marginTop: 2,
        },
      }),
    [colors, subtitle, compact],
  );

  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.titleBlock}>
        {showBrand ? <TodayBrandBar /> : null}
        <View style={styles.titleRow}>
          <View style={styles.titleCol}>
            {overline ? (
              <Text style={styles.overline} testID={overlineTestID}>
                {overline}
              </Text>
            ) : null}
            <Text style={styles.title} accessibilityRole="header" testID={titleTestID}>
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {trailing ?? null}
        </View>
      </View>
      {children}
    </View>
  );
}
