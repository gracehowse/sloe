/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  extractPdfText: vi.fn(async () => "Mediterranean Baked Fish\nIngredients: fish, tomatoes"),
}));

import { POST } from "../../app/api/cookbook-import/extract/route";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;

describe("POST /api/cookbook-import/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserId.mockResolvedValue("u1");
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const form = new FormData();
    form.append("file", new File(["%PDF"], "book.pdf", { type: "application/pdf" }));
    const res = await POST(
      new Request("http://localhost/api/cookbook-import/extract", { method: "POST", body: form }),
    );
    expect(res.status).toBe(401);
  });

  it("extracts text from PDF", async () => {
    const form = new FormData();
    form.append("file", new File(["%PDF"], "fast-800.pdf", { type: "application/pdf" }));
    const res = await POST(
      new Request("http://localhost/api/cookbook-import/extract", { method: "POST", body: form }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.text).toContain("Mediterranean");
  });
});
