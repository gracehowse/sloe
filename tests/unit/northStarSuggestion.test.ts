/**
 * northStarSuggestion — pins the single-recipe scorer behind the
 * Today north-star block.
 *
 * Authority: D-2026-04-27-04 (north-star moment).
 * Source: src/lib/nutrition/northStarSuggestion.ts
 *
 * What's pinned:
 *   - `pickNorthStarSuggestion` returns null when:
 *     - library is empty
 *     - remaining calories <= 0 (over-budget — caller renders calm caption)
 *     - all candidates are excluded
 *   - Returns the closest-fit recipe at a clamped portion multiplier.
 *   - Asymmetric calorie penalty (over > under).
 *   - Slot filter excludes recipes whose mealType doesn't match.
 *   - `detectSlotForHour` time-of-day branching matches spec §A-northstar.
 *   - `ctaForSlot` returns the spec copy for each slot.
 *   - `bandLabel` returns the spec copy for each band.
 *   - `NORTH_STAR_LIBRARY_MIN === 5` and `isLibraryEligibleForNorthStar`
 *     gates correctly (V-6 default).
 */

import { describe, it, expect } from "vitest";

import {
  pickNorthStarSuggestion,
  pickNextNorthStarSuggestion,
  detectSlotForHour,
  ctaForSlot,
  bandLabel,
  NORTH_STAR_LIBRARY_MIN,
  isLibraryEligibleForNorthStar,
  type NorthStarRecipe,
} from "../../src/lib/nutrition/northStarSuggestion";

const mkRecipe = (over: Partial<NorthStarRecipe> = {}): NorthStarRecipe => ({
  id: over.id ?? "r1",
  title: over.title ?? "Test recipe",
  calories: over.calories ?? 500,
  protein: over.protein ?? 30,
  carbs: over.carbs ?? 50,
  fat: over.fat ?? 18,
  thumbnail: over.thumbnail,
  mealType: over.mealType,
});

describe("pickNorthStarSuggestion", () => {
  it("returns null on empty library", () => {
    const result = pickNorthStarSuggestion([], { calories: 800, protein: 40, carbs: 100, fat: 30 });
    expect(result).toBeNull();
  });

  it("returns null when remaining calories <= 0 (over-budget signal)", () => {
    const result = pickNorthStarSuggestion(
      [mkRecipe()],
      { calories: 0, protein: 40, carbs: 100, fat: 30 },
    );
    expect(result).toBeNull();

    const result2 = pickNorthStarSuggestion(
      [mkRecipe()],
      { calories: -50, protein: 40, carbs: 100, fat: 30 },
    );
    expect(result2).toBeNull();
  });

  it("returns null when remaining macros are not finite", () => {
    const result = pickNorthStarSuggestion(
      [mkRecipe()],
      { calories: NaN, protein: 0, carbs: 0, fat: 0 },
    );
    expect(result).toBeNull();
  });

  it("returns the closest-fit recipe with band 'tight' when within 5%", () => {
    const recipes = [
      mkRecipe({ id: "a", calories: 500, protein: 30, carbs: 50, fat: 18 }),
      mkRecipe({ id: "b", calories: 800, protein: 50, carbs: 80, fat: 30 }),
      mkRecipe({ id: "c", calories: 200, protein: 10, carbs: 25, fat: 6 }),
    ];
    const result = pickNorthStarSuggestion(recipes, {
      calories: 510,
      protein: 30,
      carbs: 55,
      fat: 18,
    });
    expect(result).not.toBeNull();
    expect(result!.recipe.id).toBe("a");
    expect(result!.band).toBe("tight");
  });

  it("scores 1× portion better than 2× when 1× already fits", () => {
    const recipes = [mkRecipe({ id: "a", calories: 500, protein: 30, carbs: 50, fat: 18 })];
    const result = pickNorthStarSuggestion(recipes, {
      calories: 500,
      protein: 30,
      carbs: 50,
      fat: 18,
    });
    expect(result!.portionMultiplier).toBe(1.0);
  });

  it("penalises over-shooting harder than under-shooting (asymmetric)", () => {
    // Two recipes: one over by 50 kcal, one under by 50 kcal. Under should win.
    const recipes = [
      mkRecipe({ id: "over", calories: 550, protein: 30, carbs: 50, fat: 18 }),
      mkRecipe({ id: "under", calories: 450, protein: 30, carbs: 50, fat: 18 }),
    ];
    const result = pickNorthStarSuggestion(recipes, {
      calories: 500,
      protein: 30,
      carbs: 50,
      fat: 18,
    });
    expect(result!.recipe.id).toBe("under");
  });

  it("excludes recipes in `excludeIds` (used by swipe-to-skip)", () => {
    const recipes = [
      mkRecipe({ id: "a", calories: 500 }),
      mkRecipe({ id: "b", calories: 600 }),
    ];
    const result = pickNorthStarSuggestion(
      recipes,
      { calories: 500, protein: 30, carbs: 50, fat: 18 },
      { excludeIds: new Set(["a"]) },
    );
    expect(result!.recipe.id).toBe("b");
  });

  it("filters by slot when slot is provided", () => {
    const recipes = [
      mkRecipe({ id: "breakfast", calories: 500, mealType: "breakfast" }),
      mkRecipe({ id: "dinner", calories: 500, mealType: "dinner" }),
    ];
    const result = pickNorthStarSuggestion(
      recipes,
      { calories: 500, protein: 30, carbs: 50, fat: 18 },
      { slot: "breakfast" },
    );
    expect(result!.recipe.id).toBe("breakfast");
  });

  it("untagged recipes are eligible for any slot", () => {
    const recipes = [mkRecipe({ id: "untagged", calories: 500, mealType: null })];
    const result = pickNorthStarSuggestion(
      recipes,
      { calories: 500, protein: 30, carbs: 50, fat: 18 },
      { slot: "lunch" },
    );
    expect(result).not.toBeNull();
    expect(result!.recipe.id).toBe("untagged");
  });

  it("treats array mealType as multi-slot eligibility", () => {
    const recipes = [
      mkRecipe({ id: "multi", calories: 500, mealType: ["lunch", "dinner"] }),
    ];
    const lunch = pickNorthStarSuggestion(
      recipes,
      { calories: 500, protein: 30, carbs: 50, fat: 18 },
      { slot: "lunch" },
    );
    expect(lunch?.recipe.id).toBe("multi");

    const breakfast = pickNorthStarSuggestion(
      recipes,
      { calories: 500, protein: 30, carbs: 50, fat: 18 },
      { slot: "breakfast" },
    );
    expect(breakfast).toBeNull();
  });

  it("rejects recipes with non-positive base calories (defensive)", () => {
    const recipes = [mkRecipe({ id: "bad", calories: 0 })];
    const result = pickNorthStarSuggestion(
      recipes,
      { calories: 500, protein: 30, carbs: 50, fat: 18 },
    );
    expect(result).toBeNull();
  });
});

