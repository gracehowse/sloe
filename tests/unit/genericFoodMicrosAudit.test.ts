/**
 * ENG-1104 — static audit pins for genericFoodMicros fdcId correctness.
 * Calorie-anchored bake can pass the wrong semantic row (e.g. pasta for
 * brown rice); these pins guard the known-problem staples.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GENERIC_FOODS } from "@/lib/nutrition/genericFoods";
import { GENERIC_FOOD_MICROS } from "@/lib/nutrition/genericFoodMicros";

const MICROS_SRC = readFileSync(
  resolve(__dirname, "../../src/lib/nutrition/genericFoodMicros.ts"),
  "utf8",
);

/** fdcId cited in the file comment immediately above each key. */
const PINNED_FDC: Record<string, number> = {
  apple: 171688,
  grapes: 174683,
  "brown-rice": 169704,
  "sweet-potato": 2346404,
  tomato: 170457,
  "greek-yogurt": 170894,
  potato: 170026,
  mushroom: 169251,
  "oats-raw": 169705,
  egg: 171287,
  "tofu-firm": 172475,
};

describe("ENG-1104 — genericFoodMicros coverage + fdc pins", () => {
  it("every GENERIC_FOODS id has a baked micro row", () => {
    for (const food of GENERIC_FOODS) {
      expect(GENERIC_FOOD_MICROS[food.id], `${food.id} missing micros`).toBeDefined();
    }
  });

  it("pinned staples cite the audited USDA fdcId (not babyfood/branded mismatches)", () => {
    for (const [id, fdcId] of Object.entries(PINNED_FDC)) {
      expect(MICROS_SRC).toMatch(new RegExp(`fdc ${fdcId}[\\s\\S]*?"${id}"`));
    }
  });

  it("does not retain known-wrong fdcIds from the pre-audit bake", () => {
    expect(MICROS_SRC).not.toMatch(/fdc 172026/); // pasta masquerading as brown rice
    expect(MICROS_SRC).not.toMatch(/fdc 170959/); // babyfood apple juice
    expect(MICROS_SRC).not.toMatch(/fdc 169393/); // grape leaves
    expect(MICROS_SRC).not.toMatch(/fdc 171312/); // CHOBANI-branded greek yogurt
    expect(MICROS_SRC).not.toMatch(/fdc 170051/); // canned tomato (dict subtitle is Raw)
    expect(MICROS_SRC).not.toMatch(/fdc 169305/); // canned sweet potato mash (dict subtitle is Raw)
  });

  it("every generic food has plausible kcal vs macro anchors (ENG-1104)", () => {
    for (const food of GENERIC_FOODS) {
      const { calories, protein, carbs, fat } = food.per100g;
      const kcalFromMacros = protein * 4 + carbs * 4 + fat * 9;
      if (calories <= 0) continue;
      const diff = Math.abs(kcalFromMacros - calories);
      expect(diff).toBeLessThanOrEqual(Math.max(15, calories * 0.25));
    }
  });
});
