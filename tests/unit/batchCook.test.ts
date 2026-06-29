import { describe, expect, it } from "vitest";

import {
  batchPerPortionCalories,
  batchShoppingMultiplier,
  clampBatchPortions,
  isBatchCookCandidate,
  recipeTotalTimeMin,
} from "../../src/lib/planning/batchCook";

describe("batchCook (ENG-1255)", () => {
  it("flags recipes with total time ≥ 25 min as batchable", () => {
    expect(isBatchCookCandidate({ prep_time_min: 10, cook_time_min: 14 })).toBe(false);
    expect(isBatchCookCandidate({ prep_time_min: 10, cook_time_min: 15 })).toBe(true);
  });

  it("computes per-portion calories from recipe yield", () => {
    expect(batchPerPortionCalories(1200, 4)).toBe(300);
  });

  it("scales shopping multiplier by batch portions ÷ recipe servings", () => {
    expect(batchShoppingMultiplier(4, 2)).toBe(2);
    expect(batchShoppingMultiplier(6, 3)).toBe(2);
  });

  it("clamps batch portions to minimum 2", () => {
    expect(clampBatchPortions(1)).toBe(2);
    expect(clampBatchPortions(4.7)).toBe(4);
  });

  it("sums prep + cook for total time", () => {
    expect(recipeTotalTimeMin(20, 15)).toBe(35);
  });
});
