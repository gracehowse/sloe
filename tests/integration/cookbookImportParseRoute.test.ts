/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  getUserTier: vi.fn(),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

vi.mock("@/lib/server/featureFlags", () => ({
  isServerFeatureEnabled: vi.fn(async () => false),
}));

vi.mock("@/lib/planning/planImport/parseCookbookFromText", () => ({
  parseCookbookFromText: vi.fn(),
}));

import { POST } from "../../app/api/cookbook-import/parse/route";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { parseCookbookFromText } from "@/lib/planning/planImport/parseCookbookFromText";
import { COOKBOOK_EXCERPT_PARSED } from "@/lib/planning/planImport/fixtures/cookbookExcerpt";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockTier = getUserTier as ReturnType<typeof vi.fn>;
const mockParse = parseCookbookFromText as ReturnType<typeof vi.fn>;

function req(body: unknown): Request {
  return new Request("http://localhost/api/cookbook-import/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/cookbook-import/parse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    mockParse.mockResolvedValue({
      ok: true,
      bookName: COOKBOOK_EXCERPT_PARSED.bookName,
      recipes: COOKBOOK_EXCERPT_PARSED.recipes.map((r) => ({
        ...r,
        supprNutrition: { calories: 200, protein: 20, carbs: 10, fat: 8, fiberG: 2 },
        confidence: "high" as const,
        confidenceTier: "high" as const,
        ingredientCount: r.ingredients.length,
      })),
      parseWarnings: [],
      chunkCount: 1,
      lowConfidenceCount: 0,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const res = await POST(req({ text: "Recipe" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for free tier", async () => {
    mockTier.mockResolvedValue("free");
    const res = await POST(req({ text: COOKBOOK_EXCERPT_PARSED.bookName }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("pro_required");
  });

  it("returns recipes for pro user", async () => {
    const res = await POST(req({ text: "Fast 800 recipes…", bookName: "Fast 800" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.recipes).toHaveLength(3);
    expect(json.bookName).toBe("Fast 800");
  });
});
