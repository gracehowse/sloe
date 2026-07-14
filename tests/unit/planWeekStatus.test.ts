/**
 * planWeekStatus — the v3 Plan "planning completeness" verdict + per-day status
 * (ENG-1225, Plan IA). Pins the prototype rule (Sloe-App.html ~L4704-4734): a
 * day "lands" when ≥3 of Breakfast/Lunch/Dinner hold a real calorie-bearing
 * meal; Snacks never gate the verdict; the week headline + nudge copy is shared
 * web↔mobile.
 */
import { describe, expect, it } from "vitest";
import {
  computePlanDayDetail,
  computePlanDayStatus,
  computePlanWeekVerdict,
  countPlanDayMainSlotsFilled,
  isPlanWeekEmpty,
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

  it("partial week → 'On track — N of M days on target' + plural nudge, neutral tone (ENG-1547 — 'On track' is progress, not a warning)", () => {
    const week = [fullDay, fullDay, fullDay, fullDay, partDay, emptyDay, partDay];
    const v = computePlanWeekVerdict(week)!;
    expect(v.daysHit).toBe(4);
    expect(v.total).toBe(7);
    expect(v.headline).toBe("On track — 4 of 7 days on target");
    expect(v.subline).toBe("3 days need a meal or swap");
    expect(v.tone).toBe("neutral");
    // A progressing week must never wear the amber warning dot.
    expect(v.tone).not.toBe("warning");
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
    expect(v.headline).toBe("On track — 2 of 3 days on target");
  });
});

describe("computePlanDayDetail", () => {
  it("nothing planned → 'Nothing planned yet', success tone", () => {
    const d = computePlanDayDetail(0, 1830, 0, 0);
    expect(d.subline).toBe("Nothing planned yet");
    expect(d.barPct).toBe(0);
    expect(d.tone).toBe("success");
  });

  it("meaningfully under (gap > 250) → 'short — room for more'", () => {
    const d = computePlanDayDetail(1490, 1830, 3, 0);
    expect(d.subline).toBe("≈340 kcal short — room for more");
    expect(d.barPct).toBeCloseTo(1490 / 1830, 5);
    expect(d.tone).toBe("success");
  });

  it("near target (within band) → 'Lands on target'", () => {
    expect(computePlanDayDetail(1800, 1830, 3, 0).subline).toBe(
      "Lands on target",
    );
  });

  it("over target (> 200) → 'over target' + warning tone + capped bar", () => {
    const d = computePlanDayDetail(2200, 1830, 4, 0);
    expect(d.subline).toBe("≈370 over target");
    expect(d.tone).toBe("warning");
    expect(d.barPct).toBe(1); // capped
  });

  it("appends ' · N cooked' when slots are cooked", () => {
    expect(computePlanDayDetail(1490, 1830, 3, 2).subline).toBe(
      "≈340 kcal short — room for more · 2 cooked",
    );
  });
});

describe("isPlanWeekEmpty (ENG-1372 empty-state grammar)", () => {
  it("true for null/absent/empty-array week", () => {
    expect(isPlanWeekEmpty(null)).toBe(true);
    expect(isPlanWeekEmpty(undefined)).toBe(true);
    expect(isPlanWeekEmpty([])).toBe(true);
  });

  it("true when every day's every slot is empty/placeholder — Snacks included", () => {
    const week = Array.from({ length: 7 }, () => emptyDay);
    expect(isPlanWeekEmpty(week)).toBe(true);
    // A day whose only meal is an empty Snacks slot still counts as empty.
    expect(isPlanWeekEmpty([[meal("Snacks", null, true)]])).toBe(true);
  });

  it("false as soon as ANY slot in ANY day is filled — even just Snacks", () => {
    // Stricter than computePlanDayStatus's B/L/D-only 'lands' threshold:
    // isPlanWeekEmpty counts Snacks as a real meal too.
    expect(isPlanWeekEmpty([[meal("Snacks")], emptyDay])).toBe(false);
    expect(isPlanWeekEmpty([emptyDay, partDay, emptyDay])).toBe(false);
  });

  it("false once the week has ANY fully-landed day (mirrors computePlanWeekVerdict fixtures)", () => {
    const week = [fullDay, emptyDay, emptyDay, emptyDay, emptyDay, emptyDay, emptyDay];
    expect(isPlanWeekEmpty(week)).toBe(false);
  });

  it("treats a day with an empty meals array the same as a fully-placeholder day", () => {
    expect(isPlanWeekEmpty([[], [], []])).toBe(true);
  });
});
