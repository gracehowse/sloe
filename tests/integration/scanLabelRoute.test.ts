/**
 * @vitest-environment node
 *
 * 2026-05-08 build-45 follow-up — POST /api/nutrition/scan-label.
 *
 * Reads a nutrition label photo via Claude vision, returns structured
 * per-100g values + product name. The mobile client pre-fills the
 * Correct-Product form with the result so the user reviews + saves;
 * the existing submitFoodCorrection path runs Phase 2 plausibility +
 * writes to user_foods. The whole point: the next scan of the same
 * barcode hits user_foods first (canonical → own pending → OFF), so
 * the contribution actually persists.
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
// bucket) while leaving the second (Pro 30/day) untouched — same pattern
// as tests/integration/photoLogRoute.test.ts.
vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, remaining: 29, resetAtMs: 0, retryAfterSec: 0 })),
}));

// 2026-05-08 — sharp can't decode the 4-byte test fixture; mock the
// helper. Real coverage in tests/unit/normalizeImageForAi.test.ts.
vi.mock("@/lib/server/normalizeImageForAi", () => ({
  normalizeImageForAi: vi.fn(async (buf: Buffer) => ({
    buffer: buf,
    mediaType: "image/jpeg",
  })),
}));

import { POST } from "../../app/api/nutrition/scan-label/route";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { rateLimit } from "@/lib/server/rateLimit";
import {
  FREE_PHOTO_LOG_WEEKLY_LIMIT,
  FREE_PHOTO_LOG_WINDOW_MS,
} from "@/lib/nutrition/photoLogQuota";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockTier = getUserTier as ReturnType<typeof vi.fn>;
const mockRateLimit = rateLimit as ReturnType<typeof vi.fn>;

function pngFormBody(barcode = "1234567890123") {
  const fd = new FormData();
  fd.append(
    "image",
    new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }),
    "label.png",
  );
  fd.append("barcode", barcode);
  return fd;
}

/** Helper: stub `globalThis.fetch` to return Claude's Messages envelope
 *  with a JSON body. The route prefills `{` so we strip it from the
 *  test fixture before wrapping. */
