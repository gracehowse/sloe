import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Accent, Colors, Spacing } from "@/constants/theme";
import { dateKeyFromDate } from "@/lib/nutritionJournal";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { PressableScale } from "@/components/ui/PressableScale";
import type { TodayWeekDay } from "./TodayWeekTypes";
import { TodayWeekScrubTooltip } from "./TodayWeekScrubTooltip";

const AnimatedView = Animated.createAnimatedComponent(View);

const PLOT_HEIGHT = 110;
const PLOT_TOP_LABEL_HEIGHT = 14;
const BAR_MIN_HEIGHT = 4;
const BAR_RADIUS = 6;

function targetRuleOffset(target: number, maxCal: number): number | null {
  if (!Number.isFinite(target) || target <= 0) return null;
  if (!Number.isFinite(maxCal) || maxCal <= 0) return null;
  if (target > maxCal) return null;
  return (target / maxCal) * PLOT_HEIGHT;
}

export function closestToTargetIndex(
  days: TodayWeekDay[],
  dayGoals: number[],
  fallbackTarget: number,
): number | null {
  let bestIdx: number | null = null;
  let bestDelta = Infinity;
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (!day || day.totals.calories <= 0) continue;
    const goal = dayGoals[i] ?? fallbackTarget;
    if (!Number.isFinite(goal) || goal <= 0) continue;
    const delta = Math.abs(day.totals.calories - goal);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function AnimatedBar({
  targetHeight,
  width,
  color,
  delayMs,
  reduceMotion,
}: {
  targetHeight: number;
  width: number;
  color: string;
  delayMs: number;
  reduceMotion: boolean;
}) {
  const h = useSharedValue(reduceMotion ? targetHeight : BAR_MIN_HEIGHT);
  useEffect(() => {
    if (reduceMotion) {
      h.value = targetHeight;
      return;
    }
    h.value = withDelay(
      delayMs,
      withTiming(targetHeight, { duration: 480, easing: Easing.out(Easing.cubic) }),
    );
  }, [targetHeight, delayMs, reduceMotion, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <AnimatedView
      style={[
        {
          width,
          backgroundColor: color,
          borderTopLeftRadius: BAR_RADIUS,
          borderTopRightRadius: BAR_RADIUS,
        },
        style,
      ]}
    />
  );
}

export type TodayWeekCalorieChartProps = {
  days: TodayWeekDay[];
  weekAvgCalories: number;
  daysWithFood: number;
  bestDayLabel: string | null;
  calorieTarget: number;
  dayGoals: number[];
  onSelectDay: (d: Date) => void;
  styles: Record<string, unknown>;
  textSecondaryColor: string;
  textTertiaryColor: string;
  borderColor: string;
  textColor: string;
  accentPrimary: string;
  accentPrimaryLight: string;
  preferActivityAdjustedCalories: boolean;
  activityBonusCaloriesOnly: boolean;
  maintenanceKcal: number | null;
};

export function TodayWeekCalorieChart({
  days,
  weekAvgCalories,
  daysWithFood,
  bestDayLabel,
  calorieTarget,
  dayGoals,
  onSelectDay,
  styles,
  textSecondaryColor,
  textTertiaryColor,
  borderColor,
  textColor,
  accentPrimary,
  accentPrimaryLight,
  preferActivityAdjustedCalories,
  activityBonusCaloriesOnly,
  maintenanceKcal,
}: TodayWeekCalorieChartProps) {
  const maxCal = Math.max(1, ...days.map((d, i) => Math.max(d.totals.calories, dayGoals[i] ?? calorieTarget)));
  const todayDk = dateKeyFromDate(new Date());
  const reduceMotion = useReduceMotion();
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const targetRuleY = useMemo(() => targetRuleOffset(calorieTarget, maxCal), [calorieTarget, maxCal]);
  const cardStyle = styles.card as { backgroundColor?: string } | undefined;

  return (
    <View style={styles.card as object}>
      <Text style={styles.cardTitle as object}>Weekly calories</Text>
      {daysWithFood > 0 && (
        <Text
          testID="today-week-chart-summary"
          style={{ fontSize: 11, color: textSecondaryColor, marginTop: 4 }}
        >
          {`7-day avg: ${Math.round(weekAvgCalories)} kcal`}
          {bestDayLabel ? ` · closest to target: ${bestDayLabel}` : ""}
        </Text>
      )}
      <View style={{ marginTop: Spacing.md, position: "relative" }}>
        <View
          testID="today-week-chart"
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
            height: PLOT_HEIGHT + PLOT_TOP_LABEL_HEIGHT + 18,
          }}
        >
          {days.map((day, i) => {
            const dayGoal = dayGoals[i] ?? calorieTarget;
            const barHeight =
              maxCal > 0
                ? Math.max(BAR_MIN_HEIGHT, (day.totals.calories / maxCal) * PLOT_HEIGHT)
                : BAR_MIN_HEIGHT;
            const over = day.totals.calories > dayGoal;
            const isCurrentDay = day.key === todayDk;
            const isScrubbed = scrubIndex === i;
            const barColor = over
              ? Accent.warning
              : day.totals.calories > 0
                ? accentPrimary
                : borderColor;
            return (
              <PressableScale
                key={day.key}
                haptic="selection"
                testID={`today-week-chart-bar-${i}`}
                onPress={() => setScrubIndex((prev) => (prev === i ? null : i))}
                onLongPress={() => onSelectDay(day.date)}
                accessibilityRole="button"
                accessibilityLabel={`${day.short} — ${Math.round(day.totals.calories)} kcal of ${Math.round(dayGoal)} kcal target`}
                style={{
                  alignItems: "center",
                  flex: 1,
                  gap: 4,
                  height: PLOT_HEIGHT + PLOT_TOP_LABEL_HEIGHT + 18,
                  justifyContent: "flex-end",
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    fontSize: 10,
                    color: textTertiaryColor,
                    fontVariant: ["tabular-nums"],
                    textAlign: "center",
                  }}
                >
                  {day.totals.calories > 0 ? Math.round(day.totals.calories) : ""}
                </Text>
                <AnimatedBar
                  targetHeight={barHeight}
                  width={isScrubbed ? 32 : 28}
                  color={isScrubbed ? accentPrimary : barColor}
                  delayMs={i * 40}
                  reduceMotion={reduceMotion}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: isCurrentDay || isScrubbed ? "800" : "600",
                    color: isCurrentDay || isScrubbed ? accentPrimary : textSecondaryColor,
                  }}
                >
                  {day.short}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        {targetRuleY != null && (
          <View
            testID="today-week-chart-target-rule"
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: 18,
              left: 0,
              right: 0,
              height: 0,
              borderTopWidth: 1,
              borderTopColor: accentPrimaryLight,
              borderStyle: "dashed",
              transform: [{ translateY: -targetRuleY }],
            }}
          />
        )}
        {scrubIndex != null && days[scrubIndex] && (
          <TodayWeekScrubTooltip
            day={days[scrubIndex]!}
            dayGoal={dayGoals[scrubIndex] ?? calorieTarget}
            cardColor={cardStyle?.backgroundColor ?? Colors.light.card}
            borderColor={borderColor}
            textColor={textColor}
            textSecondaryColor={textSecondaryColor}
            indexInWeek={scrubIndex}
            weekLength={days.length}
            onDismiss={() => setScrubIndex(null)}
          />
        )}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 4 }}>
        <Text testID="today-week-goal-footnote" style={{ fontSize: 10, color: textTertiaryColor }}>
          {preferActivityAdjustedCalories
            ? activityBonusCaloriesOnly
              ? maintenanceKcal != null && maintenanceKcal > 0
                ? `Goal: ${calorieTarget} kcal base + bonus burn (above ~${maintenanceKcal} kcal maintenance) from Health`
                : `Goal: ${calorieTarget} kcal base + bonus burn from Health`
              : `Goal: ${calorieTarget} kcal base + active energy from Health`
            : `Daily goal: ${calorieTarget} kcal`}
        </Text>
      </View>
    </View>
  );
}
