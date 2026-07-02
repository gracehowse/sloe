/**
 * ENG-953 — Expenditure trend copy (calm, soft-confidence).
 *
 * Pure functions; no React, no platform APIs. Shared by the web
 * `ExpenditureTrendCard` and the mobile `ExpenditureTrendCard` so the two
 * platforms can never drift in what the card says.
 *
 * Design rules this file enforces (per the ticket + trust posture):
 *   - NEVER a false-precision integer. The adaptive / measured TDEE is an
 *     estimate; we round to the nearest 10 kcal and lead with "about ~" so
 *     the surface reads as a soft range, not a precise daily total.
 *   - Sentence-led, body-neutral. "burning about ~X kcal/day lately" when we
 *     have a confident read; "still learning your pattern" when we don't.
 *   - No health claims, no diet-culture framing. Expenditure is described
 *     plainly as the energy the body uses, not a target to chase.
 *
 * The card consumes data ALREADY in screen state — `adaptive_tdee`,
 * `adaptive_tdee_confidence`, `adaptive_tdee_updated_at`, and `measured_tdee`.
 * Nothing here recomputes a TDEE; it only decides how to phrase what the
 * engine already produced.
 */

import { formatKcalDisplay } from "../nutrition/formatMacro";

export type ExpenditureConfidence = "low" | "medium" | "high";

/** The confidence tier the ConfidenceChip should render, or null when the
 *  card is in its "still learning" pre-estimate state and shows no chip. */
export type ExpenditureChipLevel = ExpenditureConfidence | null;

export type ExpenditureTrendInput = {
  /** `adaptive_tdee` from the profile (the modelled burn). */
  adaptiveTdee: number | null;
  /** `adaptive_tdee_confidence` — "low" | "medium" | "high" | other/null. */
  adaptiveConfidence: string | null;
  /** ISO string `adaptive_tdee_updated_at`, or null. */
  adaptiveUpdatedAt: string | null;
  /** `measured_tdee` from Apple Health, when present. Preferred over the
   *  modelled adaptive value because it's observed, not inferred. */
  measuredTdee?: number | null;
  /** Optional clock injection for deterministic tests. Defaults to now. */
  now?: number;
};

export type ExpenditureTrendCopy = {
  /** The lead sentence. Always set — the card never renders empty. */
  line: string;
  /** Optional second sentence (recency / source nuance). Empty string = omit. */
  detail: string;
  /** Confidence chip level, or null when no chip should show. */
  chipLevel: ExpenditureChipLevel;
  /** Which value backed the copy. "none" = no estimate yet (learning state). */
  source: "measured" | "adaptive" | "none";
  /** The rounded kcal figure shown in the line, or null in the learning state.
   *  Rounded to the nearest 10 — deliberately NOT the raw integer. */
  roundedKcal: number | null;
};

const NORMALISE: Record<string, ExpenditureConfidence> = {
  low: "low",
  medium: "medium",
  high: "high",
};

function normaliseConfidence(raw: string | null): ExpenditureConfidence | null {
  if (!raw) return null;
  return NORMALISE[raw.toLowerCase()] ?? null;
}

/** Round to the nearest 10 kcal — the anti-false-precision rule. A value of
 *  2347 becomes 2350, surfaced as "about ~2,350". */
function roundToTen(kcal: number): number {
  return Math.round(kcal / 10) * 10;
}

/**
 * ENG-1305: delegates to the app-wide `formatKcalDisplay` instead of a
 * locale-pinned `.toLocaleString("en-US")` — same reasoning (comma
 * formatting must not depend on the runtime), now via the single shared
 * implementation so every kcal display in the app can never drift again.
 */
function formatKcal(kcal: number): string {
  return formatKcalDisplay(kcal);
}

/** Soft recency phrasing from the `updated_at` timestamp. Returns "" when we
 *  can't read a sensible age (so the detail line is simply omitted). */
function recencyPhrase(updatedAtISO: string | null, now: number): string {
  if (!updatedAtISO) return "";
  const ts = Date.parse(updatedAtISO);
  if (Number.isNaN(ts)) return "";
  const days = Math.floor((now - ts) / 86_400_000);
  if (days < 0) return ""; // clock skew — don't assert a future update
  if (days <= 1) return "Updated from your latest check-in.";
  if (days <= 10) return "Based on the last week or so of logging.";
  if (days <= 45) return "Based on the last few weeks of logging.";
  // Stale read — be honest that it hasn't refreshed lately.
  return "This hasn't refreshed in a while — keep logging to sharpen it.";
}

/**
 * Build the calm Expenditure trend copy from data already in screen state.
 *
 * Decision order:
 *   1. A confident MEASURED (Apple Health) value wins — it's observed.
 *   2. Otherwise a medium/high-confidence ADAPTIVE value gives the "about ~X
 *      kcal/day lately" line with its confidence chip.
 *   3. A low-confidence adaptive value (or none at all) shows the
 *      "still learning your pattern" reassurance and NO number.
 */
export function buildExpenditureTrendCopy(
  input: ExpenditureTrendInput,
): ExpenditureTrendCopy {
  const now = input.now ?? Date.now();
  const conf = normaliseConfidence(input.adaptiveConfidence);
  const adaptive =
    input.adaptiveTdee != null && Number.isFinite(input.adaptiveTdee) && input.adaptiveTdee > 0
      ? input.adaptiveTdee
      : null;
  const measured =
    input.measuredTdee != null && Number.isFinite(input.measuredTdee) && input.measuredTdee > 0
      ? input.measuredTdee
      : null;

  // 1. Observed Apple Health expenditure — preferred when present.
  if (measured != null) {
    const rounded = roundToTen(measured);
    return {
      line: `Your body's been using about ~${formatKcal(rounded)} kcal/day lately, going by your Apple Health activity.`,
      detail: "Observed from your device — it'll keep adjusting as you move.",
      // Measured comes straight from the watch; surface it as a high read.
      chipLevel: "high",
      source: "measured",
      roundedKcal: rounded,
    };
  }

  // 2. Confident modelled (adaptive) expenditure.
  if (adaptive != null && (conf === "medium" || conf === "high")) {
    const rounded = roundToTen(adaptive);
    return {
      line: `You've been burning about ~${formatKcal(rounded)} kcal/day lately.`,
      detail: recencyPhrase(input.adaptiveUpdatedAt, now),
      chipLevel: conf,
      source: "adaptive",
      roundedKcal: rounded,
    };
  }

  // 3. Low-confidence or no estimate yet — the reassurance state. No number.
  return {
    line: "We're still learning your expenditure pattern.",
    detail:
      "Keep logging meals and weighing in, and a personalised daily burn will settle in here.",
    chipLevel: conf === "low" ? "low" : null,
    source: "none",
    roundedKcal: null,
  };
}
