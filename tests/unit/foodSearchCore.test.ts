import { describe, it, expect } from "vitest";
import {
  resolveInitialPortion,
  buildPortions,
  STANDARD_UNITS,
  customFoodToHit,
  type FoodPortion,
} from "../../src/lib/nutrition/foodSearchCore";
import type { CustomFood } from "../../src/lib/nutrition/customFoods";

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

describe("STANDARD_UNITS", () => {
  it("includes g, oz, lb, tbsp, tsp, cup, ml in that order", () => {
    expect(STANDARD_UNITS.map((u) => u.label)).toEqual([
      "g", "oz", "lb", "tbsp", "tsp", "cup", "ml",
    ]);
  });

  it("uses gramWeight: 1 for the gram basis units (g, ml)", () => {
    expect(STANDARD_UNITS.find((u) => u.label === "g")?.gramWeight).toBe(1);
    expect(STANDARD_UNITS.find((u) => u.label === "ml")?.gramWeight).toBe(1);
  });

  it("has the canonical conversion factors", () => {
    const byLabel = Object.fromEntries(STANDARD_UNITS.map((u) => [u.label, u.gramWeight]));
    expect(byLabel.oz).toBe(28.35);
    expect(byLabel.lb).toBe(453.59);
    expect(byLabel.tbsp).toBe(14.79);
    expect(byLabel.tsp).toBe(4.93);
    expect(byLabel.cup).toBe(236.59);
  });
});

describe("buildPortions", () => {
  it("starts with the standard units when no primary serving + no api portions", () => {
    const out = buildPortions([], null);
    expect(out).toEqual(STANDARD_UNITS);
  });

  it("puts the primary serving first when provided", () => {
    const primary = {
      label: "1 package",
      grams: 100,
      kcal: 350,
      protein: 13,
      carbs: 42,
      fat: 8,
      fiber: 3,
      sugar: 11,
      sodium: 760,
    };
    const out = buildPortions([], primary);
    expect(out[0]?.label).toBe("1 package");
  });

  it("appends API portions that aren't in standard or primary", () => {
    const apiPortions: FoodPortion[] = [
      { label: "slice", gramWeight: 25, amount: 1 },
      { label: "rasher", gramWeight: 28, amount: 1 },
    ];
    const out = buildPortions(apiPortions, null);
    expect(out.map((u) => u.label)).toContain("slice");
    expect(out.map((u) => u.label)).toContain("rasher");
  });

  it("dedups case-insensitively — duplicate labels are dropped", () => {
    const apiPortions: FoodPortion[] = [
      { label: "G", gramWeight: 1, amount: 1 }, // already in STANDARD_UNITS as 'g'
      { label: "TBSP", gramWeight: 14.79, amount: 1 }, // already in STANDARD_UNITS as 'tbsp'
    ];
    const out = buildPortions(apiPortions, null);
    expect(out.length).toBe(STANDARD_UNITS.length);
  });

  it("skips the historical '100 g' USDA placeholder portion", () => {
    const apiPortions: FoodPortion[] = [
      { label: "100 g", gramWeight: 100, amount: 1 },
      { label: "slice", gramWeight: 25, amount: 1 },
    ];
    const out = buildPortions(apiPortions, null);
    expect(out.map((u) => u.label)).not.toContain("100 g");
    expect(out.map((u) => u.label)).toContain("slice");
  });

  it("dedups standard units against the primary serving label", () => {
    const primary = {
      label: "g", // collides with STANDARD_UNITS[0].label
      grams: 100,
      kcal: 350,
      protein: 13,
      carbs: 42,
      fat: 8,
      fiber: 3,
      sugar: 11,
      sodium: 760,
    };
    const out = buildPortions([], primary);
    // Only one 'g' in result — the primary serving's
    const gCount = out.filter((u) => u.label.toLowerCase() === "g").length;
    expect(gCount).toBe(1);
  });
});

describe("customFoodToHit", () => {
  // Minimal CustomFood fixture — only the fields the helper reads.
  // The real type has many more (visibility, evidence_url, etc.) but
  // the helper just touches `id`, `name`, `brand`, and macros via the
  // downstream `customFoodToMacrosPer100g` / `customFoodToPrimaryServing`
  // helpers (which are exercised by their own test files).
  const baseFood: CustomFood = {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: "00000000-0000-0000-0000-000000000000",
    name: "Posh Cheddar",
    brand: null,
    barcode: null,
    serving_label: null,
    serving_grams: null,
    serving_ml: null,
    calories: 400,
    protein: 25,
    carbs: 1,
    fat: 33,
    fiber_g: 0,
    sugar_g: 0.5,
    sodium_mg: 700,
    serving_basis: "per_100g",
    visibility: "private",
    upvotes: 0,
    downvotes: 0,
    flagged_count: 0,
    flagged_for_admin_at: null,
    evidence_url: null,
    submission_method: null,
    verified: false,
    archived_at: null,
    created_at: "2026-05-16T00:00:00Z",
    updated_at: "2026-05-16T00:00:00Z",
  } as unknown as CustomFood;

  it("produces a CUSTOM-sourced row with key prefixed `custom-{id}`", () => {
    const hit = customFoodToHit(baseFood);
    expect(hit.key).toBe("custom-11111111-1111-1111-1111-111111111111");
    expect(hit._source).toBe("CUSTOM");
    expect(hit._custom).toBe(baseFood);
    expect(hit.verified).toBe(false);
  });

  it("uses the food name as display name when there's no brand", () => {
    expect(customFoodToHit(baseFood).name).toBe("Posh Cheddar");
  });

  it("formats display as `{name} · {brand}` when brand is set", () => {
    const branded = { ...baseFood, brand: "Pret" } as unknown as CustomFood;
    expect(customFoodToHit(branded).name).toBe("Posh Cheddar · Pret");
  });

  it("surfaces calsPer100g + macrosPer100g via the per-100g helper", () => {
    const hit = customFoodToHit(baseFood);
    expect(hit.calsPer100g).toBe(hit.macrosPer100g.calories);
    expect(hit.macrosPer100g.protein).toBe(25);
    expect(hit.macrosPer100g.carbs).toBe(1);
  });
});
