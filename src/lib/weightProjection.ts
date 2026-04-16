import { dateKeyFromDate } from "./nutrition/trackerStats";

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

/**
 * Most recent logged body weight: latest calendar day in `weight_kg_by_day`, otherwise profile `weight_kg`.
 * (Profile alone can lag behind Health / manual map entries.)
 */
export function resolveLatestWeightKg(
  weightKgByDay: Record<string, number>,
  weightKg: number | null,
): number | null {
  const entries = Object.entries(weightKgByDay).filter(
    ([, v]) => typeof v === "number" && Number.isFinite(v),
  ) as [string, number][];
  if (entries.length === 0) {
    return weightKg != null && Number.isFinite(weightKg) ? weightKg : null;
  }
  entries.sort(([a], [b]) => b.localeCompare(a));
  return entries[0][1];
}

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
 *
 * @param currentWeightKg  - User's current weight
 * @param todayCalories    - Total calories consumed today
 * @param targetCalories   - Daily calorie target (approximation of adjusted TDEE)
 * @param maintenanceTdee  - Estimated maintenance TDEE (if available). Falls back to target + 500 for "lose" goal.
 * @param goal             - User's goal: "lose", "gain", or "maintain"
 * @param weeksOut         - How many weeks to project (default 5)
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
    projectedWeightKg: Math.max(projectedWeightKg, 30), // floor at 30kg for sanity
    projectionWeeks: weeksOut,
    dailySurplusDeficit: Math.round(dailySurplusDeficit),
    direction,
  };
}

/** Default window for journey peak/trough — ignores very old Health rows that blow up “lost”. */
export const WEIGHT_JOURNEY_LOOKBACK_DAYS = 540;

function parseDayKeyMs(key: string): number | null {
  const k = key.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return null;
  const t = new Date(`${k}T12:00:00`).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Weights whose calendar day falls within the last `lookbackDays` (by wall-clock `Date.now()`). */
export function weightsInLookbackKg(
  weightKgByDay: Record<string, number>,
  lookbackDays: number,
): number[] {
  const cutoff = Date.now() - lookbackDays * 86400000;
  const out: number[] = [];
  for (const [k, v] of Object.entries(weightKgByDay)) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const t = parseDayKeyMs(k);
    if (t == null || t < cutoff) continue;
    out.push(v);
  }
  return out;
}

/** Upper anchor with Tukey fence — drops extreme high spikes (bad units, duplicate imports). */
export function tukeyRobustMaxKg(values: number[]): number | null {
  const s = [...values].filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (s.length === 0) return null;
  if (s.length < 4) return s[s.length - 1]!;
  const n = s.length;
  const q1 = s[Math.floor(0.25 * (n - 1))]!;
  const q3 = s[Math.floor(0.75 * (n - 1))]!;
  const iqr = q3 - q1;
  if (iqr < 1e-6) return s[s.length - 1]!;
  const upper = q3 + 3 * iqr;
  const kept = s.filter((x) => x <= upper);
  return kept.length ? kept[kept.length - 1]! : s[s.length - 1]!;
}

/** Lower anchor with Tukey fence — drops extreme low spikes when gaining. */
export function tukeyRobustMinKg(values: number[]): number | null {
  const s = [...values].filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (s.length === 0) return null;
  if (s.length < 4) return s[0]!;
  const n = s.length;
  const q1 = s[Math.floor(0.25 * (n - 1))]!;
  const q3 = s[Math.floor(0.75 * (n - 1))]!;
  const iqr = q3 - q1;
  if (iqr < 1e-6) return s[0]!;
  const lower = q1 - 3 * iqr;
  const kept = s.filter((x) => x >= lower);
  return kept.length ? kept[0]! : s[0]!;
}

/**
 * Baseline weight for journey/progress bars: peak when losing, trough when gaining.
 * Uses **recent** history (lookback) plus Tukey IQR fences so one bogus max/min does not
 * inflate “kg lost” (e.g. summing-like effect from a 150 kg typo vs a true 75 kg line).
 */
export function weightJourneyBaselineKg(opts: {
  goalKg: number | null | undefined;
  latestKg: number | null | undefined;
  weightKgByDay: Record<string, number>;
  /** Only consider weights from this many recent days; falls back to all-time if none in window. */
  lookbackDays?: number;
}): number | null {
  const { goalKg, latestKg, weightKgByDay } = opts;
  const lookbackDays = opts.lookbackDays ?? WEIGHT_JOURNEY_LOOKBACK_DAYS;
  if (goalKg == null || latestKg == null || !Number.isFinite(goalKg) || !Number.isFinite(latestKg)) return null;

  const inWindow = weightsInLookbackKg(weightKgByDay, lookbackDays);
  const allVals = Object.values(weightKgByDay).filter((v) => typeof v === "number" && Number.isFinite(v)) as number[];
  const pool = inWindow.length > 0 ? inWindow : allVals;
  if (pool.length === 0) return latestKg;

  if (goalKg < latestKg - 0.01) {
    const robust = tukeyRobustMaxKg([...pool, latestKg]);
    return robust != null ? Math.max(robust, latestKg) : latestKg;
  }
  if (goalKg > latestKg + 0.01) {
    const robust = tukeyRobustMinKg([...pool, latestKg]);
    return robust != null ? Math.min(robust, latestKg) : latestKg;
  }
  return latestKg;
}

/** Progress from baseline toward goal (0–1 `pct`). */
export function weightJourneyProgress(opts: {
  goalKg: number;
  latestKg: number;
  weightKgByDay: Record<string, number>;
}): { baselineKg: number; lostKg: number; totalKg: number; pct: number; remainingKg: number } | null {
  const baseline = weightJourneyBaselineKg({
    goalKg: opts.goalKg,
    latestKg: opts.latestKg,
    weightKgByDay: opts.weightKgByDay,
  });
  if (baseline == null) return null;
  const total = Math.abs(baseline - opts.goalKg);
  if (total < 0.1) return null;
  const moved =
    opts.goalKg < baseline
      ? Math.max(0, baseline - opts.latestKg)
      : Math.max(0, opts.latestKg - baseline);
  const pct = Math.min(1, moved / total);
  const remaining = Math.abs(opts.latestKg - opts.goalKg);
  return { baselineKg: baseline, lostKg: moved, totalKg: total, pct, remainingKg: remaining };
}

export type WeightGoalTimeline = {
  /** Estimated days to reach goal weight (null if not achievable or no goal) */
  daysToGoal: number | null;
  /** Weekly rate of change in kg based on recent trend */
  weeklyRateKg: number;
  /** Current weight */
  currentKg: number;
  /** Goal weight */
  goalKg: number;
  /** Remaining kg to goal */
  remainingKg: number;
  /** Direction: losing, gaining, or stalled */
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
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 28);
    const cutoffStr = dateKeyFromDate(cutoff);
    const recentKeys = keys.filter((k) => k >= cutoffStr);
    const useKeys = recentKeys.length >= 2 ? recentKeys : keys;
    const firstKey = useKeys[0];
    const lastKey = useKeys[useKeys.length - 1];
    const first = weightKgByDay[firstKey];
    const last = weightKgByDay[lastKey];
    const daySpan = Math.max(
      1,
      Math.round(
        (new Date(`${lastKey}T12:00:00`).getTime() - new Date(`${firstKey}T12:00:00`).getTime()) / 86400000,
      ),
    );
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