function stubClaude(content: string) {
  const stripped = content.replace(/^\{/, "");
  stubClaudeMessagesFetch({ content: [{ type: "text", text: stripped }] });
}

describe("POST /api/nutrition/scan-label", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isolateAiBudgetForIntegrationTest();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    // Default every pre-existing test in this describe block to Pro tier
    // (the 30/day bucket, unchanged by ENG-1487) so they stay authoritative
    // unmodified — the free-tier gating itself gets its own describe block
    // below with explicit tier + rateLimit mocking per test.
    mockTier.mockResolvedValue("pro");
    mockRateLimit.mockResolvedValue({ ok: true, remaining: 29, resetAtMs: 0, retryAfterSec: 0 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/nutrition/scan-label", {
        method: "POST",
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when content-type is not multipart", async () => {
    mockUserId.mockResolvedValue("u1");
    const res = await POST(
      new Request("http://localhost/api/nutrition/scan-label", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("expected_multipart");
  });

  it("returns 400 missing_image when no image field is present", async () => {
    mockUserId.mockResolvedValue("u1");
    const fd = new FormData();
    fd.append("barcode", "1234567890123");
    const res = await POST(
      new Request("http://localhost/api/nutrition/scan-label", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_image");
  });

  it("returns 503 when no AI key is configured", async () => {
    vi.unstubAllEnvs();
    isolateAiBudgetForIntegrationTest();
    clearIntegrationAiKeys();
    mockUserId.mockResolvedValue("u1");
    const res = await POST(
      new Request("http://localhost/api/nutrition/scan-label", {
        method: "POST",
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ai_not_configured");
  });

  it("scales per-serving values to per-100g when only per-serving is shown (US labels)", async () => {
    mockUserId.mockResolvedValue("u1");
    stubClaude(
      JSON.stringify({
        name: "Test Crackers",
        perServing: {
          servingSizeG: 30,
          calories: 150,
          protein: 3,
          carbs: 20,
          fat: 6,
          fiberG: 2,
          sugarG: 1,
          sodiumMg: 200,
          saturatedFatG: 1,
        },
        per100g: null,
        confidence: "high",
      }),
    );
    const res = await POST(
      new Request("http://localhost/api/nutrition/scan-label", {
        method: "POST",
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // 150 kcal / 30 g serving × 100 = 500 kcal / 100 g
    expect(body.calories).toBe(500);
    expect(body.protein).toBe(10);
    expect(body.carbs).toBe(66.7);
    expect(body.fat).toBe(20);
    expect(body.servingSizeG).toBe(30);
    expect(body.name).toBe("Test Crackers");
  });

  it("uses per-100g column directly when label provides it (UK/EU)", async () => {
    mockUserId.mockResolvedValue("u1");
    stubClaude(
      JSON.stringify({
        name: "Test Yoghurt",
        perServing: { servingSizeG: 150, calories: 90, protein: 6, carbs: 7, fat: 4 },
        per100g: {
          calories: 60,
          protein: 4,
          carbs: 4.5,
          fat: 2.5,
          fiberG: 0,
          sugarG: 4,
          sodiumMg: 50,
          saturatedFatG: 1.5,
        },
        confidence: "high",
      }),
    );
    const res = await POST(
      new Request("http://localhost/api/nutrition/scan-label", {
        method: "POST",
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Should use per-100g directly, NOT scale per-serving
    expect(body.calories).toBe(60);
    expect(body.protein).toBe(4);
    expect(body.carbs).toBe(4.5);
    expect(body.fat).toBe(2.5);
    expect(body.sugarG).toBe(4);
    expect(body.sodiumMg).toBe(50);
  });

  it("returns 422 label_unreadable when neither per-100g nor per-serving+size is available", async () => {
    mockUserId.mockResolvedValue("u1");
    stubClaude(
      JSON.stringify({
        name: null,
        perServing: { servingSizeG: null, calories: 0 },
        per100g: null,
        confidence: "low",
      }),
    );
    const res = await POST(
      new Request("http://localhost/api/nutrition/scan-label", {
        method: "POST",
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("label_unreadable");
  });

  it("returns 502 model_unparseable when Claude returns garbage JSON", async () => {
    mockUserId.mockResolvedValue("u1");
    stubClaude("not valid json at all");
    const res = await POST(
      new Request("http://localhost/api/nutrition/scan-label", {
        method: "POST",
        body: pngFormBody(),
      }),
    );
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("model_unparseable");
  });
});

describe("POST /api/nutrition/scan-label — tier gating (ENG-1487 finding #2)", () => {
  // 2026-07-10 red-team: this route had NO tier gate at all — every
  // account, free or Pro, shared the flat 30/day cap, making it a cheap
  // fleet-cost farming vector. Free tier now gets the same weekly taster
  // bucket as photo-log; Pro is unchanged (30/day).
  beforeEach(() => {
    vi.clearAllMocks();
    isolateAiBudgetForIntegrationTest();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
  });

  it("free user with quota remaining is admitted past the gate (free-taster bucket only)", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("free");
    mockRateLimit.mockResolvedValueOnce({ ok: true, remaining: 4, resetAtMs: 0 });
    stubClaude(
      JSON.stringify({
        name: "Test",
        perServing: { servingSizeG: 100, calories: 100, protein: 1, carbs: 1, fat: 1 },
        per100g: { calories: 100, protein: 1, carbs: 1, fat: 1 },
        confidence: "high",
      }),
    );
    const res = await POST(
      new Request("http://localhost/api/nutrition/scan-label", { method: "POST", body: pngFormBody() }),
    );
    expect(res.status).toBe(200);
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        keyPrefix: "api:scan-label:free-quota",
        userId: "u1",
        limit: FREE_PHOTO_LOG_WEEKLY_LIMIT,
        windowMs: FREE_PHOTO_LOG_WINDOW_MS,
      }),
    );
  });

  it("free user with quota exhausted returns 403 upgrade_required (never calls the AI vendor)", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("free");
    mockRateLimit.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      resetAtMs: 0,
      retryAfterSec: 60,
      ip: null,
    });
    const res = await POST(
      new Request("http://localhost/api/nutrition/scan-label", { method: "POST", body: pngFormBody() }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("upgrade_required");
    expect(json.freeQuotaRemaining).toBe(0);
    // Short-circuits before the Pro bucket AND before any AI call.
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
  });

  it("pro user does NOT hit the free-taster bucket — only the existing 30/day bucket", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    mockRateLimit.mockResolvedValueOnce({ ok: true, remaining: 29, resetAtMs: 0 });
    stubClaude(
      JSON.stringify({
        name: "Test",
        perServing: { servingSizeG: 100, calories: 100, protein: 1, carbs: 1, fat: 1 },
        per100g: { calories: 100, protein: 1, carbs: 1, fat: 1 },
        confidence: "high",
      }),
    );
    const res = await POST(
      new Request("http://localhost/api/nutrition/scan-label", { method: "POST", body: pngFormBody() }),
    );
    expect(res.status).toBe(200);
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
    const call = mockRateLimit.mock.calls[0]?.[0] as { keyPrefix: string; limit: number };
    expect(call.keyPrefix).toBe("api:scan-label");
    expect(call.limit).toBe(30);
    expect(call.keyPrefix).not.toBe("api:scan-label:free-quota");
  });
});
