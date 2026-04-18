/**
 * Edge-case coverage for `weekSummaryWindow`: DST boundaries, Saturday
 * anchors, odd-input normalisation, month/year rollovers, midnight anchors.
 * Complements weekSummaryWindow.test.ts with non-happy-path cases.
 */
import { describe, expect, it } from "vitest";
import {
  normalizeWeekSummaryMode,
  weekSummaryDateKeys,
  weekSummaryHeading,
} from "../../src/lib/nutrition/weekSummaryWindow.ts";

describe("normalizeWeekSummaryMode — odd inputs", () => {
  it("treats null, number, object, array, boolean as rolling", () => {
    expect(normalizeWeekSummaryMode(null)).toBe("rolling");
    expect(normalizeWeekSummaryMode(0)).toBe("rolling");
    expect(normalizeWeekSummaryMode(1)).toBe("rolling");
    expect(normalizeWeekSummaryMode({})).toBe("rolling");
    expect(normalizeWeekSummaryMode([])).toBe("rolling");
    expect(normalizeWeekSummaryMode(false)).toBe("rolling");
    expect(normalizeWeekSummaryMode(true)).toBe("rolling");
  });

  it("is case-sensitive — only exact 'calendar_week' passes", () => {
    expect(normalizeWeekSummaryMode("Calendar_week")).toBe("rolling");
    expect(normalizeWeekSummaryMode(" calendar_week ")).toBe("rolling");
    expect(normalizeWeekSummaryMode("CALENDAR_WEEK")).toBe("rolling");
  });
});

describe("weekSummaryHeading", () => {
  it("returns the correct copy per mode", () => {
    expect(weekSummaryHeading("rolling")).toBe("7-day rolling summary");
    expect(weekSummaryHeading("calendar_week")).toBe("This week");
  });
});

describe("weekSummaryDateKeys — Saturday anchor", () => {
  const anchor = new Date(2026, 3, 11, 12, 0, 0, 0); // Sat 11 Apr 2026

  it("calendar_week monday: Sat anchor → Mon 6 – Sun 12", () => {
    const keys = weekSummaryDateKeys("calendar_week", anchor, "monday");
    expect(keys[0]).toBe("2026-04-06");
    expect(keys[5]).toBe("2026-04-11");
    expect(keys[6]).toBe("2026-04-12");
  });

  it("calendar_week sunday: Sat anchor is last day", () => {
    const keys = weekSummaryDateKeys("calendar_week", anchor, "sunday");
    expect(keys[0]).toBe("2026-04-05");
    expect(keys[6]).toBe("2026-04-11");
  });

  it("rolling: Sat anchor → Sat..Sat-6", () => {
    const keys = weekSummaryDateKeys("rolling", anchor, "monday");
    expect(keys[0]).toBe("2026-04-11");
    expect(keys[6]).toBe("2026-04-05");
  });
});

describe("weekSummaryDateKeys — midnight-boundary anchors", () => {
  it("00:30 on Wed 8 Apr still gives Mon 6 – Sun 12", () => {
    const anchor = new Date(2026, 3, 8, 0, 30, 0, 0);
    const keys = weekSummaryDateKeys("calendar_week", anchor, "monday");
    expect(keys[0]).toBe("2026-04-06");
    expect(keys[6]).toBe("2026-04-12");
  });

  it("23:45 on Wed 8 Apr still gives Mon 6 – Sun 12", () => {
    const anchor = new Date(2026, 3, 8, 23, 45, 0, 0);
    const keys = weekSummaryDateKeys("calendar_week", anchor, "monday");
    expect(keys[0]).toBe("2026-04-06");
    expect(keys[6]).toBe("2026-04-12");
  });
});

describe("weekSummaryDateKeys — DST boundary weeks", () => {
  it("spring-forward week (Mon 2 Mar – Sun 8 Mar 2026) produces 7 unique keys", () => {
    const anchor = new Date(2026, 2, 4, 12, 0, 0, 0);
    const keys = weekSummaryDateKeys("calendar_week", anchor, "monday");
    expect(new Set(keys).size).toBe(7);
    expect(keys).toEqual([
      "2026-03-02", "2026-03-03", "2026-03-04",
      "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08",
    ]);
  });

  it("rolling 7-day ending Wed 11 Mar spans the lost hour", () => {
    const anchor = new Date(2026, 2, 11, 12, 0, 0, 0);
    const keys = weekSummaryDateKeys("rolling", anchor, "monday");
    expect(keys).toEqual([
      "2026-03-11", "2026-03-10", "2026-03-09", "2026-03-08",
      "2026-03-07", "2026-03-06", "2026-03-05",
    ]);
  });

  it("fall-back week (Mon 26 Oct – Sun 1 Nov 2026)", () => {
    const anchor = new Date(2026, 9, 29, 12, 0, 0, 0);
    const keys = weekSummaryDateKeys("calendar_week", anchor, "monday");
    expect(keys).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29",
      "2026-10-30", "2026-10-31", "2026-11-01",
    ]);
  });

  it("sunday-start Sun 1 Nov – Sat 7 Nov (fall-back contained)", () => {
    const anchor = new Date(2026, 10, 3, 12, 0, 0, 0);
    const keys = weekSummaryDateKeys("calendar_week", anchor, "sunday");
    expect(keys).toEqual([
      "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04",
      "2026-11-05", "2026-11-06", "2026-11-07",
    ]);
  });
});

describe("weekSummaryDateKeys — month/year rollovers", () => {
  it("week spanning end of month produces correct cross-month keys", () => {
    const anchor = new Date(2026, 3, 29, 12, 0, 0, 0); // Wed 29 Apr 2026
    const keys = weekSummaryDateKeys("calendar_week", anchor, "monday");
    expect(keys).toEqual([
      "2026-04-27", "2026-04-28", "2026-04-29", "2026-04-30",
      "2026-05-01", "2026-05-02", "2026-05-03",
    ]);
  });

  it("New Year week (Thu 31 Dec 2026) rolls year correctly", () => {
    const anchor = new Date(2026, 11, 31, 12, 0, 0, 0);
    const keys = weekSummaryDateKeys("calendar_week", anchor, "monday");
    expect(keys[0]).toBe("2026-12-28");
    expect(keys[6]).toBe("2027-01-03");
  });
});
