import { describe, expect, it } from "vitest";
import {
  computeEatAgainForSlot,
  computeFrequentMeals,
  computeRecentMeals,
  foodHistoryKey,
  isAiSourcedFoodHistoryItem,
  type FoodHistoryMealLike,
} from "@/lib/nutrition/foodHistory";
import {
  AI_PHOTO_SOURCE,
  AI_VOICE_SOURCE,
} from "@/lib/nutrition/aiLogging";

type M = FoodHistoryMealLike & { name?: string };

/** Helper: build a meal quickly. */
function meal(title: string, calories: number, extras: Partial<M> = {}): M {
  return {
    recipeTitle: title,
    calories,
    protein: extras.protein ?? 10,
    carbs: extras.carbs ?? 20,
    fat: extras.fat ?? 5,
    ...extras,
  };
}

describe("foodHistoryKey", () => {
  it("lowercases the title and rounds calories to match the DB unique index", () => {
    expect(foodHistoryKey("Oatmeal", 350)).toBe("oatmeal|350");
    expect(foodHistoryKey("OATMEAL", 350.4)).toBe("oatmeal|350");
    expect(foodHistoryKey("  Oatmeal  ", 350.6)).toBe("oatmeal|351");
  });
});

describe("computeFrequentMeals", () => {
  it("returns [] for empty input", () => {
    expect(computeFrequentMeals({})).toEqual([]);
    expect(computeFrequentMeals({ "2026-04-14": [] })).toEqual([]);
  });

  it("one meal -> count 1", () => {
    const out = computeFrequentMeals({ "2026-04-14": [meal("Oatmeal", 350)] });
    expect(out).toHaveLength(1);
    expect(out[0]!.recipeTitle).toBe("Oatmeal");
    expect(out[0]!.count).toBe(1);
    expect(out[0]!.calories).toBe(350);
  });

  it("same meal logged 5 times across days -> count 5 and macros averaged", () => {
    const byDay = {
      "2026-04-10": [meal("Oatmeal", 350, { protein: 10 })],
      "2026-04-11": [meal("Oatmeal", 350, { protein: 12 })],
      "2026-04-12": [meal("Oatmeal", 350, { protein: 10 })],
      "2026-04-13": [meal("Oatmeal", 350, { protein: 8 })],
      "2026-04-14": [meal("Oatmeal", 350, { protein: 10 })],
    };
    const out = computeFrequentMeals(byDay);
    expect(out).toHaveLength(1);
    expect(out[0]!.count).toBe(5);
    // (10+12+10+8+10)/5 = 10
    expect(out[0]!.protein).toBe(10);
  });

  it("same title with different calories is kept as two buckets", () => {
    const byDay = {
      "2026-04-14": [meal("Oatmeal", 350), meal("Oatmeal", 500)],
    };
    const out = computeFrequentMeals(byDay);
    expect(out).toHaveLength(2);
    const titles = out.map((o) => `${o.recipeTitle}|${o.calories}`);
    expect(titles).toContain("Oatmeal|350");
    expect(titles).toContain("Oatmeal|500");
  });

  it("case-insensitive dedupe: 'Oatmeal' and 'oatmeal' collapse into one", () => {
    const byDay = {
      "2026-04-14": [meal("Oatmeal", 350), meal("oatmeal", 350)],
    };
    const out = computeFrequentMeals(byDay);
    expect(out).toHaveLength(1);
    expect(out[0]!.count).toBe(2);
  });

  it("Math.round rounding: 350, 350.4 collapse; 350.6 goes to 351 bucket", () => {
    const byDay = {
      "2026-04-14": [
        meal("Chicken", 350),
        meal("Chicken", 350.4),
        meal("Chicken", 350.6),
      ],
    };
    const out = computeFrequentMeals(byDay);
    expect(out).toHaveLength(2);
    const byCal = new Map(out.map((o) => [o.calories, o.count]));
    expect(byCal.get(350)).toBe(2);
    expect(byCal.get(351)).toBe(1);
  });

  it("sorts by count desc, most-recent tie-break, then title", () => {
    const byDay: Record<string, M[]> = {
      "2026-04-12": [meal("A", 100), meal("B", 200), meal("B", 200)],
      "2026-04-13": [meal("C", 300), meal("B", 200)],
      "2026-04-14": [meal("A", 100)],
    };
    const out = computeFrequentMeals(byDay);
    // B has 3 logs, A has 2, C has 1.
    expect(out.map((o) => o.recipeTitle)).toEqual(["B", "A", "C"]);
  });

  it("respects topN cap", () => {
    const byDay: Record<string, M[]> = { "2026-04-14": [] as M[] };
    for (let i = 0; i < 30; i += 1) {
      byDay["2026-04-14"]!.push(meal(`Food ${i}`, 100 + i));
    }
    const out = computeFrequentMeals(byDay, 5);
    expect(out).toHaveLength(5);
  });

  it("missing title is coerced to 'Unnamed food' rather than dropped", () => {
    const byDay: Record<string, M[]> = {
      "2026-04-14": [{ calories: 120, protein: 5, carbs: 20, fat: 2 }],
    };
    const out = computeFrequentMeals(byDay);
    expect(out).toHaveLength(1);
    expect(out[0]!.recipeTitle).toBe("Unnamed food");
  });
});

