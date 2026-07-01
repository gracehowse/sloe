/**
 * importQualitySignal — the shared "is this a usable macro-tracked recipe"
 * derivation, computed from a `/api/recipe-import` result and emitted as
 * quality properties on the `recipe_imported` analytics event (web + mobile).
 *
 * GROW-61 (recipe-import audit, 2026-07-01) fix #2 — the measurement
 * instrument. Before this, `recipe_imported` fired at form-apply regardless
 * of macro quality (web) and did not fire at all on mobile, so the GROW-62
 * success gate (≥90% usable imports on 100 random TikTok food Reels) could
 * not be measured. These two props let PostHog score import QUALITY, not just
 * "an import happened":
 *
 *   - `macro_complete`      — true iff the recipe has a usable per-serving
 *                             macro spine (calories > 0). False for the FM-2
 *                             zero-macro shell an import can still return.
 *   - `ingredient_match_rate` — 0..1, the fraction of ingredient rows that
 *                             matched a structured nutrition catalog with real
 *                             macros, over total rows.
 *
 * A row counts as "matched with real macros" iff its source string identifies
 * a structured catalog (`isStructuredSource` — USDA / OFF / FatSecret / Edamam)
 * AND its calories are > 0. This is the SAME predicate the persist layer uses
 * to set `recipe_ingredients.is_verified` (`isStructuredSource`), so the event
 * and the stored data agree on what "verified" means. Rows sourced
 * "Unverified" / "Estimated" / null (below the 0.55 confidence floor, or LLM
 * extracts) do not count.
 *
 * This module DERIVES from the result already in hand — it never recomputes
 * nutrition and never touches the parser, the confidence floor, or the legal
 * caption-only posture (all out of scope for GROW-61).
 *
 * Cross-platform: shared lib so web (`@/lib/recipes/importQualitySignal`) and
 * mobile (`@suppr/shared/recipes/importQualitySignal`) emit an identical
 * signal from the identical logic.
 */

import { isStructuredSource } from "../nutrition/structuredSourceGate";

/** Minimal ingredient-row shape needed to score a match. Mirrors the
 *  `ingredientMacros[]` entries on `ApiImportedRecipe` — kept structurally
 *  loose so both the camelCase client shape and any stored row can be passed. */
export type ImportQualityIngredientRow = {
  calories?: number | null;
  source?: string | null;
};

/** Minimal recipe shape needed to score import quality. Structurally
 *  compatible with `ApiImportedRecipe` (per-serving `calories` +
 *  `ingredientMacros[]`). */
export type ImportQualityRecipe = {
  calories?: number | null;
  ingredientMacros?: ImportQualityIngredientRow[] | null;
};

/** The quality properties added to the `recipe_imported` event payload. */
export type ImportQualityProps = {
  /** true iff per-serving calories > 0 (a usable macro spine). */
  macro_complete: boolean;
  /** 0..1 — fraction of ingredient rows matched to a structured catalog with
   *  real macros. 0 when there are no ingredient rows (nothing matched). */
  ingredient_match_rate: number;
};

/**
 * A single ingredient row "matched with real macros" iff its source is a
 * structured catalog AND its calories are > 0. Below-floor / LLM / unverified
 * rows (source "Unverified" / "Estimated" / null) do not qualify.
 */
export function isMatchedIngredientRow(row: ImportQualityIngredientRow | null | undefined): boolean {
  if (!row) return false;
  const calories = typeof row.calories === "number" ? row.calories : 0;
  return calories > 0 && isStructuredSource(row.source);
}

/**
 * Fraction (0..1) of ingredient rows that matched a structured catalog with
 * real macros. Returns 0 for an empty / missing row list (nothing matched),
 * NOT NaN — the event property must always be a finite number PostHog can
 * average.
 */
export function ingredientMatchRate(recipe: ImportQualityRecipe): number {
  const rows = Array.isArray(recipe.ingredientMacros) ? recipe.ingredientMacros : [];
  if (rows.length === 0) return 0;
  const matched = rows.reduce((acc, row) => acc + (isMatchedIngredientRow(row) ? 1 : 0), 0);
  return matched / rows.length;
}

