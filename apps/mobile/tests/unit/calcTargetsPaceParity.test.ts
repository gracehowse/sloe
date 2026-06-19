import { describe, expect, it } from "vitest";
import { calculateBudget, type PlanPace } from "@suppr/nutrition-core/tdee";
import { goalCalorieAdjustment, calcTargetsFromStats } from "../../lib/calcTargets";

/**
 * P0-3 (2026-04-18) — mobile and web must produce the same calorie target
 * for the same profile + goal + pace. Web uses `calculateBudget(tdee, pace,
 * goal)`; mobile composes the same logic via `goalCalorieAdjustment(goal,
 * pace)`. This file pins them in lockstep across all four pace values and
 * the three real goal directions (lose / maintain / gain).
 */

const PACES: PlanPace[] = ["relaxed", "steady", "accelerated", "vigorous"];
const GOALS = ["lose", "maintain", "gain"];

describe("goalCalorieAdjustment — pace parity with web calculateBudget", () => {
  for (const pace of PACES) {
    for (const goal of GOALS) {
      it(`matches web for pace=${pace} goal=${goal}`, () => {
        const tdee = 2200;
        const webBudget = calculateBudget(tdee, pace, goal);
        const mobileAdjustment = goalCalorieAdjustment(goal, pace);
        expect(tdee + mobileAdjustment).toBe(webBudget);
      });
    }
  }

  it("defaults to steady when pace is null", () => {
    expect(goalCalorieAdjustment("lose", null)).toBe(calculateBudget(0, "steady", "lose"));
    expect(goalCalorieAdjustment("gain", undefined)).toBe(calculateBudget(0, "steady", "gain"));
  });

  it("defaults to maintain when goal is null/empty", () => {
    expect(goalCalorieAdjustment(null, "steady")).toBe(0);
    expect(goalCalorieAdjustment("", "steady")).toBe(0);
  });

  it("treats unknown pace strings as steady (matches normalisation)", () => {
    expect(goalCalorieAdjustment("lose", "garbage")).toBe(goalCalorieAdjustment("lose", "steady"));
  });
});

describe("calcTargetsFromStats — applies pace-aware adjustment", () => {
  const baseStats = {
    sex: "female" as const,
    weight_kg: 65,
    height_cm: 170,
    age: 30,
    activity_level: "sedentary",
    goal: "lose",
  };

  it("relaxed loses 275 kcal less aggressively than steady", () => {
    const relaxed = calcTargetsFromStats({ ...baseStats, plan_pace: "relaxed" });
    const steady = calcTargetsFromStats({ ...baseStats, plan_pace: "steady" });
    expect(relaxed && steady).toBeTruthy();
    expect(relaxed!.calories - steady!.calories).toBe(550 - 275); // +275 kcal vs steady
  });

  it("vigorous loses 1100 kcal — most aggressive", () => {
    const vigorous = calcTargetsFromStats({ ...baseStats, plan_pace: "vigorous" });
    const steady = calcTargetsFromStats({ ...baseStats, plan_pace: "steady" });
    expect(vigorous && steady).toBeTruthy();
    expect(steady!.calories - vigorous!.calories).toBe(1100 - 550);
  });

  it("falls back to steady when plan_pace is missing", () => {
    const explicit = calcTargetsFromStats({ ...baseStats, plan_pace: "steady" });
    const implicit = calcTargetsFromStats({ ...baseStats });
    expect(explicit?.calories).toBe(implicit?.calories);
  });
});
