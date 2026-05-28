/**
 * SSRF guard for outbound recipe-import fetches (ENG-682, ENG-730).
 *
 * Single source of truth for the private/reserved-host blocklist, the
 * allowlist check, and a redirect-following fetch that re-validates EVERY hop.
 *
 * ENG-682: Previously the Pinterest resolver used `fetch(url, { redirect: "follow" })`,
 * which would follow a 30x chain into an internal/metadata host (e.g.
 * 169.254.169.254) without re-checking. `followWithSsrfGuard` follows
 * redirects manually and refuses any hop that fails `isAllowedUrl` — the same
 * posture the main importer loop already uses.
 *
 * ENG-730: `isAllowedUrl` validates the hostname string, not the resolved IP.
 * A hostname that resolves to a public IP at check-time and rebinds to a
 * private/metadata IP at fetch-time (DNS rebinding TOCTOU) could bypass the
 * allowlist. `resolveDnsAndValidate` pre-resolves the hostname and checks every
 * returned address. The residual window between our lookup and Node's own lookup
 * is microseconds — orders of magnitude less than the seconds required for
 * reliable DNS rebinding. `followWithSsrfGuard` calls both checks on every hop.
 */

import { lookup } from "node:dns/promises";

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

type LookupFn = (
  hostname: string,
  opts: { all: true },
) => Promise<{ address: string; family: number }[]>;

/**
 * Resolve `hostname` via DNS and throw if any returned address is a
 * private/reserved IP (ENG-730: DNS rebinding TOCTOU mitigation).
 *
 * Fails closed: DNS resolution failure is treated as blocked so a
 * transient outage can't be used to bypass the guard.
 *
 * The optional `_lookupFn` parameter exists for testing only — callers
 * must not pass it in production.
 */
export async function resolveDnsAndValidate(
  hostname: string,
  _lookupFn: LookupFn = lookup,
): Promise<void> {
  let records: { address: string; family: number }[];
  try {
    records = await _lookupFn(hostname, { all: true });
  } catch (err) {
    throw new Error(`SSRF: DNS lookup failed for ${hostname}: ${String(err)}`);
  }
  if (records.length === 0) {
    throw new Error(`SSRF: DNS returned no records for ${hostname}`);
  }
  for (const { address } of records) {
    if (isPrivateHost(address)) {
      throw new Error(`SSRF: ${hostname} resolves to blocked address ${address}`);
    }
  }
}

export interface SafeFetchResult {
  res: Response;
  /** The final URL after following all redirects (each one allowlist-checked). */
  finalUrl: string;
}

/**
 * Fetch `url`, following redirects MANUALLY and re-validating each hop against
 * `isAllowedUrl` (hostname-string check) + `resolveDnsAndValidate` (DNS IP check).
 * Returns null if the entry URL or any redirect target is disallowed (private/reserved
 * host, non-http(s) scheme, DNS resolution to a private IP), if the hop limit is
 * exceeded, or if no response is produced. The caller reads `res` only when a result
 * is returned — a null means "refused, do not proceed".
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
    // ENG-730: pre-resolve DNS for this hop and validate the resolved IP.
    // Runs on every hop so a redirect to a DNS-rebinding hostname is also caught.
    try {
      await resolveDnsAndValidate(new URL(currentUrl).hostname);
    } catch {
      return null;
    }
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
