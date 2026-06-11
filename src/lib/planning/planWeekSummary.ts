/**
 * planWeekSummary — compute "Hits your targets N of M days" + worst-short-day
 * diagnostic for a generated meal plan.
 *
 * Prototype port 2026-04-20 — see
 * `docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 * (PlanScreen "This week" card). Mirrors
 * `apps/mobile/app/(tabs)/planner.tsx`'s `summaryScore` memo so web + mobile
 * produce identical copy for the same plan/target input.
 *
 * Definitions:
 * - A day "hits" when its total calories are at or under target and
 *   within 10% below (ENG-1049 — over-budget days never count as a
 *   "hit", even inside the old symmetric ±10% band, so "7/7" can't
 *   read as a win while days ran hot).
 * - Worst-short day = the day with the largest negative gap (most
 *   calories *under* target). Days over target never appear here — the
 *   surface is a "pace floor" nudge, not a ceiling warning.
 *
 * Returns `null` when the plan is empty or the calorie target is unset —
 * callers must skip rendering the summary card in that case.
 */

export interface PlanSummaryDay {
  totals: { calories: number };
}

export interface PlanWeekSummaryScore {
  /** Days whose calorie total lands within ±`HIT_BAND` of target. */
  hits: number;
  /** Total days in the plan (1 / 3 / 7 all supported). */
  total: number;
  /** Day (zero-indexed) with the largest negative calorie gap, if any. */
  worstShort: { dayIndex: number; shortBy: number } | null;
}

/** ±10% tolerance — same rule mobile uses. */
export const PLAN_SUMMARY_HIT_BAND = 0.1;

export function computePlanWeekSummaryScore(
  plan: readonly PlanSummaryDay[] | null | undefined,
  targetCalories: number,
): PlanWeekSummaryScore | null {
  if (!plan || plan.length === 0) return null;
  if (!Number.isFinite(targetCalories) || targetCalories <= 0) return null;

  const tol = targetCalories * PLAN_SUMMARY_HIT_BAND;
  let hits = 0;
  let worstShort: { dayIndex: number; shortBy: number } | null = null;

  plan.forEach((day, idx) => {
    const raw = day?.totals?.calories;
    // NaN / non-finite day totals treat as 0 kcal: the user hasn't filled the
    // slot yet, so it's a maximally-short day (the point of the card is to
    // flag "fix this day"). `Number()` alone would propagate NaN into diff
    // and drop the entry from both hits and worstShort, which is worse.
    const total = Number.isFinite(raw) ? Number(raw) : 0;
    const diff = total - targetCalories;
    if (diff <= 0 && diff >= -tol) hits += 1;
    if (diff < 0) {
      const shortBy = -diff;
      if (!worstShort || shortBy > worstShort.shortBy) {
        worstShort = { dayIndex: idx, shortBy };
      }
    }
  });

  return { hits, total: plan.length, worstShort };
}

/**
 * Build the subtitle copy for the "This week" card.
 *
 * Three branches, mirrored from
 * `apps/mobile/app/(tabs)/planner.tsx` (1137-1146):
 *  1. All days hit → "All N days land on target."
 *  2. N < M and we identified a worst-short day → "Monday is ~180 kcal
 *     short. Add a snack or swap the dinner." (`dayLabel` is provided
 *     by the caller, which knows its own locale / week-start).
 *  3. N < M but no day was *under* target → days ran over; surface a
 *     generic nudge instead.
 */
export function buildPlanWeekSummarySubtitle(
  score: PlanWeekSummaryScore,
  worstShortDayLabel: string | null,
): string {
  if (score.hits === score.total) {
    return `All ${score.total} day${score.total === 1 ? "" : "s"} land on target.`;
  }
  if (score.worstShort && worstShortDayLabel) {
    const shortBy = Math.round(score.worstShort.shortBy);
    return `${worstShortDayLabel} is ~${shortBy} kcal short. Add a snack or swap the dinner.`;
  }
  return "Some days run over target. Tap a meal to swap or adjust the portion.";
}

/**
 * Tone of the "Hits your targets N of M days" headline (ENG-820 — Plan
 * win-moment, Redesign — Design Direction 2026).
 *
 * The headline is the single payoff line of the Plan tab: did the generated
 * week land on the user's calorie targets? Today it renders as inert flat
 * text. The design-director review asks it to become *state-aware* so the
 * landmark "every day lands on target" reads as a quiet win, while a week
 * that hasn't landed yet reads as calm progress (never alarming).
 *
 * Three tones, shared so web (`--accent-win` / muted) and mobile
 * (`Accent.win` / muted) colour the headline identically:
 *   - `'win'`      — every day lands on target (`hits === total`). The
 *                    landmark. Coloured with the reserved win token + a
 *                    success haptic + a brief pulse on the platform side.
 *   - `'calm'`     — no day lands on target yet (`hits === 0`). Muted /
 *                    secondary text — informative, not alarming.
 *   - `'progress'` — some-but-not-all days land (`0 < hits < total`).
 *                    The amber "getting there" state.
 *
 * Pure + total: the only input is the already-computed score, so web and
 * mobile can never drift on the threshold. Mirrors the calorie-ring rule
 * that "over-budget signals stay amber" — `progress` is amber, never red.
 */
export type PlanWeekHeadlineTone = "win" | "progress" | "calm";

export function planWeekHeadlineTone(
  score: PlanWeekSummaryScore | null | undefined,
): PlanWeekHeadlineTone {
  if (!score || score.total <= 0) return "calm";
  if (score.hits >= score.total) return "win";
  if (score.hits <= 0) return "calm";
  return "progress";
}
