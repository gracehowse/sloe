/**
 * ENG-668 — the rate limiter must FAIL CLOSED in production when Upstash env is
 * absent, instead of silently falling back to a per-instance in-memory bucket
 * (effective cap = limit × lambda count → AI/photo quota bypass). Local dev
 * keeps the in-memory fallback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// rateLimit() awaits next/headers `headers()`; stub it to a no-IP request.
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (_name: string) => null }),
}));

describe("rateLimit Upstash-absent behaviour (ENG-668)", () => {
  const ORIG_NODE_ENV = process.env.NODE_ENV;
  const ORIG_URL = process.env.UPSTASH_REDIS_REST_URL;
  const ORIG_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIG_NODE_ENV;
    if (ORIG_URL === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = ORIG_URL;
    if (ORIG_TOKEN === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = ORIG_TOKEN;
    vi.restoreAllMocks();
  });

  it("fails CLOSED (ok:false) in production when Upstash env is missing", async () => {
    process.env.NODE_ENV = "production";
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rateLimit } = await import("@/lib/server/rateLimit");

    const res = await rateLimit({ keyPrefix: "test_ai_strict", limit: 5, windowMs: 60_000 });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.remaining).toBe(0);
      expect(res.retryAfterSec).toBeGreaterThan(0);
    }
    expect(errSpy).toHaveBeenCalled(); // the bypass must be loud, not silent
  });

  it("does NOT silently allow unlimited in production (no in-memory pass-through)", async () => {
    process.env.NODE_ENV = "production";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { rateLimit } = await import("@/lib/server/rateLimit");

    // Even the very first call is refused — in-memory would have returned ok:true.
    const first = await rateLimit({ keyPrefix: "test_ai_firsthit", limit: 5, windowMs: 60_000 });
    expect(first.ok).toBe(false);
  });

  it("keeps the in-memory fallback in development (first hit ok:true)", async () => {
    process.env.NODE_ENV = "development";
    const { rateLimit } = await import("@/lib/server/rateLimit");

    const res = await rateLimit({
      keyPrefix: `test_dev_${Date.now()}`,
      limit: 5,
      windowMs: 60_000,
    });
    expect(res.ok).toBe(true);
  });
});
