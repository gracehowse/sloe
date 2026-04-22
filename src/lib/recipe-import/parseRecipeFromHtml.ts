/**
 * Extract Recipe-shaped data from HTML via JSON-LD (schema.org Recipe).
 * Best-effort: many sites omit or misstructure fields.
 */

/** Decode common HTML entities that leak through JSON-LD text fields. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;/gi, "\u2013")
    .replace(/&mdash;/gi, "\u2014")
    .replace(/&frac12;/gi, "\u00BD")
    .replace(/&frac14;/gi, "\u00BC")
    .replace(/&frac34;/gi, "\u00BE")
    .replace(/&deg;/gi, "\u00B0");
}

export interface ParsedRecipeDraft {
  title: string;
  description: string | null;
  ingredients: string[];
  instructions: string[];
  servings: number | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  imageUrl: string | null;
  /** Original author name from schema.org JSON-LD */
  sourceName: string | null;
  /** Per-serving nutrition from the website's JSON-LD (most accurate source) */
  siteNutrition: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiberG: number | null;
    sugarG: number | null;
    saturatedFatG: number | null;
    sodiumMg: number | null;
  } | null;
  /** Calories per serving (populated by import route if siteNutrition unavailable) */
  calories?: number;
  /** Protein per serving */
  protein?: number;
  /** Carbs per serving */
  carbs?: number;
  /** Fat per serving */
  fat?: number;
}

/**
 * Parse schema.org / ISO-8601 duration strings to total minutes.
 * Handles `PT15M`, `PT1H30M`, `P1DT2H30M` (day + time), and plain `P2D`.
 */
function parseIsoDurationToMinutes(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const s = iso.trim();
  if (!s) return null;

  if (!/^P/i.test(s)) {
    const bareMin = s.match(/^(\d+)\s*(?:min|minutes?)\s*$/i);
    if (bareMin) {
      const n = Number.parseInt(bareMin[1], 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  }

  let total = 0;
  const dayPart = s.match(/^P(\d+)D/i);
  if (dayPart) total += Number.parseInt(dayPart[1], 10) * 24 * 60;

  const tIdx = s.indexOf("T");
  if (tIdx >= 0) {
    const afterT = s.slice(tIdx + 1);
    const timeMatch = afterT.match(/^(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
    if (timeMatch) {
      const h = timeMatch[1] ? Number.parseInt(timeMatch[1], 10) : 0;
      const min = timeMatch[2] ? Number.parseInt(timeMatch[2], 10) : 0;
      const sec = timeMatch[3] ? Number.parseInt(timeMatch[3], 10) : 0;
      total += h * 60 + min + Math.round(sec / 60);
    }
  }

  if (total > 0) return total;

  if (/^PT/i.test(s)) {
    const m = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
    if (m) {
      const h = m[1] ? Number.parseInt(m[1], 10) : 0;
      const min = m[2] ? Number.parseInt(m[2], 10) : 0;
      const sec = m[3] ? Number.parseInt(m[3], 10) : 0;
      const sub = h * 60 + min + Math.round(sec / 60);
      if (sub > 0) return sub;
    }
  }

  return null;
}

function durationFieldToMinutes(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  if (typeof raw === "string") return parseIsoDurationToMinutes(raw);
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    if (typeof o.duration === "string") return parseIsoDurationToMinutes(o.duration);
  }
  return null;
}

function asStringArrayRecipeYield(yieldVal: unknown): number | null {
  if (yieldVal == null) return null;
  if (typeof yieldVal === "number" && Number.isFinite(yieldVal)) {
    return Math.max(1, Math.round(yieldVal));
  }
  if (typeof yieldVal === "string") {
    // Handle ranges like "4-6" or "4 to 6" — take the first number
    const rangeMatch = yieldVal.match(/(\d+)\s*[-–—]\s*(\d+)/);
    if (rangeMatch) {
      const lo = Number.parseInt(rangeMatch[1], 10);
      if (Number.isFinite(lo) && lo > 0) return Math.max(1, lo);
    }
    // Extract first numeric value from strings like "4 servings", "Serves 4"
    const numMatch = yieldVal.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      const n = Number.parseFloat(numMatch[1]);
      if (Number.isFinite(n) && n > 0) return Math.max(1, Math.round(n));
    }
  }
  // Many sites use recipeYield: ["4"] or ["4 servings"] or ["4", "4 servings"]
  if (Array.isArray(yieldVal)) {
    for (const item of yieldVal) {
      const result = asStringArrayRecipeYield(item);
      if (result != null) return result;
    }
  }
  return null;
}

function normalizeIngredientText(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = decodeHtmlEntities(raw).trim();
    return t.length ? t : null;
  }
  // Some sites wrap ingredients in arrays: ["1 cup flour"]
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const result = normalizeIngredientText(item);
      if (result) return result;
    }
    return null;
  }
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    for (const prop of ["text", "name"]) {
      const val = o[prop];
      if (typeof val === "string" && val.trim()) return decodeHtmlEntities(val).trim();
      // Handle array-valued text/name: { text: ["1 cup flour"] }
      if (Array.isArray(val) && val.length > 0) {
        const first = normalizeIngredientText(val[0]);
        if (first) return first;
      }
    }
  }
  return null;
}

