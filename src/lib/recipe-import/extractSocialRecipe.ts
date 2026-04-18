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

import { siteNameFromUrl } from "./parseRecipeFromHtml";

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

/** User-Agent strings to try — platforms serve meta tags to some crawlers but not others. */
const UA_ATTEMPTS = [
  // Chrome desktop (default)
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  // Facebook crawler — many platforms whitelist this for link previews
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  // WhatsApp link preview bot
  "WhatsApp/2.23.20.0",
  // Telegram link preview
  "TelegramBot (like TwitterBot)",
  // Discord embed bot
  "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
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
        return { caption: desc, imageUrl: typeof img === "string" ? img : null, videoUrl: null };
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
        return { caption: decoded, imageUrl: imgUrl, videoUrl: vidUrl };
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
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": ua,
        },
      });
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
      return { platform, caption, imageUrl, title, authorDisplay, rawHtml: html, videoUrl: ogVideo };
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
        caption: embedded.caption,
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

const RESERVED_IG_SEGMENTS = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "stories",
  "explore",
  "accounts",
  "direct",
  "legal",
]);

/**
 * Instagram URLs like `instagram.com/HANDLE/reel/…` or `…/HANDLE/p/…` encode the post owner.
 * Prefer this over oEmbed `author_name`, which can be a generic display string or wrong in edge cases.
 */
export function instagramHandleFromPostUrl(postUrl: string): string | null {
  try {
    const u = new URL(postUrl);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.includes("instagram")) return null;
    const seg = u.pathname.split("/").filter(Boolean);
    if (seg.length < 2) return null;
    const first = seg[0].toLowerCase();
    const second = seg[1].toLowerCase();
    if (RESERVED_IG_SEGMENTS.has(first)) return null;
    if (["p", "reel", "reels", "tv"].includes(second)) return `@${seg[0]}`;
    return null;
  } catch {
    return null;
  }
}

export function tiktokHandleFromPostUrl(postUrl: string): string | null {
  try {
    const u = new URL(postUrl);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.includes("tiktok")) return null;
    const m = u.pathname.match(/^\/@([^/]+)/i);
    if (m?.[1]) return `@${m[1]}`;
  } catch {
    /* ignore */
  }
  return null;
}

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
 * pulling the whole caption in as the title."
 *
 * Clamp to one line, strip trailing hashtag/URL runs, cap length.
 * Null out when the result would be too long to be a plausible title —
 * caller will fall back to `meta.title` / "Imported recipe".
 */
const IMPORTED_TITLE_MAX_CHARS = 120;

