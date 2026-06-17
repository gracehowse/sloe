/**
 * SSRF allowlist helpers — safe for client + server bundles (no Node builtins).
 * DNS-validated fetch lives in `ssrfGuard.ts` (server-only).
 */

/**
 * Parse a single inet_aton-style IPv4 part: decimal, `0x`-prefixed hex, or
 * leading-zero octal. Returns the numeric value, or `null` if the part is not
 * a valid numeric octet form (so a real hostname label fails fast).
 */
function parseIpv4Part(part: string): number | null {
  if (part.length === 0) return null;
  let value: number;
  if (/^0x[0-9a-f]+$/i.test(part)) {
    value = parseInt(part.slice(2), 16);
  } else if (/^0[0-7]+$/.test(part)) {
    value = parseInt(part, 8);
  } else if (/^[0-9]+$/.test(part)) {
    value = parseInt(part, 10);
  } else {
    return null;
  }
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Canonicalise an inet_aton-style IPv4 literal to dotted-decimal, or `null`
 * when `host` is not an IPv4 literal. Mirrors the classic libc/browser
 * parser, so alternate encodings of an address (integer `2130706433`, hex
 * `0x7f000001`, octal `0177.0.0.1`, short `127.1`) collapse to the same
 * dotted form and can be range-checked below. Pure — no Node builtins.
 */
function canonicaliseIpv4(host: string): string | null {
  const parts = host.split(".");
  if (parts.length < 1 || parts.length > 4) return null;
  const nums: number[] = [];
  for (const p of parts) {
    const n = parseIpv4Part(p);
    if (n === null) return null;
    nums.push(n);
  }
  let octets: number[];
  switch (parts.length) {
    case 1: {
      const v = nums[0]!;
      if (v > 0xffffffff) return null;
      octets = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
      break;
    }
    case 2: {
      const [a, v] = nums as [number, number];
      if (a > 255 || v > 0xffffff) return null;
      octets = [a, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
      break;
    }
    case 3: {
      const [a, b, v] = nums as [number, number, number];
      if (a > 255 || b > 255 || v > 0xffff) return null;
      octets = [a, b, (v >>> 8) & 255, v & 255];
      break;
    }
    default: {
      if (nums.some((n) => n > 255)) return null;
      octets = nums;
    }
  }
  return octets.join(".");
}

/** Range checks for a canonical dotted-decimal IPv4 string. */
function isPrivateDottedIpv4(h: string): boolean {
  if (h === "0.0.0.0") return true; // whole-zero — routes to localhost on many stacks
  if (/^127\./.test(h)) return true; // loopback /8
  if (/^10\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true; // link-local
  return false;
}

/** Block private/reserved IP ranges to prevent SSRF attacks. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // Localhost names + explicit loopback / all-zeros literals.
  if (h === "localhost" || h === "::1" || h === "[::1]") return true;
  // IPv6 all-zeros (unspecified address — routes to localhost on many stacks).
  if (h === "::" || h === "[::]" || h === "0:0:0:0:0:0:0:0" || h === "[0:0:0:0:0:0:0:0]") return true;
  // Dotted-decimal private ranges (fast path for the common case).
  if (isPrivateDottedIpv4(h)) return true;
  // Alternate IPv4 encodings (integer / hex / octal / short forms) that the
  // dotted-decimal regexes miss — canonicalise then re-check (ENG-1152).
  const canon = canonicaliseIpv4(h);
  if (canon !== null && isPrivateDottedIpv4(canon)) return true;
  // Link-local + metadata endpoints (cloud providers).
  if (h === "metadata.google.internal" || h === "169.254.169.254") return true;
  // IPv6 private prefixes.
  if (h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("fc")) return true;
  // IPv6-mapped IPv4 private addresses (e.g. ::ffff:10.0.0.1, ::ffff:169.254.169.254).
  if (/^::ffff:/.test(h)) {
    const mapped = h.replace("::ffff:", "");
    const mappedCanon = canonicaliseIpv4(mapped);
    if (isPrivateDottedIpv4(mapped) || (mappedCanon !== null && isPrivateDottedIpv4(mappedCanon))) {
      return true;
    }
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
