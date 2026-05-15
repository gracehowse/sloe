import { describe, it, expect } from "vitest";
import { portionEqualsLabel } from "../../src/lib/nutrition/portionEqualsLabel";

/**
 * 2026-05-15 — pins the "= …" suffix below the food search quantity
 * stepper.
 *
 * The original bug (Grace, 2026-05-15): for FatSecret per-serving-only
 * foods (e.g. "Publix · Spicy Tuna Roll" with primary serving "1 package"
 * and no gram metric), the screen rendered "= 1 1 package". Cause:
 * `${quantity} ${label}` prefixed the label that already started with
 * "1 ". The fix below drops the prefix when quantity === 1 AND the
 * label starts with a digit. For quantity > 1 we keep an explicit
 * multiplication symbol so the math stays legible without faking
 * pluralisation.
 */
describe("portionEqualsLabel", () => {
  it("renders the grams suffix when the portion has a known weight", () => {
    expect(
      portionEqualsLabel({
        quantity: 2,
        label: "1 pack",
        gramWeight: 100,
        totalGrams: 200,
      }),
    ).toBe("= 200 g");
  });

  it("renders just the label when gramWeight is 0 and label starts with a digit", () => {
    // The "= 1 1 pack" regression case — must NOT prefix with quantity.
    expect(
      portionEqualsLabel({
        quantity: 1,
        label: "1 package",
        gramWeight: 0,
        totalGrams: 0,
      }),
    ).toBe("= 1 package");
  });

  it("renders just the label for derived '1 piece' / '1 slice' / '1 wrap' portions", () => {
    for (const label of ["1 piece", "1 slice", "1 wrap", "1 burger", "1 small can"]) {
      expect(
        portionEqualsLabel({
          quantity: 1,
          label,
          gramWeight: 0,
          totalGrams: 0,
        }),
      ).toBe(`= ${label}`);
    }
  });

  it("renders quantity × label when quantity > 1 and the label starts with a digit", () => {
    expect(
      portionEqualsLabel({
        quantity: 3,
        label: "1 package",
        gramWeight: 0,
        totalGrams: 0,
      }),
    ).toBe("= 3 × 1 package");
  });

  it("renders quantity × label for labels that don't start with a digit", () => {
    // Hypothetical future label without a leading count.
    expect(
      portionEqualsLabel({
        quantity: 2,
        label: "serving",
        gramWeight: 0,
        totalGrams: 0,
      }),
    ).toBe("= 2 × serving");
  });

  it("handles quantity === 1 with non-digit-leading label by adding the × prefix", () => {
    expect(
      portionEqualsLabel({
        quantity: 1,
        label: "serving",
        gramWeight: 0,
        totalGrams: 0,
      }),
    ).toBe("= 1 × serving");
  });
});
