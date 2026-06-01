/**
 * Win-moment landmark detection — shared web + mobile (ENG-798, Redesign —
 * Design Direction 2026).
 *
 * The 2026-05-31 design-director review's 3rd spine rule: a dedicated
 * win-colour + **one reserved win-moment**, gated to landmarks only — never
 * every log. This module is the single, framework-free source of truth for
 * "is this state a landmark worth one reserved celebration?" so web and mobile
 * fire on EXACTLY the same conditions.
 *
 * Three landmark kinds, in priority order (only ONE celebration fires per
 * trigger, highest-priority wins):
 *   1. `streak`   — the protected logging streak just crossed a milestone
 *                   (3 / 7 / 30 / 100 days). The rarest + most meaningful.
 *   2. `goal-hit` — the calorie ring just closed at/under target for today
 *                   (consumed reached ≥ a "complete" share of the goal while
 *                   still ≤ goal). The daily payoff.
 *   3. `macro`    — a tracked macro target was just hit (reached ≥ target,
 *                   not wildly over). Maps to the `goal-hit` celebration
 *                   visual (there is no separate macro Lottie yet — ENG-798
 *                   content pass owns that split).
 *
 * The hooks (`use-win-moment` on mobile, `useWebWinMoment` on web) own the
 * once-per-calendar-day persistence + the flag gate + the haptic/Lottie/pulse
 * side-effects. This file is PURE: given before/after snapshots it returns
 * which (if any) landmark celebration to play. That keeps the gnarly
 * "fire exactly once, on the right edge" logic testable without a renderer.
 */

/**
 * Which reserved celebration a landmark maps to. Mirrors the
 * `WinMomentCelebration` union exported by both `WinMomentPlayer`
 * primitives — duplicated here (not imported) so this framework-free shared
 * module never reaches into a platform component tree (the web player path
 * doesn't resolve under the mobile `@suppr/shared` alias). Keep in lockstep
 * with `apps/mobile/components/ui/WinMomentPlayer.tsx` +
 * `src/app/components/ui/win-moment-player.tsx`.
 */
export type WinMomentCelebration = "goal-hit" | "streak" | "log-confirm";

/** Streak lengths that earn a reserved celebration. */
export const STREAK_MILESTONES = [3, 7, 30, 100] as const;

/**
 * The share of the calorie goal that counts as "closed the day at target".
 * We celebrate when the user reaches at least this fraction of their goal
 * WITHOUT going over — i.e. they landed the day in the green target band
 * rather than under-eating. 0.85 mirrors the "on track" band the hero ring
 * already uses (±10–15% around target reads as a hit, not a miss).
 */
export const GOAL_HIT_MIN_FRACTION = 0.85;

/** A macro counts as "hit" once consumption reaches this share of its target. */
export const MACRO_HIT_MIN_FRACTION = 1.0;

/** A macro is "blown past" (no celebration) above this share — eating 2× a
 *  macro target is not a win worth a reserved moment. */
export const MACRO_HIT_MAX_FRACTION = 1.5;

export interface WinMomentSnapshot {
  /** Calories consumed so far today. */
  consumed: number;
  /** Today's calorie goal. */
  goal: number;
  /** Current protected logging streak length (days). */
  streak: number;
  /**
   * Per-macro `{ current, target }` for the macros the user tracks. Only
   * macros present here are eligible for a macro landmark.
   */
  macros?: Record<string, { current: number; target: number }>;
}

/**
 * `true` when the calorie ring is in the "closed the day at/under target"
 * landmark band: consumed is at least `GOAL_HIT_MIN_FRACTION` of the goal and
 * not over the goal. A positive goal is required (no celebration before a
 * target exists).
 */
export function isGoalHit(consumed: number, goal: number): boolean {
  if (goal <= 0) return false;
  if (consumed > goal) return false;
  return consumed >= goal * GOAL_HIT_MIN_FRACTION;
}

/** The largest milestone in `STREAK_MILESTONES` that `streak` has reached,
 *  or `null` if it hasn't reached any. */
export function streakMilestoneFor(streak: number): number | null {
  let hit: number | null = null;
  for (const m of STREAK_MILESTONES) {
    if (streak >= m) hit = m;
  }
  return hit;
}

/** `true` when a tracked macro is inside its celebration band (hit target,
 *  not blown wildly past). */
function isMacroHit(current: number, target: number): boolean {
  if (target <= 0) return false;
  const frac = current / target;
  return frac >= MACRO_HIT_MIN_FRACTION && frac <= MACRO_HIT_MAX_FRACTION;
}

export interface LandmarkResult {
  /** Which celebration to play, mapped to a `WinMomentPlayer` source. */
  celebration: WinMomentCelebration;
  /** Coarse landmark kind for analytics (`goal-hit` celebration covers both
   *  the calorie close and a macro hit). */
  kind: "goal" | "streak" | "macro";
  /** Milestone value for streaks (e.g. 7), else `undefined`. */
  milestone?: number;
}

/**
 * Detect the reserved win-moment to fire on a transition from `before` to
 * `after`. Returns `null` when no landmark was *newly* crossed — the moment
 * fires on the rising edge only, never on a state that was already true.
 *
 * Priority: streak milestone > calorie goal-hit > macro hit. At most one
 * result so only one reserved celebration ever plays per trigger.
 *
 * Edge contract (why before/after rather than just `after`):
 *   - A streak that was ALREADY at 7 yesterday must not re-fire today.
 *   - A goal that was ALREADY hit must not re-fire on every subsequent log.
 *   - Crossing a milestone boundary (was 6 → now 7) is the only thing that
 *     fires. The once-per-day persistence in the hooks is a second guard on
 *     top of this rising-edge check.
 */
export function detectWinMoment(
  before: WinMomentSnapshot,
  after: WinMomentSnapshot,
): LandmarkResult | null {
  // 1. Streak milestone — fire when the milestone the streak now satisfies is
  //    strictly higher than the one it satisfied before.
  const beforeMilestone = streakMilestoneFor(before.streak);
  const afterMilestone = streakMilestoneFor(after.streak);
  if (afterMilestone != null && afterMilestone !== beforeMilestone) {
    return { celebration: "streak", kind: "streak", milestone: afterMilestone };
  }

  // 2. Calorie goal-hit — fire on the rising edge into the target band.
  const wasGoalHit = isGoalHit(before.consumed, before.goal);
  const nowGoalHit = isGoalHit(after.consumed, after.goal);
  if (nowGoalHit && !wasGoalHit) {
    return { celebration: "goal-hit", kind: "goal" };
  }

  // 3. Macro hit — fire when any tracked macro newly entered its hit band.
  if (after.macros) {
    for (const [macro, a] of Object.entries(after.macros)) {
      const b = before.macros?.[macro];
      const wasHit = b ? isMacroHit(b.current, b.target) : false;
      const nowHit = isMacroHit(a.current, a.target);
      if (nowHit && !wasHit) {
        // No dedicated macro Lottie yet — reuse the goal-hit celebration
        // visual (ENG-798 content pass owns the macro-specific asset).
        return { celebration: "goal-hit", kind: "macro" };
      }
    }
  }

  return null;
}
