/**
 * Weight win-moment landmark detection — shared web + mobile (ENG-824,
 * Redesign — Design Direction 2026, 2026-05-31 design-director review).
 *
 * The review's Progress scorecard rated Delight at the **Prototype** tier for
 * the Progress + weight surfaces: the weigh-in is a genuine landmark with zero
 * payoff today. The 3rd spine rule reserves ONE loud celebration for genuine
 * milestones. For weight, the genuine milestone is a **new low** — the user
 * just recorded their lowest weight ever (for a loss goal) — not every routine
 * weigh-in.
 *
 * This module is PURE and framework-free (same contract as
 * `winMomentLandmark.ts`): given the saved weight and the prior by-day map it
 * returns whether the save crossed a landmark, so web and mobile celebrate on
 * EXACTLY the same condition. The platform side-effects (success haptic on
 * mobile, colour pulse on web, the reserved `WinMomentPlayer`) live in the
 * callers, gated behind `redesign_winmoment`.
 *
 * Why "strictly lower than the prior minimum":
 *   - Re-saving today's weight (an edit that doesn't beat the prior low) is not
 *     a landmark — it must not re-fire.
 *   - The FIRST ever weigh-in is not a "new low" (there's no prior baseline to
 *     beat); it's the start of the series, not a milestone. A loud celebration
 *     on the very first save would cheapen the reserved moment.
 *   - A tiny epsilon guards float dither so 80.00 → 79.999999 from a unit
 *     round-trip doesn't spuriously celebrate.
 */

/** Minimum kg a save must beat the prior low by to count as a new low. Guards
 *  float round-trip dither (kg↔lb) from spuriously firing. */
export const NEW_LOW_EPSILON_KG = 0.05;

export interface WeightWinMomentArgs {
  /** The weight (kg) that was just saved. */
  savedKg: number;
  /**
   * The by-day weight map as it was BEFORE this save (date key → kg). The
   * just-saved entry must NOT be present (or, if it is, it is the value being
   * overwritten) — pass the pre-save snapshot so an edit of an existing entry
   * is judged against the OTHER days, not against itself.
   */
  priorByDay: Record<string, number>;
  /**
   * The date key being written. Excluded from the prior-minimum so editing
   * today's already-logged weight downward is judged against the rest of
   * history, never against the stale value it's replacing.
   */
  targetDateKey: string;
}

/**
 * The lowest positive, finite weight among the prior entries, excluding the
 * date key being written. `null` when there is no prior baseline (first ever
 * weigh-in, or only the edited day had a value).
 */
export function priorLowestKg(
  priorByDay: Record<string, number>,
  excludeDateKey: string,
): number | null {
  let lowest: number | null = null;
  for (const [k, v] of Object.entries(priorByDay)) {
    if (k === excludeDateKey) continue;
    if (!Number.isFinite(v) || v <= 0) continue;
    if (lowest === null || v < lowest) lowest = v;
  }
  return lowest;
}

/**
 * `true` when `savedKg` is a new all-time low — strictly below the prior
 * minimum (by at least `NEW_LOW_EPSILON_KG`) and there IS a prior minimum to
 * beat. The first ever weigh-in returns `false` (no baseline = not a
 * milestone).
 */
export function isNewWeightLow({
  savedKg,
  priorByDay,
  targetDateKey,
}: WeightWinMomentArgs): boolean {
  if (!Number.isFinite(savedKg) || savedKg <= 0) return false;
  const prior = priorLowestKg(priorByDay, targetDateKey);
  if (prior === null) return false;
  return savedKg < prior - NEW_LOW_EPSILON_KG;
}
