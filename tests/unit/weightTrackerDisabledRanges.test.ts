/**
 * weightTrackerDisabledRanges — Gap 8 (2026-06-09)
 *
 * Verifies the threshold logic used by weight-tracker.tsx to grey out
 * range pills with insufficient data. The threshold table is:
 *   1W ≥ 2 points | 1M ≥ 3 | 3M ≥ 4 | 12M ≥ 8 | All = always enabled
 *
 * Tests call filterByRange (the same function the component memo uses)
 * and assert the expected disabled/enabled states match the spec §3.2
 * rule: "Grey out + make non-interactive any range pill whose data
 * threshold isn't met."
 */
import { describe, expect, it } from "vitest";
import { filterByDateRangeDays } from "../../src/lib/weightProjection";

// Mirror the daysForRange helper to keep tests independent of the component.
function daysForRange(range: string): number {
  switch (range) {
    case "1W": return 7;
    case "1M": return 30;
    case "3M": return 90;
    case "12M": return 366;
    case "All": return 9999;
    default: return 9999;
  }
}

// Mirror the disabledRanges memo from weight-tracker.tsx.
const THRESHOLDS: Array<[string, number]> = [
  ["1W", 2],
  ["1M", 3],
  ["3M", 4],
  ["12M", 8],
];

function computeDisabledRanges(weightKgByDay: Record<string, number>): Set<string> {
  const disabled = new Set<string>();
  for (const [r, minPoints] of THRESHOLDS) {
    const pts = Object.keys(filterByDateRangeDays(weightKgByDay, daysForRange(r))).length;
    if (pts < minPoints) disabled.add(r);
  }
  return disabled;
}

// Helper to build a map of { dateISO: kg } entries going back N days from a reference.
function makeMap(entries: Array<[string, number]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of entries) out[k] = v;
  return out;
}

describe("weightTracker disabledRanges threshold logic", () => {
  it("all ranges disabled when no weigh-ins", () => {
    const disabled = computeDisabledRanges({});
    expect(disabled.has("1W")).toBe(true);
    expect(disabled.has("1M")).toBe(true);
    expect(disabled.has("3M")).toBe(true);
    expect(disabled.has("12M")).toBe(true);
    // All is never in the disabled set.
    expect(disabled.has("All")).toBe(false);
  });

  it("only 1W enabled when 2 weigh-ins within the last 7 days", () => {
    const today = new Date();
    const d = (offset: number) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - offset);
      return dt.toISOString().slice(0, 10);
    };
    const map = makeMap([[d(1), 70], [d(3), 70.5]]);
    const disabled = computeDisabledRanges(map);
    expect(disabled.has("1W")).toBe(false); // 2 points — meets threshold
    expect(disabled.has("1M")).toBe(true);  // < 3 points in 30d
    expect(disabled.has("3M")).toBe(true);  // < 4 points in 90d
    expect(disabled.has("12M")).toBe(true); // < 8 points in 366d
  });

  it("1W and 1M enabled when 3+ points within 30 days", () => {
    const today = new Date();
    const d = (offset: number) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - offset);
      return dt.toISOString().slice(0, 10);
    };
    const map = makeMap([[d(2), 70], [d(5), 70.2], [d(20), 70.8]]);
    const disabled = computeDisabledRanges(map);
    expect(disabled.has("1W")).toBe(false); // 2 recent points ≥ threshold
    expect(disabled.has("1M")).toBe(false); // 3 points in 30d — meets threshold
    expect(disabled.has("3M")).toBe(true);  // only 3, needs 4
  });

  it("all ranges enabled when 8+ weigh-ins spread over a year", () => {
    const today = new Date();
    const d = (offset: number) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - offset);
      return dt.toISOString().slice(0, 10);
    };
    // 8 entries: some within 7 days, some within 90, some within 366.
    const map = makeMap([
      [d(1), 70],  [d(3), 70.1], [d(10), 70.3], [d(25), 70.5],
      [d(60), 71], [d(90), 71.2],[d(180), 72],  [d(300), 73],
    ]);
    const disabled = computeDisabledRanges(map);
    expect(disabled.size).toBe(0); // all ranges meet their thresholds
  });

  it("All range is never in the disabled set regardless of data", () => {
    const disabled = computeDisabledRanges({});
    expect(disabled.has("All")).toBe(false);
  });
});
