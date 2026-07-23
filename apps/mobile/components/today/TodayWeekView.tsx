import React, { memo, useMemo } from "react";
import { Text, View } from "react-native";
import { MacroColors, MacroColorsDark, Radius, Spacing } from "@/constants/theme";
import { useAccent, useResolvedScheme } from "@/context/theme";
import { PressableScale } from "@/components/ui/PressableScale";
import { TodayWeekSummaryStats } from "./TodayWeekSummaryStats";
import { closestToTargetIndex, TodayWeekCalorieChart } from "./TodayWeekCalorieChart";
import type { TodayWeekDay, TodayWeekViewProps } from "./TodayWeekTypes";

export type { TodayWeekDay, TodayWeekViewProps } from "./TodayWeekTypes";

function MacroBarRow({
  label,
  current,
  goal,
  color,
  styles,
}: {
  label: string;
  current: number;
  goal: number;
  color: string;
  styles: Record<string, unknown>;
}) {
  const pct = goal > 0 ? Math.min(1, current / goal) : 0;
  const rem = Math.max(0, Math.round(goal - current));
  return (
    <View style={styles.macroBarBlock as object}>
      <View style={styles.macroBarTop as object}>
        <Text style={[styles.macroBarTitle as object, { color }]}>{label}</Text>
        <Text style={styles.macroBarNums as object}>
          {Math.round(current)}g / {Math.round(goal)}g · {rem}g left
        </Text>
      </View>
      <View style={styles.macroBarTrack as object}>
        <View
          style={[
            styles.macroBarFill as object,
            { width: `${pct * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

function TodayWeekViewImpl(props: TodayWeekViewProps) {
  const {
    days,
    weekTotals,
    weekAvg,
    daysWithFood,
    weekBurnTotal,
    calorieTarget,
    proteinTarget,
    carbsTarget,
    fatTarget,
    preferActivityAdjustedCalories,
    activityBonusCaloriesOnly,
    maintenanceKcal,
    dayGoals,
    onSelectDay,
    styles,
    textColor,
    textSecondaryColor,
    textTertiaryColor,
    borderColor,
  } = props;

  const accent = useAccent();
  const mc = useResolvedScheme() === "dark" ? MacroColorsDark : MacroColors;

  const bestIdx = useMemo(
    () => closestToTargetIndex(days, dayGoals, calorieTarget),
    [days, dayGoals, calorieTarget],
  );
  const bestDayLabel = bestIdx != null && days[bestIdx] ? days[bestIdx].short : null;

  return (
    <>
      <TodayWeekCalorieChart
        days={days}
        weekAvgCalories={weekAvg.calories}
        daysWithFood={daysWithFood}
        bestDayLabel={bestDayLabel}
        calorieTarget={calorieTarget}
        dayGoals={dayGoals}
        onSelectDay={onSelectDay}
        styles={styles}
        textSecondaryColor={textSecondaryColor}
        textTertiaryColor={textTertiaryColor}
        borderColor={borderColor}
        textColor={textColor}
        accentPrimary={accent.primary}
        accentPrimaryLight={accent.primaryLight}
        preferActivityAdjustedCalories={preferActivityAdjustedCalories}
        activityBonusCaloriesOnly={activityBonusCaloriesOnly}
        maintenanceKcal={maintenanceKcal}
      />

      <TodayWeekSummaryStats
        totalCalories={weekTotals.calories}
        avgCalories={weekAvg.calories}
        daysWithFood={daysWithFood}
        weekBurnTotal={weekBurnTotal}
        maintenanceKcal={maintenanceKcal}
        accentPrimarySolid={accent.primarySolid}
        textColor={textColor}
        textSecondaryColor={textSecondaryColor}
        cardStyle={styles.card as Record<string, unknown>}
        cardTitleStyle={styles.cardTitle as Record<string, unknown>}
      />

      <View style={styles.card as object}>
        <Text style={styles.cardTitle as object}>Daily averages</Text>
        <Text style={{ fontSize: 11, color: textTertiaryColor, marginBottom: Spacing.sm }}>
          Based on {daysWithFood} day{daysWithFood !== 1 ? "s" : ""} with logged food
        </Text>
        <MacroBarRow
          label="PROTEIN"
          current={weekAvg.protein}
          goal={proteinTarget}
          color={mc.protein}
          styles={styles}
        />
        <MacroBarRow
          label="CARBS"
          current={weekAvg.carbs}
          goal={carbsTarget}
          color={mc.carbs}
          styles={styles}
        />
        <MacroBarRow
          label="FATS"
          current={weekAvg.fat}
          goal={fatTarget}
          color={mc.fat}
          styles={styles}
        />
      </View>

      <View style={styles.card as object}>
        <Text style={styles.cardTitle as object}>Macro breakdown</Text>
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          {days.map((day) => (
            <PressableScale
              key={day.key}
              haptic="selection"
              onPress={() => onSelectDay(day.date)}
              style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}
            >
              <Text
                style={{ width: 30, fontSize: 11, fontWeight: "600", color: textSecondaryColor }}
              >
                {day.short}
              </Text>
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  height: 14,
                  borderRadius: 3,
                  overflow: "hidden",
                  backgroundColor: borderColor,
                }}
              >
                {day.totals.calories > 0 &&
                  (() => {
                    const total = day.totals.protein + day.totals.carbs + day.totals.fat || 1;
                    return (
                      <>
                        <View
                          style={{
                            width: `${(day.totals.protein / total) * 100}%`,
                            backgroundColor: mc.protein,
                          }}
                        />
                        <View
                          style={{
                            width: `${(day.totals.carbs / total) * 100}%`,
                            backgroundColor: mc.carbs,
                          }}
                        />
                        <View
                          style={{
                            width: `${(day.totals.fat / total) * 100}%`,
                            backgroundColor: mc.fat,
                          }}
                        />
                      </>
                    );
                  })()}
              </View>
              <Text
                style={{
                  width: 45,
                  fontSize: 11,
                  color: textTertiaryColor,
                  textAlign: "right",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {day.totals.calories > 0 ? `${Math.round(day.totals.calories)}` : "—"}
              </Text>
            </PressableScale>
          ))}
        </View>
        <View
          style={{
            flexDirection: "row",
            gap: Spacing.lg,
            justifyContent: "center",
            marginTop: Spacing.md,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{ width: 8, height: 8, borderRadius: Radius.sm, backgroundColor: mc.protein }}
            />
            <Text style={{ fontSize: 10, color: textSecondaryColor }}>Protein</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{ width: 8, height: 8, borderRadius: Radius.sm, backgroundColor: mc.carbs }}
            />
            <Text style={{ fontSize: 10, color: textSecondaryColor }}>Carbs</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{ width: 8, height: 8, borderRadius: Radius.sm, backgroundColor: mc.fat }}
            />
            <Text style={{ fontSize: 10, color: textSecondaryColor }}>Fat</Text>
          </View>
        </View>
      </View>
    </>
  );
}

export const TodayWeekView = memo(TodayWeekViewImpl);

export default TodayWeekView;
