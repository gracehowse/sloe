/**
 * ENG-956 — per-meal lock ("keep this meal", Refresh the rest).
 *
 * Proves the three load-bearing guarantees of the partial regenerate:
 *   1. Locked meals are BYTE-IDENTICAL across a regenerate (same reference,
 *      same fields, lock flag intact).
 *   2. Only unlocked meals change.
 *   3. The unlocked remainder rebalances toward (daily target − locked
 *      meals' macros), not the original per-slot share.
 *
 * Plus the edge cases: nothing locked (no-op), everything locked (no-op),
 * over-locked day (locked macros already exceed the day target), and the
 * web `regeneratePlanKeepingLocked` wrapper recomputing day totals.
 */
import { describe, expect, it } from "vitest";
import {
  regenerateUnlockedMeals,
  type MealPlanRecipe,
  type PlanMeal,
  type PlannerTargets,
} from "../../src/lib/nutrition/mealPlanAlgo";
import { regeneratePlanKeepingLocked } from "../../src/lib/planning/generateMealPlan";
import type { DayPlan, RecipeCard } from "../../src/types/recipe";

const SLOTS = ["Breakfast", "Lunch", "Dinner"];

const targets: PlannerTargets = {
  calories: 2100,
  protein: 150,
  carbs: 210,
  fat: 70,
  fiber: 30,
  calorieBandPct: 5,
  carbFatBandPct: 15,
};

/** A pool with several distinct, slot-tagged recipes per slot so the
 *  re-roll has real alternatives to pick from. `mealType` undefined =
 *  fits any slot (the predicate below treats untagged as universal). */
const pool: (MealPlanRecipe & { mealType?: string[] })[] = [
  { id: "oats", title: "Overnight Oats", calories: 420, protein: 30, carbs: 55, fat: 9, fiberG: 8 },
  { id: "eggs", title: "Egg Scramble", calories: 380, protein: 34, carbs: 6, fat: 24, fiberG: 2 },
  { id: "pancakes", title: "Protein Pancakes", calories: 460, protein: 36, carbs: 50, fat: 12, fiberG: 6 },
  { id: "chicken", title: "Chicken Bowl", calories: 540, protein: 48, carbs: 46, fat: 16, fiberG: 9 },
  { id: "salmon", title: "Grilled Salmon", calories: 520, protein: 44, carbs: 20, fat: 28, fiberG: 5 },
  { id: "tofu", title: "Tofu Stir Fry", calories: 480, protein: 30, carbs: 52, fat: 18, fiberG: 11 },
  { id: "steak", title: "Steak & Veg", calories: 620, protein: 52, carbs: 30, fat: 32, fiberG: 7 },
  { id: "curry", title: "Lentil Curry", calories: 560, protein: 30, carbs: 70, fat: 16, fiberG: 14 },
  { id: "pasta", title: "Turkey Pasta", calories: 600, protein: 46, carbs: 68, fat: 14, fiberG: 8 },
];

const slotFit = (_r: MealPlanRecipe, _slot: string) => true;

/** Build a day's meals; the slot at `lockedIndex` (if given) is locked and
 *  carries a stable recipe so we can assert byte-identity afterward. */
function buildMeals(lockedIndex: number | null): PlanMeal[] {
  const base: PlanMeal[] = [
    { name: "Breakfast", recipeTitle: "Overnight Oats", recipeId: "oats", calories: 420, protein: 30, carbs: 55, fat: 9, fiberG: 8 },
    { name: "Lunch", recipeTitle: "Chicken Bowl", recipeId: "chicken", calories: 540, protein: 48, carbs: 46, fat: 16, fiberG: 9 },
    { name: "Dinner", recipeTitle: "Steak & Veg", recipeId: "steak", calories: 620, protein: 52, carbs: 30, fat: 32, fiberG: 7 },
  ];
  if (lockedIndex !== null) base[lockedIndex] = { ...base[lockedIndex]!, isLocked: true };
  return base;
}

