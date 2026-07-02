/**
 * mealCoach — the "what to eat next" coach engine.
 *
 * Pins the deterministic spine the LLM ranks OVER:
 *   - candidate assembly: fit-window filtering, slot logic, variety penalty
 *   - prompt building: stable system prefix + grounded variable tail
 *   - schema validation: invented ids dropped, banned phrases rejected,
 *     duplicates collapsed, unparseable → null
 *   - applyCoachRanking: numbers stay ours, no candidate ever lost,
 *     null ranking → deterministic order (surface never empties)
 */

import { describe, expect, it } from "vitest";
import {
  applyCoachRanking,
  assembleCandidates,
  buildCoachUserMessage,
  COACH_CANDIDATE_LIMIT,
  COACH_EMPTY_NO_RECIPES_COPY,
  COACH_EMPTY_OVER_BUDGET_COPY,
  COACH_RECENCY_PENALTY,
  COACH_SYSTEM_PROMPT,
  coachEmptyStateCopy,
  isLibraryEligibleForCoach,
  parseCoachRanking,
  type CoachCandidate,
} from "@/lib/nutrition/mealCoach";
import type {
  NorthStarRecipe,
  NorthStarRemaining,
} from "@/lib/nutrition/northStarSuggestion";

function recipe(over: Partial<NorthStarRecipe> & { id: string }): NorthStarRecipe {
  return {
    title: `Recipe ${over.id}`,
    calories: 500,
    protein: 30,
    carbs: 40,
    fat: 15,
    ...over,
  };
}

const remaining: NorthStarRemaining = {
  calories: 1200,
  protein: 60,
  carbs: 120,
  fat: 40,
  dailyCalorieTarget: 2000,
};

describe("assembleCandidates — fit window + ranking", () => {
  it("returns ranked candidates from the library, best (lowest score) first", () => {
    const library = [
      recipe({ id: "a", calories: 700 }),
      recipe({ id: "b", calories: 500 }),
      recipe({ id: "c", calories: 520 }),
    ];
    const out = assembleCandidates(library, remaining, { slot: "dinner" });
    expect(out.length).toBeGreaterThanOrEqual(2);
    // Ascending score — first is the best fit.
    for (let i = 1; i < out.length; i++) {
      expect(out[i].score).toBeGreaterThanOrEqual(out[i - 1].score);
    }
    // Numbers are ours — one serving, matches the recipe.
    const b = out.find((c) => c.recipeId === "b");
    expect(b?.predictedCalories).toBe(500);
  });

  it("returns [] when remaining calories are non-positive (at/over budget)", () => {
    const library = [recipe({ id: "a" })];
    expect(
      assembleCandidates(library, { ...remaining, calories: 0 }),
    ).toEqual([]);
    expect(
      assembleCandidates(library, { ...remaining, calories: -100 }),
    ).toEqual([]);
  });

  it("returns [] for an empty library", () => {
    expect(assembleCandidates([], remaining)).toEqual([]);
  });

  it("hard-excludes skipped ids", () => {
    const library = [
      recipe({ id: "a", calories: 500 }),
      recipe({ id: "b", calories: 510 }),
    ];
    const out = assembleCandidates(library, remaining, {
      excludeIds: new Set(["a"]),
    });
    expect(out.map((c) => c.recipeId)).not.toContain("a");
    expect(out.map((c) => c.recipeId)).toContain("b");
  });

  it("filters by slot — recipes tagged for other slots are excluded; untagged are eligible", () => {
    const library = [
      recipe({ id: "breakfasty", mealType: "breakfast", calories: 500 }),
      recipe({ id: "dinnery", mealType: "dinner", calories: 500 }),
      recipe({ id: "untagged", mealType: null, calories: 500 }),
    ];
    const out = assembleCandidates(library, remaining, { slot: "dinner" });
    const ids = out.map((c) => c.recipeId);
    expect(ids).toContain("dinnery");
    expect(ids).toContain("untagged");
    expect(ids).not.toContain("breakfasty");
  });

  it("applies a variety penalty to recently-suggested recipes so a fresh equal-fit recipe wins", () => {
    // Two identical recipes; only the recency set differs. The fresh one
    // must out-rank the recently-suggested one.
    const library = [
      recipe({ id: "fresh", calories: 500 }),
      recipe({ id: "recent", calories: 500 }),
    ];
    const out = assembleCandidates(library, remaining, {
      slot: "dinner",
      recentlySuggestedIds: new Set(["recent"]),
    });
    expect(out[0].recipeId).toBe("fresh");
    const recent = out.find((c) => c.recipeId === "recent")!;
    const fresh = out.find((c) => c.recipeId === "fresh")!;
    expect(recent.score - fresh.score).toBeCloseTo(COACH_RECENCY_PENALTY, 5);
  });

  it("respects the candidate limit (default and override)", () => {
    const library = Array.from({ length: 10 }, (_, i) =>
      recipe({ id: `r${i}`, calories: 480 + i * 5 }),
    );
    expect(assembleCandidates(library, remaining).length).toBe(
      COACH_CANDIDATE_LIMIT,
    );
    expect(assembleCandidates(library, remaining, { limit: 2 }).length).toBe(2);
  });

  it("each candidate carries a non-empty deterministic why line", () => {
    const library = [recipe({ id: "a", calories: 500 })];
    const out = assembleCandidates(library, remaining);
    expect(out[0].whyLine.length).toBeGreaterThan(0);
  });
});

