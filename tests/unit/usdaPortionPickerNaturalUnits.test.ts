/**
 * F-88 (2026-04-25) — pin USDA portion picker so single-unit foods
 * (eggs, bananas, apples, oranges) default to a natural unit ("1 medium",
 * "1 large", "1 whole") rather than the FDA "NLEA serving" jargon row
 * that USDA returns first.
 *
 * Bug: tester searched "eggs" / "banana" and saw the picker default to
 * grams (or to "1 NLEA serving"). USDA's `foodPortions[]` array for
 * SR Legacy bananas (fdcId 173944) starts with `modifier: "NLEA serving"`
 * (126g) — the FDA Nutrition-Facts-label standard serving — and includes
 * "medium (7\" to 7-7/8\" long)" / "large" / "small" rows further down.
 * The previous picker took the first non-blocklisted row, so it picked
 * NLEA. Worse, the label assembly used `measureUnit.name` literally,
 * which on USDA non-branded rows is the string "undetermined", leaking
 * into the chip text as "1 undetermined NLEA serving".
 *
 * Fix: score-based picker that
 *   - rejects NLEA / household-reference rows,
 *   - boosts rows whose modifier reads as a natural unit,
 *   - strips parenthetical size hints and the "undetermined" measureUnit
 *     from the assembled label.
 */
import { describe, expect, it } from "vitest";
import {
  pickUsdaFoodPortionsPrimaryServing,
  type UsdaFoodPortion,
} from "@/lib/nutrition/primaryServing";

const BANANA_PER_100G = { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 };

// Real foodPortions[] from USDA SR Legacy fdcId 173944 ("Bananas, raw").
const BANANA_PORTIONS: UsdaFoodPortion[] = [
  { amount: 1, measureUnit: { name: "undetermined" }, modifier: "NLEA serving", gramWeight: 126 },
  { amount: 1, measureUnit: { name: "undetermined" }, modifier: 'extra large (9" or longer)', gramWeight: 152 },
  { amount: 1, measureUnit: { name: "undetermined" }, modifier: 'large (8" to 8-7/8" long)', gramWeight: 136 },
  { amount: 1, measureUnit: { name: "undetermined" }, modifier: "cup, sliced", gramWeight: 150 },
  { amount: 1, measureUnit: { name: "undetermined" }, modifier: 'small (6" to 6-7/8" long)', gramWeight: 101 },
  { amount: 1, measureUnit: { name: "undetermined" }, modifier: 'extra small (less than 6" long)', gramWeight: 81 },
  { amount: 1, measureUnit: { name: "undetermined" }, modifier: 'medium (7" to 7-7/8" long)', gramWeight: 118 },
  { amount: 1, measureUnit: { name: "undetermined" }, modifier: "cup, mashed", gramWeight: 225 },
];

describe("F-88 — USDA portion picker prefers natural units", () => {
  it("picks 'medium' over NLEA serving for bananas", () => {
    const ps = pickUsdaFoodPortionsPrimaryServing(BANANA_PER_100G, BANANA_PORTIONS);
    expect(ps).not.toBeNull();
    expect(ps!.label).toBe("1 medium");
    expect(ps!.grams).toBe(118);
  });

  it("strips 'undetermined' measureUnit and parenthetical size from label", () => {
    const ps = pickUsdaFoodPortionsPrimaryServing(BANANA_PER_100G, BANANA_PORTIONS);
    expect(ps!.label).not.toContain("undetermined");
    expect(ps!.label).not.toContain("(7");
    expect(ps!.label).not.toMatch(/\d"/);
  });

  it("scales kcal correctly to the chosen natural portion", () => {
    const ps = pickUsdaFoodPortionsPrimaryServing(BANANA_PER_100G, BANANA_PORTIONS);
    // 89 kcal/100g * 118g/100 = 105 kcal
    expect(ps!.kcal).toBe(105);
  });

  it("returns null when every row is NLEA / placeholder", () => {
    const onlyPlaceholders: UsdaFoodPortion[] = [
      { amount: 1, measureUnit: { name: "undetermined" }, modifier: "NLEA serving", gramWeight: 30 },
      { amount: 1, measureUnit: { name: "undetermined" }, modifier: "Quantity not specified", gramWeight: 100 },
    ];
    const ps = pickUsdaFoodPortionsPrimaryServing({ calories: 100, protein: 5, carbs: 5, fat: 5 }, onlyPlaceholders);
    expect(ps).toBeNull();
  });

  it("falls through to a generic but usable row when no preferred modifier matches", () => {
    const generic: UsdaFoodPortion[] = [
      { amount: 1, measureUnit: { name: "undetermined" }, modifier: "NLEA serving", gramWeight: 30 },
      { amount: 1, measureUnit: { name: "undetermined" }, modifier: "fillet", gramWeight: 170 },
    ];
    const ps = pickUsdaFoodPortionsPrimaryServing(BANANA_PER_100G, generic);
    expect(ps).not.toBeNull();
    expect(ps!.label).toBe("1 fillet");
    expect(ps!.grams).toBe(170);
  });

  it("prefers 'large' when no 'medium' is present", () => {
    const noMedium = BANANA_PORTIONS.filter((p) => !/medium/i.test(p.modifier ?? ""));
    const ps = pickUsdaFoodPortionsPrimaryServing(BANANA_PER_100G, noMedium);
    expect(ps!.label).toBe("1 large");
    expect(ps!.grams).toBe(136);
  });

  it("works on real-shape egg portions (Foundation 'Eggs, Grade A, Large, egg whole')", () => {
    // Reasonable shape: one 'large' modifier row and an NLEA row.
    const eggPortions: UsdaFoodPortion[] = [
      { amount: 1, measureUnit: { name: "undetermined" }, modifier: "NLEA serving", gramWeight: 50 },
      { amount: 1, measureUnit: { name: "undetermined" }, modifier: "large", gramWeight: 50 },
      { amount: 1, measureUnit: { name: "undetermined" }, modifier: "extra large", gramWeight: 56 },
    ];
    const ps = pickUsdaFoodPortionsPrimaryServing({ calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }, eggPortions);
    expect(ps!.label).toBe("1 large");
    expect(ps!.grams).toBe(50);
  });
});