function collectInstructionStrings(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    return decodeHtmlEntities(raw)
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      if (typeof item === "string") {
        const t = decodeHtmlEntities(item).trim();
        if (t) out.push(t);
      } else if (typeof item === "object" && item !== null) {
        const o = item as Record<string, unknown>;
        if (String(o["@type"] ?? "").toLowerCase() === "howtostep") {
          const t = o.text;
          if (typeof t === "string" && t.trim()) out.push(decodeHtmlEntities(t).trim());
        } else if (Array.isArray(o.itemListElement)) {
          out.push(...collectInstructionStrings(o.itemListElement));
        }
      }
    }
    return out;
  }
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    if (o["@type"] === "ItemList" && Array.isArray(o.itemListElement)) {
      return collectInstructionStrings(o.itemListElement);
    }
    if (o["@type"] === "HowTo" && o.step) {
      return collectInstructionStrings(o.step);
    }
  }
  return [];
}

function extractRecipeObjects(node: unknown): Record<string, unknown>[] {
  if (node == null) return [];
  if (Array.isArray(node)) {
    return node.flatMap(extractRecipeObjects);
  }
  if (typeof node !== "object") return [];
  const o = node as Record<string, unknown>;
  const types = o["@type"];
  const typeList = Array.isArray(types) ? types : [types];
  const isRecipe = typeList.some((t) => {
    if (typeof t !== "string") return false;
    const tt = t.trim().toLowerCase();
    return tt === "recipe" || tt.endsWith("/recipe") || tt.endsWith("#recipe");
  });
  if (isRecipe) {
    return [o];
  }
  if (o["@graph"]) {
    return extractRecipeObjects(o["@graph"]);
  }
  return [];
}

/**
 * Hostnames we will not persist as `recipes.image_url`. Hotlinking publisher
 * CDN imagery on a commercial SaaS is direct reproduction under 17 USC § 106
 * (and UK CDPA 1988 § 17, § 19). When a JSON-LD image points at one of these
 * hosts we drop it; the recipe still imports with a placeholder, and the user
 * can still navigate to `source_url` to see the original photography.
 */
const BLOCKED_IMAGE_HOSTS = [
  "images.immediate.co.uk",
  "bbcgoodfood.com",
  "cdninstagram.com",
  "fbcdn.net",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "ytimg.com",
];

function isBlockedImageHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_IMAGE_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
  } catch {
    return false;
  }
}

