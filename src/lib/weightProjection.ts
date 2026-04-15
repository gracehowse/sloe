/**
 * Weight projection utility.
 *
 * Uses the 3500-calorie rule (rough estimate):
 *   - 3500 kcal surplus ≈ +0.45 kg (1 lb)
 *   - 3500 kcal deficit ≈ -0.45 kg (1 lb)
 *
 * Also provides a timeline-based projection using recent weight trend data.
 */

const KCAL_PER_KG = 7700; // ~3500 kcal/lb * 2.2 lb/kg

export type DailyProjection = {
  /** Projected weight in kg if every day matched today's intake */
  projectedWeightKg: number;
  /** Number of weeks for the projection */
  projectionWeeks: number;
  /** Daily calorie surplus/deficit vs TDEE */
  dailySurplusDeficit: number;
  /** Whether user is in deficit or surplus */
  direction: "deficit" | "surplus" | "maintenance";
};

/**
 * Project weight change based on today's calorie intake vs TDEE/target.
 */
export function projectWeight(opts: {
  currentWeightKg: number;
  todayCalories: number;
  targetCalories: number;
  goal?: string | null;
  weeksOut?: number;
}): DailyProjection {
  const { currentWeightKg, todayCalories, targetCalories, goal, weeksOut = 5 } = opts;

  let estimatedTdee: number;
  if (goal === "lose") {
    estimatedTdee = targetCalories + 500;
  } else if (goal === "gain") {
    estimatedTdee = targetCalories - 300;
  } else {
    estimatedTdee = targetCalories;
  }

  const dailySurplusDeficit = todayCalories - estimatedTdee;
  const totalDays = weeksOut * 7;
  const totalKgChange = (dailySurplusDeficit * totalDays) / KCAL_PER_KG;
  const projectedWeightKg = Math.round((currentWeightKg + totalKgChange) * 10) / 10;

  const direction: DailyProjection["direction"] =
    Math.abs(dailySurplusDeficit) < 50
      ? "maintenance"
      : dailySurplusDeficit < 0
        ? "deficit"
        : "surplus";

  return {
    projectedWeightKg: Math.max(projectedWeightKg, 30),
    projectionWeeks: weeksOut,
    dailySurplusDeficit: Math.round(dailySurplusDeficit),
    direction,
  };
}

export type WeightGoalTimeline = {
  daysToGoal: number | null;
  weeklyRateKg: number;
  currentKg: number;
  goalKg: number;
  remainingKg: number;
  trendDirection: "losing" | "gaining" | "stalled";
};

/**
 * Calculate timeline to goal weight based on recent weight trend.
 */
export function calcGoalTimeline(opts: {
  currentWeightKg: number;
  goalWeightKg: number;
  weightKgByDay: Record<string, number>;
}): WeightGoalTimeline {
  const { currentWeightKg, goalWeightKg, weightKgByDay } = opts;

  const remainingKg = Math.round((currentWeightKg - goalWeightKg) * 10) / 10;

  const keys = Object.keys(weightKgByDay).sort();
  let weeklyRateKg = 0;

  if (keys.length >= 2) {
    const recent = keys.slice(-28);
    const first = weightKgByDay[recent[0]];
    const last = weightKgByDay[recent[recent.length - 1]];
    const daySpan = Math.max(1, Math.round(
      (new Date(recent[recent.length - 1]).getTime() - new Date(recent[0]).getTime()) / 86400000
    ));
    weeklyRateKg = Math.round(((last - first) / daySpan) * 7 * 10) / 10;
  }

  const trendDirection: WeightGoalTimeline["trendDirection"] =
    Math.abs(weeklyRateKg) < 0.1
      ? "stalled"
      : weeklyRateKg < 0
        ? "losing"
        : "gaining";

  let daysToGoal: number | null = null;
  if (Math.abs(weeklyRateKg) >= 0.1) {
    const dailyRateKg = weeklyRateKg / 7;
    const needsToLose = remainingKg > 0;
    const isMovingRight = needsToLose ? dailyRateKg < 0 : dailyRateKg > 0;

    if (isMovingRight) {
      daysToGoal = Math.round(Math.abs(remainingKg / dailyRateKg));
      if (daysToGoal > 365) daysToGoal = null;
    }
  }

  return {
    daysToGoal,
    weeklyRateKg,
    currentKg: currentWeightKg,
    goalKg: goalWeightKg,
    remainingKg: Math.abs(remainingKg),
    trendDirection,
  };
}
