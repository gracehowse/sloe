/**
 * Supadata acquisition wiring (ENG-994) — SERVER-ONLY.
 *
 * Glue between the acquisition adapter and the EXISTING extraction step in
 * `app/api/recipe-import/route.ts`. The route calls these helpers BEFORE its
 * existing scrape / oEmbed logic, behind the `supadata-acquisition` flag; on
 * any failure the route's existing path runs unchanged (old path stays alive
 * in the `else` / fallback). Extraction is NOT modified — these helpers only
 * acquire + normalise content and feed it to the unchanged extractors.
 *
 * Two surfaces:
 *   - `acquireScrapedHtmlRecipe` — for general (non-social) URLs. Supadata
 *     scrapes the page; the content is parsed by the EXISTING
 *     `parseRecipeFromHtml` (JSON-LD path) when possible. Returns the parsed
 *     draft + the acquisition meta, or null to signal "fall back to existing".
 *   - `acquireTranscriptCaption` — for video platforms. Supadata fetches the
 *     transcript; the text is returned for the EXISTING
 *     `extractRecipeFromCaption` LLM step. Returns the transcript text + meta,
 *     or null to signal "fall back to existing".
 */

import { parseRecipeFromHtml, type ParsedRecipeDraft } from "@/lib/recipe-import/parseRecipeFromHtml";
import { acquireRecipeSource, type AcquireOptions, type AcquisitionResult } from "./acquisitionAdapter";

export interface ScrapeAcquisition {
  /** Parsed recipe draft when Supadata's scraped content carried JSON-LD the
   *  existing parser understood. Null when the content was plain text with no
   *  schema.org Recipe — caller then hands `content` to the LLM path or falls
   *  back. */
  parsed: ParsedRecipeDraft | null;
  /** Raw scraped content (markdown / text) for the LLM fallback. */
  content: string;
  title: string | null;
  description: string | null;
  image: string | null;
}

export interface TranscriptAcquisition {
  /** Transcript text to feed the existing `extractRecipeFromCaption` step. */
  content: string;
}

/**
 * The route maps an acquisition failure to either "fall back to existing path"
 * or "surface a rate-limit to the user". We expose the failure so the route can
 * decide; `null` data means "fall back".
 */
export type WireResult<T> =
  | { ok: true; data: T; acquisition: Extract<AcquisitionResult, { ok: true }>["data"] }
  | { ok: false; result: Extract<AcquisitionResult, { ok: false }> };

/**
 * Acquire a general web page via Supadata and try the existing JSON-LD parser.
 *
 * Returns `{ ok: true }` with a (possibly null-`parsed`) draft when Supadata
 * acquired content, or `{ ok: false, result }` carrying the typed failure so
 * the route can fall back to its existing fetch + parse, or surface a 429.
 */
export async function acquireScrapedHtmlRecipe(
  url: string,
  opts?: AcquireOptions,
): Promise<WireResult<ScrapeAcquisition>> {
  const res = await acquireRecipeSource(url, opts);
  if (!res.ok) return { ok: false, result: res };
  if (res.data.kind !== "scrape") {
    // Adapter returned a transcript for a URL the route is treating as a page —
    // shouldn't happen (platform routing), but fall back defensively.
    return {
      ok: false,
      result: { ok: false, reason: "empty", retryAfterSec: null, detail: "expected scrape, got transcript" },
    };
  }

  // Supadata can hand back the page's HTML/markdown; if it contains schema.org
  // Recipe JSON-LD, the EXISTING parser extracts it. Otherwise `parsed` is null
  // and the caller routes `content` to the LLM extractor (or falls back).
  const parsed = parseRecipeFromHtml(res.data.content);

  return {
    ok: true,
    data: {
      parsed,
      content: res.data.content,
      title: res.data.title,
      description: res.data.description,
      image: res.data.image,
    },
    acquisition: res.data,
  };
}

/**
 * Acquire a video transcript via Supadata for the existing caption extractor.
 *
 * Returns `{ ok: true }` with the transcript text, or `{ ok: false, result }`
 * carrying the typed failure (including `blocked_by_policy` when an IG/TT
 * transcript is requested while the legal flag is off) so the route can fall
 * back to its existing oEmbed/meta path.
 */
export async function acquireTranscriptCaption(
  url: string,
  opts?: AcquireOptions,
): Promise<WireResult<TranscriptAcquisition>> {
  const res = await acquireRecipeSource(url, opts);
  if (!res.ok) return { ok: false, result: res };
  if (res.data.kind !== "transcript") {
    return {
      ok: false,
      result: { ok: false, reason: "empty", retryAfterSec: null, detail: "expected transcript, got scrape" },
    };
  }
  return {
    ok: true,
    data: { content: res.data.content },
    acquisition: res.data,
  };
}
