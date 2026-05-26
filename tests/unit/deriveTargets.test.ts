/**
 * deriveTargets — the canonical target-recompute core (target-recompute
 * unification, 2026-05-26). Every recompute path (onboarding,
 * post-onboarding editor, weekly check-in) flows through this one
 * function. These tests pin the contract the whole feature rests on:
 *
 *   - deficit sign per goal (lose/recomp deficit, gain surplus, maintain 0)
 *   - DB-goal normalisation (cut→lose, bulk→gain, health→maintain, etc.)
 *   - strategy null → mapGoalToStrategy(goal) (NOT a hardcoded "balanced")
 *   - safety-floor flag from the FINAL target, soft-warn-not-block
 *   - rounding: deficit applied to a whole-kcal maintenance baseline,
 *     target rounded at the boundary
 *   - null guard for non-positive maintenance / weight
 */

import { describe, expect, it } from "vitest";
import {
  deriveTargets,
  normaliseGoal,
} from "../../src/lib/nutrition/goalPaceRetune";
import { mapGoalToStrategy, safetyFloorFor } from "../../src/lib/onboarding/targets";
import { calculateMacros } from "../../src/lib/nutrition/tdee";

const BASE = {
  maintenanceKcal: 2400,
  paceKgPerWeek: 0.5,
  strategy: "high_satisfaction" as const,
  weightKg: 80,
  sex: "male" as const,
};

describe("normaliseGoal", () => {
  it("maps DB cut/bulk + legacy health/strength to the onboarding vocabulary", () => {
    expect(normaliseGoal("cut")).toBe("lose");
    expect(normaliseGoal("bulk")).toBe("gain");
    expect(normaliseGoal("strength")).toBe("gain");
    expect(normaliseGoal("health")).toBe("maintain");
  });
  it("is identity for the onboarding goals", () => {
    expect(normaliseGoal("lose")).toBe("lose");
    expect(normaliseGoal("recomp")).toBe("recomp");
    expect(normaliseGoal("maintain")).toBe("maintain");
    expect(normaliseGoal("gain")).toBe("gain");
  });
  it("never silently applies a deficit to an unknown goal (→ maintain)", () => {
    expect(normaliseGoal("something_unexpected")).toBe("maintain");
    expect(normaliseGoal("")).toBe("maintain");
  });
});

describe("deriveTargets — deficit sign per goal", () => {
  it("applies a NEGATIVE adjustment for lose", () => {
    const out = deriveTargets({ ...BASE, goal: "lose" })!;
    // 0.5 kg/week × 7700 / 7 = 550
    expect(out.kcalAdjustment).toBe(-550);
    expect(out.targetCalories).toBe(2400 - 550);
  });

  it("applies a NEGATIVE adjustment for recomp (also a deficit)", () => {
    const out = deriveTargets({ ...BASE, goal: "recomp" })!;
    expect(out.kcalAdjustment).toBe(-550);
    expect(out.targetCalories).toBe(1850);
  });

  it("applies a POSITIVE (full-magnitude) adjustment for gain", () => {
    const out = deriveTargets({ ...BASE, goal: "gain" })!;
    // Full surplus — the editor used to halve this (the bug deriveTargets
    // unifies away). 0.5 kg/week → +550, not +275.
    expect(out.kcalAdjustment).toBe(550);
    expect(out.targetCalories).toBe(2950);
  });

  it("applies ZERO adjustment for maintain regardless of pace", () => {
    const out = deriveTargets({ ...BASE, goal: "maintain", paceKgPerWeek: 0.75 })!;
    expect(out.kcalAdjustment).toBe(0);
    expect(out.targetCalories).toBe(2400);
  });

  it("normalises DB goal values (cut → deficit, bulk → surplus)", () => {
    const cut = deriveTargets({ ...BASE, goal: "cut" })!;
    const bulk = deriveTargets({ ...BASE, goal: "bulk" })!;
    expect(cut.kcalAdjustment).toBe(-550);
    expect(bulk.kcalAdjustment).toBe(550);
  });
});

