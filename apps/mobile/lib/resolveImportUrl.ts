import * as Linking from "expo-linking";

/** First http(s) URL in text, or null. */
export function firstHttpUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!m) return null;
  return m[0]!.replace(/[),.;]+$/, "");
}

/**
 * Handles plain host paths (Share often sends "instagram.com/p/..." without scheme).
 */
export function extractUrlFromShareText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const direct = firstHttpUrl(trimmed);
  if (direct) return direct;

  const hostMatch = trimmed.match(
    /\b((?:https?:\/\/)?(?:www\.)?(?:l\.instagram\.com|instagram\.com|instagr\.am|tiktok\.com|vm\.tiktok\.com|pin\.it|pinterest\.com)[^\s<>"']*)/i,
  );
  if (hostMatch) {
    let u = hostMatch[1]!.replace(/[),.;]+$/, "");
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    return u;
  }

  return null;
}

/**
 * ENG-748 #13 (2026-05-27) — classify a pasted attribution string for the
 * image-import path. Image imports reuse the URL-paste field to carry a
 * creator's source. Previously the raw text was sent as `sourceUrl`
 * unconditionally; the server's `normaliseSource` then NULLed anything that
 * didn't parse, dropping the attribution silently (no `sourceName` fallback).
 *
 * This returns which form field the value should occupy:
 *   - a parseable link → `{ sourceUrl }` (linked attribution)
 *   - non-empty but unparseable → `{ sourceName }` (non-linked source note,
 *     preserved rather than dropped)
 *   - empty / whitespace → `{}` (genuinely no attribution)
 */
export interface ImportSourceField {
  sourceUrl?: string;
  sourceName?: string;
}

export function classifyImportSource(raw: string): ImportSourceField {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const url = extractUrlFromShareText(trimmed);
  if (url) return { sourceUrl: url };
  return { sourceName: trimmed };
}

function paramFirst(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function decodeMaybe(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

const ROUTER_KEYS = ["url", "link", "sharedUrl", "shared_url", "u", "text"] as const;

/** Resolve a recipe URL from Expo Router search params (handles string | string[]). */
export function urlFromRouterParams(params: Record<string, string | string[] | undefined>): string | null {
  for (const k of ROUTER_KEYS) {
    const raw = paramFirst(params[k]);
    if (!raw) continue;
    const decoded = decodeMaybe(raw.trim());
    const found = extractUrlFromShareText(decoded);
    if (found) return found;
  }
  return null;
}

/** Resolve URL from a full app deep link, e.g. suppr://import-shared?url=... */
export function urlFromDeepLink(href: string | null | undefined): string | null {
  if (!href || !href.trim()) return null;
  try {
    const parsed = Linking.parse(href.trim());
    const q = parsed.queryParams ?? {};
    for (const k of ROUTER_KEYS) {
      const v = q[k];
      const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
      if (!s) continue;
      const decoded = decodeMaybe(String(s).trim());
      const found = extractUrlFromShareText(decoded);
      if (found) return found;
    }
    return extractUrlFromShareText(href);
  } catch {
    return extractUrlFromShareText(href);
  }
}
