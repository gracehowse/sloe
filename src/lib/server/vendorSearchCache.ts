/**
 * Cross-request vendor search cache + account-level quota guard (ENG-1038 / P1-3).
 *
 * Why this exists
 * ---------------
 * Every debounced food-search keystroke fans out live calls to three
 * keyed vendors — USDA FDC, Edamam, FatSecret — once per user, with no
 * cross-request cache. The per-route rate limits (`rateLimit.ts`) are
 * **per-user only**; they protect a single user from hammering us, but
 * they do nothing to protect the *account-wide* vendor quotas that all
 * users share:
 *
 *   - Edamam free tier: 1,000 requests / DAY, account-wide.
 *   - USDA FDC standard key: ~1,000 requests / HOUR.
 *   - FatSecret Premier Free: 10,000 requests / day (generous, but still
 *     a shared ceiling — and the OAuth token endpoint is itself metered).
 *
 * At viral scale (a TikTok landing → a few hundred concurrent searchers),
 * those shared ceilings exhaust within minutes, after which the vendor
 * returns an error / empty and search degrades to "no results" for
 * *everyone* — silently, with no error shown. That is the launch-readiness
 * audit's most-likely day-one support fire.
 *
 * This module provides two coupled mechanisms, shared across all users and
 * both platforms (web + mobile both call the same `/api/{vendor}/search`
 * routes — this is the single chokepoint):
 *
 *   1. CROSS-REQUEST CACHE — cache successful vendor responses keyed by
 *      `{vendor}:{locale}:{normalizedQuery}` with a 24h TTL. Food data is
 *      stable for days; queries are highly repetitive ("chicken breast",
 *      "banana", "egg"). A warm cache means a repeated query never touches
 *      the vendor. We cache ONLY successful, non-degraded responses — never
 *      an error or a quota-exhausted empty, so a transient outage can't
 *      poison the cache with a fake empty for 24h.
 *
 *   2. ACCOUNT-LEVEL QUOTA GUARD — a per-vendor usage counter against the
 *      known cap. When usage is at/over the cap, the route SKIPS the live
 *      vendor call and returns a `degraded` envelope instead of silently
 *      returning empty. The source-precedence chain in the search clients
 *      then falls through to the next live source (USDA → FatSecret → OFF →
 *      cache/curated). The client surfaces an honest "showing saved
 *      results" notice rather than a blank "no results".
 *
 * Infra: reuses the Upstash Redis instance already wired for rate-limiting
 * (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). No new dependency.
 * When Upstash is absent (dev / CI / preview) we fall back to a per-instance
 * in-memory map so local dev still benefits from caching within one process.
 * In production the in-memory fallback is per-lambda (not shared) — but the
 * quota guard is intentionally CONSERVATIVE there: see `consumeQuota` below.
 *
 * Decision doc: docs/decisions/2026-06-11-vendor-search-cache.md
 */

import { Redis } from "@upstash/redis";

export type VendorId = "usda" | "edamam" | "fatsecret" | "off";

/** Locale tag bucketed to a region for cache-key stability. Vendor results
 *  are region-sensitive for FatSecret (US-only dataset) and slightly so for
 *  USDA/Edamam, so we partition the cache by region rather than by full
 *  BCP-47 locale (which would shatter the hit rate across en-US / en-GB /
 *  fr-FR variants that resolve to the same regional dataset). */
export type CacheLocale = string;

/**
 * Per-vendor account-wide caps. These are the free-tier ceilings; the guard
 * trips at `cap * SAFETY_FRACTION` so we degrade gracefully BEFORE the vendor
 * starts hard-rejecting (which would surface as errors, not a clean skip).
 *
 * Confidence on the exact numbers: Edamam 1,000/day is documented in
 * `src/lib/edamam/client.ts:6`. USDA ~1,000/hr is the standard-key default
 * (DEMO_KEY is far lower). FatSecret Premier Free is 10,000/day. If we move
 * to a paid tier, bump the cap here — the guard logic is unchanged.
 */
