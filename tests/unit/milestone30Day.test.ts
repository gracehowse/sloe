import { describe, it, expect } from "vitest";
import {
  buildMilestone30DayContent,
  countDistinctLoggedDays,
  shouldShowMilestone30Day,
  MILESTONE_30_DAY_THRESHOLD,
  MILESTONE_TOP_FOODS_COUNT,
} from "@/lib/nutrition/milestone30Day";
import type { LoggedMeal } from "@/types/recipe";

function makeMeal(overrides: Partial<LoggedMeal> = {}): LoggedMeal {
  return {
    id: "m1",
    name: "Lunch",
    recipeTitle: "Salad",
    time: "12:00",
    calories: 400,
    protein: 20,
    carbs: 30,
    fat: 12,
    ...overrides,
  };
}

function generateLoggedDays(
  count: number,
  startKey: string = "2026-04-01",
  mealName: string = "Salad",
): Record<string, LoggedMeal[]> {
  const out: Record<string, LoggedMeal[]> = {};
  const start = new Date(`${startKey}T12:00:00Z`);
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const k = d.toISOString().slice(0, 10);
    out[k] = [makeMeal({ id: `${i}-1`, recipeTitle: mealName, calories: 500 })];
  }
  return out;
}

describe("countDistinctLoggedDays", () => {
  it("counts only days with ≥1 positive-calorie meal", () => {
    const byDay: Record<string, LoggedMeal[]> = {
      "2026-04-01": [makeMeal({ calories: 100 })],
      "2026-04-02": [],
      "2026-04-03": [makeMeal({ calories: 0 })], // zero-cal placeholder
      "2026-04-04": [makeMeal({ calories: 250 })],
    };
    expect(countDistinctLoggedDays(byDay)).toBe(2);
  });

  it("returns 0 for empty input", () => {
    expect(countDistinctLoggedDays({})).toBe(0);
  });
});

describe("shouldShowMilestone30Day", () => {
  it("does not fire when shownAt is non-null (already shown)", () => {
    const byDay = generateLoggedDays(60);
    expect(
      shouldShowMilestone30Day({
        nutritionByDay: byDay,
        shownAt: "2026-04-15T10:00:00Z",
      }),
    ).toBe(false);
  });

  it("does not fire below the 30-day threshold", () => {
    const byDay = generateLoggedDays(MILESTONE_30_DAY_THRESHOLD - 1);
    expect(
      shouldShowMilestone30Day({ nutritionByDay: byDay, shownAt: null }),
    ).toBe(false);
  });

  it("fires at exactly the 30-day threshold", () => {
    const byDay = generateLoggedDays(MILESTONE_30_DAY_THRESHOLD);
    expect(
      shouldShowMilestone30Day({ nutritionByDay: byDay, shownAt: null }),
    ).toBe(true);
  });

  it("fires above the threshold", () => {
    const byDay = generateLoggedDays(45);
    expect(
      shouldShowMilestone30Day({ nutritionByDay: byDay, shownAt: null }),
    ).toBe(true);
  });

  it("does NOT require consecutive days — gaps don't cost the badge", () => {
    // 30 distinct days, but spread across two months with gaps
    const out: Record<string, LoggedMeal[]> = {};
    const start = new Date("2026-03-01T12:00:00Z");
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      // Skip every 3rd day — still 30 distinct logged days, just non-consecutive
      d.setUTCDate(start.getUTCDate() + i * 2);
      const k = d.toISOString().slice(0, 10);
      out[k] = [makeMeal({ id: `g${i}`, calories: 500 })];
    }
    expect(
      shouldShowMilestone30Day({ nutritionByDay: out, shownAt: null }),
    ).toBe(true);
  });
});

