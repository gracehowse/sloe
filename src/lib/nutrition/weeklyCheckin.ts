/**
 * weeklyCheckin — gating + content for the weekly TDEE check-in ritual.
 *
 * The Suppr math pipeline (`adaptiveTdee.ts` + `refreshAdaptiveTdee.ts`) runs
 * silently — adaptive TDEE updates after each weigh-in or log without ever
 * surfacing the change to the user. MacroFactor's hook is the *moment*: a
 * weekly modal that says "your real burn just changed, here is your new
 * target, accept or keep current".
 *
 * This module owns the pure logic for that ritual:
 *   - `shouldShowWeeklyCheckin` — gate that decides whether the modal
 *     renders this visit.
 *   - `buildWeeklyCheckinContent` — collapses a profile + last-week's
 *     intake/weight into the display-ready content for the modal.
 *
 * Pure module — no React, no I/O, no `Date.now()` outside the injected
 * clock. Mobile re-exports from `apps/mobile/lib/weeklyCheckin.ts` so
 * both platforms hit the same code path.
 *
 * Decisions pinned by tests:
 *   - Gate fires only when adaptive TDEE confidence is medium or high
 *     (low confidence = math doesn't trust itself, no ritual).
 *   - Gate fires only when the user has logged ≥ 5 days in the current
 *     calendar week (otherwise the "expenditure changed" claim is built
 *     on too little data).
 *   - Cooldown: 6 days between shown timestamps. 6 not 7 so a Sunday
 *     check-in slot doesn't drift past the next Sunday on a long week.
 *   - The suggested target preserves the user's current deficit/surplus
 *     by adding the *delta between adaptive and prior TDEE* to the
 *     current target. We never recommend a target below 1200 kcal.
 */

export type WeeklyCheckinConfidence = "low" | "medium" | "high";

export type WeeklyCheckinGateInput = {
  /** Adaptive TDEE confidence as written by `refreshAdaptiveTdee`. */
  adaptiveTdeeConfidence: WeeklyCheckinConfidence | null;
  /** Adaptive TDEE kcal value (only fired when confidence ≥ medium). */
  adaptiveTdee: number | null;
  /** Number of days with non-zero calories logged in the current week
   *  (Sun-to-Sat or Mon-to-Sun, per the user's `week_start_day`). */
  daysLoggedThisWeek: number;
  /** ISO timestamp of the last shown check-in modal (any decision).
   *  `null` when the user has never seen one. */
  lastShownAt: string | null;
  /** Injectable clock for tests. Defaults to `new Date()`. */
  now?: Date;
};

/** Minimum days between shown check-ins. 6 days = "next Sunday is fine". */
const COOLDOWN_DAYS = 6;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

/** Minimum days logged in the current week to claim "expenditure changed". */
export const MIN_DAYS_LOGGED_FOR_CHECKIN = 5;

/** Floor for any suggested target — never recommend below this. */
const MIN_SUGGESTED_TARGET_KCAL = 1200;

/**
 * Decide whether to show the weekly check-in modal on this Today
 * first-load.
 *
 * Returns `false` when any of these are true (in priority order):
 *   1. Adaptive TDEE confidence is null or "low".
 *   2. Adaptive TDEE value is missing / non-finite / non-positive.
 *   3. The user has logged fewer than 5 days in the current week.
 *   4. The modal was shown within the last 6 days.
 */
export function shouldShowWeeklyCheckin(input: WeeklyCheckinGateInput): boolean {
  const {
    adaptiveTdeeConfidence,
    adaptiveTdee,
    daysLoggedThisWeek,
    lastShownAt,
  } = input;

  if (adaptiveTdeeConfidence !== "medium" && adaptiveTdeeConfidence !== "high") {
    return false;
  }
  if (
    adaptiveTdee == null ||
    !Number.isFinite(adaptiveTdee) ||
    adaptiveTdee <= 0
  ) {
    return false;
  }
  if (
    !Number.isFinite(daysLoggedThisWeek) ||
    daysLoggedThisWeek < MIN_DAYS_LOGGED_FOR_CHECKIN
  ) {
    return false;
  }

  if (lastShownAt) {
    const shownAt = Date.parse(lastShownAt);
    if (Number.isFinite(shownAt)) {
      const now = (input.now ?? new Date()).getTime();
      if (now - shownAt < COOLDOWN_MS) {
        return false;
      }
    }
  }

  return true;
}

