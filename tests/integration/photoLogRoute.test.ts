/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/nutrition/photo-log.
 *
 * 2026-05-02 — gating model changed: photo-log is no longer Pro-only.
 * Non-Pro users get `FREE_PHOTO_LOG_WEEKLY_LIMIT` (=5) free photo logs
 * per rolling 7-day window via a dedicated rate-limit bucket
 * (`api:photo-log:free-quota`). Pro users keep the existing 100/day
 * bucket (`api:photo-log`). See
 * `docs/decisions/2026-05-02-photo-log-free-taster.md`.
 *
 * Covers auth, free-taster quota, Pro 100/day cap, OpenAI config,
 * multipart expectation, and the range-first response shape.
 *
 * No live OpenAI calls — the upstream `fetch` is stubbed with
 * `vi.stubGlobal`.
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
  rateLimit: vi.fn(async () => ({
    ok: true,
    remaining: 99,
    resetAtMs: 0,
  })),
}));

import { POST } from "../../app/api/nutrition/photo-log/route";
import {
  FREE_PHOTO_LOG_WEEKLY_LIMIT,
  FREE_PHOTO_LOG_WINDOW_MS,
} from "@/lib/nutrition/photoLogQuota";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { rateLimit } from "@/lib/server/rateLimit";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockTier = getUserTier as ReturnType<typeof vi.fn>;
const mockRateLimit = rateLimit as ReturnType<typeof vi.fn>;

type FetchInit = RequestInit & { body?: string };
type StubSpec = { status: number; body: unknown };

/** Helper: stub `globalThis.fetch` to return a single OpenAI-shaped response. */
function stubOpenAi(spec: StubSpec) {
  const fakeResp = new Response(JSON.stringify(spec.body), {
    status: spec.status,
    headers: { "content-type": "application/json" },
  });
  vi.stubGlobal("fetch", vi.fn(async (_url: string, _init?: FetchInit) => fakeResp));
}

/** Helper: model JSON wrapped in OpenAI's chat completion envelope. */
function modelEnvelope(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

function pngFormBody() {
  const fd = new FormData();
  fd.append(
    "image",
    new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }),
    "meal.png",
  );
  return fd;
}

/** Default model body — used by tests that need a successful parse to
 *  reach the success branch. Mirrors `photoLogRoute.test.ts` shape
 *  expectations from the previous range-first test. */
const HAPPY_MODEL_BODY = modelEnvelope(
  JSON.stringify({
    items: [
      {
        name: "Pita",
        category: "Bread + dips",
        quantityHint: "1 piece",
        calories: { low: 120, high: 150 },
        protein: { low: 4, high: 5 },
        carbs: { low: 24, high: 30 },
        fat: { low: 0, high: 1 },
        confidence: "high",
      },
    ],
  }),
);

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
    vi.unstubAllGlobals();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const fd = pngFormBody();
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=----x" },
        body: fd,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("free user with quota remaining is admitted past the gate (free-taster bucket only)", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("free");
    // Free-taster bucket passes with 4 remaining (= they had 1 already
    // this week). We DO NOT also call the Pro 100/day limiter.
    mockRateLimit.mockResolvedValueOnce({
      ok: true,
      remaining: 4,
      resetAtMs: 0,
    });
    stubOpenAi({ status: 200, body: HAPPY_MODEL_BODY });
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Authoritative quota signal threaded through to the client.
    expect(body.freeQuotaRemaining).toBe(4);
    // Confirm the free-taster bucket was hit with the correct prefix +
    // limit + windowMs — pinning the contract so a future drift fails.
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        keyPrefix: "api:photo-log:free-quota",
        userId: "u1",
        limit: FREE_PHOTO_LOG_WEEKLY_LIMIT,
        windowMs: FREE_PHOTO_LOG_WINDOW_MS,
      }),
    );
  });

  it("free user with quota exhausted (5 logs this week) returns 403 upgrade_required", async () => {
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
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("upgrade_required");
    expect(json.freeQuotaRemaining).toBe(0);
    // Pro 100/day limiter must NOT have been called (we short-circuit
    // on free-quota fail so the Pro bucket isn't touched by non-Pro
    // traffic).
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
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("upgrade_required");
    // Same bucket as free — the route does not differentiate.
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        keyPrefix: "api:photo-log:free-quota",
        limit: FREE_PHOTO_LOG_WEEKLY_LIMIT,
      }),
    );
  });

  it("pro user does NOT hit the free-taster bucket (only the 100/day bucket)", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    mockRateLimit.mockResolvedValueOnce({
      ok: true,
      remaining: 99,
      resetAtMs: 0,
    });
    stubOpenAi({ status: 200, body: HAPPY_MODEL_BODY });
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Pro response surfaces null for the quota signal — uncapped at
    // the user-visible level.
    expect(body.freeQuotaRemaining).toBeNull();
    // Pro path calls rateLimit exactly once — the 100/day bucket. The
    // free-quota bucket is bypassed entirely.
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        keyPrefix: "api:photo-log",
        limit: 100,
        windowMs: 24 * 60 * 60_000,
      }),
    );
    // Critical correctness check — the Pro bucket key prefix is NOT
    // the free-taster prefix. (Defence-in-depth: a regression that
    // collapses the two buckets would break this assertion.)
    const call = mockRateLimit.mock.calls[0]?.[0] as { keyPrefix: string };
    expect(call.keyPrefix).toBe("api:photo-log");
    expect(call.keyPrefix).not.toBe("api:photo-log:free-quota");
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
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limited");
  });

  it("returns 503 when OPENAI_API_KEY is unset (after gate passes)", async () => {
    vi.unstubAllEnvs();
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: pngFormBody(),
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
