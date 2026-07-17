import React, { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { TodayBrandBar } from "@/components/today/TodayBrandBar";
import { Layout } from "@/constants/layout";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";

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
  /** @deprecated No-op since the headers census (2026-06-10) — the compact-22
   *  title fork was off the type ramp; all tab titles render `Type.title` (24).
   *  Kept only so existing Plan/Progress call sites keep compiling. */
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
  // compact is deprecated (headers census 2026-06-10) — destructured so call
  // sites still compile, intentionally unused now the 22px fork is gone.
  compact: _compact = false,
  children,
  testID,
  overlineTestID,
  titleTestID,
}: ScreenSectionChromeProps) {
  const colors = useThemeColors();
  const consistencyChrome = isFeatureEnabled("primary_screen_chrome_v1");

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
        // headers census 2026-06-10 — eyebrow plumbing → Type.label
        // (11/700/0.88/uppercase). Was 11/700/ls1.2 hand-rolled.
        overline: { ...Type.label, color: colors.textTertiary },
        // headers census 2026-06-10 — one tab-title size (Type.title, 24);
        // the compact-22 fork left the type ramp and split sibling tabs.
        title: {
          ...(consistencyChrome ? Type.pageTitle : Type.title),
          color: colors.navPrimary,
        },
        // headers census 2026-06-10 — tokenised 13/600 chrome subtitle.
        subtitle: { ...Type.captionStrong, color: colors.textSecondary, marginTop: 2 },
      }),
    [colors, consistencyChrome, subtitle],
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
