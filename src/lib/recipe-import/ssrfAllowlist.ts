/**
 * SSRF allowlist helpers — safe for client + server bundles (no Node builtins).
 * DNS-validated fetch lives in `ssrfGuard.ts` (server-only).
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
