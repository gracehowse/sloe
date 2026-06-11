/**
 * SSRF guard for outbound recipe-import fetches (ENG-682, ENG-730).
 * SERVER-ONLY — uses `node:dns/promises`. Import allowlist checks from
 * `ssrfAllowlist.ts` when bundling for the client.
 */
import "server-only";

import { lookup } from "node:dns/promises";
import { isAllowedUrl, isPrivateHost } from "./ssrfAllowlist";

export { isAllowedUrl, isPrivateHost } from "./ssrfAllowlist";

type LookupFn = (
  hostname: string,
  opts: { all: true },
) => Promise<{ address: string; family: number }[]>;

/**
 * Resolve `hostname` via DNS and throw if any returned address is a
 * private/reserved IP (ENG-730: DNS rebinding TOCTOU mitigation).
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
 * Fetch `url`, following redirects MANUALLY and re-validating each hop.
 */
export async function followWithSsrfGuard(
  url: string,
  opts: {
    headers?: Record<string, string>;
    maxHops?: number;
    signal?: AbortSignal;
    /** For testing only — inject a stub DNS lookup to avoid real network calls. */
    _lookupFn?: LookupFn;
  } = {},
): Promise<SafeFetchResult | null> {
  if (!isAllowedUrl(url)) return null;
  const { headers, signal, _lookupFn } = opts;
  const maxHops = opts.maxHops ?? 5;
  let currentUrl = url;
  let res: Response | undefined;
  for (let hop = 0; hop < maxHops; hop++) {
    try {
      await resolveDnsAndValidate(new URL(currentUrl).hostname, _lookupFn);
    } catch {
      return null;
    }
    res = await fetch(currentUrl, { redirect: "manual", headers, signal });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const resolved = new URL(location, currentUrl).href;
      if (!isAllowedUrl(resolved)) return null;
      currentUrl = resolved;
      continue;
    }
    break;
  }
  if (!res) return null;
  return { res, finalUrl: currentUrl };
}
