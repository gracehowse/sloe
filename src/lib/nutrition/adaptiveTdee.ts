/**
 * Adaptive TDEE estimation using gated energy balance + weight-trend slope.
 *
 * Infers real Total Daily Energy Expenditure from logged intake and weight
 * trend data, replacing static Mifflin-St Jeor estimates once enough data
 * accumulates (7+ days of logging, 3+ weigh-ins).
 *
 * Algorithm:
 *   1. COMPLETENESS GATE (R1): a day enters the intake average only when it
 *      is plausibly a *full* day of eating — `kcal >= max(1000, 0.8 × BMR)`
 *      (and, when ≥2-entry data is available, ≥2 entries). Partial days
 *      (a single 300-kcal snack) are excluded from BOTH the average and the
 *      day/confidence counts. Without this gate the mean intake is a blend of
 *      "full day" and "barely logged", and the solver reads the dilution as
 *      low expenditure. This is the MacroFactor / Carbon "trusted day" guard,
 *      automated.
 *   2. WEIGHT TREND (R2): least-squares slope (kg/day) over a
 *      gap-filled *daily* series (ENG-1024 — interpolate sparse weigh-ins
 *      to one reading per day before fitting, so weekly weighers get the
 *      same time-uniform smoothing as daily weighers), then clamped to a
 *      WINDOW/CONFIDENCE-AWARE slope cap (ENG-1116) to reject water/glycogen
 *      noise on short windows WITHOUT under-crediting legitimate fast losers
 *      on long, well-sampled windows. The cap tightens to ±0.35 kg/week at
 *      low confidence (short/noisy window — the original water-noise guard),
 *      widening to ±0.7 at medium and ±1.0 at high confidence once the window
 *      is long enough (≥21 logging days + ≥7 weigh-ins) to trust the slope.
 *      Replaces the old per-weigh-in EMA(α=0.1), which captured only ~29% of
 *      the real weight move with sparse weigh-ins and so understated the trend
 *      term ~3.5×.
 *   3. Convert to energy: 1 kg body mass ≈ 7700 kcal (Hall & Chow).
 *   4. Adaptive TDEE = avg_gated_intake − (weight_change_rate_kg/day × 7700)
 *   5. PLAUSIBILITY BOUND (R3): when a sedentary-formula baseline is supplied,
 *      clamp the estimate into [0.85, 1.30] × sedentary Mifflin (and floor at
 *      the Watch resting-energy-derived minimum when available). An estimate
 *      that lands below a person's own sedentary maintenance is an internal
 *      contradiction — clamp it, mark confidence `low`, and record a
 *      structured reason. No silent clamps.
 *
 * Architecture + research provenance:
 *   `docs/decisions/2026-06-10-adaptive-tdee-gating.md`
 *   `docs/ux/research/2026-06-10-adaptive-tdee-review.md` (forensic R1/R2/R3)
 *   `docs/ux/research/2026-06-10-tdee-methodology-survey.md` (four-layer
 *    architecture; R1 promoted load-bearing, R2 ships WITH R1, R3 = bound not
 *    standing blend).
 *
 * Reference: Hall & Chow, "Quantification of the effect of energy imbalance
 * on bodyweight" (Am J Clin Nutr, 2011).
 */

// ENG-97 (2026-05-13): the floor constants are now sourced from the
// Progress empty-state contract so every nutrition surface reads the
// same numbers. The MIN_LOGGING_DAYS / MIN_WEIGH_INS names are kept as
// re-exports for back-compat with existing tests + call sites.
import {
  MIN_LOGGING_DAYS_FOR_ADAPTIVE_TDEE,
  MIN_WEIGH_INS_FOR_ADAPTIVE_TDEE,
} from "./progressDataContract";
import { dailyInterpolatedWeightEntries } from "./weightTrendSmoothing";

const KCAL_PER_KG = 7700;
export const MIN_LOGGING_DAYS = MIN_LOGGING_DAYS_FOR_ADAPTIVE_TDEE;
export const MIN_WEIGH_INS = MIN_WEIGH_INS_FOR_ADAPTIVE_TDEE;
const DEFAULT_WINDOW_DAYS = 28;

