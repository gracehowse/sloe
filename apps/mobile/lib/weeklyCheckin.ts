/**
 * Mobile re-export of the shared weekly check-in helper.
 *
 * The check-in card on the Weekly Recap screen + the Today Sunday
 * banner both pull from the shared module so web + mobile produce
 * identical copy from identical inputs.
 */
export {
  buildWeeklyCheckin,
  buildWhyLine,
  formatKcal,
  formatTdeeDelta,
  MIN_WEIGHT_DATAPOINTS_FOR_CONFIDENCE,
  TDEE_NOISE_FLOOR_KCAL,
  type WeeklyCheckin,
  type WeeklyCheckinDirection,
  type WeeklyCheckinInput,
  type WeeklyCheckinKind,
} from "../../../src/lib/nutrition/weeklyCheckin";
