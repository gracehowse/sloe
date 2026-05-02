/**
 * dailyValues — breadth coverage for the Cronometer-parity push.
 *
 * The 4-tile widget + the FullNutrientPanelSheet share the canonical
 * `DAILY_VALUES` table. This file is the breadth contract: at least
 * 35 nutrient entries, the right LIMIT-vs-target classification, and
 * the FDA 2020 reference numbers for each entry exactly as published
 * in 21 CFR 101.9(c). Drift here would silently misrepresent every
 * %DV the panel sheet shows.
 */
import { describe, expect, it } from "vitest";
import {
  DAILY_VALUES,
  DAILY_VALUES_SOURCE_LABEL,
  dailyValuePercent,
  isLimitNutrient,
} from "@/lib/nutrition/dailyValues";

describe("DAILY_VALUES — breadth (Cronometer parity)", () => {
  /**
   * Count contract: 33 entries with a numeric DV — 7 macros (sugar
   * intentionally absent — see file header), 14 vitamins (A, C, D, E,
   * K, 8 B-complex, choline), 12 minerals. The "35 nutrients" framing
   * in the panel sheet header counts the curated rows including
   * sugar, which renders without a %DV.
   */
  it("exposes at least 33 nutrient entries with a numeric DV", () => {
    expect(Object.keys(DAILY_VALUES).length).toBeGreaterThanOrEqual(33);
  });

  it("covers the macro reference set (FDA 21 CFR 101.9(c))", () => {
    expect(DAILY_VALUES.fiberG).toBe(28);
    expect(DAILY_VALUES.sodiumMg).toBe(2300);
    expect(DAILY_VALUES.totalFatG).toBe(78);
    expect(DAILY_VALUES.saturatedFatG).toBe(20);
    expect(DAILY_VALUES.cholesterolMg).toBe(300);
    expect(DAILY_VALUES.totalCarbsG).toBe(275);
    expect(DAILY_VALUES.proteinG).toBe(50);
    // Sugar intentionally has no DV — total sugars carry no FDA DV.
    expect(DAILY_VALUES.sugarG).toBeUndefined();
  });

  it("covers the 13-nutrient vitamin reference set", () => {
    expect(DAILY_VALUES.vitaminAMcgRae).toBe(900);
    expect(DAILY_VALUES.vitaminCMg).toBe(90);
    expect(DAILY_VALUES.vitaminDMcg).toBe(20);
    expect(DAILY_VALUES.vitaminEMg).toBe(15);
    expect(DAILY_VALUES.vitaminKMcg).toBe(120);
    expect(DAILY_VALUES.thiaminMg).toBe(1.2);
    expect(DAILY_VALUES.riboflavinMg).toBe(1.3);
    expect(DAILY_VALUES.niacinMg).toBe(16);
    expect(DAILY_VALUES.vitaminB6Mg).toBe(1.7);
    expect(DAILY_VALUES.biotinMcg).toBe(30);
    expect(DAILY_VALUES.folateMcg).toBe(400);
    expect(DAILY_VALUES.vitaminB12Mcg).toBe(2.4);
    expect(DAILY_VALUES.pantothenicAcidMg).toBe(5);
    expect(DAILY_VALUES.cholineMg).toBe(550);
  });

  it("covers the 12-nutrient mineral reference set", () => {
    expect(DAILY_VALUES.calciumMg).toBe(1300);
    expect(DAILY_VALUES.ironMg).toBe(18);
    expect(DAILY_VALUES.magnesiumMg).toBe(420);
    expect(DAILY_VALUES.potassiumMg).toBe(4700);
    expect(DAILY_VALUES.zincMg).toBe(11);
    expect(DAILY_VALUES.phosphorusMg).toBe(1250);
    expect(DAILY_VALUES.iodineMcg).toBe(150);
    expect(DAILY_VALUES.copperMg).toBe(0.9);
    expect(DAILY_VALUES.seleniumMcg).toBe(55);
    expect(DAILY_VALUES.manganeseMg).toBe(2.3);
    expect(DAILY_VALUES.chromiumMcg).toBe(35);
    expect(DAILY_VALUES.molybdenumMcg).toBe(45);
  });

  it("flags the three FDA-label LIMIT nutrients only", () => {
    expect(isLimitNutrient("sodiumMg")).toBe(true);
    expect(isLimitNutrient("saturatedFatG")).toBe(true);
    expect(isLimitNutrient("cholesterolMg")).toBe(true);

    // Targets — going over is fine, never warning.
    expect(isLimitNutrient("fiberG")).toBe(false);
    expect(isLimitNutrient("ironMg")).toBe(false);
    expect(isLimitNutrient("vitaminDMcg")).toBe(false);
    expect(isLimitNutrient("calciumMg")).toBe(false);
    expect(isLimitNutrient("totalFatG")).toBe(false);
    expect(isLimitNutrient("totalCarbsG")).toBe(false);
    expect(isLimitNutrient("proteinG")).toBe(false);
  });

  it("returns null %DV for keys without a DV (e.g. sugar)", () => {
    expect(dailyValuePercent("sugarG", 50)).toBeNull();
    expect(dailyValuePercent("caffeineMg", 200)).toBeNull();
  });

  it("computes %DV against expanded DV entries (sat fat, choline, manganese)", () => {
    // Sat fat: 10g / 20g = 50%
    expect(dailyValuePercent("saturatedFatG", 10)).toBe(50);
    // Choline: 275 / 550 = 50%
    expect(dailyValuePercent("cholineMg", 275)).toBe(50);
    // Manganese: 1.15 / 2.3 = 50%
    expect(dailyValuePercent("manganeseMg", 1.15)).toBe(50);
    // Iodine: 75 / 150 = 50%
    expect(dailyValuePercent("iodineMcg", 75)).toBe(50);
  });

  it("freezes the DV table to prevent runtime mutation", () => {
    expect(() => {
      // @ts-expect-error — DV table is intentionally frozen.
      DAILY_VALUES.fiberG = 999;
    }).toThrow();
  });

  it("publishes a stable source-attribution label", () => {
    expect(DAILY_VALUES_SOURCE_LABEL).toContain("FDA 2020");
    expect(DAILY_VALUES_SOURCE_LABEL).toContain("21 CFR 101.9(c)");
  });
});