export function sanitiseImportedTitle(raw: unknown): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // Collapse internal whitespace, drop newlines.
  s = s.replace(/\s+/g, " ");
  // Strip trailing tails: hashtag runs, "Follow @x", URL tails.
  s = s.replace(/(\s*(#[\w-]+|@[\w.]+|https?:\/\/\S+))+\s*$/g, "").trim();
  // If first sentence exists and fits, prefer it.
  const firstSentence = s.split(/(?<=[.!?])\s+/)[0]?.trim();
  if (firstSentence && firstSentence.length <= IMPORTED_TITLE_MAX_CHARS) s = firstSentence;
  if (s.length > IMPORTED_TITLE_MAX_CHARS) {
    // Still too long → reject; caller falls back.
    return null;
  }
  return s || null;
}

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

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
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

const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // 25 MB — OpenAI Whisper file size limit

/**
 * Download a video and transcribe its audio using OpenAI Whisper.
 * Returns the transcript text, or null if download/transcription fails.
 * Never throws — callers treat null as "skip to next tier."
 */
export async function transcribeVideoAudio(
  videoUrl: string,
  openaiKey: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    // --- Download video with size guard ---
    const downloadSignal = AbortSignal.any
      ? AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])])
      : AbortSignal.timeout(15_000);

    const res = await fetch(videoUrl, {
      signal: downloadSignal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });

    if (!res.ok || !res.body) return null;

    // Check Content-Length if available
    const cl = res.headers.get("content-length");
    if (cl && parseInt(cl, 10) > WHISPER_MAX_BYTES) {
      console.error("[recipe-import] Video too large for transcription:", cl, "bytes");
      return null;
    }

    // Stream body with size guard
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > WHISPER_MAX_BYTES) {
        reader.cancel();
        console.error("[recipe-import] Video exceeded 25MB during download, aborting");
        return null;
      }
      chunks.push(value);
    }

    if (totalBytes < 1000) return null; // too small to be a real video

    // Combine chunks into a single buffer
    const videoBuffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      videoBuffer.set(chunk, offset);
      offset += chunk.byteLength;
    }

    // --- Transcribe with Whisper ---
    const whisperSignal = AbortSignal.any
      ? AbortSignal.any([AbortSignal.timeout(30_000), ...(signal ? [signal] : [])])
      : AbortSignal.timeout(30_000);

    const form = new FormData();
    form.append("file", new Blob([videoBuffer], { type: "video/mp4" }), "video.mp4");
    form.append("model", "whisper-1");
    form.append("response_format", "text");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
      signal: whisperSignal,
    });

    if (!whisperRes.ok) {
      console.error("[recipe-import] Whisper API error:", whisperRes.status);
      return null;
    }

    const transcript = (await whisperRes.text()).trim();
    return transcript.length > 0 ? transcript : null;
  } catch (e) {
    console.error("[recipe-import] transcribeVideoAudio failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Send social post caption to OpenAI to extract structured recipe data.
 */
export async function extractRecipeFromCaption(
  caption: string,
  openaiKey: string,
  imageUrl?: string | null,
): Promise<{
  title: string | null;
  ingredients: string[];
  steps: string[];
  notes: string | null;
  servings: number | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
}> {
  const prompt = `You are extracting a recipe from a social media post caption.

The caption text is:
"""
${caption.slice(0, 4000)}
"""

Return a single JSON object (no markdown fences):
{
  "title": string or null,
  "ingredients": string[],
  "steps": string[],
  "notes": string or null,
  "servings": number or null,
  "prepTimeMin": number or null,
  "cookTimeMin": number or null
}

Rules:
- ingredients: one string per ingredient line with amounts (e.g. "200g chicken breast")
- steps: ordered cooking instructions; extract from the caption
- If the caption doesn't contain a recipe, return empty arrays and null title
- If ingredients or steps are implied but not explicit, use best effort
- Ignore hashtags, mentions, and promotional text
- servings: extract if mentioned, otherwise null
- prepTimeMin / cookTimeMin: total minutes if the caption states prep time or cook time (e.g. "prep 15 min", "20 min cook"); otherwise null`;

  const body: Record<string, unknown> = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: imageUrl
          ? [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ]
          : prompt,
      },
    ],
  };

  let res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // If the image URL is invalid/expired (common with Instagram CDN URLs),
  // OpenAI returns 400. Retry without the image.
  if (!res.ok && imageUrl) {
    const textOnlyBody = {
      ...body,
      messages: [{ role: "user", content: prompt }],
    };
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(textOnlyBody),
    });
  }

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
  try {
    const parsed = JSON.parse(raw) as {
      title?: string | null;
      ingredients?: string[];
      steps?: string[];
      notes?: string | null;
      servings?: number | null;
      prepTimeMin?: number | null;
      cookTimeMin?: number | null;
    };
    const heur = parsePrepCookMinutesFromCaption(caption);
    const asPosMin = (v: unknown): number | null => {
      if (v == null) return null;
      const n = typeof v === "string" ? Number.parseFloat(v.replace(/,/g, "")) : typeof v === "number" ? v : NaN;
      if (!Number.isFinite(n) || n <= 0) return null;
      return Math.min(Math.round(n), 24 * 60);
    };
    const prepFromModel = asPosMin(parsed.prepTimeMin);
    const cookFromModel = asPosMin(parsed.cookTimeMin);
    return {
      title: sanitiseImportedTitle(parsed.title),
      ingredients: Array.isArray(parsed.ingredients)
        ? parsed.ingredients.map((s) => String(s).trim()).filter(Boolean)
        : [],
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((s) => String(s).trim()).filter(Boolean)
        : [],
      notes: parsed.notes ?? null,
      servings: typeof parsed.servings === "number" ? parsed.servings : null,
      prepTimeMin: prepFromModel ?? heur.prepTimeMin,
      cookTimeMin: cookFromModel ?? heur.cookTimeMin,
    };
  } catch {
    const heur = parsePrepCookMinutesFromCaption(caption);
    return {
      title: null,
      ingredients: [],
      steps: [],
      notes: raw.slice(0, 500),
      servings: null,
      prepTimeMin: heur.prepTimeMin,
      cookTimeMin: heur.cookTimeMin,
    };
  }
}