/**
 * true iff the recipe has a usable per-serving macro spine (calories > 0).
 * false for the FM-2 zero-macro shell.
 */
export function isMacroComplete(recipe: ImportQualityRecipe): boolean {
  const calories = typeof recipe.calories === "number" ? recipe.calories : 0;
  return calories > 0;
}

/**
 * Build the `{ macro_complete, ingredient_match_rate }` quality props for the
 * `recipe_imported` event from an import result. Rounds the rate to 3 dp so the
 * event value is stable and not a long float.
 */
export function importQualityProps(recipe: ImportQualityRecipe): ImportQualityProps {
  const rate = ingredientMatchRate(recipe);
  return {
    macro_complete: isMacroComplete(recipe),
    ingredient_match_rate: Math.round(rate * 1000) / 1000,
  };
}

/**
 * The honest review summary of an import (ENG-1283). Derived from the SAME
 * `isMatchedIngredientRow` predicate the analytics props + the persist layer's
 * `is_verified` rollup use — it never recomputes nutrition, never touches the
 * parser, the 0.55 confidence floor, or the legal caption-only posture.
 *
 * A row is "flagged / needs review" iff it did NOT match a structured catalog
 * with real macros (`!isMatchedIngredientRow`): below the confidence floor, an
 * LLM extract, unverified, or quantity-less rows land here. When ≥1 row is
 * flagged (or the recipe has no usable per-serving macro spine) the macro total
 * shown in the review is under-counted, so the review must say so.
 */
export type ImportFlaggedSummary = {
  /** Ingredient rows that did NOT match a structured catalog with real macros. */
  flaggedCount: number;
  /** Total ingredient rows in the import result. */
  totalCount: number;
  /** true iff the per-serving macro spine is usable (calories > 0). */
  macroComplete: boolean;
  /**
   * true iff the review should surface the honest under-count line: ≥1 flagged
   * row, OR the macro spine is missing. false → the import is clean and today's
   * silent-success render is correct.
   */
  needsReview: boolean;
};

/**
 * Row index -> "this row is flagged / needs review". Reuses
 * `isMatchedIngredientRow` so the per-row affordance and the summary line agree
 * exactly with the analytics `ingredient_match_rate` and the stored
 * `is_verified` flag. Rows outside the array bound are treated as flagged
 * (defensive — an index with no row can't be "matched").
 */
export function isFlaggedIngredientRow(
  row: ImportQualityIngredientRow | null | undefined,
): boolean {
  return !isMatchedIngredientRow(row);
}

/**
 * Compute the honest flagged-ingredient summary for a review surface. Shared by
 * web (`RecipeUpload`) and mobile (`import-shared`) so both platforms surface an
 * identical count from identical logic.
 */
export function importFlaggedSummary(recipe: ImportQualityRecipe): ImportFlaggedSummary {
  const rows = Array.isArray(recipe.ingredientMacros) ? recipe.ingredientMacros : [];
  const totalCount = rows.length;
  const flaggedCount = rows.reduce(
    (acc, row) => acc + (isFlaggedIngredientRow(row) ? 1 : 0),
    0,
  );
  const macroComplete = isMacroComplete(recipe);
  return {
    flaggedCount,
    totalCount,
    macroComplete,
    needsReview: flaggedCount > 0 || !macroComplete,
  };
}

/**
 * The calm, body-neutral review line for a flagged import (ENG-1283 — the
 * estimate-honest posture: tell the truth, don't scare). Returns `null` when
 * nothing needs review so the caller renders nothing (today's behaviour).
 *
 * Copy shape:
 *   - flagged rows present   → "N of M ingredients need review — the macro
 *                               total may be incomplete."
 *   - macro spine missing    → "The macro total couldn't be calculated — review
 *                               the ingredients before saving."
 * Never alarming, never blocks saving.
 */
export function importFlaggedReviewLine(summary: ImportFlaggedSummary): string | null {
  if (!summary.needsReview) return null;
  if (summary.flaggedCount > 0 && summary.totalCount > 0) {
    return `${summary.flaggedCount} of ${summary.totalCount} ingredients need review — the macro total may be incomplete.`;
  }
  return "The macro total couldn't be calculated — review the ingredients before saving.";
}
