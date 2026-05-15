/**
 * DC12 (2026-05-14, premium-bar audit microcopy sweep).
 *
 * Pins the visibility rules for the Today "missed yesterday"
 * supportive banner. Same rule shipped on mobile + web; the helper
 * lives in `src/lib/nutrition/missedYesterday.ts`, used by both
 * `apps/mobile/app/(tabs)/index.tsx` and
 * `src/app/components/NutritionTracker.tsx`.
 *
 * The banner is calm and supportive — no CTA, no destructive
 * tone — so the rules err on the side of NOT showing rather than
 * showing in awkward states (past-day view, brand-new account,
 * week boundary, etc.).
 */
import { describe, expect, it } from "vitest";

import {
  MISSED_YESTERDAY_COPY,
  shouldShowMissedYesterday,
} from "../../src/lib/nutrition/missedYesterday";

// Tuesday is the canonical "boring midweek day" — neither
// Mon (Monday-start first-day-of-week) nor Sun (Sunday-start
// first-day-of-week), so it passes the week-boundary gate for
// both prefs.
const TUE = 2;
const MON = 1;
const SUN = 0;

const okBase = {
  isToday: true,
  hasAnyJournalHistory: true,
  mealsYesterdayCount: 0,
  todayDayOfWeek: TUE,
  weekStartDay: "monday" as const,
};

describe("shouldShowMissedYesterday (DC12)", () => {
  it("shows on a midweek day when prior history exists and yesterday is empty", () => {
    expect(shouldShowMissedYesterday(okBase)).toBe(true);
  });

  it("hides when the user is viewing a past day (not isToday)", () => {
    expect(
      shouldShowMissedYesterday({ ...okBase, isToday: false }),
    ).toBe(false);
  });

  it("hides for brand-new accounts with no journal history", () => {
    expect(
      shouldShowMissedYesterday({
        ...okBase,
        hasAnyJournalHistory: false,
      }),
    ).toBe(false);
  });

  it("hides when yesterday had at least one meal logged", () => {
    expect(
      shouldShowMissedYesterday({ ...okBase, mealsYesterdayCount: 1 }),
    ).toBe(false);
    expect(
      shouldShowMissedYesterday({ ...okBase, mealsYesterdayCount: 5 }),
    ).toBe(false);
  });

  it("hides on Monday for Monday-start users (first day of fresh week)", () => {
    expect(
      shouldShowMissedYesterday({
        ...okBase,
        todayDayOfWeek: MON,
        weekStartDay: "monday",
      }),
    ).toBe(false);
  });

  it("shows on Monday for Sunday-start users (Monday is NOT week-1)", () => {
    expect(
      shouldShowMissedYesterday({
        ...okBase,
        todayDayOfWeek: MON,
        weekStartDay: "sunday",
      }),
    ).toBe(true);
  });

  it("hides on Sunday for Sunday-start users (first day of fresh week)", () => {
    expect(
      shouldShowMissedYesterday({
        ...okBase,
        todayDayOfWeek: SUN,
        weekStartDay: "sunday",
      }),
    ).toBe(false);
  });

  it("shows on Sunday for Monday-start users (Sunday is end-of-week)", () => {
    expect(
      shouldShowMissedYesterday({
        ...okBase,
        todayDayOfWeek: SUN,
        weekStartDay: "monday",
      }),
    ).toBe(true);
  });

  it("exports the canonical copy string used by both mobile + web", () => {
    expect(MISSED_YESTERDAY_COPY).toBe(
      "Yesterday's gone — today's a fresh start.",
    );
  });
});
