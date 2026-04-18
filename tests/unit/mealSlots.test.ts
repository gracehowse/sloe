/**
 * Unit tests for the shared meal-slot helper (audit L5, 2026-04-18).
 * Pin `isMealSlot` (strict) and `normaliseMealSlot` (tolerant) so no
 * future literal drift can sneak in unchallenged.
 */
import { describe, expect, it } from "vitest";
import {
  MEAL_SLOTS,
  isMealSlot,
  normaliseMealSlot,
  type MealSlot,
} from "@/lib/nutrition/mealSlots";

describe("MEAL_SLOTS constant", () => {
  it("lists the four canonical slot names in order", () => {
    expect(MEAL_SLOTS).toEqual(["Breakfast", "Lunch", "Dinner", "Snacks"]);
  });

  it("is readonly at the type level (sanity — values are runtime constants)", () => {
    // Runtime check only — types are checked by tsc.
    const first: MealSlot = "Breakfast";
    expect(MEAL_SLOTS.includes(first)).toBe(true);
  });
});

describe("isMealSlot", () => {
  it("accepts exactly the canonical spellings", () => {
    expect(isMealSlot("Breakfast")).toBe(true);
    expect(isMealSlot("Lunch")).toBe(true);
    expect(isMealSlot("Dinner")).toBe(true);
    expect(isMealSlot("Snacks")).toBe(true);
  });

  it("rejects anything else — lowercase, plural drift, padding, null, non-strings", () => {
    expect(isMealSlot("breakfast")).toBe(false);
    expect(isMealSlot("BREAKFAST")).toBe(false);
    expect(isMealSlot("Snack")).toBe(false); // legacy singular not canonical
    expect(isMealSlot(" Lunch ")).toBe(false); // padded
    expect(isMealSlot("")).toBe(false);
    expect(isMealSlot(null)).toBe(false);
    expect(isMealSlot(undefined)).toBe(false);
    expect(isMealSlot(42)).toBe(false);
    expect(isMealSlot({})).toBe(false);
  });
});

describe("normaliseMealSlot", () => {
  it("returns the canonical casing for lowercase inputs", () => {
    expect(normaliseMealSlot("breakfast")).toBe("Breakfast");
    expect(normaliseMealSlot("lunch")).toBe("Lunch");
    expect(normaliseMealSlot("dinner")).toBe("Dinner");
    expect(normaliseMealSlot("snacks")).toBe("Snacks");
  });

  it("returns the canonical casing for UPPERCASE inputs", () => {
    expect(normaliseMealSlot("BREAKFAST")).toBe("Breakfast");
    expect(normaliseMealSlot("LUNCH")).toBe("Lunch");
    expect(normaliseMealSlot("DINNER")).toBe("Dinner");
    expect(normaliseMealSlot("SNACKS")).toBe("Snacks");
  });

  it("already-canonical inputs round-trip unchanged", () => {
    for (const slot of MEAL_SLOTS) {
      expect(normaliseMealSlot(slot)).toBe(slot);
    }
  });

  it("accepts padded whitespace", () => {
    expect(normaliseMealSlot("  Breakfast  ")).toBe("Breakfast");
    expect(normaliseMealSlot("\tlunch\n")).toBe("Lunch");
    expect(normaliseMealSlot("   DINNER")).toBe("Dinner");
  });

  it("legacy singular `Snack` maps to canonical plural `Snacks`", () => {
    expect(normaliseMealSlot("Snack")).toBe("Snacks");
    expect(normaliseMealSlot("snack")).toBe("Snacks");
    expect(normaliseMealSlot("SNACK")).toBe("Snacks");
    expect(normaliseMealSlot(" snack ")).toBe("Snacks");
  });

  it("returns null for unrelated strings", () => {
    expect(normaliseMealSlot("Dessert")).toBeNull();
    expect(normaliseMealSlot("Pre-workout")).toBeNull();
    expect(normaliseMealSlot("brunch")).toBeNull();
    expect(normaliseMealSlot("")).toBeNull();
    expect(normaliseMealSlot("   ")).toBeNull();
  });

  it("returns null for null / undefined / non-string inputs", () => {
    expect(normaliseMealSlot(null)).toBeNull();
    expect(normaliseMealSlot(undefined)).toBeNull();
    expect(normaliseMealSlot(42)).toBeNull();
    expect(normaliseMealSlot({})).toBeNull();
    expect(normaliseMealSlot([])).toBeNull();
  });
});
