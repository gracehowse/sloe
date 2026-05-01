/**
 * Shared recipe-import URL helpers — used by both web (`app/api/...`) and
 * mobile (`apps/mobile/...`) so platform classification stays in lockstep.
 *
 * History (2026-04-30): the existing per-platform helpers (`detectSocialPlatform`
 * in `src/lib/recipe-import/extractSocialRecipe.ts` and the regex in
 * `apps/mobile/lib/clipboardShareForward.ts`) recognised IG/TT/YouTube but
 * weren't a single source of truth. New IG/TT share-sheet caption flow
 * (gated by `IG_TT_IMPORT_ENABLED` per
 * `docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md`) needs
 * one canonical detector that the new caption parser, the import preview
 * screen, and the existing route all agree on.
 */

export type RecipeSourcePlatform =
  | "blog"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "unknown";

/**
 * Classify a URL by platform.
 *
 * - `instagram` — instagram.com (incl. `l.instagram.com`, `instagr.am`)
 * - `tiktok` — tiktok.com (incl. `vm.tiktok.com`)
 * - `youtube` — youtube.com / youtu.be / m.youtube.com
 * - `blog` — any other valid http(s) URL (a recipe blog or generic site)
 * - `unknown` — input wasn't a parseable URL
 *
 * Domain matching is case-insensitive and uses `includes` on the hostname
 * so subdomains (`l.instagram.com`, `vm.tiktok.com`) classify correctly.
 */
export function detectSourcePlatform(url: string): RecipeSourcePlatform {
  if (typeof url !== "string" || url.trim().length === 0) return "unknown";
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
  if (host.includes("instagram.com") || host === "instagr.am") return "instagram";
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
  return "blog";
}

/**
 * Caption-text platforms — the three for which the iOS share sheet
 * supplies post-caption text alongside the URL. `blog` and `unknown`
 * are deliberately excluded.
 */
export type CaptionTextPlatform = "instagram" | "tiktok" | "youtube";

/**
 * True when the URL points at one of the platforms whose recipe content
 * is delivered via user-supplied caption text (not a server-side fetch).
 *
 * Type-narrows so callers can pass `platform` straight to functions
 * that accept the `CaptionTextPlatform` union.
 */
export function isCaptionTextPlatform(
  platform: RecipeSourcePlatform,
): platform is CaptionTextPlatform {
  return platform === "instagram" || platform === "tiktok" || platform === "youtube";
}
