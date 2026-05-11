/**
 * Recipe-wave (2026-05-10) — server-side helper that fires the
 * `recipe_import_pipeline_stage` PostHog event from each route handler
 * (URL / image / caption) at each pipeline stage.
 *
 * Designed so the next "wrong nutrition numbers" tester report can be
 * correlated to the exact stage that produced the bad number, instead
 * of guessing.
 *
 * All emits are fire-and-forget via `serverTrack` (which silently
 * no-ops when `NEXT_PUBLIC_POSTHOG_KEY` is unset, matching client
 * `track`). Routes call these inline; if telemetry blocks the
 * happy-path response that's the bug, not a feature.
 */
import { serverTrack } from "./serverTrack";
import { AnalyticsEvents } from "./events";

export type ImportPath = "url" | "image" | "caption";

/** Fire-and-forget PostHog emit; never blocks the route response. */
function emit(userId: string | null, payload: Record<string, unknown>): void {
  if (!userId) return;
  void serverTrack(AnalyticsEvents.recipe_import_pipeline_stage, userId, payload);
}

/** Stage 1 — extraction. Fires after the title + ingredients[] have
 *  been pulled out of the source (HTML / image / caption). */
export function traceExtraction(
  userId: string | null,
  importPath: ImportPath,
  extractionMethod: "schema_org" | "ai_vision" | "ai_caption",
  extracted: { ingredientCount: number; stepCount: number },
): void {
  emit(userId, {
    importPath,
    stage: "extraction",
    extractionMethod,
    extractedIngredientCount: extracted.ingredientCount,
    extractedStepCount: extracted.stepCount,
  });
}

/** Stage 2 — ingredient parsing. Fires after `parseRawIngredients()`
 *  has structured the raw lines into `{name, amount, unit}`. */
export function traceParsing(
  userId: string | null,
  importPath: ImportPath,
  parsedIngredientCount: number,
): void {
  emit(userId, {
    importPath,
    stage: "ingredient_parsing",
    parsedIngredientCount,
  });
}

/** Stage 3+4 — nutrition lookup + aggregation. Fires after
 *  `verifyIngredients()` returns. Captures per-source distribution
 *  + confidence so we can correlate "wrong carbs" reports to the
 *  vendor that produced them. */
export function traceNutritionLookup(
  userId: string | null,
  importPath: ImportPath,
  result: {
    verified: ReadonlyArray<{ source: string | null | undefined; confidence: number }>;
    primarySource: string | null | undefined;
    perServing: { calories?: number; protein?: number; carbs?: number; fat?: number };
    servings: number;
  },
): void {
  const sourceCounts: Record<string, number> = {};
  let confidenceSum = 0;
  let minConfidence = 1;
  let fallbackUsed = false;
  for (const v of result.verified) {
    const src = v.source ?? "Unverified";
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
    confidenceSum += v.confidence;
    if (v.confidence < minConfidence) minConfidence = v.confidence;
    if (src === "Estimated") fallbackUsed = true;
  }
  const verifiedCount = result.verified.length;
  const avgConfidence = verifiedCount > 0 ? confidenceSum / verifiedCount : 0;
  emit(userId, {
    importPath,
    stage: "nutrition_lookup",
    verifiedCount,
    primarySource: result.primarySource ?? null,
    sourceCounts,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    minConfidence: Math.round(minConfidence * 100) / 100,
    fallbackUsed,
    totalCalories: Math.round(result.perServing.calories ?? 0),
    totalProteinG: Math.round((result.perServing.protein ?? 0) * 10) / 10,
    totalCarbsG: Math.round((result.perServing.carbs ?? 0) * 10) / 10,
    totalFatG: Math.round((result.perServing.fat ?? 0) * 10) / 10,
    servings: result.servings,
  });
}

/** Stage 5 — caption nutrition extraction. Fires after
 *  `extractCaptionNutrition()` returns. Captures the source-claimed
 *  per-serving values so we can compare against our calculated
 *  totals + spot delta-driven trust issues. */
export function traceCaptionNutrition(
  userId: string | null,
  importPath: ImportPath,
  claim: {
    caloriesPerServing?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
  } | null,
): void {
  const captionExtracted = Boolean(
    claim &&
      (claim.caloriesPerServing != null ||
        claim.proteinG != null ||
        claim.carbsG != null ||
        claim.fatG != null),
  );
  emit(userId, {
    importPath,
    stage: "caption_nutrition",
    captionExtracted,
    captionCalories: claim?.caloriesPerServing ?? null,
    captionProteinG: claim?.proteinG ?? null,
    captionCarbsG: claim?.carbsG ?? null,
    captionFatG: claim?.fatG ?? null,
  });
}
