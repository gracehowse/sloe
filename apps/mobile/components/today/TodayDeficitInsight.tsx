import React from "react";
import { Text, View } from "react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";
import {
  weekSummaryDateKeys,
  type WeekSummaryMode,
} from "../../../../src/lib/nutrition/weekSummaryWindow";
import type { JournalMeal } from "@/lib/nutritionJournal";

/**
 * TodayDeficitInsight — small "under budget" banner shown on today view
 * when there's calorie headroom left.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18).
 */
export interface TodayDeficitInsightProps {
  remaining: number;
  weekSummaryMode: WeekSummaryMode;
  selectedDate: Date;
  weekStartDay: "monday" | "sunday";
  byDay: Record<string, JournalMeal[]>;
  targetCalories: number;
  preferActivityAdjustedCalories: boolean;
  activityBonusCaloriesOnly: boolean;
  activityBurnByDay: Record<string, number>;
  basalBurnByDay: Record<string, number>;
  maintenanceKcal: number;
  dayActivityBudgetAddon: (
    prefer: boolean,
    bonusOnly: boolean,
    activityByDay: Record<string, number>,
    basalByDay: Record<string, number>,
    maintenanceKcal: number,
    dk: string,
  ) => number;
  textSecondaryColor: string;
}

export function TodayDeficitInsight({
  remaining,
  weekSummaryMode,
  selectedDate,
  weekStartDay,
  byDay,
  targetCalories,
  preferActivityAdjustedCalories,
  activityBonusCaloriesOnly,
  activityBurnByDay,
  basalBurnByDay,
  maintenanceKcal,
  dayActivityBudgetAddon,
  textSecondaryColor,
}: TodayDeficitInsightProps) {
  const keys = weekSummaryDateKeys(weekSummaryMode, selectedDate, weekStartDay);
  const keysWithMeals = keys.filter((k) => (byDay[k] ?? []).length > 0);
  const avgDeficit = keysWithMeals.length < 2
    ? null
    : Math.round(
        keysWithMeals.reduce((sum, k) => {
          const dayCals = (byDay[k] ?? []).reduce((a, m) => a + m.calories, 0);
          const dayGoal =
            targetCalories +
            dayActivityBudgetAddon(
              preferActivityAdjustedCalories,
              activityBonusCaloriesOnly,
              activityBurnByDay,
              basalBurnByDay,
              maintenanceKcal,
              k,
            );
          return sum + (dayGoal - dayCals);
        }, 0) / keysWithMeals.length,
      );

  return (
    <View
      style={{
        backgroundColor: Accent.primary + "12",
        borderRadius: Radius.md,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Accent.primary + "25",
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "600", color: Accent.primary }}>
        ~{remaining} kcal under budget so far today
      </Text>
      {avgDeficit != null && avgDeficit > 0 ? (
        <Text style={{ fontSize: 11, color: textSecondaryColor, marginTop: 4 }}>
          {weekSummaryMode === "calendar_week" ? "Week avg" : "7-day avg"}: ~{avgDeficit} kcal/day under goal
        </Text>
      ) : null}
    </View>
  );
}

export default TodayDeficitInsight;
