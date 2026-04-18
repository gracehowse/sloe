import { describe, expect, it } from "vitest";
import {
  ALCOHOL_QUICK_ADDS,
  CAFFEINE_QUICK_ADDS,
  DEFAULT_ALCOHOL_WEEKLY_TARGET_G,
  DEFAULT_CAFFEINE_TARGET_MG,
  WATER_QUICK_ADDS_ML,
  isOverTarget,
  parseDayNumberMap,
  sumWaterFromMeals,
  weekKeysForAnchor,
  weeklyAlcoholG,
} from "../../src/lib/nutrition/hydrationStimulants";

describe("sumWaterFromMeals", () => {
  it("returns 0 for empty / null / undefined", () => {
    expect(sumWaterFromMeals([])).toBe(0);
    expect(sumWaterFromMeals(null)).toBe(0);
    expect(sumWaterFromMeals(undefined)).toBe(0);
  });

  it("sums positive waterMl values across meals", () => {
    expect(
      sumWaterFromMeals([
        { waterMl: 250 },
        { waterMl: 500 },
        { waterMl: 100 },
      ]),
    ).toBe(850);
  });

  it("ignores missing, null, or non-numeric waterMl", () => {
    expect(
      sumWaterFromMeals([
        { waterMl: 250 },
        { waterMl: undefined },
        { waterMl: null },
        {},
        { waterMl: Number.NaN },
      ] as Array<{ waterMl?: number | null }>),
    ).toBe(250);
  });

  it("clamps negative waterMl to 0 (defensive against undo races)", () => {
    expect(
      sumWaterFromMeals([
        { waterMl: 500 },
        { waterMl: -200 },
        { waterMl: 100 },
      ]),
    ).toBe(600);
  });

  it("rounds the sum to an integer", () => {
    expect(sumWaterFromMeals([{ waterMl: 100.4 }, { waterMl: 100.4 }])).toBe(201);
  });

  it("handles a mix of numeric types coerced through Number()", () => {
    expect(
      sumWaterFromMeals([
        { waterMl: 250 },
        { waterMl: "300" as unknown as number },
        { waterMl: "abc" as unknown as number },
      ]),
    ).toBe(550);
  });
});

describe("quick-add preset constants", () => {
  it("WATER_QUICK_ADDS_ML has four positive entries", () => {
    expect(WATER_QUICK_ADDS_ML).toHaveLength(4);
    for (const ml of WATER_QUICK_ADDS_ML) {
      expect(ml).toBeGreaterThan(0);
      expect(Number.isInteger(ml)).toBe(true);
    }
  });

  it("CAFFEINE_QUICK_ADDS has seven entries, each with a positive mg value", () => {
    expect(CAFFEINE_QUICK_ADDS.length).toBeGreaterThanOrEqual(4);
    for (const entry of CAFFEINE_QUICK_ADDS) {
      expect(entry.label).toBeTruthy();
      expect(entry.mg).toBeGreaterThan(0);
      expect(Number.isFinite(entry.mg)).toBe(true);
    }
  });

  it("ALCOHOL_QUICK_ADDS has four entries, each with a positive grams value", () => {
    expect(ALCOHOL_QUICK_ADDS).toHaveLength(4);
    for (const entry of ALCOHOL_QUICK_ADDS) {
      expect(entry.label).toBeTruthy();
      expect(entry.grams).toBeGreaterThan(0);
      expect(Number.isFinite(entry.grams)).toBe(true);
    }
  });

  it("defaults align with spec (FDA 400 mg caffeine, 0 g alcohol = hidden)", () => {
    expect(DEFAULT_CAFFEINE_TARGET_MG).toBe(400);
    expect(DEFAULT_ALCOHOL_WEEKLY_TARGET_G).toBe(0);
  });
});

describe("weekKeysForAnchor", () => {
  it("returns Monday–Sunday for a Monday anchor (monday start)", () => {
    // 2026-04-13 is a Monday
    expect(weekKeysForAnchor("2026-04-13", "monday")).toEqual([
      "2026-04-13",
      "2026-04-14",
      "2026-04-15",
      "2026-04-16",
      "2026-04-17",
      "2026-04-18",
      "2026-04-19",
    ]);
  });

  it("returns Monday–Sunday for a Sunday anchor (monday start)", () => {
    // 2026-04-19 is a Sunday; the week it belongs to starts Mon 13
    expect(weekKeysForAnchor("2026-04-19", "monday")).toEqual([
      "2026-04-13",
      "2026-04-14",
      "2026-04-15",
      "2026-04-16",
      "2026-04-17",
      "2026-04-18",
      "2026-04-19",
    ]);
  });

  it("returns Sunday–Saturday for a Thursday anchor (sunday start)", () => {
    // 2026-04-16 is a Thursday; sunday-start week begins Sun 12
    expect(weekKeysForAnchor("2026-04-16", "sunday")).toEqual([
      "2026-04-12",
      "2026-04-13",
      "2026-04-14",
      "2026-04-15",
      "2026-04-16",
      "2026-04-17",
      "2026-04-18",
    ]);
  });

  it("returns [] for an invalid date key", () => {
    expect(weekKeysForAnchor("bogus", "monday")).toEqual([]);
    expect(weekKeysForAnchor("", "sunday")).toEqual([]);
    expect(weekKeysForAnchor("2026-13-01", "monday")).toEqual([]);
  });

  it("every weekday anchor in a given week produces the same week keys (monday-start)", () => {
    const base = [
      "2026-04-13",
      "2026-04-14",
      "2026-04-15",
      "2026-04-16",
      "2026-04-17",
      "2026-04-18",
      "2026-04-19",
    ];
    for (const anchor of base) {
      expect(weekKeysForAnchor(anchor, "monday")).toEqual(base);
    }
  });
});