/**
 * R1 completeness-gate constants. A logged day only counts as a "full day"
 * (and so only enters the intake average + the day/confidence tallies) when
 * its total calories clear `max(MIN_COMPLETE_DAY_KCAL, 0.8 × BMR)` AND — when
 * per-day entry counts are supplied — it has ≥ MIN_COMPLETE_DAY_ENTRIES
 * entries. Numbers from the forensic R1 spec (`kcal ≥ max(1000, 0.8 × BMR)`,
 * optionally ≥2 entries). For Grace (BMR 1,215) the floor resolves to 1,000.
 */
export const MIN_COMPLETE_DAY_KCAL = 1000;
export const COMPLETE_DAY_BMR_FRACTION = 0.8;
export const MIN_COMPLETE_DAY_ENTRIES = 2;

/**
 * R2 slope cap — WINDOW/CONFIDENCE-AWARE (ENG-1116).
 *
 * The weight trend (least-squares slope over the daily-interpolated series) is
 * clamped so a couple of noisy weigh-ins on a short window cannot blow up the
 * energy term. The original implementation used a single flat ±0.35 kg/week.
 * That was correct as a water-noise guard on short/low-confidence windows, but
 * applied UNCONDITIONALLY it under-credited legitimate fast losers: a real
 * 0.5 kg/week deficit pins at the 0.35 cap → ~385 kcal/day of slope energy →
 * maintenance reads too low → suggested intake too low.
 *
 * Fix: the cap magnitude is now derived from the SAME confidence tier the
 * estimator already computes (loggingDays/weighInCount ladder), so it only
 * widens once the window is long enough to trust the slope:
 *   - low    confidence → ±0.35 kg/week (short/noisy — keep the tight guard)
 *   - medium confidence → ±0.70 kg/week
 *   - high   confidence → ±1.00 kg/week (≥21 logging days + ≥7 weigh-ins)
 *
 * This deliberately does NOT raise the flat cap to 1.0 — that would re-admit
 * water noise on short windows (the exact failure the 2026-06-10 gating
 * decision fixed). The cap stays tight at low confidence and only relaxes as
 * the window earns trust.
 *
 * A wider cap is STILL bounded downstream by the R3 plausibility band
 * ([0.85, 1.30] × sedentary Mifflin) + the resting-energy floor, so a relaxed
 * slope can never push the estimate outside a person's own physiology.
 */
export const SLOPE_CAP_LOW_KG_PER_WEEK = 0.35;
export const SLOPE_CAP_MED_KG_PER_WEEK = 0.7;
export const SLOPE_CAP_HIGH_KG_PER_WEEK = 1.0;

/**
 * Confidence tier for the adaptive estimate. Hoisted to a named type so the
 * slope-cap selector and the result share one vocabulary.
 */
export type AdaptiveTdeeConfidence = "low" | "medium" | "high";

/**
 * Selects the slope-cap magnitude (kg/week) for a given confidence tier.
 * Exported so tests can pin each tier's cap without reconstructing the ladder.
 */
export function selectSlopeCapKgPerWeek(
  confidence: AdaptiveTdeeConfidence,
): number {
  switch (confidence) {
    case "high":
      return SLOPE_CAP_HIGH_KG_PER_WEEK;
    case "medium":
      return SLOPE_CAP_MED_KG_PER_WEEK;
    case "low":
    default:
      return SLOPE_CAP_LOW_KG_PER_WEEK;
  }
}

/**
 * Confidence-tier thresholds. Exported (not inline magic numbers) so the
 * Progress "data progress toward adaptive" UI reads the SAME gate the engine
 * uses (ENG-1189) AND the ENG-1116 slope-cap tier derives from the same source —
 * one definition so the card, the cap, and the surfaced confidence cannot drift.
 * ENG-1189: the Maintenance card previously hardcoded `/7` weigh-ins + `/21`
 * logging days (the HIGH numbers) against lifetime any-entry days, while adaptive
 * actually *surfaces* at MEDIUM over gated full days in the trailing window — two
 * gates, one screen. Adaptive surfaces only at medium/high (the writer
 * `refreshAdaptiveTdee` skips low; `resolveMaintenance` rejects low), so MEDIUM
 * is the honest "engages" bar.
 */
export const MEDIUM_CONFIDENCE_LOGGING_DAYS = 14;
export const MEDIUM_CONFIDENCE_WEIGH_INS = 5;
export const HIGH_CONFIDENCE_LOGGING_DAYS = 21;
export const HIGH_CONFIDENCE_WEIGH_INS = 7;

/**
 * Determines the confidence tier from the gated logging-day + weigh-in counts.
 * Hoisted (ENG-1116) so the slope cap can read confidence BEFORE the clamp —
 * the cap magnitude and the surfaced confidence must agree, so both derive from
 * this one function, against the single-source thresholds above.
 */
