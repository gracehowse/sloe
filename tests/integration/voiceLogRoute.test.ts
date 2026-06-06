/**
 * Integration tests for POST /api/nutrition/voice-log — auth, tier gate,
 * OpenAI config, and body validation (no live OpenAI calls).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearIntegrationAiKeys,
  isolateAiBudgetForIntegrationTest,
} from "../helpers/aiRouteTestEnv";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  getUserTier: vi.fn(),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

import { POST } from "../../app/api/nutrition/voice-log/route";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockTier = getUserTier as ReturnType<typeof vi.fn>;

function req(body: unknown): Request {
  return new Request("http://localhost/api/nutrition/voice-log", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/nutrition/voice-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isolateAiBudgetForIntegrationTest();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const res = await POST(req({ transcript: "eggs" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  it("returns 403 upgrade_required when tier is not Pro", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("base");
    const res = await POST(req({ transcript: "two eggs" }));
    expect(res.status).toBe(403);
    const j = await res.json();
    expect(j.error).toBe("upgrade_required");
  });

  it("returns 503 ai_not_configured when neither AI key is set", async () => {
    // 2026-05-08: route migrated to the shared `aiProvider` helper which
    // returns vendor-neutral `ai_not_configured` instead of the
    // OpenAI-specific code.
    vi.unstubAllEnvs();
    isolateAiBudgetForIntegrationTest();
    clearIntegrationAiKeys();
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const res = await POST(req({ transcript: "two eggs" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ai_not_configured");
  });

  it("returns 400 for missing transcript when Pro and OpenAI configured", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const res = await POST(req({ transcript: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_transcript");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const bad = new Request("http://localhost/api/nutrition/voice-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{",
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_body");
  });
});