describe("isLibraryEligibleForCoach", () => {
  it("requires the north-star library minimum", () => {
    expect(isLibraryEligibleForCoach(4)).toBe(false);
    expect(isLibraryEligibleForCoach(5)).toBe(true);
    expect(isLibraryEligibleForCoach(NaN)).toBe(false);
  });
});

describe("buildCoachUserMessage", () => {
  it("emits the candidates + remaining as parseable JSON with OUR numbers", () => {
    const candidates: CoachCandidate[] = [
      {
        recipeId: "a",
        title: "Chicken bowl",
        predictedCalories: 612,
        predictedProtein: 45,
        predictedCarbs: 50,
        predictedFat: 18,
        band: "tight",
        bandLabel: "Hits within 3%",
        whyLine: "Fits your remaining 1,200 kcal",
        score: 10,
      },
    ];
    const msg = buildCoachUserMessage(candidates, remaining, "dinner");
    const json = JSON.parse(msg.slice(msg.indexOf("{")));
    expect(json.slot).toBe("dinner");
    expect(json.remaining.calories).toBe(1200);
    expect(json.candidates[0].id).toBe("a");
    expect(json.candidates[0].calories).toBe(612);
  });

  it("system prompt is stable + carries the grounding + no-invention contract", () => {
    expect(COACH_SYSTEM_PROMPT).toContain("NEVER invent a recipe");
    expect(COACH_SYSTEM_PROMPT).toContain("NEVER state a calorie or macro number");
    expect(COACH_SYSTEM_PROMPT).toContain("NEVER make a health, medical");
  });
});

describe("parseCoachRanking — schema validation", () => {
  const candidateIds = ["a", "b", "c"];

  it("keeps only known ids, in model order, best first", () => {
    const out = parseCoachRanking(
      JSON.stringify({ rankedIds: ["b", "a"], reasons: { b: "Tops up protein", a: "Light option" } }),
      candidateIds,
    );
    expect(out?.rankedIds).toEqual(["b", "a"]);
    expect(out?.reasons.b).toBe("Tops up protein");
  });

  it("drops ids the model invented", () => {
    const out = parseCoachRanking(
      JSON.stringify({ rankedIds: ["a", "ghost", "b"], reasons: {} }),
      candidateIds,
    );
    expect(out?.rankedIds).toEqual(["a", "b"]);
  });

  it("collapses duplicate ids (first wins)", () => {
    const out = parseCoachRanking(
      JSON.stringify({ rankedIds: ["a", "a", "b"], reasons: {} }),
      candidateIds,
    );
    expect(out?.rankedIds).toEqual(["a", "b"]);
  });

  it("rejects reasons that make health / diet-culture claims", () => {
    const out = parseCoachRanking(
      JSON.stringify({
        rankedIds: ["a", "b"],
        reasons: { a: "Helps you lose weight fast", b: "Tops up protein" },
      }),
      candidateIds,
    );
    // Banned reason dropped — candidate keeps its deterministic line later.
    expect(out?.reasons.a).toBeUndefined();
    expect(out?.reasons.b).toBe("Tops up protein");
  });

  it("rejects over-long reasons", () => {
    const longReason = "x".repeat(200);
    const out = parseCoachRanking(
      JSON.stringify({ rankedIds: ["a"], reasons: { a: longReason } }),
      candidateIds,
    );
    expect(out?.reasons.a).toBeUndefined();
  });

  it("returns null on unparseable output", () => {
    expect(parseCoachRanking("not json", candidateIds)).toBeNull();
  });

  it("returns null when no known id survives", () => {
    expect(
      parseCoachRanking(JSON.stringify({ rankedIds: ["ghost"] }), candidateIds),
    ).toBeNull();
  });

  it("strips markdown fences before parsing", () => {
    const out = parseCoachRanking(
      "```json\n" + JSON.stringify({ rankedIds: ["a"] }) + "\n```",
      candidateIds,
    );
    expect(out?.rankedIds).toEqual(["a"]);
  });
});