describe("computeRecentMeals", () => {
  it("orders by latest day first, latest position within day first", () => {
    const byDay: Record<string, M[]> = {
      "2026-04-12": [meal("A", 100)],
      "2026-04-14": [meal("B", 200), meal("C", 300), meal("D", 400)],
      "2026-04-13": [meal("E", 150)],
    };
    const out = computeRecentMeals(byDay);
    // Most recent day = 2026-04-14 with D last, then C, then B; then 04-13 (E); then 04-12 (A).
    expect(out.map((o) => o.recipeTitle)).toEqual(["D", "C", "B", "E", "A"]);
  });

  it("count reflects total occurrences across all days", () => {
    const byDay: Record<string, M[]> = {
      "2026-04-10": [meal("Oatmeal", 350)],
      "2026-04-11": [meal("Oatmeal", 350)],
      "2026-04-12": [meal("Oatmeal", 350)],
    };
    const out = computeRecentMeals(byDay);
    expect(out).toHaveLength(1);
    expect(out[0]!.count).toBe(3);
  });

  it("respects limit cap", () => {
    const byDay: Record<string, M[]> = { "2026-04-14": [] as M[] };
    for (let i = 0; i < 30; i += 1) {
      byDay["2026-04-14"]!.push(meal(`Food ${i}`, 100 + i));
    }
    const out = computeRecentMeals(byDay, 10);
    expect(out).toHaveLength(10);
  });
});

describe("computeEatAgainForSlot", () => {
  it("returns null when there is no history", () => {
    expect(computeEatAgainForSlot({}, "Lunch", new Date("2026-04-14T12:00:00Z"))).toBeNull();
  });

  it("returns null when the user only logged to that slot today (today is excluded)", () => {
    const byDay: Record<string, M[]> = {
      "2026-04-14": [{ ...meal("Salad", 400), name: "Lunch" }],
    };
    const now = new Date(2026, 3, 14, 12, 0, 0); // local 2026-04-14
    expect(computeEatAgainForSlot(byDay, "Lunch", now)).toBeNull();
  });

  it("picks the most recent prior day with a meal in that slot", () => {
    const byDay: Record<string, M[]> = {
      "2026-04-11": [{ ...meal("Old Lunch", 300), name: "Lunch" }],
      "2026-04-12": [{ ...meal("Salad", 400), name: "Lunch" }],
      "2026-04-13": [{ ...meal("Breakfast Burrito", 600), name: "Breakfast" }],
      // Today has a Lunch, but it is excluded.
      "2026-04-14": [{ ...meal("Today Lunch", 500), name: "Lunch" }],
    };
    const now = new Date(2026, 3, 14, 12, 0, 0);
    const out = computeEatAgainForSlot(byDay, "Lunch", now);
    expect(out).not.toBeNull();
    // 04-13 has no Lunch; 04-12 is the most recent prior Lunch.
    expect(out!.recipeTitle).toBe("Salad");
    expect(out!.calories).toBe(400);
  });

  it("returns the LAST meal in the slot when there are several", () => {
    const byDay: Record<string, M[]> = {
      "2026-04-13": [
        { ...meal("First Lunch", 300), name: "Lunch" },
        { ...meal("Second Lunch", 500), name: "Lunch" },
      ],
    };
    const now = new Date(2026, 3, 14, 12, 0, 0);
    const out = computeEatAgainForSlot(byDay, "Lunch", now);
    expect(out!.recipeTitle).toBe("Second Lunch");
  });

  it("slot match is case-insensitive", () => {
    const byDay: Record<string, M[]> = {
      "2026-04-13": [{ ...meal("Salad", 400), name: "lunch" }],
    };
    const now = new Date(2026, 3, 14, 12, 0, 0);
    const out = computeEatAgainForSlot(byDay, "Lunch", now);
    expect(out).not.toBeNull();
    expect(out!.recipeTitle).toBe("Salad");
  });

  it("returns null for an invalid Date", () => {
    const byDay: Record<string, M[]> = {
      "2026-04-13": [{ ...meal("Salad", 400), name: "Lunch" }],
    };
    expect(computeEatAgainForSlot(byDay, "Lunch", new Date("nope"))).toBeNull();
  });

  describe("N1 (2026-05-03) — skips HealthKit-import fallback titles", () => {
    it("skips a meal whose title is the legacy 'Food log (NNN kcal)' fallback", () => {
      const byDay: Record<string, M[]> = {
        "2026-04-13": [{ ...meal("Food log (250 kcal)", 250), name: "Lunch" }],
      };
      const now = new Date(2026, 3, 14, 12, 0, 0);
      // Re-logging "Food log (250 kcal)" gives the user nothing — the
      // row is a placeholder for an unknown food, not a real meal.
      expect(computeEatAgainForSlot(byDay, "Lunch", now)).toBeNull();
    });

    it("skips a meal whose title is the new '<Source> entry · NNN kcal' fallback", () => {
      const byDay: Record<string, M[]> = {
        "2026-04-13": [{ ...meal("MyFitnessPal entry · 250 kcal", 250), name: "Lunch" }],
      };
      const now = new Date(2026, 3, 14, 12, 0, 0);
      expect(computeEatAgainForSlot(byDay, "Lunch", now)).toBeNull();
    });

    it("falls back to the next-most-recent prior day with a real meal", () => {
      const byDay: Record<string, M[]> = {
        // Older prior day: real meal.
        "2026-04-11": [{ ...meal("Real Salad", 400), name: "Lunch" }],
        // More-recent prior day: only a fallback row → skip.
        "2026-04-13": [{ ...meal("Food log (250 kcal)", 250), name: "Lunch" }],
      };
      const now = new Date(2026, 3, 14, 12, 0, 0);
      const out = computeEatAgainForSlot(byDay, "Lunch", now);
      expect(out).not.toBeNull();
      expect(out!.recipeTitle).toBe("Real Salad");
    });

    it("if multiple meals exist that day, picks the most recent NON-fallback row", () => {
      const byDay: Record<string, M[]> = {
        "2026-04-13": [
          { ...meal("Real Lunch", 500), name: "Lunch" },
          // The most-recent in array order is a fallback — must skip.
          { ...meal("MyFitnessPal entry · 80 kcal", 80), name: "Lunch" },
        ],
      };
      const now = new Date(2026, 3, 14, 12, 0, 0);
      const out = computeEatAgainForSlot(byDay, "Lunch", now);
      expect(out).not.toBeNull();
      expect(out!.recipeTitle).toBe("Real Lunch");
    });
  });
});

