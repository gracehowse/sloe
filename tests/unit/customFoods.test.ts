/**
 * Pure-helper tests for custom foods (Batch 3.9).
 *
 * These cover the logic that silently powers scaling + dedupe + name
 * normalisation. If any of these drift, web vs mobile UIs can display
 * different macros for the same food — which is the failure mode we
 * most want to catch before it ships.
 */
import { describe, expect, it } from "vitest";
import {
  buildCustomFoodPortions,
  convertMacrosBetweenBases,
  customFoodToMacrosPer100g,
  customFoodToPrimaryServing,
  dedupeServings,
  normaliseCustomFoodName,
  resolvePortionToGrams,
  scaleMacrosForGrams,
  validateCustomFoodBarcode,
  type CustomFood,
} from "@/lib/nutrition/customFoods";

describe("scaleMacrosForGrams", () => {
  const food = {
    baseGrams: 100,
    calories: 400,
    protein: 10,
    carbs: 60,
    fat: 12,
  };

  it("scales linearly to the requested gram weight", () => {
    expect(scaleMacrosForGrams(food, 100)).toEqual({
      calories: 400,
      protein: 10,
      carbs: 60,
      fat: 12,
    });
    expect(scaleMacrosForGrams(food, 50)).toEqual({
      calories: 200,
      protein: 5,
      carbs: 30,
      fat: 6,
    });
    expect(scaleMacrosForGrams(food, 80)).toEqual({
      calories: 320,
      protein: 8,
      carbs: 48,
      fat: 9.6,
    });
  });

  it("rounds calories to integer and macros to one decimal", () => {
    const withDecimals = {
      baseGrams: 100,
      calories: 123.456,
      protein: 7.77,
      carbs: 3.333,
      fat: 1.111,
    };
    expect(scaleMacrosForGrams(withDecimals, 100)).toEqual({
      calories: 123,
      protein: 7.8,
      carbs: 3.3,
      fat: 1.1,
    });
  });

  it("returns zeros when grams is zero or negative (never NaN)", () => {
    expect(scaleMacrosForGrams(food, 0)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(scaleMacrosForGrams(food, -10)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("guards against baseGrams = 0 (never divides by zero, never invents)", () => {
    expect(scaleMacrosForGrams({ ...food, baseGrams: 0 }, 100)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("is NaN-safe across all inputs", () => {
    const out = scaleMacrosForGrams(
      // @ts-expect-error — testing runtime coercion of bad input
      { baseGrams: "oops", calories: Number.NaN, protein: null, carbs: undefined, fat: 0 },
      100,
    );
    expect(out).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    // @ts-expect-error — testing runtime coercion
    expect(scaleMacrosForGrams(food, "bad")).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("echoes fiber only when the source food has a numeric fiber", () => {
    // With fiber — scales and rounds.
    expect(scaleMacrosForGrams({ ...food, fiber: 6 }, 50)).toEqual({
      calories: 200,
      protein: 5,
      carbs: 30,
      fat: 6,
      fiber: 3,
    });
    // Without fiber — no fiber key on output.
    const out = scaleMacrosForGrams(food, 50);
    expect("fiber" in out).toBe(false);
    // Zero-grams path still echoes fiber key (so UI isn't shown a
    // disappearing column) — but as 0, not NaN.
    expect(scaleMacrosForGrams({ ...food, fiber: 6 }, 0)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    });
  });
});

describe("resolvePortionToGrams", () => {
  const food: Pick<CustomFood, "servings"> = {
    servings: [
      { label: "1 bowl", grams: 80 },
      { label: "1 tbsp", grams: 12 },
      { label: "1 cup", grams: 120 },
    ],
  };

  it("returns grams directly when the portion is a raw gram input", () => {
    expect(resolvePortionToGrams(food, { type: "grams", grams: 55 })).toBe(55);
  });

  it("clamps negative / non-finite grams to 0 for the grams branch", () => {
    expect(resolvePortionToGrams(food, { type: "grams", grams: -5 })).toBe(0);
    expect(
      // @ts-expect-error — testing runtime coercion
      resolvePortionToGrams(food, { type: "grams", grams: "bad" }),
    ).toBe(0);
  });

  it("resolves a named serving × quantity", () => {
    expect(
      resolvePortionToGrams(food, { type: "serving", label: "1 bowl", quantity: 2 }),
    ).toBe(160);
    expect(
      resolvePortionToGrams(food, { type: "serving", label: "1 tbsp", quantity: 3 }),
    ).toBe(36);
  });

  it("is case-insensitive on the label match", () => {
    expect(
      resolvePortionToGrams(food, { type: "serving", label: "1 BOWL", quantity: 1 }),
    ).toBe(80);
    expect(
      resolvePortionToGrams(food, { type: "serving", label: "  1 Cup  ", quantity: 1 }),
    ).toBe(120);
  });

  it("throws on an unknown serving label (fail-fast — never silently log 0)", () => {
    expect(() =>
      resolvePortionToGrams(food, { type: "serving", label: "1 scoop", quantity: 1 }),
    ).toThrow(/unknown serving label/);
  });

  it("throws on an empty serving label", () => {
    expect(() =>
      resolvePortionToGrams(food, { type: "serving", label: "", quantity: 1 }),
    ).toThrow(/serving label is required/);
  });

  it("returns 0 if quantity is zero or negative (never negative grams)", () => {
    expect(
      resolvePortionToGrams(food, { type: "serving", label: "1 bowl", quantity: 0 }),
    ).toBe(0);
    expect(
      resolvePortionToGrams(food, { type: "serving", label: "1 bowl", quantity: -2 }),
    ).toBe(0);
  });
});

describe("normaliseCustomFoodName", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normaliseCustomFoodName("  Homemade   granola  ")).toBe("Homemade granola");
    expect(normaliseCustomFoodName("Bread\n\trolls")).toBe("Bread rolls");
  });

  it("caps at 120 characters", () => {
    const long = "a".repeat(150);
    const out = normaliseCustomFoodName(long);
    expect(out.length).toBe(120);
    expect(out).toBe("a".repeat(120));
  });

  it("returns empty string for non-string / empty / whitespace-only input", () => {
    expect(normaliseCustomFoodName("")).toBe("");
    expect(normaliseCustomFoodName("     ")).toBe("");
    // @ts-expect-error — testing runtime coercion
    expect(normaliseCustomFoodName(undefined)).toBe("");
    // @ts-expect-error — testing runtime coercion
    expect(normaliseCustomFoodName(null)).toBe("");
    // @ts-expect-error — testing runtime coercion
    expect(normaliseCustomFoodName(123)).toBe("");
  });
});

describe("dedupeServings", () => {
  it("drops rows with empty labels or grams <= 0", () => {
    const out = dedupeServings([
      { label: "1 bowl", grams: 80 },
      { label: "", grams: 50 },
      { label: "  ", grams: 10 },
      { label: "1 scoop", grams: 0 },
      { label: "1 tbsp", grams: -5 },
      { label: "1 cup", grams: 120 },
    ]);
    expect(out.map((s) => s.label)).toEqual(["1 bowl", "1 cup"]);
  });

  it("dedupes case-insensitively, keeping the first occurrence", () => {
    const out = dedupeServings([
      { label: "1 Bowl", grams: 80 },
      { label: "1 BOWL", grams: 999 }, // ignored — duplicate
      { label: "1 bowl", grams: 999 }, // ignored — duplicate
      { label: "1 cup", grams: 120 },
    ]);
    expect(out).toEqual([
      { label: "1 Bowl", grams: 80 },
      { label: "1 cup", grams: 120 },
    ]);
  });

  it("collapses whitespace on labels so '1  bowl' dedupes against '1 bowl'", () => {
    const out = dedupeServings([
      { label: "1 bowl", grams: 80 },
      { label: "1  bowl", grams: 999 },
    ]);
    expect(out).toEqual([{ label: "1 bowl", grams: 80 }]);
  });

  it("returns an empty array for non-array / garbage input", () => {
    // @ts-expect-error — testing runtime coercion
    expect(dedupeServings(null)).toEqual([]);
    // @ts-expect-error — testing runtime coercion
    expect(dedupeServings(undefined)).toEqual([]);
    // @ts-expect-error — testing runtime coercion
    expect(dedupeServings([null, undefined, 42, "oops"])).toEqual([]);
  });

  it("rounds grams to two decimals (matches server-side tolerance)", () => {
    const out = dedupeServings([{ label: "1 bowl", grams: 80.12345 }]);
    expect(out).toEqual([{ label: "1 bowl", grams: 80.12 }]);
  });
});

// ── Food-search adapters (Batch 3.9 wire-up) ────────────────────────
//
// These helpers power the "Custom" rows + portion chips inside
// `FoodSearch.tsx` (web) and `FoodSearchModal.tsx` (mobile). They must
// agree to the byte so a homemade granola row doesn't scale to different
// macros on different platforms. If these tests drift, so does the UI.
describe("customFoodToMacrosPer100g", () => {
  it("is a no-op when macros already reference 100g", () => {
    expect(
      customFoodToMacrosPer100g({
        baseGrams: 100,
        calories: 400,
        protein: 10,
        carbs: 60,
        fat: 12,
      }),
    ).toEqual({
      calories: 400,
      protein: 10,
      carbs: 60,
      fat: 12,
      fiberG: 0,
      sugarG: 0,
      sodiumMg: 0,
    });
  });

  it("projects 80g-basis macros onto 100g (factor 1.25)", () => {
    expect(
      customFoodToMacrosPer100g({
        baseGrams: 80,
        calories: 200,
        protein: 8,
        carbs: 20,
        fat: 6,
        fiber: 4,
      }),
    ).toEqual({
      calories: 250,
      protein: 10,
      carbs: 25,
      fat: 7.5,
      fiberG: 5,
      sugarG: 0,
      sodiumMg: 0,
    });
  });

  it("falls back to a 100g basis when baseGrams is zero, negative or non-finite", () => {
    // Zero basis → fall back to 100 so we don't divide by zero.
    expect(
      customFoodToMacrosPer100g({
        baseGrams: 0,
        calories: 300,
        protein: 5,
        carbs: 40,
        fat: 10,
      }).calories,
    ).toBe(300);
    expect(
      customFoodToMacrosPer100g({
        baseGrams: -5,
        calories: 300,
        protein: 5,
        carbs: 40,
        fat: 10,
      }).calories,
    ).toBe(300);
    expect(
      customFoodToMacrosPer100g({
        baseGrams: Number.NaN,
        calories: 300,
        protein: 5,
        carbs: 40,
        fat: 10,
      }).calories,
    ).toBe(300);
  });

  it("echoes fiberG as 0 when the food has no saved fiber", () => {
    const out = customFoodToMacrosPer100g({
      baseGrams: 100,
      calories: 100,
      protein: 5,
      carbs: 10,
      fat: 2,
    });
    expect(out.fiberG).toBe(0);
    expect(out.sugarG).toBe(0);
    expect(out.sodiumMg).toBe(0);
  });

  it("rounds consistently with scaleMacrosForGrams so logs match previews", () => {
    const food = {
      baseGrams: 30,
      calories: 133,
      protein: 4.7,
      carbs: 24.2,
      fat: 1.1,
    };
    const per100 = customFoodToMacrosPer100g(food);
    // A 30g portion should re-derive the original macros (mod rounding).
    expect(per100.calories).toBeCloseTo(Math.round((133 / 30) * 100), 0);
    expect(per100.protein).toBeCloseTo(Math.round((4.7 / 30) * 100 * 10) / 10, 1);
  });
});

describe("buildCustomFoodPortions", () => {
  it("always exposes grams as the first chip so users can log any weight", () => {
    const out = buildCustomFoodPortions({ servings: [] });
    expect(out).toEqual([{ label: "g", gramWeight: 1, amount: 1 }]);
  });

  it("appends one chip per saved serving in order", () => {
    const out = buildCustomFoodPortions({
      servings: [
        { label: "1 bowl", grams: 80 },
        { label: "1 cup", grams: 120 },
      ],
    });
    expect(out).toEqual([
      { label: "g", gramWeight: 1, amount: 1 },
      { label: "1 bowl", gramWeight: 80, amount: 1 },
      { label: "1 cup", gramWeight: 120, amount: 1 },
    ]);
  });

  it("drops empty labels and non-positive gram weights via dedupeServings", () => {
    const out = buildCustomFoodPortions({
      servings: [
        { label: "", grams: 80 },
        { label: "  ", grams: 50 },
        { label: "1 bowl", grams: 0 },
        { label: "1 bowl", grams: -5 },
        { label: "1 bowl", grams: 80 },
      ],
    });
    expect(out).toEqual([
      { label: "g", gramWeight: 1, amount: 1 },
      { label: "1 bowl", gramWeight: 80, amount: 1 },
    ]);
  });

  it("dedupes servings case-insensitively so '1 BOWL' cannot shadow '1 bowl'", () => {
    const out = buildCustomFoodPortions({
      servings: [
        { label: "1 bowl", grams: 80 },
        { label: "1 BOWL", grams: 999 },
      ],
    });
    expect(out).toEqual([
      { label: "g", gramWeight: 1, amount: 1 },
      { label: "1 bowl", gramWeight: 80, amount: 1 },
    ]);
  });

  it("treats missing `servings` as an empty array (never throws)", () => {
    // Rare but possible: a partially-hydrated row from a stale cache.
    const out = buildCustomFoodPortions({ servings: undefined as unknown as CustomFood["servings"] });
    expect(out).toEqual([{ label: "g", gramWeight: 1, amount: 1 }]);
  });
});

// ── Barcode validation ──────────────────────────────────────────────
//
// TestFlight `AE52_fIRZ-ZIupmoJ8T4yaI` (2026-04-19). Users told us the
// custom-food form was missing a barcode field. We accept only the four
// GTIN lengths (EAN-8, UPC-A, EAN-13, GTIN-14) and reject anything else
// with an inline error. Empty is OK — the form is optional.
describe("validateCustomFoodBarcode", () => {
  it("accepts empty / whitespace / nullish as 'leave unset'", () => {
    expect(validateCustomFoodBarcode("")).toEqual({ ok: true, value: undefined });
    expect(validateCustomFoodBarcode("   ")).toEqual({ ok: true, value: undefined });
    expect(validateCustomFoodBarcode(null)).toEqual({ ok: true, value: undefined });
    expect(validateCustomFoodBarcode(undefined)).toEqual({ ok: true, value: undefined });
  });

  it("accepts the four allowed GTIN lengths (8 / 12 / 13 / 14) and trims", () => {
    expect(validateCustomFoodBarcode("12345678")).toEqual({
      ok: true,
      value: "12345678",
    });
    expect(validateCustomFoodBarcode(" 012345678905 ")).toEqual({
      ok: true,
      value: "012345678905",
    });
    expect(validateCustomFoodBarcode("5012345678900")).toEqual({
      ok: true,
      value: "5012345678900",
    });
    expect(validateCustomFoodBarcode("12345678901234")).toEqual({
      ok: true,
      value: "12345678901234",
    });
  });

  it("rejects lengths outside the GTIN set", () => {
    // 7 chars — too short.
    expect(validateCustomFoodBarcode("1234567")).toMatchObject({ ok: false });
    // 9 chars — neither EAN-8 nor UPC-A.
    expect(validateCustomFoodBarcode("123456789")).toMatchObject({ ok: false });
    // 15 chars — over GTIN-14.
    expect(validateCustomFoodBarcode("123456789012345")).toMatchObject({ ok: false });
  });

  it("rejects non-digit input and internal whitespace, with user-facing copy", () => {
    const hyphen = validateCustomFoodBarcode("012-345-678-905");
    expect(hyphen.ok).toBe(false);
    if (!hyphen.ok) {
      expect(hyphen.reason).toBe(
        "Enter a valid 8, 12, 13, or 14-digit barcode, or leave blank.",
      );
    }
    expect(validateCustomFoodBarcode("abcd1234")).toMatchObject({ ok: false });
    // Internal whitespace after trim is still rejected (digits-only regex).
    expect(validateCustomFoodBarcode("123 4567")).toMatchObject({ ok: false });
    // Empty-after-digits is the unset path, not an error.
    expect(validateCustomFoodBarcode("\t")).toEqual({ ok: true, value: undefined });
  });
});

// ── customFoodToMacrosPer100g respects new micros ───────────────────
//
// Sugar + sodium round-trip through the per-100g projection so search
// rows + log-time scaling don't silently zero out what the user saved.
describe("customFoodToMacrosPer100g — sugar / sodium passthrough", () => {
  it("scales sugar (1dp) and sodium (integer mg) alongside macros", () => {
    const out = customFoodToMacrosPer100g({
      baseGrams: 80,
      calories: 200,
      protein: 8,
      carbs: 20,
      fat: 6,
      sugarG: 4,
      sodiumMg: 160,
    });
    // 100 / 80 = 1.25 factor applied to every value.
    expect(out.sugarG).toBe(5);
    expect(out.sodiumMg).toBe(200);
  });

  it("echoes sugar / sodium as 0 when the food has no saved values", () => {
    const out = customFoodToMacrosPer100g({
      baseGrams: 100,
      calories: 100,
      protein: 5,
      carbs: 10,
      fat: 2,
    });
    expect(out.sugarG).toBe(0);
    expect(out.sodiumMg).toBe(0);
  });
});

// ── Natural serving → PrimaryServing (A2 × B integration) ───────────
//
// TestFlight `AE52_fIRZ-ZIupmoJ8T4yaI` (fix B) wires fix A2's natural-
// portion primary display into custom foods. A custom food saved with
// `servings: [{label:"1 slice", grams:30}]` and per-100g macros of
// `400 kcal / 10 P / 60 C / 12 F` must surface a PrimaryServing with
// the same per-portion numbers in both the search row and the picker.
describe("customFoodToPrimaryServing", () => {
  const granola = {
    baseGrams: 100,
    calories: 400,
    protein: 10,
    carbs: 60,
    fat: 12,
    servings: [{ label: "1 slice", grams: 30 }],
  };

  it("derives a PrimaryServing from the first saved serving", () => {
    expect(customFoodToPrimaryServing(granola)).toEqual({
      label: "1 slice",
      grams: 30,
      kcal: 120,
      protein: 3,
      carbs: 18,
      fat: 3.6,
    });
  });

  it("scales from a non-100g base using the per-100g projection", () => {
    // 30g → 400kcal means per-100g rounds to 1333. A "1 bowl = 80 g"
    // portion then scales to 1333 × 0.8 = 1066.4, rounded to 1066.
    // Pins the two-step (baseGrams → per100g → portion) rounding path
    // so custom-food search rows and per-portion previews agree to the
    // byte with the same path USDA/OFF use.
    const food = {
      baseGrams: 30,
      calories: 400,
      protein: 6,
      carbs: 70,
      fat: 10,
      servings: [{ label: "1 bowl", grams: 80 }],
    };
    const out = customFoodToPrimaryServing(food);
    expect(out).not.toBeNull();
    expect(out!.label).toBe("1 bowl");
    expect(out!.grams).toBe(80);
    expect(out!.kcal).toBe(1066);
  });

  it("returns null when the food has no servings (fall back to /100g display)", () => {
    expect(
      customFoodToPrimaryServing({
        baseGrams: 100,
        calories: 400,
        protein: 10,
        carbs: 60,
        fat: 12,
        servings: [],
      }),
    ).toBeNull();
  });

  it("ignores invalid first servings (empty label / 0 grams) and falls back", () => {
    expect(
      customFoodToPrimaryServing({
        baseGrams: 100,
        calories: 400,
        protein: 10,
        carbs: 60,
        fat: 12,
        servings: [{ label: "  ", grams: 30 }],
      }),
    ).toBeNull();
    expect(
      customFoodToPrimaryServing({
        baseGrams: 100,
        calories: 400,
        protein: 10,
        carbs: 60,
        fat: 12,
        servings: [{ label: "1 slice", grams: 0 }],
      }),
    ).toBeNull();
  });

  it("preserves the label casing the user saved (no forced lowercase)", () => {
    const out = customFoodToPrimaryServing({
      baseGrams: 100,
      calories: 100,
      protein: 1,
      carbs: 20,
      fat: 1,
      servings: [{ label: "1 Slice", grams: 30 }],
    });
    expect(out?.label).toBe("1 Slice");
  });
});

describe("convertMacrosBetweenBases (F-156 PR-1)", () => {
  const perServing = { calories: 220, protein: 8, carbs: 28, fat: 9, fiber: 3 };

  it("returns input unchanged when from === to", () => {
    expect(convertMacrosBetweenBases(perServing, "per_serving", "per_serving", 30)).toEqual(perServing);
    expect(convertMacrosBetweenBases(perServing, "per_100g", "per_100g", 30)).toEqual(perServing);
  });

  it("scales per_serving → per_100g by 100/servingGrams", () => {
    // 30g serving × (100/30) = 333% — calories 220 → ~733
    const out = convertMacrosBetweenBases(perServing, "per_serving", "per_100g", 30);
    expect(out.calories).toBe(733);
    expect(out.protein).toBeCloseTo(26.7, 1);
    expect(out.carbs).toBeCloseTo(93.3, 1);
    expect(out.fat).toBe(30);
    expect(out.fiber).toBe(10);
  });

  it("scales per_100g → per_serving by servingGrams/100", () => {
    const per100g = { calories: 733, protein: 26.7, carbs: 93.3, fat: 30, fiber: 10 };
    const out = convertMacrosBetweenBases(per100g, "per_100g", "per_serving", 30);
    expect(out.calories).toBe(220);
    expect(out.protein).toBeCloseTo(8, 1);
    expect(out.carbs).toBeCloseTo(28, 1);
    expect(out.fat).toBe(9);
    expect(out.fiber).toBe(3);
  });

  it("round-trip per_serving → per_100g → per_serving is stable", () => {
    const there = convertMacrosBetweenBases(perServing, "per_serving", "per_100g", 30);
    const back = convertMacrosBetweenBases(there, "per_100g", "per_serving", 30);
    expect(back.calories).toBe(perServing.calories);
    expect(back.protein).toBeCloseTo(perServing.protein, 1);
    expect(back.carbs).toBeCloseTo(perServing.carbs, 1);
    expect(back.fat).toBe(perServing.fat);
    expect(back.fiber).toBe(perServing.fiber);
  });

  it("returns input unchanged when servingGrams is 0 (caller must gate the toggle)", () => {
    expect(convertMacrosBetweenBases(perServing, "per_serving", "per_100g", 0)).toEqual(perServing);
  });

  it("returns input unchanged when servingGrams is negative or non-finite", () => {
    expect(convertMacrosBetweenBases(perServing, "per_serving", "per_100g", -1)).toEqual(perServing);
    expect(convertMacrosBetweenBases(perServing, "per_serving", "per_100g", NaN)).toEqual(perServing);
  });

  it("never returns NaN or negative values for any input", () => {
    const out = convertMacrosBetweenBases(
      { calories: -50, protein: -5, carbs: -10, fat: -2, fiber: -1 },
      "per_serving",
      "per_100g",
      30,
    );
    expect(out.calories).toBe(0);
    expect(out.protein).toBe(0);
    expect(out.carbs).toBe(0);
    expect(out.fat).toBe(0);
    expect(out.fiber).toBe(0);
  });

  it("identity case: 100g serving converts 1:1 in either direction", () => {
    const out = convertMacrosBetweenBases(perServing, "per_serving", "per_100g", 100);
    expect(out).toEqual(perServing);
  });
});
