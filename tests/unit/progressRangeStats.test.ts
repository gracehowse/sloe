/**
 * Unit tests for the 2026-04-20 Progress Phase 2 card helpers — the
 * WEIGHT card + Calories card both read from these pure functions so
 * web + mobile must agree on every number.
 */
import { describe, expect, it } from "vitest";
import {
  buildCaloriesRangeStats,
  buildWeightRangeStats,
  rangeLabel,
} from "../../src/lib/nutrition/progressRangeStats";

// Fixed "today" so date-based filtering is deterministic.
const NOW = new Date("2026-04-20T12:00:00Z");

describe("buildWeightRangeStats", () => {
  const weights: Record<string, number> = {
    "2026-01-15": 78.2,
    "2026-03-25": 76.1, // inside the 30d window (2026-04-20 minus 29 days = 2026-03-22)
    "2026-04-14": 75.5,
    "2026-04-19": 74.8,
  };

  it("returns nulls when the weight map is empty", () => {
    const r = buildWeightRangeStats({}, "30d", NOW);
    expect(r.series).toEqual([]);
    expect(r.latestKg).toBeNull();
    expect(r.deltaKg).toBeNull();
    expect(r.weekDeltaKg).toBeNull();
  });

  it("7d window includes only the last 7 days", () => {
    const r = buildWeightRangeStats(weights, "7d", NOW);
    // 2026-04-14 is 6 days before 2026-04-20 → inside the 7-day window.
    // 2026-03-25 is well outside.
    expect(r.series.map((p) => p.dateKey)).toEqual(["2026-04-14", "2026-04-19"]);
    expect(r.latestKg).toBe(74.8);
    expect(r.deltaKg).toBeCloseTo(-0.7, 5);
    expect(r.weekDeltaKg).toBeCloseTo(-0.7, 5);
  });

  it("30d window broadens the series", () => {
    const r = buildWeightRangeStats(weights, "30d", NOW);
    expect(r.series.map((p) => p.dateKey)).toEqual([
      "2026-03-25",
      "2026-04-14",
      "2026-04-19",
    ]);
    expect(r.deltaKg).toBeCloseTo(-1.3, 5);
    // Week delta is still only the recent 7 days (14th → 19th).
    expect(r.weekDeltaKg).toBeCloseTo(-0.7, 5);
  });

  it("all includes every point", () => {
    const r = buildWeightRangeStats(weights, "all", NOW);
    expect(r.series).toHaveLength(4);
  });

  it("deltaKg is null when only one point exists in the range", () => {
    const r = buildWeightRangeStats({ "2026-04-19": 74.8 }, "7d", NOW);
    expect(r.deltaKg).toBeNull();
    expect(r.weekDeltaKg).toBeNull();
  });
});

describe("buildCaloriesRangeStats", () => {
  const byDay = {
    "2026-03-21": [{ calories: 1900 }],
    "2026-04-14": [{ calories: 2100 }, { calories: 100 }], // → 2200
    "2026-04-19": [{ calories: 1795 }],
    "2026-04-20": [{ calories: 400 }], // today
  };

  it("avg + delta + adherence over 7d with a real target", () => {
    const r = buildCaloriesRangeStats(byDay, 2100, "7d", NOW);
    // 2200 + 1795 + 400 = 4395, 3 days → avg 1465
    expect(r.daysLogged).toBe(3);
    expect(r.avgCaloriesPerDay).toBe(1465);
    expect(r.deltaVsTargetKcal).toBe(-635);
    expect(r.adherencePct).toBe(70);
  });

  it("nulls when no target is supplied but still returns the avg", () => {
    const r = buildCaloriesRangeStats(byDay, null, "7d", NOW);
    expect(r.avgCaloriesPerDay).toBe(1465);
    expect(r.deltaVsTargetKcal).toBeNull();
    expect(r.adherencePct).toBeNull();
  });

  it("ignores days with zero or no logged meals", () => {
    const r = buildCaloriesRangeStats(
      { "2026-04-18": [], "2026-04-19": [{ calories: 0 }], "2026-04-20": [{ calories: 1500 }] },
      2100,
      "7d",
      NOW,
    );
    expect(r.daysLogged).toBe(1);
    expect(r.avgCaloriesPerDay).toBe(1500);
  });

  it("returns null avg when the range has no data", () => {
    const r = buildCaloriesRangeStats({}, 2100, "30d", NOW);
    expect(r.avgCaloriesPerDay).toBeNull();
    expect(r.series).toEqual([]);
  });
});

describe("rangeLabel", () => {
  it("maps each key to its uppercase overline copy", () => {
    expect(rangeLabel("7d")).toBe("LAST 7 DAYS");
    expect(rangeLabel("30d")).toBe("LAST 30 DAYS");
    expect(rangeLabel("90d")).toBe("LAST 90 DAYS");
    expect(rangeLabel("all")).toBe("ALL TIME");
  });
});
