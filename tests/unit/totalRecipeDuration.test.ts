/**
 * ENG-1617 — the shared "total recipe duration" selector.
 *
 * Before this fix, cuisine-cluster cards / the Today "What to eat next"
 * hero showed COOK time alone while Quick Weeknight / Recipe Detail summed
 * prep + cook — the same recipe showed two different totals depending on
 * which surface you viewed it from. `totalRecipeDurationMin` /
 * `formatTotalRecipeDuration` are now the one place every surface computes
 * a recipe's displayed duration.
 */
import { describe, expect, it } from "vitest";
import {
  totalRecipeDurationMin,
  formatTotalRecipeDuration,
} from "../../src/lib/recipes/totalDuration";

describe("totalRecipeDurationMin", () => {
  it("sums prep + cook when both are present", () => {
    expect(totalRecipeDurationMin(15, 30)).toBe(45);
  });

  it("falls back to prep alone when cook is absent", () => {
    expect(totalRecipeDurationMin(20, null)).toBe(20);
    expect(totalRecipeDurationMin(20, undefined)).toBe(20);
  });

  it("falls back to cook alone when prep is absent", () => {
    expect(totalRecipeDurationMin(null, 25)).toBe(25);
    expect(totalRecipeDurationMin(undefined, 25)).toBe(25);
  });

  it("returns null — never 0, never a fabricated number — when neither is set", () => {
    expect(totalRecipeDurationMin(null, null)).toBeNull();
    expect(totalRecipeDurationMin(undefined, undefined)).toBeNull();
    expect(totalRecipeDurationMin(null, undefined)).toBeNull();
  });

  it("treats a non-positive value (0, negative, NaN) as absent, matching the codebase's existing prep/cook-time convention", () => {
    // materialiseSeedRecipe.ts / seedRecipesToCard.ts both normalise 0 → null
    // at write time (no real recipe takes literally 0 minutes); a 0 that
    // reaches here is missing data, not a real measurement.
    expect(totalRecipeDurationMin(0, 0)).toBeNull();
    expect(totalRecipeDurationMin(0, 30)).toBe(30);
    expect(totalRecipeDurationMin(15, 0)).toBe(15);
    expect(totalRecipeDurationMin(-5, 30)).toBe(30);
    expect(totalRecipeDurationMin(Number.NaN, 30)).toBe(30);
  });
});

describe("formatTotalRecipeDuration", () => {
  it("formats the combined total using the existing recipe-minutes formatter", () => {
    expect(formatTotalRecipeDuration(15, 30)).toBe("45 min");
  });

  it("formats hours + minutes past the 60-minute mark", () => {
    expect(formatTotalRecipeDuration(45, 45)).toBe("1h 30m");
  });

  it("falls back to whichever single value is present", () => {
    expect(formatTotalRecipeDuration(20, null)).toBe("20 min");
    expect(formatTotalRecipeDuration(null, 25)).toBe("25 min");
  });

  it("returns undefined — never '0 min' — when neither prep nor cook is set", () => {
    expect(formatTotalRecipeDuration(null, null)).toBeUndefined();
    expect(formatTotalRecipeDuration(undefined, undefined)).toBeUndefined();
  });
});
