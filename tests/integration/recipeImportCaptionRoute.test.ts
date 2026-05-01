/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/recipe-import/caption — the share-sheet
 * caption-text path. The route is gated by IG_TT_IMPORT_ENABLED (default
 * false). When OFF, the route MUST return 404 so the mobile fallback
 * routes to the legacy URL importer. When ON, the route validates input,
 * rate-limits per user, and round-trips a mocked LLM response through
 * `parseCaption` + `verifyIngredients`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

vi.mock("@/lib/recipe-import/extractSocialRecipe", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/recipe-import/extractSocialRecipe")
  >("@/lib/recipe-import/extractSocialRecipe");
  return {
    ...actual,
    extractRecipeFromCaption: vi.fn(),
  };
});

// Disable external nutrition lookups so the route exercises the fallback
// path (parseRawIngredients only). Same pattern as the image-route test.
vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => false,
  hasFatSecretConfig: () => false,
  hasEdamamConfig: () => false,
  hasSupabaseServiceConfig: () => false,
}));

vi.mock("@/lib/openFoodFacts/searchProducts", () => ({
  searchOffProducts: vi.fn(async () => []),
}));

import { POST } from "../../app/api/recipe-import/caption/route";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { rateLimit } from "@/lib/server/rateLimit";
import { extractRecipeFromCaption } from "@/lib/recipe-import/extractSocialRecipe";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockRl = rateLimit as ReturnType<typeof vi.fn>;
const mockExtract = extractRecipeFromCaption as ReturnType<typeof vi.fn>;

function makeReq(body: unknown) {
  return new Request("http://localhost/api/recipe-import/caption", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/recipe-import/caption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    mockRl.mockResolvedValue({ ok: true, retryAfterSec: 0 });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 when IG_TT_IMPORT_ENABLED is unset (flag default OFF)", async () => {
    vi.stubEnv("IG_TT_IMPORT_ENABLED", "");
    const res = await POST(
      makeReq({ url: "https://www.instagram.com/p/ABC/", captionText: "Some caption text long enough." }),
    );
    expect(res.status).toBe(404);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("feature_disabled");
  });

  it("returns 404 when IG_TT_IMPORT_ENABLED is set to anything other than 'true'", async () => {
    vi.stubEnv("IG_TT_IMPORT_ENABLED", "1");
    const res = await POST(
      makeReq({ url: "https://www.instagram.com/p/ABC/", captionText: "Caption text body." }),
    );
    expect(res.status).toBe(404);
  });

  describe("with feature flag ON", () => {
    beforeEach(() => {
      vi.stubEnv("IG_TT_IMPORT_ENABLED", "true");
    });

    it("returns 401 when no user is authenticated", async () => {
      mockUserId.mockResolvedValue(null);
      const res = await POST(
        makeReq({ url: "https://www.instagram.com/p/ABC/", captionText: "x".repeat(50) }),
      );
      expect(res.status).toBe(401);
    });

    it("returns 429 when rate-limited", async () => {
      mockUserId.mockResolvedValue("user-1");
      mockRl.mockResolvedValueOnce({ ok: false, retryAfterSec: 60, ip: null });
      const res = await POST(
        makeReq({ url: "https://www.instagram.com/p/ABC/", captionText: "x".repeat(50) }),
      );
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("60");
    });

    it("returns 400 when URL is missing", async () => {
      mockUserId.mockResolvedValue("user-1");
      const res = await POST(makeReq({ captionText: "x".repeat(50) }));
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("invalid_url");
    });

    it("returns 400 when URL is a blog (wrong platform for caption path)", async () => {
      mockUserId.mockResolvedValue("user-1");
      const res = await POST(
        makeReq({
          url: "https://example.com/recipe",
          captionText: "x".repeat(50),
        }),
      );
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("wrong_platform");
    });

    it("returns 422 when caption is empty / too short", async () => {
      mockUserId.mockResolvedValue("user-1");
      const res = await POST(
        makeReq({ url: "https://www.instagram.com/p/ABC/", captionText: "tiny" }),
      );
      expect(res.status).toBe(422);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("caption_too_short");
    });

    it("returns 413 when caption exceeds the size cap", async () => {
      mockUserId.mockResolvedValue("user-1");
      const res = await POST(
        makeReq({
          url: "https://www.instagram.com/p/ABC/",
          captionText: "a".repeat(8001),
        }),
      );
      expect(res.status).toBe(413);
    });

    it("returns 503 when OPENAI_API_KEY is unset", async () => {
      mockUserId.mockResolvedValue("user-1");
      vi.stubEnv("OPENAI_API_KEY", "");
      const res = await POST(
        makeReq({
          url: "https://www.instagram.com/p/ABC/",
          captionText: "Long enough caption to clear the minimum length check.",
        }),
      );
      expect(res.status).toBe(503);
    });

    it("returns 422 when the LLM returns an empty recipe", async () => {
      mockUserId.mockResolvedValue("user-1");
      mockExtract.mockResolvedValueOnce({
        title: null,
        ingredients: [],
        steps: [],
        notes: null,
        servings: null,
        prepTimeMin: null,
        cookTimeMin: null,
      });
      const res = await POST(
        makeReq({
          url: "https://www.instagram.com/p/ABC/",
          captionText: "Some text long enough to pass minimum length checks for the parser.",
        }),
      );
      expect(res.status).toBe(422);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("no_recipe");
    });

    it("returns 200 with a normalised recipe when caption parses", async () => {
      mockUserId.mockResolvedValue("user-1");
      mockExtract.mockResolvedValueOnce({
        title: "Garlic pasta",
        ingredients: ["200g pasta", "2 cloves garlic"],
        steps: ["I heat the oil", "Then we toss the pasta"],
        notes: null,
        servings: 2,
        prepTimeMin: null,
        cookTimeMin: 10,
      });
      const res = await POST(
        makeReq({
          url: "https://www.instagram.com/p/ABC/",
          captionText:
            "Quick garlic pasta — recipe by @chefmaria, dead simple weeknight dinner!!!",
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        ok: boolean;
        sourcePlatform: string;
        recipe: {
          title: string;
          ingredients: string[];
          instructions: string[];
          sourceUrl: string;
          sourceName: string;
          sourcePlatform: string;
          imageUrl: string | null;
        };
      };
      expect(data.ok).toBe(true);
      expect(data.sourcePlatform).toBe("instagram");
      expect(data.recipe.title).toBe("Garlic pasta");
      expect(data.recipe.ingredients).toEqual(["200g pasta", "2 cloves garlic"]);
      // Legal guardrail: instructions are imperative, no first-person echo
      expect(data.recipe.instructions).toEqual(["Heat the oil.", "Toss the pasta."]);
      expect(data.recipe.sourcePlatform).toBe("instagram");
      expect(data.recipe.sourceUrl).toBe("https://www.instagram.com/p/ABC/");
      expect(data.recipe.sourceName).toBe("@chefmaria");
      // No server-side fetch → no thumbnail
      expect(data.recipe.imageUrl).toBeNull();
    });

    it("rejects malformed JSON bodies with 400", async () => {
      mockUserId.mockResolvedValue("user-1");
      const res = await POST(makeReq("not json"));
      expect(res.status).toBe(400);
    });
  });
});
