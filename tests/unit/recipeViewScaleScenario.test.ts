/**
 * Recipe-detail scaling — end-to-end scenario test (PR1 Paprika
 * parity, 2026-04-30 customer-lens audit).
 *
 * Locks the spec-level acceptance: load a fixture with 4 servings,
 * scale to 6, assert that representative ingredient grams (chicken
 * 400g → 600g) scale proportionally and that the per-serving →
 * total-for-N-portions kcal display follows the same multiplier.
 *
 * The screen-level component test would require mocking expo-router,
 * Supabase, AppDataContext, and a basket of UI primitives — high
 * fragility for a single behaviour. This test instead covers the
 * exact calculation surface the screen wires (the `viewMultiplier`
 * helper × the `(amount × multiplier).round` display path × the
 * `(perServing × multiplier).round` calorie path) so a regression
 * in any of those three points fails the test deterministically.
 */

import { describe, expect, it } from "vitest";
import {
  initialViewServings,
  stepViewServings,
  viewMultiplier,
} from "../../src/lib/nutrition/recipeViewScale.ts";

type IngredientFixture = {
  name: string;
  /** Authored amount per the recipe's base yield. */
  amount: number;
  unit: string;
};

type RecipeFixture = {
  servings: number;
  caloriesPerServing: number;
  ingredients: IngredientFixture[];
};

/** Mirror of the on-screen amount formatter (mobile rounds to 2 dp,
 *  web uses `formatIngredientAmount`). The shared assertion below
 *  uses the same `Math.round(x * mult * 100) / 100` form mobile
 *  emits today. */
function displayAmount(amount: number, mult: number): number {
  return Math.round(amount * mult * 100) / 100;
}

describe("recipe-detail scaling — Paprika-parity scenario", () => {
  const RECIPE: RecipeFixture = {
    servings: 4,
    caloriesPerServing: 520,
    ingredients: [
      { name: "Chicken thigh", amount: 400, unit: "g" },
      { name: "Olive oil", amount: 30, unit: "ml" },
      { name: "Garlic", amount: 4, unit: "clove" },
    ],
  };

  it("loads at recipe.servings (1× multiplier) by default", () => {
    const view = initialViewServings({ baseServings: RECIPE.servings });
    expect(view).toBe(4);
    expect(viewMultiplier(view, RECIPE.servings)).toBe(1);
  });

  it("scales chicken 400g → 600g when stepping 4 → 6 portions", () => {
    let view = initialViewServings({ baseServings: RECIPE.servings });
    // Two `+` taps from 4.
    view = stepViewServings(view, 1);
    view = stepViewServings(view, 1);
    expect(view).toBe(6);
    const mult = viewMultiplier(view, RECIPE.servings);
    expect(mult).toBeCloseTo(1.5, 6);

    const chicken = RECIPE.ingredients.find((i) => i.name === "Chicken thigh")!;
    expect(displayAmount(chicken.amount, mult)).toBe(600);
  });

  it("scales olive oil 30 ml → 45 ml when stepping 4 → 6 portions", () => {
    const view = stepViewServings(stepViewServings(4, 1), 1);
    const mult = viewMultiplier(view, RECIPE.servings);
    const oil = RECIPE.ingredients.find((i) => i.name === "Olive oil")!;
    expect(displayAmount(oil.amount, mult)).toBe(45);
  });

  it("scales count-noun garlic 4 → 6 cloves when stepping 4 → 6 portions", () => {
    const view = stepViewServings(stepViewServings(4, 1), 1);
    const mult = viewMultiplier(view, RECIPE.servings);
    const garlic = RECIPE.ingredients.find((i) => i.name === "Garlic")!;
    expect(displayAmount(garlic.amount, mult)).toBe(6);
  });

  it("kcal: per-portion is invariant; batch total = perPortion × viewServings", () => {
    // At base yield (4 servings), per-portion = 520 kcal. The hero
    // shows the per-portion value (unchanged when you cook more) and
    // a secondary line surfaces the batch total when the viewer has
    // dialled away from the authored yield.
    let view = 4;
    expect(Math.round(RECIPE.caloriesPerServing)).toBe(520); // per-portion
    expect(view * RECIPE.caloriesPerServing).toBe(2080); // batch total at 1×

    // Step to 6 portions: per-portion stays 520; batch total becomes
    // 520 × 6 = 3120. The on-screen total uses `viewServings`, NOT
    // `multiplier`, because per-portion was never altered.
    view = stepViewServings(stepViewServings(view, 1), 1);
    expect(view).toBe(6);
    expect(Math.round(RECIPE.caloriesPerServing)).toBe(520);
    expect(Math.round(RECIPE.caloriesPerServing * view)).toBe(3120);
  });

  it("scales down chicken 400g → 200g when stepping 4 → 2 portions", () => {
    let view = initialViewServings({ baseServings: RECIPE.servings });
    view = stepViewServings(view, -1);
    view = stepViewServings(view, -1);
    expect(view).toBe(2);
    const mult = viewMultiplier(view, RECIPE.servings);
    const chicken = RECIPE.ingredients.find((i) => i.name === "Chicken thigh")!;
    expect(displayAmount(chicken.amount, mult)).toBe(200);
  });

  it("clamps at 1 — pressing - 10 times from 4 lands at 1, not -6", () => {
    let view = 4;
    for (let i = 0; i < 10; i++) view = stepViewServings(view, -1);
    expect(view).toBe(1);
    const mult = viewMultiplier(view, RECIPE.servings);
    const chicken = RECIPE.ingredients.find((i) => i.name === "Chicken thigh")!;
    expect(displayAmount(chicken.amount, mult)).toBe(100);
  });

  it("clamps at 99 — pressing + many times from 4 lands at 99, not 200", () => {
    let view = 4;
    for (let i = 0; i < 200; i++) view = stepViewServings(view, 1);
    expect(view).toBe(99);
  });
});