/**
 * F-64 (2026-04-22): TestFlight build-28 `APpAKhhR` ("Images are here
 * but they are terrible"). Seeded rows stored 200–225 px thumbnails
 * directly from JSON-LD because most sites embed the smallest-size
 * variant there for SEO compatibility. On F-61's new hero-sized
 * Discover cards (16:10 full-width) those thumbnails look
 * pixelated. Full-resolution originals live in predictable URL
 * patterns on the same CDN — strip the WP/Photon sizing suffixes
 * to recover them.
 *
 * Patterns unwound:
 *   - WordPress core: `-225x225.jpg` / `-300x200.png` suffix → remove.
 *   - Automattic Photon / Jetpack / tachyon: `?fit=225%2C225`,
 *     `?resize=300,200`, `?w=400&h=400` query → drop size params.
 *   - "-scaled" (WP auto-downscale) → leave as-is, already large.
 */
function upscaleImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Strip WP/Photon-style size query params
    for (const k of ["fit", "resize", "w", "h", "width", "height"]) {
      parsed.searchParams.delete(k);
    }
    // Strip WP core `-<W>x<H>` suffix on the filename. Matches
    // `something-225x225.jpg`, `something-300x200.png`, etc. Does
    // NOT match `-scaled.jpg` (WP full-size) or filename fragments
    // that just happen to contain digits-x-digits.
    parsed.pathname = parsed.pathname.replace(
      /-(\d{2,4})x(\d{2,4})(\.[a-zA-Z0-9]+)$/,
      "$3",
    );
    return parsed.toString();
  } catch {
    return url;
  }
}

function firstImageUrl(image: unknown): string | null {
  if (image == null) return null;
  if (typeof image === "string") {
    const trimmed = image.trim();
    if (!trimmed) return null;
    return isBlockedImageHost(trimmed) ? null : trimmed;
  }
  if (Array.isArray(image)) {
    for (const x of image) {
      const u = firstImageUrl(x);
      if (u) return u;
    }
    return null;
  }
  if (typeof image === "object" && image !== null) {
    const o = image as Record<string, unknown>;
    if (typeof o.url === "string") {
      const trimmed = o.url.trim();
      if (!trimmed) return null;
      return isBlockedImageHost(trimmed) ? null : trimmed;
    }
  }
  return null;
}

/** Parse "105 calories" or "6 grams fat" → numeric value. */
function parseNutritionValue(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return null;
  const m = raw.match(/([\d.]+)/);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

/** Extract NutritionInformation from schema.org Recipe JSON-LD. */
function extractNutrition(nutrition: unknown): ParsedRecipeDraft["siteNutrition"] {
  if (!nutrition || typeof nutrition !== "object") return null;
  const n = nutrition as Record<string, unknown>;
  const calories = parseNutritionValue(n.calories);
  const protein = parseNutritionValue(n.proteinContent);
  const carbs = parseNutritionValue(n.carbohydrateContent);
  const fat = parseNutritionValue(n.fatContent);
  // If no meaningful data, skip
  if (calories == null && protein == null && carbs == null && fat == null) return null;
  return {
    calories,
    protein,
    carbs,
    fat,
    fiberG: parseNutritionValue(n.fiberContent),
    sugarG: parseNutritionValue(n.sugarContent),
    saturatedFatG: parseNutritionValue(n.saturatedFatContent),
    sodiumMg: (() => {
      const v = parseNutritionValue(n.sodiumContent);
      if (v == null) return null;
      // Schema.org uses "milligram of sodium" but some sites use grams
      const raw = String(n.sodiumContent ?? "").toLowerCase();
      if (raw.includes("gram") && !raw.includes("milligram")) return Math.round(v * 1000);
      return Math.round(v);
    })(),
  };
}

function extractAuthorName(author: unknown): string | null {
  if (!author) return null;
  if (typeof author === "string") return author.trim() || null;
  if (Array.isArray(author)) {
    for (const a of author) {
      const n = extractAuthorName(a);
      if (n) return n;
    }
    return null;
  }
  if (typeof author === "object" && author !== null) {
    const o = author as Record<string, unknown>;
    if (typeof o.name === "string" && o.name.trim()) return o.name.trim();
  }
  return null;
}

function extractPublisherName(publisher: unknown): string | null {
  if (!publisher) return null;
  if (typeof publisher === "string") return publisher.trim() || null;
  if (typeof publisher === "object" && publisher !== null) {
    const o = publisher as Record<string, unknown>;
    if (typeof o.name === "string" && o.name.trim()) return o.name.trim();
  }
  return null;
}

/** Extract a human-readable site name from a URL (e.g. "bbcgoodfood.com" → "BBC Good Food"). */
export function siteNameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return "External source";
  }
}

