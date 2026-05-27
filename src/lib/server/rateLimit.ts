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

/**
 * True only on the real production deployment. Prefer `VERCEL_ENV` — it is
 * "production" only on the suppr.club deploy, "preview" on preview deploys, and
 * unset locally / in CI (where `NODE_ENV` is "production" under `next start`).
 * This matches the prod-gating convention in `middleware.ts`. Falling back to
 * `NODE_ENV` keeps non-Vercel prod hosts fail-closed too. Preview + CI are NOT
 * treated as production, so they keep the in-memory fallback instead of 429ing.
 */
function isProductionRuntime(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.NODE_ENV === "production";
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
  /**
   * P0-6 (2026-04-25): per-user scoping. When provided, the bucket key
   * composes as `${keyPrefix}:user:${userId}:${ip}`; when omitted, the
   * bucket is `${keyPrefix}:anon:${ip}` (back-compat with the previous
   * IP-only behaviour for unauthenticated endpoints).
   *
   * Use cases:
   *   - Authenticated routes: pass the result of `getUserIdFromRequest(req)`
   *     so an IP-rotating attacker can't drain the bucket on behalf of a
   *     logged-in user, AND a single shared IP (corporate NAT) doesn't
   *     starve legitimate users on the same network.
   *   - Public / unauthenticated routes: omit (or pass null) — IP-only
   *     scoping is the correct default for genuinely anonymous traffic.
   */
  userId?: string | null;
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
 * Composable rate limit. Uses Upstash Redis when
 * `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set;
 * otherwise falls back to in-memory buckets (dev-only).
 *
 * Bucket key composition (P0-6, 2026-04-25):
 *   - With `opts.userId` set: `${keyPrefix}:user:${userId}:${ip}`.
 *   - Without:                `${keyPrefix}:anon:${ip}`.
 *
 * Per-user scoping closes the cross-user starvation hole the original
 * IP-only key had (a single attacker IP could exhaust the bucket on
 * behalf of every logged-in user behind the same NAT, and an
 * IP-rotating attacker could bypass the cap entirely while still
 * targeting a specific user). Authenticated callers should pass
 * `userId`; truly anonymous endpoints should omit it.
 */
export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const h = await headers();
  const ip = getIpFromHeaders(h) ?? "no-ip";
  const userPart = opts.userId ? `user:${opts.userId}` : "anon";
  const key = `${opts.keyPrefix}:${userPart}:${ip}`;
  const upstash = getUpstashLimiter(opts.limit, opts.windowMs);
  if (upstash) {
    return rateLimitUpstash(key, ip, upstash);
  }
  // ENG-668: production MUST have Upstash. The per-instance in-memory fallback
  // makes the effective cap `limit × lambda count`, silently bypassing AI/photo
  // quotas. This request-time fail-CLOSED is the real protection — it never
  // allows unlimited in prod. `verify-production-env` also flags missing Upstash
  // and exits non-zero under VERIFY_STRICT=1 (or VERCEL_ENV=production), so it
  // can be wired as a deploy-time gate. Non-prod (preview/CI/local) keeps the
  // in-memory bucket rather than 429ing.
  if (isProductionRuntime()) {
    console.error(
      `[rateLimit] Upstash env missing in production — failing closed for "${opts.keyPrefix}". Set UPSTASH_REDIS_REST_URL/TOKEN.`,
    );
    return {
      ok: false,
      remaining: 0,
      resetAtMs: nowMs() + opts.windowMs,
      retryAfterSec: Math.max(1, Math.ceil(opts.windowMs / 1000)),
      ip: ip === "no-ip" ? null : ip,
    };
  }
  return rateLimitMemory(opts, key, ip);
}

/** Test-only helper that builds the bucket key without hitting any
 *  store. Used by `rateLimitKeyComposition.test.ts` to pin the exact
 *  key shape so a future regression (e.g. dropping the user prefix,
 *  flattening the namespace) fails at PR time. */
export function _composeRateLimitKeyForTest(
  opts: { keyPrefix: string; userId?: string | null },
  ip: string,
): string {
  const userPart = opts.userId ? `user:${opts.userId}` : "anon";
  return `${opts.keyPrefix}:${userPart}:${ip}`;
}
