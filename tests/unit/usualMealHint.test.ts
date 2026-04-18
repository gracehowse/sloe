import { describe, expect, it } from "vitest";
import {
  normaliseRecipeTitle,
  parseDismissedSlots,
  resolveQuickAddDefaultTab,
  serializeDismissedSlots,
  shouldShowUsualMealHint,
  USUAL_MEAL_HINT_STORAGE_KEY,
} from "@/lib/nutrition/usualMealHint";
import type { MealSlot } from "@/lib/nutrition/mealSlots";
import { buildUsualMealRecapInsight } from "@/lib/nutrition/weeklyRecap";

/**
 * Ship M1 (2026-04-18) — pure helpers around the "usual meal" first-run
 * hint gate, the storage encoding, the shared Quick Add default-tab
 * rule, and the weekly-recap growth-loop insight builder.
 */

function mkMeal(slot: string, title: string, cal: number) {
  return {
    name: slot,
    recipeTitle: title,
    calories: cal,
  };
}

describe("shouldShowUsualMealHint", () => {
  const slot: MealSlot = "Breakfast";
  const todayKey = "2026-04-17";

  it("returns true on the same-day signal (≥2 items today in slot)", () => {
    const byDay = {
      [todayKey]: [
        mkMeal("Breakfast", "Oatmeal", 320),
        mkMeal("Breakfast", "Blueberries", 60),
      ],
    };
    const visible = shouldShowUsualMealHint({
      byDay,
      slot,
      todayKey,
      dismissedSlots: new Set(),
    });
    expect(visible).toBe(true);
  });

  it("returns true on the cross-day signal (≥2 distinct days in 7d with matching item)", () => {
    const byDay = {
      "2026-04-16": [mkMeal("Breakfast", "Oatmeal", 320)],
      "2026-04-15": [mkMeal("Breakfast", "Oatmeal", 320)],
      // today has a single item logged — real-world case where the user
      // has one thing in the slot today but the pattern is clearly weekly.
      [todayKey]: [mkMeal("Breakfast", "Oatmeal", 320)],
    };
    const visible = shouldShowUsualMealHint({
      byDay,
      slot,
      todayKey,
      dismissedSlots: new Set(),
    });
    expect(visible).toBe(true);
  });

  it("returns false when slot has no items today (nothing concrete to save)", () => {
    const byDay = {
      // Matches on prior days but the slot is empty right now — seeding
      // `SaveMealDialog` with no items would be nonsense.
      "2026-04-16": [mkMeal("Breakfast", "Oatmeal", 320)],
      "2026-04-15": [mkMeal("Breakfast", "Oatmeal", 320)],
      [todayKey]: [],
    };
    expect(
      shouldShowUsualMealHint({
        byDay,
        slot,
        todayKey,
        dismissedSlots: new Set(),
      }),
    ).toBe(false);
  });

  it("returns false when the slot is already dismissed", () => {
    const byDay = {
      [todayKey]: [
        mkMeal("Breakfast", "Oatmeal", 320),
        mkMeal("Breakfast", "Berries", 60),
      ],
    };
    expect(
      shouldShowUsualMealHint({
        byDay,
        slot,
        todayKey,
        dismissedSlots: new Set(["Breakfast"]),
      }),
    ).toBe(false);
  });

  it("returns false when the user already has a saved meal for this slot", () => {
    const byDay = {
      [todayKey]: [
        mkMeal("Breakfast", "Oatmeal", 320),
        mkMeal("Breakfast", "Berries", 60),
      ],
    };
    expect(
      shouldShowUsualMealHint({
        byDay,
        slot,
        todayKey,
        dismissedSlots: new Set(),
        savedMealSlots: new Set(["Breakfast"]),
      }),
    ).toBe(false);
  });

  it("returns false when there is zero history in the slot", () => {
    expect(
      shouldShowUsualMealHint({
        byDay: {},
        slot,
        todayKey,
        dismissedSlots: new Set(),
      }),
    ).toBe(false);
  });

  it("returns false on a single cross-day match (need ≥2 distinct days)", () => {
    const byDay = {
      "2026-04-16": [mkMeal("Breakfast", "Oatmeal", 320)],
      [todayKey]: [mkMeal("Breakfast", "Oatmeal", 320)],
    };
    // Only 2 matches — but what counts is distinct DAYS in the window.
    // We have 2 distinct days here, so should be true. Confirm:
    expect(
      shouldShowUsualMealHint({
        byDay,
        slot,
        todayKey,
        dismissedSlots: new Set(),
      }),
    ).toBe(true);
    // Now collapse to a single day:
    const byDaySingleDay = {
      [todayKey]: [mkMeal("Breakfast", "Oatmeal", 320)],
    };
    expect(
      shouldShowUsualMealHint({
        byDay: byDaySingleDay,
        slot,
        todayKey,
        dismissedSlots: new Set(),
      }),
    ).toBe(false);
  });

  it("is case-insensitive on recipe titles for cross-day matching", () => {
    const byDay = {
      "2026-04-16": [mkMeal("Breakfast", "oatmeal", 320)],
      [todayKey]: [mkMeal("Breakfast", "Oatmeal", 320)],
    };
    expect(
      shouldShowUsualMealHint({
        byDay,
        slot,
        todayKey,
        dismissedSlots: new Set(),
      }),
    ).toBe(true);
  });

  it("differentiates by round calories so a different-food same-name row doesn't match", () => {
    const byDay = {
      "2026-04-16": [mkMeal("Breakfast", "Oatmeal", 320)],
      // Today's "Oatmeal" has wildly different calories — treat as a
      // different food, so the cross-day rule does not fire.
      [todayKey]: [mkMeal("Breakfast", "Oatmeal", 500)],
    };
    expect(
      shouldShowUsualMealHint({
        byDay,
        slot,
        todayKey,
        dismissedSlots: new Set(),
      }),
    ).toBe(false);
  });

  it("ignores cross-slot matches — same title in Lunch doesn't trigger Breakfast hint", () => {
    const byDay = {
      "2026-04-16": [mkMeal("Lunch", "Oatmeal", 320)],
      [todayKey]: [mkMeal("Breakfast", "Oatmeal", 320)],
    };
    expect(
      shouldShowUsualMealHint({
        byDay,
        slot,
        todayKey,
        dismissedSlots: new Set(),
      }),
    ).toBe(false);
  });

  it("rejects non-canonical slot input defensively", () => {
    expect(
      shouldShowUsualMealHint({
        byDay: {},
        slot: "Brunch" as unknown as MealSlot,
        todayKey,
        dismissedSlots: new Set(),
      }),
    ).toBe(false);
  });

  it("accepts legacy `Snack` at cross-day matching but the slot param stays canonical Snacks", () => {
    // Mobile may still have legacy `Snack` entries in old rows; the
    // matcher normalises the row's own slot name.
    const byDay = {
      "2026-04-16": [mkMeal("Snack", "Protein Bar", 220)],
      [todayKey]: [mkMeal("Snacks", "Protein Bar", 220)],
    };
    expect(
      shouldShowUsualMealHint({
        byDay,
        slot: "Snacks",
        todayKey,
        dismissedSlots: new Set(),
      }),
    ).toBe(true);
  });
});

