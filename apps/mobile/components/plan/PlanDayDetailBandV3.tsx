import { StyleSheet, Text, View } from "react-native";

import { SupprCard } from "@/components/ui/SupprCard";
import { Accent, FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { computePlanDayDetail } from "@suppr/shared/planning/planWeekStatus";

/**
 * PlanDayDetailBandV3 — Sloe v3 Plan day-detail calorie band (prototype
 * `plan-day` ~L4771-4783): the selected day's name + kcal/target, a 7px
 * progress bar (sage under / amber over), the gap subline, and an optional
 * macro pill row. Verdict + bar logic come from the shared
 * `computePlanDayDetail` so web parity can't drift. Behind sloe_v3_plan.
 */
export interface PlanDayDetailBandV3Props {
  /** e.g. "Thursday 19". */
  dayLabel: string;
  dayTotalKcal: number;
  targetKcal: number;
  /** Filled (non-empty) slot count — 0 → "Nothing planned yet". */
  plannedCount: number;
  cookedCount: number;
  /** Day macro totals (grams), or null to hide the pill row. */
  macros: { protein: number; carbs: number; fat: number } | null;
}

export function PlanDayDetailBandV3({
  dayLabel,
  dayTotalKcal,
  targetKcal,
  plannedCount,
  cookedCount,
  macros,
}: PlanDayDetailBandV3Props) {
  const colors = useThemeColors();
  const { subline, barPct, tone } = computePlanDayDetail(
    dayTotalKcal,
    targetKcal,
    plannedCount,
    cookedCount,
  );
  const barColor = tone === "warning" ? Accent.warning : Accent.success;
  return (
    <SupprCard
      testID="plan-day-detail-band"
      lift="soft"
      padding="lg"
      style={{ marginTop: Spacing.md }}
    >
      <View style={styles.top}>
        <Text style={[styles.dayName, { color: colors.text }]}>{dayLabel}</Text>
        <Text style={[styles.kcal, { color: colors.textTertiary }]}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {dayTotalKcal.toLocaleString()}
          </Text>{" "}
          / {targetKcal.toLocaleString()}
        </Text>
      </View>
      <View
        style={[styles.barTrack, { backgroundColor: colors.backgroundSecondary }]}
      >
        <View
          style={[
            styles.barFill,
            { width: `${Math.round(barPct * 100)}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      <View style={styles.foot}>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>{subline}</Text>
        {macros ? (
          <Text style={[styles.macros, { color: colors.textTertiary }]}>
            P {Math.round(macros.protein)}g  C {Math.round(macros.carbs)}g  F{" "}
            {Math.round(macros.fat)}g
          </Text>
        ) : null}
      </View>
    </SupprCard>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Spacing.dense,
  },
  dayName: { fontFamily: FontFamily.serifRegular, fontSize: 18, lineHeight: 22 },
  kcal: { fontSize: 13, fontVariant: ["tabular-nums"] },
  barTrack: {
    height: 7,
    borderRadius: Radius.full,
    overflow: "hidden",
    marginTop: 11,
    marginBottom: 10,
  },
  barFill: { height: "100%", borderRadius: Radius.full },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  sub: { ...Type.caption, fontSize: 12 },
  macros: { fontSize: 12, fontVariant: ["tabular-nums"] },
});

export default PlanDayDetailBandV3;
