/**
 * planWeekStatus — the v3 Plan "planning completeness" verdict + per-day status
 * (ENG-1225, Plan IA). Pins the prototype rule (Sloe-App.html ~L4704-4734): a
 * day "lands" when ≥3 of Breakfast/Lunch/Dinner hold a real calorie-bearing
 * meal; Snacks never gate the verdict; the week headline + nudge copy is shared
 * web↔mobile.
 */
import { describe, expect, it } from "vitest";
import {
  computePlanDayStatus,
  computePlanWeekVerdict,
  countPlanDayMainSlotsFilled,
  type PlanStatusMeal,
} from "../../src/lib/planning/planWeekStatus";

const meal = (slot: string, kcal: number | null = 400, empty = false): PlanStatusMeal => ({
  slot,
  kcal,
  empty,
});

/** A fully-landed day: B/L/D all filled (+ a snack, which must not matter). */
const fullDay: PlanStatusMeal[] = [
  meal("Breakfast"),
  meal("Lunch"),
  meal("Dinner"),
  meal("Snacks"),
];
const partDay: PlanStatusMeal[] = [meal("Breakfast"), meal("Lunch")];
const emptyDay: PlanStatusMeal[] = [
  meal("Breakfast", null, true),
  meal("Lunch", null, true),
  meal("Dinner", null, true),
];

describe("countPlanDayMainSlotsFilled", () => {
  it("counts only B/L/D with a real calorie-bearing meal", () => {
    expect(countPlanDayMainSlotsFilled(fullDay)).toBe(3);
    expect(countPlanDayMainSlotsFilled(partDay)).toBe(2);
    expect(countPlanDayMainSlotsFilled(emptyDay)).toBe(0);
  });

  it("ignores Snacks toward the threshold", () => {
    // Two mains + two snacks → still 2 (snacks are bonus, not a 'land').
    expect(
      countPlanDayMainSlotsFilled([
        meal("Breakfast"),
        meal("Lunch"),
        meal("Snacks"),
        meal("Snacks"),
      ]),
    ).toBe(2);
  });

  it("does not count empty slots or zero/negative/NaN kcal as filled", () => {
    expect(
      countPlanDayMainSlotsFilled([
        meal("Breakfast", 0),
        meal("Lunch", null, true),
        meal("Dinner", NaN),
      ]),
    ).toBe(0);
  });

  it("handles absent / empty input", () => {
    expect(countPlanDayMainSlotsFilled(null)).toBe(0);
    expect(countPlanDayMainSlotsFilled(undefined)).toBe(0);
    expect(countPlanDayMainSlotsFilled([])).toBe(0);
  });
});

describe("computePlanDayStatus", () => {
  it("full when all 3 main slots filled", () => {
    expect(computePlanDayStatus(fullDay)).toBe("full");
  });
  it("part when 1-2 main slots filled", () => {
    expect(computePlanDayStatus(partDay)).toBe("part");
    expect(computePlanDayStatus([meal("Dinner")])).toBe("part");
  });
  it("empty when no main slot filled (incl. snacks-only)", () => {
    expect(computePlanDayStatus(emptyDay)).toBe("empty");
    expect(computePlanDayStatus([meal("Snacks")])).toBe("empty");
    expect(computePlanDayStatus([])).toBe("empty");
  });
});

describe("computePlanWeekVerdict", () => {
  it("returns null for an empty/absent plan (caller skips the verdict row)", () => {
    expect(computePlanWeekVerdict(null)).toBeNull();
    expect(computePlanWeekVerdict([])).toBeNull();
  });

  it("every day lands → success tone, no subline", () => {
    const week = Array.from({ length: 7 }, () => fullDay);
    const v = computePlanWeekVerdict(week)!;
    expect(v.daysHit).toBe(7);
    expect(v.total).toBe(7);
    expect(v.headline).toBe("Every day lands on target");
    expect(v.subline).toBeNull();
    expect(v.tone).toBe("success");
  });

  it("partial week → 'On track — N of M days land' + plural nudge, warning tone", () => {
    const week = [fullDay, fullDay, fullDay, fullDay, partDay, emptyDay, partDay];
    const v = computePlanWeekVerdict(week)!;
    expect(v.daysHit).toBe(4);
    expect(v.total).toBe(7);
    expect(v.headline).toBe("On track — 4 of 7 days land");
    expect(v.subline).toBe("3 days need a meal or swap");
    expect(v.tone).toBe("warning");
  });

  it("singular nudge when exactly one day is short", () => {
    const week = [fullDay, fullDay, fullDay, fullDay, fullDay, fullDay, partDay];
    const v = computePlanWeekVerdict(week)!;
    expect(v.daysHit).toBe(6);
    expect(v.subline).toBe("1 day needs a meal or swap");
  });

  it("supports shorter plans (3-day) — total reflects week length", () => {
    const v = computePlanWeekVerdict([fullDay, partDay, fullDay])!;
    expect(v.total).toBe(3);
    expect(v.daysHit).toBe(2);
    expect(v.headline).toBe("On track — 2 of 3 days land");
  });
});
