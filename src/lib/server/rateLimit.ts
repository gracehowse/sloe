import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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
const gMem = globalThis as unknown as { __pm_rateLimit?: Map<string, Bucket> };
const memStore = (gMem.__pm_rateLimit ??= new Map<string, Bucket>());

const gUp = globalThis as unknown as {
  __pm_upstashRedis?: Redis;
  __pm_upstashLimiters?: Map<string, Ratelimit>;
};

function getUpstashRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  if (!gUp.__pm_upstashRedis) {
    gUp.__pm_upstashRedis = new Redis({ url, token });
  }
  return gUp.__pm_upstashRedis;
}

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;
  const windowSec = Math.max(1, Math.round(windowMs / 1000));
  const cacheKey = `${limit}:${windowSec}`;
  if (!gUp.__pm_upstashLimiters) gUp.__pm_upstashLimiters = new Map();
  let rl = gUp.__pm_upstashLimiters.get(cacheKey);
  if (!rl) {
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: `pm_rl_${limit}_${windowSec}`,
    });
    gUp.__pm_upstashLimiters.set(cacheKey, rl);
  }
  return rl;
}

export type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number; resetAtMs: number }
  | { ok: false; remaining: 0; resetAtMs: number; retryAfterSec: number; ip: string | null };

async function rateLimitMemory(opts: RateLimitOptions, key: string, ip: string): Promise<RateLimitResult> {
  const t = nowMs();
  const existing = memStore.get(key);

  if (!existing || existing.resetAtMs <= t) {
    const resetAtMs = t + opts.windowMs;
    memStore.set(key, { count: 1, resetAtMs });
    return { ok: true, remaining: Math.max(0, opts.limit - 1), resetAtMs };
  }

  if (existing.count >= opts.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAtMs - t) / 1000));
    return { ok: false, remaining: 0, resetAtMs: existing.resetAtMs, retryAfterSec, ip: ip === "unknown" ? null : ip };
  }

  existing.count += 1;
  memStore.set(key, existing);
  return { ok: true, remaining: Math.max(0, opts.limit - existing.count), resetAtMs: existing.resetAtMs };
}

async function rateLimitUpstash(key: string, ip: string, limiter: Ratelimit): Promise<RateLimitResult> {
  const result = await limiter.limit(key);
  if (!result.success) {
    const retryAfterSec = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    return {
      ok: false,
      remaining: 0,
      resetAtMs: result.reset,
      retryAfterSec,
      ip: ip === "unknown" ? null : ip,
    };
  }
  return { ok: true, remaining: result.remaining, resetAtMs: result.reset };
}

/**
 * IP-based rate limit. Uses Upstash Redis when `UPSTASH_REDIS_REST_URL` and
 * `UPSTASH_REDIS_REST_TOKEN` are set; otherwise falls back to in-memory buckets
 * (best for local dev only).
 */
export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const h = await headers();
  const ip = getIpFromHeaders(h) ?? "unknown";
  const key = `${opts.keyPrefix}:${ip}`;
  const upstash = getUpstashLimiter(opts.limit, opts.windowMs);
  if (upstash) {
    return rateLimitUpstash(key, ip, upstash);
  }
  return rateLimitMemory(opts, key, ip);
}
