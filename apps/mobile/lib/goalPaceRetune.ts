/**
 * Mobile re-export of the shared goal-pace re-tune helper.
 *
 * The re-tune sheet (mobile) + Settings → Targets flow (web) both
 * call `computeRetunedTargets` so the macro derivation cannot drift.
 */
export {
  // Canonical target-recompute core (target-recompute unification,
  // 2026-05-26). computeRetunedTargets is a thin alias over it.
  deriveTargets,
  normaliseGoal,
  computeRetunedTargets,
  dbGoalForOnboardingGoal,
  inferCurrentPace,
  onboardingGoalForDbGoal,
  paceLabel,
  RETUNE_PACE_PRESETS_KG_PER_WEEK,
  type DeriveTargetsGoal,
  type DeriveTargetsInput,
  type DeriveTargetsResult,
  type GoalPaceRetuneInput,
  type GoalPaceRetuneResult,
  type RetunePace,
} from "@suppr/nutrition-core/goalPaceRetune";