describe("pickNextNorthStarSuggestion (skip flow)", () => {
  it("returns the next-best recipe after one is excluded", () => {
    const recipes = [
      mkRecipe({ id: "first", calories: 500 }),
      mkRecipe({ id: "second", calories: 480 }),
      mkRecipe({ id: "third", calories: 800 }),
    ];
    const next = pickNextNorthStarSuggestion(
      recipes,
      { calories: 500, protein: 30, carbs: 50, fat: 18 },
      new Set(["first"]),
    );
    expect(next!.recipe.id).toBe("second");
  });
});

describe("detectSlotForHour", () => {
  it("returns 'breakfast' for 06:00–10:30", () => {
    expect(detectSlotForHour(6 * 60)).toBe("breakfast");
    expect(detectSlotForHour(8 * 60 + 30)).toBe("breakfast");
    expect(detectSlotForHour(10 * 60 + 29)).toBe("breakfast");
  });

  it("returns 'lunch' for 10:30–14:30", () => {
    expect(detectSlotForHour(10 * 60 + 30)).toBe("lunch");
    expect(detectSlotForHour(12 * 60)).toBe("lunch");
    expect(detectSlotForHour(14 * 60 + 29)).toBe("lunch");
  });

  it("returns 'snack' for 14:30–17:30", () => {
    expect(detectSlotForHour(14 * 60 + 30)).toBe("snack");
    expect(detectSlotForHour(16 * 60)).toBe("snack");
    expect(detectSlotForHour(17 * 60 + 29)).toBe("snack");
  });

  it("returns 'dinner' for 17:30–22:00", () => {
    expect(detectSlotForHour(17 * 60 + 30)).toBe("dinner");
    expect(detectSlotForHour(19 * 60)).toBe("dinner");
    expect(detectSlotForHour(21 * 60 + 59)).toBe("dinner");
  });

  it("returns null outside the spec window (late night / pre-dawn)", () => {
    expect(detectSlotForHour(2 * 60)).toBeNull();
    expect(detectSlotForHour(22 * 60 + 30)).toBeNull();
    expect(detectSlotForHour(5 * 60 + 59)).toBeNull();
  });

  it("returns null on non-finite input", () => {
    expect(detectSlotForHour(NaN)).toBeNull();
    expect(detectSlotForHour(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("ctaForSlot — spec copy", () => {
  it("'Log breakfast' for breakfast", () => {
    expect(ctaForSlot("breakfast")).toBe("Log breakfast");
  });
  it("'Log lunch' for lunch", () => {
    expect(ctaForSlot("lunch")).toBe("Log lunch");
  });
  it("'Cook ahead →' for snack", () => {
    expect(ctaForSlot("snack")).toBe("Cook ahead →");
  });
  it("'Cook it →' for dinner", () => {
    expect(ctaForSlot("dinner")).toBe("Cook it →");
  });
  it("'Log it' fallback for null", () => {
    expect(ctaForSlot(null)).toBe("Log it");
  });
});

describe("bandLabel — spec copy", () => {
  it("'Hits within 3%' for tight", () => {
    expect(bandLabel("tight")).toBe("Hits within 3%");
  });
  it("'Close fit' for close", () => {
    expect(bandLabel("close")).toBe("Close fit");
  });
  it("'Roughly fits' for loose", () => {
    expect(bandLabel("loose")).toBe("Roughly fits");
  });
});

describe("library threshold (V-6 sub-decision)", () => {
  it("NORTH_STAR_LIBRARY_MIN is 5 (default per V-6)", () => {
    expect(NORTH_STAR_LIBRARY_MIN).toBe(5);
  });

  it("isLibraryEligibleForNorthStar gates at 5", () => {
    expect(isLibraryEligibleForNorthStar(0)).toBe(false);
    expect(isLibraryEligibleForNorthStar(4)).toBe(false);
    expect(isLibraryEligibleForNorthStar(5)).toBe(true);
    expect(isLibraryEligibleForNorthStar(50)).toBe(true);
    expect(isLibraryEligibleForNorthStar(NaN)).toBe(false);
  });
});
