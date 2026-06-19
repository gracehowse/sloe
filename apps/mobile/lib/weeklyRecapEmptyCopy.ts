/**
 * Mobile re-export of the shared weekly-recap empty-copy helper. Pure +
 * platform-agnostic — see `src/lib/nutrition/weeklyRecapEmptyCopy.ts`
 * for the history-aware copy matrix.
 */
export {
  CHECKIN_FIRST_WEEK_COLD_START,
  buildWeeklyRecapEmptyCopy,
  resolveCheckinFirstWeekHeadline,
  type WeeklyRecapEmptyCopy,
  type WeeklyRecapEmptyCopyOpts,
} from "@suppr/nutrition-core/weeklyRecapEmptyCopy";