describe("deriveTargets — strategy null → mapGoalToStrategy", () => {
  it("falls back to the goal-mapped strategy when strategy is null (NOT balanced)", () => {
    const lose = deriveTargets({ ...BASE, goal: "lose", strategy: null })!;
    const gain = deriveTargets({ ...BASE, goal: "gain", strategy: null })!;
    const maintain = deriveTargets({ ...BASE, goal: "maintain", strategy: null })!;
    expect(lose.strategyUsed).toBe(mapGoalToStrategy("lose")); // high_satisfaction
    expect(gain.strategyUsed).toBe(mapGoalToStrategy("gain")); // high_protein
    expect(maintain.strategyUsed).toBe(mapGoalToStrategy("maintain")); // balanced
    // The bug being fixed: lose must NOT silently fall to balanced.
    expect(lose.strategyUsed).not.toBe("balanced");
  });

  it("honours an explicit strategy override", () => {
    const out = deriveTargets({ ...BASE, goal: "lose", strategy: "low_carb" })!;
    expect(out.strategyUsed).toBe("low_carb");
  });

  it("derives macros from the resolved strategy + final target", () => {
    const out = deriveTargets({ ...BASE, goal: "lose", strategy: null })!;
    const expected = calculateMacros(
      out.targetCalories,
      mapGoalToStrategy("lose"),
      BASE.weightKg,
    );
    expect(out.proteinG).toBe(expected.protein);
    expect(out.carbsG).toBe(expected.carbs);
    expect(out.fatG).toBe(expected.fat);
    expect(out.fiberG).toBe(expected.fiber);
  });
});

describe("deriveTargets — safety floor (soft-warn from the final target)", () => {
  it("flags belowSafetyFloor when a loss target dips below the sex floor", () => {
    // male floor = 1500. 1800 maintenance − 550 = 1250 < 1500.
    const out = deriveTargets({
      ...BASE,
      maintenanceKcal: 1800,
      goal: "lose",
    })!;
    expect(out.targetCalories).toBe(1250);
    expect(out.targetCalories).toBeLessThan(safetyFloorFor("male"));
    expect(out.belowSafetyFloor).toBe(true);
  });

  it("does NOT flag below-floor for gain (only loss goals trip the flag)", () => {
    const out = deriveTargets({
      ...BASE,
      maintenanceKcal: 1000,
      goal: "gain",
    })!;
    // 1000 + 550 = 1550, but even a low surplus target never trips the
    // loss-only floor flag.
    expect(out.belowSafetyFloor).toBe(false);
  });

  it("flags below-floor for recomp too (recomp is a deficit)", () => {
    const out = deriveTargets({
      ...BASE,
      maintenanceKcal: 1700,
      goal: "recomp",
      sex: "female",
    })!;
    // female floor 1200; 1700 − 550 = 1150 < 1200.
    expect(out.belowSafetyFloor).toBe(true);
  });

  it("never blocks — always returns a result even below the floor", () => {
    const out = deriveTargets({
      ...BASE,
      maintenanceKcal: 1300,
      goal: "lose",
    });
    expect(out).not.toBeNull();
    expect(out!.belowSafetyFloor).toBe(true);
    expect(out!.targetCalories).toBe(750);
  });
});

describe("deriveTargets — rounding + null guard", () => {
  it("rounds the final target at the boundary (non-integer maintenance absorbed)", () => {
    // 2400.6 + (-550) = 1850.6 → 1851.
    const out = deriveTargets({ ...BASE, maintenanceKcal: 2400.6, goal: "lose" })!;
    expect(out.targetCalories).toBe(1851);
  });

  it("returns null for non-positive maintenance", () => {
    expect(deriveTargets({ ...BASE, maintenanceKcal: 0, goal: "lose" })).toBeNull();
    expect(deriveTargets({ ...BASE, maintenanceKcal: -10, goal: "lose" })).toBeNull();
    expect(
      deriveTargets({ ...BASE, maintenanceKcal: Number.NaN, goal: "lose" }),
    ).toBeNull();
  });

  it("returns null for non-positive weight", () => {
    expect(deriveTargets({ ...BASE, weightKg: 0, goal: "lose" })).toBeNull();
    expect(deriveTargets({ ...BASE, weightKg: -5, goal: "lose" })).toBeNull();
  });
});