export const VENDOR_QUOTAS: Record<
  VendorId,
  { cap: number; windowSec: number; label: string }
> = {
  // 1,000/day account-wide free tier.
  edamam: { cap: 1000, windowSec: 24 * 60 * 60, label: "Edamam (1,000/day)" },
  // ~1,000/hour standard key.
  usda: { cap: 1000, windowSec: 60 * 60, label: "USDA FDC (~1,000/hr)" },
  // 10,000/day Premier Free.
  fatsecret: { cap: 10000, windowSec: 24 * 60 * 60, label: "FatSecret (10,000/day)" },
  // ENG-1059 — OFF has no keyed account cap, but our proxy must not hammer the
  // public API at viral scale. 50k/day is a conservative abuse guard on our side.
  off: { cap: 50000, windowSec: 24 * 60 * 60, label: "OFF proxy (50,000/day)" },
};

/**
 * Trip the guard at 90% of the cap. Leaves headroom so the LAST requests
 * before exhaustion still succeed against the vendor (warming the cache)
 * rather than racing the hard reject. Tunable without touching call sites.
 */
export const QUOTA_SAFETY_FRACTION = 0.9;

/** 24h cache TTL. Food macros are stable for days; 24h balances freshness
 *  against hit rate. Branded reformulations are rare and a 24h staleness on
 *  a macro estimate is immaterial (nutrition is always "estimated" anyway). */
export const VENDOR_CACHE_TTL_SEC = 24 * 60 * 60;

const CACHE_PREFIX = "pm_vsc"; // vendor-search-cache
const DETAIL_PREFIX = "pm_vdc"; // vendor-detail-cache
const QUOTA_PREFIX = "pm_vq"; // vendor-quota

// ── Upstash wiring (shared singleton, same env as rateLimit.ts) ──────────

const gVsc = globalThis as unknown as {
  __pm_vscRedis?: Redis | null;
  __pm_vscMemCache?: Map<string, { value: string; expiresAtMs: number }>;
  __pm_vscMemQuota?: Map<string, { count: number; resetAtMs: number }>;
};

function getRedis(): Redis | null {
  if (gVsc.__pm_vscRedis !== undefined) return gVsc.__pm_vscRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    gVsc.__pm_vscRedis = null;
    return null;
  }
  gVsc.__pm_vscRedis = new Redis({ url, token });
  return gVsc.__pm_vscRedis;
}

function memCache() {
  return (gVsc.__pm_vscMemCache ??= new Map());
}
function memQuota() {
  return (gVsc.__pm_vscMemQuota ??= new Map());
}

// ── Key normalisation ────────────────────────────────────────────────────

/**
 * Normalise a query for cache-key stability: trim, collapse internal
 * whitespace, lowercase, strip diacritics, drop punctuation that doesn't
 * change the search ("chicken!" === "chicken"). Two queries that differ
 * only in case / spacing / trailing punctuation share a cache entry — this
 * is what drives the hit rate up at viral scale.
 *
 * Deliberately conservative: we do NOT stem or alias here (that's the
 * search-ranking layer's job). We only fold cosmetic differences so the
 * SAME query typed twice hits cache.
 */
export function normalizeCacheQuery(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // punctuation → space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bucket a BCP-47 locale to a coarse region key so the cache doesn't shatter
 * across cosmetic locale variants. US territories collapse to "us"; the
 * special FatSecret US-only dataset benefits from this. Everything else
 * collapses to "intl" (the OFF/USDA/Edamam datasets are not region-keyed in
 * a way that matters for the cache). Null/empty → "intl".
 */
export function bucketLocale(locale: CacheLocale | null | undefined): string {
  if (!locale || typeof locale !== "string") return "intl";
  const parts = locale.split(/[-_]/);
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i]?.trim();
    if (p && /^[A-Za-z]{2}$/.test(p)) {
      const region = p.toUpperCase();
      if (["US", "PR", "GU", "AS", "VI", "MP"].includes(region)) return "us";
      return "intl";
    }
  }
  return "intl";
}

