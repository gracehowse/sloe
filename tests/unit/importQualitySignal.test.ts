/**
 * GROW-61 (recipe-import audit, 2026-07-01) — the shared import-quality signal
 * that powers the `recipe_imported` event's `macro_complete` +
 * `ingredient_match_rate` props (web + mobile). These props are what let the
 * GROW-62 parse-rate gate be measured, so the derivation is load-bearing.
 *
 * A row counts as "matched with real macros" iff its source is a structured
 * catalog (USDA/OFF/FatSecret/Edamam) AND calories > 0 — the same predicate
 * the persist layer uses for `recipe_ingredients.is_verified`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import {
  ingredientMatchRate,
  isMacroComplete,
  isMatchedIngredientRow,
  importQualityProps,
  importFlaggedSummary,
  importFlaggedReviewLine,
  isFlaggedIngredientRow,
} from "../../src/lib/recipes/importQualitySignal";

const RECIPE_UPLOAD = readFileSync(
  resolve(__dirname, "../../src/app/components/RecipeUpload.tsx"),
  "utf8",
);

const matched = (source: string) => ({ source, calories: 120, protein: 5, carbs: 10, fat: 3 });
const unverified = () => ({ source: "Unverified", calories: 0 });
const estimatedButCalories = () => ({ source: "Estimated", calories: 90 });
const structuredZeroCal = () => ({ source: "USDA", calories: 0 });

describe("isMatchedIngredientRow — the per-row match predicate", () => {
  it("counts a structured-catalog row with real calories as matched", () => {
    expect(isMatchedIngredientRow(matched("USDA"))).toBe(true);
    expect(isMatchedIngredientRow(matched("Open Food Facts"))).toBe(true);
    expect(isMatchedIngredientRow(matched("FatSecret Premier"))).toBe(true);
    expect(isMatchedIngredientRow(matched("Edamam"))).toBe(true);
  });

  it("does NOT count Unverified / Estimated / null-source rows", () => {
    expect(isMatchedIngredientRow(unverified())).toBe(false);
    expect(isMatchedIngredientRow(estimatedButCalories())).toBe(false);
    expect(isMatchedIngredientRow({ source: null, calories: 100 })).toBe(false);
    expect(isMatchedIngredientRow(null)).toBe(false);
    expect(isMatchedIngredientRow(undefined)).toBe(false);
  });

  it("does NOT count a structured source with ZERO calories (FM-2 shell row)", () => {
    expect(isMatchedIngredientRow(structuredZeroCal())).toBe(false);
  });
});

describe("ingredientMatchRate — fraction matched over total", () => {
  it("3 matched of 4 total → 0.75", () => {
    const recipe = {
      calories: 500,
      ingredientMacros: [matched("USDA"), matched("OFF"), matched("FatSecret"), unverified()],
    };
    expect(ingredientMatchRate(recipe)).toBeCloseTo(0.75, 5);
  });

  it("all matched → 1", () => {
    const recipe = { calories: 400, ingredientMacros: [matched("USDA"), matched("USDA")] };
    expect(ingredientMatchRate(recipe)).toBe(1);
  });

  it("none matched → 0", () => {
    const recipe = { calories: 0, ingredientMacros: [unverified(), estimatedButCalories()] };
    expect(ingredientMatchRate(recipe)).toBe(0);
  });

  it("empty / missing ingredient list → 0 (not NaN)", () => {
    expect(ingredientMatchRate({ calories: 300, ingredientMacros: [] })).toBe(0);
    expect(ingredientMatchRate({ calories: 300 })).toBe(0);
    expect(Number.isNaN(ingredientMatchRate({ ingredientMacros: [] }))).toBe(false);
  });
});

describe("isMacroComplete — usable per-serving macro spine", () => {
  it("true when per-serving calories > 0", () => {
    expect(isMacroComplete({ calories: 450 })).toBe(true);
  });
  it("false for the zero-macro shell (calories 0 / null / missing)", () => {
    expect(isMacroComplete({ calories: 0 })).toBe(false);
    expect(isMacroComplete({ calories: null })).toBe(false);
    expect(isMacroComplete({})).toBe(false);
  });
});

describe("importQualityProps — the event payload shape", () => {
  it("N matched / M total → correct rate + boolean (rounded to 3dp)", () => {
    // 2 matched of 3 → 0.667
    const recipe = {
      calories: 520,
      ingredientMacros: [matched("USDA"), matched("OFF"), unverified()],
    };
    expect(importQualityProps(recipe)).toEqual({
      macro_complete: true,
      ingredient_match_rate: 0.667,
    });
  });

  it("zero-macro shell with unmatched rows → macro_complete:false, rate:0", () => {
    const recipe = { calories: 0, ingredientMacros: [unverified(), unverified()] };
    expect(importQualityProps(recipe)).toEqual({
      macro_complete: false,
      ingredient_match_rate: 0,
    });
  });

  it("always returns a finite number for the rate (PostHog-averageable)", () => {
    const props = importQualityProps({});
    expect(typeof props.ingredient_match_rate).toBe("number");
    expect(Number.isFinite(props.ingredient_match_rate)).toBe(true);
  });
});

// ENG-1283 — the honest "some ingredients need review" review surfacing.
// Same predicate (`isMatchedIngredientRow`) as the analytics props + the
// persist layer's `is_verified`, so the count the user sees agrees with what's
// stored. No recompute; no parser / floor / legal / persistence touch.
describe("isFlaggedIngredientRow — inverse of the match predicate", () => {
  it("flags every row that did NOT match a structured catalog with real macros", () => {
    expect(isFlaggedIngredientRow(unverified())).toBe(true);
    expect(isFlaggedIngredientRow(estimatedButCalories())).toBe(true);
    expect(isFlaggedIngredientRow(structuredZeroCal())).toBe(true);
    expect(isFlaggedIngredientRow({ source: null, calories: 100 })).toBe(true);
    expect(isFlaggedIngredientRow(null)).toBe(true);
    expect(isFlaggedIngredientRow(undefined)).toBe(true);
  });

  it("does NOT flag a matched structured-catalog row", () => {
    expect(isFlaggedIngredientRow(matched("USDA"))).toBe(false);
    expect(isFlaggedIngredientRow(matched("FatSecret Premier"))).toBe(false);
  });
});

describe("importFlaggedSummary — the honest review summary", () => {
  it("2 flagged of 4 total, macro spine present → needsReview true", () => {
    const recipe = {
      calories: 500,
      ingredientMacros: [matched("USDA"), matched("OFF"), unverified(), estimatedButCalories()],
    };
    expect(importFlaggedSummary(recipe)).toEqual({
      flaggedCount: 2,
      totalCount: 4,
      macroComplete: true,
      needsReview: true,
    });
  });

  it("a fully-matched import with a macro spine → needsReview false (clean)", () => {
    const recipe = { calories: 400, ingredientMacros: [matched("USDA"), matched("OFF")] };
    expect(importFlaggedSummary(recipe)).toEqual({
      flaggedCount: 0,
      totalCount: 2,
      macroComplete: true,
      needsReview: false,
    });
  });

  it("all rows matched but NO macro spine (calories 0) → needsReview true", () => {
    // FM-2 zero-macro shell: the rows may be structured but the per-serving
    // total is missing, so the review must still say the total is incomplete.
    const recipe = { calories: 0, ingredientMacros: [matched("USDA"), matched("OFF")] };
    const summary = importFlaggedSummary(recipe);
    expect(summary.flaggedCount).toBe(0);
    expect(summary.macroComplete).toBe(false);
    expect(summary.needsReview).toBe(true);
  });

  it("no ingredient rows at all → flaggedCount 0, needsReview driven by macro spine", () => {
    expect(importFlaggedSummary({ calories: 300 }).needsReview).toBe(false);
    expect(importFlaggedSummary({ calories: 0 }).needsReview).toBe(true);
  });
});

describe("importFlaggedReviewLine — the calm honest copy", () => {
  it("flagged rows present → the 'N of M' under-count line", () => {
    const summary = importFlaggedSummary({
      calories: 500,
      ingredientMacros: [matched("USDA"), unverified(), unverified()],
    });
    expect(importFlaggedReviewLine(summary)).toBe(
      "2 of 3 ingredients need review — the macro total may be incomplete.",
    );
  });

  it("no macro spine but no flagged rows → the 'couldn't be calculated' line", () => {
    const summary = importFlaggedSummary({
      calories: 0,
      ingredientMacros: [matched("USDA"), matched("OFF")],
    });
    expect(importFlaggedReviewLine(summary)).toBe(
      "The macro total couldn't be calculated — review the ingredients before saving.",
    );
  });

  it("clean import → null (render nothing, today's silent success)", () => {
    const summary = importFlaggedSummary({
      calories: 400,
      ingredientMacros: [matched("USDA"), matched("OFF")],
    });
    expect(importFlaggedReviewLine(summary)).toBeNull();
  });

  it("copy is body-neutral — no alarm words, no health/diet-culture language", () => {
    const line = importFlaggedReviewLine(
      importFlaggedSummary({ calories: 500, ingredientMacros: [unverified(), matched("USDA")] }),
    );
    expect(line).not.toMatch(/error|failed|wrong|warning|inaccurate|bad|can't trust/i);
  });
});

describe("web RecipeUpload wiring (parity with mobile import-shared)", () => {
  // RNTL/jsdom can't exercise the full RecipeUpload import flow (Supabase
  // session + FormData + queue drivers), so — like the mobile parity test —
  // this is a source-grep wiring pin: the URL import path must derive + spread
  // the same quality props into `recipe_imported`.
  it("imports the shared quality signal", () => {
    expect(RECIPE_UPLOAD).toContain(
      'import { importQualityProps, type ImportQualityProps, type ImportQualityRecipe } from "../../lib/recipes/importQualitySignal.ts"',
    );
  });

  it("ENG-1283 — flag-gates the honest review note (flag-off = today's render)", () => {
    expect(RECIPE_UPLOAD).toContain('isFeatureEnabled("import_review_flagged_ingredients_v1")');
    expect(RECIPE_UPLOAD).toContain("importReviewHonesty && importFlaggedRecipe");
    expect(RECIPE_UPLOAD).toContain("<ImportReviewFlaggedNote recipe={importFlaggedRecipe} />");
  });

  it("passes derived quality props from the full recipe into the URL import apply", () => {
    expect(RECIPE_UPLOAD).toContain(
      "applyImportedRecipeToForm(formRecipe, sourceUrl, importQualityProps(recipe))",
    );
  });

  it("spreads the quality props into the recipe_imported URL payload", () => {
    expect(RECIPE_UPLOAD).toContain(
      'track(AnalyticsEvents.recipe_imported, { host: importHost, source: "url" as const, ...(quality ?? {}) })',
    );
  });
});
