import { describe, expect, it } from "vitest";

import {
  previousDayKey,
  getYesterdayMeals,
} from "@/lib/nutrition/copyYesterdayMeals";

describe("previousDayKey", () => {
  it("returns the day before a standard date", () => {
    expect(previousDayKey("2026-05-27")).toBe("2026-05-26");
  });

  it("wraps from month start to previous month end", () => {
    expect(previousDayKey("2026-06-01")).toBe("2026-05-31");
  });

  it("wraps from year start to previous year end", () => {
    expect(previousDayKey("2026-01-01")).toBe("2025-12-31");
  });

  it("handles leap year Feb 29 → Feb 28", () => {
    expect(previousDayKey("2024-03-01")).toBe("2024-02-29");
  });

  it("handles leap year Feb 29 → Feb 28 backward", () => {
    expect(previousDayKey("2024-02-29")).toBe("2024-02-28");
  });

  it("handles non-leap year Mar 1 → Feb 28", () => {
    expect(previousDayKey("2025-03-01")).toBe("2025-02-28");
  });
});

describe("getYesterdayMeals", () => {
  const meal1 = { id: "a", name: "Breakfast", calories: 400 } as const;
  const meal2 = { id: "b", name: "Lunch", calories: 600 } as const;

  it("returns meals from the day before todayKey", () => {
    const byDay = { "2026-05-26": [meal1, meal2] };
    expect(getYesterdayMeals(byDay, "2026-05-27")).toEqual([meal1, meal2]);
  });

  it("returns empty array when yesterday has no entry", () => {
    expect(getYesterdayMeals({}, "2026-05-27")).toEqual([]);
  });

  it("returns empty array when yesterday entry is empty", () => {
    expect(getYesterdayMeals({ "2026-05-26": [] }, "2026-05-27")).toEqual([]);
  });

  it("does not return today's meals", () => {
    const byDay = {
      "2026-05-26": [meal1],
      "2026-05-27": [meal2],
    };
    const result = getYesterdayMeals(byDay, "2026-05-27");
    expect(result).toEqual([meal1]);
    expect(result).not.toContain(meal2);
  });

  it("handles month boundary — yesterday is last day of previous month", () => {
    const byDay = { "2026-04-30": [meal1] };
    expect(getYesterdayMeals(byDay, "2026-05-01")).toEqual([meal1]);
  });
});
