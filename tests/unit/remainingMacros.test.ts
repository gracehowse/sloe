import { describe, expect, it } from "vitest";
import {
  computeRemaining,
  projectRemaining,
  type MacroTargets,
  type MacroConsumed,
} from "@/lib/nutrition/remainingMacros";

const targets: MacroTargets = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
  fiber: 28,
};

describe("computeRemaining", () => {
  it("at zero consumption returns the full target for every macro", () => {
    const result = computeRemaining(targets, {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    });
    expect(result.calories).toBe(2000);
    expect(result.protein).toBe(150);
    expect(result.carbs).toBe(200);
    expect(result.fat).toBe(65);
    expect(result.fiber).toBe(28);
    expect(result.overCalories).toBe(false);
    expect(result.overProtein).toBe(false);
    expect(result.overCarbs).toBe(false);
    expect(result.overFat).toBe(false);
    expect(result.overFiber).toBe(false);
  });

  it("halfway through the day returns half of each macro", () => {
    const result = computeRemaining(targets, {
      calories: 1000,
      protein: 75,
      carbs: 100,
      fat: 32, // rounds from 32.5
      fiber: 14,
    });
    expect(result.calories).toBe(1000);
    expect(result.protein).toBe(75);
    expect(result.carbs).toBe(100);
    // 65 - 32 = 33; also check signed delta matches
    expect(result.fat).toBe(33);
    expect(result.deltas.fat).toBe(33);
    expect(result.fiber).toBe(14);
  });

  it("exactly at target returns zero remaining and not over", () => {
    const result = computeRemaining(targets, {
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 65,
      fiber: 28,
    });
    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
    expect(result.fiber).toBe(0);
    expect(result.overCalories).toBe(false);
    expect(result.overProtein).toBe(false);
    expect(result.overCarbs).toBe(false);
    expect(result.overFat).toBe(false);
    expect(result.overFiber).toBe(false);
  });

  it("over target floors remaining at 0 but flags over*=true and preserves signed delta", () => {
    const result = computeRemaining(targets, {
      calories: 2300,
      protein: 180,
      carbs: 220,
      fat: 90,
      fiber: 35,
    });
    // Displayed remaining is clamped to 0
    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
    expect(result.fiber).toBe(0);
    // Over flags set for every macro
    expect(result.overCalories).toBe(true);
    expect(result.overProtein).toBe(true);
    expect(result.overCarbs).toBe(true);
    expect(result.overFat).toBe(true);
    expect(result.overFiber).toBe(true);
    // Signed deltas are negative and usable by the UI for "+N over"
    expect(result.deltas.calories).toBe(-300);
    expect(result.deltas.protein).toBe(-30);
    expect(result.deltas.carbs).toBe(-20);
    expect(result.deltas.fat).toBe(-25);
    expect(result.deltas.fiber).toBe(-7);
  });

  it("mixes within-budget and over-budget macros in the same result", () => {
    const result = computeRemaining(targets, {
      calories: 1500,
      protein: 200,
      carbs: 100,
      fat: 40,
    });
    expect(result.calories).toBe(500);
    expect(result.overCalories).toBe(false);
    expect(result.protein).toBe(0);
    expect(result.overProtein).toBe(true);
    expect(result.deltas.protein).toBe(-50);
    expect(result.carbs).toBe(100);
    expect(result.fat).toBe(25);
  });

  it("when fiber target is undefined, fiber remaining is undefined and overFiber=false", () => {
    const noFiberTarget: MacroTargets = { calories: 2000, protein: 150, carbs: 200, fat: 65 };
    const result = computeRemaining(noFiberTarget, {
      calories: 500,
      protein: 30,
      carbs: 50,
      fat: 15,
      fiber: 12, // consumed, but user has no target — should be ignored
    });
    expect(result.fiber).toBeUndefined();
    expect(result.overFiber).toBe(false);
    expect(result.deltas.fiber).toBeUndefined();
  });

  it("when fiber target is zero, fiber is treated as not tracked", () => {
    const zeroFiber: MacroTargets = { calories: 2000, protein: 150, carbs: 200, fat: 65, fiber: 0 };
    const result = computeRemaining(zeroFiber, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 5 });
    expect(result.fiber).toBeUndefined();
    expect(result.overFiber).toBe(false);
  });

  it("rounds sensibly: consumed 1500.7 against target 2000 shows 499 left (not 499.3)", () => {
    const result = computeRemaining(targets, {
      calories: 1500.7,
      protein: 50,
      carbs: 50,
      fat: 10,
    });
    expect(result.calories).toBe(499);
    expect(Number.isInteger(result.calories)).toBe(true);
    expect(Number.isInteger(result.protein)).toBe(true);
    expect(Number.isInteger(result.carbs)).toBe(true);
    expect(Number.isInteger(result.fat)).toBe(true);
  });

  it("defensively clamps negative consumed values to zero before subtracting", () => {
    const result = computeRemaining(targets, {
      calories: -200,
      protein: -5,
      carbs: -10,
      fat: -3,
    });
    // Should not read as 2000 - (-200) = 2200; consumed clamped to 0.
    expect(result.calories).toBe(2000);
    expect(result.protein).toBe(150);
    expect(result.carbs).toBe(200);
    expect(result.fat).toBe(65);
  });

  it("defensively clamps negative target values to zero", () => {
    const weird: MacroTargets = { calories: -500, protein: 100, carbs: 100, fat: 30 };
    const result = computeRemaining(weird, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(result.calories).toBe(0);
    expect(result.overCalories).toBe(false);
  });

  it("handles NaN / non-finite consumed values without blowing up", () => {
    const result = computeRemaining(targets, {
      calories: Number.NaN,
      protein: Number.POSITIVE_INFINITY,
      carbs: 50,
      fat: 10,
    });
    expect(result.calories).toBe(2000);
    expect(result.protein).toBe(150);
    expect(result.carbs).toBe(150);
    expect(result.fat).toBe(55);
  });
});

