/**
 * ENG-960 — weekday/weekend day-target schedules.
 *
 * Pins the two invariants that make this nutrition-honest:
 *   1. WEEKLY ENERGY NEUTRALITY — a schedule never adds or removes energy
 *      across the 7-day week; high days are boosted and the rest scaled down so
 *      the weekly calorie total matches the flat plan (the user's goal pace is
 *      untouched).
 *   2. FLAT PATH IS A PURE IDENTITY — no schedule (or "same"/malformed) returns
 *      the base numbers verbatim, so an un-opted-in user's targets never move.
 */
import { describe, expect, it } from "vitest";
import {
  parseDayTargetSchedule,
  weekdayIndexFromDateKey,
  resolveEffectiveDayTargets,
  effectiveTargetsForDateKey,
  DEFAULT_HIGH_DAYS,
  type BaseDayTargets,
  type WeekdayIndex,
} from "@/lib/nutrition/dayTargetSchedule";

const BASE: BaseDayTargets = {
  calories: 2000,
  proteinG: 150,
  carbsG: 200,
  fatG: 67,
  fiberG: 30,
};

describe("parseDayTargetSchedule", () => {
  it("parses the two presets with an explicit high-day set", () => {
    expect(parseDayTargetSchedule("weekend_lift", [0, 6])).toEqual({
      id: "weekend_lift",
      highDays: [0, 6],
    });
    expect(parseDayTargetSchedule("lighter_weekdays", [6])).toEqual({
      id: "lighter_weekdays",
      highDays: [6],
    });
  });

  it("returns null (flat week) for 'same' / null / unknown ids", () => {
    expect(parseDayTargetSchedule("same", [0, 6])).toBeNull();
    expect(parseDayTargetSchedule(null, [0, 6])).toBeNull();
    expect(parseDayTargetSchedule("nonsense", [0, 6])).toBeNull();
  });

  it("falls back to the weekend default for malformed / empty / all-7 high_days", () => {
    expect(parseDayTargetSchedule("weekend_lift", null)?.highDays).toEqual(DEFAULT_HIGH_DAYS);
    expect(parseDayTargetSchedule("weekend_lift", [])?.highDays).toEqual(DEFAULT_HIGH_DAYS);
    expect(parseDayTargetSchedule("weekend_lift", [0, 1, 2, 3, 4, 5, 6])?.highDays).toEqual(DEFAULT_HIGH_DAYS);
    expect(parseDayTargetSchedule("weekend_lift", ["x", 9, 2.5, 3])?.highDays).toEqual([3]);
  });
});

describe("weekdayIndexFromDateKey", () => {
  it("derives the calendar weekday (Sunday=0)", () => {
    expect(weekdayIndexFromDateKey("2026-07-02")).toBe(4); // Thursday
    expect(weekdayIndexFromDateKey("2026-07-05")).toBe(0); // Sunday
  });
  it("returns null for malformed keys", () => {
    expect(weekdayIndexFromDateKey("2026-7-2")).toBeNull();
    expect(weekdayIndexFromDateKey("not-a-date")).toBeNull();
    expect(weekdayIndexFromDateKey("2026-13-40")).toBeNull();
  });
});

describe("resolveEffectiveDayTargets", () => {
  const weekendLift = parseDayTargetSchedule("weekend_lift", [0, 6])!;

  it("is a pure identity with no schedule", () => {
    const out = resolveEffectiveDayTargets(BASE, null, 3);
    expect(out).toEqual({
      calories: 2000,
      proteinG: 150,
      carbsG: 200,
      fatG: 67,
      fiberG: 30,
      dayClass: "base",
      adjusted: false,
    });
  });

  it("boosts a high day and marks it 'higher' (weekend_lift ×1.10)", () => {
    const sat = resolveEffectiveDayTargets(BASE, weekendLift, 6);
    expect(sat.calories).toBe(2200); // 2000 × 1.10
    expect(sat.dayClass).toBe("higher");
    expect(sat.adjusted).toBe(true);
    // Protein + fibre pass through untouched; carbs + fat absorb the +200 kcal.
    expect(sat.proteinG).toBe(150);
    expect(sat.fiberG).toBe(30);
    expect(sat.carbsG!).toBeGreaterThan(200);
    expect(sat.fatG!).toBeGreaterThan(67);
  });

  it("lowers a non-high day and marks it 'lighter' (derived ×0.96)", () => {
    const wed = resolveEffectiveDayTargets(BASE, weekendLift, 3);
    expect(wed.calories).toBe(1920); // 2000 × 0.96
    expect(wed.dayClass).toBe("lighter");
    expect(wed.proteinG).toBe(150);
    expect(wed.carbsG!).toBeLessThan(200);
    expect(wed.fatG!).toBeLessThan(67);
  });

  it("is WEEKLY-NEUTRAL — the 7-day calorie total matches the flat plan", () => {
    const total = ([0, 1, 2, 3, 4, 5, 6] as WeekdayIndex[])
      .map((wd) => resolveEffectiveDayTargets(BASE, weekendLift, wd).calories)
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(2000 * 7); // 14000 — no energy added or removed
  });

  it("is weekly-neutral for lighter_weekdays too (×1.20 / ×0.92)", () => {
    const sched = parseDayTargetSchedule("lighter_weekdays", [0, 6])!;
    const total = ([0, 1, 2, 3, 4, 5, 6] as WeekdayIndex[])
      .map((wd) => resolveEffectiveDayTargets(BASE, sched, wd).calories)
      .reduce((a, b) => a + b, 0);
    expect(resolveEffectiveDayTargets(BASE, sched, 6).calories).toBe(2400);
    expect(resolveEffectiveDayTargets(BASE, sched, 3).calories).toBe(1840);
    expect(total).toBe(2000 * 7);
  });

  it("passes macros through unchanged when the base has no carb/fat grams to split", () => {
    const noMacros: BaseDayTargets = { calories: 2000, proteinG: null, carbsG: null, fatG: null };
    const sat = resolveEffectiveDayTargets(noMacros, weekendLift, 6);
    expect(sat.calories).toBe(2200); // calorie line still cycles
    expect(sat.carbsG).toBeNull();
    expect(sat.fatG).toBeNull();
  });

  it("resolves flat for a non-positive base or a degenerate high-day set", () => {
    expect(resolveEffectiveDayTargets({ ...BASE, calories: 0 }, weekendLift, 6).adjusted).toBe(false);
    expect(resolveEffectiveDayTargets(BASE, { id: "weekend_lift", highDays: [] }, 6).adjusted).toBe(false);
  });
});

describe("effectiveTargetsForDateKey", () => {
  it("routes a date key through the resolver", () => {
    const sched = parseDayTargetSchedule("weekend_lift", [0, 6])!;
    // 2026-07-05 is a Sunday (high day) → boosted.
    expect(effectiveTargetsForDateKey(BASE, sched, "2026-07-05").calories).toBe(2200);
    // 2026-07-02 is a Thursday (low day) → lowered.
    expect(effectiveTargetsForDateKey(BASE, sched, "2026-07-02").calories).toBe(1920);
  });
  it("resolves flat for a malformed date key (never guesses a day)", () => {
    const sched = parseDayTargetSchedule("weekend_lift", [0, 6])!;
    expect(effectiveTargetsForDateKey(BASE, sched, "bad-key").adjusted).toBe(false);
  });
});
