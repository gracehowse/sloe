/**
 * Recipe hero image fallback ladder + source-video host classifier
 * (Recime parity quick-win, 2026-04-30).
 *
 * Two responsibilities, deliberately co-located so the import + cook
 * surfaces share the same helpers:
 *
 *   1. `pickHeroImageUrl(recipe)` — best-effort ladder for which URL
 *      to render as the recipe hero. Order:
 *        a) creator real photo (`image_source: user_upload`)
 *        b) permitted imported photo (`image_source: imported`) or a
 *           YouTube thumbnail derived from `source_video_url` / `source_url`
 *        c) AI-generated private-stub image (`image_source: ai_generated`)
 *        d) `null` — caller falls back to the existing deterministic
 *           gradient renderer (`RecipeHeroFallback.tsx`).
 *
 *      IG / TikTok thumbnails are NOT inferable from the share URL
 *      alone (the canonical thumbnail lives behind their CDN with a
 *      signed token). When we eventually cache an OG thumbnail at
 *      import time, surface it via `image_url`; this helper stays
 *      unchanged.
 *
 *   2. `extractVideoHost(url)` — classifies a URL as
 *      `youtube | instagram | tiktok | other`. Used by the Cook
 *      screen's "Watch original" button and the analytics payload
 *      so we can slice tap-through by host without the URL leaving
 *      the device.
 *
 * Pure + sync. No network. No caching by ref. Safe to call in render.
 */

export type RecipeVideoHost = "youtube" | "instagram" | "tiktok" | "other";
export type RecipeImageSource = "user_upload" | "imported" | "ai_generated" | (string & {});

/**
 * Retired fabricated stock-photo URLs (ENG-1287, 2026-07-01). Before the
 * honest-imagery fix, two client fallbacks assigned these Unsplash photos to
 * recipes that had no image (the mobile `pickDefaultImage` 6-photo pool in
 * `apps/mobile/lib/recipes.ts` and web `DEFAULT_UPLOADED_RECIPE_IMAGE` in
 * `src/context/appData/constants.ts`), and web `RecipeUpload` PERSISTED the
 * first one into `recipes.image_url` for photo-less creations. They are
 * someone else's dish presented as the recipe's real photo, so the ladder
 * treats them as absent — legacy DB rows and offline caches that still carry
 * them render the deterministic `RecipeHeroFallback` instead.
 *
 * Exact-URL match on purpose: two of these photo ids also appear (with
 * different query params) as curated per-dish seed heroes in
 * `seedRecipesV2.ts`, which remain legitimate attributed imagery.
 *
 * DB cleanup for the persisted rows:
 * `supabase/migrations/20260702090000_null_fabricated_recipe_stock_images.sql`.
 */
export const RETIRED_STOCK_IMAGE_URLS: ReadonlySet<string> = new Set([
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop", // green bowl (also web default + RecipeUpload cover)
  "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&h=600&fit=crop", // pasta
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop", // salad
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop", // buddha bowl
  "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800&h=600&fit=crop", // sandwich
  "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=800&h=600&fit=crop", // breakfast
]);

/** True when `url` is one of the retired fabricated stock photos. */
export function isRetiredStockImageUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && RETIRED_STOCK_IMAGE_URLS.has(url.trim());
}

/** Subset of recipe shape this module needs. Both web `RecipeCard`
 *  and mobile `FullRecipe` (apps/mobile/app/recipe/[id].tsx) carry
 *  more fields, but we only read these. `source_video_url` is the
 *  forward-compat field for when the importer caches the original
 *  IG/TT/YT video URL separately from the page URL — until that
 *  ships, callers may pass `source_url` in its place and the helper
 *  will still derive a YouTube thumbnail when the URL is a YT one. */
export interface HeroImageRecipeInput {
  image_url?: string | null;
  image_source?: RecipeImageSource | null;
  source_url?: string | null;
  source_video_url?: string | null;
}

/**
 * Choose the best hero image URL for a recipe. Returns `null` when no
 * candidate is suitable — the caller should render the deterministic
 * gradient + glyph fallback (`RecipeHeroFallback.tsx`) in that case.
 *
 * The function never fakes a thumbnail. Returning a 404-prone URL is
 * worse than returning `null` (the gradient is deterministic and
 * instant; a 404 is a flash of broken-image then layout shift).
 */
