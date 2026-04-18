/**
 * Mobile re-export of the shared streak-freeze helper.
 *
 * Lives here so `@/lib/streakFreeze` resolves through the existing
 * mobile alias without requiring a bundler config change. The logic is
 * fully owned by `src/lib/nutrition/streakFreeze.ts` — any divergence
 * would violate the parity rule in `.claude/CLAUDE.md`.
 */
export {
  availableFreezes,
  computeProtectedStreak,
  dropOldFreezesForMonth,
  earnFreezeIfMilestone,
  readFreezeLedger,
  type FreezeEarnedEntry,
  type FreezeLedger,
  type FreezeUsedEntry,
  type StreakByDay,
  type StreakMeal,
} from "../../../src/lib/nutrition/streakFreeze";
