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
 * Covers auth, free-taster quota, Pro 100/day cap, AI config,
 * multipart expectation, and the range-first response shape.
 *
 * 2026-05-08 (`docs/decisions/2026-05-08-food-correction-verification-pipeline.md`):
 * route migrated from OpenAI GPT-4o to Anthropic Claude Sonnet 4.6 vision.
 * `ANTHROPIC_API_KEY` is preferred; falls back to `OPENAI_API_KEY` so the
 * env-var-driven cutover can flip without a redeploy. Tests now stub the
 * Claude Messages API response shape ({content: [{type:"text",text:"..."}]})
 * and assert vendor-neutral `ai_*` error codes.
 *
 * No live AI calls — the upstream `fetch` is stubbed with `vi.stubGlobal`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearIntegrationAiKeys,
  isolateAiBudgetForIntegrationTest,
  stubClaudeMessagesFetch,
} from "../helpers/aiRouteTestEnv";

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

// 2026-05-08 — the route invokes sharp on the upload to normalize HEIC →
// JPEG before sending to the AI vendor. Sharp can't decode the 4-byte
// fixture buffer used in these tests; mock the helper so we exercise
// only the post-normalize path. The real helper has dedicated coverage
// in `tests/unit/normalizeImageForAi.test.ts`.
vi.mock("@/lib/server/normalizeImageForAi", () => ({
  normalizeImageForAi: vi.fn(async (buf: Buffer) => ({
    buffer: buf,
    mediaType: "image/jpeg",
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

/** Helper: stub Claude Messages API with a fresh Response per call. */
function stubAi(spec: StubSpec) {
  stubClaudeMessagesFetch(spec.body, spec.status);
}

/** Helper: model JSON wrapped in Claude's Messages API envelope.
 *  The route prefills `{` so `text` here is the JSON body MINUS the
 *  leading brace (the route prepends it back before parsing). */
function modelEnvelope(content: string) {
  const stripped = content.replace(/^\{/, "");
  return {
    content: [{ type: "text", text: stripped }],
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
    isolateAiBudgetForIntegrationTest();
    // Default to the Claude path (preferred). Tests that need to
    // exercise the OpenAI fallback override this in the test body.
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
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
    stubAi({ status: 200, body: HAPPY_MODEL_BODY });
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
    stubAi({ status: 200, body: HAPPY_MODEL_BODY });
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

  it("returns 503 ai_not_configured when neither AI key is set (after gate passes)", async () => {
    vi.unstubAllEnvs();
    isolateAiBudgetForIntegrationTest();
    clearIntegrationAiKeys();
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ai_not_configured");
  });

  it("falls back to OpenAI when only OPENAI_API_KEY is set", async () => {
    vi.unstubAllEnvs();
    isolateAiBudgetForIntegrationTest();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    let called = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo) => {
        const u = String(url);
        if (u.includes("/capture/")) return new Response(null, { status: 200 });
        called = u;
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    items: [
                      {
                        name: "Pita",
                        category: "Bread + dips",
                        calories: { low: 120, high: 150 },
                        protein: null,
                        carbs: null,
                        fat: null,
                        confidence: "high",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    );
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(200);
    // Confirm we hit the OpenAI endpoint, not Anthropic.
    expect(called).toContain("api.openai.com");
  });

  it("uses Claude (Anthropic) when ANTHROPIC_API_KEY is set", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    let called = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo) => {
        const u = String(url);
        if (u.includes("/capture/")) return new Response(null, { status: 200 });
        called = u;
        return new Response(JSON.stringify(HAPPY_MODEL_BODY), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    );
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(200);
    expect(called).toContain("api.anthropic.com");
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
