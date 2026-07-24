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
   *  redundant shouting. (Grace 2026-05-22 continuity sweep.)
   *
   *  Under `design_consistency_v1` this renders the canonical treatment:
   *  `Type.eyebrow` ink caps + a faint hairline rule to the margin. */
  overline?: string | null;
  /** Opt out of the eyebrow hairline rule (e.g. when a `trailing` control sits
   *  on the same optical line and the rule would collide). On by default — one
   *  eyebrow treatment across the app is the point. */
  overlineRule?: boolean;
  title: string;
  /** Optional line under the title (e.g. week range on Plan). */
  subtitle?: string;
  showBrand?: boolean;
  /** Trailing control aligned with the title row (e.g. calendar). */
  trailing?: ReactNode;
  /** Leading navigation control for pushed utility surfaces (e.g. Settings). */
  leading?: ReactNode;
  /** @deprecated No-op since the headers census (2026-06-10) — the compact-22
   *  title fork was off the type ramp. The consistency contract uses
   *  `Type.pageTitle` (33), with `Type.title` (24) retained by the kill switch. */
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
  overlineRule = true,
  title,
  subtitle,
  showBrand = false,
  trailing,
  leading,
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
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");

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
        // Design-consistency pass 2026-07-24 — the unified path uses the shared
        // `Type.eyebrow` ink caps promoted from the Today hero; the tertiary
        // `Type.label` treatment stays as the kill switch.
        overline: unifiedChrome
          ? { ...Type.eyebrow, color: colors.text }
          : { ...Type.label, color: colors.textTertiary },
        overlineRow: {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: Spacing.dense,
        },
        // The FAINT `border` hairline, never the mid-grey `textTertiary` — the
        // latter reads as a hard rule and fights the title for attention.
        overlineRule: { flex: 1, height: 1, backgroundColor: colors.border },
        // ENG-1577 — the consistency path converges primary screens on the
        // 33px page-title token; the former 24px treatment is the kill switch.
        title: {
          ...(consistencyChrome ? Type.pageTitle : Type.title),
          color: colors.navPrimary,
        },
        // headers census 2026-06-10 — tokenised 13/600 chrome subtitle.
        subtitle: { ...Type.captionStrong, color: colors.textSecondary, marginTop: 2 },
      }),
    [colors, consistencyChrome, unifiedChrome, subtitle],
  );

  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.titleBlock}>
        {showBrand ? <TodayBrandBar /> : null}
        <View style={styles.titleRow}>
          {leading ?? null}
          <View style={styles.titleCol}>
            {overline ? (
              unifiedChrome && overlineRule ? (
                <View style={styles.overlineRow}>
                  <Text style={styles.overline} testID={overlineTestID}>
                    {overline}
                  </Text>
                  <View style={styles.overlineRule} />
                </View>
              ) : (
                <Text style={styles.overline} testID={overlineTestID}>
                  {overline}
                </Text>
              )
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