export function determineAdaptiveTdeeConfidence(
  loggingDays: number,
  weighInCount: number,
): AdaptiveTdeeConfidence {
  if (
    loggingDays >= HIGH_CONFIDENCE_LOGGING_DAYS &&
    weighInCount >= HIGH_CONFIDENCE_WEIGH_INS
  )
    return "high";
  if (
    loggingDays >= MEDIUM_CONFIDENCE_LOGGING_DAYS &&
    weighInCount >= MEDIUM_CONFIDENCE_WEIGH_INS
  )
    return "medium";
  return "low";
}

/**
 * R3 plausibility band, as multiples of the user's *sedentary* Mifflin TDEE.
 * The survey's bound (§6 layer 3 / §7): clamp/confidence-downgrade adaptive
 * values outside ~0.85–1.30 × the sedentary formula. An estimate below
 * 0.85× a person's sedentary maintenance contradicts their own physiology
 * (Grace's 1,314 < her 1,458 sedentary floor would have been caught).
 */
export const PLAUSIBILITY_LOWER_FRACTION = 0.85;
export const PLAUSIBILITY_UPPER_FRACTION = 1.3;

export type AdaptiveTdeeClampReason =
  | "below_sedentary_band"
  | "above_sedentary_band"
  | "below_resting_floor";

export type AdaptiveTdeeInput = {
  /** Map of YYYY-MM-DD → total calories consumed that day. */
  intakeByDay: Record<string, number>;
  /** Map of YYYY-MM-DD → weight in kg that day. */
  weightByDay: Record<string, number>;
  /**
   * Map of YYYY-MM-DD → number of journal entries that day. Optional. When
   * supplied, the R1 gate additionally requires ≥ MIN_COMPLETE_DAY_ENTRIES
   * entries for a day to count as complete (a single large entry — e.g. a
   * 2,000-kcal recipe import — is not, on its own, a full day of eating).
   * When omitted, the kcal floor is the only completeness signal.
   */
  entryCountByDay?: Record<string, number>;
  /**
   * The user's basal metabolic rate (Mifflin BMR), kcal/day. When supplied
   * the per-day completeness floor is `max(MIN_COMPLETE_DAY_KCAL, 0.8 × BMR)`.
   * When omitted the floor is the flat MIN_COMPLETE_DAY_KCAL — the gate still
   * runs (the spec's `max(1000, …)` lower arm), it just can't scale up for a
   * larger person.
   */
  bmrKcal?: number | null;
  /**
   * The user's *sedentary* Mifflin TDEE (BMR × 1.2), kcal/day. When supplied
   * the R3 plausibility bound clamps the result into
   * [0.85, 1.30] × this value. Must be the SEDENTARY number — the bound is a
   * floor-of-plausibility, and using a higher activity multiplier would let
   * an under-logged estimate slip through.
   */
  sedentaryTdeeKcal?: number | null;
  /**
   * Apple Watch / HealthKit resting (basal) energy floor, kcal/day. When
   * available the estimate is additionally floored here — the survey's
   * "the Watch's *resting* energy is a better lower-bound source than its
   * active energy". Resting energy is formula-grade, not the noisy active
   * slice, so it is a legitimate hard floor.
   */
  restingEnergyFloorKcal?: number | null;
  /** How many trailing days to analyze (default 28). */
  windowDays?: number;
};

