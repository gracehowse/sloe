import { extractUrlFromShareText } from "@/lib/resolveImportUrl";

/** Hosts we treat as "share sheet → import this link" (not generic https). */
export const SOCIAL_SHARE_URL_RE =
  /\b(instagram\.com|instagr\.am|l\.instagram\.com|tiktok\.com|vm\.tiktok|pinterest\.com|pin\.it)\b/i;

export function isSocialShareRecipeUrl(url: string): boolean {
  return SOCIAL_SHARE_URL_RE.test(url);
}

let lastClipboardRaw = "";
let lastExtractedUrl = "";

/**
 * Returns a recipe URL only when clipboard content is new vs the last time we forwarded.
 * Stops Discover/resume from re-opening import forever for the same copied link.
 */
export function consumeNewSocialRecipeUrlFromClipboard(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const url = extractUrlFromShareText(trimmed);
  if (!url || !isSocialShareRecipeUrl(url)) return null;
  if (trimmed === lastClipboardRaw && url === lastExtractedUrl) return null;
  lastClipboardRaw = trimmed;
  lastExtractedUrl = url;
  return url;
}
