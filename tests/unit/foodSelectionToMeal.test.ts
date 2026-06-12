import { describe, expect, it } from "vitest";
import {
  foodSelectionToMealMacros,
  foodSelectionSourceLabel,
  foodSelectionAnalyticsSource,
  type FoodSelectionLike,
} from "@/lib/nutrition/foodSelectionToMeal";

const PER_100G: NonNullable<FoodSelectionLike["macrosPer100g"]> = {
  calories: 250,
  protein: 9,
  carbs: 48,
  fat: 2,
  fiberG: 4,
  sugarG: 3,
  sodiumMg: 400,
};

describe("foodSelectionToMealMacros — per-100g path", () => {
  it("scales macros by grams (gramWeight × quantity / 100)", () => {
    const sel: FoodSelectionLike = {
      name: "Bread",
      source: "USDA",
      macrosPer100g: PER_100G,
      chosenPortion: { label: "slice", gramWeight: 50 },
      quantity: 2, // 100 g total → factor 1
    };
    const out = foodSelectionToMealMacros(sel);
    expect(out.calories).toBe(250);
    expect(out.protein).toBe(9);
    expect(out.carbs).toBe(48);
    expect(out.fat).toBe(2);
    expect(out.fiberG).toBe(4);
  });

  it("rounds and never goes negative", () => {
    const sel: FoodSelectionLike = {
      name: "Half slice",
      source: "OFF",
      macrosPer100g: PER_100G,
      chosenPortion: { label: "g", gramWeight: 1 },
      quantity: 50, // 50 g → factor 0.5
    };
    const out = foodSelectionToMealMacros(sel);
    expect(out.calories).toBe(125);
    expect(out.protein).toBe(4.5);
    expect(out.calories).toBeGreaterThanOrEqual(0);
  });

  it("scales caffeine + alcohol from per-100g into the micros map", () => {
    const sel: FoodSelectionLike = {
      name: "Cola",
      source: "OFF",
      macrosPer100g: { ...PER_100G, caffeineMgPer100g: 10, alcoholGPer100g: 0 },
      chosenPortion: { label: "g", gramWeight: 1 },
      quantity: 330, // 330 g → 33 mg caffeine
    };
    const out = foodSelectionToMealMacros(sel);
    expect(out.micros.caffeineMg).toBe(33);
  });
});

describe("foodSelectionToMealMacros — per-serving path (FatSecret no-metric)", () => {
  it("uses macrosPerServing × quantity when gramWeight is 0", () => {
    const sel: FoodSelectionLike = {
      name: "Big Mac",
      source: "FatSecret",
      macrosPer100g: null,
      macrosPerServing: { calories: 563, protein: 26, carbs: 45, fat: 33 },
      chosenPortion: { label: "1 burger", gramWeight: 0 },
      quantity: 2,
    };
    const out = foodSelectionToMealMacros(sel);
    expect(out.calories).toBe(1126);
    expect(out.protein).toBe(52);
    expect(out.fat).toBe(66);
  });

  it("applies servingFraction to a derived single-piece portion", () => {
    const sel: FoodSelectionLike = {
      name: "1 piece",
      source: "FatSecret",
      macrosPer100g: null,
      macrosPerServing: { calories: 200, protein: 10, carbs: 20, fat: 8 },
      chosenPortion: { label: "1 piece", gramWeight: 0, servingFraction: 0.25 },
      quantity: 1, // 1 × 0.25 = quarter serving
    };
    const out = foodSelectionToMealMacros(sel);
    expect(out.calories).toBe(50);
    expect(out.protein).toBe(2.5);
  });

  it("pulls fiber from microsPerServing when present", () => {
    const sel: FoodSelectionLike = {
      name: "Bar",
      source: "FatSecret",
      macrosPer100g: null,
      macrosPerServing: { calories: 200, protein: 10, carbs: 20, fat: 8 },
      microsPerServing: { fiberG: 5, sodiumMg: 120 },
      chosenPortion: { label: "1 bar", gramWeight: 0 },
      quantity: 1,
    };
    const out = foodSelectionToMealMacros(sel);
    expect(out.fiberG).toBe(5);
    expect(out.micros.sodiumMg).toBe(120);
  });
});

describe("foodSelectionToMealMacros — incomplete vendor payloads", () => {
  it("returns zeros instead of throwing when per-100g macros are missing", () => {
    const out = foodSelectionToMealMacros({
      name: "Broken OFF row",
      source: "OFF",
      macrosPer100g: null,
      chosenPortion: { label: "g", gramWeight: 1 },
      quantity: 100,
    });
    expect(out).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiberG: 0,
      micros: {},
    });
  });
});

describe("ENG-1041 — fibre is exposed top-level for the fiber_g column (web ↔ mobile)", () => {
  // The mobile + web food-search log paths both compute a top-level fibre
  // value from this same math and persist it to the `fiber_g` column. This
  // pins the contract: the per-100g and per-serving paths must BOTH return
  // a usable `fiberG` so neither platform persists `fiber_g: null` (which
  // exported blank fibre in the CSV — the P1-6 bug).
  it("per-100g path returns a non-null top-level fiberG", () => {
    const out = foodSelectionToMealMacros({
      name: "Lentils",
      source: "USDA",
      macrosPer100g: { ...PER_100G, fiberG: 8 },
      chosenPortion: { label: "g", gramWeight: 1 },
      quantity: 100, // 100 g → factor 1
    });
    expect(out.fiberG).toBe(8);
    expect(out.fiberG).not.toBeNull();
  });

  it("per-serving path promotes microsPerServing fibre to the top level", () => {
    const out = foodSelectionToMealMacros({
      name: "Protein bar",
      source: "FatSecret",
      macrosPer100g: null,
      macrosPerServing: { calories: 200, protein: 20, carbs: 22, fat: 6 },
      microsPerServing: { fiberG: 9 },
      chosenPortion: { label: "1 bar", gramWeight: 0 },
      quantity: 1,
    });
    expect(out.fiberG).toBe(9);
  });
});

describe("foodSelectionSourceLabel + foodSelectionAnalyticsSource", () => {
  it("maps each source to its human-readable journal label", () => {
    expect(foodSelectionSourceLabel("CUSTOM")).toBe("Custom food");
    expect(foodSelectionSourceLabel("OFF")).toBe("Open Food Facts");
    expect(foodSelectionSourceLabel("Edamam")).toBe("Edamam");
    expect(foodSelectionSourceLabel("FatSecret")).toBe("FatSecret");
    expect(foodSelectionSourceLabel("USDA")).toBe("USDA FoodData Central");
  });

  it("labels a re-logged history item neutrally (never a DB source)", () => {
    expect(foodSelectionSourceLabel("history")).toBe("Manual");
  });

  it("maps the analytics source: custom vs manual", () => {
    expect(foodSelectionAnalyticsSource("CUSTOM")).toBe("custom_food");
    expect(foodSelectionAnalyticsSource("USDA")).toBe("manual");
    expect(foodSelectionAnalyticsSource("FatSecret")).toBe("manual");
    expect(foodSelectionAnalyticsSource("history")).toBe("manual");
  });
});
