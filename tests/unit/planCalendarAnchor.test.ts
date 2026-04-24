import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  findLegacyPlanDayForCalendarDate,
  findPlanDayIdForCalendarDate,
  planCalendarDateForIndex,
  startDateForOffset,
  stripMidnight,
} from "../../src/lib/mealPlan/planCalendarAnchor";

/**
 * T7 (full-sweep 2026-04-24) — verifies the persisted-anchor resolver.
 *
 * Pre-T7 this file used `it.fails` markers to document the first-match-
 * offset bug. With the `meal_plan_days.start_date` migration applied
 * and the resolver rewritten to read the anchor, those tests now pass.
 * Legacy offset-iteration behaviour is preserved ONLY for rows missing
 * `start_date` (the rollout-window escape hatch).
 */

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

describe("startDateForOffset (persist-path helper)", () => {
  const todayDate = new Date(2026, 3, 24, 12, 0, 0);

  it("returns today for offset 0", () => {
    expect(startDateForOffset(todayDate, 0)).toBe("2026-04-24");
  });

  it("returns tomorrow for offset 1", () => {
    expect(startDateForOffset(todayDate, 1)).toBe("2026-04-25");
  });

  it("returns today+7 for offset 7 (next week)", () => {
    expect(startDateForOffset(todayDate, 7)).toBe("2026-05-01");
  });

  it("pads month and day to two digits", () => {
    expect(startDateForOffset(new Date(2026, 0, 2, 12), 0)).toBe("2026-01-02");
  });
});

describe("findPlanDayIdForCalendarDate — T7 persisted-anchor path", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 24, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches day 1 to today when start_date = today", () => {
    const id = findPlanDayIdForCalendarDate(
      [{ id: "row-a", day: 1, start_date: "2026-04-24" }],
      new Date(2026, 3, 24),
    );
    expect(id).toBe("row-a");
  });

  it("matches day 2 to start_date + 1", () => {
    const id = findPlanDayIdForCalendarDate(
      [{ id: "row-b", day: 2, start_date: "2026-04-24" }],
      new Date(2026, 3, 25),
    );
    expect(id).toBe("row-b");
  });

  it("next-week plan does NOT resolve to today", () => {
    // start_date = 2026-05-01; day 1 = May 1, not April 24
    const rows = [{ id: "row-next-week", day: 1, start_date: "2026-05-01" }];
    expect(findPlanDayIdForCalendarDate(rows, new Date(2026, 3, 24))).toBeNull();
    expect(findPlanDayIdForCalendarDate(rows, new Date(2026, 4, 1))).toBe("row-next-week");
  });

  it("distinguishes overlapping day-1 rows by start_date", () => {
    // Two plans hypothetically with different anchors (the current
    // unique constraint prevents this in prod, but the resolver must
    // still return the right row if anchors diverge).
    const rows = [
      { id: "row-today", day: 1, start_date: "2026-04-24" },
      { id: "row-next-week", day: 1, start_date: "2026-05-01" },
    ];
    expect(findPlanDayIdForCalendarDate(rows, new Date(2026, 3, 24))).toBe("row-today");
    expect(findPlanDayIdForCalendarDate(rows, new Date(2026, 4, 1))).toBe("row-next-week");
  });

  it("returns null when no row's start_date + day - 1 equals the target date", () => {
    const id = findPlanDayIdForCalendarDate(
      [{ id: "row-d", day: 1, start_date: "2026-04-24" }],
      new Date(2026, 3, 30),
    );
    expect(id).toBeNull();
  });
});

describe("findPlanDayIdForCalendarDate — legacy fallback (row without start_date)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 24, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * The legacy path is deliberately imprecise — it's the pre-T7 behaviour
   * preserved only as a rollout-window escape hatch for rows that haven't
   * been backfilled. Tests pin the behaviour so nobody accidentally
   * removes the fallback before the backfill is complete.
   */
  it("falls back to offset iteration when rows lack start_date", () => {
    const id = findPlanDayIdForCalendarDate(
      [{ id: "row-a", day: 1 }],
      new Date(2026, 3, 24),
    );
    expect(id).toBe("row-a");
  });

  it("falls back if ANY row is missing start_date (mixed legacy + T7 input)", () => {
    // Mixed input → legacy path → offset iteration.
    const id = findPlanDayIdForCalendarDate(
      [
        { id: "row-legacy", day: 2 },
        { id: "row-anchored", day: 1, start_date: "2026-05-01" },
      ],
      new Date(2026, 3, 25),
    );
    // Legacy offset iteration: day 2 + offset 0 → tomorrow → matches row-legacy
    expect(id).toBe("row-legacy");
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

  it("returns the day object whose calendar date matches (JSONB legacy plans)", () => {
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
