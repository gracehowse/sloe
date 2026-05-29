import { describe, expect, it } from "vitest";

import { formatMacroTrailer } from "../../src/lib/nutrition/macroFormat";

describe("formatMacroTrailer", () => {
  it("formats a full macro row in canonical shape", () => {
    expect(
      formatMacroTrailer({ calories: 520, protein: 38, carbs: 42, fat: 18 }),
    ).toBe("520 kcal · 38g P · 42g C · 18g F");
  });

  it("uses em-dash placeholders for missing values", () => {
    expect(formatMacroTrailer({ calories: null, protein: null, carbs: null, fat: null })).toBe(
      "— kcal · —g P · —g C · —g F",
    );
  });

  it("appends fibre when provided and positive", () => {
    expect(
      formatMacroTrailer({ calories: 100, protein: 10, carbs: 12, fat: 3, fiber: 9 }),
    ).toBe("100 kcal · 10g P · 12g C · 3g F · 9g Fb");
  });

  it("rounds sub-gram noise to integers", () => {
    expect(
      formatMacroTrailer({ calories: 519.4, protein: 38.6, carbs: 41.2, fat: 17.8 }),
    ).toBe("519 kcal · 39g P · 41g C · 18g F");
  });
});