export function pickHeroImageUrl(recipe: HeroImageRecipeInput): string | null {
  const rawImageUrl = typeof recipe.image_url === "string" ? recipe.image_url.trim() : "";
  // ENG-1287 — a retired fabricated stock photo is "no image", not a photo.
  const imageUrl = isRetiredStockImageUrl(rawImageUrl) ? "" : rawImageUrl;
  const imageSource = typeof recipe.image_source === "string" ? recipe.image_source : null;

  // 1. Creator real photo. User uploads must always outrank generated
  //    enrichment and imported thumbnails because they are the creator's
  //    owned representation of the dish. Legacy rows without provenance
  //    are treated as creator/imported real imagery unless their URL is a
  //    known generated hero path below.
  if (imageUrl && (imageSource === "user_upload" || (!imageSource && !isGeneratedHeroImageUrl(imageUrl)))) {
    return imageUrl;
  }

  // 2. Permitted imported photo. This includes explicit imported covers
  //    stored in image_url and YouTube thumbnails derived from source URLs.
  if (imageUrl && imageSource === "imported") return imageUrl;
  for (const candidate of [recipe.source_video_url, recipe.source_url]) {
    if (typeof candidate !== "string" || candidate.trim() === "") continue;
    const yt = extractYoutubeThumbnail(candidate);
    if (yt) return yt;
  }

  // 3. AI-generated private-stub enrichment. Callers can label this as
  //    AI/Sloe imagery because the provenance is explicit. Published /
  //    Discover recipes must not receive these URLs in the first place;
  //    when they lack creator/imported imagery, callers render gradient.
  if (imageUrl && (imageSource === "ai_generated" || isGeneratedHeroImageUrl(imageUrl))) {
    return imageUrl;
  }

  // 4. No safe candidate — caller renders the gradient fallback.
  return null;
}

export function isGeneratedHeroImageUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && /(?:^|\/)recipe-images\/heroes\//.test(url);
}

/**
 * Derive a `maxresdefault` thumbnail URL from a YouTube watch / share
 * URL. Returns `null` for non-YouTube hosts.
 *
 * Patterns covered:
 *   - `https://www.youtube.com/watch?v={11-char id}`
 *   - `https://youtu.be/{11-char id}`
 *   - `https://www.youtube.com/shorts/{11-char id}`
 *   - `https://www.youtube.com/embed/{11-char id}`
 *
 * Trailing query string + extra path segments after the id are
 * tolerated. The id itself is exactly 11 characters of
 * `[A-Za-z0-9_-]` per the YouTube id alphabet.
 *
 * Mobile already swaps `hqdefault` / `mqdefault` → `maxresdefault` on
 * the render side (see `apps/mobile/app/recipe/[id].tsx:heroImageUrl`)
 * so emitting `maxresdefault` directly here keeps both code paths
 * agreeing on the same target URL.
 */
export function extractYoutubeThumbnail(url: string): string | null {
  const id = extractYoutubeVideoId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
}

/**
 * Pull the 11-char YouTube video id out of a URL, or null if not a
 * YouTube URL. Exported for tests + the host classifier — callers who
 * just need the thumbnail should use `extractYoutubeThumbnail`.
 */
export function extractYoutubeVideoId(url: string): string | null {
  if (typeof url !== "string" || url.trim() === "") return null;
  // Match watch?v=, youtu.be/, /shorts/, /embed/ — id MUST be exactly
  // 11 chars from the YT id alphabet.
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)/,
  );
  return match ? match[1]! : null;
}

/**
 * Classify the host of a video / page URL. Used by the Cook screen's
 * "Watch original" affordance to:
 *   - decide whether to render the button at all (only when host is
 *     a known video host — `other` still renders, since the link is
 *     valid even if we don't know what the page looks like)
 *   - tag the analytics event so we can slice tap-through by host
 *
 * Returns `other` for unknown hosts, and `other` (not null) for
 * malformed URLs — the caller handles "should I render at all" with
 * a presence check on the URL itself. Never throws.
 */
export function extractVideoHost(url: string | null | undefined): RecipeVideoHost {
  if (typeof url !== "string" || url.trim() === "") return "other";
  let host = "";
  try {
    // URL constructor handles protocol-relative + missing protocol
    // poorly. Normalise: prepend https:// when no scheme is present.
    const normalised = /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`;
    host = new URL(normalised).hostname.toLowerCase();
  } catch {
    return "other";
  }
  // Strip a leading `www.` / `m.` / `mobile.` so subdomain variants
  // map to the same host bucket. We do NOT strip arbitrary subdomains
  // — `business.tiktok.com` is not the same surface as `tiktok.com`.
  host = host.replace(/^(?:www\.|m\.|mobile\.)/, "");
  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    return "youtube";
  }
  if (host === "instagram.com") return "instagram";
  if (host === "tiktok.com" || host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    return "tiktok";
  }
  return "other";
}
