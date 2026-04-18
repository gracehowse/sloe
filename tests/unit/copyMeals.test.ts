import { describe, expect, it } from "vitest";
import {
  addDays,
  cloneMealWithoutId,
  expandDateRange,
  sanitizeCopyTargets,
  todayKey,
  type MealClonable,
} from "@/lib/nutrition/copyMeals";

type TestMeal = MealClonable & { id: string };

function meal(overrides: Partial<TestMeal> = {}): TestMeal {
  return {
    id: "meal-1",
    name: "Lunch",
    recipeTitle: "Chicken salad",
    time: "12:30",
    calories: 420,
    protein: 38,
    carbs: 20,
    fat: 18,
    fiberG: 7,
    portionMultiplier: 1,
    source: "USDA",
    ...overrides,
  };
}

describe("cloneMealWithoutId", () => {
  it("strips the id field and returns a plain object", () => {
    const m = meal();
    const c = cloneMealWithoutId(m);
    expect((c as Record<string, unknown>).id).toBeUndefined();
    expect(c.name).toBe("Lunch");
    expect(c.recipeTitle).toBe("Chicken salad");
    expect(c.calories).toBe(420);
  });

  it("does not mutate the input", () => {
    const m = meal();
    const before = JSON.stringify(m);
    cloneMealWithoutId(m);
    expect(JSON.stringify(m)).toBe(before);
    expect(m.id).toBe("meal-1");
  });

  it("applies a time override without mutating the input", () => {
    const m = meal({ time: "08:00" });
    const c = cloneMealWithoutId(m, { time: "13:15" });
    expect(c.time).toBe("13:15");
    expect(m.time).toBe("08:00");
  });

  it("preserves optional fields (fiberG, portionMultiplier, source, micros)", () => {
    const m = meal({ fiberG: 9.5, portionMultiplier: 1.5, source: "Open Food Facts", micros: { sugarG: 12 } });
    const c = cloneMealWithoutId(m);
    expect(c.fiberG).toBe(9.5);
    expect(c.portionMultiplier).toBe(1.5);
    expect(c.source).toBe("Open Food Facts");
    expect(c.micros).toEqual({ sugarG: 12 });
  });

  it("does not reuse the same micros reference (caller should still be able to pass either shape)", () => {
    // We don't need a deep clone here — the insert primitive stringifies
    // micros into JSONB — but the top-level object must be a fresh one
    // so mutations on the returned clone can't poison the source meal.
    const m = meal({ micros: { sugarG: 12 } });
    const c = cloneMealWithoutId(m);
    expect(c).not.toBe(m);
  });
});

describe("expandDateRange", () => {
  it("returns a single-day array when start === end", () => {
    expect(expandDateRange("2026-04-17", "2026-04-17")).toEqual(["2026-04-17"]);
  });

  it("returns an inclusive range across days", () => {
    expect(expandDateRange("2026-04-17", "2026-04-20")).toEqual([
      "2026-04-17",
      "2026-04-18",
      "2026-04-19",
      "2026-04-20",
    ]);
  });

  it("returns [] when end is before start", () => {
    expect(expandDateRange("2026-04-20", "2026-04-17")).toEqual([]);
  });

  it("crosses a month boundary correctly", () => {
    expect(expandDateRange("2026-04-29", "2026-05-02")).toEqual([
      "2026-04-29",
      "2026-04-30",
      "2026-05-01",
      "2026-05-02",
    ]);
  });

  it("crosses a year boundary correctly", () => {
    expect(expandDateRange("2025-12-30", "2026-01-02")).toEqual([
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
    ]);
  });

  it("returns [] for invalid keys", () => {
    expect(expandDateRange("not-a-date", "2026-04-18")).toEqual([]);
    expect(expandDateRange("2026-04-17", "2026-13-01")).toEqual([]);
    expect(expandDateRange("2026-4-17", "2026-04-18")).toEqual([]);
  });
});

describe("addDays", () => {
  it("adds a positive number of days", () => {
    expect(addDays("2026-04-17", 1)).toBe("2026-04-18");
    expect(addDays("2026-04-17", 7)).toBe("2026-04-24");
  });

  it("subtracts with a negative number", () => {
    expect(addDays("2026-04-17", -1)).toBe("2026-04-16");
    expect(addDays("2026-04-01", -1)).toBe("2026-03-31");
  });

  it("rolls over month boundary (30-day months)", () => {
    expect(addDays("2026-04-30", 1)).toBe("2026-05-01");
  });

  it("rolls over year boundary", () => {
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles February and leap years", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29"); // leap year
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01"); // non-leap
  });

  it("is DST-safe because it anchors at noon (spring-forward Sun 8 Mar 2026 US)", () => {
    // In Europe/London the DST shift is the last Sunday of March; in
    // US locales it is the second Sunday. The noon anchor means the
    // calendar day can never slide into the previous day when midnight
    // is shifted backwards by an hour.
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01"); // fall-back weekend
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("returns the input unchanged when given an invalid key", () => {
    expect(addDays("not-a-date", 1)).toBe("not-a-date");
  });
});

describe("todayKey", () => {
  it("returns YYYY-MM-DD for the injected date", () => {
    // 15 April 2026, 09:10 local.
    expect(todayKey(new Date(2026, 3, 15, 9, 10))).toBe("2026-04-15");
  });

  it("is stable across times of day for the same calendar day", () => {
    expect(todayKey(new Date(2026, 3, 15, 0, 0, 1))).toBe("2026-04-15");
    expect(todayKey(new Date(2026, 3, 15, 23, 59, 59))).toBe("2026-04-15");
  });
});

describe("sanitizeCopyTargets", () => {
  it("drops the source day and dedupes", () => {
    expect(sanitizeCopyTargets("2026-04-17", ["2026-04-17", "2026-04-18", "2026-04-18", "2026-04-19"])).toEqual([
      "2026-04-18",
      "2026-04-19",
    ]);
  });

  it("returns [] when every target is the source day", () => {
    expect(sanitizeCopyTargets("2026-04-17", ["2026-04-17", "2026-04-17"])).toEqual([]);
  });

  it("drops invalid keys", () => {
    expect(sanitizeCopyTargets("2026-04-17", ["not-a-date", "2026-04-18", "2026-13-99"])).toEqual([
      "2026-04-18",
    ]);
  });

  it("preserves order of first appearance", () => {
    expect(sanitizeCopyTargets("2026-04-17", ["2026-04-20", "2026-04-19", "2026-04-18", "2026-04-19"])).toEqual([
      "2026-04-20",
      "2026-04-19",
      "2026-04-18",
    ]);
  });
});
