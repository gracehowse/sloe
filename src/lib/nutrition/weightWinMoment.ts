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

/* ────────────────────────────────────────────────────────────────────────
 * ENG-952 — named-milestone breakdown + the QUIETER second celebration tier.
 *
 * Happy Scale divides every goal into 10 equal milestones and reports users
 * stay motivated because it "quiets thoughts about how much further you need
 * to go" — focus shifts to "just one milestone away". It uses two celebration
 * tiers: a small one for a daily win, a larger one for a milestone.
 *
 * Suppr already reserves the LOUD tier for a new all-time low (`isNewWeightLow`
 * → `WinMomentPlayer celebration="goal-hit"`). This adds the QUIETER second
 * tier: when a save crosses one of the 10 milestone thresholds between the
 * journey's start weight and the goal weight, the caller fires a restrained
 * celebration. Body-neutral, calm — never confetti-spam, never a "you missed"
 * inverse (per the no-diet-culture rule).
 *
 * Pure + framework-free, same contract as the rest of this module: web and
 * mobile compute milestones on EXACTLY the same thresholds so they celebrate
 * on identical conditions.
 * ──────────────────────────────────────────────────────────────────────── */

/** Number of milestones a goal is divided into (Happy Scale parity). */
export const MILESTONE_COUNT = 10;

/**
 * The minimum total span (kg) between start and goal for a milestone breakdown
 * to be meaningful. Below this a single 10th-of-a-span step is sub-noise
 * (< ~0.1 kg per milestone) so we suppress the breakdown rather than fire a
 * celebration on float dither. 1 kg ÷ 10 = 0.1 kg/milestone is the floor.
 */
export const MILESTONE_MIN_SPAN_KG = 1;

export interface WeightMilestoneArgs {
  /** The weight (kg) that was just saved. */
  savedKg: number;
  /**
   * The by-day weight map as it was BEFORE this save. Used to derive the
   * weight at the most recent prior weigh-in (the "from" point the crossing is
   * measured against) and the journey start weight.
   */
  priorByDay: Record<string, number>;
  /** The date key being written (excluded from the "prior latest" lookup). */
  targetDateKey: string;
  /**
   * The user's goal weight (kg). `null` when no goal is set — milestones are
   * undefined without a target, so crossings never fire.
   */
  goalKg: number | null;
  /**
   * Optional explicit journey start weight (kg) — the user's onboarding /
   * profile starting weight. When omitted, the EARLIEST prior weigh-in is used
   * as the start anchor. Milestones are evenly spaced from start → goal.
   */
  startKg?: number | null;
}

export interface WeightMilestoneResult {
  /**
   * The 10 milestone target weights (kg), ordered start → goal. Empty when a
   * breakdown isn't meaningful (no goal, span below `MILESTONE_MIN_SPAN_KG`,
   * or no start anchor). `thresholds[MILESTONE_COUNT - 1]` is the goal itself.
   */
  thresholds: number[];
  /**
   * How many of the 10 milestones the `savedKg` has reached, 0–10. 10 = goal
   * reached. 0 = not yet past the first milestone. Always 0 when `thresholds`
   * is empty.
   */
  reachedIndex: number;
  /**
   * `true` when this save CROSSED into a new milestone band the most recent
   * prior weigh-in had not reached — i.e. it advanced `reachedIndex`. This is
   * the trigger for the quieter celebration tier. `false` for the goal
   * milestone itself (index 10) so the milestone tier never competes with the
   * goal-reached moment, and `false` when there is no prior weigh-in (the
   * first ever save establishes the baseline, it doesn't "cross").
   */
  crossedMilestone: boolean;
  /**
   * The 1-based ordinal of the milestone just crossed (1–9), or `null` when
   * `crossedMilestone` is false. Drives the celebration copy ("Milestone 4 of
   * 10"). Excludes the goal (10) by the same reasoning as `crossedMilestone`.
   */
  crossedOrdinal: number | null;
}

const EMPTY_MILESTONE: WeightMilestoneResult = {
  thresholds: [],
  reachedIndex: 0,
  crossedMilestone: false,
  crossedOrdinal: null,
};

/** The most recent (highest date key) prior weigh-in value, excluding the
 *  date being written. `null` when there is no prior weigh-in. */
function priorLatestKg(
  priorByDay: Record<string, number>,
  excludeDateKey: string,
): number | null {
  let latestKey: string | null = null;
  let latestVal: number | null = null;
  for (const [k, v] of Object.entries(priorByDay)) {
    if (k === excludeDateKey) continue;
    if (!Number.isFinite(v) || v <= 0) continue;
    if (latestKey === null || k > latestKey) {
      latestKey = k;
      latestVal = v;
    }
  }
  return latestVal;
}

/** The earliest (lowest date key) prior weigh-in value. `null` when empty. */
function earliestKg(byDay: Record<string, number>): number | null {
  let earliestKey: string | null = null;
  let earliestVal: number | null = null;
  for (const [k, v] of Object.entries(byDay)) {
    if (!Number.isFinite(v) || v <= 0) continue;
    if (earliestKey === null || k < earliestKey) {
      earliestKey = k;
      earliestVal = v;
    }
  }
  return earliestVal;
}

/**
 * How many of the 10 milestones a weight has reached given the start anchor +
 * goal direction. Direction-aware: for a LOSS goal (goal < start) progress is
 * downward; for a GAIN goal (goal > start) progress is upward. Clamped 0–10.
 */
function reachedFor(weightKg: number, startKg: number, goalKg: number): number {
  const span = goalKg - startKg; // signed: negative = loss, positive = gain
  if (span === 0) return MILESTONE_COUNT;
  const progressed = (weightKg - startKg) / span; // 0 at start, 1 at goal
  const reached = Math.floor(progressed * MILESTONE_COUNT);
  return Math.max(0, Math.min(MILESTONE_COUNT, reached));
}

