/**
 * Weight Trend tile — shared helper for the Progress dashboard's "Trend"
 * stat tile (Action 13 Item #2, 2026-04-19).
 *
 * Bug history (web `ProgressDashboard.tsx`):
 *   - Two separate IIFEs computed the delta — one for the headline number
 *     and one for the sub-copy. They could (and did) drift.
 *   - The on-track sub-copy used `(weightKg ?? Infinity)` for cuts and
 *     `(weightKg ?? 0)` for gains, so a "gain" user with no weight logged
 *     was trivially declared "on track" because `Infinity > 0`.
 *
 * Fix: one pure helper computes both numbers from the same inputs and
 * returns `{ delta, copy }`. The render sites import the same helper.
 *
 * Pure: no React, no I/O. Lives in `src/lib/nutrition/` so the mobile
 * Trend tile (which currently has its own arithmetic) can adopt the
 * same helper without duplicating the on-track rule.
 *
 * ENG-1026 (2026-06-11): the on-track copy used to be judged on the
 * raw two-point delta (most-recent weigh-in vs the ~7-day-ago entry).
 * Raw scale weight swings 1–2 kg/day on water + glycogen alone, so a
 * single water blip — a salty dinner, a hard session, a bad night — could
 * flip "on track" to "this week" even when the underlying trend was
 * exactly on plan. Every trend app (MacroFactor, TrendWeight, Hacker's
 * Diet) judges the *smoothed* trend for precisely this reason. We now
 * fit a smoothed trend over every weigh-in in the window and judge
 * on-track from the trend's projected delta, while still SHOWING the raw
 * recent-vs-comparison delta as the headline number (that's the figure
 * the user recognises from their own scale). With only two weigh-ins the
 * latest reading is the only new signal — there's no surrounding context
 * to tell a blip from a real move — so we keep judging on the raw delta;
 * the smoothing only bites once a third (potentially noisy) weigh-in
 * lands and the window has structure to smooth.
 *
 * The smoother is the TrendWeight / Hacker's Diet model the audit cites:
 * interpolate the weigh-ins to a daily series (so a weekly weigher and a
 * daily weigher get the same smoothing per unit time — the #3 gap-fill),
 * then EMA at α=0.1 so each raw reading nudges the trend by ~10%. It is
 * imported from the shared `weightTrendSmoothing` module (React-Native-
 * safe, dependency-free) so the goal-date timeline (`calcGoalTimeline`,
 * ENG-1039) and this on-track tile smooth through the SAME code — they can
 * never disagree on whether a water blip moved the trend.
 *
 * Pinned by `tests/unit/weightTrendTile.test.ts`.
 */

import {
  MIN_WEIGH_INS_FOR_SMOOTHING,
  smoothedTrendByDate,
} from "./weightTrendSmoothing";

export type GoalDirection = "lose" | "gain" | "maintain";

export interface WeightTrendCopy {
  /**
   * Weight delta in kg (signed, rounded to 0.1) from the comparison
   * weigh-in to the most recent. `null` when we can't compute a delta:
   *   - fewer than 2 weigh-ins in `weightKgByDay`
   *   - latest weigh-in weight is non-finite
   *
   * The renderer is responsible for unit conversion (kg → lb) and sign
   * formatting; this helper stays unit-agnostic.
   */
  delta: number | null;
  /**
   * Sub-copy beneath the delta. One of:
   *   - "Log weight to see trend" — no recent weigh-ins or only one
   *   - "on track" — heading toward the goal (lose/down OR gain/up)
   *   - "this week" — has data but not on track for the goal direction
   *   - "no goal set" — weighing in but no `goalKg` to compare against
   */
  copy: string;
}

/**
 * Resolve the user's goal direction from `current` and `goal` weights,
 * unless an explicit `direction` was supplied. We never assume "lose" —
 * an unspecified direction with `goalKg < weightKg` reads as "lose";
 * with `goalKg > weightKg` it reads as "gain"; otherwise "maintain".
 */
function resolveDirection(
  weightKg: number | null | undefined,
  goalKg: number | null | undefined,
  explicit?: GoalDirection,
): GoalDirection | null {
  if (explicit) return explicit;
  if (
    typeof weightKg !== "number" ||
    !Number.isFinite(weightKg) ||
    typeof goalKg !== "number" ||
    !Number.isFinite(goalKg)
  ) {
    return null;
  }
  if (Math.abs(goalKg - weightKg) < 0.1) return "maintain";
  return goalKg < weightKg ? "lose" : "gain";
}

/**
 * Compute the {delta, copy} pair for the Trend tile.
 *
 * @param weightKgByDay  the user's weigh-in map (`YYYY-MM-DD` → kg)
 * @param weightKg       the user's current weight as known by their
 *                       profile. Only used to resolve the goal direction
 *                       when `direction` is omitted; never coerced into
 *                       an "on track" check.
 * @param goalKg         goal weight in kg, or `null` when none set
 * @param direction      explicit "lose"|"gain"|"maintain" override; when
 *                       missing, derived from `weightKg` vs `goalKg`
 * @param now            injectable clock for tests (defaults to
 *                       `new Date()`); resolves the "≥7 days ago" anchor
 */
