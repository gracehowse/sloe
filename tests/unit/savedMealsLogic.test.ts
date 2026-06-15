import { describe, expect, it } from "vitest";
import {
  buildMealEntriesFromSavedMeal,
  dominantSavedMealSource,
  effectivePortionMultiplier,
  summariseSavedMeal,
} from "@/lib/nutrition/savedMealsLogic";
import type { SavedMeal, SavedMealItem } from "@/lib/nutrition/savedMeals";

/** Build a SavedMeal quickly for test fixtures. */
function mkMeal(partial: Partial<SavedMeal> = {}): SavedMeal {
  return {
    id: "meal-1",
    name: "My usual breakfast",
    items: [],
    createdAt: "2026-04-17T08:00:00.000Z",
    logCount: 0,
    ...partial,
  };
}

function mkItem(partial: Partial<SavedMealItem> = {}): SavedMealItem {
  return {
    position: 0,
    recipeTitle: "Oatmeal",
    calories: 300,
    protein: 10,
    carbs: 50,
    fat: 6,
    ...partial,
  };
}

describe("summariseSavedMeal", () => {
  it("returns all zeroes for an empty items array", () => {
    const s = summariseSavedMeal(mkMeal({ items: [] }));
    expect(s).toEqual({
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      itemCount: 0,
    });
  });

  it("sums a single item one-to-one when portionMultiplier is missing", () => {
    const s = summariseSavedMeal(
      mkMeal({ items: [mkItem({ calories: 350, protein: 12, carbs: 55, fat: 7 })] }),
    );
    expect(s).toEqual({
      totalCalories: 350,
      totalProtein: 12,
      totalCarbs: 55,
      totalFat: 7,
      itemCount: 1,
    });
  });

  it("sums multiple items in one pass (no double-counting)", () => {
    const s = summariseSavedMeal(
      mkMeal({
        items: [
          mkItem({ position: 0, recipeTitle: "Oats", calories: 300, protein: 10, carbs: 50, fat: 6 }),
          mkItem({ position: 1, recipeTitle: "Berries", calories: 50, protein: 1, carbs: 12, fat: 0 }),
          mkItem({ position: 2, recipeTitle: "Protein powder", calories: 120, protein: 24, carbs: 3, fat: 2 }),
        ],
      }),
    );
    expect(s).toEqual({
      totalCalories: 470,
      totalProtein: 35,
      totalCarbs: 65,
      totalFat: 8,
      itemCount: 3,
    });
  });

  it("applies portionMultiplier per-item when scaling", () => {
    const s = summariseSavedMeal(
      mkMeal({
        items: [
          mkItem({
            position: 0,
            recipeTitle: "Oats",
            calories: 300,
            protein: 10,
            carbs: 50,
            fat: 6,
            portionMultiplier: 0.5,
          }),
          mkItem({
            position: 1,
            recipeTitle: "Protein powder",
            calories: 120,
            protein: 24,
            carbs: 3,
            fat: 2,
            portionMultiplier: 2,
          }),
        ],
      }),
    );
    // 300*0.5 + 120*2 = 150 + 240 = 390
    // 10*0.5 + 24*2 = 5 + 48 = 53
    expect(s.totalCalories).toBe(390);
    expect(s.totalProtein).toBe(53);
    expect(s.totalCarbs).toBeCloseTo(31, 5);
    expect(s.totalFat).toBe(7);
    expect(s.itemCount).toBe(2);
  });

  it("treats zero / negative / non-finite portionMultiplier as 1", () => {
    const s = summariseSavedMeal(
      mkMeal({
        items: [
          mkItem({ calories: 100, protein: 0, carbs: 0, fat: 0, portionMultiplier: 0 }),
          mkItem({ calories: 100, protein: 0, carbs: 0, fat: 0, portionMultiplier: -2 }),
          // @ts-expect-error runtime coercion
          mkItem({ calories: 100, protein: 0, carbs: 0, fat: 0, portionMultiplier: "nope" }),
        ],
      }),
    );
    expect(s.totalCalories).toBe(300); // all clamped to 1x
  });

  it("is tolerant of missing fiber/water (they don't leak into macro sums)", () => {
    const s = summariseSavedMeal(
      mkMeal({
        items: [
          mkItem({ calories: 200, protein: 10, carbs: 20, fat: 8 }), // no fiber/water
          mkItem({ calories: 50, protein: 1, carbs: 12, fat: 0, fiber: 4, waterMl: 200 }),
        ],
      }),
    );
    expect(s.totalCalories).toBe(250);
    expect(s.totalProtein).toBe(11);
    expect(s.totalCarbs).toBe(32);
    expect(s.totalFat).toBe(8);
    expect(s.itemCount).toBe(2);
    // Summary has no fiber/water fields — this is by design (the card
    // shows kcal + P/C/F only). Confirm the keys don't sneak in.
    expect(Object.keys(s).sort()).toEqual([
      "itemCount",
      "totalCalories",
      "totalCarbs",
      "totalFat",
      "totalProtein",
    ]);
  });

  it("defends against non-array items", () => {
    // @ts-expect-error runtime coercion — guard against bad DB rows
    expect(summariseSavedMeal(mkMeal({ items: null }))).toEqual({
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      itemCount: 0,
    });
  });
});

