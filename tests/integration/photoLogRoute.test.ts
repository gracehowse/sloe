/**
 * Integration tests for POST /api/nutrition/photo-log — auth, free-taster
 * quota, multipart expectation, OpenAI config (no live OpenAI calls).
 *
 * 2026-05-02 — gating model changed: photo-log is no longer Pro-only.
 * Non-Pro users get `FREE_PHOTO_LOG_DAILY_LIMIT` (3) free photo logs per
 * rolling 24h via a dedicated rate-limit bucket
 * (`api:photo-log:free-quota`). Pro users keep the existing 100/day
 * bucket (`api:photo-log`). See
 * `docs/decisions/2026-05-02-photo-log-free-taster.md`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  getUserTier: vi.fn(),
}));

// We mock per-call so tests can simulate "free quota exhausted" by
// returning ok=false from the *first* rateLimit call (the free-taster
// bucket) while leaving the second (Pro 100/day) untouched.
vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, remaining: 99, resetAtMs: 0 })),
}));

import { POST } from "../../app/api/nutrition/photo-log/route";
import { FREE_PHOTO_LOG_DAILY_LIMIT } from "@/lib/nutrition/photoLogQuota";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { rateLimit } from "@/lib/server/rateLimit";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockTier = getUserTier as ReturnType<typeof vi.fn>;
const mockRateLimit = rateLimit as ReturnType<typeof vi.fn>;

describe("POST /api/nutrition/photo-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
    // Default: every rateLimit call passes. Tests override per-case.
    mockRateLimit.mockImplementation(async () => ({
      ok: true,
      remaining: 99,
      resetAtMs: 0,
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array([1])], { type: "image/jpeg" }), "x.jpg");
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=----x" },
        body: fd,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("free user with quota remaining (0 logs today) is admitted past the gate", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("free");
    // First call = free-quota bucket: ok=true. Second call = pro 100/day: ok=true.
    mockRateLimit
      .mockResolvedValueOnce({ ok: true, remaining: 2, resetAtMs: 0 })
      .mockResolvedValueOnce({ ok: true, remaining: 99, resetAtMs: 0 });
    // The handler will get past the gate, then fail on multipart (no
    // Content-Type) — which is fine: we're asserting the gate passed,
    // not the full happy path. A 200 OK requires a live OpenAI call,
    // out of scope for an integration test.
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    // Gate passed → 400 expected_multipart, NOT 403 upgrade_required.
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("expected_multipart");
    // Confirm the free-quota bucket was hit with the correct prefix + limit.
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        keyPrefix: "api:photo-log:free-quota",
        userId: "u1",
        limit: FREE_PHOTO_LOG_DAILY_LIMIT,
      }),
    );
  });

  it("free user with quota exhausted (3 logs today) returns 403 upgrade_required", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("free");
    // First call = free-quota bucket: ok=false (quota drained).
    mockRateLimit.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      resetAtMs: 0,
      retryAfterSec: 60,
      ip: null,
    });
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: new FormData(),
      }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("upgrade_required");
    expect(json.freeQuotaRemaining).toBe(0);
    // Pro 100/day limiter must NOT have been called (we short-circuit on free-quota fail).
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
  });

  it("base tier (mid-tier non-Pro) is treated like free for the photo-log taster", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("base");
    mockRateLimit.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      resetAtMs: 0,
      retryAfterSec: 60,
      ip: null,
    });
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: new FormData(),
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("upgrade_required");
  });

  it("pro user does NOT hit the free-taster bucket (only the 100/day bucket)", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    mockRateLimit.mockResolvedValueOnce({
      ok: true,
      remaining: 99,
      resetAtMs: 0,
    });
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    // 400 expected_multipart proves we got past all gates.
    expect(res.status).toBe(400);
    // Pro path calls rateLimit exactly once — the 100/day bucket. The
    // free-quota bucket is bypassed entirely.
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        keyPrefix: "api:photo-log",
        limit: 100,
      }),
    );
  });

  it("pro user hits the existing 100/day cap → 429", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    mockRateLimit.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      resetAtMs: 0,
      retryAfterSec: 600,
      ip: null,
    });
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: new FormData(),
      }),
    );
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limited");
  });

  it("returns 503 when OPENAI_API_KEY is unset (after gate passes)", async () => {
    vi.unstubAllEnvs();
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array([1])], { type: "image/jpeg" }), "x.jpg");
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("openai_not_configured");
  });

  it("returns 400 expected_multipart when Content-Type is not multipart", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("expected_multipart");
  });
});
