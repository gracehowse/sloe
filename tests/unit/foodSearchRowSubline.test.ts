/**
 * ENG-1532 — unified search-result row sub-line (component grammar dedup).
 *
 * Pins the Fable-ruled (2026-07-16) kcal-LEADS / basis-TRAILS shape shared
 * by BOTH platforms' search-result rows on the `component_grammar_dedup`
 * path:
 *
 *   `450 kcal · 20g P · 0g C · 40g F · per 100g · USDA`
 *
 * The helper is pure and shared (`src/lib/nutrition/foodSearchRowSubline`,
 * mobile via `@suppr/nutrition-core/foodSearchRowSubline`), so this single
 * test pins the string for web + mobile at once.
 */
import { describe, expect, it } from "vitest";

import { formatFoodSearchRowSubline } from "../../src/lib/nutrition/foodSearchRowSubline";
import type { FoodSearchHeadline } from "../../src/lib/nutrition/foodSearchHeadline";

describe("formatFoodSearchRowSubline (ENG-1532)", () => {
  it("per-100g with macros: kcal leads, basis trails, source name last", () => {
    const headline: FoodSearchHeadline = {
      mode: "per-100g",
      headlineKcal: 450,
      macros: { calories: 450, protein: 20, carbs: 0, fat: 40 },
      badge: "per 100g",
    };
    expect(formatFoodSearchRowSubline(headline, "USDA")).toBe(
      "450 kcal · 20g P · 0g C · 40g F · per 100g · USDA",
    );
  });

  it("per-serving: the natural-portion basis trails the macros", () => {
    const headline: FoodSearchHeadline = {
      mode: "per-serving",
      headlineKcal: 250,
      macros: { calories: 250, protein: 12, carbs: 30, fat: 8 },
      badge: "per serving",
      servingLabel: "1 sandwich (230 g)",
      per100gReference: null,
    };
    expect(formatFoodSearchRowSubline(headline, "Edamam")).toBe(
      "250 kcal · 12g P · 30g C · 8g F · per 1 sandwich (230 g) · Edamam",
    );
  });

  it("kcal-only per-100g rows still trail the basis (no invented macros)", () => {
    const headline: FoodSearchHeadline = {
      mode: "per-100g",
      headlineKcal: 96,
      macros: null,
      badge: "per 100g",
    };
    expect(formatFoodSearchRowSubline(headline, "USDA")).toBe(
      "96 kcal · per 100g · USDA",
    );
  });

  it("omits the source segment when no label is passed", () => {
    const headline: FoodSearchHeadline = {
      mode: "per-100g",
      headlineKcal: 450,
      macros: { calories: 450, protein: 20, carbs: 0, fat: 40 },
      badge: "per 100g",
    };
    expect(formatFoodSearchRowSubline(headline)).toBe(
      "450 kcal · 20g P · 0g C · 40g F · per 100g",
    );
  });

  it("rounds macros to integers via the shared formatMacroTrailer", () => {
    const headline: FoodSearchHeadline = {
      mode: "per-100g",
      headlineKcal: 96,
      macros: { calories: 96, protein: 20, carbs: 0, fat: 1.7 },
      badge: "per 100g",
    };
    expect(formatFoodSearchRowSubline(headline, "USDA")).toBe(
      "96 kcal · 20g P · 0g C · 2g F · per 100g · USDA",
    );
  });

  it("placeholder headlines return null (caller renders 'Tap for nutrition info')", () => {
    expect(formatFoodSearchRowSubline({ mode: "placeholder" }, "USDA")).toBeNull();
  });
});
