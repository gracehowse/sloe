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
 * Fetch social post metadata from Instagram/TikTok URL.
 * Extracts og:description and og:image from the server-rendered HTML.
 */
export async function fetchSocialPostMeta(url: string): Promise<SocialPostMeta | null> {
  const platform = detectSocialPlatform(url);
  if (!platform) return null;

  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html")) return null;

  const html = await res.text();

  // Extract og:description / twitter:description (caption text lives here)
  const caption =
    extractMetaContent(html, "og:description") ||
    extractMetaContent(html, "twitter:description") ||
    extractMetaContent(html, "description") ||
    "";

  const imageUrl =
    extractMetaContent(html, "og:image") ||
    extractMetaContent(html, "twitter:image") ||
    null;

  const title =
    extractMetaContent(html, "og:title") ||
    extractMetaContent(html, "twitter:title") ||
    null;

  if (!caption && !title) return null;

  return { platform, caption, imageUrl, title };
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

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

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