describe("isAiSourcedFoodHistoryItem (M10 backwards-compat, 2026-04-18)", () => {
  // The detector is permissive by design: writes use the canonical
  // `AI voice` / `AI photo` constants (see `aiLoggingSourceLabel`) but
  // legacy rows (`voice`, `ai_voice`, `ai_photo`) must continue to
  // surface the AI badge in the Quick Add Recent tab — we never
  // migrate historical rows.
  it("matches the new canonical write labels", () => {
    expect(isAiSourcedFoodHistoryItem({ source: AI_VOICE_SOURCE })).toBe(true);
    expect(isAiSourcedFoodHistoryItem({ source: AI_PHOTO_SOURCE })).toBe(true);
  });

  it("still matches legacy snake_case sources", () => {
    expect(isAiSourcedFoodHistoryItem({ source: "ai_voice" })).toBe(true);
    expect(isAiSourcedFoodHistoryItem({ source: "ai_photo" })).toBe(true);
    expect(isAiSourcedFoodHistoryItem({ source: "voice" })).toBe(true);
  });

  it("matches regardless of casing / whitespace (written spelling drift)", () => {
    expect(isAiSourcedFoodHistoryItem({ source: "ai voice" })).toBe(true);
    expect(isAiSourcedFoodHistoryItem({ source: "AI VOICE" })).toBe(true);
    expect(isAiSourcedFoodHistoryItem({ source: "  AI photo  " })).toBe(true);
  });

  it("does not match unrelated sources", () => {
    expect(isAiSourcedFoodHistoryItem({ source: "USDA" })).toBe(false);
    expect(isAiSourcedFoodHistoryItem({ source: "Open Food Facts" })).toBe(false);
    expect(isAiSourcedFoodHistoryItem({ source: "manual" })).toBe(false);
  });

  it("handles missing / null / empty source", () => {
    expect(isAiSourcedFoodHistoryItem({})).toBe(false);
    expect(isAiSourcedFoodHistoryItem({ source: null })).toBe(false);
    expect(isAiSourcedFoodHistoryItem({ source: undefined })).toBe(false);
    expect(isAiSourcedFoodHistoryItem({ source: "" })).toBe(false);
    expect(isAiSourcedFoodHistoryItem({ source: "   " })).toBe(false);
  });
});
