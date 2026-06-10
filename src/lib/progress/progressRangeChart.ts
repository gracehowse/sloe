/**
 * Progress-tab weight-chart wiring helpers — pure functions, no React,
 * no platform APIs. Shared so the mobile Progress weight card
 * (`apps/mobile/app/(tabs)/progress.tsx`) and the web ProgressDashboard
 * can map the page's range picker to the canonical `WeightChart` range
 * and tone the "this week" delta identically.
 *
 * Created 2026-06-10 (premium-audit P0-1): the mobile Progress weight
 * card hardcoded the chart at `"1m"` while the top range picker drove
 * every other stat — a broken affordance. This helper makes the picker
 * key the single source for the chart range too, so 7d/30d/90d/All move
 * the chart in lockstep with the stat row. Web already wired the same
 * mapping inline (ProgressDashboard `weightTrendRange`); this extracts
 * it so both platforms read from one tested function.
 */

import type { WeightRange } from "./weightTrend";

/** The Progress-tab range-picker key (`progress.tsx` `rangeKey`). */
export type ProgressRangeKey = "7d" | "30d" | "90d" | "all";

/**
 * Map the Progress-tab range picker to the `WeightChart`/`computeWeightTrend`
 * range union. The chart's bucket strategy keys off this:
 *   7d  → 1w  (daily points)
 *   30d → 1m  (daily points)
 *   90d → 3m  (weekly buckets)
 *   all → all (monthly buckets)
 *
 * 60-/90-day windows beyond 3 months aren't separate picker options on
 * Progress, so there's no 6m/9m/1y case here — `all` covers the long tail.
 */
export function progressRangeKeyToWeightRange(rangeKey: ProgressRangeKey): WeightRange {
  switch (rangeKey) {
    case "7d":
      return "1w";
    case "30d":
      return "1m";
    case "90d":
      return "3m";
    case "all":
      return "all";
  }
}

/**
 * Semantic tone for a signed weight delta, relative to the user's goal.
 * Ported from the inline logic in `weight-tracker.tsx` (F-31, TestFlight
 * `AGOlc2wi1UZD`): a user with a loss goal who saw "↑ 0.9 kg" in neutral
 * text read it as fine. The direction arrow stays factual/uncoloured
 * (anti-shame brand rule); only the magnitude number picks up a tone.
 *
 *   - `progress` — the movement is *toward* the goal (sage/success)
 *   - `regress`  — the movement is *away* from the goal (textSecondary/warning)
 *   - `neutral`  — no goal, or movement too small to read as either
 *
 * `deltaKg` is signed: negative = lost, positive = gained over the window.
 * `firstKg` is the earliest weight in the window (the baseline the goal
 * direction is measured against). `goalKg` may be null (no goal set).
 *
 * The 0.05 kg floor matches the weight-tracker delta-rendering threshold
 * so a sub-50 g jitter never tints.
 */
export function weightDeltaTone(
  deltaKg: number,
  firstKg: number,
  goalKg: number | null,
): "progress" | "regress" | "neutral" {
  if (
    goalKg == null ||
    !Number.isFinite(deltaKg) ||
    !Number.isFinite(firstKg) ||
    Math.abs(deltaKg) < 0.05
  ) {
    return "neutral";
  }
  // + means the user wants to gain (goal above baseline), − means lose.
  const goalDelta = goalKg - firstKg;
  if (Math.abs(goalDelta) < 0.05) return "neutral";
  const movingToward = Math.sign(deltaKg) === Math.sign(goalDelta);
  return movingToward ? "progress" : "regress";
}