function cacheKey(vendor: VendorId, locale: CacheLocale | null, page: number, query: string): string {
  return `${CACHE_PREFIX}:${vendor}:${bucketLocale(locale)}:p${page}:${normalizeCacheQuery(query)}`;
}

/**
 * Cache key for an on-tap nutrition-DETAIL response, keyed by `{vendor}:{foodId}`.
 *
 * Detail fetches (Edamam `/nutrients`, USDA `/food/{fdcId}`) are addressed by a
 * stable vendor food id, NOT a free-text query — so unlike the search cache we
 * don't normalise a query or partition by page. A given food's detail panel is
 * identical for every user, so the key is intentionally locale-agnostic: the
 * micronutrient panel for an Edamam `foodId` / USDA `fdcId` is the same number
 * regardless of who taps it. The foodId is lightly normalised (trim + lowercase)
 * so cosmetic id differences don't shatter the entry.
 */
function detailKey(vendor: VendorId, foodId: string): string {
  return `${DETAIL_PREFIX}:${vendor}:${foodId.trim().toLowerCase()}`;
}

function quotaKey(vendor: VendorId): string {
  // Fixed-window bucket: floor(now / window) gives a deterministic window id
  // so all instances increment the same counter for the same wall-clock
  // window. Matches the fixed-window semantics we want for a daily/hourly cap.
  const windowSec = VENDOR_QUOTAS[vendor].windowSec;
  const windowId = Math.floor(Date.now() / 1000 / windowSec);
  return `${QUOTA_PREFIX}:${vendor}:${windowId}`;
}

// ── Cache read/write ─────────────────────────────────────────────────────

/**
 * Read a cached vendor response. Returns the parsed `hits` array (whatever
 * shape the vendor route serialised) or null on a miss / parse failure /
 * store error. NEVER throws — a cache outage must not break search.
 */
