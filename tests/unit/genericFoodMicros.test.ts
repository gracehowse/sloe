/**
 * Generic-food micros table — data integrity pin (ENG-738).
 *
 * `src/lib/nutrition/genericFoodMicros.ts` is auto-generated from real
 * USDA Foundation / SR-Legacy rows (calorie-anchored at bake time so a
 * wrong row can't slip in). These tests guard the SHAPE and a couple of
 * spot-checked values — they do NOT re-derive nutrition (the bake script
 * owns the numbers; per CLAUDE.md we never hand-edit or invent values).
 *
 * Why this matters: this table is the data behind ENG-738 — wiring it
 * into the generic-food log path so logging "carrot" / "spinach" stores
 * vitamins/minerals instead of an empty `nutrition_micros`. If an entry
 * goes empty or a value flips to 0/negative, the meal-detail "Vitamins,
 * minerals & more" card silently regresses to "did not publish…".
 */
import { describe, expect, it } from "vitest";
import {
  GENERIC_FOOD_MICROS,
  genericFoodMicrosPer100g,
} from "../../src/lib/nutrition/genericFoodMicros";
import { GENERIC_FOODS } from "../../src/lib/nutrition/genericFoods";

describe("GENERIC_FOOD_MICROS — table shape", () => {
  it("covers exactly 37 generic foods", () => {
    expect(Object.keys(GENERIC_FOOD_MICROS)).toHaveLength(37);
  });

  it("keys every baked micro panel to a real GenericFood id (no orphans)", () => {
    const foodIds = new Set(GENERIC_FOODS.map((f) => f.id));
    for (const id of Object.keys(GENERIC_FOOD_MICROS)) {
      expect(foodIds.has(id)).toBe(true);
    }
  });

  it("bakes a micro panel for every GenericFood (no gaps)", () => {
    // 1:1 today — every solid-food dictionary entry has a baked panel.
    // If a food is added without a bake, this fails loudly rather than
    // silently logging an empty `nutrition_micros`.
    for (const food of GENERIC_FOODS) {
      expect(
        genericFoodMicrosPer100g(food.id),
        `missing baked micros for generic food "${food.id}"`,
      ).toBeDefined();
    }
  });

  it("every entry is a non-empty object of positive numbers", () => {
    for (const [id, micros] of Object.entries(GENERIC_FOOD_MICROS)) {
      const keys = Object.keys(micros);
      expect(keys.length, `${id} has no micros`).toBeGreaterThan(0);
      for (const [nutrient, value] of Object.entries(micros)) {
        expect(typeof value, `${id}.${nutrient} not a number`).toBe("number");
        expect(
          Number.isFinite(value),
          `${id}.${nutrient} not finite`,
        ).toBe(true);
        // USDA per-100g values are always >= 0; a baked 0 would be a
        // dropped nutrient, not a real measurement, so the bake omits
        // unknowns rather than writing 0. Everything present is > 0.
        expect(value, `${id}.${nutrient} should be > 0`).toBeGreaterThan(0);
      }
    }
  });
});

describe("GENERIC_FOOD_MICROS — spot-checked USDA values", () => {
  // These pin the exact baked numbers the data module ships today. They
  // are NOT a re-derivation — they catch an accidental table edit or a
  // bad re-bake that drops a flagship nutrient.
  it("carrot carries beta-carotene-driven vitamin A and potassium", () => {
    const carrot = genericFoodMicrosPer100g("carrot");
    expect(carrot).toBeDefined();
    expect(carrot!.vitaminAMcgRae).toBeCloseTo(835, 0);
    expect(carrot!.potassiumMg).toBeCloseTo(320, 0);
  });

  it("spinach carries its hallmark vitamin K and folate", () => {
    const spinach = genericFoodMicrosPer100g("spinach");
    expect(spinach).toBeDefined();
    expect(spinach!.vitaminKMcg).toBeCloseTo(483, 0);
    expect(spinach!.folateMcg).toBeCloseTo(194, 0);
  });

  it("no-salt-added canned tomatoes bake the LOW sodium row (ENG-1083)", () => {
    // The whole point of this entry: tinned tomatoes without added salt
    // carry ~10 mg Na/100g, not the ~115 mg of the salted canned row
    // (USDA #170051). If a re-bake ever picks the salted row, this fails.
    const canned = genericFoodMicrosPer100g("canned-tomatoes-no-salt");
    expect(canned).toBeDefined();
    expect(canned!.sodiumMg).toBeCloseTo(10, 0);
    // ~10x lower sodium than the raw-tomato-vs-salted gap would suggest —
    // and an order of magnitude below the salted canned counterpart.
    expect(canned!.sodiumMg).toBeLessThan(50);
    // Hallmark micros survive (potassium + vitamin C are the canned-tomato
    // signature) so the row isn't a stripped/empty panel.
    expect(canned!.potassiumMg).toBeCloseTo(191, 0);
    expect(canned!.vitaminCMg).toBeCloseTo(12.6, 1);
  });
});

describe("genericFoodMicrosPer100g", () => {
  it("returns the same reference held in the table", () => {
    expect(genericFoodMicrosPer100g("carrot")).toBe(
      GENERIC_FOOD_MICROS["carrot"],
    );
  });

  it("returns undefined for an unbaked / unknown id", () => {
    expect(genericFoodMicrosPer100g("not-a-real-food")).toBeUndefined();
    expect(genericFoodMicrosPer100g("")).toBeUndefined();
  });
});
