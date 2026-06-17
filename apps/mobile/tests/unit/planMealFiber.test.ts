import { describe, expect, it } from "vitest";
import {
  enrichPlanMealsFiber,
  planMealFiberG,
  type PlanMealFiberInput,
} from "@/lib/planMealFiber";

const POOL = [
  {
    id: "r1",
    title: "Oats bowl",
    calories: 400,
    fiber_per_serving: 8,
  },
];

describe("planMealFiberG", () => {
  it("returns stored fiberG when present", () => {
    expect(
      planMealFiberG(
        { recipeTitle: "X", calories: 200, fiberG: 5, recipeId: "r1" },
        POOL,
      ),
    ).toBe(5);
  });

  it("derives fibre from recipe when meal row omits fiberG", () => {
    expect(
      planMealFiberG({ recipeTitle: "Oats bowl", calories: 400, recipeId: "r1" }, POOL),
    ).toBe(8);
  });

  it("reads legacy fiber field names on recipe refs", () => {
    expect(
      planMealFiberG(
        { recipeTitle: "Salad", calories: 300, recipeId: "r2" },
        [{ id: "r2", title: "Salad", calories: 300, fiber: 9 }],
      ),
    ).toBe(9);
  });
});

/**
 * ENG-1150 — Plan day-total fibre must survive add-slot / move / leftover /
 * portion / swap edits. On mobile the displayed day-total fibre is computed at
 * render from the meal rows (`meals.reduce((s, m) => s + planMealFiberG(m,
 * pool), 0)`), so any edit path that mutates the day must re-resolve per-row
 * fibre via `enrichPlanMealsFiber` before the rebuilt plan is set/persisted.
 * These tests lock that contract: after an edit, the day-total fibre still adds
 * up from the (enriched) rows — it does not silently drop to 0.
 */
const dayTotalFiber = (meals: PlanMealFiberInput[], pool: typeof POOL): number =>
  Math.round(meals.reduce((s, m) => s + planMealFiberG(m, pool), 0) * 10) / 10;

describe("plan day-total fibre survives edits (ENG-1150)", () => {
  it("keeps day-total fibre after appending an empty add-back slot", () => {
    // A real meal whose fibre resolves from the pool (no stored fiberG on the
    // row — the meal_plan_meals table does not persist fibre) plus a freshly
    // added empty placeholder slot, mirroring the add-slot-back path.
    const rows: PlanMealFiberInput[] = [
      { recipeTitle: "Oats bowl", calories: 400, recipeId: "r1" },
      { recipeTitle: "", calories: 0 }, // empty placeholder
    ];
    const enriched = enrichPlanMealsFiber(rows, POOL);
    expect(dayTotalFiber(enriched, POOL)).toBe(8);
  });

  it("keeps day-total fibre for surviving rows after a delete", () => {
    const remaining: PlanMealFiberInput[] = [
      { recipeTitle: "Oats bowl", calories: 400, recipeId: "r1" },
    ];
    const enriched = enrichPlanMealsFiber(remaining, POOL);
    expect(dayTotalFiber(enriched, POOL)).toBe(8);
  });

  it("scales day-total fibre with calories when a meal is re-portioned", () => {
    // Half-portion (200 of a 400-kcal recipe) → fibre halves to 4.
    const rows: PlanMealFiberInput[] = [
      { recipeTitle: "Oats bowl", calories: 200, recipeId: "r1" },
    ];
    const enriched = enrichPlanMealsFiber(rows, POOL);
    expect(dayTotalFiber(enriched, POOL)).toBe(4);
  });

  it("is idempotent — a row that already carries fibre is preserved", () => {
    const rows: PlanMealFiberInput[] = [
      { recipeTitle: "Oats bowl", calories: 400, recipeId: "r1", fiberG: 6 },
    ];
    const once = enrichPlanMealsFiber(rows, POOL);
    const twice = enrichPlanMealsFiber(once, POOL);
    expect(dayTotalFiber(twice, POOL)).toBe(6);
  });

  it("returns the rows unchanged when the pool is empty (no crash)", () => {
    const rows: PlanMealFiberInput[] = [
      { recipeTitle: "Oats bowl", calories: 400, recipeId: "r1" },
    ];
    expect(enrichPlanMealsFiber(rows, [])).toBe(rows);
  });
});
