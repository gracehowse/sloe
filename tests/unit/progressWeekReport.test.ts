import { describe, expect, it } from "vitest";
import { buildWeekStats } from "../../src/lib/nutrition/progressWeekReport.ts";
import type { ByDay, JournalMeal } from "../../src/lib/nutritionJournal.ts";

function meal(calories: number, protein = 0, carbs = 0, fat = 0): JournalMeal {
  return {
    id: `m-${Math.random().toString(36).slice(2, 8)}`,
    name: "test",
    slot: "Breakfast",
    calories,
    protein,
    carbs,
    fat,
  } as unknown as JournalMeal;
}

const targets = { calories: 2000, protein: 150, carbs: 200, fat: 70 };

describe("buildWeekStats", () => {
  it("monday start: week runs Mon..Sun containing anchor", () => {
    // Wed 8 Apr 2026
    const now = new Date(2026, 3, 8, 12, 0, 0, 0);
    const byDay: ByDay = {
      "2026-04-06": [meal(500)],
      "2026-04-12": [meal(700)],
    };
    const { days } = buildWeekStats(byDay, targets, "monday", now);
    expect(days).toHaveLength(7);
    expect(days[0].key).toBe("2026-04-06");
    expect(days[6].key).toBe("2026-04-12");
    expect(days[0].label).toBe("Mon");
    expect(days[6].label).toBe("Sun");
    expect(days[0].calories).toBe(500);
    expect(days[6].calories).toBe(700);
  });

  it("sunday start: week runs Sun..Sat containing anchor", () => {
    // Wed 8 Apr 2026 → Sun 5 Apr – Sat 11 Apr
    const now = new Date(2026, 3, 8, 12, 0, 0, 0);
    const { days } = buildWeekStats({}, targets, "sunday", now);
    expect(days[0].key).toBe("2026-04-05");
    expect(days[6].key).toBe("2026-04-11");
    expect(days[0].label).toBe("Sun");
    expect(days[6].label).toBe("Sat");
  });

  it("monday start when anchor is Sunday: keeps anchor as the last day", () => {
    // Sun 12 Apr 2026 → week Mon 6 Apr – Sun 12 Apr
    const now = new Date(2026, 3, 12, 12, 0, 0, 0);
    const { days } = buildWeekStats({}, targets, "monday", now);
    expect(days[0].key).toBe("2026-04-06");
    expect(days[6].key).toBe("2026-04-12");
  });

  it("sunday start when anchor is Sunday: anchor is first day", () => {
    const now = new Date(2026, 3, 12, 12, 0, 0, 0);
    const { days } = buildWeekStats({}, targets, "sunday", now);
    expect(days[0].key).toBe("2026-04-12");
    expect(days[6].key).toBe("2026-04-18");
  });

  it("averages and adherence ignore days with no food in the denominator", () => {
    const now = new Date(2026, 3, 8, 12, 0, 0, 0); // Wed, monday week = 6th..12th
    const byDay: ByDay = {
      "2026-04-06": [meal(2000, 150, 200, 70)],
      "2026-04-07": [meal(2000, 150, 200, 70)],
    };
    const stats = buildWeekStats(byDay, targets, "monday", now);
    expect(stats.daysWithFood).toBe(2);
    expect(stats.avgCalories).toBe(2000);
    expect(stats.avgProtein).toBe(150);
    expect(stats.proteinAdherence).toBe(100);
  });
});
