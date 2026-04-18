import { describe, expect, it } from "vitest";
import {
  normaliseRecipeTitle,
  parseDismissedSlots,
  resolveQuickAddDefaultTab,
  selectMostFrequentSlotSeed,
  serializeDismissedSlots,
  shouldShowUsualMealHint,
  USUAL_MEAL_HINT_STORAGE_KEY,
} from "@/lib/nutrition/usualMealHint";
import type { MealSlot } from "@/lib/nutrition/mealSlots";
import { buildUsualMealRecapInsight } from "@/lib/nutrition/weeklyRecap";
import type { FoodHistoryMealLike } from "@/lib/nutrition/foodHistory";

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

/**
 * Post-ship #4 (2026-04-18) — deep-link seed for the weekly-recap
 * "Save your usual" CTA. `selectMostFrequentSlotSeed` is the pure
 * helper that picks which slot + which 2–4 items the SaveMealDialog
 * pre-fills when the user taps the prompt. Covers:
 *   - 3 cross-day same-slot matches → returns that slot + items
 *   - no clustering (single-day history) → null
 *   - ties → deterministic (canonical slot order; most-recent wins
 *     inside a slot)
 *   - `slotPreference` override honoured when it qualifies
 */

/** Build a minimal meal row with the macros set — `computeFrequentMeals`
 *  needs calories/protein/etc for the bucket shape. */
function mkSeedMeal(
  slot: string,
  title: string,
  calories: number,
  protein = 10,
): FoodHistoryMealLike & { name: string } {
  return {
    name: slot,
    recipeTitle: title,
    calories,
    protein,
    carbs: 0,
    fat: 0,
  };
}

