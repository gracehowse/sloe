/**
 * Photo recipe import — shared response mapping + per-photo seed labels
 * (ENG-735 — bulk photo import as the primary import path).
 *
 * `POST /api/recipe-import/image` takes exactly ONE image per request and
 * returns one structured recipe. Bulk import is therefore N concurrent
 * single-image requests, one per selected photo, run through the shared
 * `RecipeImportScheduler` (one `image` job per photo). This module owns the
 * two pure pieces both platforms must share so the web `<input multiple>`
 * path and the mobile `launchImageLibraryAsync({ allowsMultipleSelection })`
 * path can never drift:
 *
 *   1. `mapImageImportResponseToRecipe` — the image-route JSON → the canonical
 *      `ApiImportedRecipe` the review form + persistence already consume.
 *   2. `photoSeedTitle` — the calm "Photo 1 of 3" seed label shown in the
 *      queue drawer before the recipe title is known.
 *
 * No React, no fetch, no platform globals — unit-tested in isolation and
 * bundled into the RN tree via `@suppr/shared/recipes/photoImport`.
 */
import type { ApiImportedRecipe } from "./persistImportedRecipe";

/**
 * The success shape of `POST /api/recipe-import/image`. Mirrors the route's
 * `NextResponse.json({ ... })` body. Every field is optional/nullable here so
 * a partial or malformed response degrades to a still-savable recipe rather
 * than throwing — the route guarantees `ok` + a non-empty `ingredients` array
 * on success, which the caller checks before mapping.
 */
export interface ImageImportApiResponse {
  ok?: boolean;
  title?: string | null;
  ingredients?: string[];
  steps?: string[];
  notes?: string | null;
  servings?: number | null;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  nutrition?: {
    perServing?: {
      calories?: number | null;
      protein?: number | null;
      carbs?: number | null;
      fat?: number | null;
      fiberG?: number | null;
      sugarG?: number | null;
      sodiumMg?: number | null;
    } | null;
    overallConfidence?: number | null;
  } | null;
  error?: string;
  message?: string;
}

function finiteOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Map one image-route response into the canonical `ApiImportedRecipe`. Pure +
 * defensive: a missing nutrition block, missing steps, or a blank title all
 * degrade gracefully (the review step lets the user fix anything). Per-serving
 * macros are taken straight from the server's verified nutrition — never
 * invented here (repo no-guessing rule); when the server returned none, the
 * macro fields stay null and the review UI shows them as un-estimated.
 *
 * `servings` defaults to 1 (a single photographed dish) only when the server
 * did not return a positive value — matching the existing single-photo
 * behaviour both platforms shipped before bulk import.
 */
export function mapImageImportResponseToRecipe(
  data: ImageImportApiResponse,
): ApiImportedRecipe {
  const ingredients = Array.isArray(data.ingredients)
    ? data.ingredients.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const steps = Array.isArray(data.steps)
    ? data.steps.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const perServing = data.nutrition?.perServing ?? null;
  const servings =
    typeof data.servings === "number" && Number.isFinite(data.servings) && data.servings > 0
      ? Math.round(data.servings)
      : 1;

  return {
    title: (data.title ?? "").trim() || "Photo Import",
    ingredients,
    instructions: steps.length ? steps : undefined,
    description: data.notes?.trim() || null,
    servings,
    prepTimeMin: finiteOrNull(data.prepTimeMin),
    cookTimeMin: finiteOrNull(data.cookTimeMin),
    calories: finiteOrNull(perServing?.calories),
    protein: finiteOrNull(perServing?.protein),
    carbs: finiteOrNull(perServing?.carbs),
    fat: finiteOrNull(perServing?.fat),
    fiberG: finiteOrNull(perServing?.fiberG),
    sugarG: finiteOrNull(perServing?.sugarG),
    sodiumMg: finiteOrNull(perServing?.sodiumMg),
    sourceUrl: data.sourceUrl ?? undefined,
    sourceName: data.sourceName ?? undefined,
  };
}

/**
 * Calm seed title for one photo job in the queue drawer before its recipe
 * title is known. "Photo 2 of 4" when more than one was picked, plain "Photo"
 * for a single pick (so the single-photo experience reads naturally). 1-based
 * `index`. Sloe voice — no exclamation, no "Importing…".
 */
export function photoSeedTitle(index: number, total: number): string {
  if (total <= 1) return "Photo";
  return `Photo ${index} of ${total}`;
}

/** Hard ceiling on photos accepted in one bulk pick. Mirrors the scheduler's
 *  history limit so the drawer never overflows, and keeps a single multi-pick
 *  from queuing an unbounded fan-out of paid AI-vision calls. Picks beyond
 *  this are trimmed (the user keeps the first N) with a calm notice. */
export const BULK_PHOTO_IMPORT_MAX = 12;
