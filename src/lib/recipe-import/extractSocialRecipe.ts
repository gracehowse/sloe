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

export type SocialPlatform = "instagram" | "tiktok" | null;

export function detectSocialPlatform(url: string): SocialPlatform {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am") return "instagram";
    if (host === "tiktok.com" || host.endsWith(".tiktok.com") || host === "vm.tiktok.com") return "tiktok";
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
}

/**
 * Try Instagram's oEmbed API to get a clean thumbnail without the play-button overlay.
 * The public endpoint works without an access token for basic metadata.
 * Falls back to null so callers can use og:image instead.
 */
async function fetchInstagramOembedImage(postUrl: string): Promise<string | null> {
  // Try the public Facebook Graph oEmbed endpoint first (requires app token if rate-limited,
  // but the basic endpoint works for low-volume usage).
  // Fallback: Instagram's own oEmbed endpoint.
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
      if (data.thumbnail_url && typeof data.thumbnail_url === "string") {
        return data.thumbnail_url;
      }
    } catch {
      // oEmbed failed — continue to next endpoint or fall through
    }
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
function extractFromEmbeddedJson(html: string): { caption: string; imageUrl: string | null } | null {
  // Try JSON-LD first (Instagram sometimes includes this)
  const ldMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of ldMatches) {
    try {
      const data = JSON.parse(m[1]!) as Record<string, unknown>;
      const desc = (data.articleBody ?? data.description ?? data.caption ?? "") as string;
      const img = (data.image ?? data.thumbnailUrl ?? "") as string;
      if (desc && desc.length > 20) {
        return { caption: desc, imageUrl: typeof img === "string" ? img : null };
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
        return { caption: decoded, imageUrl: imgUrl };
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
  if (platform === "instagram") {
    oembedImageUrl = await fetchInstagramOembedImage(url);
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

    if (caption || title) {
      return { platform, caption, imageUrl, title };
    }

    // Strategy 2: Embedded JSON data in the page
    const embedded = extractFromEmbeddedJson(html);
    if (embedded) {
      return {
        platform,
        caption: embedded.caption,
        imageUrl: oembedImageUrl ?? embedded.imageUrl,
        title: null,
      };
    }
  }

  return null;
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
  "servings": number or null
}

Rules:
- ingredients: one string per ingredient line with amounts (e.g. "200g chicken breast")
- steps: ordered cooking instructions; extract from the caption
- If the caption doesn't contain a recipe, return empty arrays and null title
- If ingredients or steps are implied but not explicit, use best effort
- Ignore hashtags, mentions, and promotional text
- servings: extract if mentioned, otherwise null`;

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
    };
    return {
      title: parsed.title ?? null,
      ingredients: Array.isArray(parsed.ingredients)
        ? parsed.ingredients.map((s) => String(s).trim()).filter(Boolean)
        : [],
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((s) => String(s).trim()).filter(Boolean)
        : [],
      notes: parsed.notes ?? null,
      servings: typeof parsed.servings === "number" ? parsed.servings : null,
    };
  } catch {
    return { title: null, ingredients: [], steps: [], notes: raw.slice(0, 500), servings: null };
  }
}