describe("selectMostFrequentSlotSeed", () => {
  it("returns the seeded slot with ≥2 items when 3 cross-day same-slot matches exist", () => {
    const byDay = {
      "2026-04-10": [
        mkSeedMeal("Breakfast", "Oatmeal", 320),
        mkSeedMeal("Breakfast", "Blueberries", 60),
        mkSeedMeal("Breakfast", "Protein powder", 120),
      ],
      "2026-04-11": [
        mkSeedMeal("Breakfast", "Oatmeal", 320),
        mkSeedMeal("Breakfast", "Blueberries", 60),
        mkSeedMeal("Breakfast", "Protein powder", 120),
      ],
      "2026-04-12": [
        mkSeedMeal("Breakfast", "Oatmeal", 320),
        mkSeedMeal("Breakfast", "Blueberries", 60),
        mkSeedMeal("Breakfast", "Protein powder", 120),
      ],
    };
    const seed = selectMostFrequentSlotSeed(byDay);
    expect(seed).not.toBeNull();
    expect(seed!.slot).toBe("Breakfast");
    expect(seed!.seedItems.length).toBeGreaterThanOrEqual(2);
    expect(seed!.seedItems.length).toBeLessThanOrEqual(4);
    // Every seed item must come from the user's real history.
    const titles = seed!.seedItems.map((i) => i.recipeTitle);
    for (const t of titles) expect(["Oatmeal", "Blueberries", "Protein powder"]).toContain(t);
    // Ordered by count desc; all three items logged 3× so any permutation
    // is acceptable as long as no item appears twice.
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("returns null when items don't cluster (single-day-only history)", () => {
    const byDay = {
      "2026-04-12": [
        mkSeedMeal("Breakfast", "Oatmeal", 320),
        mkSeedMeal("Breakfast", "Blueberries", 60),
      ],
    };
    // Each item appears on exactly 1 day → no repeat-signal, helper
    // refuses to seed. The card falls back to route-to-Today.
    const seed = selectMostFrequentSlotSeed(byDay);
    expect(seed).toBeNull();
  });

  it("returns null when only one item in a slot clusters (need ≥2 qualifying items)", () => {
    const byDay = {
      "2026-04-10": [mkSeedMeal("Breakfast", "Oatmeal", 320)],
      "2026-04-11": [mkSeedMeal("Breakfast", "Oatmeal", 320)],
      "2026-04-12": [mkSeedMeal("Breakfast", "Oatmeal", 320)],
    };
    // "Oatmeal" has count 3 but it's the only item → below MIN_SEED_ITEMS.
    expect(selectMostFrequentSlotSeed(byDay)).toBeNull();
  });

  it("returns null for an empty byDay", () => {
    expect(selectMostFrequentSlotSeed({})).toBeNull();
  });

  it("defensively handles null / non-object input", () => {
    expect(
      selectMostFrequentSlotSeed(null as unknown as Record<string, FoodHistoryMealLike[]>),
    ).toBeNull();
  });

  it("honours `slotPreference` when that slot qualifies", () => {
    const byDay = {
      "2026-04-10": [
        mkSeedMeal("Breakfast", "Oatmeal", 320),
        mkSeedMeal("Breakfast", "Blueberries", 60),
        mkSeedMeal("Dinner", "Chicken", 420),
        mkSeedMeal("Dinner", "Rice", 200),
      ],
      "2026-04-11": [
        mkSeedMeal("Breakfast", "Oatmeal", 320),
        mkSeedMeal("Breakfast", "Blueberries", 60),
        mkSeedMeal("Dinner", "Chicken", 420),
        mkSeedMeal("Dinner", "Rice", 200),
      ],
    };
    // Both slots qualify; without a preference the auto-picker wins.
    const autoSeed = selectMostFrequentSlotSeed(byDay);
    expect(autoSeed).not.toBeNull();
    // With slotPreference=Dinner, the helper must return Dinner.
    const dinnerSeed = selectMostFrequentSlotSeed(byDay, "Dinner");
    expect(dinnerSeed?.slot).toBe("Dinner");
    const dinnerTitles = new Set(dinnerSeed!.seedItems.map((i) => i.recipeTitle));
    expect(dinnerTitles.has("Chicken")).toBe(true);
    expect(dinnerTitles.has("Rice")).toBe(true);
  });

  it("falls back to auto-pick when `slotPreference` is unknown or doesn't qualify", () => {
    const byDay = {
      "2026-04-10": [
        mkSeedMeal("Breakfast", "Oatmeal", 320),
        mkSeedMeal("Breakfast", "Blueberries", 60),
      ],
      "2026-04-11": [
        mkSeedMeal("Breakfast", "Oatmeal", 320),
        mkSeedMeal("Breakfast", "Blueberries", 60),
      ],
      // Lunch has only a single occurrence — doesn't qualify.
      "2026-04-12": [mkSeedMeal("Lunch", "Sandwich", 400)],
    };
    const seed = selectMostFrequentSlotSeed(byDay, "Lunch");
    expect(seed?.slot).toBe("Breakfast");
  });

  it("treats case-insensitive + legacy slot names consistently", () => {
    const byDay = {
      "2026-04-10": [
        // Legacy singular `"Snack"` — normaliser maps this to Snacks.
        mkSeedMeal("snack", "Protein bar", 220),
        mkSeedMeal("Snacks", "Almonds", 170),
      ],
      "2026-04-11": [
        mkSeedMeal("SNACKS", "Protein bar", 220),
        mkSeedMeal("Snacks", "Almonds", 170),
      ],
    };
    const seed = selectMostFrequentSlotSeed(byDay);
    expect(seed?.slot).toBe("Snacks");
    const titles = new Set(seed!.seedItems.map((i) => i.recipeTitle));
    expect(titles.has("Protein bar")).toBe(true);
    expect(titles.has("Almonds")).toBe(true);
  });

  it("is deterministic on slot ties — canonical slot order wins", () => {
    // Breakfast and Lunch both have 2 items each logged on 2 days.
    const byDay = {
      "2026-04-10": [
        mkSeedMeal("Breakfast", "Oats", 300),
        mkSeedMeal("Breakfast", "Berries", 60),
        mkSeedMeal("Lunch", "Salad", 300),
        mkSeedMeal("Lunch", "Chicken", 220),
      ],
      "2026-04-11": [
        mkSeedMeal("Breakfast", "Oats", 300),
        mkSeedMeal("Breakfast", "Berries", 60),
        mkSeedMeal("Lunch", "Salad", 300),
        mkSeedMeal("Lunch", "Chicken", 220),
      ],
    };
    // Ties broken by canonical slot order — Breakfast comes first.
    const seed1 = selectMostFrequentSlotSeed(byDay);
    const seed2 = selectMostFrequentSlotSeed(byDay);
    expect(seed1?.slot).toBe("Breakfast");
    // Re-running yields the same result (determinism).
    expect(seed2?.slot).toBe(seed1?.slot);
  });

  it("orders items by count desc (most-frequent wins)", () => {
    const byDay = {
      "2026-04-09": [
        mkSeedMeal("Breakfast", "Oats", 300),
        mkSeedMeal("Breakfast", "Berries", 60),
      ],
      "2026-04-10": [
        mkSeedMeal("Breakfast", "Oats", 300),
        mkSeedMeal("Breakfast", "Berries", 60),
      ],
      "2026-04-11": [
        mkSeedMeal("Breakfast", "Oats", 300),
        // Berries skipped on this day — Oats now has count 3 vs 2.
      ],
      "2026-04-12": [
        mkSeedMeal("Breakfast", "Oats", 300),
        mkSeedMeal("Breakfast", "Berries", 60),
      ],
    };
    const seed = selectMostFrequentSlotSeed(byDay);
    expect(seed?.slot).toBe("Breakfast");
    // "Oats" (count 4) must be ordered before "Berries" (count 3).
    expect(seed!.seedItems[0].recipeTitle).toBe("Oats");
    expect(seed!.seedItems[1].recipeTitle).toBe("Berries");
  });

  it("caps the seed at 4 items even when a slot has more qualifying entries", () => {
    const titles = ["Oats", "Berries", "Protein", "Milk", "Banana", "Yogurt"];
    const byDay: Record<string, Array<FoodHistoryMealLike & { name: string }>> = {};
    for (let d = 10; d <= 12; d += 1) {
      const key = `2026-04-${d}`;
      byDay[key] = titles.map((t, i) => mkSeedMeal("Breakfast", t, 100 + i * 10));
    }
    const seed = selectMostFrequentSlotSeed(byDay);
    expect(seed?.slot).toBe("Breakfast");
    // Cap is MAX_SEED_ITEMS = 4.
    expect(seed!.seedItems.length).toBe(4);
  });

  it("never seeds an item the user didn't log", () => {
    const byDay = {
      "2026-04-10": [
        mkSeedMeal("Breakfast", "Oats", 300),
        mkSeedMeal("Breakfast", "Berries", 60),
      ],
      "2026-04-11": [
        mkSeedMeal("Breakfast", "Oats", 300),
        mkSeedMeal("Breakfast", "Berries", 60),
      ],
    };
    const seed = selectMostFrequentSlotSeed(byDay);
    const allLogged = new Set(["Oats", "Berries"]);
    for (const item of seed!.seedItems) {
      expect(allLogged.has(item.recipeTitle)).toBe(true);
    }
  });
});
