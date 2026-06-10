/**
 * DC12 (2026-05-14, premium-bar audit microcopy sweep).
 *
 * Pins the visibility rules for the Today "missed yesterday"
 * supportive banner. Same rule shipped on mobile + web; the helper
 * lives in `src/lib/nutrition/missedYesterday.ts`, used by both
 * `apps/mobile/app/(tabs)/index.tsx` and
 * `src/app/components/NutritionTracker.tsx`.
 *
 * F-07 (2026-06-05): Banner retired — always hidden; copy export kept
 * for wiring tests and a possible future narrower variant.
 */
import { describe, expect, it } from "vitest";

import {
  MISSED_YESTERDAY_COPY,
  shouldShowMissedYesterday,
} from "../../src/lib/nutrition/missedYesterday";

const TUE = 2;
const MON = 1;
const SUN = 0;

const okBase = {
  isToday: true,
  hasAnyJournalHistory: true,
  mealsYesterdayCount: 0,
  mealsTodayCount: 2,
  todayDayOfWeek: TUE,
  weekStartDay: "monday" as const,
};

describe("shouldShowMissedYesterday (DC12, F-07 retired)", () => {
  it("never shows — banner retired (F-07)", () => {
    expect(shouldShowMissedYesterday(okBase)).toBe(false);
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

  it("hides on an empty today (ENG-872 Fresh start chip)", () => {
    expect(
      shouldShowMissedYesterday({ ...okBase, mealsTodayCount: 0 }),
    ).toBe(false);
  });

  it("hides when today has meals (F-07 — user already logging)", () => {
    expect(
      shouldShowMissedYesterday({ ...okBase, mealsTodayCount: 3 }),
    ).toBe(false);
  });

  it("hides when yesterday had at least one meal logged", () => {
    expect(
      shouldShowMissedYesterday({ ...okBase, mealsYesterdayCount: 1 }),
    ).toBe(false);
  });

  it("hides on Monday for Monday-start users", () => {
    expect(
      shouldShowMissedYesterday({
        ...okBase,
        todayDayOfWeek: MON,
        weekStartDay: "monday",
      }),
    ).toBe(false);
  });

  it("hides on Sunday for Sunday-start users", () => {
    expect(
      shouldShowMissedYesterday({
        ...okBase,
        todayDayOfWeek: SUN,
        weekStartDay: "sunday",
      }),
    ).toBe(false);
  });

  it("exports the canonical copy string used by both mobile + web", () => {
    expect(MISSED_YESTERDAY_COPY).toBe(
      "Yesterday's gone — today's a fresh start.",
    );
  });
});
