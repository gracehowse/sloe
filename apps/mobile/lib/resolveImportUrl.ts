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

/** Resolve URL from a full app deep link, e.g. platemate://import-shared?url=... */
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
