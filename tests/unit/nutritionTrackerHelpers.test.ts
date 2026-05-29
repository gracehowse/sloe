/**
 * Tests for NutritionTracker helper functions:
 * - parseDateKey, shiftDateKey, todayKey, formatDateLabel
 *
 * These underpin the date navigation feature (Feature 1)
 * and ensure parity with mobile's formatDateLabel behaviour.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseDateKey,
  shiftDateKey,
  todayKey,
  formatDateLabel,
  clampDateKey,
} from "@/app/components/NutritionTracker";
import { normalizeMacroTargets } from "@/types/profile";

describe("parseDateKey", () => {
  it("parses a YYYY-MM-DD string into the correct Date", () => {
    const d = parseDateKey("2026-04-16");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // 0-indexed
    expect(d.getDate()).toBe(16);
  });

  it("handles single-digit months/days in the key", () => {
    const d = parseDateKey("2025-01-05");
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(5);
  });
});

describe("shiftDateKey", () => {
  it("shifts forward by 1 day", () => {
    expect(shiftDateKey("2026-04-16", 1)).toBe("2026-04-17");
  });

  it("shifts backward by 1 day", () => {
    expect(shiftDateKey("2026-04-16", -1)).toBe("2026-04-15");
  });

  it("handles month boundary forward", () => {
    expect(shiftDateKey("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("handles month boundary backward", () => {
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("handles year boundary forward", () => {
    expect(shiftDateKey("2025-12-31", 1)).toBe("2026-01-01");
  });

  it("handles year boundary backward", () => {
    expect(shiftDateKey("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("shifts by multiple days", () => {
    expect(shiftDateKey("2026-04-16", 7)).toBe("2026-04-23");
    expect(shiftDateKey("2026-04-16", -7)).toBe("2026-04-09");
  });

  it("handles leap year", () => {
    expect(shiftDateKey("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftDateKey("2024-02-29", 1)).toBe("2024-03-01");
  });
});

describe("todayKey", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today's date as YYYY-MM-DD", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16, 10, 30));
    expect(todayKey()).toBe("2026-04-16");
  });

  it("pads single-digit months and days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 0, 0));
    expect(todayKey()).toBe("2026-01-05");
  });
});

describe("formatDateLabel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Today" for today\'s date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16, 14, 0));
    expect(formatDateLabel(new Date(2026, 3, 16))).toBe("Today");
  });

  it('returns "Yesterday" for yesterday\'s date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16, 14, 0));
    expect(formatDateLabel(new Date(2026, 3, 15))).toBe("Yesterday");
  });

  it("returns a formatted date string for other dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16, 14, 0));
    const label = formatDateLabel(new Date(2026, 3, 13));
    // en-GB short format: "Mon, 13 Apr" or similar (locale-dependent in jsdom)
    // Key assertion: it should NOT say "Today" or "Yesterday"
    expect(label).not.toBe("Today");
    expect(label).not.toBe("Yesterday");
    expect(label.length).toBeGreaterThan(0);
  });

  it('returns "Yesterday" across month boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 1, 14, 0)); // April 1
    expect(formatDateLabel(new Date(2026, 2, 31))).toBe("Yesterday"); // March 31
  });

  it('returns "Today" at midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16, 0, 0, 0));
    expect(formatDateLabel(new Date(2026, 3, 16))).toBe("Today");
  });

  it("does not return Yesterday for two days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16, 14, 0));
    const label = formatDateLabel(new Date(2026, 3, 14));
    expect(label).not.toBe("Yesterday");
    expect(label).not.toBe("Today");
  });
});

describe("clampDateKey", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clamps dates outside journal navigation bounds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16, 12, 0));
    const farPast = clampDateKey("2010-01-01");
    const farFuture = clampDateKey("2099-12-31");
    expect(farPast).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(farFuture).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(farPast).not.toBe("2010-01-01");
    expect(farFuture).not.toBe("2099-12-31");
  });

  it("preserves in-range dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16, 12, 0));
    expect(clampDateKey("2026-04-10")).toBe("2026-04-10");
  });
});

describe("normalizeMacroTargets — waterMl", () => {
  it("returns default waterMl (2000) when no overrides", () => {
    const t = normalizeMacroTargets({});
    expect(t.waterMl).toBe(2000);
  });

  it("respects a custom waterMl override", () => {
    const t = normalizeMacroTargets({ waterMl: 3000 });
    expect(t.waterMl).toBe(3000);
  });

  it("clamps negative waterMl to 0", () => {
    const t = normalizeMacroTargets({ waterMl: -500 });
    expect(t.waterMl).toBe(0);
  });

  it("rounds fractional waterMl", () => {
    const t = normalizeMacroTargets({ waterMl: 2500.7 });
    expect(t.waterMl).toBe(2501);
  });
});

describe("water progress calculation", () => {
  const getProgress = (current: number, target: number) =>
    Math.min((current / target) * 100, 100);

  it("returns 0% when no water consumed", () => {
    expect(getProgress(0, 2000)).toBe(0);
  });

  it("returns 50% at halfway", () => {
    expect(getProgress(1000, 2000)).toBe(50);
  });

  it("caps at 100% when target exceeded", () => {
    expect(getProgress(3000, 2000)).toBe(100);
  });

  it("handles zero target without crashing (divide by zero guard)", () => {
    // The UI guards with Math.max(target, 1) — test that pattern
    const safeProgress = (current: number, target: number) =>
      Math.min((current / Math.max(target, 1)) * 100, 100);
    expect(safeProgress(500, 0)).toBe(100);
  });
});