export async function getCachedSearch<T = unknown>(
  vendor: VendorId,
  query: string,
  opts?: { locale?: CacheLocale | null; page?: number },
): Promise<T[] | null> {
  const page = opts?.page && opts.page > 0 ? Math.floor(opts.page) : 1;
  const key = cacheKey(vendor, opts?.locale ?? null, page, query);
  const redis = getRedis();
  try {
    if (redis) {
      const raw = await redis.get<string>(key);
      if (raw == null) return null;
      // Upstash auto-deserialises JSON; handle both string + object returns.
      const parsed = typeof raw === "string" ? JSON.parse(raw) : (raw as unknown);
      return Array.isArray(parsed) ? (parsed as T[]) : null;
    }
    const entry = memCache().get(key);
    if (!entry) return null;
    if (entry.expiresAtMs <= Date.now()) {
      memCache().delete(key);
      return null;
    }
    const parsed = JSON.parse(entry.value);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch (err) {
    console.error(
      `[vendorSearchCache] read failed (${vendor}) — treating as miss:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Write a successful vendor response to the cache. ONLY call this with a
 * genuine, non-degraded result — never an error envelope or a
 * quota-exhausted empty (those must not be cached as if they were real).
 *
 * Caching an empty array IS allowed here: a query that genuinely has no
 * matches ("zzzznotafood") is a stable fact worth caching to spare the
 * vendor the repeat. The contract is "only cache what the vendor actually
 * returned successfully" — the caller guarantees that by only calling this
 * after a clean vendor response.
 */
export async function setCachedSearch(
  vendor: VendorId,
  query: string,
  hits: unknown[],
  opts?: { locale?: CacheLocale | null; page?: number; ttlSec?: number },
): Promise<void> {
  const page = opts?.page && opts.page > 0 ? Math.floor(opts.page) : 1;
  const ttl = opts?.ttlSec && opts.ttlSec > 0 ? Math.floor(opts.ttlSec) : VENDOR_CACHE_TTL_SEC;
  const key = cacheKey(vendor, opts?.locale ?? null, page, query);
  const value = JSON.stringify(hits);
  const redis = getRedis();
  try {
    if (redis) {
      await redis.set(key, value, { ex: ttl });
      return;
    }
    memCache().set(key, { value, expiresAtMs: Date.now() + ttl * 1000 });
  } catch (err) {
    console.error(
      `[vendorSearchCache] write failed (${vendor}) — continuing uncached:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ── Detail cache read/write (ENG-1117) ────────────────────────────────────

/**
 * Read a cached vendor DETAIL response (the on-tap `/nutrients` micro panel /
 * USDA food-get payload), keyed by `{vendor}:{foodId}`. Returns the parsed
 * object (whatever shape the detail route serialised) or null on a miss /
 * parse failure / store error. NEVER throws — a cache outage must not break a
 * detail fetch.
 *
 * Why a separate helper from `getCachedSearch`: search caches an ARRAY of hits
 * keyed by query+page; a detail response is a single OBJECT keyed by foodId.
 * Same Redis instance, same TTL semantics, same fail-soft posture — different
 * shape and key space (so a foodId can never collide with a query bucket).
 */
export async function getCachedDetail<T = unknown>(
  vendor: VendorId,
  foodId: string,
): Promise<T | null> {
  const key = detailKey(vendor, foodId);
  const redis = getRedis();
  try {
    if (redis) {
      const raw = await redis.get<string>(key);
      if (raw == null) return null;
      // Upstash auto-deserialises JSON; handle both string + object returns.
      const parsed = typeof raw === "string" ? JSON.parse(raw) : (raw as unknown);
      return parsed && typeof parsed === "object" ? (parsed as T) : null;
    }
    const entry = memCache().get(key);
    if (!entry) return null;
    if (entry.expiresAtMs <= Date.now()) {
      memCache().delete(key);
      return null;
    }
    const parsed = JSON.parse(entry.value);
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch (err) {
    console.error(
      `[vendorSearchCache] detail read failed (${vendor}) — treating as miss:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Write a successful vendor DETAIL response to the cache, keyed by
 * `{vendor}:{foodId}`. ONLY call this with a genuine, non-degraded result —
 * never an error envelope (so a transient `/nutrients` blip can't poison the
 * panel for 24h). Same 24h TTL as the search cache (food micros are stable for
 * days; nutrition is "estimated" anyway).
 */
export async function setCachedDetail(
  vendor: VendorId,
  foodId: string,
  detail: unknown,
  opts?: { ttlSec?: number },
): Promise<void> {
  const ttl = opts?.ttlSec && opts.ttlSec > 0 ? Math.floor(opts.ttlSec) : VENDOR_CACHE_TTL_SEC;
  const key = detailKey(vendor, foodId);
  const value = JSON.stringify(detail);
  const redis = getRedis();
  try {
    if (redis) {
      await redis.set(key, value, { ex: ttl });
      return;
    }
    memCache().set(key, { value, expiresAtMs: Date.now() + ttl * 1000 });
  } catch (err) {
    console.error(
      `[vendorSearchCache] detail write failed (${vendor}) — continuing uncached:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ── Quota guard ──────────────────────────────────────────────────────────

export type QuotaDecision =
  | { allowed: true; used: number; cap: number }
  | { allowed: false; used: number; cap: number; reason: "quota_exhausted" };

/**
 * Check whether a vendor still has account-wide quota in the current window
 * WITHOUT consuming it. Cheap read used to decide "should I even try the
 * vendor, or skip straight to the next source?". A read failure returns
 * `allowed: true` (fail-OPEN on the *check*) — we'd rather make one extra
 * vendor call than wrongly degrade everyone because Redis blipped. The hard
 * protection is the vendor's own 429, plus `consumeQuota` below.
 */
export async function checkQuota(vendor: VendorId): Promise<QuotaDecision> {
  const { cap } = VENDOR_QUOTAS[vendor];
  const trip = Math.floor(cap * QUOTA_SAFETY_FRACTION);
  const used = await readQuotaCount(vendor);
  if (used >= trip) {
    return { allowed: false, used, cap, reason: "quota_exhausted" };
  }
  return { allowed: true, used, cap };
}

/**
 * Atomically consume one unit of a vendor's quota and report whether the
 * call is still within budget. Uses Redis INCR (atomic across all instances)
 * with a window TTL set on first increment. Call this immediately BEFORE a
 * live vendor request.
 *
 * Returns `allowed: false` when the increment pushed us over the trip point
 * — in which case the caller should NOT make the vendor call (or should
 * treat its result as best-effort and degrade). Because INCR is atomic, this
 * is the real cross-instance guard.
 *
 * In-memory fallback (no Upstash): the counter is per-lambda, so the
 * effective cap is `trip × instanceCount`. That's acceptable because the
 * in-memory path only runs in dev/preview/CI (prod requires Upstash per
 * ENG-668) — and even in prod the vendor's own 429 + the cache backstop the
 * worst case. We do NOT fail-closed here (unlike rateLimit) because wrongly
 * degrading ALL search on a transient Redis blip is worse than one extra
 * vendor call.
 */
export async function consumeQuota(vendor: VendorId): Promise<QuotaDecision> {
  const { cap, windowSec } = VENDOR_QUOTAS[vendor];
  const trip = Math.floor(cap * QUOTA_SAFETY_FRACTION);
  const key = quotaKey(vendor);
  const redis = getRedis();
  try {
    if (redis) {
      const used = await redis.incr(key);
      // Set the TTL on the first increment of this window so the counter
      // resets cleanly. `incr` returns 1 on first hit.
      if (used === 1) {
        await redis.expire(key, windowSec);
      }
      if (used > trip) {
        return { allowed: false, used, cap, reason: "quota_exhausted" };
      }
      return { allowed: true, used, cap };
    }
    // In-memory fixed window.
    const store = memQuota();
    const now = Date.now();
    const existing = store.get(key);
    if (!existing || existing.resetAtMs <= now) {
      store.set(key, { count: 1, resetAtMs: now + windowSec * 1000 });
      return { allowed: true, used: 1, cap };
    }
    existing.count += 1;
    store.set(key, existing);
    if (existing.count > trip) {
      return { allowed: false, used: existing.count, cap, reason: "quota_exhausted" };
    }
    return { allowed: true, used: existing.count, cap };
  } catch (err) {
    console.error(
      `[vendorSearchCache] quota consume failed (${vendor}) — allowing (fail-open):`,
      err instanceof Error ? err.message : String(err),
    );
    // Fail-open on the consume too: the vendor's own 429 + the cache are the
    // backstop; we never want a Redis blip to brown out search for everyone.
    return { allowed: true, used: 0, cap };
  }
}

async function readQuotaCount(vendor: VendorId): Promise<number> {
  const key = quotaKey(vendor);
  const redis = getRedis();
  try {
    if (redis) {
      const v = await redis.get<number | string>(key);
      const n = typeof v === "string" ? Number(v) : v;
      return typeof n === "number" && Number.isFinite(n) ? n : 0;
    }
    const existing = memQuota().get(key);
    if (!existing || existing.resetAtMs <= Date.now()) return 0;
    return existing.count;
  } catch {
    return 0;
  }
}

// ── Test-only resets ─────────────────────────────────────────────────────

/** Clear the in-memory cache + quota stores. Test-only — production uses
 *  Redis TTLs for eviction. Also drops the cached Redis singleton so a test
 *  that stubs env vars re-reads them. */
export function _resetVendorSearchCacheForTest(): void {
  gVsc.__pm_vscMemCache = new Map();
  gVsc.__pm_vscMemQuota = new Map();
  gVsc.__pm_vscRedis = undefined;
}
