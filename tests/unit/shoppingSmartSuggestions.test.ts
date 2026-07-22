import { describe, expect, it } from "vitest";
import {
  formatOverlapSummary,
  rankIngredientOverlapSuggestions,
  type OverlapCandidateRecipe,
  type RemainingMacroBudget,
} from "@/lib/planning/shoppingSmartSuggestions";

function recipe(partial: Partial<OverlapCandidateRecipe> & { id: string; title: string }): OverlapCandidateRecipe {
  return {
    ingredients: [],
    ...partial,
  };
}

const CURRENT_LIST = [
  "Garlic Clove",
  "Fish Sauce",
  "Jasmine Rice",
  "Lime",
  "Chicken Breast",
];

describe("rankIngredientOverlapSuggestions — overlap ranking (primary signal)", () => {
  it("returns nothing when the current ingredient set is empty", () => {
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: [],
      candidates: [
        recipe({ id: "a", title: "Thai Basil Chicken", ingredients: [{ name: "Garlic Clove" }, { name: "Fish Sauce" }] }),
      ],
    });
    expect(out).toEqual([]);
  });

  it("excludes candidates below the minimum overlap threshold (default 2)", () => {
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [
        recipe({
          id: "one-shared",
          title: "Only Lime",
          ingredients: [{ name: "Lime" }, { name: "Coconut Milk" }, { name: "Basil" }],
        }),
        recipe({
          id: "two-shared",
          title: "Two Shared",
          ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }, { name: "Basil" }],
        }),
      ],
    });
    expect(out.map((s) => s.recipeId)).toEqual(["two-shared"]);
  });

  it("honours an explicit minOverlap override", () => {
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [
        recipe({
          id: "one-shared",
          title: "Only Lime",
          ingredients: [{ name: "Lime" }, { name: "Coconut Milk" }],
        }),
      ],
      minOverlap: 1,
    });
    expect(out.map((s) => s.recipeId)).toEqual(["one-shared"]);
  });

  it("ranks higher overlap count above lower overlap count", () => {
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [
        recipe({
          id: "low",
          title: "Two Shared",
          ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }, { name: "Basil" }, { name: "Sugar" }],
        }),
        recipe({
          id: "high",
          title: "Three Shared",
          ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }, { name: "Fish Sauce" }, { name: "Sugar" }],
        }),
      ],
    });
    expect(out.map((s) => s.recipeId)).toEqual(["high", "low"]);
    expect(out[0]!.overlapCount).toBe(3);
    expect(out[1]!.overlapCount).toBe(2);
  });

  it("reports the shared ingredient display names, deduped within a recipe", () => {
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [
        recipe({
          id: "dup",
          title: "Duplicate Garlic",
          ingredients: [
            { name: "Garlic Clove" },
            { name: "garlic clove" }, // same normalised identity — counts once
            { name: "Fish Sauce" },
            { name: "Sugar" },
          ],
        }),
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.overlapCount).toBe(2);
    expect(out[0]!.totalIngredientCount).toBe(3); // garlic clove, fish sauce, sugar
    expect(out[0]!.overlapIngredientNames.sort()).toEqual(["Fish Sauce", "Garlic Clove"]);
  });

  it("matches ingredient identity through normalisation (case + parenthetical), same as the shopping-list dedup rule", () => {
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: ["Garlic Clove", "Fish Sauce", "Jasmine Rice"],
      candidates: [
        recipe({
          id: "normalised",
          title: "Weeknight Curry",
          ingredients: [
            { name: "garlic clove (minced)" },
            { name: "FISH SAUCE" },
            { name: "coconut milk" },
          ],
        }),
      ],
    });
    expect(out[0]!.overlapCount).toBe(2);
  });

  it("excludes recipe ids in excludeRecipeIds even when overlap qualifies", () => {
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [
        recipe({
          id: "already-planned",
          title: "Already Planned",
          ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }, { name: "Fish Sauce" }],
        }),
      ],
      excludeRecipeIds: new Set(["already-planned"]),
    });
    expect(out).toEqual([]);
  });

  it("respects the limit", () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      recipe({
        id: `r${i}`,
        title: `Recipe ${i}`,
        ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }],
      }),
    );
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates,
      limit: 3,
    });
    expect(out).toHaveLength(3);
  });

  it("breaks a tie in overlap count deterministically by title when there is no macro budget", () => {
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [
        recipe({ id: "z", title: "Zebra Bowl", ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }] }),
        recipe({ id: "a", title: "Apple Bowl", ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }] }),
      ],
    });
    expect(out.map((s) => s.title)).toEqual(["Apple Bowl", "Zebra Bowl"]);
  });
});

