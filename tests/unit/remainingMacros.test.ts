import { describe, expect, it } from "vitest";
import {
  computeRemaining,
  projectRemaining,
  solvePortionToFit,
  portionFitHintCopy,
  portionFitHintForPreview,
  type MacroTargets,
  type MacroConsumed,
  type PortionMacroBasis,
  type SolvePortionResult,
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

describe("solvePortionToFit (ENG-854)", () => {
  // 2000 kcal / 150 P / 200 C / 65 F target. A generic per-100g food at
  // 100 kcal / 5 P / 12 C / 3 F per 100 g.
  const per100gBasis: PortionMacroBasis = {
    calories: 100,
    protein: 5,
    carbs: 12,
    fat: 3,
  };

  it("solves the largest gram portion for a per-100g food bound by calories", () => {
    // Nothing logged → 2000 kcal headroom. 100 kcal/100g → 2000g fits on
    // calories. Protein cap: 150/0.05 = 3000g; carbs: 200/0.12 = 1666g;
    // fat: 65/0.03 = 2166g. Carbs is the tightest at 1666g — so carbs binds,
    // NOT calories. Verify the binding-macro detection picks carbs.
    const result = solvePortionToFit(
      targets,
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      per100gBasis,
      { kind: "per100g", gramWeight: 1 },
      "verified",
    );
    expect(result.kind).toBe("quantified");
    if (result.kind !== "quantified") throw new Error("expected quantified");
    expect(result.binding).toBe("carbs");
    // floor(200 / 0.12) = floor(1666.6) = 1666 g
    expect(result.quantity).toBe(1666);
    expect(result.unit).toBe("g");
    expect(result.none).toBe(false);
  });

  it("binds on calories when calories floor first (default binding)", () => {
    // A calorie-dense, low-macro food: 500 kcal, 1 P, 1 C, 1 F per 100 g.
    // Calories cap with 1000 kcal left: 1000/5 = 200g. Macro caps are huge
    // (200/0.01 = 20000g etc). Calories binds.
    const result = solvePortionToFit(
      targets,
      { calories: 1000, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      { calories: 500, protein: 1, carbs: 1, fat: 1 },
      { kind: "per100g", gramWeight: 1 },
      "verified",
    );
    expect(result.kind).toBe("quantified");
    if (result.kind !== "quantified") throw new Error("expected quantified");
    expect(result.binding).toBe("calories");
    // floor(1000 / 5) = 200 g
    expect(result.quantity).toBe(200);
    // kcal in the solved portion: 5 kcal/g × 200 g = 1000 kcal.
    expect(result.calories).toBe(1000);
  });

  it("binds on calories on a tie (calories wins ties — common-case copy)", () => {
    // Construct a basis where calories and protein cap at the same quantity.
    // Per 100g: 100 kcal, 10 P. Remaining: 1000 kcal, 100 P.
    // calories cap: 1000/1 = 1000g; protein cap: 100/0.1 = 1000g. Tie → calories.
    const result = solvePortionToFit(
      targets,
      { calories: 1000, protein: 50, carbs: 0, fat: 0, fiber: 0 },
      { calories: 100, protein: 10, carbs: 0, fat: 0 },
      { kind: "per100g", gramWeight: 1 },
      "verified",
    );
    expect(result.kind).toBe("quantified");
    if (result.kind !== "quantified") throw new Error("expected quantified");
    expect(result.binding).toBe("calories");
  });

  it("never lets projected remaining go negative — floors the quantity down", () => {
    // 540 kcal left, food is 250 kcal per 100g. 540/2.5 = 216g exactly fits.
    // Confirm logging the solved portion keeps every macro remaining ≥ 0.
    const remainingTargets: MacroTargets = { calories: 2000, protein: 150, carbs: 200, fat: 65 };
    const consumed: MacroConsumed = { calories: 1460, protein: 100, carbs: 150, fat: 50 };
    const basis: PortionMacroBasis = { calories: 250, protein: 10, carbs: 30, fat: 8 };
    const result = solvePortionToFit(
      remainingTargets,
      consumed,
      basis,
      { kind: "per100g", gramWeight: 1 },
      "verified",
    );
    expect(result.kind).toBe("quantified");
    if (result.kind !== "quantified") throw new Error("expected quantified");
    // Project the solved portion forward and assert NO macro goes negative.
    const grams = result.quantity;
    const projected = projectRemaining(remainingTargets, consumed, {
      calories: (basis.calories * grams) / 100,
      protein: (basis.protein * grams) / 100,
      carbs: (basis.carbs * grams) / 100,
      fat: (basis.fat * grams) / 100,
    });
    expect(projected.overCalories).toBe(false);
    expect(projected.overProtein).toBe(false);
    expect(projected.overCarbs).toBe(false);
    expect(projected.overFat).toBe(false);
    expect(projected.deltas.calories).toBeGreaterThanOrEqual(0);
  });

  it("returns none=true with quantity 0 when even a sliver overshoots", () => {
    // Already over on calories (consumed 2100 > 2000) — nothing fits.
    const result = solvePortionToFit(
      targets,
      { calories: 2100, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      per100gBasis,
      { kind: "per100g", gramWeight: 1 },
      "verified",
    );
    expect(result.kind).toBe("quantified");
    if (result.kind !== "quantified") throw new Error("expected quantified");
    expect(result.quantity).toBe(0);
    expect(result.none).toBe(true);
    expect(result.binding).toBe("calories");
  });

  it("solves per-UNIT foods in unit quantities, not grams", () => {
    // A per-serving food: 200 kcal, 8 P, 25 C, 6 F per serving. Per-unit
    // basis, but WITH a real gram weight so it's not forced qualitative.
    const result = solvePortionToFit(
      targets,
      { calories: 1400, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      { calories: 200, protein: 8, carbs: 25, fat: 6 },
      { kind: "perUnit", gramWeight: 150 },
      "verified",
    );
    expect(result.kind).toBe("quantified");
    if (result.kind !== "quantified") throw new Error("expected quantified");
    expect(result.unit).toBe("unit");
    // 600 kcal left / 200 kcal per serving = 3.0 servings; carbs cap
    // 200/25 = 8, protein 150/8 = 18.75, fat 65/6 = 10.8 → calories binds at 3.
    expect(result.quantity).toBe(3);
    expect(result.binding).toBe("calories");
  });

  it("per-unit quantity keeps 0.1 granularity (floors, never rounds up)", () => {
    // 250 kcal left, 100 kcal per serving → 2.5 servings. Floor to 2.5.
    const result = solvePortionToFit(
      targets,
      { calories: 1750, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      { calories: 100, protein: 1, carbs: 1, fat: 1 },
      { kind: "perUnit", gramWeight: 50 },
      "verified",
    );
    expect(result.kind).toBe("quantified");
    if (result.kind !== "quantified") throw new Error("expected quantified");
    // 250/100 = 2.5 exactly → 2.5 servings.
    expect(result.quantity).toBe(2.5);
  });

  describe("NUTRITION-TRUST: low confidence → qualitative, never a fake number", () => {
    it("returns qualitative (no quantity field) when gramWeight is 0", () => {
      const result = solvePortionToFit(
        targets,
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        per100gBasis,
        { kind: "perUnit", gramWeight: 0 }, // no metric grounding
        "verified", // even with "verified" tier, no grounding forces qualitative
      );
      expect(result.kind).toBe("qualitative");
      if (result.kind !== "qualitative") throw new Error("expected qualitative");
      expect(result.reason).toBe("no-grounding");
      // The result must NOT carry any fabricated gram/serving number.
      expect((result as Record<string, unknown>).quantity).toBeUndefined();
      // Binding is still computed so copy can say "limited by …".
      expect(["calories", "protein", "carbs", "fat", "fiber"]).toContain(result.binding);
    });

    it("returns qualitative when the confidence tier is 'estimated'", () => {
      const result = solvePortionToFit(
        targets,
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        per100gBasis,
        { kind: "per100g", gramWeight: 1 }, // grounded…
        "estimated", // …but low confidence in the count-to-weight match
      );
      expect(result.kind).toBe("qualitative");
      if (result.kind !== "qualitative") throw new Error("expected qualitative");
      expect(result.reason).toBe("low-confidence");
      expect((result as Record<string, unknown>).quantity).toBeUndefined();
    });

    it("returns qualitative when the confidence tier is 'low'", () => {
      const result = solvePortionToFit(
        targets,
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        per100gBasis,
        { kind: "per100g", gramWeight: 1 },
        "low",
      );
      expect(result.kind).toBe("qualitative");
    });
  });

  it("only constrains on fiber when the user actually tracks it", () => {
    // Fiber-heavy food. With a fiber target (28g) and 0 consumed, the fiber
    // cap can bind; without a fiber target it must be ignored entirely.
    const fiberBasis: PortionMacroBasis = { calories: 50, protein: 2, carbs: 10, fat: 0, fiber: 14 };
    const withFiber = solvePortionToFit(
      { calories: 2000, protein: 150, carbs: 200, fat: 65, fiber: 28 },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      fiberBasis,
      { kind: "per100g", gramWeight: 1 },
      "verified",
    );
    expect(withFiber.kind).toBe("quantified");
    if (withFiber.kind !== "quantified") throw new Error("expected quantified");
    // fiber cap: 28 / 0.14 ≈ 199.999 (float) → floor 199g; carbs: 200/0.1 =
    // 2000g; cal: 2000/0.5 = 4000g. Fiber is tightest → binds. The floor
    // (never round UP past the budget) is the safe direction.
    expect(withFiber.binding).toBe("fiber");
    expect(withFiber.quantity).toBe(199);

    const noFiber = solvePortionToFit(
      { calories: 2000, protein: 150, carbs: 200, fat: 65 }, // no fiber target
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
      fiberBasis,
      { kind: "per100g", gramWeight: 1 },
      "verified",
    );
    expect(noFiber.kind).toBe("quantified");
    if (noFiber.kind !== "quantified") throw new Error("expected quantified");
    // Without a fiber target, carbs (2000g) binds — fiber ignored.
    expect(noFiber.binding).toBe("carbs");
  });
});

describe("portionFitHintCopy (ENG-854)", () => {
  it("returns null for a null result", () => {
    expect(portionFitHintCopy(null, 500)).toBeNull();
  });

  it("calories-bound quantified result reads body-neutral with remaining kcal", () => {
    const result: SolvePortionResult = {
      kind: "quantified",
      quantity: 220,
      unit: "g",
      binding: "calories",
      calories: 540,
      none: false,
    };
    expect(portionFitHintCopy(result, 540)).toBe("A 220 g serving fits your remaining 540 kcal.");
  });

  it("macro-bound quantified result names the binding macro, no kcal claim", () => {
    const result: SolvePortionResult = {
      kind: "quantified",
      quantity: 2,
      unit: "unit",
      binding: "carbs",
      calories: 300,
      none: false,
    };
    expect(portionFitHintCopy(result, 800)).toBe("About 2 servings fits — limited by carbs.");
  });

  it("singular serving for quantity 1", () => {
    const result: SolvePortionResult = {
      kind: "quantified",
      quantity: 1,
      unit: "unit",
      binding: "protein",
      calories: 200,
      none: false,
    };
    expect(portionFitHintCopy(result, 600)).toBe("About 1 serving fits — limited by protein.");
  });

  it("none-fits result is permission-giving, not shaming", () => {
    const result: SolvePortionResult = {
      kind: "quantified",
      quantity: 0,
      unit: "g",
      binding: "calories",
      calories: 0,
      none: true,
    };
    expect(portionFitHintCopy(result, 0)).toBe("This doesn't fit what's left today — but it's your call.");
  });

  it("qualitative result NEVER prints a gram or serving number", () => {
    const result: SolvePortionResult = { kind: "qualitative", binding: "calories", reason: "no-grounding" };
    const copy = portionFitHintCopy(result, 540);
    expect(copy).toBe("This can fit — adjust the amount to match what's left.");
    // Hard guard: the qualitative copy contains no digit at all.
    expect(copy && /\d/.test(copy)).toBe(false);
  });
});

describe("portionFitHintForPreview (ENG-854)", () => {
  it("returns null when targets/consumed/preview are missing", () => {
    expect(portionFitHintForPreview(undefined, { calories: 0, protein: 0, carbs: 0, fat: 0 }, null)).toBeNull();
    expect(portionFitHintForPreview(targets, undefined, null)).toBeNull();
    expect(portionFitHintForPreview(targets, { calories: 0, protein: 0, carbs: 0, fat: 0 }, null)).toBeNull();
  });

  it("per-100g grounded preview produces a concrete gram hint", () => {
    const copy = portionFitHintForPreview(
      { calories: 2000, protein: 150, carbs: 200, fat: 65 },
      { calories: 1460, protein: 100, carbs: 150, fat: 50 }, // 540 kcal left
      {
        macrosPer100g: { calories: 250, protein: 10, carbs: 5, fat: 8 },
        chosenPortion: { gramWeight: 1 },
      },
    );
    // 540 kcal left, 2.5 kcal/g → 216g on calories; carbs 50/0.05=1000g;
    // fat 15/0.08=187g binds. Either way the copy is concrete + grounded.
    expect(copy).toBeTruthy();
    expect(copy && /\d/.test(copy)).toBe(true);
  });

  it("per-SERVING preview (gramWeight 0) stays qualitative — no fake count", () => {
    const copy = portionFitHintForPreview(
      { calories: 2000, protein: 150, carbs: 200, fat: 65 },
      { calories: 1460, protein: 100, carbs: 150, fat: 50 },
      {
        macrosPer100g: null,
        macrosPerServing: { calories: 200, protein: 8, carbs: 25, fat: 6 },
        chosenPortion: { gramWeight: 0 }, // FatSecret count serving, no grounding
      },
    );
    expect(copy).toBe("This can fit — adjust the amount to match what's left.");
  });

  it("returns null when neither basis is available", () => {
    const copy = portionFitHintForPreview(
      targets,
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
      { macrosPer100g: null, chosenPortion: { gramWeight: 1 } },
    );
    expect(copy).toBeNull();
  });
});