/**
 * F-64 (2026-04-22): og:image and twitter:image meta tags are
 * usually the 1200×630+ social-share variant (Facebook/Twitter
 * require those sizes) while JSON-LD often stores the smallest
 * thumbnail. Prefer OG/Twitter when present; fall back to JSON-LD.
 */
function extractOgImage(html: string): string | null {
  const ogMatch =
    html.match(
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
    ) ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i,
    );
  if (ogMatch?.[1]) {
    const url = ogMatch[1].trim();
    if (url && !isBlockedImageHost(url)) return url;
  }
  const twMatch =
    html.match(
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
    ) ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i,
    );
  if (twMatch?.[1]) {
    const url = twMatch[1].trim();
    if (url && !isBlockedImageHost(url)) return url;
  }
  return null;
}

export function parseRecipeFromHtml(html: string): ParsedRecipeDraft | null {
  const ogImage = extractOgImage(html);
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of scripts) {
    const jsonText = m[1]?.trim();
    if (!jsonText) continue;
    let data: unknown;
    try {
      data = JSON.parse(jsonText);
    } catch {
      continue;
    }
    const recipes = extractRecipeObjects(data);
    for (const r of recipes) {
      const name = r.name;
      const title = typeof name === "string" && name.trim() ? decodeHtmlEntities(name).trim() : null;
      if (!title) continue;

      const desc = r.description;
      const description =
        typeof desc === "string" && desc.trim() ? decodeHtmlEntities(desc).trim().replace(/\s+/g, " ") : null;

      const ingRaw = r.recipeIngredient;
      const ingredients: string[] = [];
      if (Array.isArray(ingRaw)) {
        for (const x of ingRaw) {
          const line = normalizeIngredientText(x);
          if (line) ingredients.push(line);
        }
      }

      let instructions: string[] = [];
      const ri = r.recipeInstructions;
      if (typeof ri === "string") {
        instructions = collectInstructionStrings(ri);
      } else {
        instructions = collectInstructionStrings(ri);
      }

      const servings = asStringArrayRecipeYield(r.recipeYield);
      const prepTimeMin =
        durationFieldToMinutes(r.prepTime) ??
        durationFieldToMinutes((r as Record<string, unknown>).preparationTime) ??
        null;
      const cookFromCook = durationFieldToMinutes(r.cookTime);
      const cookFromPerform = durationFieldToMinutes((r as Record<string, unknown>).performTime);
      const totalMin = durationFieldToMinutes(r.totalTime);
      let cookTimeMin = cookFromCook ?? cookFromPerform ?? null;
      if (cookTimeMin == null && totalMin != null) {
        if (prepTimeMin != null && totalMin >= prepTimeMin) {
          const diff = totalMin - prepTimeMin;
          cookTimeMin = diff > 0 ? diff : totalMin;
        } else {
          cookTimeMin = totalMin;
        }
      }
      // F-64: prefer og:image / twitter:image over JSON-LD because
      // the latter is frequently a 225x225 thumbnail, while social
      // meta tags are 1200x630+ by convention. Both go through
      // `upscaleImageUrl` to strip WP/Photon size suffixes when
      // the CDN-native full-size URL is derivable.
      const ldImage = firstImageUrl(r.image);
      const chosen = ogImage ?? ldImage;
      const imageUrl = chosen ? upscaleImageUrl(chosen) : null;
      const sourceName = extractAuthorName(r.author) ?? extractPublisherName(r.publisher);
      const siteNutrition = extractNutrition(r.nutrition);

      return {
        title,
        description,
        ingredients,
        instructions,
        servings,
        prepTimeMin,
        cookTimeMin,
        imageUrl,
        sourceName,
        siteNutrition,
      };
    }
  }
  return null;
}
