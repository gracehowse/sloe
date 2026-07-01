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

  // ENG-1278 — numbered presets iterate the user's REAL slots, not classic 4.
  describe("numbered presets (ENG-1278)", () => {
    const SIX = ["Meal 1", "Meal 2", "Meal 3", "Meal 4", "Meal 5", "Meal 6"];

    it("renders all six numbered slots as empty rows for a fresh 6-meal day", () => {
      const entries = orderedPlanDaySlotEntries([], true, SIX);
      expect(entries).toHaveLength(6);
      expect(entries.map((e) => (e.kind === "empty" ? e.slot : ""))).toEqual(SIX);
      expect(entries.map((e) => (e.kind === "empty" ? e.slotIndex : -1))).toEqual([
        0, 1, 2, 3, 4, 5,
      ]);
    });

    it("slots a numbered meal into its own slot; the rest stay empty", () => {
      const entries = orderedPlanDaySlotEntries(
        [{ name: "Meal 3", recipeTitle: "Chicken bowl" }],
        true,
        SIX,
      );
      expect(entries).toHaveLength(6);
      expect(entries[2]).toMatchObject({
        kind: "meal",
        meal: { name: "Meal 3" },
        mealIndexInDay: 0,
      });
      expect(entries[0]).toMatchObject({ kind: "empty", slot: "Meal 1", slotIndex: 0 });
      expect(entries[5]).toMatchObject({ kind: "empty", slot: "Meal 6", slotIndex: 5 });
    });

    it("matches numbered meals case-insensitively (no classic-4 fallback)", () => {
      const entries = orderedPlanDaySlotEntries(
        [{ name: "meal 5", recipeTitle: "Yogurt" }],
        true,
        SIX,
      );
      // "meal 5" is NOT a classic slot → must not be dropped; lands in "Meal 5".
      expect(entries[4]).toMatchObject({ kind: "meal", meal: { name: "meal 5" } });
      expect(entries.filter((e) => e.kind === "meal")).toHaveLength(1);
    });

    it("classic default (no slots arg) is byte-identical to before", () => {
      const meals = [{ name: "Lunch", recipeTitle: "Salad" }];
      const withDefault = orderedPlanDaySlotEntries(meals, true);
      const withExplicit = orderedPlanDaySlotEntries(meals, true, [
        "Breakfast",
        "Lunch",
        "Dinner",
        "Snacks",
      ]);
      expect(withDefault).toEqual(withExplicit);
    });
  });
});