describe("projectRemaining", () => {
  const consumed: MacroConsumed = {
    calories: 1200,
    protein: 80,
    carbs: 120,
    fat: 35,
    fiber: 15,
  };

  it("adds the candidate portion to the tally before computing what is left", () => {
    const candidate: MacroConsumed = {
      calories: 400,
      protein: 30,
      carbs: 50,
      fat: 12,
      fiber: 5,
    };
    const result = projectRemaining(targets, consumed, candidate);
    // 2000 - (1200 + 400) = 400
    expect(result.calories).toBe(400);
    expect(result.protein).toBe(40);
    expect(result.carbs).toBe(30);
    expect(result.fat).toBe(18);
    expect(result.fiber).toBe(8);
    expect(result.overCalories).toBe(false);
  });

  it("flags over-budget when the candidate tips a macro past its target", () => {
    const candidate: MacroConsumed = {
      calories: 900, // 1200 + 900 = 2100 > 2000
      protein: 80, // 80 + 80 = 160 > 150
      carbs: 50,
      fat: 10,
    };
    const result = projectRemaining(targets, consumed, candidate);
    expect(result.overCalories).toBe(true);
    expect(result.calories).toBe(0);
    expect(result.deltas.calories).toBe(-100);
    expect(result.overProtein).toBe(true);
    expect(result.protein).toBe(0);
    expect(result.deltas.protein).toBe(-10);
    // Carbs/fat stay within budget and show remaining
    expect(result.overCarbs).toBe(false);
    expect(result.carbs).toBe(30);
    expect(result.overFat).toBe(false);
    expect(result.fat).toBe(20);
  });

  it("does not mutate its inputs", () => {
    const frozenTargets: MacroTargets = { ...targets };
    const frozenConsumed: MacroConsumed = { ...consumed };
    const frozenCandidate: MacroConsumed = { calories: 300, protein: 20, carbs: 30, fat: 10, fiber: 3 };

    const targetsSnapshot = JSON.stringify(frozenTargets);
    const consumedSnapshot = JSON.stringify(frozenConsumed);
    const candidateSnapshot = JSON.stringify(frozenCandidate);

    projectRemaining(frozenTargets, frozenConsumed, frozenCandidate);

    expect(JSON.stringify(frozenTargets)).toBe(targetsSnapshot);
    expect(JSON.stringify(frozenConsumed)).toBe(consumedSnapshot);
    expect(JSON.stringify(frozenCandidate)).toBe(candidateSnapshot);
  });

  it("works when consumed is empty (haven't logged anything yet)", () => {
    const empty: MacroConsumed = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    const candidate: MacroConsumed = { calories: 500, protein: 40, carbs: 55, fat: 18, fiber: 6 };
    const result = projectRemaining(targets, empty, candidate);
    expect(result.calories).toBe(1500);
    expect(result.protein).toBe(110);
    expect(result.carbs).toBe(145);
    expect(result.fat).toBe(47);
    expect(result.fiber).toBe(22);
  });

  it("when fiber is not tracked, projected remaining.fiber stays undefined", () => {
    const noFiberTarget: MacroTargets = { calories: 2000, protein: 150, carbs: 200, fat: 65 };
    const result = projectRemaining(
      noFiberTarget,
      { calories: 500, protein: 30, carbs: 50, fat: 15, fiber: 10 },
      { calories: 300, protein: 20, carbs: 30, fat: 10, fiber: 4 },
    );
    expect(result.fiber).toBeUndefined();
    expect(result.deltas.fiber).toBeUndefined();
  });

  it("rounds projected values to integers for display", () => {
    const result = projectRemaining(
      targets,
      { calories: 800.4, protein: 40.2, carbs: 60.6, fat: 20.1, fiber: 10.3 },
      { calories: 200.3, protein: 10.5, carbs: 15.5, fat: 5.2, fiber: 3.4 },
    );
    // All output fields must be integers.
    expect(Number.isInteger(result.calories)).toBe(true);
    expect(Number.isInteger(result.protein)).toBe(true);
    expect(Number.isInteger(result.carbs)).toBe(true);
    expect(Number.isInteger(result.fat)).toBe(true);
    expect(Number.isInteger(result.fiber ?? 0)).toBe(true);
  });
});
