import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { Accent, FontWeight, Radius, Spacing, Type } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";

/**
 * WeeklyInsightCard (mobile) — Today-screen weekly summary card, the
 * React Native port of the web `TodayWeeklyInsightCard`
 * (`src/app/components/suppr/today-weekly-insight-card.tsx`). ENG-754.
 *
 * Every number is derived from log data the Today screen already holds
 * for the selected week (logged days, daily totals, target). No
 * fabrication — `weekAvgKcal` is `null` when the week has no logged day
 * so we never show "0 kcal" as a faux average.
 *
 * Gated behind `today-weekly-insight-mobile`. The flag defaults to off
 * (absent flag = false), so this card is invisible until ramped.
 *
 * States covered:
 *  - Loaded week with at least one logged day: logged-days count,
 *    daily kcal average, and a 7-bar sparkline of daily calories.
 *  - Empty week (no logs): household planning line + muted placeholder
 *    sparkline, with "Log a meal to start the week."
 *
 * Parity note: the sparkline bar-height maths is identical to web
 * (`safeMax = max(target × 1.2, ...daily, 1)`; empty days clamp to a 4%
 * baseline) so the two surfaces can't drift. Pinned by
 * `tests/unit/weeklyInsightCardMobile.test.tsx`.
 */
export interface WeeklyInsightCardProps {
  /** Number of people this plan is cooking for (household member count
   *  + 1 for the user). 0 hides the planning line. */
  householdSize: number;
  /** Days in the selected week with at least one meal logged (0-7). */
  loggedDaysInWeek: number;
  /** Average daily kcal across the week. Null when no day is logged. */
  weekAvgKcal: number | null;
  /** Daily kcal totals for the week (length 7; 0 = no log marker). */
  weekDailyKcal: number[];
  /** Per-day kcal target — drives the sparkline y-axis scaling. */
  dailyKcalTarget: number;
  textColor: string;
  textSecondaryColor: string;
  cardBackgroundColor: string;
  borderColor: string;
}

/** Shared bar-height maths — exported so the unit test can assert it
 *  matches the web component's `bars` memo without rendering RN. */
export function computeSparklineHeights(
  weekDailyKcal: number[],
  dailyKcalTarget: number,
): number[] {
  const safeMax = Math.max(
    dailyKcalTarget > 0 ? dailyKcalTarget * 1.2 : 0,
    ...weekDailyKcal,
    1,
  );
  return weekDailyKcal.slice(0, 7).map((v) => {
    const pct = Math.min(100, Math.max(0, (v / safeMax) * 100));
    return pct;
  });
}

export function WeeklyInsightCard({
  householdSize,
  loggedDaysInWeek,
  weekAvgKcal,
  weekDailyKcal,
  dailyKcalTarget,
  textColor,
  textSecondaryColor,
  cardBackgroundColor,
  borderColor,
}: WeeklyInsightCardProps) {
  const bars = React.useMemo(
    () => computeSparklineHeights(weekDailyKcal, dailyKcalTarget),
    [weekDailyKcal, dailyKcalTarget],
  );

  if (!isFeatureEnabled("today-weekly-insight-mobile")) return null;

  const loggedLine =
    loggedDaysInWeek === 0
      ? "Log a meal to start the week."
      : loggedDaysInWeek === 1
        ? "1 day logged so far."
        : `${loggedDaysInWeek} days logged so far.`;

  return (
    <View
      testID="today-weekly-insight-mobile"
      accessibilityLabel="Weekly insight"
      style={[
        styles.card,
        { backgroundColor: cardBackgroundColor, borderColor },
      ]}
    >
      <View style={styles.headerRow}>
        <Sparkles size={14} color={Accent.primary} strokeWidth={1.75} />
        <Text style={[styles.headerLabel, { color: textSecondaryColor }]}>
          WEEKLY INSIGHT
        </Text>
      </View>

      {householdSize > 0 ? (
        <Text style={[styles.planningLine, { color: textColor }]}>
          {householdSize === 1
            ? "Planning for you this week"
            : `Planning for ${householdSize} this week`}
        </Text>
      ) : null}

      <Text style={[styles.summaryLine, { color: textSecondaryColor }]}>
        {loggedLine}
        {weekAvgKcal != null ? (
          <Text style={{ color: textColor, fontWeight: FontWeight.semibold }}>
            {" "}
            {Math.round(weekAvgKcal).toLocaleString()} kcal
          </Text>
        ) : null}
        {weekAvgKcal != null ? " daily average." : ""}
      </Text>

      {/* Sparkline — 7 bars, one per day. Empty days render at a ~4%
          baseline so the row is visible without faking a zero value. */}
      <View
        style={styles.sparkline}
        accessibilityRole="image"
        accessibilityLabel={
          loggedDaysInWeek === 0
            ? "No meals logged this week yet."
            : `${loggedDaysInWeek} days logged this week.`
        }
      >
        {bars.map((pct, i) => {
          const hasData = (weekDailyKcal[i] ?? 0) > 0;
          return (
            <View key={i} style={styles.barTrack}>
              <View
                style={{
                  width: "100%",
                  height: `${Math.max(4, pct)}%`,
                  borderTopLeftRadius: 2,
                  borderTopRightRadius: 2,
                  backgroundColor: hasData ? Accent.primary : borderColor,
                  opacity: hasData ? 1 : 0.6,
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs + 2,
    marginBottom: Spacing.sm,
  },
  headerLabel: {
    ...Type.label,
  },
  planningLine: {
    ...Type.body,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  summaryLine: {
    ...Type.caption,
    marginBottom: Spacing.sm,
  },
  sparkline: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.xs,
    height: 56,
  },
  barTrack: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
});

export default WeeklyInsightCard;
