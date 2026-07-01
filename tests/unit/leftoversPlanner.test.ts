/**
 * Leftovers planner (Batch 3.10) unit tests.
 *
 * Covers:
 *  - Yield > 1 fills matching subsequent empty slots.
 *  - Occupied slots are skipped.
 *  - Yield = 1 produces no leftovers.
 *  - Slot-type constraints (breakfast doesn't invade dinner).
 *  - Swap parent → leftovers removed.
 *  - Multiple parents on same day interleave correctly.
 *  - `moveMealInPlan` swaps two non-empty slots and clears when moving into empty.
 */

import { describe, it, expect } from "vitest";
import {
  distributeLeftovers,
  markLeftoversOnSwap,
  countLeftoversOfRecipe,
  moveMealInPlan,
  repeatMealAsLeftovers,
  type LeftoverAwareMeal,
} from "@/lib/nutrition/leftoversPlanner";
import type { DayPlan, DayPlanMeal } from "@/types/recipe";

function slot(
  name: string,
  recipeTitle = "",
  extras: Partial<LeftoverAwareMeal> = {},
): LeftoverAwareMeal {
  if (!recipeTitle) {
    return {
      name,
      recipeTitle: "",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      isPlaceholder: true,
    };
  }
  return {
    name,
    recipeTitle,
    calories: 500,
    protein: 40,
    carbs: 45,
    fat: 15,
    ...extras,
  };
}

