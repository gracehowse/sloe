/**
 * Recipe-import acquisition adapter (ENG-994) — SERVER-ONLY.
 *
 * The two-stage import architecture (per
 * `docs/research/2026-06-08-julienne-strengths.md`) separates:
 *   1. ACQUISITION — platform-specific fetch of raw source content
 *      (scrape a page, or fetch a video transcript), normalised into one shape.
 *   2. EXTRACTION — the existing, unchanged LLM / schema.org step that turns
 *      that normalised content into a recipe.
 *
 * This module is the acquisition boundary. It exposes a **swappable adapter
 * interface** so the vendor isn't hardcoded — Supadata is the default adapter,
 * but a future adapter (a different scrape/transcript vendor, or a self-hosted
 * fetcher) can be dropped in without touching the route. This is the
 * build-vs-buy "swappable adapter" decision: we buy acquisition from Supadata
 * today, behind an interface we own.
 *
 * The adapter NEVER extracts a recipe. It returns `{ content, source, kind }`
 * (plus optional title/description/image hints) and the route hands `content`
 * to the existing extraction step.
 *
 * ## Legal posture — IG/TT transcript acquisition is gated
 *
 * `docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md` BLOCKS
 * server-side fetch of Instagram/TikTok post bodies (a transcript fetch is a
 * reproduction of the audio track — the same reason Whisper transcription was
 * removed on 2026-04-19). So this adapter will only attempt an IG/TT transcript
 * when `IG_TT_IMPORT_ENABLED` is true (the existing legal flag), which stays
 * OFF in production until DMCA registration + legal-reviewer sign-off land.
 * YouTube transcripts and general web scrapes are not covered by that block and
 * are acquired freely. See the per-platform routing in `acquireViaSupadata`.
 */

import { detectSourcePlatform, type RecipeSourcePlatform } from "@/lib/recipes/resolveImportUrl";
import { isIgTtImportEnabled } from "@/lib/featureFlags/igTtImport";
import { isAllowedUrl } from "@/lib/recipe-import/ssrfAllowlist";
import {
  scrapeUrl,
  fetchTranscript,
  hasSupadataConfig,
  type FetchLike,
  type SupadataErrorCode,
} from "./client";

/** What kind of source the acquisition produced. */
export type AcquisitionKind = "scrape" | "transcript";

/** Which acquisition vendor / adapter produced the content. */
export type AcquisitionSource = "supadata";

export interface AcquiredRecipeSource {
  /** Raw source content (page text/markdown, or transcript text). Handed to
   *  the existing extraction step unchanged. */
  content: string;
  /** The adapter that acquired it. */
  source: AcquisitionSource;
  /** Whether it came from a scrape or a transcript. */
  kind: AcquisitionKind;
  /** The platform the URL was classified as (for telemetry + routing). */
  platform: RecipeSourcePlatform;
  /** Optional hints the adapter surfaced alongside the content. */
  title: string | null;
  description: string | null;
  image: string | null;
}

/** Stable, vendor-neutral reasons acquisition produced nothing usable. */
export type AcquisitionErrorReason =
  | "not_configured" // no SUPADATA_KEY (or adapter unavailable)
  | "rate_limited" // vendor 429 / quota exhausted
  | "blocked_by_policy" // platform fetch blocked (IG/TT transcript while legal flag OFF)
  | "empty" // vendor returned nothing usable
  | "error"; // network / http error

export type AcquisitionResult =
  | { ok: true; data: AcquiredRecipeSource }
  | {
      ok: false;
      reason: AcquisitionErrorReason;
      /** Suggested Retry-After seconds when the vendor returned one. */
      retryAfterSec: number | null;
      /** Detail for logs. Never surfaced to end users. */
      detail: string;
    };

/**
 * The adapter contract. A new vendor implements this one function.
 *
 * `acquire(url)` returns a normalised source or a typed failure. It must never
 * throw and never hang (the underlying client bounds every call with a
 * timeout). `isConfigured()` lets the route skip the adapter cleanly when the
 * vendor isn't set up (e.g. local dev without a key).
 */
export interface AcquisitionAdapter {
  readonly name: AcquisitionSource;
  isConfigured(): boolean;
  acquire(url: string, opts?: AcquireOptions): Promise<AcquisitionResult>;
}

export interface AcquireOptions {
  /** Transcript language override (default `en` — Supadata defaults to `de`). */
  lang?: string;
  /** For tests only — inject a stub fetch to avoid live API calls. */
  fetchImpl?: FetchLike;
}

