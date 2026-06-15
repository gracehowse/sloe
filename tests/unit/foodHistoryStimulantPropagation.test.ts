/**
 * Tracking-extras autoupdate (2026-05-01) — pins the new caffeine /
 * alcohol propagation through `computeFrequentMeals` /
 * `computeRecentMeals` / `computeEatAgainForSlot`. Without this, a
 * cortado logged via search would forget its 128 mg caffeine
 * contribution the moment the user re-logged it from Quick Add /
 * Eat-again — exactly the regression TestFlight Build 40 flagged.
 *
 * The bucket builder reads `micros.caffeineMg` first (canonical for
 * meals committed via the food-search / barcode / voice / photo paths)
 * and falls back to a top-level `caffeineMg` for legacy / synthetic
 * shapes. Averaging (not summing) keeps a 3x-logged cortado at
 * ~128 mg per tap so the daily-totals math stays additive.
 */
import { describe, it, expect } from "vitest";
import {
  computeEatAgainForSlot,
  computeFrequentMeals,
  computeRecentMeals,
  type FoodHistoryMealLike,
} from "@/lib/nutrition/foodHistory";

type M = FoodHistoryMealLike & { name?: string };

function meal(title: string, calories: number, extras: Partial<M> = {}): M {
  return {
    recipeTitle: title,
    calories,
    protein: extras.protein ?? 0,
    carbs: extras.carbs ?? 0,
    fat: extras.fat ?? 0,
    ...extras,
  };
}

describe("foodHistory caffeine propagation", () => {
  it("reads caffeineMg from micros and surfaces it on the bucket", () => {
    const byDay = {
      "2026-04-30": [
        meal("Cortado", 29, { name: "Coffee", micros: { caffeineMg: 128 } }),
      ],
    };
    const out = computeFrequentMeals(byDay);
    expect(out).toHaveLength(1);
    expect(out[0]!.recipeTitle).toBe("Cortado");
    expect(out[0]!.caffeineMg).toBe(128);
  });

  it("averages caffeine across occurrences (not sums)", () => {
    // 3 cortado logs at 128 mg each → average is 128, not 384.
    const byDay = {
      "2026-04-28": [meal("Cortado", 29, { micros: { caffeineMg: 128 } })],
      "2026-04-29": [meal("Cortado", 29, { micros: { caffeineMg: 128 } })],
      "2026-04-30": [meal("Cortado", 29, { micros: { caffeineMg: 128 } })],
    };
    const out = computeFrequentMeals(byDay);
    expect(out).toHaveLength(1);
    expect(out[0]!.count).toBe(3);
    expect(out[0]!.caffeineMg).toBe(128);
  });

  it("falls back to top-level caffeineMg if micros is absent", () => {
    const byDay = {
      "2026-04-30": [meal("Latte", 95, { caffeineMg: 95 })],
    };
    const out = computeFrequentMeals(byDay);
    expect(out[0]!.caffeineMg).toBe(95);
  });

  it("rounds caffeine to integer mg (storage shape)", () => {
    // 121.6 averaged → rounds to 122
    const byDay = {
      "2026-04-29": [meal("Coffee", 5, { micros: { caffeineMg: 120 } })],
      "2026-04-30": [meal("Coffee", 5, { micros: { caffeineMg: 123.2 } })],
    };
    const out = computeFrequentMeals(byDay);
    expect(out[0]!.caffeineMg).toBe(122);
    expect(Number.isInteger(out[0]!.caffeineMg)).toBe(true);
  });

  it("omits caffeineMg when no occurrence carries the nutrient", () => {
    // A steak logged 3 times — no caffeine ever → no field on the bucket.
    const byDay = {
      "2026-04-28": [meal("Steak", 350)],
      "2026-04-29": [meal("Steak", 350)],
      "2026-04-30": [meal("Steak", 350)],
    };
    const out = computeFrequentMeals(byDay);
    expect(out[0]!.caffeineMg).toBeUndefined();
  });

  it("non-positive / non-finite caffeine values are dropped", () => {
    const byDay = {
      "2026-04-30": [
        meal("Coffee A", 5, { micros: { caffeineMg: 0 } }),
        meal("Coffee B", 5, { micros: { caffeineMg: -10 } }),
        meal("Coffee C", 5, { micros: { caffeineMg: Number.NaN } }),
      ],
    };
    const out = computeFrequentMeals(byDay);
    for (const item of out) {
      expect(item.caffeineMg).toBeUndefined();
    }
  });

  it("partial coverage averages only over occurrences that carry the nutrient", () => {
    // Three "Coffee" logs but only two carry caffeine → average over 2.
    // (180 + 100) / 2 = 140
    const byDay = {
      "2026-04-28": [meal("Coffee", 5, { micros: { caffeineMg: 180 } })],
      "2026-04-29": [meal("Coffee", 5)], // no caffeine info
      "2026-04-30": [meal("Coffee", 5, { micros: { caffeineMg: 100 } })],
    };
    const out = computeFrequentMeals(byDay);
    expect(out[0]!.count).toBe(3);
    expect(out[0]!.caffeineMg).toBe(140);
  });
});