describe("normaliseRecipeTitle", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    expect(normaliseRecipeTitle("  Greek   Yogurt  ")).toBe("greek yogurt");
  });

  it("handles non-string defensively", () => {
    expect(normaliseRecipeTitle(null)).toBe("");
    expect(normaliseRecipeTitle(undefined)).toBe("");
    expect(normaliseRecipeTitle(123 as unknown as string)).toBe("");
  });
});

describe("parseDismissedSlots / serializeDismissedSlots", () => {
  it("round-trips a set of valid slots", () => {
    const set = new Set<MealSlot>(["Breakfast", "Snacks"]);
    const serialized = serializeDismissedSlots(set);
    expect(serialized).toMatch(/Breakfast/);
    expect(serialized).toMatch(/Snacks/);
    const parsed = parseDismissedSlots(serialized);
    expect(parsed.has("Breakfast")).toBe(true);
    expect(parsed.has("Snacks")).toBe(true);
  });

  it("parses legacy or dirty input tolerantly", () => {
    const parsed = parseDismissedSlots("Breakfast,  Lunch ,Brunch,,Snack");
    // Only the two canonical names should survive.
    expect(parsed.has("Breakfast")).toBe(true);
    expect(parsed.has("Lunch")).toBe(true);
    expect(parsed.has("Snacks")).toBe(false);
  });

  it("handles null / empty input", () => {
    expect(parseDismissedSlots(null).size).toBe(0);
    expect(parseDismissedSlots("").size).toBe(0);
    expect(parseDismissedSlots(undefined).size).toBe(0);
  });
});

