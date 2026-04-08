import { headers } from "next/headers";

type Bucket = {
  count: number;
  resetAtMs: number;
};

function nowMs() {
  return Date.now();
}

function getIpFromHeaders(h: { get: (name: string) => string | null }): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

// Best-effort in-memory limiter (works in dev and single-instance).
// For production multi-region/serverless, replace with durable store (Upstash Redis, etc.).
const g = globalThis as unknown as { __pm_rateLimit?: Map<string, Bucket> };
const store = (g.__pm_rateLimit ??= new Map<string, Bucket>());

export type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number; resetAtMs: number }
  | { ok: false; remaining: 0; resetAtMs: number; retryAfterSec: number; ip: string | null };

export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const h = await headers();
  const ip = getIpFromHeaders(h) ?? "unknown";
  const key = `${opts.keyPrefix}:${ip}`;
  const t = nowMs();
  const existing = store.get(key);

  if (!existing || existing.resetAtMs <= t) {
    const resetAtMs = t + opts.windowMs;
    store.set(key, { count: 1, resetAtMs });
    return { ok: true, remaining: Math.max(0, opts.limit - 1), resetAtMs };
  }

  if (existing.count >= opts.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAtMs - t) / 1000));
    return { ok: false, remaining: 0, resetAtMs: existing.resetAtMs, retryAfterSec, ip: ip === "unknown" ? null : ip };
  }

  existing.count += 1;
  store.set(key, existing);
  return { ok: true, remaining: Math.max(0, opts.limit - existing.count), resetAtMs: existing.resetAtMs };
}

