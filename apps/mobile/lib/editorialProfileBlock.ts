/**
 * Mobile re-export of the shared editorial-profile block logic (ENG-1246).
 *
 * Single source of truth lives in `src/lib/profile/editorialProfileBlock.ts`;
 * mobile imports through the existing `@suppr/shared/*` alias so the streak-dot
 * math, best/freezes line, and milestones list can't drift from web.
 */
export {
  STREAK_DOT_WINDOW,
  buildEditorialProfileBlock,
  buildProfileMilestones,
  buildStreakDots,
  computeBestStreak,
  type EditorialProfileBlockInput,
  type EditorialProfileBlockModel,
  type ProfileMilestone,
  type StreakDot,
  type StreakDotState,
} from "@suppr/shared/profile/editorialProfileBlock";