describe("rankIngredientOverlapSuggestions — remaining-macro fit (secondary signal)", () => {
  const budget: RemainingMacroBudget = { calories: 600, protein: 40, carbs: 60, fat: 20 };

  it("omits macroFit entirely when no remainingBudget is supplied", () => {
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [
        recipe({
          id: "a",
          title: "A",
          ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }],
          caloriesPerServing: 500,
        }),
      ],
    });
    expect(out[0]!.macroFit).toBeNull();
  });

  it("returns null macroFit when the recipe has no usable macro data at all", () => {
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [
        recipe({
          id: "no-macros",
          title: "No Macros",
          ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }],
        }),
      ],
      remainingBudget: budget,
    });
    expect(out[0]!.macroFit).toBeNull();
  });

  it("scores a recipe that closely fills remaining calories higher than one that barely uses any", () => {
    const closeFit = recipe({
      id: "close",
      title: "Close Fit",
      ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }],
      caloriesPerServing: 580,
      proteinPerServing: 38,
      carbsPerServing: 55,
      fatPerServing: 18,
    });
    const barelyTouches = recipe({
      id: "barely",
      title: "Barely Touches",
      ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }],
      caloriesPerServing: 60,
      proteinPerServing: 4,
      carbsPerServing: 5,
      fatPerServing: 2,
    });
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [barelyTouches, closeFit],
      remainingBudget: budget,
    });
    // Same overlap count for both — macro fit breaks the tie.
    expect(out.map((s) => s.recipeId)).toEqual(["close", "barely"]);
    expect(out[0]!.macroFit!.score).toBeGreaterThan(out[1]!.macroFit!.score);
  });

  it("penalizes a recipe that overshoots remaining calories", () => {
    const overshoots = recipe({
      id: "overshoots",
      title: "Overshoots",
      ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }],
      caloriesPerServing: 1200, // 2x the remaining budget — only macro reported.
    });
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [overshoots],
      remainingBudget: budget,
    });
    // Ratio 2.0 → 1 - (2 - 1) = 0 for the (only reported) calories component.
    expect(out[0]!.macroFit!.score).toBeCloseTo(0, 5);
  });

  it("floors the overshoot penalty at 0 rather than going negative for a severe overshoot", () => {
    const severelyOvershoots = recipe({
      id: "severe",
      title: "Severe Overshoot",
      ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }],
      caloriesPerServing: 3000, // 5x the remaining budget
    });
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [severelyOvershoots],
      remainingBudget: budget,
    });
    expect(out[0]!.macroFit!.score).toBe(0);
  });

  it("treats an already-exceeded macro (remaining <= 0) as fully used, and 0 more of it as a perfect fit", () => {
    const overBudget: RemainingMacroBudget = { calories: 0, protein: 0, carbs: 30, fat: 10 };
    const zeroCalorieUse = recipe({
      id: "zero-cal",
      title: "Zero More",
      ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }],
      caloriesPerServing: 0,
      proteinPerServing: 0,
      carbsPerServing: 10,
      fatPerServing: 2,
    });
    const addsMoreCalories = recipe({
      id: "adds-cal",
      title: "Adds More",
      ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }],
      caloriesPerServing: 400,
      proteinPerServing: 20,
      carbsPerServing: 10,
      fatPerServing: 2,
    });
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [addsMoreCalories, zeroCalorieUse],
      remainingBudget: overBudget,
    });
    expect(out.map((s) => s.recipeId)).toEqual(["zero-cal", "adds-cal"]);
  });

  it("produces the three macro-fit label bands", () => {
    const highFit = recipe({
      id: "high",
      title: "High",
      ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }],
      caloriesPerServing: 590,
      proteinPerServing: 39,
      carbsPerServing: 58,
      fatPerServing: 19,
    });
    const midFit = recipe({
      id: "mid",
      title: "Mid",
      ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }],
      caloriesPerServing: 300,
      proteinPerServing: 20,
      carbsPerServing: 30,
      fatPerServing: 10,
    });
    const lowFit = recipe({
      id: "low",
      title: "Low",
      ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }],
      caloriesPerServing: 1800,
      proteinPerServing: 120,
      carbsPerServing: 180,
      fatPerServing: 60,
    });
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [highFit, midFit, lowFit],
      remainingBudget: budget,
      limit: 10,
    });
    const byId = new Map(out.map((s) => [s.recipeId, s]));
    expect(byId.get("high")!.macroFit!.label).toBe("Fits well with what's left today");
    expect(byId.get("mid")!.macroFit!.label).toBe("Uses some of today's remaining budget");
    expect(byId.get("low")!.macroFit!.label).toBe("Uses more than what's left today");
  });

  it("scores using only the macros a partially-verified recipe reports (renormalised weights)", () => {
    const caloriesOnly = recipe({
      id: "calories-only",
      title: "Calories Only",
      ingredients: [{ name: "Lime" }, { name: "Garlic Clove" }],
      caloriesPerServing: 600, // exact fit on the one macro it reports
    });
    const out = rankIngredientOverlapSuggestions({
      currentIngredientNames: CURRENT_LIST,
      candidates: [caloriesOnly],
      remainingBudget: budget,
    });
    expect(out[0]!.macroFit!.score).toBeCloseTo(1, 5);
  });
});

describe("formatOverlapSummary", () => {
  it("returns an empty string for no names", () => {
    expect(formatOverlapSummary([])).toBe("");
  });

  it("joins names with no ellipsis when at or under the max", () => {
    expect(formatOverlapSummary(["Garlic Clove", "Fish Sauce"])).toBe("Garlic Clove, Fish Sauce");
  });

  it("truncates with a trailing ellipsis past the max (ENG-1634 example copy)", () => {
    expect(formatOverlapSummary(["Garlic Clove", "Fish Sauce", "Jasmine Rice", "Lime"])).toBe(
      "Garlic Clove, Fish Sauce, Jasmine Rice…",
    );
  });

  it("respects a custom max", () => {
    expect(formatOverlapSummary(["A", "B", "C"], 1)).toBe("A…");
  });
});
