import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  planDayCalendarDate,
  planDayCalendarDateKey,
} from "../../src/lib/mealPlan/planCalendarAnchor";

describe("ENG-1132 — planDayCalendarDateKey", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 24, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses persisted start_date + plan day number (not live startOffset)", () => {
    expect(
      planDayCalendarDateKey({
        planDayNumber: 1,
        startDate: "2026-05-01",
        legacyDayIdx: 0,
        legacyStartOffset: 0,
      }),
    ).toBe("2026-05-01");
    expect(
      planDayCalendarDateKey({
        planDayNumber: 3,
        startDate: "2026-05-01",
        legacyDayIdx: 2,
        legacyStartOffset: 0,
      }),
    ).toBe("2026-05-03");
  });

  it("next-week plan day 1 is NOT today when anchor is next week", () => {
    const key = planDayCalendarDateKey({
      planDayNumber: 1,
      startDate: "2026-05-01",
      legacyDayIdx: 0,
      legacyStartOffset: 0,
    });
    expect(key).not.toBe("2026-04-24");
    expect(key).toBe("2026-05-01");
  });

  it("falls back to legacy offset when start_date is missing", () => {
    expect(
      planDayCalendarDateKey({
        planDayNumber: 2,
        startDate: null,
        legacyDayIdx: 1,
        legacyStartOffset: 0,
      }),
    ).toBe("2026-04-25");
  });

  it("planDayCalendarDate returns local midnight Date", () => {
    const d = planDayCalendarDate({
      planDayNumber: 2,
      startDate: "2026-05-01",
    });
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(2);
  });
});
