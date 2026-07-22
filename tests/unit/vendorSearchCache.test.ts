/**
 * ENG-1038 / P1-3 — cross-request vendor search cache + account-level quota
 * guard (`src/lib/server/vendorSearchCache.ts`).
 *
 * These tests run against the IN-MEMORY fallback path (no Upstash env), which
 * exercises the same public contract as the Redis path: TTL eviction, cache
 * hit/miss, the don't-cache-errors discipline (enforced by the route, pinned
 * in the route tests), normalised keys, and the fixed-window quota counter
 * tripping at the safety fraction.
 *
 * Mock the clock with fake timers so TTL + window-rollover are deterministic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsEvents } from "../../src/lib/analytics/events";
import {
  VENDOR_QUOTAS,
  QUOTA_SAFETY_FRACTION,
  VENDOR_CACHE_TTL_SEC,
  bucketLocale,
  checkQuota,
  consumeQuota,
  getCachedDetail,
  getCachedSearch,
  normalizeCacheQuery,
  setCachedDetail,
  setCachedSearch,
  _resetVendorSearchCacheForTest,
} from "../../src/lib/server/vendorSearchCache";

const mockServerTrack = vi.fn(async () => ({ ok: true }));

vi.mock("@/lib/analytics/serverTrack", () => ({
  serverTrack: (...args: unknown[]) => mockServerTrack(...args),
}));

beforeEach(() => {
  // Ensure no Upstash env so we exercise the in-memory path deterministically.
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  _resetVendorSearchCacheForTest();
  mockServerTrack.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  _resetVendorSearchCacheForTest();
});

describe("normalizeCacheQuery", () => {
  it("folds case, spacing, and trailing punctuation so the same query hits cache", () => {
    expect(normalizeCacheQuery("  Chicken   Breast! ")).toBe("chicken breast");
    expect(normalizeCacheQuery("CHICKEN breast")).toBe("chicken breast");
    expect(normalizeCacheQuery("chicken-breast")).toBe("chicken breast");
  });

  it("strips diacritics so 'crème' and 'creme' share a key", () => {
    expect(normalizeCacheQuery("Crème Fraîche")).toBe(normalizeCacheQuery("creme fraiche"));
  });
});

describe("bucketLocale", () => {
  it("buckets US + US-territory locales to 'us'", () => {
    expect(bucketLocale("en-US")).toBe("us");
    expect(bucketLocale("en-PR")).toBe("us");
  });

  it("buckets everything else (incl. null / bare language) to 'intl'", () => {
    expect(bucketLocale("en-GB")).toBe("intl");
    expect(bucketLocale("fr-FR")).toBe("intl");
    expect(bucketLocale("en")).toBe("intl");
    expect(bucketLocale(null)).toBe("intl");
    expect(bucketLocale(undefined)).toBe("intl");
  });
});

describe("cache hit / miss", () => {
  it("returns null on a cold miss", async () => {
    const hit = await getCachedSearch("usda", "chicken breast");
    expect(hit).toBeNull();
  });

  it("returns the cached array on a warm hit (no second vendor call needed)", async () => {
    const hits = [{ fdcId: 1, description: "Chicken breast" }];
    await setCachedSearch("usda", "chicken breast", hits);
    const got = await getCachedSearch("usda", "chicken breast");
    expect(got).toEqual(hits);
  });

  it("hits the same entry for cosmetically-different queries (case/spacing/punct)", async () => {
    await setCachedSearch("usda", "Chicken Breast", [{ fdcId: 9 }]);
    expect(await getCachedSearch("usda", "  chicken   breast! ")).toEqual([{ fdcId: 9 }]);
  });

  it("partitions by vendor — a USDA write is NOT served to FatSecret", async () => {
    await setCachedSearch("usda", "egg", [{ fdcId: 1 }]);
    expect(await getCachedSearch("fatsecret", "egg")).toBeNull();
  });

  it("partitions by region bucket — a US write is NOT served to an intl reader", async () => {
    await setCachedSearch("fatsecret", "greggs", [{ foodId: "1" }], { locale: "en-US" });
    expect(await getCachedSearch("fatsecret", "greggs", { locale: "en-GB" })).toBeNull();
    expect(await getCachedSearch("fatsecret", "greggs", { locale: "en-US" })).toEqual([{ foodId: "1" }]);
  });

  it("partitions by page", async () => {
    await setCachedSearch("usda", "rice", [{ fdcId: 1 }], { page: 1 });
    expect(await getCachedSearch("usda", "rice", { page: 2 })).toBeNull();
  });

  it("caches a genuine empty result (stable 'no matches' fact)", async () => {
    await setCachedSearch("usda", "zzzznotafood", []);
    expect(await getCachedSearch("usda", "zzzznotafood")).toEqual([]);
  });
});

describe("detail cache hit / miss (ENG-1117)", () => {
  it("returns null on a cold miss", async () => {
    expect(await getCachedDetail("edamam", "food_abc")).toBeNull();
  });

  it("returns the cached OBJECT on a warm hit (detail is an object, not an array)", async () => {
    const detail = { microsPer100g: { vitaminCMg: 12, calciumMg: 40 } };
    await setCachedDetail("edamam", "food_abc", detail);
    expect(await getCachedDetail("edamam", "food_abc")).toEqual(detail);
  });

  it("caches a USDA detail payload keyed by stringified fdcId", async () => {
    const payload = { ok: true, fdcId: 12345, macrosPer100g: { calories: 89 }, portions: [] };
    await setCachedDetail("usda", "12345", payload);
    expect(await getCachedDetail("usda", "12345")).toEqual(payload);
  });

  it("folds cosmetic foodId differences (trim + case) into the same entry", async () => {
    await setCachedDetail("edamam", "Food_ABC", { microsPer100g: {} });
    expect(await getCachedDetail("edamam", "  food_abc  ")).toEqual({ microsPer100g: {} });
  });

  it("partitions by vendor — an Edamam detail write is NOT served to USDA", async () => {
    await setCachedDetail("edamam", "1", { microsPer100g: { ironMg: 2 } });
    expect(await getCachedDetail("usda", "1")).toBeNull();
  });

  it("does NOT collide with the search cache key space (same id string)", async () => {
    await setCachedSearch("usda", "chicken", [{ fdcId: 1 }]);
    // A detail read for a foodId that happens to equal a query must miss.
    expect(await getCachedDetail("usda", "chicken")).toBeNull();
  });

  it("caches an empty micro panel (stable 'vendor publishes nothing extra' fact)", async () => {
    await setCachedDetail("edamam", "food_empty", { microsPer100g: {} });
    expect(await getCachedDetail("edamam", "food_empty")).toEqual({ microsPer100g: {} });
  });

  it("evicts the detail entry after the default 24h TTL elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T00:00:00Z"));
    await setCachedDetail("edamam", "food_ttl", { microsPer100g: { ironMg: 1 } });
    expect(await getCachedDetail("edamam", "food_ttl")).toEqual({ microsPer100g: { ironMg: 1 } });
    vi.setSystemTime(new Date("2026-06-18T00:00:00Z").getTime() + (VENDOR_CACHE_TTL_SEC + 1) * 1000);
    expect(await getCachedDetail("edamam", "food_ttl")).toBeNull();
  });
});

describe("TTL eviction", () => {
  it("evicts the entry after the default 24h TTL elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T00:00:00Z"));
    await setCachedSearch("usda", "banana", [{ fdcId: 1 }]);
    expect(await getCachedSearch("usda", "banana")).toEqual([{ fdcId: 1 }]);

    // Just before expiry — still a hit.
    vi.setSystemTime(new Date("2026-06-11T00:00:00Z").getTime() + (VENDOR_CACHE_TTL_SEC - 1) * 1000);
    expect(await getCachedSearch("usda", "banana")).toEqual([{ fdcId: 1 }]);

    // Past expiry — evicted.
    vi.setSystemTime(new Date("2026-06-11T00:00:00Z").getTime() + (VENDOR_CACHE_TTL_SEC + 1) * 1000);
    expect(await getCachedSearch("usda", "banana")).toBeNull();
  });

  it("honours a custom shorter TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    await setCachedSearch("usda", "milk", [{ fdcId: 1 }], { ttlSec: 60 });
    vi.setSystemTime(61_000);
    expect(await getCachedSearch("usda", "milk")).toBeNull();
  });
});

describe("account-level quota guard", () => {
  it("checkQuota allows when usage is below the trip point", async () => {
    const d = await checkQuota("edamam");
    expect(d.allowed).toBe(true);
    expect(d.cap).toBe(VENDOR_QUOTAS.edamam.cap);
  });

  it("consumeQuota allows until the trip point, then degrades", async () => {
    const { cap } = VENDOR_QUOTAS.edamam;
    const trip = Math.floor(cap * QUOTA_SAFETY_FRACTION);

    // Burn exactly up to the trip point — all allowed.
    let lastAllowed = true;
    for (let i = 0; i < trip; i++) {
      const d = await consumeQuota("edamam");
      lastAllowed = d.allowed;
    }
    expect(lastAllowed).toBe(true);

    // The next consume pushes over the trip point → degraded.
    const over = await consumeQuota("edamam");
    expect(over.allowed).toBe(false);
    if (!over.allowed) expect(over.reason).toBe("quota_exhausted");

    // And a fresh checkQuota now reports exhausted too.
    const check = await checkQuota("edamam");
    expect(check.allowed).toBe(false);
  });

  it("quota counters are independent per vendor", async () => {
    const { cap } = VENDOR_QUOTAS.edamam;
    const trip = Math.floor(cap * QUOTA_SAFETY_FRACTION);
    for (let i = 0; i <= trip; i++) await consumeQuota("edamam");
    expect((await checkQuota("edamam")).allowed).toBe(false);
    // USDA is untouched.
    expect((await checkQuota("usda")).allowed).toBe(true);
  });

  it("the quota window rolls over (a new window resets the counter)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T00:00:00Z"));
    const { cap, windowSec } = VENDOR_QUOTAS.usda;
    const trip = Math.floor(cap * QUOTA_SAFETY_FRACTION);
    for (let i = 0; i <= trip; i++) await consumeQuota("usda");
    expect((await checkQuota("usda")).allowed).toBe(false);

    // Advance past the window — counter resets, allowed again.
    vi.setSystemTime(new Date("2026-06-11T00:00:00Z").getTime() + (windowSec + 1) * 1000);
    expect((await checkQuota("usda")).allowed).toBe(true);
  });
});

describe("vendor_search_degraded PostHog event (ENG-1412)", () => {
  it("does NOT fire while a vendor is still within budget", async () => {
    await checkQuota("edamam");
    await consumeQuota("edamam");
    expect(mockServerTrack).not.toHaveBeenCalled();
  });

  it("fires with guard:'consume' the moment consumeQuota trips the guard", async () => {
    const { cap } = VENDOR_QUOTAS.fatsecret;
    const trip = Math.floor(cap * QUOTA_SAFETY_FRACTION);
    for (let i = 0; i < trip; i++) await consumeQuota("fatsecret");
    expect(mockServerTrack).not.toHaveBeenCalled();

    const over = await consumeQuota("fatsecret");
    expect(over.allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockServerTrack).toHaveBeenCalledTimes(1);
    expect(mockServerTrack).toHaveBeenCalledWith(
      AnalyticsEvents.vendor_search_degraded,
      "system:vendor_quota",
      expect.objectContaining({
        vendor: "fatsecret",
        reason: "quota_exhausted",
        guard: "consume",
        used: trip + 1,
        cap,
      }),
    );
  });

  it("fires with guard:'check' when checkQuota rejects an exhausted vendor", async () => {
    const { cap } = VENDOR_QUOTAS.usda;
    const trip = Math.floor(cap * QUOTA_SAFETY_FRACTION);
    for (let i = 0; i < trip; i++) await consumeQuota("usda");
    mockServerTrack.mockClear();

    const rejected = await checkQuota("usda");
    expect(rejected.allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockServerTrack).toHaveBeenCalledTimes(1);
    expect(mockServerTrack).toHaveBeenCalledWith(
      AnalyticsEvents.vendor_search_degraded,
      "system:vendor_quota",
      expect.objectContaining({ vendor: "usda", reason: "quota_exhausted", guard: "check" }),
    );
  });

  it("de-dupes to one event per vendor per quota window", async () => {
    const { cap } = VENDOR_QUOTAS.edamam;
    const trip = Math.floor(cap * QUOTA_SAFETY_FRACTION);
    for (let i = 0; i < trip; i++) await consumeQuota("edamam");

    await consumeQuota("edamam"); // trips → first (and only) emit for this window
    await checkQuota("edamam");
    await checkQuota("edamam");
    await new Promise((r) => setTimeout(r, 0));

    expect(mockServerTrack).toHaveBeenCalledTimes(1);
  });

  it("tags every vendor correctly", async () => {
    for (const vendor of ["usda", "edamam", "fatsecret", "off"] as const) {
      mockServerTrack.mockClear();
      _resetVendorSearchCacheForTest();
      const { cap } = VENDOR_QUOTAS[vendor];
      const trip = Math.floor(cap * QUOTA_SAFETY_FRACTION);
      for (let i = 0; i < trip; i++) await consumeQuota(vendor);
      await consumeQuota(vendor);
      await new Promise((r) => setTimeout(r, 0));

      expect(mockServerTrack).toHaveBeenCalledWith(
        AnalyticsEvents.vendor_search_degraded,
        "system:vendor_quota",
        expect.objectContaining({ vendor }),
      );
    }
  });
});
