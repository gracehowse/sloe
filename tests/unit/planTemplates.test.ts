/**
 * Plan template (Batch 3.10) unit tests.
 *
 * Covers:
 *  - `buildTemplateFromWeek` strips volatile per-user state (leftovers, placeholders)
 *    and keeps the recipe ref / slot / portion multiplier.
 *  - `applyTemplateToWeek` expands dayIndex back into 1-indexed `DayPlan.day`
 *    with correct totals.
 *  - `dayIndexToDateKey` handles month/year rollover.
 *  - `validatePlanTemplate` catches empty names, bad dayCount, out-of-range dayIndex.
 */

import { describe, it, expect } from "vitest";
import {
  applyTemplateToWeek,
  buildTemplateFromWeek,
  dayIndexToDateKey,
  validatePlanTemplate,
  type PlanTemplateDraft,
} from "@/lib/nutrition/planTemplates";
import type { DayPlan, DayPlanMeal } from "@/types/recipe";

function meal(over: Partial<DayPlanMeal & { recipeId?: string }> = {}): DayPlanMeal & { recipeId?: string } {
  return {
    name: "Lunch",
    recipeTitle: "Tuna salad",
    recipeId: "r-tuna",
    calories: 400,
    protein: 30,
    carbs: 20,
    fat: 18,
    portionMultiplier: 1,
    ...over,
  };
}

