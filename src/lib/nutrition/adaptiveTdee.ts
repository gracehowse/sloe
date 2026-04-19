/**
 * Adaptive TDEE estimation using energy balance + exponential moving average.
 *
 * Infers real Total Daily Energy Expenditure from logged intake and weight
 * trend data, replacing static Mifflin-St Jeor estimates once enough data
 * accumulates (7+ days of logging, 3+ weigh-ins).
 *
 * Algorithm:
 *   1. Smooth raw weight series with EMA to remove water/glycogen noise.
 *   2. Compute rate of weight change (kg/day) from smoothed trend.
 *   3. Convert to energy: 1 kg body mass ~= 7700 kcal.
 *   4. Adaptive TDEE = avg_daily_intake + (weight_change_rate_kg * 7700)
 *
 * Reference: Hall & Chow, "Quantification of the effect of energy imbalance
 * on bodyweight" (Am J Clin Nutr, 2011).
 */

const KCAL_PER_KG = 7700;
export const MIN_LOGGING_DAYS = 7;
export const MIN_WEIGH_INS = 3;
const DEFAULT_WINDOW_DAYS = 28;
const EMA_ALPHA = 0.1; // Lower = more smoothing

export type AdaptiveTdeeInput = {
  /** Map of YYYY-MM-DD → total calories consumed that day. */
  intakeByDay: Record<string, number>;
  /** Map of YYYY-MM-DD → weight in kg that day. */
  weightByDay: Record<string, number>;
  /** How many trailing days to analyze (default 28). */
  windowDays?: number;
};

export type AdaptiveTdeeResult = {
  tdee: number;
  confidence: "low" | "medium" | "high";
  loggingDays: number;
  weighInCount: number;
  avgDailyIntake: number;
  smoothedWeightChangeKgPerDay: number;
  windowDays: number;
};

function sortedEntries(map: Record<string, number>): [string, number][] {
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

function dateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function cutoffDate(windowDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - windowDays);
  return dateStr(d);
}

/**
 * Exponential moving average of a sparse weight series.
 * Fills gaps by carrying forward the last known value.
 */
function emaSmooth(
  entries: [string, number][],
  alpha: number,
): [string, number][] {
  if (entries.length === 0) return [];
  const result: [string, number][] = [];
  let ema = entries[0][1];
  result.push([entries[0][0], ema]);
  for (let i = 1; i < entries.length; i++) {
    ema = alpha * entries[i][1] + (1 - alpha) * ema;
    result.push([entries[i][0], ema]);
  }
  return result;
}

export function computeAdaptiveTDEE(
  input: AdaptiveTdeeInput,
): AdaptiveTdeeResult | null {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const cutoff = cutoffDate(windowDays);

  const intakeEntries = sortedEntries(input.intakeByDay).filter(
    ([k, v]) => k >= cutoff && v > 0,
  );
  const weightEntries = sortedEntries(input.weightByDay).filter(
    ([k]) => k >= cutoff,
  );

  const loggingDays = intakeEntries.length;
  const weighInCount = weightEntries.length;

  if (loggingDays < MIN_LOGGING_DAYS || weighInCount < MIN_WEIGH_INS) {
    return null;
  }

  const avgDailyIntake = Math.round(
    intakeEntries.reduce((sum, [, v]) => sum + v, 0) / loggingDays,
  );

  const smoothed = emaSmooth(weightEntries, EMA_ALPHA);
  const firstSmoothed = smoothed[0][1];
  const lastSmoothed = smoothed[smoothed.length - 1][1];

  const firstDate = new Date(smoothed[0][0]);
  const lastDate = new Date(smoothed[smoothed.length - 1][0]);
  const daySpan = Math.max(
    1,
    (lastDate.getTime() - firstDate.getTime()) / (24 * 3600_000),
  );

  const weightChangeKgPerDay = (lastSmoothed - firstSmoothed) / daySpan;

  const energyFromWeightChange = Math.round(
    weightChangeKgPerDay * KCAL_PER_KG,
  );

  const tdee = Math.max(800, avgDailyIntake - energyFromWeightChange);

  let confidence: "low" | "medium" | "high";
  if (loggingDays >= 21 && weighInCount >= 7) {
    confidence = "high";
  } else if (loggingDays >= 14 && weighInCount >= 5) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    tdee: Math.round(tdee),
    confidence,
    loggingDays,
    weighInCount,
    avgDailyIntake,
    smoothedWeightChangeKgPerDay: Math.round(weightChangeKgPerDay * 10000) / 10000,
    windowDays,
  };
}
