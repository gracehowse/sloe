/**
 * progressCommentary — generate the engine-led narrative line shown
 * at the top of Progress (Surface E) per the production design spec
 * §Surface E and D-2026-04-27-17 ("Progress is a weekly story").
 *
 * Three regimes:
 *   - `adjustment`   — abs(currentTdee - prevWeekTdee) > 30 kcal.
 *                      The maintenance estimate moved this week.
 *   - `calibrating`  — confidence is "low" OR fewer than 14 days of
 *                      logging. We're still warming up; show calmer
 *                      copy and don't quote a speculative number with
 *                      false confidence.
 *   - `steady`       — confidence is medium/high AND delta is ≤ 30
 *                      kcal vs the previous week.
 *
 * Returns headline + body + confidence so the renderer can choose
 * how to surface them. `numerals` is the inline-highlight payload
 * (the kcal figure to bold inside the body) when applicable.
 *
 * Voice rules (production design spec §1.7):
 *   - UK English: "behaviour", "personalise", "fibre", "kilocalories".
 *   - Second-person.
 *   - No exclamation marks.
 *   - Restraint — no marketing tone.
 *   - Always-on per D-2026-04-27-12: confidence is metadata, not a
 *     gate. We never hide the line; we adapt the language.
 *
 * Shared lib — mobile imports the same module path through the
 * cross-platform `nutrition` shared lib pattern.
 */

import type { AdaptiveTdeeResult } from "./adaptiveTdee";

export type ProgressCommentaryRegime = "adjustment" | "calibrating" | "steady";

export type ProgressCommentaryConfidence = "low" | "medium" | "high";

export interface ProgressCommentaryInput {
  /** Latest adaptive TDEE result. May be `null` when the engine
   *  has too little data to compute (returns `calibrating` regime). */
  current: AdaptiveTdeeResult | null;
  /** Previous-week TDEE estimate, when known. Used for delta detection. */
  prevWeekTdee?: number | null;
  /** Avg intake on weeks the user lost weight, when known.
   *  Surfaced inline in `adjustment` regime body copy. */
  avgIntakeOnLossWeeksKcal?: number | null;
  /** Days of logging in the rolling window. Defaults to
   *  `current.loggingDays` when omitted. */
  loggingDays?: number;
}

export interface ProgressCommentaryResult {
  regime: ProgressCommentaryRegime;
  /** Top-line headline. Always present. */
  headline: string;
  /** Body sentence(s). Always present. May reference `numerals`. */
  body: string;
  /** Confidence level to render via the ConfidenceChip. */
  confidence: ProgressCommentaryConfidence;
  /** Highlighted inline values the renderer should bold inside `body`.
   *  Rendered with `tabular-nums` per spec §1.2.
   *  Order = appearance order in body. */
  numerals: string[];
  /** Whether this commentary references a TDEE value (callers can
   *  hide trend cards entirely when false on the calibrating regime). */
  hasMaintenanceEstimate: boolean;
}

const ADJUSTMENT_DELTA_KCAL = 30;
const CALIBRATING_MIN_DAYS = 14;

/**
 * Generate the Progress headline + body + confidence chip level.
 *
 * Pure function — no I/O, no Date access, no React. Safe to call
 * from server, tests, mobile, or web.
 */
export function generateProgressCommentary(
  input: ProgressCommentaryInput,
): ProgressCommentaryResult {
  const { current, prevWeekTdee, avgIntakeOnLossWeeksKcal } = input;
  const loggingDays = input.loggingDays ?? current?.loggingDays ?? 0;

  // Calibrating regime — engine returned null OR confidence is low OR
  // confidence is medium with <14 days. Per D-2026-04-27-12 we still
  // surface the headline, but in calibration tone — never hide.
  //
  // F-124 (Grace, 2026-05-07): "this maintance est says high so there
  // are two conflicting widgets" — when the adaptive engine says
  // **high** confidence we trust it and skip the `loggingDays < 14`
  // gate. Otherwise the top "This Week" card renders "calibrating"
  // while the bottom Maintenance card claims "High confidence" —
  // mutually contradictory copy. The engine already weights data
  // quality into its confidence; we shouldn't second-guess it.
  if (
    !current ||
    current.confidence === "low" ||
    (current.confidence === "medium" && loggingDays < CALIBRATING_MIN_DAYS)
  ) {
    return calibratingCopy(current, loggingDays);
  }

  const prev = typeof prevWeekTdee === "number" && Number.isFinite(prevWeekTdee)
    ? prevWeekTdee
    : null;

  if (prev != null) {
    const delta = current.tdee - prev;
    if (Math.abs(delta) > ADJUSTMENT_DELTA_KCAL) {
      return adjustmentCopy({
        currentTdee: current.tdee,
        delta,
        confidence: current.confidence,
        avgIntakeOnLossWeeksKcal: avgIntakeOnLossWeeksKcal ?? null,
      });
    }
  }

  return steadyCopy({
    currentTdee: current.tdee,
    confidence: current.confidence,
  });
}

