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

/**
 * Rewrite a caption-extracted step to imperative voice with neutral phrasing.
 *
 * The LLM already produces close-to-imperative text most of the time; this
 * function is a defence-in-depth pass that:
 *   - Strips leading first-person voice ("I heat the oil" → "Heat the oil")
 *   - Strips leading "Then, " / "Next, " / "Now " / "So, " filler
 *   - Strips conversational openers ("Okay, ", "Alright, ", "So basically ")
 *   - Capitalises the first letter, ensures a terminating period
 *
 * Exposed so the unit tests can assert byte-for-byte on the legal guardrail.
 */
export function normaliseStepToImperative(raw: string): string {
  if (typeof raw !== "string") return "";
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) return "";

  // Strip leading conversational fillers. Multi-pass to peel back stacked
  // openers like "So basically, then now you want to...".
  const fillers = [
    /^(?:so|okay|ok|alright|right|now|next|then|first(?:ly)?|finally|lastly|after that|after\s+\w+,?|basically|essentially|literally|honestly|actually|simply|just|well)\s*[,.\-:]?\s+/i,
    /^(?:and\s+)?then\s*[,.\-:]?\s+/i,
  ];
  for (let i = 0; i < 6; i++) {
    let changed = false;
    for (const re of fillers) {
      if (re.test(s)) {
        s = s.replace(re, "");
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Convert first-person ("I/we add ...") → imperative ("add ...").
  s = s.replace(
    /^(?:i'?m\s+going\s+to\s+|i\s+(?:am\s+going\s+to\s+|will\s+|just\s+|then\s+|like\s+to\s+)?|we\s+(?:are\s+going\s+to\s+|will\s+|just\s+|then\s+)?|you\s+(?:want\s+to\s+|need\s+to\s+|can\s+|just\s+|then\s+|will\s+)?|let'?s\s+(?:just\s+|now\s+)?)/i,
    "",
  );

  // Trim again in case the rewrite left an opening space.
  s = s.trim();
  if (!s) return "";

  // Capitalise first character; ensure terminating period if missing.
  s = s[0].toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s = s + ".";

  return s;
}

/**
 * Extract a structured recipe from a user-supplied caption.
 *
 * @param input.captionText  Caption text the user shared via the iOS share
 *                            sheet. Required. We never fetch this from a
 *                            platform server.
 * @param input.sourceUrl     Original post URL. Stored on the recipe but
 *                            NOT fetched server-side.
 * @param input.platform      Detected platform classification.
 * @param input.openaiKey     OpenAI API key for the LLM extraction call.
 *
 * @throws {CaptionTooShortError} when caption is empty / below
 *   `MIN_CAPTION_LEN`. Caller decides how to surface (typically: route to
 *   the legacy URL path or show a "couldn't import" message).
 */
export async function parseCaption(input: {
  captionText: string;
  sourceUrl: string;
  platform: "instagram" | "tiktok" | "youtube";
  openaiKey: string;
}): Promise<ParsedCaptionRecipe> {
  const caption = (input.captionText ?? "").trim();
  if (caption.length < MIN_CAPTION_LEN) {
    throw new CaptionTooShortError();
  }

  const raw = await extractRecipeFromCaption(caption, input.openaiKey, null);

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
