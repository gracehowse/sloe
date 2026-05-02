/**
 * whyThisNumber — pin the "why is my target X kcal?" breakdown.
 *
 * The sheet renders the rows produced here verbatim; if a label moves,
 * a colour ramp shifts, or the deficit math drifts, this test catches
 * it. Same helper backs mobile + web — one test pins both.
 */
import { describe, expect, it } from "vitest";
import {
  buildWhyThisNumber,
  paceKgPerWeekFromPreset,
} from "../../src/lib/nutrition/whyThisNumber";

describe("paceKgPerWeekFromPreset", () => {
  it("maps every legacy preset to its canonical magnitude", () => {
    expect(paceKgPerWeekFromPreset("relaxed", "lose")).toBe(-0.25);
    expect(paceKgPerWeekFromPreset("steady", "lose")).toBe(-0.5);
    expect(paceKgPerWeekFromPreset("accelerated", "lose")).toBe(-0.75);
    expect(paceKgPerWeekFromPreset("vigorous", "lose")).toBe(-1.0);
  });

  it("flips sign for gain goals", () => {
    expect(paceKgPerWeekFromPreset("relaxed", "gain")).toBe(0.25);
    expect(paceKgPerWeekFromPreset("vigorous", "gain")).toBe(1.0);
  });

  it("returns 0 for maintain goal regardless of preset", () => {
    expect(paceKgPerWeekFromPreset("steady", "maintain")).toBe(0);
    expect(paceKgPerWeekFromPreset(null, "maintain")).toBe(0);
  });

  it("returns 0 for unknown / null presets", () => {
    expect(paceKgPerWeekFromPreset(null, "lose")).toBe(0);
    expect(paceKgPerWeekFromPreset("frenetic", "lose")).toBe(0);
    expect(paceKgPerWeekFromPreset(undefined, "gain")).toBe(0);
  });
});

describe("buildWhyThisNumber", () => {
  it("renders the canonical 3-row breakdown for a steady weight-loss user", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "medium",
      loggingDays: 21,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.targetHeadline).toBe("Today's target: 1,800 kcal");
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0]).toEqual({
      key: "tdee",
      label: "Maintenance (TDEE)",
      value: "2,150 kcal (adaptive, last 7 days)",
    });
    expect(r.lines[1]).toEqual({
      key: "goal",
      label: "Goal",
      value: "Lose 0.5 kg/wk",
    });
    expect(r.lines[2]).toEqual({
      key: "result",
      label: "Result",
      value: "−350 kcal/day deficit",
    });
    expect(r.isEarlyEstimate).toBe(false);
  });

  it("flags early estimate when loggingDays < 14", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "medium",
      loggingDays: 10,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.lines[0].value).toBe("~2,150 kcal (early estimate)");
    expect(r.isEarlyEstimate).toBe(true);
  });

  it("flags early estimate when confidence is low even with enough days", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "low",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.lines[0].value).toBe("~2,150 kcal (early estimate)");
    expect(r.isEarlyEstimate).toBe(true);
  });

  it("renders calibrating copy when no TDEE estimate exists", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: null,
      confidence: null,
      loggingDays: 3,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.lines[0].value).toBe("calibrating — keep logging");
    // Result row falls back to the pace-implied deficit.
    expect(r.lines[2].value).toMatch(/^−550 kcal\/day deficit \(target\)$/);
    expect(r.summary).toContain("still calibrating");
  });

  it("renders a surplus row for a gaining user", () => {
    const r = buildWhyThisNumber({
      targetCalories: 2700,
      maintenanceTdee: 2400,
      confidence: "high",
      loggingDays: 30,
      goal: "gain",
      paceKgPerWeek: 0.25,
    });
    expect(r.lines[1].value).toBe("Gain 0.25 kg/wk");
    expect(r.lines[2].value).toBe("+300 kcal/day surplus");
  });

  it("renders maintain copy when goal=maintain", () => {
    const r = buildWhyThisNumber({
      targetCalories: 2400,
      maintenanceTdee: 2400,
      confidence: "high",
      loggingDays: 30,
      goal: "maintain",
      paceKgPerWeek: 0,
    });
    expect(r.lines[1].value).toBe("Maintain");
    expect(r.lines[2].value).toBe("no deficit (maintaining)");
  });

  it("collapses paceKg=0 to maintain even when goal!=maintain (paused plan)", () => {
    const r = buildWhyThisNumber({
      targetCalories: 2400,
      maintenanceTdee: 2400,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: 0,
    });
    expect(r.lines[1].value).toBe("Maintain");
  });

  it("formats pace fractions cleanly (0.5, 0.25, 0.75)", () => {
    const half = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(half.lines[1].value).toBe("Lose 0.5 kg/wk");

    const quarter = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.25,
    });
    expect(quarter.lines[1].value).toBe("Lose 0.25 kg/wk");

    const threeQuarter = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.75,
    });
    expect(threeQuarter.lines[1].value).toBe("Lose 0.75 kg/wk");
  });

  it("rounds the kcal delta to whole numbers", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1850,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.lines[2].value).toBe("−300 kcal/day deficit");
  });

  it("uses thousand separators for both target and TDEE figures", () => {
    const r = buildWhyThisNumber({
      targetCalories: 3500,
      maintenanceTdee: 4100,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.targetHeadline).toBe("Today's target: 3,500 kcal");
    expect(r.lines[0].value).toContain("4,100 kcal");
  });

  it("summary names the direction (below / above / at maintenance)", () => {
    const below = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(below.summary).toContain("below");

    const above = buildWhyThisNumber({
      targetCalories: 2500,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "gain",
      paceKgPerWeek: 0.25,
    });
    expect(above.summary).toContain("above");

    const at = buildWhyThisNumber({
      targetCalories: 2150,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "maintain",
      paceKgPerWeek: 0,
    });
    expect(at.summary).toContain("at your estimated maintenance");
  });
});
