/**
 * DC12 (2026-05-14, premium-bar audit) — pure rule for the Today
 * "missed yesterday" supportive banner. Same logic on mobile
 * (`apps/mobile/app/(tabs)/index.tsx`) and web
 * (`src/app/components/NutritionTracker.tsx`); extracted here so
 * the rule has a single regression home and isn't reimplemented
 * twice with two subtly different gate sets.
 *
 * The banner is calm and supportive — no CTA, no destructive
 * tone — so the rule errs on the side of NOT showing rather than
 * showing in an awkward state.
 */

export type WeekStartDay = "monday" | "sunday";

export interface ShouldShowMissedYesterdayInput {
  /** Selected day === today on the user's current view. */
  isToday: boolean;
  /** True iff the user has ever logged a meal (any day, any slot). */
  hasAnyJournalHistory: boolean;
  /** Number of meals the user logged on yesterday's date key. */
  mealsYesterdayCount: number;
  /** Meals logged today — when zero the hero chip already reads "Fresh start"
   *  (ENG-872: drop the redundant missed-yesterday banner). */
  mealsTodayCount: number;
  /** 0=Sun … 6=Sat — today's day-of-week. */
  todayDayOfWeek: number;
  /** Profile's `week_start_day` preference. */
  weekStartDay: WeekStartDay;
}

/**
 * Visibility rules — all must hold:
 *  1. User is on today's view (selecting a past day is itself a
 *     catch-up, not a miss).
 *  2. User has previously logged something at some point
 *     (`hasAnyJournalHistory`) — brand-new accounts get the
 *     first-meal empty state, not this.
 *  3. Yesterday's meal count is exactly zero.
 *  4. (Retired F-07, 2026-06-05) Banner no longer shown — redundant when
 *     today is empty (ENG-872 Fresh start chip) or when today has meals
 *     (user is already logging again).
 *  5. Today is not the first day of a fresh week (Mon for
 *     Monday-start users, Sun for Sunday-start users) — a week
 *     boundary already reads as a reset, and Sundays / Mondays
 *     already carry the weekly-checkin nudge.
 */
export function shouldShowMissedYesterday(
  input: ShouldShowMissedYesterdayInput,
): boolean {
  if (!input.isToday) return false;
  if (!input.hasAnyJournalHistory) return false;
  if (input.mealsYesterdayCount !== 0) return false;
  // ENG-872 + F-07: never show — empty today uses Fresh start; populated
  // today means the user is already back on track.
  void input.mealsTodayCount;
  void input.todayDayOfWeek;
  void input.weekStartDay;
  return false;
}

/** Canonical copy — pinned by `missedYesterday.test.ts`. */
export const MISSED_YESTERDAY_COPY = "Yesterday's gone — today's a fresh start.";
