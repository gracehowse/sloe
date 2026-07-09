import React, { memo, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Accent, Colors, MacroColors, MacroColorsDark, Radius, Spacing } from "@/constants/theme";
import { useAccent, useResolvedScheme } from "@/context/theme";
import { dateKeyFromDate } from "@/lib/nutritionJournal";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { TodayWeekSummaryStats } from "./TodayWeekSummaryStats";

const AnimatedView = Animated.createAnimatedComponent(View);

/**
 * TodayWeekView — the `viewMode === "week"` bar chart + summary + macro
 * breakdown set.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). Host derives the full `weekData` shape + effective
 * calorie budget; component only renders + fires `onSelectDay`.
 *
 * 2026-05-01 (ui-critic finding #5, P1) — chart upgraded from
 * unstyled bars to MacroFactor-tier:
 *   - bars carry top-only rounded corners (radius 6) so they read as
 *     bars-from-the-baseline rather than floating pills.
 *   - a horizontal dashed target rule sits at the calorie-target
 *     y-position so over/under is readable at a glance.
 *   - bars animate in via Reanimated's `withTiming` on mode-change
 *     (skipped under "reduce motion" so accessibility stays clean).
 *   - tapping a bar reveals a floating tooltip card with day name,
 *     kcal logged, kcal target, delta. Tap elsewhere or the same
 *     bar again dismisses.
 *   - above the chart: "7-day avg: X kcal · closest to target: [day]"
 *     where "closest to target" matches the project's "Best Day"
 *     direction (per project_progress_direction memory, 2026-04-30).
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
  /** F-146: week burn total, so Net deficit/surplus compares burn-vs-consumed
   *  (not goal-vs-consumed, which mislabels overshoot-under-burn as surplus).
   *  Optional for legacy callers; falls back to `maintenanceKcal × 7`. */
  weekBurnTotal?: number;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  preferActivityAdjustedCalories: boolean;
  activityBonusCaloriesOnly: boolean;
  maintenanceKcal: number | null;
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

/** Bar plot constants — pulled out so the target-rule maths stays
 *  consistent with the bar height clamp below. */
const PLOT_HEIGHT = 110;
const PLOT_TOP_LABEL_HEIGHT = 14;
const BAR_MIN_HEIGHT = 4;
const BAR_RADIUS = 6;

/** Compute the y-offset (in px from the bottom of the plot area) where
 *  the target-rule should render. Returns `null` when the target falls
 *  outside the visible plot (e.g. degenerate case `maxCal === 0`). */
function targetRuleOffset(target: number, maxCal: number): number | null {
  if (!Number.isFinite(target) || target <= 0) return null;
  if (!Number.isFinite(maxCal) || maxCal <= 0) return null;
  if (target > maxCal) return null;
  return (target / maxCal) * PLOT_HEIGHT;
}

/** Pick the day whose calories are closest to the day's target. Ties
 *  break by lower index (earlier in the week). Days with 0 calories
 *  are excluded — "best day" should mean a day they actually logged. */
