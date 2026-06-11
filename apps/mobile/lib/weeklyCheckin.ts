/**
 * Mobile re-export of the shared weekly check-in helper.
 *
 * The check-in card on the Weekly Recap screen + the Today Sunday
 * banner both pull from the shared module so web + mobile produce
 * identical copy from identical inputs.
 *
 * 2026-05-02 (PR claude/weekly-checkin-ritual-v2, rebuild of #26):
 * additionally re-exports the modal-ritual gate + content builder so
 * `WeeklyCheckinModal` and the Today wire-up share a single source of
 * truth with the web parity dialog.
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
  // Modal-ritual surface (rebuild of #26)
  buildWeeklyCheckinContent,
  shouldShowWeeklyCheckin,
  MIN_DAYS_LOGGED_FOR_CHECKIN,
  // ENG-1027 — sex-aware suggested-target floor.
  suggestedTargetFloorFor,
  type CheckinSex,
  type WeeklyCheckinConfidence,
  type WeeklyCheckinContent,
  type WeeklyCheckinContentInput,
  type WeeklyCheckinDecision,
  type WeeklyCheckinGateInput,
} from "@suppr/shared/nutrition/weeklyCheckin";