function dayWith(d: number, meals: (DayPlanMeal & { recipeId?: string })[]): DayPlan {
  const totals = meals.reduce(
    (a, m) => ({
      calories: a.calories + m.calories,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { day: d, meals, totals };
}

describe("buildTemplateFromWeek", () => {
  it("strips placeholders, leftovers, and preserves recipe refs", () => {
    const plan: DayPlan[] = [
      dayWith(1, [
        meal({ name: "Breakfast", recipeTitle: "Oats", recipeId: "r-oats" }),
        // Leftover — must be dropped (templates re-derive leftovers on apply).
        meal({ name: "Lunch", recipeTitle: "Tuna", recipeId: "r-tuna", leftoverOf: "r-tuna", isLeftover: true }),
        // Placeholder — must be dropped.
        {
          name: "Dinner",
          recipeTitle: "",
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          isPlaceholder: true,
        },
      ]),
      dayWith(2, [
        meal({ name: "Lunch", recipeTitle: "Curry", recipeId: "r-curry", portionMultiplier: 2, calories: 800 }),
      ]),
    ];

    const draft = buildTemplateFromWeek(plan, "Bulk week", 2);
    expect(draft).not.toBeNull();
    expect(draft!.name).toBe("Bulk week");
    expect(draft!.dayCount).toBe(2);
    expect(draft!.slots).toHaveLength(2);

    const oats = draft!.slots.find((s) => s.recipeId === "r-oats")!;
    expect(oats.dayIndex).toBe(0);
    expect(oats.slot).toBe("Breakfast");
    expect(oats.portionMultiplier).toBe(1);

    // Curry was scaled 2× — template stores base (divide out multiplier).
    const curry = draft!.slots.find((s) => s.recipeId === "r-curry")!;
    expect(curry.dayIndex).toBe(1);
    expect(curry.portionMultiplier).toBe(2);
    expect(curry.calories).toBe(400); // 800 / 2 ≈ base
  });

  it("returns null when the week has no eligible meals", () => {
    expect(buildTemplateFromWeek([], "Empty", 1)).toBeNull();
    expect(buildTemplateFromWeek(null, "Empty", 1)).toBeNull();

    const emptyWeek: DayPlan[] = [
      dayWith(1, [
        {
          name: "Lunch",
          recipeTitle: "",
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          isPlaceholder: true,
        },
      ]),
    ];
    expect(buildTemplateFromWeek(emptyWeek, "Empty", 1)).toBeNull();
  });

  it("rejects empty/whitespace names and over-long names", () => {
    const plan: DayPlan[] = [dayWith(1, [meal()])];
    expect(buildTemplateFromWeek(plan, "", 1)).toBeNull();
    expect(buildTemplateFromWeek(plan, "   ", 1)).toBeNull();
    expect(buildTemplateFromWeek(plan, "a".repeat(81), 1)).toBeNull();
  });

  it("clamps dayCount to 1..7", () => {
    const plan: DayPlan[] = [dayWith(1, [meal()]), dayWith(2, [meal({ name: "Dinner" })])];
    const low = buildTemplateFromWeek(plan, "tiny", 0);
    expect(low!.dayCount).toBe(1);
    // High clamp: 99 → 7, but only days actually present contribute slots.
    const high = buildTemplateFromWeek(plan, "big", 99);
    expect(high!.dayCount).toBe(7);
    expect(high!.slots.every((s) => s.dayIndex < 7)).toBe(true);
  });
});

describe("applyTemplateToWeek", () => {
  it("expands slots into a 1-indexed DayPlan[] with correct totals", () => {
    const template: PlanTemplateDraft = {
      name: "Weekend",
      dayCount: 3,
      slots: [
        { dayIndex: 0, slot: "Breakfast", recipeId: "r-a", recipeTitle: "A", calories: 300, protein: 20, carbs: 30, fat: 10, servings: 1, portionMultiplier: 1 },
        { dayIndex: 1, slot: "Dinner", recipeId: "r-b", recipeTitle: "B", calories: 500, protein: 40, carbs: 45, fat: 15, servings: 1, portionMultiplier: 2 },
      ],
    };
    const plan = applyTemplateToWeek(template);
    expect(plan).toHaveLength(3);
    expect(plan[0].day).toBe(1);
    expect(plan[1].day).toBe(2);
    expect(plan[2].day).toBe(3);
    expect(plan[0].meals[0].recipeTitle).toBe("A");
    // Scaled 2× on day 2.
    expect(plan[1].meals[0].calories).toBe(1000);
    expect(plan[1].totals.calories).toBe(1000);
    // Day 3 is empty (template had no day-2 slots).
    expect(plan[2].meals).toHaveLength(0);
    expect(plan[2].totals.calories).toBe(0);
  });

  it("drops slots with out-of-range dayIndex defensively", () => {
    const plan = applyTemplateToWeek({
      dayCount: 2,
      slots: [
        { dayIndex: 0, slot: "Lunch", recipeTitle: "Good", calories: 100, protein: 5, carbs: 10, fat: 2, servings: 1, portionMultiplier: 1 },
        { dayIndex: 5, slot: "Lunch", recipeTitle: "Bad", calories: 999, protein: 99, carbs: 99, fat: 99, servings: 1, portionMultiplier: 1 },
      ],
    });
    expect(plan[0].meals).toHaveLength(1);
    expect(plan[1].meals).toHaveLength(0);
    expect(plan[0].meals[0].recipeTitle).toBe("Good");
  });
});

describe("dayIndexToDateKey", () => {
  it("rolls over month boundaries", () => {
    // 2026-01-30 + 3 days → 2026-02-02
    expect(dayIndexToDateKey("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("rolls over year boundaries", () => {
    // 2026-12-30 + 3 days → 2027-01-02
    expect(dayIndexToDateKey("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("returns the same date for dayIndex 0", () => {
    expect(dayIndexToDateKey("2026-04-17", 0)).toBe("2026-04-17");
  });
});

describe("validatePlanTemplate", () => {
  const okSlot = {
    dayIndex: 0,
    slot: "Lunch",
    recipeTitle: "X",
    calories: 100,
    protein: 5,
    carbs: 10,
    fat: 2,
    servings: 1,
    portionMultiplier: 1,
  };

  it("returns null for a valid draft", () => {
    expect(
      validatePlanTemplate({ name: "Valid", dayCount: 1, slots: [okSlot] }),
    ).toBeNull();
  });

  it("rejects empty name", () => {
    expect(validatePlanTemplate({ name: "", dayCount: 1, slots: [okSlot] })).toMatch(/name/i);
    expect(validatePlanTemplate({ name: "   ", dayCount: 1, slots: [okSlot] })).toMatch(/name/i);
  });

  it("rejects dayCount out of range", () => {
    expect(validatePlanTemplate({ name: "x", dayCount: 0, slots: [okSlot] })).toMatch(/day count/i);
    expect(validatePlanTemplate({ name: "x", dayCount: 8, slots: [okSlot] })).toMatch(/day count/i);
  });

  it("rejects slots outside dayCount range", () => {
    expect(
      validatePlanTemplate({ name: "x", dayCount: 1, slots: [{ ...okSlot, dayIndex: 5 }] }),
    ).toMatch(/outside/i);
  });

  it("rejects empty slot list", () => {
    expect(validatePlanTemplate({ name: "x", dayCount: 1, slots: [] })).toMatch(/no meals/i);
  });

  it("rejects null draft", () => {
    expect(validatePlanTemplate(null)).toMatch(/no meals/i);
  });
});