/**
 * Compute the milestone breakdown for a save. The thresholds are 10 evenly
 * spaced weights from the journey start to the goal; `crossedMilestone` is
 * `true` when this save advanced the reached-milestone index past where the
 * most recent prior weigh-in sat (the quieter celebration trigger).
 *
 * Returns the empty breakdown (no thresholds, nothing crossed) when a goal /
 * start anchor is missing or the start→goal span is below the meaningful floor
 * — milestones are undefined in those cases and must never fire a celebration.
 */
export function computeWeightMilestone({
  savedKg,
  priorByDay,
  targetDateKey,
  goalKg,
  startKg,
}: WeightMilestoneArgs): WeightMilestoneResult {
  if (!Number.isFinite(savedKg) || savedKg <= 0) return EMPTY_MILESTONE;
  if (goalKg == null || !Number.isFinite(goalKg) || goalKg <= 0) {
    return EMPTY_MILESTONE;
  }
  // Start anchor: explicit profile start weight, else the earliest weigh-in.
  const anchor =
    startKg != null && Number.isFinite(startKg) && startKg > 0
      ? startKg
      : earliestKg(priorByDay);
  if (anchor == null) return EMPTY_MILESTONE;
  const span = Math.abs(goalKg - anchor);
  if (span < MILESTONE_MIN_SPAN_KG) return EMPTY_MILESTONE;

  const step = (goalKg - anchor) / MILESTONE_COUNT; // signed
  const thresholds: number[] = [];
  for (let i = 1; i <= MILESTONE_COUNT; i++) {
    thresholds.push(Math.round((anchor + step * i) * 100) / 100);
  }

  const reachedIndex = reachedFor(savedKg, anchor, goalKg);

  // Crossing is measured against the most recent prior weigh-in. The first
  // ever save (no prior) establishes the baseline — it doesn't "cross".
  const prevLatest = priorLatestKg(priorByDay, targetDateKey);
  const prevReached =
    prevLatest != null ? reachedFor(prevLatest, anchor, goalKg) : null;

  // Crossed iff we advanced into a NEW milestone band, and it's not the goal
  // milestone (index 10) — that moment is owned by the goal-reached surface,
  // not the quiet milestone tier.
  const crossedMilestone =
    prevReached != null &&
    reachedIndex > prevReached &&
    reachedIndex < MILESTONE_COUNT;

  return {
    thresholds,
    reachedIndex,
    crossedMilestone,
    // Ordinal = the highest band reached on this crossing (1–9).
    crossedOrdinal: crossedMilestone ? reachedIndex : null,
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * Shared celebration-tier resolution.
 *
 * Web (`ProgressDashboard`) and mobile (`LogWeightSheet`) made the SAME
 * decision inline: detect the loud new-all-time-low first, then — only when
 * the save is NOT a new low — detect the quieter milestone crossing, each
 * behind its own flag. Two copies of the same precedence rule is exactly the
 * "make them identical or document the difference" failure mode, so the
 * decision lives here once: both surfaces resolve the tier on identical
 * conditions, and the callers only own the platform side-effect (haptic,
 * pulse, player).
 * ──────────────────────────────────────────────────────────────────────── */

/** Which celebration a weight save earned. `new-low` is the loud reserved
 *  landmark; `milestone` is the quieter tier; `none` is the silent save. */
export type WeightSaveCelebrationTier = "new-low" | "milestone" | "none";

export interface WeightSaveCelebrationArgs {
  /** The weight (kg) that was just saved. */
  savedKg: number;
  /** The by-day weight map BEFORE this save (excludes / overwrites the target). */
  priorByDay: Record<string, number>;
  /** The date key being written. */
  targetDateKey: string;
  /** The user's goal weight (kg), or null when none is set. */
  goalKg: number | null;
  /** `redesign_winmoment` flag state — gates the loud new-low tier. */
  winMomentEnabled: boolean;
  /** `progress_milestone_celebration_v1` flag state — gates the quiet tier. */
  milestoneEnabled: boolean;
  /** Optional explicit journey start weight for the milestone breakdown. */
  startKg?: number | null;
}

export interface WeightSaveCelebrationResult {
  tier: WeightSaveCelebrationTier;
  /** `true` when the save is a new all-time low (the loud tier). */
  isNewLow: boolean;
  /** The crossed milestone ordinal (1–9) when `tier === "milestone"`, else null. */
  milestoneOrdinal: number | null;
}

/**
 * Resolve which celebration tier a weight save earns, honouring the precedence
 * the loud new-low owns over the quiet milestone (they never double-fire). Pure
 * — the callers apply the platform side-effect for the returned tier.
 */
export function resolveWeightSaveCelebration({
  savedKg,
  priorByDay,
  targetDateKey,
  goalKg,
  winMomentEnabled,
  milestoneEnabled,
  startKg,
}: WeightSaveCelebrationArgs): WeightSaveCelebrationResult {
  const isNewLow =
    winMomentEnabled &&
    isNewWeightLow({ savedKg, priorByDay, targetDateKey });
  if (isNewLow) {
    return { tier: "new-low", isNewLow: true, milestoneOrdinal: null };
  }
  if (milestoneEnabled) {
    const m = computeWeightMilestone({
      savedKg,
      priorByDay,
      targetDateKey,
      goalKg,
      startKg,
    });
    if (m.crossedMilestone && m.crossedOrdinal != null) {
      return { tier: "milestone", isNewLow: false, milestoneOrdinal: m.crossedOrdinal };
    }
  }
  return { tier: "none", isNewLow: false, milestoneOrdinal: null };
}
