import React from "react";
import { Text, View } from "react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";
import {
  weekSummaryDateKeys,
  type WeekSummaryMode,
} from "../../../../src/lib/nutrition/weekSummaryWindow";
import type { JournalMeal } from "@/lib/nutritionJournal";
import { NET_DEFICIT_LABEL } from "../../../../src/lib/copy/today";

/**
 * TodayDeficitInsight — small banner shown on today view when there's
 * calorie headroom left. Uses canonical "deficit" phrasing from
 * `src/lib/copy/today.ts`.
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
  /**
   * Neutral surface tokens (added 2026-04-30 visual-qa medium polish).
   * The banner is informational, not an action. Using the same blue
   * tint as the hero ring + fasting pill + duplicate-day chip pushed
   * Today into a 4-5 blue-card monochrome stack. Neutral chrome lets
   * the deficit *number* keep its blue accent without painting the
   * whole card blue.
   */
  surfaceBackgroundColor?: string;
  surfaceBorderColor?: string;
  /**
   * Label colour (for the leading "~XXX kcal" line). Defaults to
   * `Accent.primary` so the deficit number still carries the brand
   * cue.
   */
  labelColor?: string;
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
  surfaceBackgroundColor,
  surfaceBorderColor,
  labelColor,
}: TodayDeficitInsightProps) {
  const keys = weekSummaryDateKeys(weekSummaryMode, selectedDate, weekStartDay);
  const keysWithMeals = keys.filter((k) => (byDay[k] ?? []).length > 0);
  // F-25 (2026-04-21): hide the deficit banner on an empty day. Before,
  // a user with nothing logged saw "~1667 kcal deficit so far today" —
  // technically true but useless and contributing to the cluttered-3-
  // cards feeling on Today (TestFlight AJ2q4OgYYXE7). If the *current*
  // day has 0 meals, the banner adds no information — don't render.
  const todayKey = selectedDate.toISOString().slice(0, 10);
  const hasLoggedToday = (byDay[todayKey] ?? []).length > 0;
  if (!hasLoggedToday) return null;

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

  const resolvedBg = surfaceBackgroundColor ?? Accent.primary + "08";
  const resolvedBorder = surfaceBorderColor ?? Accent.primary + "30";
  const resolvedLabel = labelColor ?? Accent.primary;

  return (
    <View
      style={{
        backgroundColor: resolvedBg,
        borderRadius: Radius.md,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: resolvedBorder,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "600", color: resolvedLabel }}>
        ~{remaining} kcal {NET_DEFICIT_LABEL} so far today
      </Text>
      {/* F-83 (2026-04-25) — hide the rolling-average sub-line when it
          sits in the noise floor (<50 kcal/day). A "~2 kcal/day deficit"
          line is below logging precision and reads as broken to the user
          (customer-lens 2026-04-25: "I've been logging for a week and the
          summary is meaningless — why am I doing this?"). 50 kcal/day is
          ~0.05 kg/week — anything below is statistically noise, not a
          deficit signal. Sub-line returns once the average crosses that
          floor in either direction. */}
      {avgDeficit != null && Math.abs(avgDeficit) >= 50 ? (
        <Text style={{ fontSize: 11, color: textSecondaryColor, marginTop: 4 }}>
          {weekSummaryMode === "calendar_week" ? "Week avg" : "7-day avg"}: ~{avgDeficit} kcal/day {NET_DEFICIT_LABEL}
        </Text>
      ) : null}
    </View>
  );
}

export default TodayDeficitInsight;
