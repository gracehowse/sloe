/**
 * Recipe import review banner helpers (ENG-1247 / B16 grammar).
 *
 * Prototype: Sloe-App.html `.review-banner` on RecipeDetail when `needsReview`.
 */
import { ingredientVerifyNeedsReview } from "./verifyConfidencePolicy";

export function confidenceStatsFromIngredients(
  ingredients: readonly { confidence?: number | null }[],
): { avg: number | undefined; min: number | undefined } {
  const values = ingredients
    .map((i) => i.confidence)
    .filter((c): c is number => typeof c === "number" && Number.isFinite(c));
  if (values.length === 0) return { avg: undefined, min: undefined };
  const sum = values.reduce((a, b) => a + b, 0);
  return { avg: sum / values.length, min: Math.min(...values) };
}

export function recipeIngredientsNeedReview(
  ingredients: readonly { confidence?: number | null }[],
): boolean {
  const { avg, min } = confidenceStatsFromIngredients(ingredients);
  return ingredientVerifyNeedsReview(avg, min);
}

export function importReviewBannerCopy(input: {
  sourceName?: string | null;
  sourceUrl?: string | null;
}): { title: string; body: string } {
  const host = (() => {
    const raw = input.sourceName?.trim();
    if (raw) return raw;
    const url = input.sourceUrl?.trim();
    if (!url) return "this import";
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "this import";
    }
  })();
  return {
    title: `Imported from ${host} — nutrition needs review`,
    body: "We couldn't read reliable macros from this source. Verify the ingredients and Sloe will calculate them.",
  };
}
