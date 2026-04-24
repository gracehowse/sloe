import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  findLegacyPlanDayForCalendarDate,
  findPlanDayIdForCalendarDate,
  planCalendarDateForIndex,
  stripMidnight,
} from "../../src/lib/mealPlan/planCalendarAnchor";

describe("planCalendarDateForIndex", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 24, 12, 0, 0)); // local 24 Apr 2026
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps idx+offset from local today", () => {
    const d0 = stripMidnight(planCalendarDateForIndex(0, 0));
    expect(d0.getFullYear()).toBe(2026);
    expect(d0.getMonth()).toBe(3);
    expect(d0.getDate()).toBe(24);
    const d1 = stripMidnight(planCalendarDateForIndex(1, 0));
    expect(d1.getDate()).toBe(25);
  });
});

describe("findPlanDayIdForCalendarDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 24, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches plan day 1 to today with offset 0", () => {
    const id = findPlanDayIdForCalendarDate([{ id: "row-a", day: 1 }], new Date(2026, 3, 24));
    expect(id).toBe("row-a");
  });

  it("matches plan day 2 to tomorrow with offset 0", () => {
    const id = findPlanDayIdForCalendarDate([{ id: "row-b", day: 2 }], new Date(2026, 3, 25));
    expect(id).toBe("row-b");
  });

  it("matches plan day 1 to today when plan was saved as next-week start (offset 7)", () => {
    const id = findPlanDayIdForCalendarDate([{ id: "row-c", day: 1 }], new Date(2026, 4, 1));
    expect(id).toBe("row-c");
  });

  it("returns null when no row covers the date", () => {
    const id = findPlanDayIdForCalendarDate([{ id: "row-d", day: 1 }], new Date(2026, 3, 30));
    expect(id).toBeNull();
  });
});

describe("findLegacyPlanDayForCalendarDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 24, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the day object whose calendar date matches", () => {
    const hit = findLegacyPlanDayForCalendarDate(
      [
        { day: 1, meals: [] },
        { day: 2, meals: [{ name: "x" }] },
      ],
      new Date(2026, 3, 25),
    );
    expect(hit?.day).toBe(2);
  });
});