export type WeeklyCheckinContentInput = {
  /** Adaptive TDEE kcal value (post-gate, guaranteed finite + positive). */
  adaptiveTdee: number;
  /** Static / prior TDEE kcal value used as the comparison baseline.
   *  Typically the formula-only Mifflin TDEE. `null` when not available
   *  — content still renders but the delta line is suppressed. */
  priorTdee: number | null;
  /** Current daily calorie target the user is on. */
  currentTargetKcal: number;
  /** Average daily calories logged this week (over days-with-food). */
  avgCaloriesThisWeek: number;
  /** Weight delta in kg over the last 7 days, rounded to 0.1.
   *  `null` when fewer than 2 weigh-ins in the window — we never
   *  fabricate a "+0.0 kg" delta. */
  weightDeltaKg: number | null;
};

export type WeeklyCheckinContent = {
  /** Full TDEE delta (adaptive − prior). `null` when prior is missing. */
  tdeeDeltaKcal: number | null;
  /** Suggested new daily target. Preserves the user's current
   *  deficit/surplus by adding `tdeeDeltaKcal` to the current target.
   *  Falls back to the current target when `tdeeDeltaKcal` is null.
   *  Never returns a value below `MIN_SUGGESTED_TARGET_KCAL`. */
  suggestedTargetKcal: number;
  /** Headline copy. Calm, factual — no exclamation marks, no
   *  performance adjectives. */
  headline: string;
  /** "Why" subline — one sentence explaining what changed. */
  whyLine: string;
  /** Tabular-ready label for the avg-this-week line. */
  avgThisWeekLabel: string;
  /** Tabular-ready label for the weight-delta line. `null` when
   *  weightDeltaKg is null (we suppress rather than render "+0.0 kg"). */
  weightDeltaLabel: string | null;
};

function formatSignedKcal(n: number): string {
  if (n === 0) return "0 kcal";
  const sign = n > 0 ? "+" : "−"; // unicode minus
  return `${sign}${Math.abs(Math.round(n))} kcal`;
}

function formatSignedKg(n: number): string {
  if (n === 0) return "0.0 kg";
  const sign = n > 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toFixed(1)} kg`;
}

/**
 * Build the display content for the modal. Pure — caller is responsible
 * for assembling inputs from the profile + journal + weight series.
 */
export function buildWeeklyCheckinContent(
  input: WeeklyCheckinContentInput,
): WeeklyCheckinContent {
  const {
    adaptiveTdee,
    priorTdee,
    currentTargetKcal,
    avgCaloriesThisWeek,
    weightDeltaKg,
  } = input;

  const tdeeDeltaKcal =
    priorTdee != null && Number.isFinite(priorTdee)
      ? Math.round(adaptiveTdee - priorTdee)
      : null;

  const suggestedTargetKcal = (() => {
    if (tdeeDeltaKcal == null) {
      return Math.max(MIN_SUGGESTED_TARGET_KCAL, Math.round(currentTargetKcal));
    }
    const raw = Math.round(currentTargetKcal + tdeeDeltaKcal);
    return Math.max(MIN_SUGGESTED_TARGET_KCAL, raw);
  })();

  const headline = "Your weekly check-in is ready";

  const whyLine = (() => {
    if (tdeeDeltaKcal == null) {
      return `Your real burn this week is ${Math.round(adaptiveTdee).toLocaleString("en-GB")} kcal a day.`;
    }
    if (tdeeDeltaKcal === 0) {
      return "Your real burn held steady this week.";
    }
    const direction = tdeeDeltaKcal > 0 ? "higher" : "lower";
    return `Your real burn is ${formatSignedKcal(tdeeDeltaKcal)} ${direction} than the formula.`;
  })();

  const avgThisWeekLabel = `${Math.round(avgCaloriesThisWeek).toLocaleString("en-GB")} kcal/day`;

  const weightDeltaLabel =
    weightDeltaKg == null ? null : formatSignedKg(weightDeltaKg);

  return {
    tdeeDeltaKcal,
    suggestedTargetKcal,
    headline,
    whyLine,
    avgThisWeekLabel,
    weightDeltaLabel,
  };
}

/** Stable type for the persisted decision. Keep in sync with the
 *  CHECK constraint on `profiles.last_weekly_checkin_decision`. */
export type WeeklyCheckinDecision = "accepted" | "kept_current" | "dismissed";
