/**
 * Extract recipe content from social media URLs (Instagram, TikTok).
 *
 * Strategy:
 * 1. Fetch page HTML with browser-like UA
 * 2. Extract caption/description from <meta> og:description / twitter:description tags
 * 3. Extract any image URL from og:image
 * 4. Send caption text to OpenAI to parse into structured recipe
 *
 * These platforms serve enough metadata in SSR HTML for recipe extraction
 * even though the full page is JS-rendered.
 */

import { decodeHtmlEntities } from "../text/decodeHtmlEntities";
import { siteNameFromUrl } from "./parseRecipeFromHtml";
import { followWithSsrfGuard } from "./ssrfGuard";
import { callAiText, callAiVision, type AiCallResult } from "../server/aiProvider";
import {
  buildStructuredRecipePrompt,
  parseStructuredRecipe,
  toIngredientLines,
  type StructuredIngredient,
} from "./structuredRecipeSchema";

export type SocialPlatform = "instagram" | "tiktok" | "youtube" | null;

export function detectSocialPlatform(url: string): SocialPlatform {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am") return "instagram";
    if (host === "tiktok.com" || host.endsWith(".tiktok.com") || host === "vm.tiktok.com") return "tiktok";
    if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com" || host === "youtu.be") return "youtube";
    return null;
  } catch {
    return null;
  }
}

export interface SocialPostMeta {
  platform: SocialPlatform;
  caption: string;
  imageUrl: string | null;
  title: string | null;
  /** Creator display (e.g. Instagram oEmbed author_name, TikTok @handle) — not a nutrition database label. */
  authorDisplay: string | null;
  /** Raw HTML from the fetched page — used for comment extraction without a second fetch. */
  rawHtml?: string;
  /** Video URL from og:video meta tags or embedded JSON — used for audio transcription fallback. */
  videoUrl?: string | null;
}

/**
 * Try Instagram's oEmbed API to get a clean thumbnail without the play-button overlay.
 * The public endpoint works without an access token for basic metadata.
 * Falls back to null so callers can use og:image instead.
 */
