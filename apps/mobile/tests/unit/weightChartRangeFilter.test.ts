import { describe, expect, it } from "vitest";

import { filterByDateRangeDays } from "../../../../src/lib/weightProjection";
import { daysForRange, type TimeRange } from "../../components/charts/TimeRangeSelector";

/**
 * F-4b (TestFlight `ACoMvhUoe_riUvOp5XZ3Sow`, 2026-04-19) — the
 * range buttons on the weight chart (1W / 1M / 3M / 6M / 9M / 12M /
 * All) looked like they didn't do anything. Pinning the filter
 * helper's per-range behaviour so a regression here fails the suite.
 */

const NOW = new Date("2026-04-19T12:00:00Z");

/** Build a by-day map covering the last `n` days (today inclusive). */
function buildByDayMap(n: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const d = new Date(NOW);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const k = d.toISOString().slice(0, 10);
    out[k] = 80 - i * 0.05;
  }
  return out;
}

describe("weight chart range filter", () => {
  it("1W keeps the last 7 daily weigh-ins, drops older ones", () => {
    const all = buildByDayMap(60);
    const filtered = filterByDateRangeDays(all, daysForRange("1W"), NOW);
    expect(Object.keys(filtered).length).toBe(8); // today + 7 prior
    const keys = Object.keys(filtered).sort();
    expect(keys[0] >= "2026-04-12").toBe(true);
  });

  it("1M keeps ~30 days of weigh-ins", () => {
    const all = buildByDayMap(60);
    const filtered = filterByDateRangeDays(all, daysForRange("1M"), NOW);
    expect(Object.keys(filtered).length).toBe(31);
  });

  it("3M/6M/9M/12M grow the set monotonically", () => {
    const all = buildByDayMap(400);
    const sizes: Record<TimeRange, number> = {
      "1W": Object.keys(filterByDateRangeDays(all, daysForRange("1W"), NOW)).length,
      "1M": Object.keys(filterByDateRangeDays(all, daysForRange("1M"), NOW)).length,
      "3M": Object.keys(filterByDateRangeDays(all, daysForRange("3M"), NOW)).length,
      "6M": Object.keys(filterByDateRangeDays(all, daysForRange("6M"), NOW)).length,
      "9M": Object.keys(filterByDateRangeDays(all, daysForRange("9M"), NOW)).length,
      "12M": Object.keys(filterByDateRangeDays(all, daysForRange("12M"), NOW)).length,
      "All": Object.keys(filterByDateRangeDays(all, daysForRange("All"), NOW)).length,
    };
    expect(sizes["1W"]).toBeLessThan(sizes["1M"]);
    expect(sizes["1M"]).toBeLessThan(sizes["3M"]);
    expect(sizes["3M"]).toBeLessThan(sizes["6M"]);
    expect(sizes["6M"]).toBeLessThan(sizes["9M"]);
    expect(sizes["9M"]).toBeLessThan(sizes["12M"]);
    expect(sizes["12M"]).toBeLessThanOrEqual(sizes["All"]);
  });

  it("All keeps every entry regardless of age", () => {
    const map = {
      "2018-01-01": 90,
      "2020-06-15": 85,
      "2026-04-19": 78,
    };
    const filtered = filterByDateRangeDays(map, daysForRange("All"), NOW);
    expect(Object.keys(filtered).sort()).toEqual([
      "2018-01-01",
      "2020-06-15",
      "2026-04-19",
    ]);
  });

  it("returns a new chronologically-sorted record (chart draws left→right)", () => {
    const map = {
      "2026-04-15": 79,
      "2026-04-12": 80,
      "2026-04-18": 78.5,
      "2026-04-10": 80.5,
    };
    const filtered = filterByDateRangeDays(map, daysForRange("1M"), NOW);
    expect(Object.keys(filtered)).toEqual([
      "2026-04-10",
      "2026-04-12",
      "2026-04-15",
      "2026-04-18",
    ]);
  });

  it("does not mutate the input map", () => {
    const map = { "2026-04-18": 78.5, "2025-01-01": 90 };
    const before = JSON.stringify(map);
    filterByDateRangeDays(map, daysForRange("1M"), NOW);
    expect(JSON.stringify(map)).toBe(before);
  });

  it("keeps today's entry at the exact cutoff boundary", () => {
    const map = { "2026-04-19": 78 };
    const filtered = filterByDateRangeDays(map, daysForRange("1W"), NOW);
    expect(filtered["2026-04-19"]).toBe(78);
  });

  it("parity pin — `daysForRange` covers every `TimeRange` label", () => {
    // If someone adds a new range to the selector but forgets to
    // extend `daysForRange`, this test fails loudly.
    const ranges: TimeRange[] = ["1W", "1M", "3M", "6M", "9M", "12M", "All"];
    for (const r of ranges) {
      expect(daysForRange(r)).toBeGreaterThan(0);
    }
  });
});
