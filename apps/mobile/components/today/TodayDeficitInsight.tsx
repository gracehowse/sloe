import React from "react";
import { Text, View } from "react-native";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import {
  weekSummaryDateKeys,
  type WeekSummaryMode,
} from "@suppr/shared/nutrition/weekSummaryWindow";
import { dateKeyFromDate, type JournalMeal } from "@/lib/nutritionJournal";
import { NET_DEFICIT_LABEL } from "@suppr/shared/copy/today";

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
  weekSummaryMode,
  selectedDate,
  weekStartDay,
  byDay,
  activityBurnByDay,
  basalBurnByDay,
  textSecondaryColor,
  surfaceBackgroundColor,
  surfaceBorderColor,
  labelColor,
}: TodayDeficitInsightProps) {
  const keys = weekSummaryDateKeys(weekSummaryMode, selectedDate, weekStartDay);
  // F-25 (2026-04-21): hide the deficit banner on an empty day. Before,
  // a user with nothing logged saw "~1667 kcal deficit so far today" —
  // technically true but useless and contributing to the cluttered-3-
  // cards feeling on Today (TestFlight AJ2q4OgYYXE7). If the *current*
  // day has 0 meals, the banner adds no information — don't render.
  // Use the local-time day key (matches `dateKeyFromDate` used across
  // the host) — `toISOString().slice(0,10)` returns the UTC day, which
  // diverges from the keys used by `byDay`, `activityBurnByDay`, and
  // `basalBurnByDay` for any user not on UTC. Pre-fix, the banner
  // could read an empty burn record near midnight in non-UTC zones.
  const todayKey = dateKeyFromDate(selectedDate);
  const hasLoggedToday = (byDay[todayKey] ?? []).length > 0;
  if (!hasLoggedToday) return null;

  // 2026-05-05 (Grace): the banner used to show `goal - consumed`
  // (calories REMAINING in budget) but labelled it "deficit", which
  // contradicted the Activity Bonus card directly below — that card
  // shows `burn - consumed` (true energy deficit). Same screen, same
  // word, two different numbers. Aligned to the Activity Bonus
  // calculation so the two surfaces always agree:
  //   - today's number = burnSoFar(today) - consumed(today)
  //   - 7-day avg     = (Σburn(window) - Σconsumed(window)) / 7
  // (matches `TodayActivityBonusCard` `weekDeficit / 7`).
  const consumedToday = (byDay[todayKey] ?? []).reduce(
    (a, m) => a + Math.max(0, m.calories),
    0,
  );
  const burnToday =
    (activityBurnByDay[todayKey] ?? 0) + (basalBurnByDay[todayKey] ?? 0);
  const todayNetDeficit = Math.round(burnToday - consumedToday);
  // No burn data yet → can't compute a true net; suppress rather than
  // silently fall back to a different definition.
  if (burnToday <= 0) return null;
  // Banner is for "you're in deficit" — if today is actually a surplus
  // the Activity Bonus card already surfaces that with appropriate
  // colour; don't double-render with a confusing positive-framed line.
  if (todayNetDeficit <= 0) return null;

  // 2026-05-26 fix (Grace): average over days the user ACTUALLY logged,
  // not a hardcoded /7. Mid-week the calendar window has only the elapsed
  // days logged; dividing by 7 diluted the average toward zero with the
  // empty future days (e.g. Mon −800 + Tue −220 = −1020 read as ~148/day
  // instead of ~510). Sum burn + consumed only over days with a meal
  // logged, and divide by that count.
  let weekBurn = 0;
  let weekConsumed = 0;
  let loggedDays = 0;
  for (const dk of keys) {
    const meals = byDay[dk] ?? [];
    if (meals.length === 0) continue;
    weekBurn += (activityBurnByDay[dk] ?? 0) + (basalBurnByDay[dk] ?? 0);
    weekConsumed += meals.reduce((a, m) => a + Math.max(0, m.calories), 0);
    loggedDays += 1;
  }
  const avgDeficit =
    weekBurn > 0 && loggedDays > 0
      ? Math.round((weekBurn - weekConsumed) / loggedDays)
      : null;

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
      <Text style={{ ...Type.body, color: resolvedLabel }}>
        ~{todayNetDeficit.toLocaleString()} kcal {NET_DEFICIT_LABEL} so far today
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
        // The window (rolling 7-day vs calendar week) is controlled from
        // Settings ("Burn / deficit summary" row) — mirroring web — so
        // this line is read-only and reflects the hydrated mode.
        <Text style={{ ...Type.caption, color: textSecondaryColor, marginTop: Spacing.xs }}>
          {weekSummaryMode === "calendar_week" ? "Week avg" : "7-day avg"}: ~{avgDeficit.toLocaleString()} kcal/day {NET_DEFICIT_LABEL}
        </Text>
      ) : null}
    </View>
  );
}

export default TodayDeficitInsight;
