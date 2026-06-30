/**
 * ENG-1177 — meal-slot calorie budget across configured slot lists.
 *
 * The meal-slot preset model (classic / four_meals / six_meals via
 * `meal_slot_config`) can run a day on 5 or 6 numbered slots. Pre-fix the budget
 * helpers hardcoded the four named slots, so the extra slots of a 5- / 6-meal
 * config received ratio 0 → 0 kcal. These tests pin the fix: every configured
 * slot gets a non-negative share, the shares sum to ≤ 1, and the classic
 * default (no slot list passed) keeps its prior dietitian behaviour.
 */
import { describe, expect, it } from "vitest";
import {
  MEAL_SLOT_CALORIE_RATIOS,
  coachSlotAimKcal,
  distributeMealBudget,
  unloggedMealSlotCount,
} from "../../src/lib/nutrition/mealBudget";
import { enabledMealSlotLabels } from "../../src/lib/nutrition/userMealSlotConfig";

const NUMBERED_FIVE = ["Meal 1", "Meal 2", "Meal 3", "Meal 4", "Meal 5"] as const;
const SIX_MEALS = enabledMealSlotLabels({ preset: "six_meals" }); // Meal 1 … Meal 6
const CLASSIC = enabledMealSlotLabels({ preset: "classic" }); // Breakfast/Lunch/Dinner/Snacks

/** Sum of the per-slot calorie shares the budget implies for a fully-empty day. */
function ratioSumFor(slots: readonly string[], dayKcal = 2000): number {
  const budget = distributeMealBudget(dayKcal, 30, {}, slots);
  return budget.reduce((sum, b) => sum + b.calories, 0) / dayKcal;
}

describe("distributeMealBudget — configured slot lists (ENG-1177)", () => {
  it("classic default (no slot list) preserves the 25/30/30/15 dietitian split", () => {
    const budget = distributeMealBudget(2000, 30, {});
    const bySlot = Object.fromEntries(budget.map((b) => [b.slot, b.calories]));
    expect(budget.map((b) => b.slot)).toEqual(["Breakfast", "Lunch", "Dinner", "Snacks"]);
    expect(bySlot.Breakfast).toBe(500); // 0.25
    expect(bySlot.Lunch).toBe(600); // 0.30
    expect(bySlot.Dinner).toBe(600); // 0.30
    expect(bySlot.Snacks).toBe(300); // 0.15
  });

  it("5-slot config — every slot non-negative and shares sum to ≤ 1", () => {
    const budget = distributeMealBudget(2000, 30, {}, NUMBERED_FIVE);
    expect(budget).toHaveLength(5);
    for (const b of budget) {
      expect(b.calories).toBeGreaterThanOrEqual(0);
      expect(b.fiber).toBeGreaterThanOrEqual(0);
      // None of the configured slots may be starved to 0 on an empty day.
      expect(b.calories).toBeGreaterThan(0);
    }
    expect(ratioSumFor(NUMBERED_FIVE)).toBeLessThanOrEqual(1 + 1e-9);
    // Even 1/5 split → each ~400 kcal.
    for (const b of budget) expect(b.calories).toBe(400);
  });

  it("6-slot config — Meal 5 / Meal 6 are NOT starved to 0 kcal (the bug)", () => {
    const budget = distributeMealBudget(2400, 36, {}, SIX_MEALS);
    expect(budget).toHaveLength(6);
    const bySlot = Object.fromEntries(budget.map((b) => [b.slot, b.calories]));
    expect(bySlot["Meal 5"]).toBeGreaterThan(0);
    expect(bySlot["Meal 6"]).toBeGreaterThan(0);
    for (const b of budget) {
      expect(b.calories).toBeGreaterThanOrEqual(0);
      expect(b.fiber).toBeGreaterThanOrEqual(0);
    }
    expect(ratioSumFor(SIX_MEALS)).toBeLessThanOrEqual(1 + 1e-9);
    // Even 1/6 split → each 400 kcal.
    for (const b of budget) expect(b.calories).toBe(400);
  });

  it("6-slot config — redistributes honestly when an earlier slot is logged", () => {
    const consumed = { "Meal 1": 800 };
    const budget = distributeMealBudget(2400, 36, consumed, SIX_MEALS);
    const bySlot = Object.fromEntries(budget.map((b) => [b.slot, b.calories]));
    // Logged slot returns 0 (the calories:0 trap — already eaten).
    expect(bySlot["Meal 1"]).toBe(0);
    // Remaining 1600 kcal spread evenly across the 5 empty slots → 320 each.
    for (const slot of ["Meal 2", "Meal 3", "Meal 4", "Meal 5", "Meal 6"]) {
      expect(bySlot[slot]).toBe(320);
    }
  });

  it("never returns a negative calorie share even when over budget", () => {
    const budget = distributeMealBudget(1800, 30, { "Meal 1": 2000 }, SIX_MEALS);
    for (const b of budget) expect(b.calories).toBeGreaterThanOrEqual(0);
  });
});

describe("coachSlotAimKcal — configured slot lists (ENG-1177)", () => {
  it("classic default keeps the named-slot share for the next meal", () => {
    // Empty day, 2000 kcal remaining, next = Breakfast.
    // Breakfast ratio 0.25 / total 1.0 → 500.
    expect(coachSlotAimKcal(2000, "Breakfast", [], CLASSIC)).toBe(500);
  });

  it("6-slot config — the next numbered slot gets a positive even share, not 0", () => {
    // Empty day, 2400 kcal, next = Meal 5. Even share 1/6 of the unlogged sum.
    const aim = coachSlotAimKcal(2400, "Meal 5", [], SIX_MEALS);
    expect(aim).toBeGreaterThan(0);
    expect(aim).toBe(400); // 2400 * (1/6 ÷ 6/6)
  });

  it("5-slot config — share shrinks as earlier slots are logged", () => {
    // Meal 1 + Meal 2 logged; 3 unlogged slots remain; remaining 900 kcal.
    const aim = coachSlotAimKcal(900, "Meal 3", ["Meal 1", "Meal 2"], NUMBERED_FIVE);
    expect(aim).toBe(300); // 900 / 3 unlogged
  });
});

describe("unloggedMealSlotCount — configured slot lists (ENG-1177)", () => {
  it("classic default counts the four named slots", () => {
    expect(unloggedMealSlotCount([])).toBe(4);
    expect(unloggedMealSlotCount(["Breakfast"])).toBe(3);
  });

  it("6-slot config counts all six numbered slots", () => {
    expect(unloggedMealSlotCount([], SIX_MEALS)).toBe(6);
    expect(unloggedMealSlotCount(["Meal 1", "Meal 2"], SIX_MEALS)).toBe(4);
    // Case-insensitive match — a stray casing variant still counts as logged.
    expect(unloggedMealSlotCount(["meal 1"], SIX_MEALS)).toBe(5);
  });

  it("5-slot config counts five slots", () => {
    expect(unloggedMealSlotCount([], NUMBERED_FIVE)).toBe(5);
  });
});

describe("MEAL_SLOT_CALORIE_RATIOS invariant", () => {
  it("the named dietitian shares sum to exactly 1", () => {
    const sum = Object.values(MEAL_SLOT_CALORIE_RATIOS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});
