/**
 * SSRF guard for outbound recipe-import fetches (ENG-682).
 *
 * Single source of truth for the private/reserved-host blocklist, the
 * allowlist check, and a redirect-following fetch that re-validates EVERY hop.
 *
 * Previously the Pinterest resolver used `fetch(url, { redirect: "follow" })`,
 * which would follow a 30x chain into an internal/metadata host (e.g.
 * 169.254.169.254) without re-checking. `followWithSsrfGuard` follows
 * redirects manually and refuses any hop that fails `isAllowedUrl` — the same
 * posture the main importer loop already uses. Both call sites share this so
 * the guard can't drift (the prior `tests/unit/ssrfProtection.test.ts`
 * re-implemented `isPrivateHost`, which could silently fall out of sync).
 */

/** Block private/reserved IP ranges to prevent SSRF attacks. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // Localhost
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1") return true;
  // IPv4 private ranges
  if (/^10\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  // Link-local
  if (/^169\.254\./.test(h)) return true;
  // IPv6 private
  if (h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("fc")) return true;
  // Metadata endpoints (cloud providers)
  if (h === "metadata.google.internal" || h === "169.254.169.254") return true;
  // IPv6-mapped IPv4 private addresses (e.g. ::ffff:10.0.0.1, ::ffff:169.254.169.254)
  if (/^::ffff:/.test(h)) {
    const mapped = h.replace("::ffff:", "");
    if (/^10\./.test(mapped) || /^172\.(1[6-9]|2\d|3[01])\./.test(mapped) || /^192\.168\./.test(mapped) || /^169\.254\./.test(mapped) || mapped === "127.0.0.1") return true;
  }
  return false;
}

export function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (isPrivateHost(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export interface SafeFetchResult {
  res: Response;
  /** The final URL after following all redirects (each one allowlist-checked). */
  finalUrl: string;
}

/**
 * Fetch `url`, following redirects MANUALLY and re-validating each hop against
 * `isAllowedUrl`. Returns null if the entry URL or any redirect target is
 * disallowed (private/reserved host or non-http(s) scheme), if the hop limit
 * is exceeded, or if no response is produced. The caller reads `res` only when
 * a result is returned — a null means "refused, do not proceed".
 */
export async function followWithSsrfGuard(
  url: string,
  opts: { headers?: Record<string, string>; maxHops?: number; signal?: AbortSignal } = {},
): Promise<SafeFetchResult | null> {
  if (!isAllowedUrl(url)) return null;
  const { headers, signal } = opts;
  const maxHops = opts.maxHops ?? 5;
  let currentUrl = url;
  let res: Response | undefined;
  for (let hop = 0; hop < maxHops; hop++) {
    res = await fetch(currentUrl, { redirect: "manual", headers, signal });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const resolved = new URL(location, currentUrl).href;
      if (!isAllowedUrl(resolved)) return null; // refuse SSRF redirect target
      currentUrl = resolved;
      continue;
    }
    break;
  }
  if (!res) return null;
  return { res, finalUrl: currentUrl };
}
