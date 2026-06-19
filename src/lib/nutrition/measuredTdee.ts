/**
 * Measured TDEE from Apple Health / HealthKit daily burn (resting + active).
 *
 * ENG-1111 — wear-completeness gating + median lazy-day total burn for the
 * weekly check-in when adaptive TDEE collapses toward under-logged intake.
 * See `docs/decisions/2026-06-14-measured-tdee-check-in.md`.
 */

export const MEASURED_TDEE_CHECK_IN_FLAG = "measured_tdee_check_in";

/** Same trailing window as `computeAdaptiveTDEE` (default 28 days). */
export const MEASURED_TDEE_WINDOW_DAYS = 28;

/** Minimum complete-wear days before emitting an estimate. */
export const MIN_COMPLETE_WEAR_DAYS = 14;

/** Resting must be ≥ this fraction of the window median resting. */
export const RESTING_VS_MEDIAN_FLOOR = 0.6;

/** Resting must be ≥ this fraction of BMR when BMR is known. */
export const RESTING_VS_BMR_FLOOR = 0.7;

/**
 * Complete-wear days at/above this count promote the estimate to `high`
 * confidence. Below it (but still ≥ MIN_COMPLETE_WEAR_DAYS) the estimate is
 * `medium`. Mirrors `HIGH_CONFIDENCE_LOGGING_DAYS` in `adaptiveTdee.ts` so the
 * measured branch can't claim higher confidence than adaptive would on the
 * same volume of data. Named (not inline) so the threshold is auditable.
 */
export const HIGH_CONFIDENCE_WEAR_DAYS = 21;

export type MeasuredTdeeConfidence = "medium" | "high";

export type MeasuredTdeeInput = {
  restingByDay: Record<string, number>;
  activeByDay: Record<string, number>;
  bmrKcal?: number | null;
  windowDays?: number;
};

export type MeasuredTdeeResult = {
  tdee: number;
  confidence: MeasuredTdeeConfidence;
  wearDays: number;
};

function medianRounded(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : Math.round(sorted[mid]);
}

function isPositiveFinite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function windowDateKeys(
  restingByDay: Record<string, number>,
  activeByDay: Record<string, number>,
  windowDays: number,
): string[] {
  const keys = new Set<string>([
    ...Object.keys(restingByDay),
    ...Object.keys(activeByDay),
  ]);
  return [...keys].sort().slice(-windowDays);
}

function isCompleteWearDay(
  resting: number,
  medianResting: number,
  bmrKcal: number | null,
): boolean {
  if (!isPositiveFinite(resting)) return false;
  if (resting < medianResting * RESTING_VS_MEDIAN_FLOOR) return false;
  if (bmrKcal != null && bmrKcal > 0 && resting < bmrKcal * RESTING_VS_BMR_FLOOR) {
    return false;
  }
  return true;
}

/**
 * Median daily total burn (resting + active) over complete-wear days.
 * Returns null when the wear-completeness gate fails.
 */
export function computeMeasuredTDEE(
  input: MeasuredTdeeInput,
): MeasuredTdeeResult | null {
  const windowDays = input.windowDays ?? MEASURED_TDEE_WINDOW_DAYS;
  const keys = windowDateKeys(input.restingByDay, input.activeByDay, windowDays);
  if (keys.length === 0) return null;

  const restingSamples: number[] = [];
  for (const k of keys) {
    const r = input.restingByDay[k];
    if (isPositiveFinite(r)) restingSamples.push(r);
  }
  if (restingSamples.length < MIN_COMPLETE_WEAR_DAYS) return null;

  const medianResting = medianRounded(restingSamples);
  const bmrKcal =
    input.bmrKcal != null && Number.isFinite(input.bmrKcal) && input.bmrKcal > 0
      ? input.bmrKcal
      : null;

  const dailyTotals: number[] = [];
  for (const k of keys) {
    const resting = input.restingByDay[k] ?? 0;
    const active = input.activeByDay[k] ?? 0;
    if (!isCompleteWearDay(resting, medianResting, bmrKcal)) continue;
    const total = resting + active;
    if (isPositiveFinite(total)) dailyTotals.push(total);
  }

  if (dailyTotals.length < MIN_COMPLETE_WEAR_DAYS) return null;

  const confidence: MeasuredTdeeConfidence =
    dailyTotals.length >= HIGH_CONFIDENCE_WEAR_DAYS ? "high" : "medium";

  return {
    tdee: medianRounded(dailyTotals),
    confidence,
    wearDays: dailyTotals.length,
  };
}
