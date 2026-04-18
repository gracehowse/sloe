/**
 * Edge-case coverage for buildWeekStats: DST weeks, zero targets, empty data,
 * Saturday anchor, negative-macro clamp.
 * Complements progressWeekReport.test.ts.
 */
import { describe, expect, it } from "vitest";
import { buildWeekStats, type MealMacros, type ByDayOf } from "../../src/lib/nutrition/progressWeekReport.ts";

function meal(calories: number, protein = 0, carbs = 0, fat = 0): MealMacros {
  return { calories, protein, carbs, fat };
}

const targets = { calories: 2000, protein: 150, carbs: 200, fat: 70 };

describe("buildWeekStats — anchor edges", () => {
  it("Sat anchor, monday start: Sat at index 5, Sun at 6", () => {
    const now = new Date(2026, 3, 11, 12, 0, 0, 0);
    const { days } = buildWeekStats<MealMacros>({}, targets, "monday", now);
    expect(days[0].key).toBe("2026-04-06");
    expect(days[5].key).toBe("2026-04-11");
    expect(days[5].label).toBe("Sat");
    expect(days[6].key).toBe("2026-04-12");
    expect(days[6].label).toBe("Sun");
  });

  it("Sat anchor, sunday start: Sat is the last day", () => {
    const now = new Date(2026, 3, 11, 12, 0, 0, 0);
    const { days } = buildWeekStats<MealMacros>({}, targets, "sunday", now);
    expect(days[0].key).toBe("2026-04-05");
    expect(days[6].key).toBe("2026-04-11");
    expect(days[6].label).toBe("Sat");
  });
});

describe("buildWeekStats — empty byDay", () => {
  it("7 days with zeroes and no NaN anywhere", () => {
    const now = new Date(2026, 3, 8, 12, 0, 0, 0);
    const stats = buildWeekStats<MealMacros>({}, targets, "monday", now);
    expect(stats.days).toHaveLength(7);
    expect(stats.daysWithFood).toBe(0);
    expect(stats.avgCalories).toBe(0);
    expect(stats.avgProtein).toBe(0);
    expect(stats.proteinAdherence).toBe(0);
    expect(stats.carbsAdherence).toBe(0);
    expect(stats.fatAdherence).toBe(0);
    expect(stats.proteinOnTarget).toBe(0);
    for (const d of stats.days) {
      expect(Number.isFinite(d.calories)).toBe(true);
    }
  });
});

describe("buildWeekStats — degenerate targets (G4 fix)", () => {
  // Bug previously: target.protein = 0 → proteinAdherence = Infinity and
  // proteinOnTarget counted every day (p >= 0 * 0.9 === p >= 0).
  // Fixed: guard against zero targets so adherence is 0 and
  // proteinOnTarget is 0 when the target is zero.
  it("target.protein = 0 → proteinAdherence = 0, proteinOnTarget = 0", () => {
    const now = new Date(2026, 3, 8, 12, 0, 0, 0);
    const byDay: ByDayOf<MealMacros> = { "2026-04-06": [meal(500, 30, 50, 15)] };
    const stats = buildWeekStats<MealMacros>(
      byDay,
      { calories: 2000, protein: 0, carbs: 200, fat: 70 },
      "monday",
      now,
    );
    expect(Number.isFinite(stats.proteinAdherence)).toBe(true);
    expect(stats.proteinAdherence).toBe(0);
    expect(stats.proteinOnTarget).toBe(0);
  });

  it("all targets = 0 does not throw; averages finite, adherence 0", () => {
    const now = new Date(2026, 3, 8, 12, 0, 0, 0);
    const byDay: ByDayOf<MealMacros> = { "2026-04-06": [meal(0, 0, 0, 0)] };
    const stats = buildWeekStats<MealMacros>(
      byDay,
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
      "monday",
      now,
    );
    expect(Number.isFinite(stats.avgCalories)).toBe(true);
    expect(stats.avgCalories).toBe(0);
    expect(stats.proteinAdherence).toBe(0);
    expect(stats.carbsAdherence).toBe(0);
    expect(stats.fatAdherence).toBe(0);
  });

  it("target.carbs = 0 but carbs logged: adherence stays 0", () => {
    const now = new Date(2026, 3, 8, 12, 0, 0, 0);
    const byDay: ByDayOf<MealMacros> = { "2026-04-06": [meal(500, 30, 80, 15)] };
    const stats = buildWeekStats<MealMacros>(
      byDay,
      { calories: 2000, protein: 150, carbs: 0, fat: 70 },
      "monday",
      now,
    );
    expect(stats.carbsAdherence).toBe(0);
  });
});

describe("buildWeekStats — DST weeks produce 7 unique keys", () => {
  it("spring-forward week monday start", () => {
    const now = new Date(2026, 2, 4, 12, 0, 0, 0);
    const { days } = buildWeekStats<MealMacros>({}, targets, "monday", now);
    const keys = days.map((d) => d.key);
    expect(new Set(keys).size).toBe(7);
    expect(keys).toEqual([
      "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05",
      "2026-03-06", "2026-03-07", "2026-03-08",
    ]);
  });

  it("fall-back week sunday start", () => {
    const now = new Date(2026, 10, 3, 12, 0, 0, 0);
    const { days } = buildWeekStats<MealMacros>({}, targets, "sunday", now);
    const keys = days.map((d) => d.key);
    expect(new Set(keys).size).toBe(7);
    expect(keys).toEqual([
      "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04",
      "2026-11-05", "2026-11-06", "2026-11-07",
    ]);
  });

  it("00:30 anchor inside spring-forward week still yields the correct 7 keys", () => {
    // buildWeekStats does NOT pin anchor to noon; this test guards the
    // current behaviour. If it ever fails, decide whether to add the
    // noon-pin that weekSummaryWindow uses.
    const now = new Date(2026, 2, 4, 0, 30, 0, 0);
    const { days } = buildWeekStats<MealMacros>({}, targets, "monday", now);
    expect(days.map((d) => d.key)).toEqual([
      "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05",
      "2026-03-06", "2026-03-07", "2026-03-08",
    ]);
  });
});

describe("buildWeekStats — day labels match weekStart", () => {
  it("monday start: Mon..Sun", () => {
    const now = new Date(2026, 3, 8, 12, 0, 0, 0);
    const { days } = buildWeekStats<MealMacros>({}, targets, "monday", now);
    expect(days.map((d) => d.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });
  it("sunday start: Sun..Sat", () => {
    const now = new Date(2026, 3, 8, 12, 0, 0, 0);
    const { days } = buildWeekStats<MealMacros>({}, targets, "sunday", now);
    expect(days.map((d) => d.label)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });
});

describe("buildWeekStats — negative macros are clamped to 0", () => {
  it("per-meal negatives do not underflow day totals", () => {
    const now = new Date(2026, 3, 8, 12, 0, 0, 0);
    const byDay: ByDayOf<MealMacros> = {
      "2026-04-06": [meal(-500, -20, -30, -10), meal(400, 20, 30, 10)],
    };
    const { days } = buildWeekStats<MealMacros>(byDay, targets, "monday", now);
    expect(days[0].calories).toBe(400);
    expect(days[0].protein).toBe(20);
    expect(days[0].carbs).toBe(30);
    expect(days[0].fat).toBe(10);
  });
});
