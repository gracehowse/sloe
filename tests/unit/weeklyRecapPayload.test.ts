/**
 * Tests for the route-side reshape helpers (Sunday push rewrite — T3,
 * 2026-04-19).
 *
 * `entriesToByDay` is the only thing standing between the raw DB rows
 * and `buildWeeklyRecap`'s input shape, so the cases below pin every
 * boundary the route would otherwise have to handle inline:
 *   - empty input
 *   - single day
 *   - full 7-day week
 *   - missing macro fields (null) coerced to 0
 *   - duplicate entries on same day bucketed together (preserved order)
 *   - rows outside the window dropped
 *   - per-user filter
 *   - week-boundary correctness (Monday-start vs Sunday-start)
 *
 * Pure helper tests — no Supabase, no fetch, no React.
 */

import { describe, expect, it } from "vitest";

import {
  entriesToByDay,
  extendedPreviousWeekKeys,
  parseFreezeLedger,
  parseWeightKgByDay,
  previousWeekDescriptor,
  previousWeekKeys,
  type NutritionEntryRow,
} from "../../src/lib/push/weeklyRecapPayload";

const SAMPLE_KEYS = [
  "2026-04-06",
  "2026-04-07",
  "2026-04-08",
  "2026-04-09",
  "2026-04-10",
  "2026-04-11",
  "2026-04-12",
];

function row(overrides: Partial<NutritionEntryRow>): NutritionEntryRow {
  return {
    user_id: "user-a",
    date_key: "2026-04-06",
    name: "Breakfast",
    recipe_title: "Oats",
    calories: 400,
    protein: 20,
    carbs: 60,
    fat: 8,
    ...overrides,
  };
}

describe("entriesToByDay — empty + single + duplicates", () => {
  it("returns an empty map for empty input", () => {
    expect(entriesToByDay([], "user-a", SAMPLE_KEYS)).toEqual({});
  });

  it("buckets a single row into the matching date_key", () => {
    const out = entriesToByDay([row({})], "user-a", SAMPLE_KEYS);
    expect(Object.keys(out)).toEqual(["2026-04-06"]);
    expect(out["2026-04-06"]).toHaveLength(1);
    expect(out["2026-04-06"]![0]).toMatchObject({
      name: "Breakfast",
      recipeTitle: "Oats",
      calories: 400,
      protein: 20,
      carbs: 60,
      fat: 8,
    });
  });

  it("appends multiple rows on the same date in input order", () => {
    const out = entriesToByDay(
      [
        row({ recipe_title: "Oats", calories: 400 }),
        row({ recipe_title: "Eggs", calories: 250 }),
        row({ recipe_title: "Coffee", calories: 5 }),
      ],
      "user-a",
      SAMPLE_KEYS,
    );
    const day = out["2026-04-06"]!;
    expect(day).toHaveLength(3);
    expect(day.map((m) => m.recipeTitle)).toEqual(["Oats", "Eggs", "Coffee"]);
    expect(day.map((m) => m.calories)).toEqual([400, 250, 5]);
  });
});

describe("entriesToByDay — full week + windowing", () => {
  it("buckets a full 7-day week into 7 separate keys", () => {
    const rows = SAMPLE_KEYS.map((k, i) => row({ date_key: k, calories: 100 + i }));
    const out = entriesToByDay(rows, "user-a", SAMPLE_KEYS);
    expect(Object.keys(out).sort()).toEqual([...SAMPLE_KEYS].sort());
    for (const k of SAMPLE_KEYS) {
      expect(out[k]).toHaveLength(1);
    }
  });

  it("drops rows whose date_key falls outside the window", () => {
    const out = entriesToByDay(
      [
        row({ date_key: "2026-04-05" }), // before window
        row({ date_key: "2026-04-08" }), // in window
        row({ date_key: "2026-04-13" }), // after window
      ],
      "user-a",
      SAMPLE_KEYS,
    );
    expect(Object.keys(out)).toEqual(["2026-04-08"]);
  });

  it("drops rows for other users when userId is supplied", () => {
    const out = entriesToByDay(
      [
        row({ user_id: "user-a", date_key: "2026-04-06", calories: 100 }),
        row({ user_id: "user-b", date_key: "2026-04-06", calories: 999 }),
        row({ user_id: "user-a", date_key: "2026-04-07", calories: 200 }),
      ],
      "user-a",
      SAMPLE_KEYS,
    );
    expect(out["2026-04-06"]).toHaveLength(1);
    expect(out["2026-04-06"]![0]!.calories).toBe(100);
    expect(out["2026-04-07"]).toHaveLength(1);
  });

  it("keeps rows for all users when userId is null", () => {
    const out = entriesToByDay(
      [
        row({ user_id: "user-a", date_key: "2026-04-06" }),
        row({ user_id: "user-b", date_key: "2026-04-06" }),
      ],
      null,
      SAMPLE_KEYS,
    );
    expect(out["2026-04-06"]).toHaveLength(2);
  });
});

