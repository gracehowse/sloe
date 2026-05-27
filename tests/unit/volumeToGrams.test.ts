/**
 * ENG-748 #15 (2026-05-27) — density-aware volume→grams converter for
 * custom-food entry (MFP-parity gap).
 *
 * Nutrition-correctness contract:
 *   - Convert ONLY when the food's density is known (resolved from the
 *     existing sourced STAPLES table). Different foods at the same volume
 *     weigh very differently — a cup of flour (~125 g) is nothing like a
 *     cup of water (~237 g).
 *   - When density is unknown, REFUSE to convert (no guessed water density)
 *     so the UI falls back to manual grams.
 *
 * Constants under test (single source of truth in measureToGrams):
 *   US cup = 236.588 ml · tbsp = 14.7868 ml · tsp = 4.92892 ml
 */
import { describe, expect, it } from "vitest";

import { isVolumeUnit, volumeToGrams, VOLUME_UNITS } from "@/lib/nutrition/volumeToGrams";

describe("isVolumeUnit", () => {
  it("recognises the supported volume units (case-insensitive)", () => {
    for (const u of VOLUME_UNITS) {
      expect(isVolumeUnit(u)).toBe(true);
      expect(isVolumeUnit(u.toUpperCase())).toBe(true);
    }
  });

  it("rejects mass / count units", () => {
    expect(isVolumeUnit("g")).toBe(false);
    expect(isVolumeUnit("oz")).toBe(false);
    expect(isVolumeUnit("slice")).toBe(false);
    expect(isVolumeUnit("")).toBe(false);
  });
});

describe("volumeToGrams — known density", () => {
  it("converts 1 cup of water at 1.0 g/ml (≈237 g)", () => {
    const r = volumeToGrams({ foodName: "water", amount: 1, unit: "cup" });
    expect(r.densityKnown).toBe(true);
    if (r.densityKnown) {
      expect(r.gPerMl).toBe(1.0);
      // 236.588 × 1.0 → 236.6
      expect(r.grams).toBeCloseTo(236.6, 1);
    }
  });

  it("converts 1 cup of flour at 0.53 g/ml — NOT water density", () => {
    const r = volumeToGrams({ foodName: "plain flour", amount: 1, unit: "cup" });
    expect(r.densityKnown).toBe(true);
    if (r.densityKnown) {
      expect(r.gPerMl).toBe(0.53);
      // 236.588 × 0.53 = 125.39 → 125.4 (and emphatically not 236.6)
      expect(r.grams).toBeCloseTo(125.4, 1);
      expect(r.grams).toBeLessThan(150);
    }
  });

  it("converts 1 tbsp of olive oil at 0.92 g/ml", () => {
    const r = volumeToGrams({ foodName: "olive oil", amount: 1, unit: "tbsp" });
    expect(r.densityKnown).toBe(true);
    if (r.densityKnown) {
      // 14.7868 × 0.92 = 13.6
      expect(r.grams).toBeCloseTo(13.6, 1);
    }
  });

  it("scales with the amount (2 cups milk = 2× one cup)", () => {
    const one = volumeToGrams({ foodName: "milk", amount: 1, unit: "cup" });
    const two = volumeToGrams({ foodName: "milk", amount: 2, unit: "cup" });
    if (one.densityKnown && two.densityKnown) {
      expect(two.grams).toBeCloseTo(one.grams * 2, 1);
    } else {
      throw new Error("expected milk density to be known");
    }
  });
});

describe("volumeToGrams — unknown density refuses to guess", () => {
  it("returns densityKnown:false for an unrecognised food (no water fallback)", () => {
    const r = volumeToGrams({ foodName: "homemade granola blend", amount: 1, unit: "cup" });
    expect(r).toEqual({ densityKnown: false });
  });

  it("returns densityKnown:false for an empty food name", () => {
    expect(volumeToGrams({ foodName: "", amount: 1, unit: "cup" })).toEqual({
      densityKnown: false,
    });
  });

  it("returns densityKnown:false for a non-positive amount", () => {
    expect(volumeToGrams({ foodName: "water", amount: 0, unit: "cup" })).toEqual({
      densityKnown: false,
    });
    expect(volumeToGrams({ foodName: "water", amount: -2, unit: "tbsp" })).toEqual({
      densityKnown: false,
    });
  });
});
