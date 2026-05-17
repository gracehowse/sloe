import { describe, expect, it } from "vitest";

import { filterByDateRangeDays } from "@suppr/shared/weightProjection";
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

  /**
   * G-3 (TestFlight `AGJmliHTxnmt7sC1VpTZz5E`, 2026-04-19, build 11) —
   * the tester reported "3M" showing `16 Feb → 14 Apr` (~57 days) and
   * wondered if `daysForRange` had an off-by-N bug. These tests pin
   * `3M` at exactly 90 calendar days and prove the visible window
   * matches the nominal label — i.e. the filter is NOT subtracting
   * calendar months (which would drift 28/30/31) and NOT silently
   * truncating by using a stale `now`. When the user's by-day map
   * only spans ~2 months (no older weigh-ins), the filter correctly
   * returns every available row — the shorter visible span is a
   * data-supply issue, not a filter bug.
   */
  describe("G-3 off-by-N-days pin", () => {
    it("3M = exactly 90 nominal days, counted from `now`", () => {
      expect(daysForRange("3M")).toBe(90);
      const all = buildByDayMap(365);
      const filtered = filterByDateRangeDays(all, daysForRange("3M"), NOW);
      // 90-day lookback against today + 90 prior = 91 entries.
      expect(Object.keys(filtered).length).toBe(91);
      const keys = Object.keys(filtered).sort();
      // Earliest kept key is today - 90 days = 2026-01-19.
      expect(keys[0]).toBe("2026-01-19");
      // Latest kept key is today = 2026-04-19.
      expect(keys[keys.length - 1]).toBe("2026-04-19");
    });

    it("3M does NOT use calendar-month subtraction (would drift to 89/91/92)", () => {
      // If the implementation ever regressed to
      // `cutoff.setMonth(cutoff.getMonth() - 3)` the earliest kept
      // date would shift 1–2 days across different `now` values
      // (Feb has 28–29, Apr has 30, etc.). Nominal-day arithmetic
      // keeps the earliest-kept key at exactly `now - 90 days`
      // regardless of which months are in the window.
      //
      // Build a map for each probe that spans from well before the
      // cutoff up to the probe's `now`, so `filteredX` is bounded
      // above by `now`. We then assert the exact earliest kept key
      // per probe — calendar-month subtraction would move that key
      // off by a day.
      function buildMapThrough(endStr: string): Record<string, number> {
        const out: Record<string, number> = {};
        const earliest = new Date("2025-06-01T12:00:00Z");
        const end = new Date(`${endStr}T12:00:00Z`);
        for (
          const d = new Date(earliest);
          d.getTime() <= end.getTime();
          d.setUTCDate(d.getUTCDate() + 1)
        ) {
          out[d.toISOString().slice(0, 10)] = 75;
        }
        return out;
      }

      const filteredApr = filterByDateRangeDays(
        buildMapThrough("2026-04-19"),
        daysForRange("3M"),
        new Date("2026-04-19T12:00:00Z"),
      );
      const filteredJun = filterByDateRangeDays(
        buildMapThrough("2026-06-01"),
        daysForRange("3M"),
        new Date("2026-06-01T12:00:00Z"),
      );
      expect(Object.keys(filteredApr).length).toBe(91);
      expect(Object.keys(filteredJun).length).toBe(91);
      // Exact earliest key = now - 90 days, invariant of month length.
      expect(Object.keys(filteredApr).sort()[0]).toBe("2026-01-19");
      expect(Object.keys(filteredJun).sort()[0]).toBe("2026-03-03");
    });

    it("short-history case — tester's 57-day window when data starts 2026-02-16", () => {
      // Reproduces the screenshot exactly: user has weigh-ins from
      // 2026-02-16 through 2026-04-14. Asking for 3M against a
      // `now` of 2026-04-19 must return every row that exists (the
      // filter is not the bug — there just aren't earlier rows).
      const map: Record<string, number> = {};
      const start = new Date("2026-02-16T12:00:00Z");
      const end = new Date("2026-04-14T12:00:00Z");
      for (
        let d = new Date(start);
        d.getTime() <= end.getTime();
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const k = d.toISOString().slice(0, 10);
        map[k] = 55 - (end.getTime() - d.getTime()) / 86400000 / 30;
      }
      const filtered = filterByDateRangeDays(map, daysForRange("3M"), NOW);
      const keys = Object.keys(filtered).sort();
      expect(keys[0]).toBe("2026-02-16");
      expect(keys[keys.length - 1]).toBe("2026-04-14");
      // 58 inclusive days between Feb 16 and Apr 14.
      expect(keys.length).toBe(58);
    });

    it("1W / 1M / 6M / 9M / 12M boundaries are exact (no ± 1-day drift)", () => {
      const all = buildByDayMap(400);
      // today + N prior = N+1 entries for each finite lookback.
      expect(
        Object.keys(filterByDateRangeDays(all, daysForRange("1W"), NOW)).length,
      ).toBe(8);
      expect(
        Object.keys(filterByDateRangeDays(all, daysForRange("1M"), NOW)).length,
      ).toBe(31);
      expect(
        Object.keys(filterByDateRangeDays(all, daysForRange("6M"), NOW)).length,
      ).toBe(181);
      expect(
        Object.keys(filterByDateRangeDays(all, daysForRange("9M"), NOW)).length,
      ).toBe(276);
      expect(
        Object.keys(filterByDateRangeDays(all, daysForRange("12M"), NOW)).length,
      ).toBe(367);
    });
  });
});
