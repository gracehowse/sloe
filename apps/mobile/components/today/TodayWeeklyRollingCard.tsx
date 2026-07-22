import { Text, View } from "react-native";
import { TrendingUp } from "lucide-react-native";

import { Accent, Spacing, Type } from "@/constants/theme";
import { SupprCard } from "@/components/ui/SupprCard";
import { weekSummaryHeading, type WeekSummaryMode } from "@suppr/nutrition-core/weekSummaryWindow";
import { WEEKLY_ROLLING_DENOMINATOR_HINT } from "@suppr/shared/copy/today";

/**
 * TodayWeeklyRollingCard — the 7-day rolling deficit/surplus rollup card.
 * Extracted verbatim from `TodayActivityBonusCard.tsx` (ENG-1506 touch) to
 * keep that pinned file under its line budget; all values are host-computed
 * and passed down, so this stays pure presentation. Web twin:
 * `src/app/components/suppr/today-weekly-rolling-card.tsx`.
 */
export function TodayWeeklyRollingCard({
  weekSummaryMode,
  weekConsumed,
  isWeekDeficit,
  dailyAvgDeficit,
  weekDeficit,
  weeklyKgRate,
  textSecondaryColor,
  textTertiaryColor,
}: {
  weekSummaryMode: WeekSummaryMode;
  weekConsumed: number;
  isWeekDeficit: boolean;
  dailyAvgDeficit: number;
  weekDeficit: number;
  weeklyKgRate: number;
  textSecondaryColor: string;
  textTertiaryColor: string;
}) {
  const isCalibrating = weekConsumed === 0;
  const valueColor = isCalibrating
    ? textSecondaryColor
    : isWeekDeficit
      ? Accent.success
      : Accent.warning;
  const rows: { label: string; value: string }[] = [
    {
      label: `Avg daily ${isWeekDeficit ? "deficit" : "surplus"}`,
      value: `${Math.abs(dailyAvgDeficit).toLocaleString()} kcal`,
    },
    {
      label: `Weekly ${isWeekDeficit ? "deficit" : "surplus"}`,
      value: `${Math.abs(weekDeficit).toLocaleString()} kcal`,
    },
    {
      label: `Projected weekly ${isWeekDeficit ? "loss" : "gain"}`,
      value: `${weeklyKgRate.toFixed(2)} kg`,
    },
  ];
  return (
    // Sibling card on the Today scroll ground → soft lift (one-treatment, Grace 2026-06-09).
    <SupprCard lift="soft" padding="lg" testID="today-weekly-rolling-card">
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm }}>
        <TrendingUp size={14} color={Accent.success} strokeWidth={2} />
        <Text style={{ ...Type.label, color: textTertiaryColor }}>
          {weekSummaryHeading(weekSummaryMode)}
        </Text>
      </View>
      {rows.map((row, i) => (
        <View
          key={row.label}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: i === 0 ? 0 : Spacing.sm,
          }}
        >
          <Text style={{ ...Type.body, color: textSecondaryColor }}>{row.label}</Text>
          <Text style={{ ...Type.headline, color: valueColor, fontVariant: ["tabular-nums"] }}>
            {row.value}
          </Text>
        </View>
      ))}
      <Text style={{ ...Type.caption, color: textTertiaryColor, marginTop: Spacing.sm, lineHeight: 16 }}>
        {WEEKLY_ROLLING_DENOMINATOR_HINT}
      </Text>
    </SupprCard>
  );
}

export default TodayWeeklyRollingCard;
