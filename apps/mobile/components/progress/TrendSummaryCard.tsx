import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { FontWeight, Spacing, Type } from "@/constants/theme";
import { SupprCard } from "@/components/ui/SupprCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";

/**
 * `<TrendSummaryCard>` (mobile) — React Native port of the web
 * `TrendSummaryCardWeb` inside `ProgressDashboard.tsx`. ENG-755.
 *
 * Three always-present rows (calorie target / protein target /
 * weigh-ins) shown as "X of Y", plus an optional projected-goal row
 * when a goal weight + date are known. Every value is a count derived
 * from log + weight data the Progress screen already holds — no
 * fabricated nutrition.
 *
 * Gated behind `progress-trend-summary-mobile`. The flag defaults to
 * off (absent flag = false), so the card is invisible until ramped.
 *
 * Parity: matches the web card's row set, labels, and "X of Y" value
 * shape. The host computes the projected-goal display string
 * (`goalWeightDisplay`) so unit conversion stays in one place per
 * platform. Pinned by `tests/unit/trendSummaryCardMobile.test.tsx`.
 */
export interface TrendSummaryCardProps {
  daysHitCalorieTarget: number;
  totalDaysInWindow: number;
  daysHitProteinTarget: number;
  weighInsThisWeek: number;
  /** Pre-formatted goal-weight string (e.g. "72 kg" / "159 lb"). When
   *  null/undefined the projected-goal row is hidden. */
  goalWeightDisplay?: string | null;
  /** Pre-formatted projected goal date label (e.g. "12 Aug"). */
  goalDateLabel?: string | null;
  testID?: string;
}

export function TrendSummaryCard({
  daysHitCalorieTarget,
  totalDaysInWindow,
  daysHitProteinTarget,
  weighInsThisWeek,
  goalWeightDisplay,
  goalDateLabel,
  testID,
}: TrendSummaryCardProps) {
  const colors = useThemeColors();

  if (!isFeatureEnabled("progress-trend-summary-mobile")) return null;

  const rows: { label: string; value: string }[] = [
    {
      label: "Days hit calorie target",
      value: `${daysHitCalorieTarget} of ${totalDaysInWindow}`,
    },
    {
      label: "Days hit protein target",
      value: `${daysHitProteinTarget} of ${totalDaysInWindow}`,
    },
    {
      label: "Weigh-ins",
      value: `${weighInsThisWeek} of ${totalDaysInWindow}`,
    },
  ];

  if (goalWeightDisplay) {
    rows.push({
      label: `Projected ${goalWeightDisplay} by`,
      value: goalDateLabel ?? "—",
    });
  }

  return (
    // Card chrome is the shared <SupprCard> shell (Grace 2026-06-04).
    <SupprCard
      testID={testID ?? "progress-trend-summary-card"}
      accessibilityLabel="Trend summary"
      padding="md"
    >
      <Text
        testID="progress-trend-summary-header"
        style={[styles.header, { color: colors.textSecondary }]}
      >
        TREND SUMMARY
      </Text>
      <View style={styles.rows}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {row.label}
            </Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </SupprCard>
  );
}

const styles = StyleSheet.create({
  header: {
    ...Type.label,
  },
  rows: {
    marginTop: Spacing.md - 2,
    gap: Spacing.sm + 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm + 4,
  },
  label: {
    fontSize: 13,
    fontWeight: FontWeight.regular,
    flexShrink: 1,
  },
  value: {
    fontSize: 13,
    fontWeight: FontWeight.bold,
    fontVariant: ["tabular-nums"],
  },
});

export default TrendSummaryCard;