describe("foodHistory alcohol propagation", () => {
  it("reads alcoholG from micros and surfaces it on the bucket", () => {
    const byDay = {
      "2026-04-30": [
        meal("Glass of red wine", 149, {
          name: "Dinner",
          micros: { alcoholG: 16.6 },
        }),
      ],
    };
    const out = computeFrequentMeals(byDay);
    expect(out[0]!.alcoholG).toBe(16.6);
  });

  it("rounds alcohol to 1 dp g", () => {
    // (14.25 + 14.34) / 2 = 14.295 → 14.3
    const byDay = {
      "2026-04-29": [meal("Wine", 120, { micros: { alcoholG: 14.25 } })],
      "2026-04-30": [meal("Wine", 120, { micros: { alcoholG: 14.34 } })],
    };
    const out = computeFrequentMeals(byDay);
    expect(out[0]!.alcoholG).toBe(14.3);
    // 10 * value must be an integer after rounding to 1 dp.
    expect(Number.isInteger(Math.round(out[0]!.alcoholG! * 10))).toBe(true);
  });

  it("falls back to top-level alcoholG if micros is absent", () => {
    const byDay = {
      "2026-04-30": [meal("IPA", 215, { alcoholG: 16.9 })],
    };
    const out = computeFrequentMeals(byDay);
    expect(out[0]!.alcoholG).toBe(16.9);
  });

  it("caffeine + alcohol on the same row both surface independently", () => {
    // Hypothetical Irish coffee
    const byDay = {
      "2026-04-30": [
        meal("Irish Coffee", 200, {
          micros: { caffeineMg: 95, alcoholG: 14 },
        }),
      ],
    };
    const out = computeFrequentMeals(byDay);
    expect(out[0]!.caffeineMg).toBe(95);
    expect(out[0]!.alcoholG).toBe(14);
  });
});

describe("foodHistory recent + eat-again propagation", () => {
  it("computeRecentMeals carries caffeineMg forward", () => {
    const byDay = {
      "2026-04-30": [meal("Cortado", 29, { micros: { caffeineMg: 128 } })],
    };
    const out = computeRecentMeals(byDay);
    expect(out[0]!.caffeineMg).toBe(128);
  });

  it("computeEatAgainForSlot carries caffeineMg forward", () => {
    const byDay = {
      "2026-04-29": [
        meal("Cortado", 29, {
          name: "Breakfast",
          micros: { caffeineMg: 128 },
        }),
      ],
    };
    // Today is 2026-04-30; eat-again should pull the prior-day cortado.
    const out = computeEatAgainForSlot(
      byDay,
      "Breakfast",
      new Date("2026-04-30T09:00:00Z"),
    );
    expect(out).not.toBeNull();
    expect(out!.caffeineMg).toBe(128);
  });

  it("eat-again with no caffeine on the source row leaves caffeineMg undefined", () => {
    const byDay = {
      "2026-04-29": [meal("Toast", 200, { name: "Breakfast" })],
    };
    const out = computeEatAgainForSlot(
      byDay,
      "Breakfast",
      new Date("2026-04-30T09:00:00Z"),
    );
    expect(out).not.toBeNull();
    expect(out!.caffeineMg).toBeUndefined();
    expect(out!.alcoholG).toBeUndefined();
  });
});

describe("foodHistory full micro panel propagation (ENG-1105)", () => {
  it("surfaces sodiumMg and sugarG on the bucket (excluding stimulant keys from micros panel)", () => {
    const byDay = {
      "2026-04-30": [
        meal("Greek yogurt", 150, {
          micros: { sodiumMg: 65, sugarG: 12, caffeineMg: 0 },
        }),
      ],
    };
    const out = computeFrequentMeals(byDay);
    expect(out[0]!.micros).toEqual({ sodiumMg: 65, sugarG: 12 });
  });

  it("computeRecentMeals carries micros forward for re-log", () => {
    const byDay = {
      "2026-04-30": [
        meal("Soup", 220, { micros: { sodiumMg: 890, sugarG: 4 } }),
      ],
    };
    const out = computeRecentMeals(byDay);
    expect(out[0]!.micros).toEqual({ sodiumMg: 890, sugarG: 4 });
  });

  it("averages micro keys across occurrences", () => {
    const byDay = {
      "2026-04-28": [meal("Soup", 220, { micros: { sodiumMg: 800 } })],
      "2026-04-30": [meal("Soup", 220, { micros: { sodiumMg: 1000 } })],
    };
    const out = computeFrequentMeals(byDay);
    expect(out[0]!.micros!.sodiumMg).toBe(900);
  });
});