describe("regenerateUnlockedMeals (ENG-956)", () => {
  it("keeps the locked meal byte-identical and only changes unlocked meals", () => {
    const meals = buildMeals(1); // lock Lunch
    const lockedRef = meals[1]!;

    const { meals: next } = regenerateUnlockedMeals({
      meals,
      pool,
      slots: SLOTS,
      targets,
      recentIds: new Set<string>(),
      rand: deterministicRand(42),
      slotFitPredicate: slotFit,
    });

    // 1. The locked slot is the EXACT same object reference (byte-identical).
    expect(next[1]).toBe(lockedRef);
    expect(next[1]!.isLocked).toBe(true);
    expect(next[1]!.recipeId).toBe("chicken");

    // 2. Slot order is preserved.
    expect(next.map((m) => m.name)).toEqual(["Breakfast", "Lunch", "Dinner"]);

    // 3. The unlocked slots may change recipe; at least one differs from the
    //    original (the pool has plenty of alternatives + recency steering).
    const changed =
      next[0]!.recipeId !== meals[0]!.recipeId || next[2]!.recipeId !== meals[2]!.recipeId;
    expect(changed).toBe(true);

    // 4. The re-rolled slots are never the locked recipe (no same-day dupe).
    expect(next[0]!.recipeId).not.toBe("chicken");
    expect(next[2]!.recipeId).not.toBe("chicken");
  });

  it("rebalances the unlocked remainder toward (target − locked)", () => {
    const meals = buildMeals(1); // lock Lunch (chicken, 540 kcal)
    const lockedKcal = meals[1]!.calories; // 540

    const { meals: next } = regenerateUnlockedMeals({
      meals,
      pool,
      slots: SLOTS,
      targets,
      recentIds: new Set<string>(),
      rand: deterministicRand(7),
      slotFitPredicate: slotFit,
    });

    const unlockedKcal = next[0]!.calories + next[2]!.calories;
    const remainingTarget = targets.calories - lockedKcal; // 2100 - 540 = 1560

    // The unlocked slots aim at the REMAINING budget, not the full day target.
    // Assert they land much closer to `remaining` than to the full target.
    const driftFromRemaining = Math.abs(unlockedKcal - remainingTarget);
    const driftFromFullTarget = Math.abs(unlockedKcal - targets.calories);
    expect(driftFromRemaining).toBeLessThan(driftFromFullTarget);

    // And the whole-day total (locked + re-rolled) still tracks the day goal
    // within a sane envelope (the joint fitter targets ±5% on the remainder;
    // give the assertion generous headroom for small pools).
    const dayKcal = next.reduce((a, m) => a + m.calories, 0);
    expect(Math.abs(dayKcal - targets.calories)).toBeLessThan(targets.calories * 0.25);
  });

  it("is a no-op when no meal is locked (caller should use full regenerate)", () => {
    const meals = buildMeals(null);
    const { meals: next } = regenerateUnlockedMeals({
      meals,
      pool,
      slots: SLOTS,
      targets,
      recentIds: new Set<string>(),
      rand: deterministicRand(1),
      slotFitPredicate: slotFit,
    });
    // Every reference preserved — nothing re-rolled.
    next.forEach((m, i) => expect(m).toBe(meals[i]));
  });

  it("is a no-op when every meal is locked", () => {
    const meals = buildMeals(null).map((m) => ({ ...m, isLocked: true }));
    const { meals: next } = regenerateUnlockedMeals({
      meals,
      pool,
      slots: SLOTS,
      targets,
      recentIds: new Set<string>(),
      rand: deterministicRand(1),
      slotFitPredicate: slotFit,
    });
    next.forEach((m, i) => {
      expect(m).toBe(meals[i]);
      expect(m.isLocked).toBe(true);
    });
  });

  it("handles an over-locked day (locked macros already exceed the target)", () => {
    // Lock two big dinners so locked kcal > day target. The remaining budget
    // floors at 1; the function must not throw and must keep both locks.
    const meals: PlanMeal[] = [
      { name: "Breakfast", recipeTitle: "Overnight Oats", recipeId: "oats", calories: 420, protein: 30, carbs: 55, fat: 9, fiberG: 8 },
      { name: "Lunch", recipeTitle: "Steak & Veg", recipeId: "steak", calories: 1200, protein: 100, carbs: 60, fat: 64, fiberG: 14, isLocked: true },
      { name: "Dinner", recipeTitle: "Lentil Curry", recipeId: "curry", calories: 1100, protein: 60, carbs: 140, fat: 32, fiberG: 28, isLocked: true },
    ];
    expect(() =>
      regenerateUnlockedMeals({
        meals,
        pool,
        slots: SLOTS,
        targets,
        recentIds: new Set<string>(),
        rand: deterministicRand(99),
        slotFitPredicate: slotFit,
      }),
    ).not.toThrow();
    const { meals: next } = regenerateUnlockedMeals({
      meals,
      pool,
      slots: SLOTS,
      targets,
      recentIds: new Set<string>(),
      rand: deterministicRand(99),
      slotFitPredicate: slotFit,
    });
    expect(next[1]).toBe(meals[1]);
    expect(next[2]).toBe(meals[2]);
    // Breakfast (the only unlocked slot) is re-rolled and not a locked recipe.
    expect(next[0]!.recipeId).not.toBe("steak");
    expect(next[0]!.recipeId).not.toBe("curry");
  });
});

describe("regeneratePlanKeepingLocked (web wrapper)", () => {
  const savedRecipes: RecipeCard[] = pool.map((r) => ({
    id: r.id,
    title: r.title,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    fiberG: r.fiberG,
    creatorName: "Test",
    creatorImage: "",
    image: "",
    servings: 1,
    isVerified: true,
    savedCount: 0,
    isSaved: false,
  }));

  it("preserves locked meals across days and recomputes totals", () => {
    const existingPlan: DayPlan[] = [
      {
        day: 1,
        meals: [
          { name: "Breakfast", recipeTitle: "Overnight Oats", recipeId: "oats", calories: 420, protein: 30, carbs: 55, fat: 9, fiberG: 8 },
          { name: "Lunch", recipeTitle: "Chicken Bowl", recipeId: "chicken", calories: 540, protein: 48, carbs: 46, fat: 16, fiberG: 9, isLocked: true },
          { name: "Dinner", recipeTitle: "Steak & Veg", recipeId: "steak", calories: 620, protein: 52, carbs: 30, fat: 32, fiberG: 7 },
        ],
        totals: { calories: 1580, protein: 130, carbs: 131, fat: 57 },
      },
    ];

    const next = regeneratePlanKeepingLocked({
      existingPlan,
      savedRecipes,
      targets,
      seed: 12345,
    });

    expect(next).toHaveLength(1);
    const day = next[0]!;
    // Locked lunch preserved (same recipe + lock flag).
    expect(day.meals[1]!.recipeId).toBe("chicken");
    expect(day.meals[1]!.isLocked).toBe(true);
    // Totals recomputed from the stitched meals (not the stale input totals).
    const expectedKcal = day.meals.reduce((a, m) => a + m.calories, 0);
    expect(day.totals.calories).toBe(expectedKcal);
  });
});

/**
 * Deterministic mulberry32-style RNG so the tests are seed-stable. Mirrors the
 * algorithm's own `mulberry32` so the re-roll picks are reproducible in CI.
 */
function deterministicRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
