import { Text, View } from "react-native";
import { Accent, Colors, Radius, Spacing } from "@/constants/theme";
import { PressableScale } from "@/components/ui/PressableScale";
import type { TodayWeekDay } from "./TodayWeekTypes";

export function TodayWeekScrubTooltip({
  day,
  dayGoal,
  cardColor,
  borderColor,
  textColor,
  textSecondaryColor,
  indexInWeek,
  weekLength,
  onDismiss,
}: {
  day: TodayWeekDay;
  dayGoal: number;
  cardColor: string;
  borderColor: string;
  textColor: string;
  textSecondaryColor: string;
  indexInWeek: number;
  weekLength: number;
  onDismiss: () => void;
}) {
  const delta = Math.round(day.totals.calories - dayGoal);
  const deltaLabel =
    delta === 0 ? "On target" : delta > 0 ? `${delta} kcal over` : `${Math.abs(delta)} kcal under`;
  const deltaColor =
    delta === 0 ? Accent.success : delta > 0 ? Accent.warning : Accent.success;
  const colCenterPct = ((indexInWeek + 0.5) / weekLength) * 100;
  const isLeftHalf = colCenterPct < 50;

  return (
    <PressableScale
      haptic="none"
      testID="today-week-chart-tooltip-backdrop"
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Dismiss day details"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <View
        testID="today-week-chart-tooltip"
        accessibilityRole="summary"
        accessibilityLabel={`${day.short} — ${Math.round(day.totals.calories)} kcal of ${Math.round(dayGoal)} kcal target — ${deltaLabel}`}
        style={{
          position: "absolute",
          top: 0,
          [isLeftHalf ? "left" : "right"]: 0,
          paddingVertical: 8,
          paddingHorizontal: Spacing.dense,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: borderColor,
          backgroundColor: cardColor,
          minWidth: 140,
          gap: Spacing.xs,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "700", color: textColor }}>{day.short}</Text>
        <Text style={{ fontSize: 11, color: textSecondaryColor, fontVariant: ["tabular-nums"] }}>
          {Math.round(day.totals.calories)} / {Math.round(dayGoal)} kcal
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: deltaColor }}>{deltaLabel}</Text>
      </View>
    </PressableScale>
  );
}