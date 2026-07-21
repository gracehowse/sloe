/**
 * ENG-668 — the rate limiter must FAIL CLOSED on the real production deployment
 * when Upstash env is absent, instead of silently falling back to a per-instance
 * in-memory bucket (effective cap = limit × lambda count → AI/photo quota bypass).
 *
 * "Production" is keyed off VERCEL_ENV (matching middleware.ts), NOT NODE_ENV —
 * Vercel previews run with NODE_ENV=production but VERCEL_ENV=preview, and must
 * keep the in-memory fallback so preview QA isn't 429ed. Local dev keeps it too.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// rateLimit() awaits next/headers `headers()`; stub it to a no-IP request.
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (_name: string) => null }),
}));

describe("rateLimit Upstash-absent behaviour (ENG-668)", () => {
  const ORIG_NODE_ENV = process.env.NODE_ENV;
  const ORIG_VERCEL_ENV = process.env.VERCEL_ENV;
  const ORIG_URL = process.env.UPSTASH_REDIS_REST_URL;
  const ORIG_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  const ORIG_E2E_SERVER = process.env.SUPPR_E2E_SERVER;

  const restore = (k: string, v: string | undefined) => {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  };

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.VERCEL_ENV; // each test sets the prod signal explicitly
    delete process.env.SUPPR_E2E_SERVER;
    vi.resetModules();
  });

  afterEach(() => {
    restore("NODE_ENV", ORIG_NODE_ENV);
    restore("VERCEL_ENV", ORIG_VERCEL_ENV);
    restore("UPSTASH_REDIS_REST_URL", ORIG_URL);
    restore("UPSTASH_REDIS_REST_TOKEN", ORIG_TOKEN);
    restore("SUPPR_E2E_SERVER", ORIG_E2E_SERVER);
    vi.restoreAllMocks();
  });

  it("fails CLOSED (ok:false) on the prod deploy (VERCEL_ENV=production) when Upstash is missing", async () => {
    process.env.VERCEL_ENV = "production";
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

  it("does NOT silently allow unlimited on prod (no in-memory pass-through)", async () => {
    process.env.VERCEL_ENV = "production";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { rateLimit } = await import("@/lib/server/rateLimit");

    // Even the very first call is refused — in-memory would have returned ok:true.
    const first = await rateLimit({ keyPrefix: "test_ai_firsthit", limit: 5, windowMs: 60_000 });
    expect(first.ok).toBe(false);
  });

  it("also fails closed on a non-Vercel prod host (VERCEL_ENV unset, NODE_ENV=production)", async () => {
    process.env.NODE_ENV = "production"; // VERCEL_ENV deleted in beforeEach
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { rateLimit } = await import("@/lib/server/rateLimit");

    const res = await rateLimit({ keyPrefix: "test_ai_bare_prod", limit: 5, windowMs: 60_000 });
    expect(res.ok).toBe(false);
  });

  it("does NOT fail closed on CI's own next-start server (NODE_ENV=production, SUPPR_E2E_SERVER=1)", async () => {
    // Regression guard for the 2026-07-21 finding: ci.yml / visual-review.yml /
    // update-visual-baselines.yml all boot `next start` (NODE_ENV=production,
    // no VERCEL_ENV) purely to serve Playwright, with no Upstash configured.
    // Before SUPPR_E2E_SERVER existed, this hit the exact "non-Vercel prod
    // host" branch above and 429'd every rate-limited route on its first
    // request — e.g. food search's /api/*/search calls in
    // visual-redesign-gate15-authed.spec.ts, with no real quota exhausted.
    process.env.NODE_ENV = "production";
    process.env.SUPPR_E2E_SERVER = "1";
    const { rateLimit } = await import("@/lib/server/rateLimit");

    const res = await rateLimit({
      keyPrefix: `test_e2e_server_${Date.now()}`,
      limit: 5,
      windowMs: 60_000,
    });
    expect(res.ok).toBe(true);
  });

  it("does NOT fail closed on Vercel preview (VERCEL_ENV=preview + NODE_ENV=production)", async () => {
    // Regression guard: preview deploys run NODE_ENV=production but must keep the
    // in-memory fallback, or preview QA gets 429ed on every rate-limited endpoint.
    process.env.VERCEL_ENV = "preview";
    process.env.NODE_ENV = "production";
    const { rateLimit } = await import("@/lib/server/rateLimit");

    const res = await rateLimit({
      keyPrefix: `test_preview_${Date.now()}`,
      limit: 5,
      windowMs: 60_000,
    });
    expect(res.ok).toBe(true);
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
