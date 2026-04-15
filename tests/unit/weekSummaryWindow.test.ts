import { describe, expect, it } from "vitest";
import { normalizeWeekSummaryMode, weekSummaryDateKeys } from "../../src/lib/nutrition/weekSummaryWindow.ts";

describe("normalizeWeekSummaryMode", () => {
  it("defaults invalid values to rolling", () => {
    expect(normalizeWeekSummaryMode(undefined)).toBe("rolling");
    expect(normalizeWeekSummaryMode("")).toBe("rolling");
    expect(normalizeWeekSummaryMode("weekly")).toBe("rolling");
  });

  it("accepts calendar_week", () => {
    expect(normalizeWeekSummaryMode("calendar_week")).toBe("calendar_week");
  });
});

describe("weekSummaryDateKeys", () => {
  it("rolling: seven days ending on anchor", () => {
    const anchor = new Date(2026, 3, 14, 12, 0, 0, 0); // 14 Apr 2026
    const keys = weekSummaryDateKeys("rolling", anchor, "monday");
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe("2026-04-14");
    expect(keys[6]).toBe("2026-04-08");
  });

  it("calendar_week monday: week containing anchor", () => {
    // Wed 8 Apr 2026 → week Mon 6 Apr – Sun 12 Apr
    const anchor = new Date(2026, 3, 8, 12, 0, 0, 0);
    const keys = weekSummaryDateKeys("calendar_week", anchor, "monday");
    expect(keys[0]).toBe("2026-04-06");
    expect(keys[6]).toBe("2026-04-12");
  });

  it("calendar_week sunday: week containing anchor", () => {
    // Wed 8 Apr 2026 → Sun 5 Apr – Sat 11 Apr
    const anchor = new Date(2026, 3, 8, 12, 0, 0, 0);
    const keys = weekSummaryDateKeys("calendar_week", anchor, "sunday");
    expect(keys[0]).toBe("2026-04-05");
    expect(keys[6]).toBe("2026-04-11");
  });
});
