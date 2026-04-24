/**
 * Integration tests for POST /api/nutrition/photo-log — auth, tier gate,
 * multipart expectation, OpenAI config (no live OpenAI calls).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  getUserTier: vi.fn(),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

import { POST } from "../../app/api/nutrition/photo-log/route";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockTier = getUserTier as ReturnType<typeof vi.fn>;

describe("POST /api/nutrition/photo-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
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

  it("returns 403 upgrade_required when tier is not Pro", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("free");
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array([1])], { type: "image/jpeg" }), "x.jpg");
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("upgrade_required");
  });

  it("returns 503 when OPENAI_API_KEY is unset", async () => {
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
