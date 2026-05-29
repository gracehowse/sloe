import { describe, expect, it } from "vitest";

import { compilePlanImportSlots } from "@/lib/planning/planImport/compilePlanImport";
import { buildPlanTemplateDraftFromImport } from "@/lib/planning/planImport/buildPlanTemplateDraft";
import { MEAL_PREP_WEEK1_PARSED } from "@/lib/planning/planImport/fixtures/mealPrepWeek1";
import { normalizeLlmPayload } from "@/lib/planning/planImport/normalizeLlmPayload";
import type { PlanImportVerifiedRecipe } from "@/lib/planning/planImport/types";

function mockVerified(): PlanImportVerifiedRecipe[] {
  return MEAL_PREP_WEEK1_PARSED.recipes.map((r) => ({
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

describe("buildPlanTemplateDraftFromImport", () => {
  it("returns null when every slot is blocked", () => {
    const draft = buildPlanTemplateDraftFromImport({
      planName: "Empty",
      slots: [
        {
          dayIndex: 0,
          dayLabel: "Mon",
          slot: "Lunch",
          title: "Blocked",
          recipeKeys: [],
          linkStatus: "blocked",
          portionMultiplier: 1,
          supprNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          authorNutrition: null,
          claimedKcal: null,
          confidence: "low",
        },
      ],
      recipeIdByKey: {},
      mode: "match",
    });
    expect(draft).toBeNull();
  });

  it("builds a draft from compiled import slots", () => {
    const normalized = normalizeLlmPayload(MEAL_PREP_WEEK1_PARSED);
    const verified = mockVerified();
    const slots = compilePlanImportSlots({
      schedule: normalized.schedule,
      recipes: verified,
    });
    const recipeIdByKey = Object.fromEntries(
      verified.map((r) => [r.key, `id-${r.key}`]),
    );
    const draft = buildPlanTemplateDraftFromImport({
      planName: "Meal prep — Week 1",
      slots,
      recipeIdByKey,
      mode: "author",
    });
    expect(draft).not.toBeNull();
    expect(draft!.name).toBe("Meal prep — Week 1");
    expect(draft!.slots.length).toBeGreaterThan(0);
    expect(draft!.slots[0]?.recipeId).toBeDefined();
  });

  it("uses author nutrition in author mode and divides by portion multiplier", () => {
    const draft = buildPlanTemplateDraftFromImport({
      planName: "  Trimmed plan  ",
      slots: [
        {
          dayIndex: 0,
          dayLabel: "Mon",
          slot: "Lunch",
          title: "Author bowl",
          recipeKeys: ["bowl"],
          linkStatus: "kcal_only",
          portionMultiplier: 2,
          supprNutrition: { calories: 400, protein: 30, carbs: 40, fat: 12 },
          authorNutrition: { calories: 500, protein: 40, carbs: 50, fat: 15, fiberG: 6 },
          claimedKcal: 500,
          confidence: "medium",
        },
      ],
      recipeIdByKey: { bowl: "recipe-bowl" },
      mode: "author",
    });
    expect(draft).toMatchObject({
      name: "Trimmed plan",
      dayCount: 1,
      slots: [
        {
          recipeId: "recipe-bowl",
          calories: 250,
          protein: 20,
          carbs: 25,
          fat: 7.5,
          fiberG: 3,
          portionMultiplier: 2,
        },
      ],
    });
  });

  it("caps dayCount at seven for long schedules", () => {
    const draft = buildPlanTemplateDraftFromImport({
      planName: "Long plan",
      slots: [
        {
          dayIndex: 9,
          dayLabel: "Day 10",
          slot: "Lunch",
          title: "Late slot",
          recipeKeys: ["bowl"],
          linkStatus: "linked",
          portionMultiplier: 1,
          supprNutrition: { calories: 400, protein: 30, carbs: 40, fat: 12 },
          authorNutrition: null,
          claimedKcal: 400,
          confidence: "high",
        },
      ],
      recipeIdByKey: { bowl: "recipe-bowl" },
      mode: "match",
    });
    expect(draft?.dayCount).toBe(7);
  });
});
