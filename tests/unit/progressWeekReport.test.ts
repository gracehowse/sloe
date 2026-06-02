import { describe, expect, it } from "vitest";
import {
  buildWeekStats,
  type WeekActivityAdjustment,
} from "../../src/lib/nutrition/progressWeekReport.ts";
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

/**
 * ENG-787 (2026-05-30) — the Daily Calories chart was colouring bars
 * "over budget" against the BASE target, ignoring the activity bonus the
 * day earned. Grace's report: "This implies i've been over every day but
 * hasn't taken into account the fact i earned bonus cals these days."
 *
 * `effectiveTargetCalories` = base target + that day's earned bonus. These
 * tests pin the four cases that matter: no activity bundle (collapses to
 * base), flag off, a past day that earned a bonus, and snapshot maintenance
 * taking precedence over the fallback.
 */
describe("buildWeekStats — effectiveTargetCalories (ENG-787)", () => {
  // Wed 8 Apr 2026, noon. Monday week = Mon 6th .. Sun 12th. Today = Wed 8th.
  const now = new Date(2026, 3, 8, 12, 0, 0, 0);

  it("collapses to base target when no activity bundle is passed", () => {
    const { days } = buildWeekStats({}, targets, "monday", now);
    for (const d of days) {
      expect(d.effectiveTargetCalories).toBe(d.targetCalories);
      expect(d.effectiveTargetCalories).toBe(2000);
    }
  });

  it("adds no bonus when prefer is false", () => {
    const activity: WeekActivityAdjustment = {
      prefer: false,
      restingByDay: { "2026-04-07": 1500 },
      activeByDay: { "2026-04-07": 600 },
      maintenanceFallback: 1800,
    };
    const { days } = buildWeekStats({}, targets, "monday", now, undefined, activity);
    const tue = days.find((d) => d.key === "2026-04-07")!;
    expect(tue.effectiveTargetCalories).toBe(2000);
  });

  it("adds the earned bonus on a past day (resting + active − maintenance)", () => {
    const activity: WeekActivityAdjustment = {
      prefer: true,
      restingByDay: { "2026-04-07": 1500 },
      activeByDay: { "2026-04-07": 600 },
      maintenanceFallback: 1800,
    };
    const { days } = buildWeekStats({}, targets, "monday", now, undefined, activity);
    const tue = days.find((d) => d.key === "2026-04-07")!;
    // bonus = max(0, 1500 + 600 − 1800) = 300 → 2000 + 300
    expect(tue.effectiveTargetCalories).toBe(2300);
    // Days without activity data stay at base.
    const mon = days.find((d) => d.key === "2026-04-06")!;
    expect(mon.effectiveTargetCalories).toBe(2000);
  });

  it("adds no bonus when active burn is zero (incidental movement is already in maintenance)", () => {
    const activity: WeekActivityAdjustment = {
      prefer: true,
      restingByDay: { "2026-04-07": 1500 },
      activeByDay: { "2026-04-07": 0 },
      maintenanceFallback: 1800,
    };
    const { days } = buildWeekStats({}, targets, "monday", now, undefined, activity);
    const tue = days.find((d) => d.key === "2026-04-07")!;
    expect(tue.effectiveTargetCalories).toBe(2000);
  });

  it("prefers the per-day snapshot maintenance over the fallback", () => {
    const activity: WeekActivityAdjustment = {
      prefer: true,
      restingByDay: { "2026-04-07": 1500 },
      activeByDay: { "2026-04-07": 600 },
      // Snapshot says maintenance was 2000 that day; fallback is 1800.
      maintenanceByDay: { "2026-04-07": 2000 },
      maintenanceFallback: 1800,
    };
    const { days } = buildWeekStats({}, targets, "monday", now, undefined, activity);
    const tue = days.find((d) => d.key === "2026-04-07")!;
    // bonus = max(0, 1500 + 600 − 2000) = 100 → 2000 + 100. If the fallback
    // (1800) leaked through it would be 2300, so this pins precedence.
    expect(tue.effectiveTargetCalories).toBe(2100);
  });

  it("uses the projected-EOD model for today (adds future resting burn)", () => {
    const activity: WeekActivityAdjustment = {
      prefer: true,
      restingByDay: { "2026-04-08": 1500 },
      activeByDay: { "2026-04-08": 600 },
      maintenanceFallback: 1800,
    };
    const { days } = buildWeekStats({}, targets, "monday", now, undefined, activity);
    const wed = days.find((d) => d.key === "2026-04-08")!;
    // At noon: hoursElapsed = 12, hourlyResting = 1500/12 = 125,
    // futureBurn = round(125 × 12) = 1500, projected = 1500 + 600 + 1500 = 3600,
    // bonus = max(0, 3600 − 1800) = 1800 → 2000 + 1800.
    expect(wed.effectiveTargetCalories).toBe(3800);
  });
});
