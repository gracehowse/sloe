/**
 * Action 5 Item 8 (2026-04-19) — pin the loosened `usualMealInsight`
 * gate. Previously the prompt only surfaced when the user had zero
 * saved meals. Now it also surfaces when the user has saved meals but
 * the most-repeated *unsaved* slot has ≥3 distinct-day repeats of the
 * same (title, kcal) pattern over the last 14 days.
 *
 * Four cases per spec:
 *  (a) no saved meals → surfaces top-slot suggestion (existing path)
 *  (b) saved breakfast only, lunch repeated 4× → surfaces lunch
 *  (c) all four slots saved → suppressed (nothing left to suggest)
 *  (d) most-repeated unsaved slot only repeated 2× → suppressed (below floor)
 */

import { describe, expect, it } from "vitest";
import {
  buildUsualMealRecapInsight,
  USUAL_MEAL_REPEAT_FLOOR,
} from "../../src/lib/nutrition/weeklyRecap";

const weekKeys = [
  "2026-04-13",
  "2026-04-14",
  "2026-04-15",
  "2026-04-16",
  "2026-04-17",
  "2026-04-18",
  "2026-04-19",
];

const extendedWeekKeys = [
  "2026-04-06",
  "2026-04-07",
  "2026-04-08",
  "2026-04-09",
  "2026-04-10",
  "2026-04-11",
  "2026-04-12",
  ...weekKeys,
];

function meal(slot: string, recipeTitle: string, calories = 450) {
  return {
    name: slot,
    recipeTitle,
    calories,
    protein: 30,
    carbs: 40,
    fat: 15,
  };
}