function calibratingCopy(
  current: AdaptiveTdeeResult | null,
  loggingDays: number,
): ProgressCommentaryResult {
  // First-3-days (loggingDays < 3) — Welcome variant per spec §State coverage.
  // Mid-warmup (3 ≤ loggingDays < 14) — "Need a few more days of data" variant.
  // Both are calmer than the full TDEE narrative and never quote a number.
  const isFirstWeek = loggingDays < 3;
  if (isFirstWeek) {
    return {
      regime: "calibrating",
      headline: "Welcome — we'll start estimating maintenance after your first week",
      body: "Log meals and weigh in once or twice. We'll tell you when we're ready.",
      confidence: "low",
      numerals: [],
      hasMaintenanceEstimate: false,
    };
  }
  return {
    regime: "calibrating",
    headline: "We're still calibrating your maintenance",
    body:
      current && current.tdee > 0
        ? `Need a few more days of data — your early estimate is around ${current.tdee.toLocaleString()} kcal, but we'd rather not commit until the trend is clearer.`
        : "Need a few more days of data — keep logging and weighing in, and we'll surface your maintenance estimate once the trend is clear.",
    confidence: "low",
    numerals: current && current.tdee > 0 ? [`${current.tdee.toLocaleString()} kcal`] : [],
    hasMaintenanceEstimate: false,
  };
}

function adjustmentCopy(args: {
  currentTdee: number;
  delta: number;
  confidence: ProgressCommentaryConfidence;
  avgIntakeOnLossWeeksKcal: number | null;
}): ProgressCommentaryResult {
  const { currentTdee, delta, confidence, avgIntakeOnLossWeeksKcal } = args;
  const direction = delta > 0 ? "up" : "down";
  const absDelta = Math.abs(Math.round(delta));
  const tdeeStr = `${currentTdee.toLocaleString()} kcal`;
  const headline = `Your maintenance adjusted ${direction} by ${absDelta} kcal`;

  const numerals: string[] = [];
  let body: string;

  if (avgIntakeOnLossWeeksKcal != null && Number.isFinite(avgIntakeOnLossWeeksKcal) && avgIntakeOnLossWeeksKcal > 0) {
    const lossKcal = `${Math.round(avgIntakeOnLossWeeksKcal).toLocaleString()} kcal`;
    body = `Average intake on weeks you lost weight: ${lossKcal}. We're now estimating maintenance at ${tdeeStr} with ${confidence} confidence.`;
    numerals.push(lossKcal, tdeeStr);
  } else {
    body = `We're now estimating maintenance at ${tdeeStr} with ${confidence} confidence, based on your intake and weight trend.`;
    numerals.push(tdeeStr);
  }

  return {
    regime: "adjustment",
    headline,
    body,
    confidence,
    numerals,
    hasMaintenanceEstimate: true,
  };
}

function steadyCopy(args: {
  currentTdee: number;
  confidence: ProgressCommentaryConfidence;
}): ProgressCommentaryResult {
  const tdeeStr = `${args.currentTdee.toLocaleString()} kcal`;
  return {
    regime: "steady",
    headline: "Maintenance held steady this week",
    body: `Your estimate stayed at ${tdeeStr} with ${args.confidence} confidence — keep going.`,
    confidence: args.confidence,
    numerals: [tdeeStr],
    hasMaintenanceEstimate: true,
  };
}

/**
 * Helper: render the body string with the numerals replaced by
 * sentinels for downstream highlight wrapping. Returns an array of
 * `{ text, highlight }` segments preserving the body's word order.
 *
 * Renderers (web + mobile) wrap `highlight: true` segments in
 * `tabular-nums` + bold typography per spec §1.2.
 */
export function splitBodyIntoSegments(
  body: string,
  numerals: readonly string[],
): Array<{ text: string; highlight: boolean }> {
  if (numerals.length === 0) return [{ text: body, highlight: false }];
  const segments: Array<{ text: string; highlight: boolean }> = [];
  let cursor = 0;
  for (const term of numerals) {
    const idx = body.indexOf(term, cursor);
    if (idx < 0) continue;
    if (idx > cursor) {
      segments.push({ text: body.slice(cursor, idx), highlight: false });
    }
    segments.push({ text: term, highlight: true });
    cursor = idx + term.length;
  }
  if (cursor < body.length) {
    segments.push({ text: body.slice(cursor), highlight: false });
  }
  return segments;
}