function day(d: number, meals: LeftoverAwareMeal[]): DayPlan {
  const totals = meals.reduce(
    (a, m) => ({
      calories: a.calories + (m.calories ?? 0),
      protein: a.protein + (m.protein ?? 0),
      carbs: a.carbs + (m.carbs ?? 0),
      fat: a.fat + (m.fat ?? 0),
      fiberG: a.fiberG + (m.fiberG ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0 },
  );
  return { day: d, meals: meals as DayPlanMeal[], totals };
}

describe("distributeLeftovers", () => {
  it("fills two matching empty slots when yield is 3 and user ate 1", () => {
    const plan: DayPlan[] = [
      day(1, [slot("Dinner", "Big Curry", { recipeId: "curry" })]),
      day(2, [slot("Lunch")]), // empty → eligible
      day(3, [slot("Lunch")]), // empty → eligible
      day(4, [slot("Lunch")]),
    ];
    const out = distributeLeftovers(plan, { curry: { servings: 3 } });
    expect(out.parentCount).toBe(1);
    expect(out.leftoverCount).toBe(2);

    const day2 = out.plan[1].meals[0] as LeftoverAwareMeal;
    const day3 = out.plan[2].meals[0] as LeftoverAwareMeal;
    const day4 = out.plan[3].meals[0] as LeftoverAwareMeal;
    expect(day2.leftoverOf).toBe("curry");
    expect(day2.isLeftover).toBe(true);
    expect(day3.leftoverOf).toBe("curry");
    expect(day4.leftoverOf).toBeUndefined(); // already exhausted
    expect(day4.recipeTitle).toBe("");
  });

  it("leftover macros equal the parent's scaled macros (purely visual flag)", () => {
    const plan: DayPlan[] = [
      day(1, [
        slot("Dinner", "Bowl", {
          recipeId: "bowl",
          calories: 700,
          protein: 55,
          carbs: 50,
          fat: 25,
          portionMultiplier: 1,
        }),
      ]),
      day(2, [slot("Lunch")]),
    ];
    const out = distributeLeftovers(plan, { bowl: { servings: 2 } });
    const l = out.plan[1].meals[0] as LeftoverAwareMeal;
    expect(l.calories).toBe(700);
    expect(l.protein).toBe(55);
    expect(l.carbs).toBe(50);
    expect(l.fat).toBe(25);
    expect(l.recipeTitle).toBe("Bowl");
  });

  it("skips already-filled slots", () => {
    const plan: DayPlan[] = [
      day(1, [slot("Dinner", "Curry", { recipeId: "curry" })]),
      day(2, [slot("Lunch", "Salad", { recipeId: "salad" })]), // occupied
      day(3, [slot("Lunch")]), // empty → eligible
    ];
    const out = distributeLeftovers(plan, { curry: { servings: 3 } });
    // Day 2's salad is untouched.
    expect((out.plan[1].meals[0] as LeftoverAwareMeal).recipeTitle).toBe("Salad");
    // Day 3 is now a leftover.
    expect((out.plan[2].meals[0] as LeftoverAwareMeal).leftoverOf).toBe("curry");
    expect(out.leftoverCount).toBe(1);
  });

  it("yields of 1 produce no leftovers", () => {
    const plan: DayPlan[] = [
      day(1, [slot("Dinner", "Single", { recipeId: "single" })]),
      day(2, [slot("Lunch")]),
    ];
    const out = distributeLeftovers(plan, { single: { servings: 1 } });
    expect(out.leftoverCount).toBe(0);
    expect(out.parentCount).toBe(0);
    expect((out.plan[1].meals[0] as LeftoverAwareMeal).recipeTitle).toBe("");
  });

  it("does not push breakfast leftovers into dinner slots", () => {
    const plan: DayPlan[] = [
      day(1, [slot("Breakfast", "Oats", { recipeId: "oats" })]),
      day(2, [slot("Dinner")]), // empty but wrong slot type
      day(3, [slot("Breakfast")]), // empty and correct type
    ];
    const out = distributeLeftovers(plan, { oats: { servings: 3 } });
    expect((out.plan[1].meals[0] as LeftoverAwareMeal).recipeTitle).toBe("");
    expect((out.plan[2].meals[0] as LeftoverAwareMeal).leftoverOf).toBe("oats");
    expect(out.leftoverCount).toBe(1);
  });

  it("interleaves multiple parents on the same day correctly", () => {
    const plan: DayPlan[] = [
      day(1, [
        slot("Lunch", "Pasta", { recipeId: "pasta" }),
        slot("Dinner", "Roast", { recipeId: "roast" }),
      ]),
      day(2, [slot("Lunch"), slot("Dinner")]),
      day(3, [slot("Lunch"), slot("Dinner")]),
    ];
    const out = distributeLeftovers(plan, {
      pasta: { servings: 2 },
      roast: { servings: 2 },
    });
    // One leftover of each parent exists somewhere on days 2 or 3.
    const allMeals = out.plan.flatMap((d) => d.meals) as LeftoverAwareMeal[];
    expect(allMeals.filter((m) => m.leftoverOf === "pasta")).toHaveLength(1);
    expect(allMeals.filter((m) => m.leftoverOf === "roast")).toHaveLength(1);
    expect(out.leftoverCount).toBe(2);
    expect(out.parentCount).toBe(2);
  });

  it("carries fibre into recomputed day totals for the leftover day (ENG-1150)", () => {
    const plan: DayPlan[] = [
      day(1, [
        slot("Dinner", "Bowl", {
          recipeId: "bowl",
          calories: 700,
          protein: 55,
          carbs: 50,
          fat: 25,
          fiberG: 12,
        }),
      ]),
      day(2, [slot("Lunch")]), // empty → eligible for the leftover
    ];
    const out = distributeLeftovers(plan, { bowl: { servings: 2 } });
    // The parent day keeps its fibre, and the leftover day now totals the
    // copied parent's fibre (was 0 before the fix dropped fiberG on reduce).
    expect(out.plan[0].totals.fiberG).toBe(12);
    expect(out.plan[1].totals.fiberG).toBe(12);
  });

  it("does not create leftovers of leftovers", () => {
    // Pre-seed a leftover then run — it should not spawn further leftovers.
    const plan: DayPlan[] = [
      day(1, [
        slot("Dinner", "Curry", {
          recipeId: "curry",
          leftoverOf: "curry",
          isLeftover: true,
        }),
      ]),
      day(2, [slot("Lunch")]),
    ];
    const out = distributeLeftovers(plan, { curry: { servings: 5 } });
    expect(out.leftoverCount).toBe(0);
  });
});

describe("markLeftoversOnSwap", () => {
  it("removes downstream leftovers when parent is swapped", () => {
    const plan: DayPlan[] = [
      day(1, [slot("Dinner", "Curry", { recipeId: "curry" })]),
      day(2, [slot("Lunch", "Curry", { recipeId: "curry", leftoverOf: "curry", isLeftover: true })]),
      day(3, [slot("Lunch", "Curry", { recipeId: "curry", leftoverOf: "curry", isLeftover: true })]),
    ];
    const before = countLeftoversOfRecipe(plan, "curry");
    expect(before).toBe(2);
    const { plan: cleaned, removedCount } = markLeftoversOnSwap(plan, {
      dayIndex: 0, // parent is at day 1 → index 0
      slot: "Dinner",
      previousRecipeId: "curry",
    });
    expect(removedCount).toBe(2);
    expect(countLeftoversOfRecipe(cleaned, "curry")).toBe(0);
    expect(cleaned[1].meals[0].isPlaceholder).toBe(true);
    expect(cleaned[2].meals[0].isPlaceholder).toBe(true);
    // Day totals recomputed.
    expect(cleaned[1].totals.calories).toBe(0);
  });

  it("recomputes fibre on changed days when clearing leftovers (ENG-1150)", () => {
    const plan: DayPlan[] = [
      day(1, [slot("Dinner", "Curry", { recipeId: "curry", fiberG: 10 })]),
      day(2, [
        slot("Lunch", "Curry", {
          recipeId: "curry",
          leftoverOf: "curry",
          isLeftover: true,
          fiberG: 10,
        }),
      ]),
    ];
    const { plan: cleaned } = markLeftoversOnSwap(plan, {
      dayIndex: 0,
      slot: "Dinner",
      previousRecipeId: "curry",
    });
    // The cleared downstream day's fibre drops to 0 (slot emptied); the parent
    // day is before the swap point and is left untouched, keeping its fibre.
    expect(cleaned[1].totals.fiberG).toBe(0);
    expect(cleaned[0].totals.fiberG).toBe(10);
  });

  it("is a no-op when the swapped slot had no recipe id", () => {
    const plan: DayPlan[] = [day(1, [slot("Lunch")]), day(2, [slot("Lunch")])];
    const { plan: out, removedCount } = markLeftoversOnSwap(plan, {
      dayIndex: 0,
      slot: "Lunch",
      previousRecipeId: undefined,
    });
    expect(removedCount).toBe(0);
    expect(out).toBe(plan);
  });
});

describe("moveMealInPlan", () => {
  it("swaps two non-empty slots across days", () => {
    const plan: DayPlan[] = [
      day(1, [slot("Breakfast", "Oats", { recipeId: "oats", calories: 300 })]),
      day(2, [slot("Breakfast", "Eggs", { recipeId: "eggs", calories: 400 })]),
    ];
    const out = moveMealInPlan(plan, { day: 1, slotIndex: 0 }, { day: 2, slotIndex: 0 });
    expect(out[0].meals[0].recipeTitle).toBe("Eggs");
    expect(out[1].meals[0].recipeTitle).toBe("Oats");
    expect(out[0].totals.calories).toBe(400);
    expect(out[1].totals.calories).toBe(300);
  });

  it("moving into an empty slot leaves the source empty", () => {
    const plan: DayPlan[] = [
      day(1, [slot("Dinner", "Curry", { recipeId: "curry", calories: 500 })]),
      day(2, [slot("Dinner")]),
    ];
    const out = moveMealInPlan(plan, { day: 1, slotIndex: 0 }, { day: 2, slotIndex: 0 });
    expect(out[0].meals[0].isPlaceholder).toBe(true);
    expect(out[0].totals.calories).toBe(0);
    expect(out[1].meals[0].recipeTitle).toBe("Curry");
    expect(out[1].totals.calories).toBe(500);
  });

  it("preserves slot labels (Breakfast stays Breakfast)", () => {
    const plan: DayPlan[] = [
      day(1, [slot("Breakfast", "Oats", { recipeId: "oats" })]),
      day(2, [slot("Dinner", "Curry", { recipeId: "curry" })]),
    ];
    const out = moveMealInPlan(plan, { day: 1, slotIndex: 0 }, { day: 2, slotIndex: 0 });
    expect(out[0].meals[0].name).toBe("Breakfast");
    expect(out[1].meals[0].name).toBe("Dinner");
    // Recipe titles swapped, labels stayed put.
    expect(out[0].meals[0].recipeTitle).toBe("Curry");
    expect(out[1].meals[0].recipeTitle).toBe("Oats");
  });

  it("is a no-op when source equals destination", () => {
    const plan: DayPlan[] = [day(1, [slot("Lunch", "Salad", { recipeId: "salad" })])];
    const out = moveMealInPlan(plan, { day: 1, slotIndex: 0 }, { day: 1, slotIndex: 0 });
    expect(out).toBe(plan);
  });

  it("includes fiberG in recomputed day totals (ENG-1131)", () => {
    const plan: DayPlan[] = [
      day(1, [slot("Breakfast", "Oats", { recipeId: "oats", calories: 300, fiberG: 8 })]),
      day(2, [slot("Breakfast", "Eggs", { recipeId: "eggs", calories: 400, fiberG: 2 })]),
    ];
    const out = moveMealInPlan(plan, { day: 1, slotIndex: 0 }, { day: 2, slotIndex: 0 });
    expect(out[0].totals.fiberG).toBe(2);
    expect(out[1].totals.fiberG).toBe(8);
  });
});

describe("repeatMealAsLeftovers (ENG-958 'Cook once, eat twice')", () => {
  const base = (): DayPlan[] => [
    day(1, [
      slot("Breakfast", "Oats", { recipeId: "oats" }),
      slot("Dinner", "Chili", { recipeId: "chili" }),
    ]),
    day(2, [slot("Lunch"), slot("Dinner")]),
    day(3, [slot("Lunch"), slot("Dinner")]),
  ];

  it("places a leftover on each chosen day's first compatible empty slot", () => {
    const { plan, placedCount, skippedDays } = repeatMealAsLeftovers(
      base(),
      { day: 1, slotIndex: 1 },
      [2, 3],
    );
    expect(placedCount).toBe(2);
    expect(skippedDays).toEqual([]);
    const d2 = plan[1].meals[0] as LeftoverAwareMeal; // dinner → lunch/dinner; lunch is first
    expect(d2.recipeId).toBe("chili");
    expect(d2.isLeftover).toBe(true);
    expect(d2.leftoverOf).toBe("chili");
    expect((plan[2].meals[0] as LeftoverAwareMeal).leftoverOf).toBe("chili");
  });

  it("skips a day with no compatible empty slot and reports it", () => {
    const plan0 = base();
    plan0[1] = day(2, [
      slot("Lunch", "Salad", { recipeId: "salad" }),
      slot("Dinner", "Steak", { recipeId: "steak" }),
    ]);
    const { placedCount, skippedDays } = repeatMealAsLeftovers(plan0, { day: 1, slotIndex: 1 }, [2, 3]);
    expect(placedCount).toBe(1);
    expect(skippedDays).toEqual([2]);
  });

  it("never targets the source day", () => {
    const { placedCount, skippedDays } = repeatMealAsLeftovers(base(), { day: 1, slotIndex: 1 }, [1]);
    expect(placedCount).toBe(0);
    expect(skippedDays).toEqual([1]);
  });

  it("is idempotent — skips a day that already holds a leftover of the recipe", () => {
    const { plan } = repeatMealAsLeftovers(base(), { day: 1, slotIndex: 1 }, [2]);
    const second = repeatMealAsLeftovers(plan, { day: 1, slotIndex: 1 }, [2]);
    expect(second.placedCount).toBe(0);
    expect(second.skippedDays).toEqual([2]);
  });

  it("no-ops (returns the original plan) on a placeholder/empty source", () => {
    const plan0 = base();
    const { placedCount, plan } = repeatMealAsLeftovers(plan0, { day: 2, slotIndex: 0 }, [3]);
    expect(placedCount).toBe(0);
    expect(plan).toBe(plan0);
  });

  it("no-ops on a leftover source (no leftovers of leftovers)", () => {
    const { plan } = repeatMealAsLeftovers(base(), { day: 1, slotIndex: 1 }, [2]);
    const { placedCount } = repeatMealAsLeftovers(plan, { day: 2, slotIndex: 0 }, [3]);
    expect(placedCount).toBe(0);
  });

  it("recomputes the target day's totals including fibre (ENG-1150)", () => {
    const plan0: DayPlan[] = [
      day(1, [slot("Dinner", "Chili", { recipeId: "chili", calories: 600, fiberG: 12 })]),
      day(2, [slot("Dinner")]),
    ];
    const { plan } = repeatMealAsLeftovers(plan0, { day: 1, slotIndex: 0 }, [2]);
    expect(plan[1].totals.calories).toBe(600);
    expect(plan[1].totals.fiberG).toBe(12);
  });
});