function mapSupadataError(code: SupadataErrorCode): AcquisitionErrorReason {
  switch (code) {
    case "supadata_not_configured":
      return "not_configured";
    case "supadata_rate_limited":
      return "rate_limited";
    case "supadata_empty":
      return "empty";
    case "supadata_http_error":
    case "supadata_network_error":
    default:
      return "error";
  }
}

/**
 * Acquire raw recipe source via Supadata, routing by platform:
 *   - YouTube → transcript (`/youtube/transcript`)
 *   - TikTok / Instagram → transcript (`/transcript`) — ONLY when the legal
 *     flag `IG_TT_IMPORT_ENABLED` is on; otherwise `blocked_by_policy`.
 *   - blog / unknown / other → web scrape (`/web/scrape`)
 */
async function acquireViaSupadata(url: string, opts: AcquireOptions = {}): Promise<AcquisitionResult> {
  // Defence in depth: never hand a private/reserved host to the vendor.
  if (!isAllowedUrl(url)) {
    return { ok: false, reason: "error", retryAfterSec: null, detail: "URL failed SSRF allowlist" };
  }
  if (!hasSupadataConfig()) {
    return { ok: false, reason: "not_configured", retryAfterSec: null, detail: "SUPADATA_KEY not set" };
  }

  const platform = detectSourcePlatform(url);

  // Video-transcript platforms.
  if (platform === "youtube" || platform === "tiktok" || platform === "instagram") {
    // IG/TT transcript fetch is a server-side reproduction of the platform's
    // video content — BLOCKED by the legal posture unless the legal flag is on.
    // YouTube is not covered by that block.
    if ((platform === "tiktok" || platform === "instagram") && !isIgTtImportEnabled()) {
      return {
        ok: false,
        reason: "blocked_by_policy",
        retryAfterSec: null,
        detail: `${platform} transcript acquisition blocked: IG_TT_IMPORT_ENABLED is off (legal posture 2026-04-30)`,
      };
    }

    const t = await fetchTranscript(url, {
      lang: opts.lang,
      isYouTube: platform === "youtube",
      fetchImpl: opts.fetchImpl,
    });
    if (!t.ok) {
      return {
        ok: false,
        reason: mapSupadataError(t.error),
        retryAfterSec: t.retryAfterSec,
        detail: t.detail,
      };
    }
    return {
      ok: true,
      data: {
        content: t.data.content,
        source: "supadata",
        kind: "transcript",
        platform,
        title: null,
        description: null,
        image: null,
      },
    };
  }

  // Everything else → scrape the page.
  const s = await scrapeUrl(url, { fetchImpl: opts.fetchImpl });
  if (!s.ok) {
    return { ok: false, reason: mapSupadataError(s.error), retryAfterSec: s.retryAfterSec, detail: s.detail };
  }
  return {
    ok: true,
    data: {
      content: s.data.content,
      source: "supadata",
      kind: "scrape",
      platform,
      title: s.data.title,
      description: s.data.description,
      image: s.data.image,
    },
  };
}

/** The Supadata adapter — the default acquisition adapter. */
export const supadataAdapter: AcquisitionAdapter = {
  name: "supadata",
  isConfigured: hasSupadataConfig,
  acquire: acquireViaSupadata,
};

/**
 * The active adapter the route uses. Indirected through a module-level
 * variable so a future adapter can be swapped in (and so tests can inject a
 * stub) without the route reaching for a specific vendor.
 */
let activeAdapter: AcquisitionAdapter = supadataAdapter;

/** Swap the active acquisition adapter (future vendor migration / tests). */
export function setAcquisitionAdapter(adapter: AcquisitionAdapter): void {
  activeAdapter = adapter;
}

/** Reset to the default (Supadata) adapter — test teardown convenience. */
export function resetAcquisitionAdapter(): void {
  activeAdapter = supadataAdapter;
}

/**
 * Acquire raw recipe source for `url` using the active adapter.
 *
 * This is the single entry point the route calls. It returns a normalised
 * `{ content, source, kind, platform, ... }` or a typed failure the route maps
 * to a fallback (existing path) or a clear user error.
 */
export function acquireRecipeSource(url: string, opts?: AcquireOptions): Promise<AcquisitionResult> {
  if (!activeAdapter.isConfigured()) {
    return Promise.resolve({
      ok: false,
      reason: "not_configured",
      retryAfterSec: null,
      detail: `acquisition adapter "${activeAdapter.name}" is not configured`,
    });
  }
  return activeAdapter.acquire(url, opts);
}
