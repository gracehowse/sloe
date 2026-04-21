import React from "react";
import { Pressable, Text, View } from "react-native";
import { Accent, MacroColors, Spacing } from "@/constants/theme";
import { dateKeyFromDate } from "@/lib/nutritionJournal";

/**
 * TodayWeekView — the `viewMode === "week"` bar chart + summary + macro
 * breakdown set.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). Host derives the full `weekData` shape + effective
 * calorie budget; component only renders + fires `onSelectDay`.
 */

export interface TodayWeekDay {
  key: string;
  short: string;
  date: Date;
  totals: { calories: number; protein: number; carbs: number; fat: number };
}

export interface TodayWeekViewProps {
  days: TodayWeekDay[];
  weekTotals: { calories: number; protein: number; carbs: number; fat: number };
  weekAvg: { calories: number; protein: number; carbs: number; fat: number };
  daysWithFood: number;
  weekEffectiveCalorieBudget: number;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  preferActivityAdjustedCalories: boolean;
  activityBonusCaloriesOnly: boolean;
  maintenanceKcal: number;
  /** `targets.calories + day activity budget add-on` per day (same order as `days`). */
  dayGoals: number[];
  onSelectDay: (d: Date) => void;
  styles: Record<string, any>;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  borderColor: string;
}

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
  styles: Record<string, any>;
}) {
  const pct = goal > 0 ? Math.min(1, current / goal) : 0;
  const rem = Math.max(0, Math.round(goal - current));
  return (
    <View style={styles.macroBarBlock}>
      <View style={styles.macroBarTop}>
        <Text style={[styles.macroBarTitle, { color }]}>{label}</Text>
        <Text style={styles.macroBarNums}>
          {Math.round(current)}g / {Math.round(goal)}g · {rem}g left
        </Text>
      </View>
      <View style={styles.macroBarTrack}>
        <View style={[styles.macroBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function TodayWeekView(props: TodayWeekViewProps) {
  const {
    days,
    weekTotals,
    weekAvg,
    daysWithFood,
    weekEffectiveCalorieBudget,
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

  const maxCal = Math.max(1, ...days.map((d, i) => Math.max(d.totals.calories, dayGoals[i] ?? calorieTarget)));
  const todayDk = dateKeyFromDate(new Date());

  return (
    <>
      {/* Weekly bar chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly Calories</Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
            height: 140,
            marginTop: Spacing.md,
          }}
        >
          {days.map((day, i) => {
            const dayGoal = dayGoals[i] ?? calorieTarget;
            const barHeight = maxCal > 0 ? Math.max(4, (day.totals.calories / maxCal) * 110) : 4;
            const over = day.totals.calories > dayGoal;
            const isCurrentDay = day.key === todayDk;
            return (
              <Pressable
                key={day.key}
                onPress={() => onSelectDay(day.date)}
                style={{ alignItems: "center", flex: 1, gap: 4 }}
              >
                <Text style={{ fontSize: 10, color: textTertiaryColor, fontVariant: ["tabular-nums"] }}>
                  {day.totals.calories > 0 ? Math.round(day.totals.calories) : ""}
                </Text>
                <View
                  style={{
                    width: 28,
                    height: barHeight,
                    borderRadius: 4,
                    backgroundColor: over
                      ? Accent.warning + "CC"
                      : day.totals.calories > 0
                        ? Accent.primary
                        : borderColor,
                  }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: isCurrentDay ? "800" : "600",
                    color: isCurrentDay ? Accent.primary : textSecondaryColor,
                  }}
                >
                  {day.short}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 4 }}>
          <Text style={{ fontSize: 10, color: textTertiaryColor }}>
            {preferActivityAdjustedCalories
              ? activityBonusCaloriesOnly
                ? `Goal: ${calorieTarget} kcal base + bonus burn (above ~${maintenanceKcal} kcal maintenance) from Health`
                : `Goal: ${calorieTarget} kcal base + active energy from Health`
              : `Daily goal: ${calorieTarget} kcal`}
          </Text>
        </View>
      </View>

      {/* Weekly summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly Summary</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: Spacing.md }}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: textColor, fontVariant: ["tabular-nums"] }}>
              {Math.round(weekTotals.calories)}
            </Text>
            <Text style={{ fontSize: 11, color: textSecondaryColor }}>Total kcal</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: Accent.primary, fontVariant: ["tabular-nums"] }}>
              {Math.round(weekAvg.calories)}
            </Text>
            <Text style={{ fontSize: 11, color: textSecondaryColor }}>Daily avg</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "800",
                color: weekEffectiveCalorieBudget > weekTotals.calories ? Accent.success : Accent.warning,
                fontVariant: ["tabular-nums"],
              }}
            >
              {Math.round(Math.abs(weekEffectiveCalorieBudget - weekTotals.calories))}
            </Text>
            <Text style={{ fontSize: 11, color: textSecondaryColor }}>
              {weekEffectiveCalorieBudget > weekTotals.calories ? "Under budget" : "Over budget"}
            </Text>
          </View>
        </View>
      </View>

      {/* Weekly macro averages */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Averages</Text>
        <Text style={{ fontSize: 11, color: textTertiaryColor, marginBottom: Spacing.sm }}>
          Based on {daysWithFood} day{daysWithFood !== 1 ? "s" : ""} with logged food
        </Text>
        <MacroBarRow label="PROTEIN" current={weekAvg.protein} goal={proteinTarget} color={MacroColors.protein} styles={styles} />
        <MacroBarRow label="CARBS" current={weekAvg.carbs} goal={carbsTarget} color={MacroColors.carbs} styles={styles} />
        <MacroBarRow label="FATS" current={weekAvg.fat} goal={fatTarget} color={MacroColors.fat} styles={styles} />
      </View>

      {/* Macro bars per day */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Macro Breakdown</Text>
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          {days.map((day) => (
            <Pressable
              key={day.key}
              onPress={() => onSelectDay(day.date)}
              style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}
            >
              <Text style={{ width: 30, fontSize: 11, fontWeight: "600", color: textSecondaryColor }}>{day.short}</Text>
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
                          style={{ width: `${(day.totals.protein / total) * 100}%`, backgroundColor: MacroColors.protein }}
                        />
                        <View
                          style={{ width: `${(day.totals.carbs / total) * 100}%`, backgroundColor: MacroColors.carbs }}
                        />
                        <View style={{ width: `${(day.totals.fat / total) * 100}%`, backgroundColor: MacroColors.fat }} />
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
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: Spacing.lg, justifyContent: "center", marginTop: Spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MacroColors.protein }} />
            <Text style={{ fontSize: 10, color: textSecondaryColor }}>Protein</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MacroColors.carbs }} />
            <Text style={{ fontSize: 10, color: textSecondaryColor }}>Carbs</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MacroColors.fat }} />
            <Text style={{ fontSize: 10, color: textSecondaryColor }}>Fat</Text>
          </View>
        </View>
      </View>
    </>
  );
}

export default TodayWeekView;
