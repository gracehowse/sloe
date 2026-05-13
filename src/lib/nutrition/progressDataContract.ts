/**
 * progressDataContract — single source of truth for the data
 * thresholds the Progress surfaces use before they're allowed to
 * surface confidence-laden language.
 *
 * **Authority:** customer-lens audit 2026-04-30 #4 +
 * `docs/decisions/2026-05-13-progress-empty-state-contract.md`.
 *
 * The audit found Progress fabricating "Maintenance held steady ·
 * high confidence" with no logged data. The individual gates
 * (`progressStoryGate.STORY_DATA_FLOOR_DAYS`, `adaptiveTdee.MIN_*`)
 * were already in place, but each Progress surface read its own
 * literal — so a future regression on any one of them would silently
 * leak fabricated confidence into the UI again.
 *
 * This module is the contract. Every Progress surface that
 * conditionally renders narrative / confidence / trend lines reads
 * its threshold from here. Tests pin both the values and the
 * fail-closed posture (zero data → placeholder, never a claim).
 *
 * **Three thresholds, three regimes:**
 *
 *   1. **Story floor (`MIN_LOGGING_DAYS_FOR_STORY = 3`).**
 *      Below this we render `<ProgressStoryGate>` — the
 *      count-up placeholder. No headline, no body, no number.
 *
 *   2. **Adaptive TDEE floor (`MIN_LOGGING_DAYS_FOR_ADAPTIVE_TDEE = 7`
 *      + `MIN_WEIGH_INS_FOR_ADAPTIVE_TDEE = 3`).**
 *      Below this `computeAdaptiveTDEE` returns null. The
 *      Maintenance card falls back to a labelled **"Formula
 *      estimate"** pill with no confidence bars.
 *
 *   3. **Weight trend floor (`MIN_WEIGH_INS_FOR_TREND = 2`).**
 *      Below this the WeightChart renders its empty-state
 *      caption ("No weigh-ins in this range") instead of a
 *      line. The number "55.3 kg" called out by the audit can't
 *      appear without two real weigh-ins.
 *
 * Pure module — no React, no I/O. Shared across web + mobile.
 */

/**
 * Minimum days of logging in the rolling window before the Progress
 * **story** (engine-led headline + body) is allowed to render. Below
 * this we render `<ProgressStoryGate>` instead.
 */
export const MIN_LOGGING_DAYS_FOR_STORY = 3;

/**
 * Minimum days of logging before the adaptive TDEE engine is allowed
 * to publish a result. Mirrors `adaptiveTdee.MIN_LOGGING_DAYS`.
 */
export const MIN_LOGGING_DAYS_FOR_ADAPTIVE_TDEE = 7;

/**
 * Minimum weigh-ins in the rolling window before the adaptive TDEE
 * engine is allowed to publish a result. Mirrors
 * `adaptiveTdee.MIN_WEIGH_INS`.
 */
export const MIN_WEIGH_INS_FOR_ADAPTIVE_TDEE = 3;

/**
 * Minimum weigh-ins required to render a weight-trend line. With one
 * weigh-in there is no trend; the chart must show its empty-state
 * caption instead.
 */
export const MIN_WEIGH_INS_FOR_TREND = 2;

/**
 * Has the user logged enough days this week for the engine-led
 * Progress story to render? When false, render the placeholder
 * (`<ProgressStoryGate>`), never the headline.
 */
export function hasEnoughDataForStory(daysLogged: number): boolean {
  if (!Number.isFinite(daysLogged)) return false;
  return daysLogged >= MIN_LOGGING_DAYS_FOR_STORY;
}

/**
 * Does the available data clear the adaptive TDEE floor? Used by
 * `computeAdaptiveTDEE` to decide whether to publish at all.
 */
export function hasEnoughDataForAdaptiveTDEE(args: {
  loggingDays: number;
  weighInCount: number;
}): boolean {
  if (!Number.isFinite(args.loggingDays) || !Number.isFinite(args.weighInCount)) {
    return false;
  }
  return (
    args.loggingDays >= MIN_LOGGING_DAYS_FOR_ADAPTIVE_TDEE &&
    args.weighInCount >= MIN_WEIGH_INS_FOR_ADAPTIVE_TDEE
  );
}

/**
 * Does the weight series have enough points to draw a trend line?
 * Used by WeightChart's render gate.
 */
export function hasEnoughWeighInsForTrend(weighInCount: number): boolean {
  if (!Number.isFinite(weighInCount)) return false;
  return weighInCount >= MIN_WEIGH_INS_FOR_TREND;
}
