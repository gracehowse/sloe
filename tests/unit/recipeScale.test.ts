/**
 * Recipe scaling helpers — pure logic tests (Paprika parity, 2026-04-30).
 *
 * `src/lib/nutrition/recipeScale.ts` is the shared module that powers
 * the Cook-screen scale segmented control on both web (`CookMode.tsx`)
 * and mobile (`apps/mobile/app/cook.tsx`). The amount-rewriting logic
 * is the load-bearing surface — getting it wrong corrupts a recipe
 * mid-cook. The cases below pin the rules:
 *
 *   1. Cooking units scale ("2 cups", "1/2 tbsp", "½ tsp").
 *   2. Count nouns scale ("3 eggs", "1 onion").
 *   3. Time / temperature does NOT scale ("25 minutes", "350°F",
 *      "350 F").
 *   4. Bare integers without a unit / noun (e.g. "Step 1:", "8
 *      servings") do NOT scale — too many false positives.
 *   5. Range forms scale both ends ("1-2 cloves" → "2-4 cloves" at 2x).
 *   6. Vulgar fractions render back as ASCII ("1/4 tsp" at 2x → "1/2
 *      tsp"; "½ tsp" at 2x → "1 tsp").
 *   7. Mixed fractions parse + scale ("1 1/2 cups" at 2x → "3 cups").
 *   8. Non-finite / 0 / negative factors no-op (input returned).
 *
 * `formatScaledAmount` is also pinned — common cookbook idioms
 * (1/2, 1/3, 1/4, 3/4, mixed) must round-trip.
 *
 * `cookScaleStorageKey` separates anonymous from signed-in users so a
 * shared device cannot leak scale across accounts.
 */
import { describe, expect, it } from "vitest";

import {
  COOK_SCALE_PRESETS,
  clampCookScale,
  cookScaleCaption,
  cookScaleStorageKey,
  formatCookScaleLabel,
  formatScaledAmount,
  scaleAmountText,
} from "@/lib/nutrition/recipeScale";

describe("COOK_SCALE_PRESETS", () => {
  it("offers the six presets in ascending order, with 1 as default", () => {
    // The presets are part of the user-facing UX (segmented control)
    // AND part of the persisted scale factor in recipe_cook_history.
    // Re-ordering or extending here MUST be coordinated with the DB
    // CHECK constraint allowance (currently 0..99).
    //
    // User-sentiment audit (round 4, 2026-04-30): added 3x so a
    // 2-serving recipe scales cleanly to 6 (a household pan)
    // without forcing the user to pick 4x and over-cook.
    expect(COOK_SCALE_PRESETS).toEqual([0.5, 1, 1.5, 2, 3, 4]);
  });

  it("always includes 1x — the unscaled default", () => {
    // `1` must be a member because `clampCookScale` falls back to 1
    // for any non-preset value. If the preset list ever drops 1,
    // `clampCookScale(1)` would clamp to 1 anyway, but the
    // segmented-control caller renders ONE pill per preset and
    // would silently lose the unscaled option from the UI.
    expect(COOK_SCALE_PRESETS).toContain(1);
  });
});