describe("effectivePortionMultiplier", () => {
  it("returns 1 for missing / non-finite / zero / negative, and passes through positive", () => {
    expect(effectivePortionMultiplier(mkItem({ portionMultiplier: undefined }))).toBe(1);
    expect(effectivePortionMultiplier(mkItem({ portionMultiplier: 0 }))).toBe(1);
    expect(effectivePortionMultiplier(mkItem({ portionMultiplier: -0.5 }))).toBe(1);
    // @ts-expect-error runtime coercion
    expect(effectivePortionMultiplier(mkItem({ portionMultiplier: "x" }))).toBe(1);
    expect(effectivePortionMultiplier(mkItem({ portionMultiplier: 0.5 }))).toBe(0.5);
    expect(effectivePortionMultiplier(mkItem({ portionMultiplier: 2 }))).toBe(2);
  });
});

describe("buildMealEntriesFromSavedMeal", () => {
  function makeCounterId() {
    let n = 0;
    return () => `id-${++n}`;
  }

  it("produces exactly items.length entries, each with a fresh id", () => {
    const makeId = makeCounterId();
    const entries = buildMealEntriesFromSavedMeal(
      mkMeal({
        items: [
          mkItem({ position: 0, recipeTitle: "A", calories: 100, protein: 5, carbs: 10, fat: 1 }),
          mkItem({ position: 1, recipeTitle: "B", calories: 200, protein: 10, carbs: 20, fat: 2 }),
          mkItem({ position: 2, recipeTitle: "C", calories: 300, protein: 15, carbs: 30, fat: 3 }),
        ],
      }),
      "Breakfast",
      "8:05 AM",
      makeId,
    );
    expect(entries).toHaveLength(3);
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual(["id-1", "id-2", "id-3"]);
  });

  it("propagates slot and timeLabel to every entry", () => {
    const entries = buildMealEntriesFromSavedMeal(
      mkMeal({ items: [mkItem(), mkItem({ position: 1, recipeTitle: "Berries" })] }),
      "Lunch",
      "12:30 PM",
      makeCounterId(),
    );
    for (const e of entries) {
      expect(e.name).toBe("Lunch");
      expect(e.time).toBe("12:30 PM");
    }
  });

  it("uses each item's recipeTitle (not the parent's name) on the entry", () => {
    const entries = buildMealEntriesFromSavedMeal(
      mkMeal({
        name: "My usual breakfast",
        items: [
          mkItem({ position: 0, recipeTitle: "Oatmeal" }),
          mkItem({ position: 1, recipeTitle: "Blueberries" }),
        ],
      }),
      "Breakfast",
      "8:00",
      makeCounterId(),
    );
    expect(entries.map((e) => e.recipeTitle)).toEqual(["Oatmeal", "Blueberries"]);
  });

  it("falls back to meal.name when an item has an empty title", () => {
    const entries = buildMealEntriesFromSavedMeal(
      mkMeal({
        name: "Dinner combo",
        items: [mkItem({ recipeTitle: "   " })],
      }),
      "Dinner",
      "7:00 PM",
      makeCounterId(),
    );
    expect(entries[0]!.recipeTitle).toBe("Dinner combo");
  });

  it("applies portionMultiplier per-item on the output macros and then normalises output portionMultiplier to 1", () => {
    const [entry] = buildMealEntriesFromSavedMeal(
      mkMeal({
        items: [
          mkItem({
            calories: 300,
            protein: 10,
            carbs: 50,
            fat: 6,
            portionMultiplier: 0.5,
            fiber: 8,
            waterMl: 200,
          }),
        ],
      }),
      "Breakfast",
      "8:00",
      makeCounterId(),
    );
    expect(entry!.calories).toBe(150);
    expect(entry!.protein).toBe(5);
    expect(entry!.carbs).toBe(25);
    expect(entry!.fat).toBe(3);
    expect(entry!.fiberG).toBe(4);
    expect(entry!.waterMl).toBe(100);
    // Already-scaled macros must never be multiplied again downstream.
    expect(entry!.portionMultiplier).toBe(1);
  });

  it("propagates source and sourceId when present, omits them otherwise", () => {
    const entries = buildMealEntriesFromSavedMeal(
      mkMeal({
        items: [
          mkItem({ source: "USDA", sourceId: "fdc-123" }),
          mkItem({ position: 1 }),
        ],
      }),
      "Breakfast",
      "8:00",
      makeCounterId(),
    );
    expect(entries[0]!.source).toBe("USDA");
    expect(entries[0]!.sourceId).toBe("fdc-123");
    expect(entries[1]!.source).toBeUndefined();
    expect(entries[1]!.sourceId).toBeUndefined();
  });

  it("returns an empty array for an empty combo and never calls makeId", () => {
    let calls = 0;
    const makeId = () => {
      calls += 1;
      return `id-${calls}`;
    };
    const entries = buildMealEntriesFromSavedMeal(
      mkMeal({ items: [] }),
      "Breakfast",
      "8:00",
      makeId,
    );
    expect(entries).toEqual([]);
    expect(calls).toBe(0);
  });

  // ENG-783 — meal-level portion (the saved-meal portion-confirm sheet).
  describe("mealPortionMultiplier (ENG-783)", () => {
    const baseMeal = () =>
      mkMeal({
        items: [
          mkItem({ calories: 300, protein: 10, carbs: 50, fat: 6, fiber: 8, waterMl: 200 }),
          mkItem({ position: 1, recipeTitle: "Berries", calories: 50, protein: 1, carbs: 12, fat: 0 }),
        ],
      });

    it("propagates nutritionMicros scaled by portion multiplier", () => {
      const meal = mkMeal({
        items: [
          mkItem({
            nutritionMicros: { sodiumMg: 100, sugarG: 5 },
            portionMultiplier: 2,
          }),
        ],
      });
      const [entry] = buildMealEntriesFromSavedMeal(meal, "Lunch", "12:00", makeCounterId());
      expect(entry.micros).toEqual({ sodiumMg: 200, sugarG: 10 });
    });

    it("defaults to 1x — omitting the param is byte-identical to the 4-arg call (one-tap hot path)", () => {
      const fourArg = buildMealEntriesFromSavedMeal(baseMeal(), "Breakfast", "8:00", makeCounterId());
      const explicitOne = buildMealEntriesFromSavedMeal(baseMeal(), "Breakfast", "8:00", makeCounterId(), 1);
      expect(explicitOne).toEqual(fourArg);
      expect(fourArg[0]!.calories).toBe(300);
      expect(fourArg[1]!.calories).toBe(50);
    });

    it("scales the whole combo's macros (and fiber/water) by the meal multiplier", () => {
      const entries = buildMealEntriesFromSavedMeal(baseMeal(), "Breakfast", "8:00", makeCounterId(), 2);
      // Item 1: 300/10/50/6 *2 → 600/20/100/12; fiber 8*2=16, water 200*2=400
      expect(entries[0]!.calories).toBe(600);
      expect(entries[0]!.protein).toBe(20);
      expect(entries[0]!.carbs).toBe(100);
      expect(entries[0]!.fat).toBe(12);
      expect(entries[0]!.fiberG).toBe(16);
      expect(entries[0]!.waterMl).toBe(400);
      // Item 2: 50/1/12/0 *2 → 100/2/24/0
      expect(entries[1]!.calories).toBe(100);
      expect(entries[1]!.carbs).toBe(24);
      // Output portionMultiplier stays 1 — macros already baked, no double-count.
      expect(entries[0]!.portionMultiplier).toBe(1);
      expect(entries[1]!.portionMultiplier).toBe(1);
    });

    it("stacks on top of each item's own portionMultiplier (does not replace it)", () => {
      const meal = mkMeal({
        items: [mkItem({ calories: 300, protein: 10, carbs: 50, fat: 6, portionMultiplier: 0.5 })],
      });
      // item pm 0.5 * meal 2 = 1.0 → 300/10/50/6 unchanged
      const entries = buildMealEntriesFromSavedMeal(meal, "Lunch", "12:00", makeCounterId(), 2);
      expect(entries[0]!.calories).toBe(300);
      expect(entries[0]!.protein).toBe(10);
    });

    it("treats zero / negative / non-finite meal multipliers as 1 (never zero out a log)", () => {
      const at = (mult: number) =>
        buildMealEntriesFromSavedMeal(baseMeal(), "Breakfast", "8:00", makeCounterId(), mult)[0]!.calories;
      expect(at(0)).toBe(300);
      expect(at(-3)).toBe(300);
      expect(at(Number.NaN)).toBe(300);
      expect(at(Number.POSITIVE_INFINITY)).toBe(300);
    });

    it("supports a fractional meal portion (half a saved meal)", () => {
      const entries = buildMealEntriesFromSavedMeal(baseMeal(), "Dinner", "7:00 PM", makeCounterId(), 0.5);
      expect(entries[0]!.calories).toBe(150);
      expect(entries[1]!.calories).toBe(25);
    });
  });
});

