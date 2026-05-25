import { describe, expect, it } from "vitest";
import { normalizeLlmPayload } from "../../src/lib/planning/planImport/normalizeLlmPayload";
import {
  compilePlanImportSlots,
  inferRecipeKeysForLabel,
  planImportStats,
} from "../../src/lib/planning/planImport/compilePlanImport";
import { MEAL_PREP_WEEK1_PARSED } from "../../src/lib/planning/planImport/fixtures/mealPrepWeek1";
import type { PlanImportVerifiedRecipe } from "../../src/lib/planning/planImport/types";

function mockVerified(
  recipes: typeof MEAL_PREP_WEEK1_PARSED.recipes,
): PlanImportVerifiedRecipe[] {
  return recipes.map((r) => ({
    ...r,
    supprNutrition: {
      calories: 400,
      protein: r.authorNutrition?.protein ?? 20,
      carbs: 30,
      fat: 12,
      fiberG: r.authorNutrition?.fiberG ?? 2,
    },
    confidence: "high" as const,
    confidenceTier: "high" as const,
    ingredientCount: r.ingredients.length,
  }));
}

describe("planImport compile", () => {
  it("normalizes LLM payload", () => {
    const n = normalizeLlmPayload(MEAL_PREP_WEEK1_PARSED);
    expect(n.recipes).toHaveLength(4);
    expect(n.schedule).toHaveLength(2);
    expect(n.planName).toBe("Meal prep — Week 1");
  });

  it("links multi-recipe bowl slots", () => {
    const verified = mockVerified(MEAL_PREP_WEEK1_PARSED.recipes);
    const normalized = normalizeLlmPayload(MEAL_PREP_WEEK1_PARSED);
    const slots = compilePlanImportSlots({ schedule: normalized.schedule, recipes: verified });
    const monLunch = slots.find((s) => s.dayLabel === "Mon" && s.slot === "Lunch");
    expect(monLunch?.linkStatus).toBe("linked");
    expect(monLunch?.recipeKeys).toHaveLength(3);
    expect(monLunch?.supprNutrition.calories).toBe(1200);
  });

  it("infers recipe keys from label when omitted", () => {
    const recipes = mockVerified(MEAL_PREP_WEEK1_PARSED.recipes);
    const keys = inferRecipeKeysForLabel("Matcha pudding", recipes);
    expect(keys).toContain("matcha-pudding");
  });

  it("computes stats", () => {
    const verified = mockVerified(MEAL_PREP_WEEK1_PARSED.recipes);
    const normalized = normalizeLlmPayload(MEAL_PREP_WEEK1_PARSED);
    const slots = compilePlanImportSlots({ schedule: normalized.schedule, recipes: verified });
    const stats = planImportStats(slots);
    expect(stats.slotCount).toBe(3);
    expect(stats.blockedCount).toBe(0);
    expect(stats.avgKcalPerDay).toBeGreaterThan(0);
  });
});
