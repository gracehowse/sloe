import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  findLegacyPlanDayForCalendarDate,
  findPlanDayIdForCalendarDate,
  planCalendarDateForIndex,
  stripMidnight,
} from "../../src/lib/mealPlan/planCalendarAnchor";

/**
 * T5 (full-sweep 2026-04-24): this suite was previously pinning the
 * first-match-offset BUG as correct. The sweep flagged that a plan saved
 * with `startOffset = 7` (next week) gets resolved into today's lookup the
 * moment it's saved, because the resolver iterates `[0, 1, 7]` and returns
 * the first match with no persisted anchor to disambiguate.
 *
 * Tests below assert the CORRECT behaviour expected after T7 ships
 * (`meal_plans` gains a persisted `start_date` and the resolver takes it
 * as an explicit argument). They deliberately fail on the current
 * implementation so the red goes away when — and only when — T7 lands.
 *
 * See docs/planning/sweep-2026-04-24-executor-backlog.md T5 + T7.
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

describe("findPlanDayIdForCalendarDate — single-plan cases", () => {
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

  it("returns null when no row covers the date", () => {
    const id = findPlanDayIdForCalendarDate([{ id: "row-d", day: 1 }], new Date(2026, 3, 30));
    expect(id).toBeNull();
  });
});

describe("findPlanDayIdForCalendarDate — ambiguity between plans", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 24, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * BUG: two plans (one saved with startOffset=0, one with startOffset=7)
   * both carry a day=1 row. Today's lookup silently picks the offset-0
   * match — which may be the wrong plan entirely. The resolver cannot
   * disambiguate without a persisted anchor.
   *
   * Marked `it.fails` so CI stays green while the bug is documented.
   * Passes once T7 ships a startDate-aware signature or a guard that
   * refuses ambiguous input — at which point the marker must be removed.
   */
  it.fails("T7: must not silently pick first-match when two day-1 rows overlap today", () => {
    const rows = [
      { id: "row-today-plan", day: 1 },
      { id: "row-next-week-plan", day: 1 },
    ];
    const id = findPlanDayIdForCalendarDate(rows, new Date(2026, 3, 24));
    // Correct behaviour once an anchor is available: either return null
    // (ambiguous, caller must re-ask with an explicit plan anchor) or the
    // row from the actual plan the user saved last. Silently picking the
    // first-match offset-0 row is wrong and produces the "next-week plan
    // bleeds into today" regression the sweep flagged.
    expect(id).toBeNull();
  });

  /**
   * Previously this test asserted the first-match behaviour as correct
   * ("matches plan day 1 to today when plan was saved as next-week start
   * (offset 7)"). That assertion locked the bug in. T7 replaces it with
   * the requirement that next-week plans only resolve for +7 from today,
   * not for today itself.
   */
  it.fails("T7: a next-week plan must not resolve as today", () => {
    const rows = [{ id: "row-next-week-only", day: 1 }];
    // This row is day 1 of a plan saved with startOffset=7 — it should
    // only match May 1 (today + 7), NOT April 24.
    const idToday = findPlanDayIdForCalendarDate(rows, new Date(2026, 3, 24));
    // Under the fixed signature, the caller would pass the plan's own
    // startDate; without it the resolver should default to conservative
    // (null) rather than optimistic first-match.
    expect(idToday).toBeNull();
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