describe("applyCoachRanking — merge guarantees", () => {
  const candidates: CoachCandidate[] = [
    {
      recipeId: "a",
      title: "A",
      predictedCalories: 500,
      predictedProtein: 30,
      predictedCarbs: 40,
      predictedFat: 15,
      band: "tight",
      bandLabel: "Hits within 3%",
      whyLine: "deterministic A",
      score: 10,
    },
    {
      recipeId: "b",
      title: "B",
      predictedCalories: 520,
      predictedProtein: 28,
      predictedCarbs: 42,
      predictedFat: 16,
      band: "close",
      bandLabel: "Close fit",
      whyLine: "deterministic B",
      score: 20,
    },
  ];

  it("null ranking returns the deterministic order unchanged (surface never empties)", () => {
    const out = applyCoachRanking(candidates, null);
    expect(out.map((c) => c.recipeId)).toEqual(["a", "b"]);
    expect(out[0].whyLine).toBe("deterministic A");
  });

  it("re-orders to the model order + overrides the why line with the model reason", () => {
    const out = applyCoachRanking(candidates, {
      rankedIds: ["b", "a"],
      reasons: { b: "model B reason" },
    });
    expect(out.map((c) => c.recipeId)).toEqual(["b", "a"]);
    expect(out[0].whyLine).toBe("model B reason");
    // 'a' had no model reason → keeps the deterministic line.
    expect(out[1].whyLine).toBe("deterministic A");
  });

  it("never loses a candidate the model omitted — appends it in deterministic order", () => {
    const out = applyCoachRanking(candidates, {
      rankedIds: ["b"],
      reasons: {},
    });
    expect(out.map((c) => c.recipeId)).toEqual(["b", "a"]);
  });

  it("never changes OUR numbers, even when the model re-ranks", () => {
    const out = applyCoachRanking(candidates, {
      rankedIds: ["a"],
      reasons: { a: "model reason" },
    });
    expect(out[0].predictedCalories).toBe(500);
    expect(out[0].predictedProtein).toBe(30);
  });
});

describe("coachEmptyStateCopy — over-budget vs no-recipes empty states (ENG-1294)", () => {
  it("shows the over-budget/day-done copy when the library has recipes but remaining ≤ 0", () => {
    expect(
      coachEmptyStateCopy({ librarySize: 8, remainingCalories: 0 }),
    ).toBe(COACH_EMPTY_OVER_BUDGET_COPY);
    expect(
      coachEmptyStateCopy({ librarySize: 8, remainingCalories: -240 }),
    ).toBe(COACH_EMPTY_OVER_BUDGET_COPY);
  });

  it("keeps the saved-recipes copy for the genuinely-no-recipes case", () => {
    expect(
      coachEmptyStateCopy({ librarySize: 0, remainingCalories: 1200 }),
    ).toBe(COACH_EMPTY_NO_RECIPES_COPY);
  });

  it("prefers the saved-recipes copy when the library is empty even over budget (engine gate order)", () => {
    // assembleCandidates short-circuits on the empty library BEFORE the
    // budget gate — and "save recipes" is the only actionable next step for
    // this user, over budget or not.
    expect(
      coachEmptyStateCopy({ librarySize: 0, remainingCalories: -100 }),
    ).toBe(COACH_EMPTY_NO_RECIPES_COPY);
  });

  it("keeps the saved-recipes copy when remaining is positive but nothing fits", () => {
    expect(
      coachEmptyStateCopy({ librarySize: 3, remainingCalories: 850 }),
    ).toBe(COACH_EMPTY_NO_RECIPES_COPY);
  });

  it("never tells a fully-logged user to log a meal", () => {
    expect(
      coachEmptyStateCopy({ librarySize: 12, remainingCalories: -1 }),
    ).not.toMatch(/log a meal/i);
  });

  it("treats non-finite remaining as not-over-budget (defensive)", () => {
    expect(
      coachEmptyStateCopy({ librarySize: 5, remainingCalories: Number.NaN }),
    ).toBe(COACH_EMPTY_NO_RECIPES_COPY);
  });
});
