/**
 * F-15 — joint macro-fit scaler tests.
 *
 * Covers the scaler's three-priority objective (protein ±10% → calories ±5%
 * → carbs+fat ±15%), the shared `PORTION_MULTIPLIER_CLAMP`, and the
 * `residualProteinGap` surface used by the day-card hint.
 *
 * TestFlight context: `APO0Nk_bre7hVGh9ORM7bGw` (2026-04-19), product-lead
 * consult dated 2026-04-19.
 */
import { describe, it, expect } from "vitest";
import {
  PORTION_MULTIPLIER_CLAMP,
  clampPlannerMultiplier,
  fitDayToTargets,
  generateSmartPlan,
  mealPlanDeviationFromOnePenalty,
  type PlannerTargets,
  type SimpleRecipe,
} from "../../src/lib/nutrition/mealPlanAlgo";

const baseTargets: PlannerTargets = {
  calories: 2000,
  protein: 120,
  carbs: 220,
  fat: 65,
  calorieBandPct: 5,
  carbFatBandPct: 15,
};

function macro(calories: number, protein: number, carbs: number, fat: number) {
  return { calories, protein, carbs, fat };
}

describe("PORTION_MULTIPLIER_CLAMP", () => {
  // 2026-04-25 polish — tightened from {0.2, 2.5, 0.1} (23 legal positions) to
  // {0.5, 2.0, 0.5} (4 legal positions: 0.5, 1, 1.5, 2). Tester feedback was
  // that fractions like 0.3× and 1.2× felt arbitrary; whole/half portions
  // read as sensible. The optimizer's mealPlanDeviationFromOnePenalty (×18)
  // continues to bias toward 1× whenever bands allow.
  it("uses the sensible-portions clamp (0.5..2.0, 0.5 step)", () => {
    expect(PORTION_MULTIPLIER_CLAMP).toEqual({ min: 0.5, max: 2.0, step: 0.5 });
  });

  it("clampPlannerMultiplier snaps to whole/half steps and clamps to min/max", () => {
    expect(clampPlannerMultiplier(1)).toBe(1);
    expect(clampPlannerMultiplier(1.2)).toBeCloseTo(1.0, 6);
    expect(clampPlannerMultiplier(1.4)).toBeCloseTo(1.5, 6);
    expect(clampPlannerMultiplier(0.01)).toBe(PORTION_MULTIPLIER_CLAMP.min);
    expect(clampPlannerMultiplier(10)).toBe(PORTION_MULTIPLIER_CLAMP.max);
    expect(clampPlannerMultiplier(Number.NaN)).toBe(1);
  });
});

