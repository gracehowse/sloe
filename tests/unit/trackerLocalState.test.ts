/**
 * @vitest-environment jsdom
 */
/**
 * trackerLocalState — helpers extracted from NutritionTracker.tsx (ENG-621).
 * These cover the loosely-typed normalisers and the localStorage-backed
 * recent-foods / north-star-skip ledgers so the extraction is pinned by tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  RECENT_BARCODE_KEY,
  NORTH_STAR_SKIP_KEY_PREFIX,
  normalizeTrackedDashboardMacros,
  parseStepsDayMap,
  loadRecentFoods,
  pushRecentFood,
  readNorthStarSkippedSet,
  writeNorthStarSkippedSet,
} from "../../src/lib/nutrition/trackerLocalState.ts";

beforeEach(() => {
  localStorage.clear();
});

describe("normalizeTrackedDashboardMacros", () => {
  it("falls back to protein/carbs/fat for non-arrays or empty input", () => {
    expect(normalizeTrackedDashboardMacros(undefined)).toEqual(["protein", "carbs", "fat"]);
    expect(normalizeTrackedDashboardMacros([])).toEqual(["protein", "carbs", "fat"]);
    expect(normalizeTrackedDashboardMacros("protein")).toEqual(["protein", "carbs", "fat"]);
  });

  it("keeps only recognised macro keys", () => {
    expect(normalizeTrackedDashboardMacros(["protein", "sodium", "bogus", 7])).toEqual([
      "protein",
      "sodium",
    ]);
  });

  it("falls back when nothing valid survives the filter", () => {
    expect(normalizeTrackedDashboardMacros(["bogus", "nope"])).toEqual(["protein", "carbs", "fat"]);
  });
});

describe("parseStepsDayMap", () => {
  it("returns {} for non-objects", () => {
    expect(parseStepsDayMap(null)).toEqual({});
    expect(parseStepsDayMap(42)).toEqual({});
  });

  it("coerces numeric strings, rounds, and drops negatives / NaN", () => {
    expect(
      parseStepsDayMap({ "2026-06-01": "1200.7", "2026-06-02": 80, "2026-06-03": -5, "2026-06-04": "x" }),
    ).toEqual({ "2026-06-01": 1201, "2026-06-02": 80 });
  });
});

describe("recent foods ledger", () => {
  it("returns [] when storage is empty or malformed", () => {
    expect(loadRecentFoods()).toEqual([]);
    localStorage.setItem(RECENT_BARCODE_KEY, "{not json");
    expect(loadRecentFoods()).toEqual([]);
    localStorage.setItem(RECENT_BARCODE_KEY, JSON.stringify({ not: "an array" }));
    expect(loadRecentFoods()).toEqual([]);
  });

  it("prepends, de-dupes, and caps at 8 most-recent", () => {
    pushRecentFood("apple");
    pushRecentFood("banana");
    pushRecentFood("apple"); // moves apple back to front, no dupe
    expect(loadRecentFoods()).toEqual(["apple", "banana"]);

    for (let i = 0; i < 10; i++) pushRecentFood(`food-${i}`);
    const recents = loadRecentFoods();
    expect(recents).toHaveLength(8);
    expect(recents[0]).toBe("food-9");
  });
});

describe("north-star skip ledger", () => {
  it("round-trips a set scoped by date key", () => {
    const dateKey = "2026-06-18";
    writeNorthStarSkippedSet(dateKey, new Set(["r1", "r2"]));
    expect(localStorage.getItem(NORTH_STAR_SKIP_KEY_PREFIX + dateKey)).toBe(
      JSON.stringify(["r1", "r2"]),
    );
    expect(readNorthStarSkippedSet(dateKey)).toEqual(new Set(["r1", "r2"]));
  });

  it("returns an empty set for a different day or malformed storage", () => {
    writeNorthStarSkippedSet("2026-06-18", new Set(["r1"]));
    expect(readNorthStarSkippedSet("2026-06-19")).toEqual(new Set());

    localStorage.setItem(NORTH_STAR_SKIP_KEY_PREFIX + "2026-06-20", "{bad");
    expect(readNorthStarSkippedSet("2026-06-20")).toEqual(new Set());

    localStorage.setItem(NORTH_STAR_SKIP_KEY_PREFIX + "2026-06-21", JSON.stringify({ not: "array" }));
    expect(readNorthStarSkippedSet("2026-06-21")).toEqual(new Set());
  });
});
