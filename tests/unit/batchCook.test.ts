import { describe, expect, it } from "vitest";

import {
  batchPerPortionCalories,
  batchShoppingMultiplier,
  clampBatchPortions,
  isBatchCookCandidate,
  recipeTotalTimeMin,
} from "../../src/lib/planning/batchCook";

describe("batchCook (ENG-1255 / ENG-1327)", () => {
  it("flags recipes that make 2+ servings as batchable — cook time is not a gate", () => {
    expect(isBatchCookCandidate({ servings: 2 })).toBe(true);
    expect(isBatchCookCandidate({ servings: 6 })).toBe(true);
    expect(isBatchCookCandidate({ servings: 1 })).toBe(false);
    expect(isBatchCookCandidate({ servings: 0 })).toBe(false);
    expect(isBatchCookCandidate({ servings: null })).toBe(false);
    expect(isBatchCookCandidate({})).toBe(false);
  });

  it("creator batch-friendly signal short-circuits the servings gate (ENG-1327)", () => {
    expect(isBatchCookCandidate({ servings: 1, batchFriendly: true })).toBe(true);
    expect(isBatchCookCandidate({ servings: null, batchFriendly: true })).toBe(true);
    expect(isBatchCookCandidate({ servings: 1, batchFriendly: false })).toBe(false);
    expect(isBatchCookCandidate({ servings: 1, batchFriendly: null })).toBe(false);
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
