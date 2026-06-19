/**
 * Measured TDEE from Apple Health / HealthKit daily burn (resting + active).
 *
 * ENG-1111 — wear-completeness gating + median lazy-day total burn for the
 * weekly check-in when adaptive TDEE collapses toward under-logged intake.
 * See `docs/decisions/2026-06-14-measured-tdee-check-in.md`.
 *
 * Calorie-safety guards (ENG-1111 nutrition-engine review) close two
 * under-eating failure modes before the flag ramps:
 *   1. Wear-completeness floor tightened to ≥80% / 0.8× window-median resting
 *      (was ≥60% / 0.6×) — `basal_burn_by_day` is the plain SUM of on-wrist
 *      basal samples with NO full-day extrapolation, so a partially-worn day
 *      stores a truncated (low) basal that biases the median DOWN.
 *   2. An estimator-level plausibility floor REJECTS a measured median below
 *      the resting-energy floor or below `0.85 × sedentary TDEE` (mirrors
 *      adaptiveTdee.ts R3), so the estimator never surfaces an implausibly-low
 *      measured maintenance to any consumer.
 */

export const MEASURED_TDEE_CHECK_IN_FLAG = "measured_tdee_check_in";

/** Same trailing window as `computeAdaptiveTDEE` (default 28 days). */
export const MEASURED_TDEE_WINDOW_DAYS = 28;

/** Minimum complete-wear days before emitting an estimate. */
export const MIN_COMPLETE_WEAR_DAYS = 14;

/**
 * Resting must be ≥ this fraction of the window median resting for a day to
 * count as complete wear. 0.8 ≈ the standard ≥80% wear-validity threshold
 * (ENG-1111 calorie-safety review). `basal_burn_by_day` is the plain SUM of
 * on-wrist BasalEnergyBurned samples with NO full-day extrapolation, so a
 * partially-worn day stores a truncated (low) basal. The old 0.6 floor let a
 * ~60%-worn day pass and drag the median measured TDEE DOWN — i.e. toward
 * recommending too little food. Raised to 0.8 to exclude those truncated days.
 */
export const RESTING_VS_MEDIAN_FLOOR = 0.8;

/**
 * Resting must be ≥ this fraction of BMR when BMR is known. KEPT at 0.7 (a
 * sensible absolute physiological backstop). Raising it risks excluding
 * genuine low-RMR days, so the wear-completeness tightening lives in the
 * relative median floor above, not here (ENG-1111).
 */
export const RESTING_VS_BMR_FLOOR = 0.7;

/**
 * Estimator-level plausibility floor (ENG-1111 calorie-safety review).
 *
 * Even after the wear-completeness gate, a window of consistently-truncated
 * basal days could still produce a median measured TDEE below the user's own
 * resting energy / sedentary maintenance — an internally contradictory,
 * under-eating-risk number. Mirrors the lower arm of `adaptiveTdee.ts`'s R3
 * plausibility band: a measured median below `PLAUSIBILITY_LOWER_FRACTION ×
 * sedentary TDEE` (or below the resting-energy floor) is implausibly low and
 * is REJECTED (returns null) rather than surfaced. This is the estimator-level
 * home for the floor, so every consumer of `computeMeasuredTDEE` is protected.
 */
export const PLAUSIBILITY_LOWER_FRACTION = 0.85;

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
  /**
   * The user's *sedentary* Mifflin TDEE (BMR × 1.2), kcal/day. When supplied,
   * the estimator-level plausibility floor (ENG-1111) rejects a measured median
   * below `PLAUSIBILITY_LOWER_FRACTION × this value`. Must be the SEDENTARY
   * number — mirrors `adaptiveTdee.ts`'s R3 lower bound, where a higher activity
   * multiplier would let an under-eating estimate slip through.
   */
  sedentaryTdeeKcal?: number | null;
  /**
   * Apple Watch / HealthKit resting (basal) energy floor, kcal/day. When
   * supplied, a measured median below this hard floor is rejected (ENG-1111).
   * Resting energy is formula-grade (Apple derives it from a Mifflin/Harris-
   * Benedict formula), so it is a legitimate absolute lower bound.
   */
  restingEnergyFloorKcal?: number | null;
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

  const measuredMedian = medianRounded(dailyTotals);

  // ENG-1111 calorie-safety floor: REJECT an implausibly-low measured median.
  // Even past the wear-completeness gate, a window of consistently-truncated
  // basal days can yield a median below the user's own resting energy /
  // sedentary maintenance — an under-eating-risk number we must never surface.
  // Mirrors the lower arm of adaptiveTdee.ts's R3 plausibility band. Estimator-
  // level home for the floor → protects every consumer of computeMeasuredTDEE.
  const restingFloor = input.restingEnergyFloorKcal;
  if (
    restingFloor != null &&
    Number.isFinite(restingFloor) &&
    restingFloor > 0 &&
    measuredMedian < restingFloor
  ) {
    return null;
  }

  const sedentary = input.sedentaryTdeeKcal;
  if (
    sedentary != null &&
    Number.isFinite(sedentary) &&
    sedentary > 0 &&
    measuredMedian < PLAUSIBILITY_LOWER_FRACTION * sedentary
  ) {
    return null;
  }

  const confidence: MeasuredTdeeConfidence =
    dailyTotals.length >= HIGH_CONFIDENCE_WEAR_DAYS ? "high" : "medium";

  return {
    tdee: measuredMedian,
    confidence,
    wearDays: dailyTotals.length,
  };
}