describe("dominantSavedMealSource (audit 2026-04-30 fix #B7)", () => {
  it("returns 'manual' for an empty meal", () => {
    expect(dominantSavedMealSource(mkMeal({ items: [] }))).toBe("manual");
  });

  it("returns 'manual' when no item carries source metadata", () => {
    expect(
      dominantSavedMealSource(
        mkMeal({ items: [mkItem({ source: undefined }), mkItem({ source: undefined })] }),
      ),
    ).toBe("manual");
  });

  it("returns the single item's source key", () => {
    expect(
      dominantSavedMealSource(mkMeal({ items: [mkItem({ source: "USDA" })] })),
    ).toBe("usda");
    expect(
      dominantSavedMealSource(mkMeal({ items: [mkItem({ source: "OFF" })] })),
    ).toBe("off");
    expect(
      dominantSavedMealSource(mkMeal({ items: [mkItem({ source: "FatSecret" })] })),
    ).toBe("fatsecret");
    expect(
      dominantSavedMealSource(mkMeal({ items: [mkItem({ source: "AI photo" })] })),
    ).toBe("ai");
    expect(
      dominantSavedMealSource(mkMeal({ items: [mkItem({ source: "Custom" })] })),
    ).toBe("manual");
  });

  it("returns the most-cited source when items disagree", () => {
    const meal = mkMeal({
      items: [
        mkItem({ source: "USDA", position: 0 }),
        mkItem({ source: "USDA", position: 1 }),
        mkItem({ source: "OFF", position: 2 }),
      ],
    });
    expect(dominantSavedMealSource(meal)).toBe("usda");
  });

  it("breaks ties in favour of the first item's source (deterministic)", () => {
    // 1 USDA, 1 OFF — same count. Item-order tie-break → first wins.
    const usdaFirst = mkMeal({
      items: [
        mkItem({ source: "USDA", position: 0 }),
        mkItem({ source: "OFF", position: 1 }),
      ],
    });
    expect(dominantSavedMealSource(usdaFirst)).toBe("usda");

    const offFirst = mkMeal({
      items: [
        mkItem({ source: "OFF", position: 0 }),
        mkItem({ source: "USDA", position: 1 }),
      ],
    });
    expect(dominantSavedMealSource(offFirst)).toBe("off");
  });

  it("folds variant labels via mapMealSourceToDot before tallying", () => {
    // "Open Food Facts", "OFF", "OpenFoodFacts" all → off — must
    // tally as the same key.
    const meal = mkMeal({
      items: [
        mkItem({ source: "Open Food Facts", position: 0 }),
        mkItem({ source: "OFF", position: 1 }),
        mkItem({ source: "USDA", position: 2 }),
      ],
    });
    expect(dominantSavedMealSource(meal)).toBe("off");
  });

  it("survives malformed items array (defensive null/undefined)", () => {
    // The function tolerates `items: null` (some legacy fixtures).
    const malformed = { ...mkMeal({}), items: null as unknown as SavedMealItem[] };
    expect(dominantSavedMealSource(malformed)).toBe("manual");
  });
});