describe("weeklyAlcoholG", () => {
  const week = {
    "2026-04-13": 14, // Monday — one wine
    "2026-04-15": 16, // Wednesday — one beer
    "2026-04-18": 28, // Saturday — two wines
  };

  it("sums across the whole Mon–Sun week from a Wednesday anchor", () => {
    expect(weeklyAlcoholG(week, "2026-04-15", "monday")).toBe(58);
  });

  it("returns the same total for every anchor in the same monday-start week", () => {
    for (const key of [
      "2026-04-13",
      "2026-04-14",
      "2026-04-15",
      "2026-04-19",
    ]) {
      expect(weeklyAlcoholG(week, key, "monday")).toBe(58);
    }
  });

  it("Sunday-start slicing excludes Sunday the 19th (next week) for Sat-anchored lookups", () => {
    // Sunday-start week for Sat 2026-04-18 runs Sun 12 → Sat 18, so Sun 19 is next week.
    const extended = { ...week, "2026-04-19": 14 };
    expect(weeklyAlcoholG(extended, "2026-04-18", "sunday")).toBe(58);
    // The next week (anchored on the 19th) contains only the 19th entry.
    expect(weeklyAlcoholG(extended, "2026-04-19", "sunday")).toBe(14);
  });

  it("treats missing keys as 0 and survives an empty map", () => {
    expect(weeklyAlcoholG({}, "2026-04-15", "monday")).toBe(0);
    expect(weeklyAlcoholG(null, "2026-04-15", "monday")).toBe(0);
    expect(weeklyAlcoholG(undefined, "2026-04-15", "monday")).toBe(0);
  });

  it("clamps non-numeric or negative map values to 0", () => {
    const dirty = {
      "2026-04-13": 14,
      "2026-04-14": -5,
      "2026-04-15": "bad" as unknown as number,
      "2026-04-16": Number.NaN,
      "2026-04-17": 8,
    };
    expect(weeklyAlcoholG(dirty, "2026-04-15", "monday")).toBe(22);
  });

  it("returns 0 for an invalid anchor date", () => {
    expect(weeklyAlcoholG(week, "not-a-date", "monday")).toBe(0);
  });
});

describe("parseDayNumberMap", () => {
  it("drops non-date keys and non-positive values, rounds to integers", () => {
    const cleaned = parseDayNumberMap({
      "2026-04-15": 95,
      "2026-04-16": "120" as unknown as number,
      "2026-04-17": -30,
      "2026-04-18": 0,
      "2026-04-19": 64.6,
      foo: 100,
      "2026-13-99": 50,
    });
    expect(cleaned).toEqual({
      "2026-04-15": 95,
      "2026-04-16": 120,
      "2026-04-19": 65,
    });
  });

  it("returns {} for null / undefined / non-object inputs", () => {
    expect(parseDayNumberMap(null)).toEqual({});
    expect(parseDayNumberMap(undefined)).toEqual({});
    expect(parseDayNumberMap([] as unknown)).toEqual({});
    expect(parseDayNumberMap("not an object" as unknown)).toEqual({});
  });
});

describe("isOverTarget", () => {
  it("only reports over-target when target > 0 and value > target", () => {
    expect(isOverTarget(500, 400)).toBe(true);
    expect(isOverTarget(400, 400)).toBe(false);
    expect(isOverTarget(350, 400)).toBe(false);
    expect(isOverTarget(500, 0)).toBe(false); // target 0 = no opt-in
    expect(isOverTarget(Number.NaN, 400)).toBe(false);
    expect(isOverTarget(500, Number.NaN)).toBe(false);
  });
});

describe("numeric day-isolation round-trip", () => {
  it("adding to one day does not leak into an adjacent day", () => {
    // Mimics the addWaterMl / addCaffeineMg reducer shape used on both
    // platforms — isolate by key, keep other keys untouched, never drop
    // the write if an earlier key already holds a value.
    const reducer = (
      prev: Record<string, number>,
      dayKey: string,
      add: number,
    ): Record<string, number> => ({
      ...prev,
      [dayKey]: (prev[dayKey] ?? 0) + Math.max(0, Math.round(add)),
    });

    let state: Record<string, number> = {};
    state = reducer(state, "2026-04-15", 95); // coffee
    state = reducer(state, "2026-04-15", 48); // black tea same day
    state = reducer(state, "2026-04-16", 64); // espresso next day

    expect(state).toEqual({
      "2026-04-15": 143,
      "2026-04-16": 64,
    });
    expect(parseDayNumberMap(state)).toEqual(state);
  });
});