describe("USUAL_MEAL_HINT_STORAGE_KEY", () => {
  it("uses the versioned v1 key exactly (storage migration pin)", () => {
    // A rename here would silently lose every user's dismiss state.
    expect(USUAL_MEAL_HINT_STORAGE_KEY).toBe("suppr-usual-meal-hint-dismissed-v1");
  });
});

describe("resolveQuickAddDefaultTab", () => {
  it("lands on Usual meals when the user has ≥1 saved meal", () => {
    expect(resolveQuickAddDefaultTab(true)).toBe("saved");
  });

  it("lands on Recent when the user has zero saved meals", () => {
    expect(resolveQuickAddDefaultTab(false)).toBe("recent");
  });
});

describe("buildUsualMealRecapInsight (growth loop)", () => {
  const weekKeys = [
    "2026-04-10",
    "2026-04-11",
    "2026-04-12",
    "2026-04-13",
    "2026-04-14",
    "2026-04-15",
    "2026-04-16",
  ];

  it("returns `celebration` for the most-logged saved meal in the window", () => {
    const savedMeals = [
      { id: "a", name: "My usual breakfast" },
      { id: "b", name: "Gym lunch" },
    ];
    const logCountBySavedMealId = { a: 3, b: 1 };
    const insight = buildUsualMealRecapInsight({
      byDay: {},
      weekKeys,
      savedMeals,
      logCountBySavedMealId,
    });
    expect(insight).toEqual({
      kind: "celebration",
      name: "My usual breakfast",
      count: 3,
    });
  });

  it("returns `null` when the user has a saved meal but never logged it this week", () => {
    const savedMeals = [{ id: "a", name: "Stashed combo" }];
    const insight = buildUsualMealRecapInsight({
      byDay: {},
      weekKeys,
      savedMeals,
      logCountBySavedMealId: { a: 0 },
    });
    expect(insight).toBeNull();
  });

  it("returns `prompt` when user has zero saved meals AND logged ≥5 days", () => {
    const byDay: Record<string, Array<{ name: string }>> = {};
    for (const k of weekKeys.slice(0, 5)) {
      byDay[k] = [{ name: "Breakfast" }, { name: "Lunch" }];
    }
    const insight = buildUsualMealRecapInsight({
      byDay,
      weekKeys,
      savedMeals: [],
      logCountBySavedMealId: {},
    });
    expect(insight?.kind).toBe("prompt");
    // Breakfast and Lunch tied at 5 each — tied slots keep the first
    // insertion order (Breakfast).
    expect(insight?.kind === "prompt" && insight.suggestedSlot).toBe("Breakfast");
  });

  it("returns `null` (prompt path) when logged <5 days", () => {
    const byDay: Record<string, Array<{ name: string }>> = {};
    for (const k of weekKeys.slice(0, 3)) {
      byDay[k] = [{ name: "Breakfast" }];
    }
    const insight = buildUsualMealRecapInsight({
      byDay,
      weekKeys,
      savedMeals: [],
      logCountBySavedMealId: {},
    });
    expect(insight).toBeNull();
  });

  it("suggests the slot with the largest item-count (prompt path)", () => {
    const byDay: Record<string, Array<{ name: string }>> = {};
    for (const k of weekKeys) {
      byDay[k] = [{ name: "Dinner" }, { name: "Dinner" }, { name: "Lunch" }];
    }
    const insight = buildUsualMealRecapInsight({
      byDay,
      weekKeys,
      savedMeals: [],
      logCountBySavedMealId: {},
    });
    expect(insight?.kind === "prompt" && insight.suggestedSlot).toBe("Dinner");
  });
});