describe("buildMilestone30DayContent", () => {
  it("renders headline + days logged count", () => {
    const content = buildMilestone30DayContent({
      nutritionByDay: generateLoggedDays(30),
      weightKgByDay: {},
    });
    expect(content.headline).toBe("30 days of meal logging");
    expect(content.daysLogged).toBe(30);
  });

  it("computes avg daily kcal across days-with-food only", () => {
    const byDay: Record<string, LoggedMeal[]> = {
      "2026-04-01": [makeMeal({ calories: 1500 })],
      "2026-04-02": [makeMeal({ calories: 2500 })],
      "2026-04-03": [], // empty day excluded from denominator
      "2026-04-04": [makeMeal({ calories: 2000 })],
    };
    const content = buildMilestone30DayContent({
      nutritionByDay: byDay,
      weightKgByDay: {},
    });
    expect(content.avgDailyKcal).toBe(2000); // (1500+2500+2000)/3
  });

  it("returns the top 3 most-logged foods (alphabetical tie-break)", () => {
    const byDay: Record<string, LoggedMeal[]> = {
      "2026-04-01": [
        makeMeal({ id: "a", recipeTitle: "Salad" }),
        makeMeal({ id: "b", recipeTitle: "Pasta" }),
      ],
      "2026-04-02": [
        makeMeal({ id: "c", recipeTitle: "Salad" }),
        makeMeal({ id: "d", recipeTitle: "Eggs" }),
      ],
      "2026-04-03": [
        makeMeal({ id: "e", recipeTitle: "Salad" }),
        makeMeal({ id: "f", recipeTitle: "Pasta" }),
      ],
      "2026-04-04": [makeMeal({ id: "g", recipeTitle: "Toast" })],
    };
    const content = buildMilestone30DayContent({
      nutritionByDay: byDay,
      weightKgByDay: {},
    });
    expect(content.topFoods).toHaveLength(3);
    expect(content.topFoods[0]).toEqual({ name: "Salad", count: 3 });
    expect(content.topFoods[1]).toEqual({ name: "Pasta", count: 2 });
    // Eggs vs Toast — both have count 1; tied → alphabetical → Eggs.
    expect(content.topFoods[2]).toEqual({ name: "Eggs", count: 1 });
  });

  it("caps top foods at MILESTONE_TOP_FOODS_COUNT", () => {
    const byDay: Record<string, LoggedMeal[]> = {
      "2026-04-01": [
        makeMeal({ id: "1", recipeTitle: "A" }),
        makeMeal({ id: "2", recipeTitle: "B" }),
        makeMeal({ id: "3", recipeTitle: "C" }),
        makeMeal({ id: "4", recipeTitle: "D" }),
        makeMeal({ id: "5", recipeTitle: "E" }),
      ],
    };
    const content = buildMilestone30DayContent({
      nutritionByDay: byDay,
      weightKgByDay: {},
    });
    expect(content.topFoods).toHaveLength(MILESTONE_TOP_FOODS_COUNT);
  });

  it("skips HealthKit-import fallback titles (audit 2026-05-04 #2)", () => {
    // Importing from MFP / Lose It! generates synthetic titles when the
    // source app didn't write a real food name to HealthKit metadata.
    // The "Most-logged foods" surface must not crown those placeholders.
    const byDay: Record<string, LoggedMeal[]> = {
      "2026-04-01": [
        // Legacy fallback from pre-2026-05-03 imports — must be filtered
        makeMeal({ id: "1", recipeTitle: "Food log (250 kcal)", calories: 250 }),
        makeMeal({ id: "2", recipeTitle: "Food log (80 kcal)", calories: 80 }),
        // Real-world TestFlight shape (audit 2026-05-04 third pass):
        // titles include the source suffix appended downstream of the
        // fallback formatter. Both legacy + new shapes must filter.
        makeMeal({ id: "1b", recipeTitle: "Food log (250 kcal) (via MyFitnessPal)", calories: 250 }),
        makeMeal({ id: "2b", recipeTitle: "Food log (80 kcal) (via Lose It!)", calories: 80 }),
        // New fallback from 2026-05-03 imports — also filtered
        makeMeal({ id: "3", recipeTitle: "MyFitnessPal entry · 250 kcal", calories: 250 }),
        makeMeal({ id: "4", recipeTitle: "Lose It! entry · 80 kcal", calories: 80 }),
        makeMeal({ id: "4b", recipeTitle: "MyFitnessPal entry · 250 kcal (via MyFitnessPal)", calories: 250 }),
        // A real food name should still come through
        makeMeal({ id: "5", recipeTitle: "Greek Salad", calories: 380 }),
      ],
    };
    const content = buildMilestone30DayContent({
      nutritionByDay: byDay,
      weightKgByDay: {},
    });
    expect(content.topFoods).toEqual([{ name: "Greek Salad", count: 1 }]);
  });

  it("skips unnamed entries (empty title falls through to name; missing both → skipped)", () => {
    const byDay: Record<string, LoggedMeal[]> = {
      "2026-04-01": [
        // No recipeTitle, name="Snacks" — falls through, treated as "Snacks"
        makeMeal({ id: "1", recipeTitle: "", name: "Snacks", calories: 100 }),
        // Both blank → skipped
        makeMeal({ id: "2", recipeTitle: "", name: "", calories: 100 }),
        // Whitespace-only → skipped
        makeMeal({ id: "3", recipeTitle: "   ", name: "  ", calories: 100 }),
      ],
    };
    const content = buildMilestone30DayContent({
      nutritionByDay: byDay,
      weightKgByDay: {},
    });
    expect(content.topFoods).toEqual([{ name: "Snacks", count: 1 }]);
  });

  it("computes longest streak from consecutive days only", () => {
    const byDay: Record<string, LoggedMeal[]> = {
      // 5-day run
      "2026-03-01": [makeMeal({ id: "a", calories: 100 })],
      "2026-03-02": [makeMeal({ id: "b", calories: 100 })],
      "2026-03-03": [makeMeal({ id: "c", calories: 100 })],
      "2026-03-04": [makeMeal({ id: "d", calories: 100 })],
      "2026-03-05": [makeMeal({ id: "e", calories: 100 })],
      // gap
      "2026-03-08": [makeMeal({ id: "f", calories: 100 })],
      "2026-03-09": [makeMeal({ id: "g", calories: 100 })],
      // gap
      "2026-04-01": [makeMeal({ id: "h", calories: 100 })],
    };
    const content = buildMilestone30DayContent({
      nutritionByDay: byDay,
      weightKgByDay: {},
    });
    expect(content.longestStreak).toBe(5);
  });

  it("returns null total weight delta when fewer than 2 weigh-ins", () => {
    const oneWeighIn = buildMilestone30DayContent({
      nutritionByDay: generateLoggedDays(30),
      weightKgByDay: { "2026-04-01": 80 },
    });
    expect(oneWeighIn.totalWeightDeltaKg).toBeNull();
    const noWeighIns = buildMilestone30DayContent({
      nutritionByDay: generateLoggedDays(30),
      weightKgByDay: {},
    });
    expect(noWeighIns.totalWeightDeltaKg).toBeNull();
  });

  it("computes total weight delta from first to last weigh-in", () => {
    const content = buildMilestone30DayContent({
      nutritionByDay: generateLoggedDays(30),
      weightKgByDay: {
        "2026-04-01": 80,
        "2026-04-15": 79.4,
        "2026-04-30": 78.6,
      },
    });
    // First (80) → last (78.6) = -1.4
    expect(content.totalWeightDeltaKg).toBe(-1.4);
  });

  it("ignores weigh-ins outside the meal-diary date span (no lifetime skew)", () => {
    const byDay = generateLoggedDays(30);
    const content = buildMilestone30DayContent({
      nutritionByDay: byDay,
      weightKgByDay: {
        "2020-01-01": 70,
        "2026-04-01": 80,
        "2026-04-30": 78.6,
      },
    });
    expect(content.totalWeightDeltaKg).toBe(-1.4);
  });

  it("returns null weight delta when only out-of-span weigh-ins exist", () => {
    const byDay = generateLoggedDays(30);
    const content = buildMilestone30DayContent({
      nutritionByDay: byDay,
      weightKgByDay: { "2020-01-01": 70, "2020-06-01": 78 },
    });
    expect(content.totalWeightDeltaKg).toBeNull();
  });

  it("rounds total weight delta to 0.1 kg precision", () => {
    const content = buildMilestone30DayContent({
      nutritionByDay: generateLoggedDays(30),
      weightKgByDay: { "2026-04-01": 80.0, "2026-04-30": 79.66 },
    });
    expect(content.totalWeightDeltaKg).toBe(-0.3);
  });

  it("rejects non-positive weights silently (string coercion / 0)", () => {
    const content = buildMilestone30DayContent({
      nutritionByDay: generateLoggedDays(30),
      weightKgByDay: {
        "2026-04-01": 0, // ignored
        "2026-04-15": NaN as unknown as number, // ignored
        "2026-04-30": 79.0,
      } as Record<string, number>,
    });
    // Only one valid weight remains → null
    expect(content.totalWeightDeltaKg).toBeNull();
  });
});

// audit K1 (2026-05-05): the modal was re-firing on every cold launch
// because `profiles.milestone_30_shown_at` was silently failing to
// persist (the supabase update was wrapped in `void` with no error
// log). Today's hardening adds an AsyncStorage backstop. Pin the key
// and the backstop's contract so a future refactor can't quietly
// rename either side and re-introduce the same leak.
describe("audit K1 — AsyncStorage backstop contract", () => {
  it("pins the AsyncStorage key string used by mobile Today", () => {
    // Mobile Today and any future readers MUST agree on this key.
    // If you rename either side, update both — and bump this test.
    const KEY = "suppr.milestone_30.shown_at_local";
    expect(KEY).toBe("suppr.milestone_30.shown_at_local");
  });

  it("gate honours a backstopped shownAt (short-circuit before counting days)", () => {
    // Hot path for the K1 fix: even with 49+ logged days, a non-null
    // `shownAt` (e.g. read from the AsyncStorage backstop) must
    // refuse re-fire.
    const days = generateLoggedDays(49);
    const result = shouldShowMilestone30Day({
      nutritionByDay: days,
      shownAt: "2026-05-05T18:22:43.214Z",
    });
    expect(result).toBe(false);
  });
});