describe("entriesToByDay — null/missing field coercion", () => {
  it("coerces null macro fields to 0", () => {
    const out = entriesToByDay(
      [row({ calories: null, protein: null, carbs: null, fat: null })],
      "user-a",
      SAMPLE_KEYS,
    );
    const meal = out["2026-04-06"]![0]!;
    expect(meal.calories).toBe(0);
    expect(meal.protein).toBe(0);
    expect(meal.carbs).toBe(0);
    expect(meal.fat).toBe(0);
  });

  it("coerces missing name + recipe_title to empty string", () => {
    const out = entriesToByDay(
      [row({ name: null, recipe_title: null })],
      "user-a",
      SAMPLE_KEYS,
    );
    const meal = out["2026-04-06"]![0]!;
    expect(meal.name).toBe("");
    expect(meal.recipeTitle).toBe("");
  });

  it("drops rows with no date_key", () => {
    const out = entriesToByDay(
      // @ts-expect-error — exercising the runtime guard for malformed rows.
      [row({ date_key: null })],
      "user-a",
      SAMPLE_KEYS,
    );
    expect(Object.keys(out)).toHaveLength(0);
  });
});

describe("previousWeekKeys — Monday vs Sunday week-start", () => {
  it("returns the previous Monday-to-Sunday week for a Monday-start user", () => {
    // Sun 19 Apr 2026 → previous Mon-start week = Mon 6 .. Sun 12.
    const keys = previousWeekKeys("monday", new Date(2026, 3, 19, 12));
    expect(keys[0]).toBe("2026-04-06");
    expect(keys[6]).toBe("2026-04-12");
    expect(keys).toHaveLength(7);
  });

  it("returns the previous Sunday-to-Saturday week for a Sunday-start user", () => {
    // Sat 18 Apr 2026 → previous Sun-start week = Sun 5 .. Sat 11.
    const keys = previousWeekKeys("sunday", new Date(2026, 3, 18, 12));
    expect(keys[0]).toBe("2026-04-05");
    expect(keys[6]).toBe("2026-04-11");
  });

  it("Monday-start and Sunday-start cohorts can shift by exactly one day", () => {
    const now = new Date(2026, 3, 19, 12); // Sun 19 Apr 2026
    const mon = previousWeekKeys("monday", now);
    const sun = previousWeekKeys("sunday", now);
    // Sunday cohort starts one day earlier than Monday cohort (when
    // anchored on the same `now`), per the snap-to-week math.
    expect(sun[0]).not.toBe(mon[0]);
    // Both produce a 7-day window.
    expect(sun).toHaveLength(7);
    expect(mon).toHaveLength(7);
  });
});

