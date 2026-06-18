/**
 * ENG-1100 — Plan partial-day canonical slot rows (web bySlot parity).
 */
import { describe, expect, it } from "vitest";
import { orderedPlanDaySlotEntries } from "@/lib/plan/orderedPlanDaySlotEntries";

describe("orderedPlanDaySlotEntries (ENG-1100)", () => {
  it("legacy mode keeps only present meals in slot order", () => {
    const meals = [
      { name: "Dinner", recipeTitle: "Soup" },
      { name: "Breakfast", recipeTitle: "Oats" },
    ];
    const entries = orderedPlanDaySlotEntries(meals, false);
    expect(entries.map((e) => (e.kind === "meal" ? e.meal.name : e.slot))).toEqual([
      "Breakfast",
      "Dinner",
    ]);
  });

  it("canonical aim mode renders all four slots; missing slots are empty rows", () => {
    const meals = [{ name: "Lunch", recipeTitle: "Salad" }];
    const entries = orderedPlanDaySlotEntries(meals, true);
    expect(entries).toHaveLength(4);
    expect(entries[0]).toMatchObject({ kind: "empty", slot: "Breakfast", slotIndex: 0 });
    expect(entries[1]).toMatchObject({ kind: "meal", meal: { name: "Lunch" }, mealIndexInDay: 0 });
    expect(entries[2]).toMatchObject({ kind: "empty", slot: "Dinner", slotIndex: 2 });
    expect(entries[3]).toMatchObject({ kind: "empty", slot: "Snacks", slotIndex: 3 });
  });

  it("empty day is four empty rows in canonical order", () => {
    const entries = orderedPlanDaySlotEntries([], true);
    expect(entries.every((e) => e.kind === "empty")).toBe(true);
    expect(entries.map((e) => (e.kind === "empty" ? e.slot : ""))).toEqual([
      "Breakfast",
      "Lunch",
      "Dinner",
      "Snacks",
    ]);
  });
});
