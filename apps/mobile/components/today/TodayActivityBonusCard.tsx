import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Radius, Spacing } from "@/constants/theme";
import {
  weekSummaryHeading,
  type WeekSummaryMode,
} from "../../../../src/lib/nutrition/weekSummaryWindow";
import type { JournalMeal } from "@/lib/nutritionJournal";

/**
 * TodayActivityBonusCard — summary row, burn breakdown, workouts list,
 * and the weekly deficit rollup.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). All data is host-owned; component only renders and
 * fires `onOpenBurnDetail` when the summary row is tapped.
 */
export interface TodayActivityBonusCardProps {
  isToday: boolean;
  hasBurnData: boolean;
  totalBurnKcal: number;
  consumedCalories: number;
  effectiveCalorieGoal: number;
  basalBurnKcal: number;
  activityBurnKcal: number | null;
  todayActivityBudgetAddon: number;
  dayWorkouts: Array<{ type: string; minutes: number; calories: number; source: string }>;
  trackerWeekSummaryKeys: string[];
  activityBurnByDay: Record<string, number>;
  basalBurnByDay: Record<string, number>;
  byDay: Record<string, JournalMeal[]>;
  weekSummaryMode: WeekSummaryMode;
  onOpenBurnDetail: () => void;
  styles: Record<string, any>;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  borderColor: string;
  cardColor: string;
  cardBorderColor: string;
}

