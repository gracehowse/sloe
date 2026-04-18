/**
 * Edge-case coverage for remainingMacros: partial candidates (USDA/OFF
 * missing-macro case), extreme values, exact-on-the-line boundary.
 * Complements remainingMacros.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  computeRemaining,
  projectRemaining,
  type MacroConsumed,
  type MacroTargets,
} from "@/lib/nutrition/remainingMacros";

const targets: MacroTargets = {
  calories: 2000, protein: 150, carbs: 200, fat: 65, fiber: 28,
};

describe("projectRemaining — partial candidate (real USDA/OFF shape)", () => {
  const consumed: MacroConsumed = { calories: 1000, protein: 80, carbs: 100, fat: 30, fiber: 12 };

  it("candidate with only calories+protein: carbs/fat untouched", () => {
    const candidate = { calories: 300, protein: 25 } as unknown as MacroConsumed;
    const r = projectRemaining(targets, consumed, candidate);
    expect(r.calories).toBe(700);
    expect(r.protein).toBe(45);
    expect(r.carbs).toBe(100);
    expect(r.fat).toBe(35);
    expect(r.fiber).toBe(16);
  });

  it("candidate with undefined fiber keeps fiber remaining unchanged", () => {
    const candidate: MacroConsumed = { calories: 100, protein: 10, carbs: 5, fat: 2 };
    const r = projectRemaining(targets, consumed, candidate);
    expect(r.fiber).toBe(16);
  });

  it("null macro values treated as 0", () => {
    const candidate = {
      calories: 200, protein: null, carbs: null, fat: null,
    } as unknown as MacroConsumed;
    const r = projectRemaining(targets, consumed, candidate);
    expect(r.calories).toBe(800);
    expect(r.protein).toBe(70);
    expect(r.carbs).toBe(100);
    expect(r.fat).toBe(35);
  });

  it("NaN values treated as 0", () => {
    const candidate: MacroConsumed = {
      calories: 150, protein: Number.NaN, carbs: Number.NaN, fat: Number.NaN,
    };
    const r = projectRemaining(targets, consumed, candidate);
    expect(r.calories).toBe(850);
    expect(r.protein).toBe(70);
  });
});

describe("computeRemaining — partial consumed", () => {
  it("only calories provided: other macros show full target", () => {
    const r = computeRemaining(targets, { calories: 800 } as unknown as MacroConsumed);
    expect(r.calories).toBe(1200);
    expect(r.protein).toBe(150);
    expect(r.carbs).toBe(200);
    expect(r.fat).toBe(65);
    expect(r.fiber).toBe(28);
  });
});

describe("computeRemaining — extreme values", () => {
  it("1e9 consumed: over=true, remaining=0, delta finite", () => {
    const r = computeRemaining(targets, { calories: 1e9, protein: 1e9, carbs: 1e9, fat: 1e9, fiber: 1e9 });
    expect(r.calories).toBe(0);
    expect(r.overCalories).toBe(true);
    expect(Number.isFinite(r.deltas.calories)).toBe(true);
    expect(Number.isFinite(r.deltas.fiber!)).toBe(true);
  });

  it("1e9 target: finite remaining and not over", () => {
    const huge: MacroTargets = { calories: 1e9, protein: 1e9, carbs: 1e9, fat: 1e9, fiber: 1e9 };
    const r = computeRemaining(huge, { calories: 500, protein: 30, carbs: 40, fat: 10, fiber: 3 });
    expect(Number.isFinite(r.calories)).toBe(true);
    expect(r.overCalories).toBe(false);
  });

  it("exactly one unit over: delta = -1", () => {
    const r = computeRemaining(targets, { calories: 2001, protein: 151, carbs: 201, fat: 66, fiber: 29 });
    expect(r.overCalories).toBe(true);
    expect(r.deltas.calories).toBe(-1);
    expect(r.overProtein).toBe(true);
    expect(r.deltas.protein).toBe(-1);
  });
});

describe("projectRemaining — boundary: candidate to the line", () => {
  it("candidate fills exactly to target → remaining=0, over=false", () => {
    const r = projectRemaining(
      targets,
      { calories: 1000, protein: 50, carbs: 100, fat: 30, fiber: 10 },
      { calories: 1000, protein: 100, carbs: 100, fat: 35, fiber: 18 },
    );
    expect(r.calories).toBe(0);
    expect(r.overCalories).toBe(false);
    expect(r.protein).toBe(0);
    expect(r.overProtein).toBe(false);
    expect(r.fat).toBe(0);
    expect(r.overFat).toBe(false);
    expect(r.fiber).toBe(0);
    expect(r.overFiber).toBe(false);
  });

  it("candidate 1 kcal over → over=true, delta=-1", () => {
    const r = projectRemaining(
      targets,
      { calories: 1000, protein: 50, carbs: 100, fat: 30 },
      { calories: 1001, protein: 0, carbs: 0, fat: 0 },
    );
    expect(r.overCalories).toBe(true);
    expect(r.deltas.calories).toBe(-1);
    expect(r.calories).toBe(0);
  });
});

describe("projectRemaining — zero calorie target", () => {
  it("calorie target 0 + positive candidate → over with negative delta", () => {
    const r = projectRemaining(
      { calories: 0, protein: 150, carbs: 200, fat: 65 },
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
      { calories: 250, protein: 20, carbs: 30, fat: 10 },
    );
    expect(r.overCalories).toBe(true);
    expect(r.deltas.calories).toBe(-250);
  });
});
