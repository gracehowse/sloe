import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react-native";

import { Accent, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { WeightTrendResult } from "@/lib/progress/weightTrend";
import { kgToLb } from "../../../../src/lib/units/imperial";

/**
 * Withings-style chart header (Grace TF feedback 2026-05-11 — full
 * rebuild after "still looks messy / illogical").
 *
 * Layout (Withings parity):
 *   ┌─────────────────────────────────────┐
 *   │      11 Apr – 12 May 2026           │  ← period label, centred
 *   ├──────────────────┬──────────────────┤
 *   │ WEIGHT           │ TREND            │  ← uppercase overlines
 *   │ ↘  Down          │ −0.6 kg          │  ← icon LEFT of word
 *   └──────────────────┴──────────────────┘
 *
 * Period label moved to the top centre (was orphaned under WEIGHT
 * column before, looked like it only described that column).
 * Vertical divider between the two columns to anchor the eye.
 */

const STATUS_LABEL: Record<WeightTrendResult["trendStatus"], string> = {
  stable: "Stable",
  down: "Down",
  up: "Up",
  // 2026-05-11 (Grace TF feedback): only used when the trend payload
  // truly has zero entries. The card itself is gated on
  // `points.length >= 1`, so this label is unreachable in normal
  // flow — kept as a defensive fallback.
  no_data: "—",
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
  /** Period label like "11 Apr – 12 May 2026" or "Last 30 days". */
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
      {periodLabel ? (
        <Text style={[styles.periodLabel, { color: colors.textTertiary }]}>
          {periodLabel}
        </Text>
      ) : null}
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
              <StatusIcon size={14} color={statusIconColor} strokeWidth={2.25} />
            </View>
            <Text style={[styles.bigLabel, { color: colors.text }]}>
              {STATUS_LABEL[status]}
            </Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.col}>
          <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>
            TREND
          </Text>
          <Text style={[styles.bigLabel, { color: colors.text }]}>
            {deltaLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.md,
  },
  periodLabel: {
    ...Type.caption,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  col: {
    flex: 1,
  },
  divider: {
    // 2026-05-11 (Grace TF feedback — mockup signed off): hairline
    // was invisible against the card background. Bumped to 1px and
    // using the slightly darker `border` token so the line reads
    // clearly even on light mode.
    width: 1,
    marginHorizontal: Spacing.md,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bigLabel: {
    ...Type.title,
    fontSize: 20,
    lineHeight: 22,
  },
});
