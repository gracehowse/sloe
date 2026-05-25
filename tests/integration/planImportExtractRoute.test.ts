/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/plan-import/extract — auth, multipart,
 * PDF + image adaptors (mocked). No live AI or PDF parsing in unit path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
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
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { callAiVision } from "@/lib/server/aiProvider";
import { extractPdfText } from "@/lib/planning/planImport/extractPdfText";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockVision = callAiVision as ReturnType<typeof vi.fn>;
const mockPdf = extractPdfText as ReturnType<typeof vi.fn>;

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
