/**
 * Polish (2026-04-25) — defensive strip of legacy seeder bookkeeping
 * prefixes from recipe descriptions before render.
 *
 * Bug pinned: "[TEMP SEED] " was leaking into the user-visible description
 * on Recipe Detail. Source has been removed from scripts/seed-discover-recipes.ts
 * but rows already in prod still carry the prefix; this helper is the safety
 * net at the render boundary.
 */
import { describe, it, expect } from "vitest";
import { sanitizeRecipeDescription } from "../../src/lib/recipes/sanitizeRecipeDescription";

describe("sanitizeRecipeDescription", () => {
  it("strips the legacy [TEMP SEED] prefix with trailing space", () => {
    expect(sanitizeRecipeDescription("[TEMP SEED] A delicious lentil soup.")).toBe(
      "A delicious lentil soup.",
    );
  });

  it("strips the prefix variant without trailing space", () => {
    expect(sanitizeRecipeDescription("[TEMP SEED]Best lentil soup ever.")).toBe(
      "Best lentil soup ever.",
    );
  });

  it("leaves descriptions without the prefix untouched", () => {
    expect(sanitizeRecipeDescription("My grandma's secret recipe.")).toBe(
      "My grandma's secret recipe.",
    );
  });

  it("returns empty string for null / undefined / empty input", () => {
    expect(sanitizeRecipeDescription(null)).toBe("");
    expect(sanitizeRecipeDescription(undefined)).toBe("");
    expect(sanitizeRecipeDescription("")).toBe("");
  });

  it("returns empty string when prefix-only input strips to nothing", () => {
    expect(sanitizeRecipeDescription("[TEMP SEED] ")).toBe("");
  });
});
