/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/plan-import/extract — auth, multipart,
 * PDF + image adaptors (mocked). No live AI or PDF parsing in unit path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  getUserTier: vi.fn(),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, remaining: 2, resetAtMs: 0, retryAfterSec: 0 })),
}));

vi.mock("@/lib/server/featureFlags", () => ({
  isServerFeatureEnabled: vi.fn(async () => false),
}));

vi.mock("@/lib/planning/planImport/extractPdfText", () => ({
  extractPdfText: vi.fn(async () => "Mon Lunch: Chicken bowl\n\nChicken Thighs\nServes 4\nIngredients: 800 g chicken"),
}));

vi.mock("@/lib/server/normalizeImageForAi", () => ({
  normalizeImageForAi: vi.fn(async (buf: Buffer) => ({
    buffer: buf,
    mediaType: "image/jpeg",
  })),
}));

vi.mock("@/lib/server/aiProvider", () => ({
  callAiVision: vi.fn(),
  AiBudgetExceededError: class AiBudgetExceededError extends Error {
    retryAfterSec = 3600;
  },
}));

import { POST } from "../../app/api/plan-import/extract/route";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { callAiVision } from "@/lib/server/aiProvider";
import { extractPdfText } from "@/lib/planning/planImport/extractPdfText";
import { rateLimit } from "@/lib/server/rateLimit";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockVision = callAiVision as ReturnType<typeof vi.fn>;
const mockPdf = extractPdfText as ReturnType<typeof vi.fn>;
const mockTier = getUserTier as ReturnType<typeof vi.fn>;
const mockRateLimit = rateLimit as ReturnType<typeof vi.fn>;

function multipart(source: "pdf" | "image", name: string, type: string, bytes: number[] = [1, 2, 3]) {
  const fd = new FormData();
  fd.append("source", source);
  fd.append("file", new Blob([new Uint8Array(bytes)], { type }), name);
  return new Request("http://localhost/api/plan-import/extract", { method: "POST", body: fd });
}

describe("POST /api/plan-import/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVision.mockResolvedValue({
      ok: true,
      text: "Mon Lunch: Salad\n\nGreen salad\nServes 2\nIngredients: 200 g spinach, 100 g cucumber",
    });
    // Default every pre-existing test in this describe block to Pro tier
    // so the image-path tier gate (ENG-1487 #2, added after these tests)
    // never fires and they stay authoritative unmodified. Free-tier
    // gating gets its own describe block below.
    mockTier.mockResolvedValue("pro");
    mockRateLimit.mockResolvedValue({ ok: true, remaining: 2, resetAtMs: 0, retryAfterSec: 0 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const res = await POST(multipart("pdf", "plan.pdf", "application/pdf"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid source", async () => {
    mockUserId.mockResolvedValue("u1");
    const fd = new FormData();
    fd.append("source", "paste");
    fd.append("file", new Blob(["x"], { type: "text/plain" }), "x.txt");
    const res = await POST(new Request("http://localhost/api/plan-import/extract", { method: "POST", body: fd }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_source");
  });

  it("extracts PDF text", async () => {
    mockUserId.mockResolvedValue("u1");
    const res = await POST(multipart("pdf", "week1.pdf", "application/pdf"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.source).toBe("pdf");
    expect(json.text).toContain("Chicken");
    expect(mockPdf).toHaveBeenCalledOnce();
  });

  it("extracts image text via vision", async () => {
    mockUserId.mockResolvedValue("u1");
    const res = await POST(multipart("image", "page.jpg", "image/jpeg"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.source).toBe("image");
    expect(json.text).toContain("spinach");
    expect(mockVision).toHaveBeenCalledOnce();
  });
});

describe("POST /api/plan-import/extract — image-path tier gating (ENG-1487 finding #2)", () => {
  // 2026-07-10 red-team: the image branch (Sonnet vision, maxTokens 8000,
  // ~20p/call) had no tier gate — a farmed free account could hit the
  // flat 30/day cap for ~£6/account/day. Free tier now gets a tight
  // weekly allowance on the image path ONLY; the PDF path (no AI call at
  // all) is untouched by tier — see the PDF-path test below.
  beforeEach(() => {
    vi.clearAllMocks();
    mockVision.mockResolvedValue({
      ok: true,
      text: "Mon Lunch: Salad\n\nGreen salad\nServes 2\nIngredients: 200 g spinach, 100 g cucumber",
    });
  });

  it("free user with quota remaining is admitted past the image-path gate", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("free");
    mockRateLimit
      .mockResolvedValueOnce({ ok: true, remaining: 29, resetAtMs: 0 }) // top-of-route flat throttle
      .mockResolvedValueOnce({ ok: true, remaining: 2, resetAtMs: 0 }); // free-quota image gate
    const res = await POST(multipart("image", "page.jpg", "image/jpeg"));
    expect(res.status).toBe(200);
    expect(mockRateLimit).toHaveBeenCalledTimes(2);
    expect(mockRateLimit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        keyPrefix: "api:plan-import-extract:image:free-quota",
        userId: "u1",
        limit: 3,
      }),
    );
  });

  it("free user with image-quota exhausted returns 403 upgrade_required (never calls the AI vendor)", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("free");
    mockRateLimit
      .mockResolvedValueOnce({ ok: true, remaining: 29, resetAtMs: 0 }) // top-of-route flat throttle passes
      .mockResolvedValueOnce({ ok: false, remaining: 0, resetAtMs: 0, retryAfterSec: 60, ip: null }); // image gate fails
    const res = await POST(multipart("image", "page.jpg", "image/jpeg"));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("upgrade_required");
    expect(mockVision).not.toHaveBeenCalled();
  });

  it("pro user is never subject to the image-path free-quota gate", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    mockRateLimit.mockResolvedValue({ ok: true, remaining: 29, resetAtMs: 0 });
    const res = await POST(multipart("image", "page.jpg", "image/jpeg"));
    expect(res.status).toBe(200);
    // Only the top-of-route flat throttle — no second (free-quota) call.
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
  });

  it("free user is NOT gated on the PDF path (no AI vision call — tier is never even checked)", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("free");
    mockRateLimit.mockResolvedValue({ ok: true, remaining: 29, resetAtMs: 0 });
    const res = await POST(multipart("pdf", "week1.pdf", "application/pdf"));
    expect(res.status).toBe(200);
    expect(mockTier).not.toHaveBeenCalled();
    // Only the top-of-route flat throttle — the PDF branch returns before
    // ever reaching the image-only tier gate.
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
  });
});
