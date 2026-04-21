import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSameCalendarDay,
  planCalendarDateForIndex,
  resolvePlanSlotIconKey,
  shortWeekdayLabel,
} from "../../src/lib/planning/planDayLabel.ts";

/**
 * Prototype port (2026-04-20) — these tests pin the shared Plan-tab
 * day-label + slot-icon helpers used by both platforms. Regressions
 * flip the day section header ("Mon" vs "Day 1") or show the wrong
 * icon in a meal row, which is user-visible.
 */

describe("resolvePlanSlotIconKey", () => {
  it("maps the four canonical slot names to their icon keys", () => {
    expect(resolvePlanSlotIconKey("Breakfast")).toBe("breakfast");
    expect(resolvePlanSlotIconKey("Lunch")).toBe("lunch");
    expect(resolvePlanSlotIconKey("Dinner")).toBe("dinner");
    expect(resolvePlanSlotIconKey("Snacks")).toBe("snacks");
  });

  it("normalises case + legacy singular (`Snack`)", () => {
    expect(resolvePlanSlotIconKey("breakfast")).toBe("breakfast");
    expect(resolvePlanSlotIconKey("  LUNCH  ")).toBe("lunch");
    expect(resolvePlanSlotIconKey("Snack")).toBe("snacks");
  });

  it("falls through to `snacks` on unknown / empty input so the UI never blanks out", () => {
    expect(resolvePlanSlotIconKey("Dessert")).toBe("snacks");
    expect(resolvePlanSlotIconKey("")).toBe("snacks");
    expect(resolvePlanSlotIconKey(null)).toBe("snacks");
    expect(resolvePlanSlotIconKey(undefined)).toBe("snacks");
  });
});

describe("shortWeekdayLabel", () => {
  it("returns a 3-letter English weekday", () => {
    // 2026-04-20 is a Monday (system-reminder context).
    expect(shortWeekdayLabel(new Date("2026-04-20T12:00:00Z"))).toBe("Mon");
    expect(shortWeekdayLabel(new Date("2026-04-21T12:00:00Z"))).toBe("Tue");
    expect(shortWeekdayLabel(new Date("2026-04-22T12:00:00Z"))).toBe("Wed");
    expect(shortWeekdayLabel(new Date("2026-04-23T12:00:00Z"))).toBe("Thu");
    expect(shortWeekdayLabel(new Date("2026-04-24T12:00:00Z"))).toBe("Fri");
    expect(shortWeekdayLabel(new Date("2026-04-25T12:00:00Z"))).toBe("Sat");
    expect(shortWeekdayLabel(new Date("2026-04-26T12:00:00Z"))).toBe("Sun");
  });
});

describe("planCalendarDateForIndex + isSameCalendarDay", () => {
  beforeEach(() => {
    // Freeze to 2026-04-20 10:30 local so index 0 is Monday, index 6 is
    // Sunday. Uses a deterministic time to avoid the "CI is UTC" trap.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 20, 10, 30, 0)); // Month is 0-indexed
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today at midnight for idx=0, offset=0", () => {
    const d = planCalendarDateForIndex(0, 0);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // April
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("advances one day per index", () => {
    expect(planCalendarDateForIndex(1, 0).getDate()).toBe(21);
    expect(planCalendarDateForIndex(6, 0).getDate()).toBe(26);
  });

  it("applies the startOffset (tomorrow / next week)", () => {
    // idx=0, offset=1 → tomorrow
    expect(planCalendarDateForIndex(0, 1).getDate()).toBe(21);
    // idx=0, offset=7 → a week from today
    expect(planCalendarDateForIndex(0, 7).getDate()).toBe(27);
  });

  it("matches today for the zeroth day with zero offset", () => {
    expect(isSameCalendarDay(planCalendarDateForIndex(0, 0))).toBe(true);
  });

  it("does not match today for future days", () => {
    expect(isSameCalendarDay(planCalendarDateForIndex(1, 0))).toBe(false);
    expect(isSameCalendarDay(planCalendarDateForIndex(0, 7))).toBe(false);
  });

  it("isSameCalendarDay ignores time-of-day", () => {
    const morning = new Date(2026, 3, 20, 0, 5, 0);
    const evening = new Date(2026, 3, 20, 23, 55, 0);
    expect(isSameCalendarDay(morning, evening)).toBe(true);
  });
});
