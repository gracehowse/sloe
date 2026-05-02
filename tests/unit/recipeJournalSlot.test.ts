/**
 * Build 41 (TestFlight `AB1PYpfPjbd9li7jtnlAsIE`, 2026-05-01) — pin
 * the `recipe.meal_type` → journal slot resolution against regression.
 * Pre-fix the helper hard-fell-back to "Lunch" when meal_type was null,
 * so a recipe imported without a slot tag logged at 8am would land in
 * Lunch. This file locks the new ladder:
 *
 *   1. honour explicit meal_type
 *   2. fall back to time-of-day
 *   3. last-chance normalise → fall back to time-of-day on miss
 *
 * Used by the mobile recipe Log button (`apps/mobile/app/recipe/[id].tsx`)
 * and the web CookMode log path (`src/app/components/CookMode.tsx`).
 */
import { describe, expect, it } from "vitest";
import {
  fallbackSlotFromTimeOfDay,
  journalSlotFromMealTypes,
} from "../../src/lib/nutrition/recipeJournalSlot";

const at = (hour: number, minute = 0): Date => {
  const d = new Date(2026, 4, 1, hour, minute, 0, 0);
  return d;
};

describe("fallbackSlotFromTimeOfDay", () => {
  it("returns Breakfast before 11:00", () => {
    expect(fallbackSlotFromTimeOfDay(at(0))).toBe("Breakfast");
    expect(fallbackSlotFromTimeOfDay(at(7, 30))).toBe("Breakfast");
    expect(fallbackSlotFromTimeOfDay(at(10, 59))).toBe("Breakfast");
  });

  it("returns Lunch from 11:00 to 14:59", () => {
    expect(fallbackSlotFromTimeOfDay(at(11))).toBe("Lunch");
    expect(fallbackSlotFromTimeOfDay(at(13, 15))).toBe("Lunch");
    expect(fallbackSlotFromTimeOfDay(at(14, 59))).toBe("Lunch");
  });

  it("returns Snacks from 15:00 to 16:59", () => {
    expect(fallbackSlotFromTimeOfDay(at(15))).toBe("Snacks");
    expect(fallbackSlotFromTimeOfDay(at(16, 30))).toBe("Snacks");
  });

  it("returns Dinner from 17:00 onwards", () => {
    expect(fallbackSlotFromTimeOfDay(at(17))).toBe("Dinner");
    expect(fallbackSlotFromTimeOfDay(at(19, 30))).toBe("Dinner");
    expect(fallbackSlotFromTimeOfDay(at(23, 59))).toBe("Dinner");
  });
});

describe("journalSlotFromMealTypes — explicit meal_type wins", () => {
  it("honours breakfast even at dinner-time clock", () => {
    // The canonical user report: breakfast recipe imported with
    // meal_type=["breakfast"] was logged as Lunch at 9pm. Now it
    // honours the recipe tag regardless of clock.
    expect(journalSlotFromMealTypes(["breakfast"], at(21))).toBe("Breakfast");
    expect(journalSlotFromMealTypes(["Breakfast"], at(21))).toBe("Breakfast");
    expect(journalSlotFromMealTypes(["BREAKFAST"], at(21))).toBe("Breakfast");
  });

  it("honours lunch / dinner / snack tags regardless of clock", () => {
    expect(journalSlotFromMealTypes(["lunch"], at(8))).toBe("Lunch");
    expect(journalSlotFromMealTypes(["dinner"], at(8))).toBe("Dinner");
    expect(journalSlotFromMealTypes(["supper"], at(8))).toBe("Dinner");
    expect(journalSlotFromMealTypes(["snack"], at(8))).toBe("Snacks");
  });

  it("uses the first matching tag when multiple are set", () => {
    // breakfast appears first in the joined string → Breakfast wins.
    expect(journalSlotFromMealTypes(["breakfast", "snack"], at(20))).toBe("Breakfast");
    // lunch + dinner — lunch wins because the includes() check fires first.
    expect(journalSlotFromMealTypes(["lunch", "dinner"], at(20))).toBe("Lunch");
  });
});

describe("journalSlotFromMealTypes — time-of-day fallback when meal_type is empty", () => {
  it("returns time-of-day slot when meal_type is null", () => {
    expect(journalSlotFromMealTypes(null, at(8))).toBe("Breakfast");
    expect(journalSlotFromMealTypes(null, at(13))).toBe("Lunch");
    expect(journalSlotFromMealTypes(null, at(15, 30))).toBe("Snacks");
    expect(journalSlotFromMealTypes(null, at(19))).toBe("Dinner");
  });

  it("returns time-of-day slot when meal_type is undefined", () => {
    expect(journalSlotFromMealTypes(undefined, at(8))).toBe("Breakfast");
    expect(journalSlotFromMealTypes(undefined, at(19))).toBe("Dinner");
  });

  it("returns time-of-day slot when meal_type is an empty array", () => {
    expect(journalSlotFromMealTypes([], at(8))).toBe("Breakfast");
    expect(journalSlotFromMealTypes([], at(19))).toBe("Dinner");
  });
});

describe("journalSlotFromMealTypes — last-chance normalise", () => {
  it("normalises a known canonical slot literal that didn't hit the includes() chain", () => {
    // "Snacks" (plural) is the canonical literal; the includes() chain
    // checks "snack" so it actually catches this one already, but
    // "Snacks" via normaliseMealSlot also returns "Snacks" — pin both
    // paths so a regression in either is caught.
    expect(journalSlotFromMealTypes(["Snacks"], at(8))).toBe("Snacks");
  });

  it("falls back to time-of-day when the meal_type string is unrecognised", () => {
    // "dessert" is not in the includes() chain and not a normalisable
    // slot. Pre-fix this returned "Lunch"; post-fix it falls back to
    // time-of-day.
    expect(journalSlotFromMealTypes(["dessert"], at(8))).toBe("Breakfast");
    expect(journalSlotFromMealTypes(["aperitif"], at(19))).toBe("Dinner");
    expect(journalSlotFromMealTypes(["random"], at(13))).toBe("Lunch");
  });
});