describe("fitDayToTargets — joint scaler", () => {
  it("fits within bands when the pool has room", () => {
    // Three slots totalling ~2000 kcal / 130g protein at 1x — already close
    // to the 2000 / 120g target. Scaler should keep multipliers near 1.
    const recipes = [
      macro(500, 30, 55, 15),  // breakfast
      macro(700, 50, 70, 22),  // lunch
      macro(800, 50, 95, 28),  // dinner
    ];
    const fit = fitDayToTargets({ recipes, multipliers: [1, 1, 1], targets: baseTargets });
    const sum = recipes.reduce(
      (a, r, i) => ({
        calories: a.calories + r.calories * fit.multipliers[i]!,
        protein: a.protein + r.protein * fit.multipliers[i]!,
      }),
      { calories: 0, protein: 0 },
    );
    expect(sum.protein).toBeGreaterThanOrEqual(baseTargets.protein * 0.9);
    expect(sum.protein).toBeLessThanOrEqual(baseTargets.protein * 1.1);
    expect(sum.calories).toBeGreaterThanOrEqual(baseTargets.calories * 0.95);
    expect(sum.calories).toBeLessThanOrEqual(baseTargets.calories * 1.05);
    expect(fit.residualProteinGap).toBe(0);
  });

  it("drives protein up by scaling slots even when it overshoots the calorie target (protein-leading)", () => {
    // Acceptance case from the brief: 1800 kcal / 90g @ 1x vs 2000 / 120g.
    // Scaler should push protein ≥ 108g (90% of 120) even if calories go to
    // ~1950 (still within ±5% of 2000).
    const recipes = [
      macro(500, 25, 55, 15),  // breakfast
      macro(600, 30, 70, 18),  // lunch
      macro(700, 35, 85, 22),  // dinner
    ];
    const fit = fitDayToTargets({ recipes, multipliers: [1, 1, 1], targets: baseTargets });
    const protein = recipes.reduce((a, r, i) => a + r.protein * fit.multipliers[i]!, 0);
    const calories = recipes.reduce((a, r, i) => a + r.calories * fit.multipliers[i]!, 0);
    expect(protein).toBeGreaterThanOrEqual(baseTargets.protein * 0.9);
    // Calories may overshoot the tight ±5% band because protein wins — but
    // must stay within the scaler's outer clamp (no multiplier beyond 2.5x).
    expect(calories).toBeLessThan(baseTargets.calories * 2);
    expect(fit.residualProteinGap).toBe(0);
    for (const m of fit.multipliers) {
      expect(m).toBeGreaterThanOrEqual(PORTION_MULTIPLIER_CLAMP.min);
      expect(m).toBeLessThanOrEqual(PORTION_MULTIPLIER_CLAMP.max);
    }
  });

  it("returns a negative residualProteinGap when clamped at max and still short", () => {
    // Tiny-protein library (20g / 1000 kcal per slot). Even at 2.5x max
    // multiplier the day tops out at ~150g protein across 3 slots — but
    // against a 300g target the gap is > 100g.
    const recipes = [
      macro(1000, 20, 110, 25),
      macro(1000, 20, 110, 25),
      macro(1000, 20, 110, 25),
    ];
    const targets = { ...baseTargets, protein: 300 };
    const fit = fitDayToTargets({ recipes, multipliers: [0.5, 0.5, 0.5], targets });
    for (const m of fit.multipliers) {
      expect(m).toBeLessThanOrEqual(PORTION_MULTIPLIER_CLAMP.max);
    }
    expect(fit.residualProteinGap).toBeLessThan(0);
    // Should also be less than -10 so the UI would surface it.
    expect(fit.residualProteinGap).toBeLessThan(-10);
  });

  it("returns a negative residualProteinGap when clamped at min and still short", () => {
    // Protein-dense recipe but target is very low calorie (user on extreme
    // cut). At min 0.2x the protein may still exceed the target, but if the
    // target is set high enough that even min-clamp can't reach it we
    // surface the gap.
    // Scenario: a single tiny recipe and a high protein target.
    const recipes = [macro(100, 5, 10, 2)];
    const targets: PlannerTargets = { calories: 100, protein: 200, carbs: 20, fat: 5, calorieBandPct: 5, carbFatBandPct: 15 };
    const fit = fitDayToTargets({ recipes, multipliers: [1], targets });
    expect(fit.multipliers[0]).toBeGreaterThanOrEqual(PORTION_MULTIPLIER_CLAMP.min);
    expect(fit.multipliers[0]).toBeLessThanOrEqual(PORTION_MULTIPLIER_CLAMP.max);
    // Best-achievable at max 2.5x is 12.5g protein vs 200g target → huge gap.
    expect(fit.residualProteinGap).toBeLessThan(-100);
  });

  it("returns no-op for an empty day (guardrail)", () => {
    const fit = fitDayToTargets({ recipes: [], multipliers: [], targets: baseTargets });
    expect(fit.multipliers).toEqual([]);
    expect(fit.residualProteinGap).toBe(0);
  });

  it("keeps single-slot days bounded to the shared clamp", () => {
    const recipes = [macro(400, 25, 40, 12)];
    const fit = fitDayToTargets({
      recipes,
      multipliers: [1],
      targets: { ...baseTargets, calories: 800, protein: 50 },
    });
    expect(fit.multipliers[0]).toBeGreaterThanOrEqual(PORTION_MULTIPLIER_CLAMP.min);
    expect(fit.multipliers[0]).toBeLessThanOrEqual(PORTION_MULTIPLIER_CLAMP.max);
  });

  it("never reports a positive residualProteinGap (overshooting is not a gap)", () => {
    // High-protein library that easily clears the target.
    const recipes = [macro(400, 50, 10, 10), macro(500, 60, 20, 12)];
    const targets: PlannerTargets = { calories: 900, protein: 50, carbs: 30, fat: 22, calorieBandPct: 10, carbFatBandPct: 20 };
    const fit = fitDayToTargets({ recipes, multipliers: [1, 1], targets });
    expect(fit.residualProteinGap).toBeLessThanOrEqual(0);
  });

  it("F-73 snaps multipliers toward 1× when slight asymmetry still satisfies all bands", () => {
    const recipes = [
      macro(283, 25, 30, 10),
      macro(425, 37, 45, 14),
      macro(397, 28, 40, 13),
    ];
    const targets: PlannerTargets = {
      calories: 1105,
      protein: 90,
      carbs: 115,
      fat: 37,
      calorieBandPct: 5,
      carbFatBandPct: 15,
    };
    const fit = fitDayToTargets({
      recipes,
      multipliers: [1.03, 0.97, 1.0],
      targets,
    });
    const dev = fit.multipliers.reduce((a, m) => a + Math.abs(m - 1), 0);
    expect(dev).toBeLessThan(0.15);
  });

  it("does not trade protein band for calorie band (priority order holds)", () => {
    // Set up a situation where dropping calories could be achieved by
    // shrinking a protein-rich slot — scaler must refuse that trade.
    const recipes = [
      macro(500, 40, 20, 10),  // protein-rich
      macro(900, 20, 120, 20), // carb-heavy
    ];
    const targets: PlannerTargets = { calories: 1200, protein: 60, carbs: 140, fat: 30, calorieBandPct: 5, carbFatBandPct: 15 };
    const fit = fitDayToTargets({ recipes, multipliers: [1, 1], targets });
    const protein = recipes.reduce((a, r, i) => a + r.protein * fit.multipliers[i]!, 0);
    // Protein must stay in band (±10%) — must NOT be dropped to help calories.
    expect(protein).toBeGreaterThanOrEqual(targets.protein * 0.9);
    expect(protein).toBeLessThanOrEqual(targets.protein * 1.1);
  });
});