async function fetchInstagramOembed(postUrl: string): Promise<{ thumbnailUrl: string | null; authorName: string | null }> {
  // ENG-1037 (SSRF): the oEmbed `endpoint` host is HARD-CODED to
  // instagram.com — the attacker-controlled `postUrl` is only a
  // URL-encoded query parameter, never the fetch target. So this is not an
  // SSRF vector and does not need the redirect guard (intentional — not a gap).
  const endpoints = [
    `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(postUrl)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        thumbnail_url?: string;
        title?: string;
        author_name?: string;
      };
      const thumb = data.thumbnail_url && typeof data.thumbnail_url === "string" ? data.thumbnail_url : null;
      const author =
        typeof data.author_name === "string" && data.author_name.trim().length > 0 ? data.author_name.trim() : null;
      if (thumb || author) return { thumbnailUrl: thumb, authorName: author };
    } catch {
      // oEmbed failed — continue
    }
  }
  return { thumbnailUrl: null, authorName: null };
}

function guessTikTokAuthorDisplay(caption: string, pageTitle: string | null): string | null {
  const fromCap = caption.match(/@([a-z0-9._]{2,30})\b/i);
  if (fromCap) return `@${fromCap[1]}`;
  if (pageTitle) {
    const strip = pageTitle.replace(/\s*\|\s*TikTok.*$/i, "").trim();
    if (strip.length >= 2 && strip.length < 80 && !/^tiktok$/i.test(strip)) return strip;
  }
  return null;
}

/**
 * User-Agent strings tried when fetching Instagram/TikTok/YouTube pages.
 *
 * We use only an honest, identified Suppr UA that links to a public bot page.
 * We do NOT impersonate `facebookexternalhit`, WhatsApp, Telegram, or Discord
 * bots — platforms reserve those UAs for their own infrastructure and
 * impersonating them is (a) false representation and (b) evidence of knowing
 * circumvention for CFAA / DMCA § 1201 / platform ToS purposes. Some platforms
 * will return less metadata to an honest bot UA; that is the correct outcome.
 * If a fetch returns nothing, the user can paste the recipe text manually.
 */
const UA_ATTEMPTS = [
  "SupprBot/1.0 (+https://suppr-club.com/bot)",
];

/**
 * Try to extract caption/description from Instagram's embedded JSON data.
 * Instagram embeds post data in <script type="application/ld+json"> or
 * window.__additionalDataLoaded / window._sharedData structures.
 */
function extractFromEmbeddedJson(html: string): { caption: string; imageUrl: string | null; videoUrl: string | null } | null {
  // Try JSON-LD first (Instagram sometimes includes this)
  const ldMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of ldMatches) {
    try {
      const data = JSON.parse(m[1]!) as Record<string, unknown>;
      const desc = (data.articleBody ?? data.description ?? data.caption ?? "") as string;
      const img = (data.image ?? data.thumbnailUrl ?? "") as string;
      if (desc && desc.length > 20) {
        return {
          caption: decodeHtmlEntities(desc),
          imageUrl: typeof img === "string" ? img : null,
          videoUrl: null,
        };
      }
    } catch { /* continue */ }
  }

  // Try extracting from inline script data (window._sharedData, etc.)
  const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of scriptMatches) {
    const script = m[1] ?? "";
    // Look for caption/edge_media_to_caption patterns in serialized JSON
    const captionMatch = script.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (captionMatch?.[1] && captionMatch[1].length > 30) {
      try {
        const decoded = JSON.parse(`"${captionMatch[1]}"`);
        const imgMatch = script.match(/"display_url"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        let imgUrl: string | null = null;
        if (imgMatch?.[1]) {
          try { imgUrl = JSON.parse(`"${imgMatch[1]}"`); } catch { /* ignore */ }
        }
        const vidMatch = script.match(/"video_url"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        let vidUrl: string | null = null;
        if (vidMatch?.[1]) {
          try { vidUrl = JSON.parse(`"${vidMatch[1]}"`); } catch { /* ignore */ }
        }
        return { caption: decodeHtmlEntities(decoded), imageUrl: imgUrl, videoUrl: vidUrl };
      } catch { /* continue */ }
    }
  }
  return null;
}

/**
 * Fetch social post metadata from Instagram/TikTok URL.
 * Tries multiple user agents and extraction strategies to maximize success.
 */
export async function fetchSocialPostMeta(url: string): Promise<SocialPostMeta | null> {
  const platform = detectSocialPlatform(url);
  if (!platform) return null;

  // For Instagram, try oEmbed first to get a clean thumbnail (no play-button overlay).
  // We'll use this image URL in preference to og:image if available.
  let oembedImageUrl: string | null = null;
  let authorDisplay: string | null = null;
  if (platform === "instagram") {
    const oem = await fetchInstagramOembed(url);
    oembedImageUrl = oem.thumbnailUrl;
    authorDisplay = instagramHandleFromPostUrl(url) ?? oem.authorName;
  }
  if (platform === "tiktok") {
    authorDisplay = tiktokHandleFromPostUrl(url);
    // TikTok oEmbed gives a clean thumbnail without the play-button overlay
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
      const oRes = await fetch(oembedUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: "application/json" },
      });
      if (oRes.ok) {
        const oData = await oRes.json() as { thumbnail_url?: string; author_name?: string };
        if (typeof oData.thumbnail_url === "string" && oData.thumbnail_url.startsWith("http")) {
          oembedImageUrl = oData.thumbnail_url;
        }
        if (!authorDisplay && typeof oData.author_name === "string" && oData.author_name.trim()) {
          authorDisplay = oData.author_name.trim();
        }
      }
    } catch { /* oEmbed optional */ }
  }
  if (platform === "youtube") {
    // YouTube oEmbed gives us clean title + author
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const oRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
      if (oRes.ok) {
        const oData = await oRes.json() as { title?: string; author_name?: string };
        authorDisplay = oData.author_name ?? null;
      }
    } catch { /* oEmbed optional */ }
  }

  for (const ua of UA_ATTEMPTS) {
    let html: string;
    try {
      // ENG-1037 (SSRF): `url` is the user-pasted social URL — never fetch it
      // with `redirect: "follow"`. A malicious/compromised post host could
      // 30x-chain into a cloud-metadata or internal host (169.254.169.254,
      // 127.0.0.1, RFC-1918). `followWithSsrfGuard` follows redirects MANUALLY
      // and re-validates every hop against the allowlist + a DNS re-resolve
      // (ENG-682 / ENG-730). Null = a hop hit the blocklist → skip this UA.
      const fetched = await followWithSsrfGuard(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": ua,
        },
      });
      if (!fetched) continue;
      const { res } = fetched;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/html")) continue;
      html = await res.text();
    } catch {
      continue;
    }

    // Strategy 1: Standard meta tags
    const caption =
      extractMetaContent(html, "og:description") ||
      extractMetaContent(html, "twitter:description") ||
      extractMetaContent(html, "description") ||
      "";

    const ogImage =
      extractMetaContent(html, "og:image") ||
      extractMetaContent(html, "twitter:image") ||
      null;

    // Prefer oEmbed thumbnail (clean, no play-button) over og:image for Instagram
    const imageUrl = oembedImageUrl ?? ogImage;

    const title =
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      null;

    const ogVideo =
      extractMetaContent(html, "og:video:url") ||
      extractMetaContent(html, "og:video") ||
      extractMetaContent(html, "og:video:secure_url") ||
      null;

    if (caption || title) {
      if (platform === "tiktok" && !authorDisplay) {
        authorDisplay = guessTikTokAuthorDisplay(caption, title);
      }
      if (!authorDisplay) {
        const h = caption.match(/@([a-z0-9._]{2,30})\b/i);
        if (h) authorDisplay = `@${h[1]}`;
      }
      return {
        platform,
        caption: decodeHtmlEntities(caption),
        imageUrl,
        title: title ? decodeHtmlEntities(title) : null,
        authorDisplay,
        rawHtml: html,
        videoUrl: ogVideo,
      };
    }

    // Strategy 2: Embedded JSON data in the page
    const embedded = extractFromEmbeddedJson(html);
    if (embedded) {
      if (platform === "tiktok" && !authorDisplay) {
        authorDisplay = guessTikTokAuthorDisplay(embedded.caption, title);
      }
      if (!authorDisplay) {
        const h = embedded.caption.match(/@([a-z0-9._]{2,30})\b/i);
        if (h) authorDisplay = `@${h[1]}`;
      }
      return {
        platform,
        caption: decodeHtmlEntities(embedded.caption),
        imageUrl: oembedImageUrl ?? embedded.imageUrl,
        title: null,
        authorDisplay,
        rawHtml: html,
        videoUrl: ogVideo ?? embedded.videoUrl,
      };
    }
  }

  return null;
}

// Pure URL + string helpers re-exported from a server-free module so
// mobile bundles can import them without pulling in the server-only
// `aiProvider` / `aiBudget` / `@upstash/redis` chain. See
// `./socialUrlHelpers.ts` for the actual implementations.
import {
  _RESERVED_IG_SEGMENTS_FOR_BACKCOMPAT as RESERVED_IG_SEGMENTS,
  instagramHandleFromPostUrl as _instagramHandleFromPostUrl,
  tiktokHandleFromPostUrl as _tiktokHandleFromPostUrl,
  stripSectionPrefix as _stripSectionPrefix,
} from "./socialUrlHelpers";

export const instagramHandleFromPostUrl = _instagramHandleFromPostUrl;
export const tiktokHandleFromPostUrl = _tiktokHandleFromPostUrl;
export const stripSectionPrefix = _stripSectionPrefix;

// `instagramHandleFromPostUrl` + `tiktokHandleFromPostUrl` live in
// `./socialUrlHelpers.ts` (re-exported above so all existing callers
// keep working). The split keeps mobile bundles free of server deps.

/**
 * Human attribution for a saved social import when oEmbed `author_name` is missing.
 * Order: "recipe by @x" / first @handle in caption → `username` from `/username/reel/…` paths → site label.
 */
export function socialImportSourceName(
  platform: "instagram" | "tiktok" | "youtube",
  postUrl: string,
  authorDisplay: string | null,
  captionText: string,
): string | null {
  const nick = authorDisplay?.trim();
  if (nick) return nick;

  const cap = captionText.replace(/\s+/g, " ");
  const credit =
    cap.match(/\b(?:recipe|recipes?)\s+by\s+@([a-z0-9._]{2,30})\b/i) ??
    cap.match(/\b(?:created|posted)\s+by\s+@([a-z0-9._]{2,30})\b/i) ??
    cap.match(/\bcredit\s*:?\s*@([a-z0-9._]{2,30})\b/i) ??
    cap.match(/\bfollow\s+@([a-z0-9._]{2,30})\b/i);
  if (credit?.[1]) return `@${credit[1]}`;

  const h = cap.match(/@([a-z0-9._]{2,30})\b/i);
  if (h?.[1]) return `@${h[1]}`;

  try {
    const u = new URL(postUrl);
    const seg = u.pathname.split("/").filter(Boolean);
    if (u.hostname.replace(/^www\./, "").includes("instagram") && seg[0]) {
      const first = seg[0].toLowerCase();
      if (!RESERVED_IG_SEGMENTS.has(first)) return `@${seg[0]}`;
    }
  } catch {
    /* ignore */
  }

  const domain = siteNameFromUrl(postUrl);
  if (platform === "tiktok") return domain || "TikTok";
  return domain || "Instagram";
}

/**
 * GPT sometimes returns the entire caption as `title` when the post lacks an
 * explicit headline, which produces recipes with 500+ character "titles".
 * TestFlight feedback `AOHTbpXsKXz9e63LN0j58FQ` (2026-04-18): "Some recipes
 * pulling the whole caption in as the title." Re-flagged on Build 40
 * (2026-05-01) — captions still leaking through when the LLM returns a
 * single ≤120-char caption-style sentence (under the prior cap) and when
 * `meta.title` (Instagram og:title) is itself the full caption.
 *
 * Strategy:
 *   1. Strip cosmetic noise (whitespace, hashtag/URL tails, section headings).
 *   2. Caption-shape early-out — refuse when input is much longer than
 *      the cap and has no structural separator we can split on.
 *   3. Prefer first sentence, then split on em-dash / " - " (taglines),
 *      then split on `,;` if over-cap or has 3+ comma-clauses.
 *   4. Word-boundary clamp at 80 chars. No-spaces residual → refuse.
 *   5. Refuse outputs still over 80 chars; caller falls back to
 *      `meta.title` (also sanitised at the API boundary) or "Imported
 *      recipe".
 *
 * 80-char cap is deliberate: real recipe titles in our DB are 8–65 chars
 * (p99 = 62) per a 2026-05-01 audit; titles >80 chars are always
 * caption-leak in the wild.
 */
const IMPORTED_TITLE_MAX_CHARS = 80;
const CAPTION_SHAPE_REJECT_AT = 240;

function clampToWordBoundary(s: string, max: number): string {
  if (s.length <= max) return s;
  const sliced = s.slice(0, max);
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace > 0 && lastSpace > max * 0.5) {
    return sliced.slice(0, lastSpace).replace(/[.,;:\-—]+$/, "").trim();
  }
  return sliced.replace(/[.,;:\-—]+$/, "").trim();
}

export function sanitiseImportedTitle(raw: unknown): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // Collapse internal whitespace, drop newlines.
  s = s.replace(/\s+/g, " ");
  // Strip trailing tails: hashtag runs, "Follow @x", URL tails.
  s = s.replace(/(\s*(#[\w-]+|@[\w.]+|https?:\/\/\S+))+\s*$/g, "").trim();
  // F-76 (2026-04-26): strip leading "For [phrase]:" section headings.
  s = stripSectionPrefix(s);
  // F-76: strip leading "Recipe:" / "Recipe name:" lead-ins.
  s = s.replace(/^\s*(?:recipe|recipe name|title|dish|name)\s*[:\-]\s*/i, "").trim();
  if (!s) return null;

  // Build 41: caption-shape early-out.
  if (s.length > CAPTION_SHAPE_REJECT_AT) {
    const hasSentenceBreak = /[.!?]\s/.test(s);
    const hasClauseBreak = /[,;]|—|\s-\s/.test(s);
    if (!hasSentenceBreak && !hasClauseBreak) return null;
  }

  // Prefer first sentence over the whole input.
  const firstSentence = s.split(/(?<=[.!?])\s+/)[0]?.trim() ?? s;
  if (firstSentence) s = firstSentence;
  // Tagline split: em-dash / " - " — almost always tagline punctuation.
  const taglineSplit = s.split(/\s*(?:—|\s-\s)\s*/);
  if (taglineSplit.length > 1 && taglineSplit[0]!.trim().length >= 4) {
    s = taglineSplit[0]!.trim();
  }
  // Comma/semicolon split: only when over-cap OR 3+ clauses (caption shape).
  const commaParts = s.split(/\s*[,;]\s*/);
  const tooLong = s.length > IMPORTED_TITLE_MAX_CHARS;
  const captionShape = commaParts.length >= 3;
  if ((tooLong || captionShape) && commaParts[0]!.trim().length >= 4) {
    s = commaParts[0]!.trim();
  }

  // Word-boundary clamp. No-spaces residual → refuse.
  if (s.length > IMPORTED_TITLE_MAX_CHARS) {
    if (!s.includes(" ")) return null;
    s = clampToWordBoundary(s, IMPORTED_TITLE_MAX_CHARS);
  }

  if (s.length > IMPORTED_TITLE_MAX_CHARS) return null;
  if (!s) return null;
  return s;
}

/**
 * F-34 (2026-04-21, TestFlight ANmFiVpOfYEN) — strip recipe section-heading
 * prefixes that the LLM sometimes bakes into individual ingredient strings
 * (e.g. "For the creamy cucumber salad: 1 tbsp miso" → "1 tbsp miso").
 *
 * Matches "For [phrase]:" anchored at the start of the string. Kept
 * conservative: must start with "For", must end with a colon, must have
 * at least one word between. Any trailing content after the colon is kept.
 * Runs after LLM extraction so repeated or mid-string "For [X]:" (which
 * would be part of a real ingredient name, unlikely but possible) are not
 * stripped.
 */
// `stripSectionPrefix` is re-exported above from `./socialUrlHelpers.ts`.

function extractMetaContent(html: string, property: string): string | null {
  // Match both property="..." and name="..." patterns
  const patterns = [
    new RegExp(`<meta\\s+(?:[^>]*?)property=["']${escapeRegex(property)}["']\\s+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+(?:[^>]*?)property=["']${escapeRegex(property)}["']`, "i"),
    new RegExp(`<meta\\s+(?:[^>]*?)name=["']${escapeRegex(property)}["']\\s+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+(?:[^>]*?)name=["']${escapeRegex(property)}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Best-effort prep/cook minutes from caption (used when the model omits times).
 */
export function parsePrepCookMinutesFromCaption(text: string): { prepTimeMin: number | null; cookTimeMin: number | null } {
  const t = text.replace(/\s+/g, " ");
  let prepTimeMin: number | null = null;
  let cookTimeMin: number | null = null;

  const clamp = (n: number) => (Number.isFinite(n) && n > 0 && n <= 24 * 60 ? Math.round(n) : null);

  const mPrep =
    t.match(/\bprep(?:aration)?(?:\s*time)?\s*[:#\-–]?\s*(\d{1,3})\s*(?:min(?:utes?)?|mins?|m)\b/i) ??
    t.match(/\b(\d{1,3})\s*(?:min(?:utes?)?|mins?|m)\s+prep(?:aration)?\b/i) ??
    t.match(/\b(\d{1,3})\s*(?:min(?:utes?)?|m)\b[^.]{0,32}\bprep\b/i);
  if (mPrep?.[1]) prepTimeMin = clamp(parseInt(mPrep[1], 10));

  const mCook =
    t.match(/\bcook(?:ing)?(?:\s*time)?\s*[:#\-–]?\s*(\d{1,3})\s*(?:min(?:utes?)?|mins?|m)\b/i) ??
    t.match(/\b(\d{1,3})\s*(?:min(?:utes?)?|mins?|m)\s+cook(?:ing)?\b/i);
  if (mCook?.[1]) cookTimeMin = clamp(parseInt(mCook[1], 10));

  // "20 min prep" / "15m prep" (compact)
  if (prepTimeMin == null) {
    const m = t.match(/\b(\d{1,3})\s*(?:min(?:utes?)?|mins?|m)\s+prep\b/i) ?? t.match(/\b(\d{1,3})\s*m\s+prep\b/i);
    if (m?.[1]) prepTimeMin = clamp(parseInt(m[1], 10));
  }
  if (cookTimeMin == null) {
    const m = t.match(/\b(\d{1,3})\s*(?:min(?:utes?)?|mins?|m)\s+cook\b/i) ?? t.match(/\b(\d{1,3})\s*m\s+cook\b/i);
    if (m?.[1]) cookTimeMin = clamp(parseInt(m[1], 10));
  }

  return { prepTimeMin, cookTimeMin };
}

/**
 * Best-effort extraction of Instagram comments from embedded GraphQL JSON.
 * Instagram embeds initial top-level comments in <script> tags as serialized
 * GraphQL data (edge_media_to_parent_comment / edge_media_to_comment).
 * Returns concatenated comment texts, or null if none found.
 * Never throws — Instagram changes their embedded structure frequently.
 */
export function extractCommentsFromHtml(html: string): string | null {
  try {
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    const commentTexts: string[] = [];

    for (const m of scriptMatches) {
      const script = m[1] ?? "";
      // Look for comment edge structures in serialized GraphQL data
      if (
        !script.includes("edge_media_to_parent_comment") &&
        !script.includes("edge_media_to_comment")
      ) {
        continue;
      }

      // Extract individual comment text nodes from the edges array.
      // The structure is: "edges":[{"node":{"text":"..."}}, ...]
      // We use a targeted regex rather than full JSON parsing because
      // the surrounding structure may be incomplete or very large.
      const nodeMatches = script.matchAll(
        /"node"\s*:\s*\{[^}]*?"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g,
      );
      for (const nm of nodeMatches) {
        if (!nm[1] || nm[1].length < 15) continue; // skip emoji-only / short reactions
        try {
          const decoded = JSON.parse(`"${nm[1]}"`) as string;
          // Skip very short comments and duplicate caption text
          if (decoded.length >= 15) {
            commentTexts.push(decoded);
          }
        } catch {
          /* skip malformed */
        }
      }
    }

    if (commentTexts.length === 0) return null;
    // Deduplicate and take up to 10 comments
    const unique = [...new Set(commentTexts)].slice(0, 10);
    return unique.join("\n\n");
  } catch {
    return null;
  }
}

/**
 * Send social post caption to OpenAI to extract structured recipe data.
 *
 * Note (2026-04-19): a Whisper-based video-audio transcription path used to
 * live here. It was removed on IP-counsel advice — downloading Instagram /
 * TikTok video content and transcribing its audio is a reproduction of the
 * audio track (17 USC § 106(1)) and typically breaches the platforms' terms
 * of service. Recipe extraction now runs from the caption (and any public
 * URL found in the caption) only.
 */
/**
 * Stable error class so route handlers can catch a vendor-side
 * failure and surface it through the central import-error mapper
 * instead of echoing the raw "OpenAI API error: 429" string at the
 * user (audit I01 + I02, 2026-05-05). The `code` field is one of
 * `ImportErrorCode`'s AI-side codes.
 */
export class CaptionExtractionError extends Error {
  readonly code: "ai_rate_limited" | "ai_unavailable" | "ai_request_failed";
  /** Upstream HTTP status, useful for telemetry (NOT shown to users). */
  readonly upstreamStatus: number;
  /** Suggested Retry-After seconds when the upstream returned one. */
  readonly retryAfterSec: number | null;
  constructor(args: {
    code: "ai_rate_limited" | "ai_unavailable" | "ai_request_failed";
    upstreamStatus: number;
    retryAfterSec?: number | null;
  }) {
    super(args.code);
    this.name = "CaptionExtractionError";
    this.code = args.code;
    this.upstreamStatus = args.upstreamStatus;
    this.retryAfterSec = args.retryAfterSec ?? null;
  }
}

/** A caption ingredient the model was unsure it parsed correctly. Surfaced
 *  in the import review/verify UI for explicit user confirmation. */
export type FlaggedIngredient = {
  name: string;
  raw: string;
  confidence: number;
};

export async function extractRecipeFromCaption(
  caption: string,
  imageUrl?: string | null,
  userId?: string | null,
): Promise<{
  title: string | null;
  ingredients: string[];
  steps: string[];
  notes: string | null;
  servings: number | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  /**
   * Ingredients the model flagged as low-confidence at parse time (distinct
   * from the downstream nutrition-match confidence). Empty when every line
   * parsed cleanly. The caller surfaces these in the review UI so uncertain
   * lines are confirmed, never silently trusted.
   */
  flaggedIngredients: FlaggedIngredient[];
  /**
   * `false` when an `imageUrl` was provided but OpenAI rejected it
   * and the function fell back to a text-only prompt. `true` when
   * the image was actually used. `undefined` when no image was
   * supplied. Audit I05 (2026-05-05) — the previous return shape
   * gave callers no way to know the image was silently dropped, so
   * the import preview claimed the recipe came from the image when
   * it didn't.
   */
  imageUsed?: boolean;
}> {
  // Recipe-vision contract (2026-06-11) — the caption extractor now uses the
  // shared strict structured schema so parse confidence is captured per
  // ingredient. The caption text is appended to the shared system prompt so
  // the model has both the schema rules and the content in one place.
  const prompt = `${buildStructuredRecipePrompt("caption")}

The caption text is:
"""
${caption.slice(0, 4000)}
"""`;

  // 2026-05-08: migrated from direct OpenAI fetch to the shared
  // `callAiText` / `callAiVision` helpers (vendor-neutral). Default
  // path is Claude Sonnet 4.6; falls back to OpenAI gpt-4o-mini if
  // only OPENAI_API_KEY is set. See
  // `docs/decisions/2026-05-08-food-correction-verification-pipeline.md`.
  const callAi = async (useImage: boolean): Promise<AiCallResult> => {
    if (useImage && imageUrl) {
      // Anthropic vision wants base64 + media_type, not a URL. Fetch
      // the image first, then pass as a data URL — the helper strips
      // it back into base64 + media_type itself.
      // ENG-1037 (SSRF): `imageUrl` is derived from the post's og:image /
      // oEmbed thumbnail — attacker-influenceable. A bare `fetch` defaults to
      // `redirect: "follow"`, so a crafted image URL could 30x-chain into an
      // internal/metadata host. Route through the SSRF guard (per-hop allowlist
      // + DNS re-resolve); a refusal (null) is treated as a failed image fetch.
      const imgFetched = await followWithSsrfGuard(imageUrl).catch(() => null);
      const imgRes = imgFetched?.res ?? null;
      if (!imgRes || !imgRes.ok) {
        // Image fetch failed — caller will retry without it.
        return {
          ok: false,
          error: "ai_http_error",
          status: 502,
          message: "image fetch failed",
          vendor: "claude",
          modelVersion: "n/a",
          upstreamStatus: imgRes?.status ?? null,
        };
      }
      const arrayBuf = await imgRes.arrayBuffer();
      const mime = imgRes.headers.get("content-type") || "image/jpeg";
      const b64 = Buffer.from(arrayBuf).toString("base64");
      const dataUrl = `data:${mime};base64,${b64}`;
      return callAiVision({
        callSite: "extractSocialRecipe",
        userId: userId ?? null,
        systemPrompt: prompt,
        userText: "Extract the recipe from the caption above + this image.",
        imageDataUrl: dataUrl,
        expectJson: true,
        temperature: 0.2,
        maxTokens: 2000,
      });
    }
    return callAiText({
      callSite: "extractSocialRecipe",
      userId: userId ?? null,
      userText: prompt,
      expectJson: true,
      temperature: 0.2,
      maxTokens: 2000,
    });
  };

  let aiResult = await callAi(true);
  let imageUsed: boolean | undefined = imageUrl ? true : undefined;

  // F-121 (TestFlight `AJK4VIZdlOwU_yQWVLn_9pc`, 2026-05-06): single
  // server-side retry on rate-limit. Helps absorb transient burst
  // limits before they bubble up as a user-facing "service is busy".
  if (!aiResult.ok && aiResult.error === "ai_rate_limited") {
    const retryAfterMs = 2000 + Math.floor(Math.random() * 500);
    await new Promise((r) => setTimeout(r, retryAfterMs));
    aiResult = await callAi(true);
  }

  // If the image URL is invalid/expired (common with Instagram CDN URLs),
  // the vision call fails. Retry text-only and flag `imageUsed: false`
  // (audit I05, 2026-05-05). Skip this fallback on 429 — the image
  // isn't the issue there.
  if (!aiResult.ok && aiResult.error !== "ai_rate_limited" && imageUrl) {
    const textOnly = await callAi(false);
    if (textOnly.ok) {
      aiResult = textOnly;
      imageUsed = false;
    }
  }

  if (!aiResult.ok) {
    // PR #95 introduced the typed `CaptionExtractionError` class
    // (audit I02, 2026-05-05) which carries the upstream status +
    // Retry-After so the route handler can surface a 429 with
    // countdown to the client.
    if (aiResult.error === "ai_rate_limited") {
      throw new CaptionExtractionError({
        code: "ai_rate_limited",
        upstreamStatus: aiResult.upstreamStatus ?? 429,
        retryAfterSec: 30,
      });
    }
    if ((aiResult.upstreamStatus ?? 0) >= 500 || aiResult.error === "ai_network_error" || aiResult.error === "ai_timeout") {
      throw new CaptionExtractionError({
        code: "ai_unavailable",
        upstreamStatus: aiResult.upstreamStatus ?? 502,
        retryAfterSec: null,
      });
    }
    throw new CaptionExtractionError({
      code: "ai_request_failed",
      upstreamStatus: aiResult.upstreamStatus ?? 502,
      retryAfterSec: null,
    });
  }

  const heur = parsePrepCookMinutesFromCaption(caption);
  const result = parseStructuredRecipe(aiResult.text);
  if (!result.ok) {
    // Don't echo raw model output — past sanity check failures have
    // included vendor identifiers / prompt fragments (audit I01,
    // 2026-05-05). The notes panel was the surface where this leaked
    // into recipe drafts.
    return {
      title: null,
      ingredients: [],
      steps: [],
      notes: null,
      servings: null,
      prepTimeMin: heur.prepTimeMin,
      cookTimeMin: heur.cookTimeMin,
      flaggedIngredients: [],
      imageUsed,
    };
  }
  const recipe = result.recipe;
  // `stripSectionPrefix` is still applied to each flattened line for the
  // belt-and-braces "For the salad:" guard (TestFlight ANmFiVpOfYEN) on top
  // of the schema's instruction to omit headings.
  const ingredients = toIngredientLines(recipe)
    .map((s) => stripSectionPrefix(s.trim()))
    .filter(Boolean);
  const flaggedIngredients: FlaggedIngredient[] = recipe.ingredients
    .filter((ing: StructuredIngredient) => ing.flagged)
    .map((ing: StructuredIngredient) => ({
      name: ing.name,
      raw: ing.raw,
      confidence: ing.confidence,
    }));
  return {
    title: sanitiseImportedTitle(recipe.title),
    ingredients,
    steps: recipe.steps,
    notes: recipe.notes,
    servings: recipe.servings,
    prepTimeMin: recipe.prepTimeMin ?? heur.prepTimeMin,
    cookTimeMin: recipe.cookTimeMin ?? heur.cookTimeMin,
    flaggedIngredients,
    imageUsed,
  };
}
