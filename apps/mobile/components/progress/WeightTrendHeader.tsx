import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react-native";

import { Accent, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { WeightTrendResult } from "@/lib/progress/weightTrend";
import { kgToLb } from "../../../../src/lib/units/imperial";

/**
 * Withings-style chart header (Grace TF feedback 2026-05-11).
 *
 * Mirrors the structure of the Withings "WEIGHT: Stable" / "TREND -0.6 kg"
 * header above the weight chart. Pulled out of `progress.tsx` into its
 * own file so the layout + arrow-icon logic stays testable + reusable
 * (e.g. when we later open an "Explore Data" full-screen view, the same
 * header sits above).
 */

const STATUS_LABEL: Record<WeightTrendResult["trendStatus"], string> = {
  stable: "Stable",
  down: "Down",
  up: "Up",
  no_data: "No data",
};

function formatDelta(kg: number, isImperial: boolean): string {
  const v = isImperial ? kgToLb(kg) : Math.round(kg * 10) / 10;
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "+";
  return `${sign}${abs.toFixed(1)} ${isImperial ? "lb" : "kg"}`;
}

export interface WeightTrendHeaderProps {
  trend: Pick<WeightTrendResult, "trendStatus" | "trendDeltaKg">;
  isImperial: boolean;
  /** Period label like "11 Apr – 12 May 2026". Optional; rendered below header when present. */
  periodLabel?: string | null;
}

export function WeightTrendHeader({ trend, isImperial, periodLabel }: WeightTrendHeaderProps) {
  const colors = useThemeColors();

  const status = trend.trendStatus;
  const StatusIcon =
    status === "down" ? TrendingDown : status === "up" ? TrendingUp : ArrowRight;
  // Stable arrow is neutral grey; down/up arrow is accent blue so the
  // direction is glanceable. Withings does the same.
  const statusIconColor =
    status === "stable" || status === "no_data" ? colors.textSecondary : Accent.primary;

  const deltaLabel =
    trend.trendDeltaKg != null && status !== "no_data"
      ? formatDelta(trend.trendDeltaKg, isImperial)
      : "—";

  return (
    <View style={styles.wrap} testID="weight-trend-header">
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>
            WEIGHT
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: statusIconColor + "1f" },
              ]}
            >
              <StatusIcon size={16} color={statusIconColor} strokeWidth={2.25} />
            </View>
            <Text style={[styles.bigLabel, { color: colors.text }]}>
              {STATUS_LABEL[status]}
            </Text>
          </View>
        </View>
        <View style={styles.col}>
          <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>
            TREND
          </Text>
          <Text style={[styles.bigLabel, { color: colors.text }]}>
            {deltaLabel}
          </Text>
        </View>
      </View>
      {periodLabel ? (
        <Text style={[styles.periodLabel, { color: colors.textTertiary }]}>
          {periodLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.lg,
  },
  col: {
    flex: 1,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  bigLabel: {
    ...Type.title,
    fontSize: 20,
    lineHeight: 24,
  },
  periodLabel: {
    ...Type.caption,
    marginTop: Spacing.xs,
  },
});
