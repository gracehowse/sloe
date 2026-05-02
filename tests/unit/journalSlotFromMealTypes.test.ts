/**
 * Unit tests for the shared `journalSlotFromMealTypes` helper.
 *
 * Pins the recipe -> journal-slot routing rules used by mobile recipe
 * detail "Add to today", mobile LogSheet Library tab pick, and web
 * LogSheet Library tab pick.
 */
import { describe, expect, it } from "vitest";

import { journalSlotFromMealTypes } from "@/lib/nutrition/journalSlotFromMealTypes";

describe("journalSlotFromMealTypes", () => {
  it("returns the fallback slot when meal_type is missing", () => {
    expect(journalSlotFromMealTypes(null)).toBe("Lunch");
    expect(journalSlotFromMealTypes(undefined)).toBe("Lunch");
    expect(journalSlotFromMealTypes([])).toBe("Lunch");
  });

  it("honours an explicit fallback override", () => {
    expect(journalSlotFromMealTypes(null, "Snacks")).toBe("Snacks");
    expect(journalSlotFromMealTypes([], "Dinner")).toBe("Dinner");
  });

  it("matches breakfast first", () => {
    expect(journalSlotFromMealTypes(["breakfast"])).toBe("Breakfast");
    expect(journalSlotFromMealTypes(["Breakfast", "Brunch"])).toBe("Breakfast");
  });

  it("matches lunch", () => {
    expect(journalSlotFromMealTypes(["lunch"])).toBe("Lunch");
    expect(journalSlotFromMealTypes(["Main", "lunch"])).toBe("Lunch");
  });

  it("matches dinner and supper", () => {
    expect(journalSlotFromMealTypes(["dinner"])).toBe("Dinner");
    expect(journalSlotFromMealTypes(["supper"])).toBe("Dinner");
    expect(journalSlotFromMealTypes(["Main course", "supper"])).toBe("Dinner");
  });

  it("matches snack (singular legacy form too)", () => {
    expect(journalSlotFromMealTypes(["snack"])).toBe("Snacks");
    expect(journalSlotFromMealTypes(["snacks"])).toBe("Snacks");
  });

  it("priority: breakfast wins over later mentions", () => {
    expect(journalSlotFromMealTypes(["snack", "breakfast"])).toBe("Breakfast");
    expect(journalSlotFromMealTypes(["dinner", "breakfast"])).toBe("Breakfast");
  });

  it("falls back to normaliseMealSlot for legacy mixed-case singletons", () => {
    expect(journalSlotFromMealTypes(["Snacks"])).toBe("Snacks");
  });

  it("returns the fallback for unrecognised tags", () => {
    expect(journalSlotFromMealTypes(["dessert"])).toBe("Lunch");
    expect(journalSlotFromMealTypes(["pre-workout"])).toBe("Lunch");
    expect(journalSlotFromMealTypes(["dessert"], "Snacks")).toBe("Snacks");
  });
});
