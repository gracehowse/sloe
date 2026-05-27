/**
 * Golden cases for the nutrition verify pipeline (parse → grams → macros).
 * Used by integration tests with external APIs disabled so results use
 * estimation fallback and stay deterministic.
 *
 * @see tests/integration/verify-ingredients-golden.test.ts
 */

import { expect } from "vitest";
import type { VerifyResult } from "@/lib/nutrition/verifyIngredients";

export type GoldenEstimationCase = {
  id: string;
  note: string;
  ingredients: { name: string; amount: string; unit: string }[];
  servings: number;
};

/** Fixtures run under mocks: no USDA/FatSecret/OFF hits → all lines use Estimated or Unverified. */
export const GOLDEN_ESTIMATION_CASES: GoldenEstimationCase[] = [
  {
    id: "staples-oil-and-chicken",
    note: "Volume + mass; totals and perServing must stay consistent with verifyIngredients rounding",
    ingredients: [
      { name: "olive oil", amount: "2", unit: "tbsp" },
      { name: "chicken breast", amount: "200", unit: "g" },
    ],
    servings: 2,
  },
  {
    id: "count-medium-onions",
    note: "Count-to-weight path (medium ×3)",
    ingredients: [{ name: "onion", amount: "3", unit: "medium" }],
    servings: 1,
  },
  {
    id: "range-sprigs",
    note: "Amount string '2-3' averaged inside measureToGrams for sprigs",
    ingredients: [{ name: "thyme", amount: "2-3", unit: "sprig" }],
    servings: 1,
  },
  {
    id: "empty-name-unverified",
    note: "Blank name must not invent macros",
    ingredients: [{ name: "   ", amount: "1", unit: "cup" }],
    servings: 1,
  },
];

/** Assert stable response shape from POST /api/nutrition/verify-recipe */
export function assertVerifyResultShape(r: VerifyResult): void {
  expect(Array.isArray(r.verified)).toBe(true);
  expect(r.verified.length).toBeGreaterThan(0);
  expect(r.totals).toMatchObject({
    calories: expect.any(Number),
    protein: expect.any(Number),
    carbs: expect.any(Number),
    fat: expect.any(Number),
    fiberG: expect.any(Number),
    sugarG: expect.any(Number),
    sodiumMg: expect.any(Number),
  });
  expect(r.perServing).toMatchObject({
    calories: expect.any(Number),
    protein: expect.any(Number),
    carbs: expect.any(Number),
    fat: expect.any(Number),
    fiberG: expect.any(Number),
    sugarG: expect.any(Number),
    sodiumMg: expect.any(Number),
  });
  expect(typeof r.primarySource).toBe("string");
  expect(r.sourceCounts).toEqual(expect.any(Object));
  expect(typeof r.minIngredientConfidence).toBe("number");
  expect(typeof r.avgIngredientConfidence).toBe("number");
  expect(typeof r.belowAcceptFloorCount).toBe("number");
}

export function expectPerServingMatchesTotals(r: VerifyResult, servings: number): void {
  const s = Math.max(1, Math.round(servings));
  expect(r.perServing.calories).toBe(Math.max(0, Math.round(r.totals.calories / s)));
  expect(r.perServing.protein).toBe(Math.max(0, Math.round((r.totals.protein / s) * 10) / 10));
  expect(r.perServing.carbs).toBe(Math.max(0, Math.round((r.totals.carbs / s) * 10) / 10));
  expect(r.perServing.fat).toBe(Math.max(0, Math.round((r.totals.fat / s) * 10) / 10));
}

/**
 * Sum of macros from ONLY the rows that contribute to totals (i.e. those at or
 * above the accept floor). ENG-691: `belowAcceptFloor` rows keep their estimate
 * on the row but are excluded from `totals`.
 */
export function expectTotalsExcludeBelowFloorRows(r: VerifyResult): void {
  const inFloorCals = r.verified
    .filter((v) => v.macros != null && !v.belowAcceptFloor)
    .reduce((a, v) => a + (v.macros?.calories ?? 0), 0);
  expect(r.totals.calories).toBe(inFloorCals);
  const flagged = r.verified.filter((v) => v.belowAcceptFloor).length;
  expect(r.belowAcceptFloorCount).toBe(flagged);
}