export type AdaptiveTdeeResult = {
  tdee: number;
  confidence: "low" | "medium" | "high";
  /** Count of *gated* (full) logging days — the days that fed the average. */
  loggingDays: number;
  weighInCount: number;
  avgDailyIntake: number;
  /** kg/day from the least-squares slope (post-cap). */
  smoothedWeightChangeKgPerDay: number;
  windowDays: number;
  /** Number of days excluded by the R1 completeness gate (partial logs). */
  excludedPartialDays: number;
  /** The per-day kcal floor the gate applied. */
  completeDayFloorKcal: number;
  /**
   * The estimate before the R3 plausibility clamp. Equal to `tdee` when no
   * clamp fired. Surfaced so callers / tests can see the raw energy-balance
   * number that triggered a bound.
   */
  rawTdee: number;
  /** True when the R3 bound moved the value. Forces confidence to `low`. */
  clamped: boolean;
  /** Structured clamp reason, or null. Never a silent clamp. */
  clampReason: AdaptiveTdeeClampReason | null;
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
 * Least-squares slope (kg/day) of a sparse weight series. x is days elapsed
 * from the first weigh-in, y is kg. Returns 0 for a single point or a
 * degenerate (all-same-day) series — no trend can be inferred. This replaces
 * the per-weigh-in EMA, which under-smoothed sparse data and muted the
 * real trend (forensic R2).
 */
function leastSquaresSlopeKgPerDay(entries: [string, number][]): number {
  if (entries.length < 2) return 0;
  const x0 = new Date(entries[0][0]).getTime();
  const pts = entries.map(
    ([k, v]) => [(new Date(k).getTime() - x0) / 86_400_000, v] as const,
  );
  const n = pts.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0; // all weigh-ins on the same calendar day
  return (n * sxy - sx * sy) / denom;
}

/**
 * The completeness floor + gated-day / weigh-in tallies that drive the engage
 * gate. Extracted so the Progress "data progress toward adaptive" UI can read
 * the SAME numbers the engine uses (ENG-1189) instead of a parallel,
 * lifetime-any-entry count. Pure; no side effects.
 */
export type AdaptiveDataCounts = {
  /** The per-day kcal floor applied (max(1000, 0.8 × BMR)). */
  completeDayFloorKcal: number;
  /** Gated full logging days within the trailing window. */
  loggingDays: number;
  /** Weigh-ins within the trailing window. */
  weighInCount: number;
  /** Days with any kcal logged in the window that were excluded as partial. */
  excludedPartialDays: number;
  /** The window (days) the counts were measured over. */
  windowDays: number;
};

export function computeAdaptiveDataCounts(
  input: Pick<
    AdaptiveTdeeInput,
    "intakeByDay" | "weightByDay" | "entryCountByDay" | "bmrKcal" | "windowDays"
  >,
): AdaptiveDataCounts {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const cutoff = cutoffDate(windowDays);

  // R1 completeness floor: max(1000, 0.8 × BMR) when BMR is known, else 1000.
  const bmrFloor =
    input.bmrKcal != null && Number.isFinite(input.bmrKcal) && input.bmrKcal > 0
      ? COMPLETE_DAY_BMR_FRACTION * input.bmrKcal
      : 0;
  const completeDayFloorKcal = Math.round(
    Math.max(MIN_COMPLETE_DAY_KCAL, bmrFloor),
  );

  const entryCounts = input.entryCountByDay;

  // All days with any logged kcal in the window — used only to count how many
  // were excluded as partial (for transparency / tests).
  const loggedInWindow = sortedEntries(input.intakeByDay).filter(
    ([k, v]) => k >= cutoff && v > 0,
  );

  // R1: a day enters the average only when it is plausibly a full day.
  const gatedIntakeEntries = loggedInWindow.filter(([k, v]) => {
    if (v < completeDayFloorKcal) return false;
    if (entryCounts) {
      const count = entryCounts[k] ?? 0;
      if (count < MIN_COMPLETE_DAY_ENTRIES) return false;
    }
    return true;
  });

  const weightEntries = sortedEntries(input.weightByDay).filter(
    ([k]) => k >= cutoff,
  );

  return {
    completeDayFloorKcal,
    loggingDays: gatedIntakeEntries.length,
    weighInCount: weightEntries.length,
    excludedPartialDays: loggedInWindow.length - gatedIntakeEntries.length,
    windowDays,
  };
}

export function computeAdaptiveTDEE(
  input: AdaptiveTdeeInput,
): AdaptiveTdeeResult | null {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const cutoff = cutoffDate(windowDays);

  const {
    completeDayFloorKcal,
    loggingDays,
    weighInCount,
    excludedPartialDays,
  } = computeAdaptiveDataCounts({
    intakeByDay: input.intakeByDay,
    weightByDay: input.weightByDay,
    entryCountByDay: input.entryCountByDay,
    bmrKcal: input.bmrKcal,
    windowDays,
  });

  // Re-derive the gated intake entries for the average (same gate, in-window).
  const gatedIntakeEntries = sortedEntries(input.intakeByDay).filter(
    ([k, v]) => {
      if (k < cutoff || v <= 0) return false;
      if (v < completeDayFloorKcal) return false;
      if (input.entryCountByDay) {
        const count = input.entryCountByDay[k] ?? 0;
        if (count < MIN_COMPLETE_DAY_ENTRIES) return false;
      }
      return true;
    },
  );

  const weightEntries = sortedEntries(input.weightByDay).filter(
    ([k]) => k >= cutoff,
  );

  // Excluded (partial) days do NOT count toward the window or confidence:
  // eligibility is measured on gated days only.
  if (loggingDays < MIN_LOGGING_DAYS || weighInCount < MIN_WEIGH_INS) {
    return null;
  }

  const avgDailyIntake = Math.round(
    gatedIntakeEntries.reduce((sum, [, v]) => sum + v, 0) / loggingDays,
  );

  // ENG-1116: hoist the confidence tier ABOVE the slope clamp so the cap can
  // read it. Confidence depends only on the gated day/weigh-in counts (both
  // already known here), so this is order-safe — the value is identical to the
  // old post-clamp computation. The R3 clamp below may still DOWNGRADE it.
  let confidence: AdaptiveTdeeConfidence = determineAdaptiveTdeeConfidence(
    loggingDays,
    weighInCount,
  );

  // R2 / ENG-1024: least-squares slope over the daily-interpolated series,
  // clamped to the window/confidence-aware cap (ENG-1116). Short/low-confidence
  // windows keep the tight ±0.35 kg/week water-noise guard; long, well-sampled
  // windows widen to ±0.7 (medium) / ±1.0 (high) so legitimate fast losers are
  // not under-credited.
  const slopeCapKgPerWeek = selectSlopeCapKgPerWeek(confidence);
  const slopeCapKgPerDay = slopeCapKgPerWeek / 7;
  const dailyWeightEntries = dailyInterpolatedWeightEntries(weightEntries);
  const rawSlope = leastSquaresSlopeKgPerDay(dailyWeightEntries);
  const weightChangeKgPerDay = Math.max(
    -slopeCapKgPerDay,
    Math.min(slopeCapKgPerDay, rawSlope),
  );

  const energyFromWeightChange = Math.round(
    weightChangeKgPerDay * KCAL_PER_KG,
  );

  const rawTdee = Math.round(Math.max(800, avgDailyIntake - energyFromWeightChange));

  // Confidence is determined once, above the slope clamp (ENG-1116 hoist) via
  // `determineAdaptiveTdeeConfidence` — single source for both the cap tier and
  // the surfaced confidence (was a duplicate inline ladder here pre-ENG-1116).
  // R3 below may still DOWNGRADE `confidence` to "low" on a clamp.

  // R3: plausibility bound. Clamp into [0.85, 1.30] × sedentary Mifflin and
  // floor at the Watch resting-energy minimum when available. A clamp is
  // never silent — it downgrades confidence to `low` and records the reason.
  let tdee = rawTdee;
  let clamped = false;
  let clampReason: AdaptiveTdeeClampReason | null = null;

  const sed = input.sedentaryTdeeKcal;
  if (sed != null && Number.isFinite(sed) && sed > 0) {
    const lower = PLAUSIBILITY_LOWER_FRACTION * sed;
    const upper = PLAUSIBILITY_UPPER_FRACTION * sed;
    if (tdee < lower) {
      tdee = Math.round(lower);
      clamped = true;
      clampReason = "below_sedentary_band";
    } else if (tdee > upper) {
      tdee = Math.round(upper);
      clamped = true;
      clampReason = "above_sedentary_band";
    }
  }

  const restingFloor = input.restingEnergyFloorKcal;
  if (restingFloor != null && Number.isFinite(restingFloor) && restingFloor > 0) {
    if (tdee < restingFloor) {
      tdee = Math.round(restingFloor);
      clamped = true;
      // Resting floor is the most authoritative lower bound — surface it
      // even if the sedentary band already nudged the value.
      clampReason = "below_resting_floor";
    }
  }

  if (clamped) {
    // A clamped value is, by definition, not what the energy-balance
    // estimator produced — it must not parade as medium/high confidence.
    confidence = "low";
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[adaptiveTdee] plausibility clamp: ${clampReason} — raw ${rawTdee} → ${tdee} ` +
          `(sedentary ${sed ?? "n/a"}, resting floor ${restingFloor ?? "n/a"})`,
      );
    }
  }

  return {
    tdee,
    confidence,
    loggingDays,
    weighInCount,
    avgDailyIntake,
    smoothedWeightChangeKgPerDay:
      Math.round(weightChangeKgPerDay * 10000) / 10000,
    windowDays,
    excludedPartialDays,
    completeDayFloorKcal,
    rawTdee,
    clamped,
    clampReason,
  };
}
