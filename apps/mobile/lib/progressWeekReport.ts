/**
 * Mobile re-export of the shared week-report helper.
 *
 * The helper is generic on `MealMacros` (calories/protein/carbs/fat), so
 * mobile can call it with the `JournalMeal` shape and web can call it with
 * `LoggedMeal` without any duplication of logic.
 */
export {
  buildWeekStats,
  formatAvgCaloriesLabel,
  formatMacroAdherenceBar,
  getStreakContributingDays,
  MACRO_ADHERENCE_BAR_CAP_PCT,
  type ByDayOf,
  type MacroAdherenceBar,
  type MealMacros,
  type WeekActivityAdjustment,
  type WeekDayTotals,
  type WeekStatsBundle,
} from "@suppr/nutrition-core/progressWeekReport";
