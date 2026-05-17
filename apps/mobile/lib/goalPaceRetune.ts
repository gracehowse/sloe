/**
 * Mobile re-export of the shared goal-pace re-tune helper.
 *
 * The re-tune sheet (mobile) + Settings → Targets flow (web) both
 * call `computeRetunedTargets` so the macro derivation cannot drift.
 */
export {
  computeRetunedTargets,
  dbGoalForOnboardingGoal,
  inferCurrentPace,
  onboardingGoalForDbGoal,
  paceLabel,
  RETUNE_PACE_PRESETS_KG_PER_WEEK,
  type GoalPaceRetuneInput,
  type GoalPaceRetuneResult,
  type RetunePace,
} from "@suppr/shared/nutrition/goalPaceRetune";
