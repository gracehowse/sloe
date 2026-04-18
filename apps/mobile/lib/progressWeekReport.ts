/**
 * Mobile re-export of the shared week-report helper.
 *
 * The helper is generic on `MealMacros` (calories/protein/carbs/fat), so
 * mobile can call it with the `JournalMeal` shape and web can call it with
 * `LoggedMeal` without any duplication of logic.
 */
export {
  buildWeekStats,
  getStreakContributingDays,
  type ByDayOf,
  type MealMacros,
  type WeekDayTotals,
  type WeekStatsBundle,
} from "../../../src/lib/nutrition/progressWeekReport";
