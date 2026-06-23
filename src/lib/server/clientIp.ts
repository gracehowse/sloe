/**
 * getTrustedClientIp — the client IP to use for rate-limiting and abuse audit
 * (`reporter_ip`), derived only from headers the platform edge injects and the
 * client cannot forge (ENG-1226).
 *
 * The leftmost `x-forwarded-for` hop is fully client-supplied: a scripted
 * attacker can forge/rotate it to defeat a per-IP cap or poison an audit field
 * (the exact abuse the DMCA / recipe-report queues defend against). So we never
 * trust it. Preference order:
 *
 *   1. `x-vercel-forwarded-for` — Vercel writes the real client IP here and
 *      overrides any client-supplied value. The canonical trusted source in
 *      production.
 *   2. `x-real-ip` — also edge-injected (Vercel, and nginx/self-host behind a
 *      trusted proxy).
 *   3. `x-forwarded-for` RIGHTMOST hop — self-host / dev fallback only. The
 *      rightmost entry is the address the nearest trusted proxy observed; the
 *      forgeable leftmost is deliberately ignored.
 *
 * Returns null when no header is present (local dev), which callers bucket as a
 * single "no-ip" key.
 */
export function getTrustedClientIp(
  h: { get: (name: string) => string | null },
): string | null {
  const vercel = h.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]?.trim() || null;

  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim() || null;

  const xff = h.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    return hops.length ? hops[hops.length - 1]! : null;
  }

  return null;
}