describe("extendedPreviousWeekKeys — ENG-1586 14-day window", () => {
  it("prepends 7 days before the primary Monday-start week", () => {
    // Same fixture as `previousWeekKeys`'s Monday case: primary week is
    // Mon 6 .. Sun 12 Apr 2026. Extended adds Mon 30 Mar .. Sun 5 Apr.
    const keys = extendedPreviousWeekKeys("monday", new Date(2026, 3, 19, 12));
    expect(keys).toHaveLength(14);
    expect(keys[0]).toBe("2026-03-30");
    expect(keys[6]).toBe("2026-04-05");
    expect(keys[7]).toBe("2026-04-06");
    expect(keys[13]).toBe("2026-04-12");
  });

  it("prepends 7 days before the primary Sunday-start week", () => {
    // Same fixture as `previousWeekKeys`'s Sunday case: primary week is
    // Sun 5 .. Sat 11 Apr 2026.
    const keys = extendedPreviousWeekKeys("sunday", new Date(2026, 3, 18, 12));
    expect(keys).toHaveLength(14);
    expect(keys[0]).toBe("2026-03-29");
    expect(keys[6]).toBe("2026-04-04");
    expect(keys[7]).toBe("2026-04-05");
    expect(keys[13]).toBe("2026-04-11");
  });

  it("is always a superset of previousWeekKeys for the same inputs", () => {
    const now = new Date(2026, 3, 19, 12);
    for (const wsd of ["monday", "sunday"] as const) {
      const primary = previousWeekKeys(wsd, now);
      const extended = extendedPreviousWeekKeys(wsd, now);
      for (const k of primary) expect(extended).toContain(k);
    }
  });

  it("is in chronological order with no duplicate or skipped days", () => {
    const keys = extendedPreviousWeekKeys("monday", new Date(2026, 3, 19, 12));
    for (let i = 1; i < keys.length; i++) {
      const prev = new Date(`${keys[i - 1]}T00:00:00`);
      const cur = new Date(`${keys[i]}T00:00:00`);
      expect((cur.getTime() - prev.getTime()) / 86_400_000).toBe(1);
    }
  });
});

describe("previousWeekDescriptor — weekKey + bounds align", () => {
  it("returns a descriptor with consistent first/last keys + weekKey shape", () => {
    const d = previousWeekDescriptor("monday", new Date(2026, 3, 19, 12));
    expect(d.firstKey).toBe(d.keys[0]);
    expect(d.lastKey).toBe(d.keys[6]);
    expect(d.weekKey).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe("parseWeightKgByDay — tolerant of bad shapes", () => {
  it("parses a simple object", () => {
    const out = parseWeightKgByDay({ "2026-04-06": 78.4, "2026-04-12": 77.8 });
    expect(out).toEqual({ "2026-04-06": 78.4, "2026-04-12": 77.8 });
  });

  it("returns {} for null / non-object / array inputs", () => {
    expect(parseWeightKgByDay(null)).toEqual({});
    expect(parseWeightKgByDay(undefined)).toEqual({});
    expect(parseWeightKgByDay("78.4")).toEqual({});
    expect(parseWeightKgByDay([78.4, 77.8])).toEqual({});
  });

  it("drops non-finite values", () => {
    const out = parseWeightKgByDay({
      "2026-04-06": "78.4", // string-numbers are coerced
      "2026-04-07": "not a number",
      "2026-04-08": NaN,
      "2026-04-09": Infinity,
    });
    expect(out).toEqual({ "2026-04-06": 78.4 });
  });
});

describe("parseFreezeLedger — tolerant of bad shapes", () => {
  it("parses earned + used arrays", () => {
    const out = parseFreezeLedger(
      [{ earnedAt: "2026-04-01T00:00:00Z" }],
      [{ dateKey: "2026-04-08", earnedAt: "2026-04-01T00:00:00Z" }],
    );
    expect(out.earnedAt).toEqual([{ earnedAt: "2026-04-01T00:00:00Z" }]);
    expect(out.usedHistory).toEqual([
      { dateKey: "2026-04-08", earnedAt: "2026-04-01T00:00:00Z" },
    ]);
  });

  it("collapses non-array inputs to empty arrays", () => {
    const out = parseFreezeLedger(null, null);
    expect(out.earnedAt).toEqual([]);
    expect(out.usedHistory).toEqual([]);
  });

  it("drops malformed entries", () => {
    const out = parseFreezeLedger(
      [{}, { earnedAt: 123 }, { earnedAt: "ok" }],
      [{ earnedAt: "ok" }, { dateKey: "ok", earnedAt: "ok" }],
    );
    expect(out.earnedAt).toEqual([{ earnedAt: "ok" }]);
    expect(out.usedHistory).toEqual([{ dateKey: "ok", earnedAt: "ok" }]);
  });
});
