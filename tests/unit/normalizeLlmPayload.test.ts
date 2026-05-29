/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { normalizeLlmPayload } from "@/lib/planning/planImport/normalizeLlmPayload";

describe("normalizeLlmPayload", () => {
  it("returns empty payload for null or non-object roots", () => {
    expect(normalizeLlmPayload(null)).toEqual({ planName: null, recipes: [], schedule: [] });
    expect(normalizeLlmPayload("bad")).toEqual({ planName: null, recipes: [], schedule: [] });
  });

  it("reads plan_name alias and trims whitespace", () => {
    expect(normalizeLlmPayload({ plan_name: "  Week 1  " }).planName).toBe("Week 1");
  });

  it("normalizes recipes from name field with slug keys", () => {
    const result = normalizeLlmPayload({
      recipes: [{ name: "Power Bowl", ingredients: ["100 g rice"], servings: 2 }],
    });
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]).toMatchObject({
      title: "Power Bowl",
      key: "power-bowl",
      serves: 2,
      ingredients: ["100 g rice"],
    });
  });

  it("drops recipes without a title", () => {
    expect(normalizeLlmPayload({ recipes: [{ ingredients: ["egg"] }] }).recipes).toHaveLength(0);
  });

  it("defaults serves to 1 when missing or invalid", () => {
    const missing = normalizeLlmPayload({ recipes: [{ title: "Soup" }] });
    const invalid = normalizeLlmPayload({ recipes: [{ title: "Soup", serves: 0 }] });
    expect(missing.recipes[0]?.serves).toBe(1);
    expect(invalid.recipes[0]?.serves).toBe(1);
  });

  it("maps author nutrition aliases and parses string numbers", () => {
    const result = normalizeLlmPayload({
      recipes: [
        {
          title: "Salad",
          nutrition: { kcal: "320 kcal", proteinG: 12, fibreG: 4.5 },
        },
      ],
    });
    expect(result.recipes[0]?.authorNutrition).toEqual({
      calories: 320,
      protein: 12,
      carbs: null,
      fat: null,
      fiberG: 4.5,
    });
  });

  it("generates recipe-N key when title slugifies to empty", () => {
    const result = normalizeLlmPayload({ recipes: [{ title: "!!!" }] });
    expect(result.recipes[0]?.key).toBe("recipe-1");
  });

  it("normalizes schedule slot aliases and meal-type shorthand", () => {
    const result = normalizeLlmPayload({
      days: [
        {
          day_label: "Mon",
          day_index: 2,
          meals: [
            {
              title: "Morning bowl",
              mealSlot: "breakfast",
              recipe_keys: "bowl-key",
              portion_multiplier: 1.5,
              claimed_kcal: "450 kcal",
            },
            {
              label: "Afternoon snack",
              slot: "snk",
              recipes: "berry-pot",
            },
          ],
        },
      ],
    });
    expect(result.schedule).toHaveLength(1);
    expect(result.schedule[0]).toMatchObject({ dayLabel: "Mon", dayIndex: 2 });
    expect(result.schedule[0]?.slots[0]).toMatchObject({
      slot: "Breakfast",
      label: "Morning bowl",
      recipeKeys: ["bowl-key"],
      portionMultiplier: 1.5,
      claimedKcal: 450,
    });
    expect(result.schedule[0]?.slots[1]).toMatchObject({
      slot: "Snacks",
      label: "Afternoon snack",
      recipeKeys: ["berry-pot"],
    });
  });

  it("drops schedule days with no valid slots", () => {
    expect(
      normalizeLlmPayload({ schedule: [{ dayLabel: "Mon", slots: [{ slot: "Lunch" }] }] }).schedule,
    ).toHaveLength(0);
  });

  it("capitalizes unknown slot labels and falls back to Lunch when blank", () => {
    const result = normalizeLlmPayload({
      schedule: [
        {
          dayLabel: "Tue",
          slots: [
            { label: "Pre-workout", slot: "preworkout", recipeKeys: [] },
            { label: "Mystery meal", slot: "   ", recipeKeys: [] },
          ],
        },
      ],
    });
    expect(result.schedule[0]?.slots[0]?.slot).toBe("Preworkout");
    expect(result.schedule[0]?.slots[1]?.slot).toBe("Lunch");
  });

  it("preserves trimmed method text and ignores invalid author nutrition values", () => {
    const result = normalizeLlmPayload({
      recipes: [
        {
          title: "Soup",
          method: "  Simmer and serve.  ",
          authorNutrition: { calories: "not-a-number", protein: null },
        },
      ],
    });
    expect(result.recipes[0]?.method).toBe("Simmer and serve.");
    expect(result.recipes[0]?.authorNutrition).toEqual({
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      fiberG: null,
    });
  });
});