export function computeWeightTrendCopy(opts: {
  weightKgByDay: Record<string, number>;
  weightKg: number | null | undefined;
  goalKg: number | null | undefined;
  direction?: GoalDirection;
  now?: Date;
}): WeightTrendCopy {
  const { weightKgByDay, weightKg, goalKg, direction, now } = opts;

  const sortedDescending = Object.entries(weightKgByDay)
    .filter(
      ([, v]) => typeof v === "number" && Number.isFinite(v),
    )
    .sort(([a], [b]) => b.localeCompare(a));

  if (sortedDescending.length < 2) {
    return { delta: null, copy: "Log weight to see trend" };
  }

  const recentKg = sortedDescending[0][1];
  const recentKey = sortedDescending[0][0];
  const nowD = now ?? new Date();
  const sevenDaysAgo = new Date(nowD);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffKey = `${sevenDaysAgo.getFullYear()}-${String(
    sevenDaysAgo.getMonth() + 1,
  ).padStart(2, "0")}-${String(sevenDaysAgo.getDate()).padStart(2, "0")}`;

  // F-56 (2026-04-22): if the most recent weigh-in itself is older than
  // 14 days, the delta is stale regardless of how many historical entries
  // exist. Suppressing the delta avoids the TestFlight complaint
  // "Up 0.9 this week is not correct as I have not logged weight in
  // about a month" — previously we were showing a month-old diff under
  // a "this week" label.
  const fourteenDaysAgo = new Date(nowD);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const staleCutoffKey = `${fourteenDaysAgo.getFullYear()}-${String(
    fourteenDaysAgo.getMonth() + 1,
  ).padStart(2, "0")}-${String(fourteenDaysAgo.getDate()).padStart(2, "0")}`;
  if (recentKey < staleCutoffKey) {
    return { delta: null, copy: "Log weight to see trend" };
  }

  // Comparison weigh-in: most recent entry whose date key is ≤ cutoff
  // (i.e. ≥7 days ago). When no entry sits that far back, fall back to
  // the oldest entry we have so we still produce a delta off real data
  // rather than fabricating one.
  const comparisonEntry =
    sortedDescending.find(([k]) => k <= cutoffKey) ??
    sortedDescending[sortedDescending.length - 1];
  const comparison = comparisonEntry[1];

  // Headline delta — the RAW recent-vs-comparison change the user
  // recognises from their own scale. Kept raw deliberately (the number
  // shown must match what they'd compute themselves); only the on-track
  // *judgment* below is smoothed. ENG-1026.
  const delta = Math.round((recentKg - comparison) * 10) / 10;

  const resolvedDirection = resolveDirection(weightKg, goalKg, direction);
  if (resolvedDirection == null) {
    // We have a delta but no goal to evaluate against. Don't guess
    // "on track" / "off track" — surface the delta as the headline and
    // a neutral hint underneath.
    return { delta, copy: "no goal set" };
  }

  // ENG-1026: judge on-track from the SMOOTHED trend, not the raw
  // two-point delta. Interpolate the window's weigh-ins to a daily series
  // and EMA-smooth it (TrendWeight / Hacker's Diet model), then difference
  // the smoothed trend at the recent date and the comparison date. A
  // single water blip on the most-recent reading only nudges the trend by
  // ~10%, so it no longer flips the verdict.
  const ascendingFromComparison = sortedDescending
    .filter(([k]) => k >= comparisonEntry[0])
    .slice()
    .reverse(); // oldest → newest
  // Smoothing needs ≥3 weigh-ins to tell a blip apart from a real move:
  // with only two readings, the latest IS the only new signal and there's
  // no surrounding context to damp it against — so we judge on the raw
  // delta (preserving the long-standing two-point behaviour). At ≥3
  // weigh-ins we EMA-smooth and difference the trend endpoints, so a lone
  // water spike can't flip the verdict.
  let trendDelta = delta;
  if (ascendingFromComparison.length >= MIN_WEIGH_INS_FOR_SMOOTHING) {
    const trendByDate = smoothedTrendByDate(ascendingFromComparison);
    const trendRecent = trendByDate.get(recentKey);
    const trendComparison = trendByDate.get(comparisonEntry[0]);
    if (trendRecent != null && trendComparison != null) {
      trendDelta = trendRecent - trendComparison;
    }
  }

  let onTrack = false;
  if (resolvedDirection === "lose") {
    onTrack = trendDelta < 0;
  } else if (resolvedDirection === "gain") {
    onTrack = trendDelta > 0;
  } else {
    // Maintenance — within 0.5 kg either side of the trend counts as on
    // track (the band stays on the smoothed signal, per the audit).
    onTrack = Math.abs(trendDelta) <= 0.5;
  }

  return {
    delta,
    copy: onTrack ? "on track" : "this week",
  };
}