describe("mealPlanDeviationFromOnePenalty", () => {
  it("increases with distance from 1×", () => {
    expect(mealPlanDeviationFromOnePenalty([1, 1, 1, 1])).toBe(0);
    expect(mealPlanDeviationFromOnePenalty([1.2, 0.8, 1, 1])).toBeGreaterThan(0);
  });
});

describe("generateSmartPlan — residualProteinGap wiring", () => {
  const proteinRich: SimpleRecipe = { id: "b", title: "Oats Protein", calories: 400, protein: 35, carbs: 40, fat: 10, mealType: ["breakfast"] };
  const highProLunch: SimpleRecipe = { id: "l", title: "Chicken Bowl", calories: 550, protein: 45, carbs: 50, fat: 15, mealType: ["lunch"] };
  const proDinner: SimpleRecipe = { id: "d", title: "Salmon", calories: 650, protein: 48, carbs: 45, fat: 25, mealType: ["dinner"] };
  const snack: SimpleRecipe = { id: "s", title: "Nuts", calories: 200, protein: 8, carbs: 8, fat: 18, mealType: ["snack"] };

  it("does not emit residualProteinGap when the plan hits the protein band", () => {
    const plan = generateSmartPlan({
      recipes: [proteinRich, highProLunch, proDinner, snack],
      targets: baseTargets,
      days: 1,
      seed: 42,
    });
    // 35 + 45 + 48 + 8 = 136g base; target 120g. Scaler should easily reach band.
    expect(plan[0]!.residualProteinGap ?? 0).toBeGreaterThanOrEqual(-10);
  });

  it("emits residualProteinGap < -10 on a protein-starved library (day card will show the hint)", () => {
    const lowPro: SimpleRecipe = {
      id: "l1",
      title: "Plain Rice",
      calories: 600,
      protein: 5,
      carbs: 130,
      fat: 2,
      mealType: ["breakfast", "lunch", "dinner", "snack"],
    };
    // Only one recipe, fills every slot at max ~2.5x → 12.5g protein/slot → 50g total. Target 120g.
    const plan = generateSmartPlan({
      recipes: [lowPro],
      targets: baseTargets,
      days: 1,
      seed: 7,
    });
    const dp = plan[0]!;
    expect(dp.residualProteinGap).toBeDefined();
    expect(dp.residualProteinGap!).toBeLessThan(-10);
  });

  it("returns a best-effort plan when the library is single-recipe and protein is unreachable (no throw)", () => {
    const only: SimpleRecipe = {
      id: "only",
      title: "Rice Bowl",
      calories: 500,
      protein: 6,
      carbs: 110,
      fat: 3,
      mealType: ["breakfast", "lunch", "dinner", "snack"],
    };
    const fn = () => generateSmartPlan({ recipes: [only], targets: baseTargets, days: 1, seed: 3 });
    expect(fn).not.toThrow();
    const plan = fn();
    expect(plan[0]!.meals.length).toBeGreaterThan(0);
    expect(plan[0]!.residualProteinGap!).toBeLessThan(0);
  });
});