function closestToTargetIndex(
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

/** Animated bar that scales its height in on mount / mode-change.
 *  Skips the animation when the user has Reduce Motion on so screen
 *  readers / sensitive users don't get the entrance surge. */
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

function TodayWeekViewImpl(props: TodayWeekViewProps) {
  const {
    days,
    weekTotals,
    weekAvg,
    daysWithFood,
    weekEffectiveCalorieBudget,
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

  const maxCal = Math.max(1, ...days.map((d, i) => Math.max(d.totals.calories, dayGoals[i] ?? calorieTarget)));
  const todayDk = dateKeyFromDate(new Date());
  const reduceMotion = useReduceMotion();
  // Secondary accent (Frost flag → damson, else clay) for the calorie-chart
  // accent series: logged-under bars, the scrubbed/current-day highlight, the
  // target rule, and the "Daily avg" figure. The over-budget amber + the
  // deficit/surplus status hues keep their own `Accent.warning`/`.success`.
  const accent = useAccent(), mc = useResolvedScheme() === "dark" ? MacroColorsDark : MacroColors; // ENG-1223

  /** Tap-to-scrub: the bar index whose tooltip is currently visible.
   *  `null` means no tooltip is open. */
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  /** Closest-to-target day for the above-chart summary line. */
  const bestIdx = useMemo(
    () => closestToTargetIndex(days, dayGoals, calorieTarget),
    [days, dayGoals, calorieTarget],
  );
  const bestDayLabel =
    bestIdx != null && days[bestIdx] ? days[bestIdx].short : null;

  const targetRuleY = useMemo(() => targetRuleOffset(calorieTarget, maxCal), [calorieTarget, maxCal]);

  return (
    <>
      {/* Weekly bar chart — MacroFactor-tier: target rule + animated
          entrance + tap-to-scrub tooltip. */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly calories</Text>

        {/* Above-chart summary line. Only renders when at least one
            day has logged food (otherwise both numbers read as 0 / —
            and the line is noise). */}
        {daysWithFood > 0 && (
          <Text
            testID="today-week-chart-summary"
            style={{ fontSize: 11, color: textSecondaryColor, marginTop: 4 }}
          >
            {`7-day avg: ${Math.round(weekAvg.calories)} kcal`}
            {bestDayLabel ? ` · closest to target: ${bestDayLabel}` : ""}
          </Text>
        )}

        {/* Plot area — relative-positioned so the target rule absolute-
            overlays the bars on the same y-axis. The bars row is
            `flex-end`-aligned so each bar grows up from the baseline. */}
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
              const barHeight = maxCal > 0 ? Math.max(BAR_MIN_HEIGHT, (day.totals.calories / maxCal) * PLOT_HEIGHT) : BAR_MIN_HEIGHT;
              const over = day.totals.calories > dayGoal;
              const isCurrentDay = day.key === todayDk;
              const isScrubbed = scrubIndex === i;
              const barColor = over
                ? Accent.warning + "CC"
                : day.totals.calories > 0
                  ? accent.primary
                  : borderColor;
              return (
                <Pressable
                  key={day.key}
                  testID={`today-week-chart-bar-${i}`}
                  onPress={() => {
                    // Tap once → open tooltip. Tap the same bar again
                    // → close. Long-press / second tap on a different
                    // bar swaps focus.
                    setScrubIndex((prev) => (prev === i ? null : i));
                  }}
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
                    style={{ fontSize: 10, color: textTertiaryColor, fontVariant: ["tabular-nums"], textAlign: "center" }}
                  >
                    {day.totals.calories > 0 ? Math.round(day.totals.calories) : ""}
                  </Text>
                  <AnimatedBar
                    targetHeight={barHeight}
                    width={isScrubbed ? 32 : 28}
                    color={isScrubbed ? accent.primary : barColor}
                    delayMs={i * 40}
                    reduceMotion={reduceMotion}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: isCurrentDay || isScrubbed ? "800" : "600",
                      color: isCurrentDay || isScrubbed ? accent.primary : textSecondaryColor,
                    }}
                  >
                    {day.short}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Target rule — dashed horizontal line at the day-target
              y-position. Sits behind the bars (zIndex: 0) so the bars
              still read as solid; the dashed segments still peek through
              between bars. The rule is positioned from the bar baseline
              upward by `targetRuleY` px (calculated above). */}
          {targetRuleY != null && (
            <View
              testID="today-week-chart-target-rule"
              pointerEvents="none"
              style={{
                position: "absolute",
                // 18 = label gap below the plot area; matches the
                // `<Text style={{ fontSize: 11 }}>` height in the bar
                // column.
                bottom: 18,
                left: 0,
                right: 0,
                height: 0,
                borderTopWidth: 1,
                borderTopColor: accent.primary + "66",
                borderStyle: "dashed",
                transform: [{ translateY: -targetRuleY }],
              }}
            />
          )}

          {/* Floating scrubber tooltip — appears above the tapped bar
              with day name, kcal logged, kcal target, delta. */}
          {scrubIndex != null && days[scrubIndex] && (
            <ScrubTooltip
              day={days[scrubIndex]!}
              dayGoal={dayGoals[scrubIndex] ?? calorieTarget}
              cardColor={styles.card?.backgroundColor ?? Colors.light.card}
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

      {/* Weekly summary */}
      <TodayWeekSummaryStats
        totalCalories={weekTotals.calories}
        avgCalories={weekAvg.calories}
        daysWithFood={daysWithFood}
        weekBurnTotal={weekBurnTotal}
        maintenanceKcal={maintenanceKcal}
        accentPrimarySolid={accent.primarySolid}
        textColor={textColor}
        textSecondaryColor={textSecondaryColor}
        cardStyle={styles.card}
        cardTitleStyle={styles.cardTitle}
      />

      {/* Weekly macro averages */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily averages</Text>
        <Text style={{ fontSize: 11, color: textTertiaryColor, marginBottom: Spacing.sm }}>
          Based on {daysWithFood} day{daysWithFood !== 1 ? "s" : ""} with logged food
        </Text>
        <MacroBarRow label="PROTEIN" current={weekAvg.protein} goal={proteinTarget} color={mc.protein} styles={styles} />
        <MacroBarRow label="CARBS" current={weekAvg.carbs} goal={carbsTarget} color={mc.carbs} styles={styles} />
        <MacroBarRow label="FATS" current={weekAvg.fat} goal={fatTarget} color={mc.fat} styles={styles} />
      </View>

      {/* Macro bars per day */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Macro breakdown</Text>
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
                          style={{ width: `${(day.totals.protein / total) * 100}%`, backgroundColor: mc.protein }}
                        />
                        <View
                          style={{ width: `${(day.totals.carbs / total) * 100}%`, backgroundColor: mc.carbs }}
                        />
                        <View style={{ width: `${(day.totals.fat / total) * 100}%`, backgroundColor: mc.fat }} />
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
            <View style={{ width: 8, height: 8, borderRadius: Radius.sm, backgroundColor: mc.protein }} />
            <Text style={{ fontSize: 10, color: textSecondaryColor }}>Protein</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: Radius.sm, backgroundColor: mc.carbs }} />
            <Text style={{ fontSize: 10, color: textSecondaryColor }}>Carbs</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: Radius.sm, backgroundColor: mc.fat }} />
            <Text style={{ fontSize: 10, color: textSecondaryColor }}>Fat</Text>
          </View>
        </View>
      </View>
    </>
  );
}

/**
 * ScrubTooltip — floating card that surfaces day name + kcal logged +
 * kcal target + delta when the user taps a bar in the week chart.
 *
 * Pinned to the chart card horizontally; the user dismisses by
 * tapping the active bar again or tapping the card-level dismiss
 * `Pressable` underneath. We do NOT auto-dismiss on a timer — the
 * user controls how long they want to inspect the day.
 */
function ScrubTooltip({
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
    delta === 0
      ? "On target"
      : delta > 0
        ? `${delta} kcal over`
        : `${Math.abs(delta)} kcal under`;
  const deltaColor =
    delta === 0
      ? Accent.success
      : delta > 0
        ? Accent.warning
        : Accent.success;

  // Anchor the tooltip horizontally to the tapped bar's column. Each
  // column is 1/weekLength of the chart width; the tooltip card is
  // ~140 px so we offset by half a column to centre it. Edge-clamp
  // via `left`/`right` so the card never spills off the chart.
  const colCenterPct = ((indexInWeek + 0.5) / weekLength) * 100;
  const isLeftHalf = colCenterPct < 50;

  return (
    <Pressable
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
        // Tooltip floats above the chart top so it doesn't occlude the
        // bar the user tapped. Card elevation simulated via border +
        // bg colour pulled from the parent card.
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
          gap: 2,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "700", color: textColor }}>
          {day.short}
        </Text>
        <Text style={{ fontSize: 11, color: textSecondaryColor, fontVariant: ["tabular-nums"] }}>
          {Math.round(day.totals.calories)} / {Math.round(dayGoal)} kcal
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: deltaColor }}>
          {deltaLabel}
        </Text>
      </View>
    </Pressable>
  );
}

export const TodayWeekView = memo(TodayWeekViewImpl);

export default TodayWeekView;