describe("clampCookScale", () => {
  it("returns the input verbatim for any preset", () => {
    for (const p of COOK_SCALE_PRESETS) {
      expect(clampCookScale(p)).toBe(p);
    }
  });
  it("falls back to 1 for non-preset numbers (no silent rounding)", () => {
    expect(clampCookScale(0.7)).toBe(1);
    expect(clampCookScale(2.5)).toBe(1);
    // 3 IS a preset now (round 4, 2026-04-30) — pinned so a future
    // change to the preset list re-asserts the shape. If `3` is
    // removed, this expectation must be updated explicitly.
    expect(clampCookScale(3)).toBe(3);
  });
  it("falls back to 1 for non-finite / non-positive / non-number input", () => {
    expect(clampCookScale("0.5")).toBe(1);
    expect(clampCookScale(null)).toBe(1);
    expect(clampCookScale(undefined)).toBe(1);
    expect(clampCookScale(0)).toBe(1);
    expect(clampCookScale(-2)).toBe(1);
    expect(clampCookScale(Number.NaN)).toBe(1);
    expect(clampCookScale(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("cookScaleStorageKey", () => {
  it("includes the user id so scale is per-account", () => {
    expect(cookScaleStorageKey("user-1", "recipe-A")).toBe("suppr-cook-scale-v1:user-1:recipe-A");
  });
  it("falls back to 'anon' when user id is null / blank", () => {
    expect(cookScaleStorageKey(null, "r")).toBe("suppr-cook-scale-v1:anon:r");
    expect(cookScaleStorageKey("", "r")).toBe("suppr-cook-scale-v1:anon:r");
    expect(cookScaleStorageKey("   ", "r")).toBe("suppr-cook-scale-v1:anon:r");
  });
});

describe("formatScaledAmount", () => {
  it("renders whole numbers without decimals", () => {
    expect(formatScaledAmount(2)).toBe("2");
    expect(formatScaledAmount(10)).toBe("10");
  });
  it("renders cookbook fractions (1/4, 1/2, 3/4, 1/3, 2/3)", () => {
    expect(formatScaledAmount(0.25)).toBe("1/4");
    expect(formatScaledAmount(0.5)).toBe("1/2");
    expect(formatScaledAmount(0.75)).toBe("3/4");
    expect(formatScaledAmount(1 / 3)).toBe("1/3");
    expect(formatScaledAmount(2 / 3)).toBe("2/3");
  });
  it("renders mixed fractions with a space", () => {
    expect(formatScaledAmount(1.5)).toBe("1 1/2");
    expect(formatScaledAmount(2.25)).toBe("2 1/4");
  });
  it("falls back to a 2dp number for non-cookbook fractions", () => {
    expect(formatScaledAmount(1.7)).toBe("1.7");
    expect(formatScaledAmount(0.42)).toBe("0.42");
  });
  it("clamps NaN / Infinity / negative to 0", () => {
    expect(formatScaledAmount(Number.NaN)).toBe("0");
    expect(formatScaledAmount(Number.POSITIVE_INFINITY)).toBe("0");
    expect(formatScaledAmount(-2)).toBe("0");
  });
});

describe("scaleAmountText — cooking units", () => {
  it("scales cups by 2x", () => {
    expect(scaleAmountText("2 cups of flour", 2)).toBe("4 cups of flour");
  });
  it("scales 0.5x to a half cup", () => {
    expect(scaleAmountText("2 cups of flour", 0.5)).toBe("1 cups of flour");
  });
  it("scales fractions back to whole tablespoons", () => {
    expect(scaleAmountText("1/2 tbsp salt", 2)).toBe("1 tbsp salt");
  });
  it("scales unicode vulgar fractions", () => {
    expect(scaleAmountText("½ tsp salt", 2)).toBe("1 tsp salt");
    expect(scaleAmountText("¼ cup oil", 4)).toBe("1 cup oil");
  });
  it("scales mixed fractions", () => {
    expect(scaleAmountText("1 1/2 cups milk", 2)).toBe("3 cups milk");
  });
  it("preserves casing of the unit word", () => {
    // We don't normalise — "Cups" stays "Cups" so a user-pasted
    // recipe doesn't lose its formatting.
    expect(scaleAmountText("2 Cups of flour", 2)).toBe("4 Cups of flour");
  });
  it("scales fl oz as a two-word unit", () => {
    expect(scaleAmountText("4 fl oz milk", 2)).toBe("8 fl oz milk");
  });
});

describe("scaleAmountText — count nouns", () => {
  it("scales eggs", () => {
    expect(scaleAmountText("3 eggs", 2)).toBe("6 eggs");
  });
  it("scales onions at half scale", () => {
    expect(scaleAmountText("2 onions", 0.5)).toBe("1 onions");
  });
  it("scales chicken thighs", () => {
    expect(scaleAmountText("4 chicken thighs", 0.5)).toBe("2 chicken thighs");
  });
});

describe("scaleAmountText — time / temperature must NOT scale", () => {
  it("leaves minutes alone", () => {
    expect(scaleAmountText("bake for 25 minutes", 2)).toBe("bake for 25 minutes");
  });
  it("leaves abbreviated min alone", () => {
    expect(scaleAmountText("simmer 10 min", 2)).toBe("simmer 10 min");
  });
  it("leaves Fahrenheit alone (F suffix)", () => {
    // "350" alone has no recognised unit/noun — falls through. The
    // explicit "350°F" form is also untouched because "°f" is in the
    // time/temp guard.
    expect(scaleAmountText("preheat oven to 350°F", 2)).toBe("preheat oven to 350°F");
  });
  it("leaves Celsius alone", () => {
    expect(scaleAmountText("preheat oven to 180°C", 2)).toBe("preheat oven to 180°C");
  });
  it("leaves hours alone", () => {
    expect(scaleAmountText("rest for 1 hour", 2)).toBe("rest for 1 hour");
  });
});

describe("scaleAmountText — bare integers without a recognised unit", () => {
  it("does not scale 'Step 1:' prefixes", () => {
    expect(scaleAmountText("Step 1: chop onion", 2)).toBe("Step 1: chop onion");
  });
  it("does not scale 'Serves 4'", () => {
    expect(scaleAmountText("Serves 4", 2)).toBe("Serves 4");
  });
  it("does not scale a bare number with no following word", () => {
    expect(scaleAmountText("Add 4 to taste", 2)).toBe("Add 4 to taste");
  });
});

describe("scaleAmountText — range forms", () => {
  it("scales both ends of a hyphen range", () => {
    expect(scaleAmountText("1-2 cloves garlic", 2)).toBe("2-4 cloves garlic");
  });
  it("scales en-dash ranges too", () => {
    expect(scaleAmountText("1–2 cloves garlic", 2)).toBe("2-4 cloves garlic");
  });
});

describe("scaleAmountText — defensive paths", () => {
  it("returns the input verbatim when factor is 1", () => {
    expect(scaleAmountText("2 cups of flour", 1)).toBe("2 cups of flour");
  });
  it("collapses non-finite factor to 1 (no corruption)", () => {
    expect(scaleAmountText("2 cups", Number.NaN)).toBe("2 cups");
    expect(scaleAmountText("2 cups", 0)).toBe("2 cups");
    expect(scaleAmountText("2 cups", -1)).toBe("2 cups");
  });
  it("preserves empty string", () => {
    expect(scaleAmountText("", 2)).toBe("");
  });
  it("scales multiple numbers in one line", () => {
    expect(
      scaleAmountText("Whisk 2 eggs and 1/2 cup milk", 2),
    ).toBe("Whisk 4 eggs and 1 cup milk");
  });
});

describe("formatCookScaleLabel", () => {
  it("strips the .0 from whole-number scales", () => {
    expect(formatCookScaleLabel(1)).toBe("1x");
    expect(formatCookScaleLabel(2)).toBe("2x");
    expect(formatCookScaleLabel(4)).toBe("4x");
  });
  it("preserves the half-decimal", () => {
    expect(formatCookScaleLabel(0.5)).toBe("0.5x");
    expect(formatCookScaleLabel(1.5)).toBe("1.5x");
  });
});

describe("cookScaleCaption", () => {
  it("reads as 'Serves N' at 1x when baseServings is known", () => {
    // User-sentiment audit (round 4, 2026-04-30): "Original recipe"
    // hid the yield from solo cooks. Surface the actual servings
    // count at 1x so "Serves 1" / "Serves 2" / "Serves 4" is
    // prominent in the cook header.
    expect(cookScaleCaption(1, 4)).toBe("Serves 4");
    expect(cookScaleCaption(1, 1)).toBe("Serves 1");
    expect(cookScaleCaption(1, 2)).toBe("Serves 2");
  });
  it("falls back to 'Original recipe' at 1x when servings unknown", () => {
    expect(cookScaleCaption(1, null)).toBe("Original recipe");
    expect(cookScaleCaption(1, undefined)).toBe("Original recipe");
    expect(cookScaleCaption(1, 0)).toBe("Original recipe");
  });
  it("reads as 'Scaled to 8 servings' for 2x of 4 servings", () => {
    expect(cookScaleCaption(2, 4)).toBe("Scaled to 8 servings");
  });
  it("scales 3x cleanly (Mealime gap closure for 2-serving recipes)", () => {
    // 3x of 2 servings → 6 (a household pan). Pre-fix the user had
    // to pick 4x and over-cook; this caption confirms 3x lands
    // accurately when picked.
    expect(cookScaleCaption(3, 2)).toBe("Scaled to 6 servings");
  });
  it("singular for 1 serving", () => {
    expect(cookScaleCaption(0.5, 2)).toBe("Scaled to 1 serving");
  });
  it("falls back to multiplier when servings unknown", () => {
    expect(cookScaleCaption(2, null)).toBe("Scaled 2x");
    expect(cookScaleCaption(1.5, undefined)).toBe("Scaled 1.5x");
  });
});
