import { describe, it, expect } from "vitest";
import {
  resolveInitialPortion,
  type FoodPortion,
} from "../../src/lib/nutrition/foodSearchCore";

/**
 * 2026-05-15 (ENG-550) — pins `resolveInitialPortion` once for both
 * platforms. Before this extract, web + mobile had byte-identical copies
 * of this function. Behaviour is unchanged; the test suite locks the
 * resolution order so a future change can't silently regress either
 * surface.
 */
describe("resolveInitialPortion", () => {
  const portions: FoodPortion[] = [
    { label: "g", gramWeight: 1, amount: 1 },
    { label: "oz", gramWeight: 28.35, amount: 1 },
    { label: "lb", gramWeight: 453.59, amount: 1 },
    { label: "cup", gramWeight: 236.59, amount: 1 },
    { label: "tbsp", gramWeight: 14.79, amount: 1 },
    { label: "tsp", gramWeight: 4.93, amount: 1 },
  ];

  describe("no unit (fallback to grams)", () => {
    it("defaults to 100 g when amount is null", () => {
      expect(resolveInitialPortion(portions, null, null)).toEqual({
        portion: portions[0],
        quantity: 100,
      });
    });

    it("defaults to 100 g when amount is small (<=10)", () => {
      expect(resolveInitialPortion(portions, 1, "")).toEqual({
        portion: portions[0],
        quantity: 100,
      });
    });

    it("uses the parsed amount when it looks like grams (>10)", () => {
      expect(resolveInitialPortion(portions, 150, undefined)).toEqual({
        portion: portions[0],
        quantity: 150,
      });
    });

    it("parses string amounts (the web parseFloat path)", () => {
      expect(resolveInitialPortion(portions, "200", null)).toEqual({
        portion: portions[0],
        quantity: 200,
      });
    });

    it("falls back to the first portion when grams unavailable", () => {
      const noGrams = portions.slice(1);
      expect(resolveInitialPortion(noGrams, null, null).portion).toEqual(noGrams[0]);
    });
  });

  describe("UNIT_TO_LABEL mapping", () => {
    it("maps 'gram' / 'grams' → 'g'", () => {
      expect(resolveInitialPortion(portions, 50, "gram")).toEqual({
        portion: portions[0],
        quantity: 50,
      });
      expect(resolveInitialPortion(portions, 50, "grams")).toEqual({
        portion: portions[0],
        quantity: 50,
      });
    });

    it("maps 'ounce' / 'ounces' → 'oz'", () => {
      expect(resolveInitialPortion(portions, 2, "ounce").portion.label).toBe("oz");
      expect(resolveInitialPortion(portions, 2, "ounces").portion.label).toBe("oz");
    });

    it("maps 'tablespoon' / 'tablespoons' → 'tbsp'", () => {
      expect(resolveInitialPortion(portions, 2, "tablespoon").portion.label).toBe("tbsp");
    });

    it("treats 'kg' as grams × 1000", () => {
      expect(resolveInitialPortion(portions, 2, "kg")).toEqual({
        portion: portions[0],
        quantity: 2000,
      });
    });

    it("is case-insensitive for the unit string", () => {
      expect(resolveInitialPortion(portions, 1, "TBSP").portion.label).toBe("tbsp");
    });
  });

  describe("direct portion-label match", () => {
    it("matches an arbitrary portion label exactly (case-insensitive)", () => {
      const customPortions: FoodPortion[] = [
        ...portions,
        { label: "slice", gramWeight: 25, amount: 1 },
      ];
      expect(resolveInitialPortion(customPortions, 3, "Slice").portion.label).toBe("slice");
    });
  });

  describe("UNIT_GRAMS conversion fallback", () => {
    it("converts a chicken-breast unit to grams when no direct portion match exists", () => {
      // No 'breast' portion in the list → falls through to UNIT_GRAMS (200g) → grams portion
      expect(resolveInitialPortion(portions, 2, "breast")).toEqual({
        portion: portions[0],
        quantity: 400,
      });
    });

    it("converts a 'medium' unit to grams (~110g)", () => {
      expect(resolveInitialPortion(portions, 1, "medium")).toEqual({
        portion: portions[0],
        quantity: 110,
      });
    });

    it("converts 'fl oz' to grams via the gram table (no fl oz portion in list)", () => {
      // 'fl oz' is in UNIT_TO_LABEL → no portion match → falls through to
      // UNIT_GRAMS (29.57 g/fl oz) → grams portion. 4 fl oz = ~118 g.
      expect(resolveInitialPortion(portions, 4, "fl oz")).toEqual({
        portion: portions[0],
        quantity: 118,
      });
    });
  });

  describe("ultimate fallback", () => {
    it("returns the first portion + raw amount when nothing else matches", () => {
      expect(resolveInitialPortion(portions, 3, "totally-unknown-unit")).toEqual({
        portion: portions[0],
        quantity: 3,
      });
    });
  });
});
