/**
 * Parse a user-supplied caption text into a structured recipe.
 *
 * Used by the IG/TT/YouTube share-sheet caption path. The user shares a
 * post to Suppr; iOS's share sheet hands us BOTH the URL and the caption
 * text (when the source app provides it). Suppr's server only ever sees
 * caption text the user explicitly sent — there is NO server-side fetch
 * of IG/TT/YouTube URLs from this path. See
 * `docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md`.
 *
 * Guardrails applied here, in order:
 *
 *   1. **Reject empty / whitespace input** — caller should fall back to
 *      the URL path.
 *   2. **LLM extraction** — reuses `extractRecipeFromCaption` (the
 *      existing GPT prompt) so the rest of the import pipeline (ingredient
 *      verification, meal classification, etc.) stays single-source.
 *   3. **Normalise step instructions** — every extracted step is rewritten
 *      to imperative voice ("Heat oil in pan", not "I heat the oil in a
 *      pan"). This is a copyright-risk-reduction guardrail per the legal
 *      verdict — recipe ingredient lists are facts (not copyrightable),
 *      but the creator's creative expression in step text is. We never
 *      transcribe verbatim. The `normaliseStepToImperative` helper is
 *      exposed for tests to assert on.
 *   4. **Provenance** — caller is expected to set `source_url`,
 *      `source_name` (creator handle), and `source_platform` on the
 *      resulting recipe row. Helpers for handle extraction live alongside
 *      the LLM helper in `src/lib/recipe-import/extractSocialRecipe.ts`.
 */

import {
  extractRecipeFromCaption,
  socialImportSourceName,
} from "@/lib/recipe-import/extractSocialRecipe";
import type { RecipeSourcePlatform } from "@/lib/recipes/resolveImportUrl";
import { normaliseStepToImperative } from "./normaliseRecipeSteps";

export interface ParsedCaptionRecipe {
  title: string | null;
  ingredients: string[];
  instructions: string[];
  notes: string | null;
  servings: number | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  /** Echoed back from input — caller stores on `recipes.source_url`. */
  sourceUrl: string;
  /** Creator handle (e.g. `@chefmaria`) when extractable, else hostname label. */
  sourceName: string;
  /** Echoed back from input — caller stores on `recipes.source_platform`. */
  sourcePlatform: "instagram" | "tiktok" | "youtube";
}

export class CaptionTooShortError extends Error {
  constructor() {
    super("Caption text is empty or too short to extract a recipe.");
    this.name = "CaptionTooShortError";
  }
}

/**
 * Minimum useful caption length. Below this, the LLM will produce hallucinations
 * with no signal — fail fast and let the caller route to a different path.
 */
const MIN_CAPTION_LEN = 30;

// `normaliseStepToImperative` moved to `./normaliseRecipeSteps` (ENG-1128) so
// the same legal guardrail can run at the persist chokepoint for EVERY import
// path (caption / structured-LLM / JSON-LD HTML), not just captions.
// Re-exported here for back-compat — `tests/unit/parseCaption.test.ts` and the
// caption path below both import it from this module.
export { normaliseStepToImperative };

/**
 * Extract a structured recipe from a user-supplied caption.
 *
 * @param input.captionText  Caption text the user shared via the iOS share
 *                            sheet. Required. We never fetch this from a
 *                            platform server.
 * @param input.sourceUrl     Original post URL. Stored on the recipe but
 *                            NOT fetched server-side.
 * @param input.platform      Detected platform classification.
 * @throws {CaptionTooShortError} when caption is empty / below
 *   `MIN_CAPTION_LEN`. Caller decides how to surface (typically: route to
 *   the legacy URL path or show a "couldn't import" message).
 *
 * 2026-05-08: AI key is now read from env vars inside the shared
 * `aiProvider` helper (Anthropic preferred, OpenAI fallback). The
 * `openaiKey` param is no longer needed.
 */
export async function parseCaption(input: {
  captionText: string;
  sourceUrl: string;
  platform: "instagram" | "tiktok" | "youtube";
  /** Blocker 3 (2026-05-14) — threaded through so the AI budget
   *  counters know which user to attribute the LLM call to. */
  userId?: string | null;
}): Promise<ParsedCaptionRecipe> {
  const caption = (input.captionText ?? "").trim();
  if (caption.length < MIN_CAPTION_LEN) {
    throw new CaptionTooShortError();
  }

  const raw = await extractRecipeFromCaption(caption, null, input.userId ?? null);

  /**
   * Legal guardrail: every step is rewritten to imperative voice. This
   * means even if the LLM occasionally echoes a creator's phrasing, the
   * normalisation pass strips first-person + conversational filler before
   * the recipe is persisted. Tests assert this on caption fixtures with
   * deliberate first-person voice.
   */
  const instructions = (raw.steps ?? [])
    .map((s) => normaliseStepToImperative(String(s)))
    .filter((s) => s.length > 0);

  const sourceName = socialImportSourceName(input.platform, input.sourceUrl, null, caption) ??
    (input.platform === "tiktok" ? "TikTok" : input.platform === "youtube" ? "YouTube" : "Instagram");

  return {
    title: raw.title ?? null,
    ingredients: raw.ingredients ?? [],
    instructions,
    notes: raw.notes ?? null,
    servings: raw.servings ?? null,
    prepTimeMin: raw.prepTimeMin ?? null,
    cookTimeMin: raw.cookTimeMin ?? null,
    sourceUrl: input.sourceUrl,
    sourceName,
    sourcePlatform: input.platform,
  };
}

/**
 * Convenience for callers that need to type-narrow before calling
 * `parseCaption`. Returns the platform string when the caption-text path
 * is supported for `url`, else `null`.
 */
export function captionPlatformForUrl(
  url: string,
  detect: (u: string) => RecipeSourcePlatform,
): "instagram" | "tiktok" | "youtube" | null {
  const p = detect(url);
  if (p === "instagram" || p === "tiktok" || p === "youtube") return p;
  return null;
}