describe("usualMealInsight loosened gate", () => {
  it("(a) no saved meals → surfaces top-slot suggestion (existing behaviour)", () => {
    // 5 distinct logged days in the recap week, lunch dominant.
    const byDay: Record<string, ReturnType<typeof meal>[]> = {};
    for (const k of weekKeys.slice(0, 5)) {
      byDay[k] = [meal("Lunch", "Salad bowl"), meal("Breakfast", "Toast")];
    }
    const insight = buildUsualMealRecapInsight({
      byDay,
      weekKeys,
      savedMeals: [],
      logCountBySavedMealId: {},
      extendedWeekKeys,
    });
    expect(insight).not.toBeNull();
    expect(insight?.kind).toBe("prompt");
    // Both slots have 5 each — Breakfast wins on canonical slot order.
    if (insight?.kind === "prompt") {
      expect(["Breakfast", "Lunch"]).toContain(insight.suggestedSlot);
      // Original path doesn't carry `repeats`.
      expect(insight.repeats).toBeUndefined();
    }
  });

  it("(b) saved breakfast only, lunch repeated 4× → surfaces lunch", () => {
    // User has a saved breakfast meal but no saved lunch. Lunch ("Chicken
    // wrap") appears on 4 distinct days across the 14-day window.
    const byDay: Record<string, ReturnType<typeof meal>[]> = {};
    const lunchDays = ["2026-04-08", "2026-04-12", "2026-04-15", "2026-04-18"];
    for (const k of lunchDays) {
      byDay[k] = [meal("Lunch", "Chicken wrap", 520)];
    }
    const insight = buildUsualMealRecapInsight({
      byDay,
      weekKeys,
      savedMeals: [
        {
          id: "saved-bfast",
          name: "My usual breakfast",
          defaultMealSlot: "Breakfast",
        },
      ],
      logCountBySavedMealId: { "saved-bfast": 0 }, // not logged this week
      extendedWeekKeys,
    });
    expect(insight).not.toBeNull();
    expect(insight?.kind).toBe("prompt");
    if (insight?.kind === "prompt") {
      expect(insight.suggestedSlot).toBe("Lunch");
      expect(insight.repeats).toBe(4);
    }
  });

  it("(c) all four slots saved → suppressed", () => {
    // Even with strong cross-slot repeats, the suggestion is suppressed
    // because every canonical slot already has a saved meal.
    const byDay: Record<string, ReturnType<typeof meal>[]> = {};
    for (const k of extendedWeekKeys) {
      byDay[k] = [
        meal("Breakfast", "Oatmeal"),
        meal("Lunch", "Salad"),
        meal("Dinner", "Stir fry"),
        meal("Snacks", "Yogurt"),
      ];
    }
    const insight = buildUsualMealRecapInsight({
      byDay,
      weekKeys,
      savedMeals: [
        { id: "b", name: "Breakfast combo", defaultMealSlot: "Breakfast" },
        { id: "l", name: "Lunch combo", defaultMealSlot: "Lunch" },
        { id: "d", name: "Dinner combo", defaultMealSlot: "Dinner" },
        { id: "s", name: "Snack combo", defaultMealSlot: "Snacks" },
      ],
      // None of them logged this week.
      logCountBySavedMealId: { b: 0, l: 0, d: 0, s: 0 },
      extendedWeekKeys,
    });
    expect(insight).toBeNull();
  });

  it("(d) most-repeated unsaved slot only repeated 2× → suppressed (below floor)", () => {
    // User has a saved breakfast; lunch ("Sandwich") logged on only 2
    // distinct days. Below the floor of 3 → suppressed.
    const byDay: Record<string, ReturnType<typeof meal>[]> = {
      "2026-04-15": [meal("Lunch", "Sandwich")],
      "2026-04-18": [meal("Lunch", "Sandwich")],
    };
    const insight = buildUsualMealRecapInsight({
      byDay,
      weekKeys,
      savedMeals: [
        { id: "b", name: "My breakfast", defaultMealSlot: "Breakfast" },
      ],
      logCountBySavedMealId: { b: 0 },
      extendedWeekKeys,
    });
    expect(insight).toBeNull();
  });

  it("celebration path still wins when a saved meal was logged this week", () => {
    // A saved meal that was actually logged should celebrate, not
    // jump straight to the loosened prompt path.
    const byDay: Record<string, ReturnType<typeof meal>[]> = {};
    for (const k of extendedWeekKeys) {
      byDay[k] = [meal("Lunch", "Chicken wrap", 520)];
    }
    const insight = buildUsualMealRecapInsight({
      byDay,
      weekKeys,
      savedMeals: [
        { id: "b", name: "Breakfast combo", defaultMealSlot: "Breakfast" },
      ],
      logCountBySavedMealId: { b: 5 },
      extendedWeekKeys,
    });
    expect(insight?.kind).toBe("celebration");
  });

  it("respects the repeat floor exactly (3 fires, 2 does not)", () => {
    const byDayThree: Record<string, ReturnType<typeof meal>[]> = {
      "2026-04-08": [meal("Dinner", "Stir fry")],
      "2026-04-12": [meal("Dinner", "Stir fry")],
      "2026-04-15": [meal("Dinner", "Stir fry")],
    };
    const insightThree = buildUsualMealRecapInsight({
      byDay: byDayThree,
      weekKeys,
      savedMeals: [
        { id: "b", name: "Breakfast", defaultMealSlot: "Breakfast" },
      ],
      logCountBySavedMealId: { b: 0 },
      extendedWeekKeys,
    });
    expect(insightThree?.kind).toBe("prompt");
    if (insightThree?.kind === "prompt") {
      expect(insightThree.suggestedSlot).toBe("Dinner");
      expect(insightThree.repeats).toBe(3);
    }
    // Floor constant pinned so a future change to it must update both.
    expect(USUAL_MEAL_REPEAT_FLOOR).toBe(3);
  });

  it("differentiates by (title, kcal) — different food at same name doesn't count", () => {
    // "Chicken wrap" 4× but kcal varies wildly; treat as different
    // foods. Without a stable (title, kcal) bucket we don't claim "same one".
    const byDay: Record<string, ReturnType<typeof meal>[]> = {
      "2026-04-08": [meal("Lunch", "Chicken wrap", 520)],
      "2026-04-12": [meal("Lunch", "Chicken wrap", 320)],
      "2026-04-15": [meal("Lunch", "Chicken wrap", 720)],
      "2026-04-18": [meal("Lunch", "Chicken wrap", 410)],
    };
    const insight = buildUsualMealRecapInsight({
      byDay,
      weekKeys,
      savedMeals: [
        { id: "b", name: "Breakfast", defaultMealSlot: "Breakfast" },
      ],
      logCountBySavedMealId: { b: 0 },
      extendedWeekKeys,
    });
    // No (title, kcal) bucket has more than 1 day → below floor.
    expect(insight).toBeNull();
  });

  it("multiple distinct items in same slot — picks the dominant one for repeats count", () => {
    // Slot has two strong patterns; the dominant one drives the count.
    const byDay: Record<string, ReturnType<typeof meal>[]> = {
      "2026-04-08": [meal("Lunch", "Salad", 320), meal("Lunch", "Coffee", 5)],
      "2026-04-12": [meal("Lunch", "Salad", 320)],
      "2026-04-15": [meal("Lunch", "Salad", 320)],
      "2026-04-18": [meal("Lunch", "Salad", 320), meal("Lunch", "Coffee", 5)],
    };
    const insight = buildUsualMealRecapInsight({
      byDay,
      weekKeys,
      savedMeals: [
        { id: "b", name: "Breakfast", defaultMealSlot: "Breakfast" },
      ],
      logCountBySavedMealId: { b: 0 },
      extendedWeekKeys,
    });
    expect(insight?.kind).toBe("prompt");
    if (insight?.kind === "prompt") {
      expect(insight.suggestedSlot).toBe("Lunch");
      // "Salad" appears on 4 distinct days; "Coffee" on 2.
      expect(insight.repeats).toBe(4);
    }
  });

  it("legacy `Snack` slot name is treated as Snacks for both saved and logged rows", () => {
    const byDay: Record<string, ReturnType<typeof meal>[]> = {
      "2026-04-08": [meal("Snack", "Protein bar", 220)],
      "2026-04-12": [meal("Snacks", "Protein bar", 220)],
      "2026-04-15": [meal("Snack", "Protein bar", 220)],
    };
    // User has a saved meal with the legacy `Snack` default slot — must
    // suppress because Snacks is already covered.
    const insight = buildUsualMealRecapInsight({
      byDay,
      weekKeys,
      savedMeals: [
        { id: "x", name: "My snack", defaultMealSlot: "Snack" },
        { id: "b", name: "Breakfast", defaultMealSlot: "Breakfast" },
      ],
      logCountBySavedMealId: { x: 0, b: 0 },
      extendedWeekKeys,
    });
    expect(insight).toBeNull();
  });

  it("backward-compat: omitting `extendedWeekKeys` keeps the original gate", () => {
    // When the caller doesn't supply the 14-day window, we don't fire
    // the loosened path — older callers stay on the original behaviour.
    const byDay: Record<string, ReturnType<typeof meal>[]> = {};
    const lunchDays = ["2026-04-08", "2026-04-12", "2026-04-15", "2026-04-18"];
    for (const k of lunchDays) {
      byDay[k] = [meal("Lunch", "Chicken wrap", 520)];
    }
    const insight = buildUsualMealRecapInsight({
      byDay,
      weekKeys,
      savedMeals: [
        { id: "b", name: "Breakfast", defaultMealSlot: "Breakfast" },
      ],
      logCountBySavedMealId: { b: 0 },
      // No extendedWeekKeys → original behaviour returns null when user
      // owns saved meal but didn't log it this week.
    });
    expect(insight).toBeNull();
  });
});