export function TodayActivityBonusCard(props: TodayActivityBonusCardProps) {
  const {
    isToday,
    hasBurnData,
    totalBurnKcal,
    consumedCalories,
    effectiveCalorieGoal,
    basalBurnKcal,
    activityBurnKcal,
    todayActivityBudgetAddon,
    dayWorkouts,
    trackerWeekSummaryKeys,
    activityBurnByDay,
    basalBurnByDay,
    byDay,
    weekSummaryMode,
    onOpenBurnDetail,
    styles,
    textColor,
    textSecondaryColor,
    textTertiaryColor,
    borderColor,
    cardColor,
    cardBorderColor,
  } = props;

  const net = totalBurnKcal - consumedCalories;
  const isDeficit = net >= 0;

  let weekBurn = 0;
  let weekConsumed = 0;
  for (const dk of trackerWeekSummaryKeys) {
    weekBurn += (activityBurnByDay[dk] ?? 0) + (basalBurnByDay[dk] ?? 0);
    const dayMeals = byDay[dk] ?? [];
    weekConsumed += dayMeals.reduce((s, m) => s + Math.max(0, m.calories), 0);
  }
  const showWeekly = weekBurn > 0;
  const weekDeficit = weekBurn - weekConsumed;
  const dailyAvgDeficit = Math.round(weekDeficit / 7);
  const weeklyLbsRate = Math.abs(weekDeficit) / 3500;
  const weeklyKgRate = weeklyLbsRate * 0.4536;
  const isWeekDeficit = weekDeficit >= 0;

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: Spacing.sm }}>
        <Ionicons name="flame" size={20} color={Accent.warning} />
        <Text style={styles.cardTitle}>Activity Bonus</Text>
      </View>

      {!hasBurnData && isToday ? (
        <Text style={{ fontSize: 12, color: textSecondaryColor, marginBottom: Spacing.md, lineHeight: 18 }}>
          No resting or active energy for this day in Suppr yet. Open{" "}
          <Text style={{ fontWeight: "700", color: textColor }}>More → Connected</Text>, enable Apple Health, then pull
          to refresh or revisit this tab to sync.
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm }}>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: textColor, fontVariant: ["tabular-nums"] }}>
            {totalBurnKcal.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 10, color: textTertiaryColor, marginTop: 2 }}>
            {isToday ? "Burn so far" : "Total burn"}
          </Text>
        </View>
        <View style={{ width: 1, backgroundColor: borderColor }} />
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: textColor, fontVariant: ["tabular-nums"] }}>
            {consumedCalories.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 10, color: textTertiaryColor, marginTop: 2 }}>Food logged</Text>
        </View>
        <View style={{ width: 1, backgroundColor: borderColor }} />
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: isDeficit ? Accent.success : Accent.destructive,
              fontVariant: ["tabular-nums"],
            }}
          >
            {Math.abs(net).toLocaleString()}
          </Text>
          <Text style={{ fontSize: 10, color: textTertiaryColor, marginTop: 2 }}>
            {isDeficit ? "Net deficit" : "Net surplus"}
          </Text>
        </View>
      </View>

      {effectiveCalorieGoal > 0 && (
        <Text style={{ fontSize: 11, color: textSecondaryColor, marginBottom: Spacing.sm, textAlign: "center" }}>
          Calorie goal for this day: {effectiveCalorieGoal.toLocaleString()} kcal
        </Text>
      )}

      {((activityBurnKcal ?? 0) > 0 || basalBurnKcal > 0) && (
        <Pressable
          onPress={onOpenBurnDetail}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: Spacing.md,
            marginBottom: Spacing.md,
            borderRadius: Radius.md,
            backgroundColor: cardColor,
            borderWidth: 1,
            borderColor: cardBorderColor,
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="flame-outline" size={14} color={Accent.warning} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: textColor }}>
                {(basalBurnKcal + (activityBurnKcal ?? 0)).toLocaleString()} kcal {isToday ? "burned so far" : "burned"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: Spacing.md }}>
              {(activityBurnKcal ?? 0) > 0 && (
                <Text style={{ fontSize: 11, color: textSecondaryColor }}>
                  Active {(activityBurnKcal ?? 0).toLocaleString()}
                </Text>
              )}
              {basalBurnKcal > 0 && (
                <Text style={{ fontSize: 11, color: textSecondaryColor }}>
                  Resting {basalBurnKcal.toLocaleString()}
                </Text>
              )}
              {todayActivityBudgetAddon > 0 && (
                <Text style={{ fontSize: 11, fontWeight: "700", color: Accent.warning }}>
                  +{todayActivityBudgetAddon.toLocaleString()} {isToday ? "bonus so far" : "bonus earned"}
                </Text>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={textTertiaryColor} />
        </Pressable>
      )}

      {dayWorkouts.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: textColor, marginBottom: 2 }}>Workouts</Text>
          {dayWorkouts.map((w, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
              <Ionicons name="barbell-outline" size={16} color={Accent.primary} />
              <Text style={{ fontSize: 13, color: textColor, flex: 1 }}>{w.type}</Text>
              <Text style={{ fontSize: 12, color: textSecondaryColor, fontVariant: ["tabular-nums"] }}>
                {w.minutes > 0 ? `${w.minutes} min` : ""}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.warning, fontVariant: ["tabular-nums"] }}>
                {w.calories > 0 ? `${w.calories} kcal` : ""}
              </Text>
            </View>
          ))}
        </View>
      )}

      {showWeekly && (
        <View style={{ marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: borderColor }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: textColor, marginBottom: 6 }}>
            {weekSummaryHeading(weekSummaryMode)}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: textSecondaryColor }}>
              Avg daily {isWeekDeficit ? "deficit" : "surplus"}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: isWeekDeficit ? Accent.success : Accent.destructive,
                fontVariant: ["tabular-nums"],
              }}
            >
              {Math.abs(dailyAvgDeficit).toLocaleString()} kcal
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
            <Text style={{ fontSize: 12, color: textSecondaryColor }}>
              Weekly {isWeekDeficit ? "deficit" : "surplus"}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: isWeekDeficit ? Accent.success : Accent.destructive,
                fontVariant: ["tabular-nums"],
              }}
            >
              {Math.abs(weekDeficit).toLocaleString()} kcal
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
            <Text style={{ fontSize: 12, color: textSecondaryColor }}>
              Projected weekly {isWeekDeficit ? "loss" : "gain"}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: isWeekDeficit ? Accent.success : Accent.destructive,
                fontVariant: ["tabular-nums"],
              }}
            >
              {weeklyKgRate.toFixed(2)} kg
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default TodayActivityBonusCard;
