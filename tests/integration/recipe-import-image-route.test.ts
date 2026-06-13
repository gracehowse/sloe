/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/recipe-import/image — auth, tier, multipart,
 * OpenAI wiring (mocked fetch; no live OpenAI). Nutrition uses verifyIngredients
 * with external providers disabled (P-P2-5 / image import).
 *
 * Node environment so `vi.stubGlobal("fetch", …)` replaces the same `fetch`
 * the route handler invokes (jsdom keeps a separate `window.fetch`).
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

vi.mock("@/lib/openFoodFacts/searchProducts", () => ({
  searchOffProducts: vi.fn(async () => []),
}));

vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => false,
  hasFatSecretConfig: () => false,
  hasEdamamConfig: () => false,
  hasSupabaseServiceConfig: () => false,
}));

// 2026-05-08 — sharp can't decode the tiny test-fixture buffers; mock
// the helper. Real coverage in tests/unit/normalizeImageForAi.test.ts.
vi.mock("@/lib/server/normalizeImageForAi", () => ({
  normalizeImageForAi: vi.fn(async (buf: Buffer) => ({
    buffer: buf,
    mediaType: "image/jpeg",
  })),
}));

import { POST } from "../../app/api/recipe-import/image/route";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockTier = getUserTier as ReturnType<typeof vi.fn>;

describe("POST /api/recipe-import/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isolateAiBudgetForIntegrationTest();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const fd = new FormData();
    fd.append("image", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "x.jpg");
    const res = await POST(
      new Request("http://localhost/api/recipe-import/image", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 pro_required when tier is free", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("free");
    const fd = new FormData();
    fd.append("image", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "x.jpg");
    const res = await POST(
      new Request("http://localhost/api/recipe-import/image", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("pro_required");
  });

  it("returns 503 when OPENAI_API_KEY is unset", async () => {
    vi.unstubAllEnvs();
    isolateAiBudgetForIntegrationTest();
    clearIntegrationAiKeys();
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const fd = new FormData();
    fd.append("image", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "x.jpg");
    const res = await POST(
      new Request("http://localhost/api/recipe-import/image", {
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
      new Request("http://localhost/api/recipe-import/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("expected_multipart");
  });

  it("returns 400 missing_image when image field absent", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const fd = new FormData();
    fd.append("not-image", "x");
    const res = await POST(
      new Request("http://localhost/api/recipe-import/image", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_image");
  });

  it("returns ok with ingredients and estimation-only nutrition when OpenAI returns JSON", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");

    const modelPayload = {
      // Both absent from the curated genericFoods/genericBeverages tables
      // (ENG-746) so they hit the estimation fallback — the assertion below
      // expects estimation-only nutrition. A curated staple (e.g. "chicken
      // breast") would now short-circuit to a "Suppr" match.
      title: "Test soup",
      ingredients: ["200 g sirloin steak", "1 tbsp olive oil"],
      steps: ["Simmer."],
      notes: null,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo) => {
        const u = typeof url === "string" ? url : url.toString();
        if (u.includes("api.openai.com")) {
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: JSON.stringify(modelPayload) } }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("not mocked", { status: 500 });
      }) as typeof fetch,
    );

    const fd = new FormData();
    fd.append("image", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "recipe.jpg");

    const res = await POST(
      new Request("http://localhost/api/recipe-import/image", {
        method: "POST",
        body: fd,
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      title: string | null;
      ingredients: string[];
      nutrition: { ingredientRows: Array<{ source: string }> } | null;
    };
    expect(body.ok).toBe(true);
    expect(body.title).toBe("Test soup");
    expect(body.ingredients).toHaveLength(2);
    expect(body.nutrition).not.toBeNull();
    expect(body.nutrition!.ingredientRows).toHaveLength(2);
    expect(body.nutrition!.ingredientRows.every((r) => r.source === "Estimated")).toBe(true);
  });

  // F-156-recipe-wave (2026-05-10) — image-import route now accepts an
  // optional `sourceUrl` (and `sourceName`) form field so saved rows
  // carry attribution. Closes the "Imported recipes lose source link"
  // tester report — the image branch was the only path that didn't
  // surface a source URL on the saved recipe.
  describe("source URL attribution (F-156 recipe wave)", () => {
    function mockOpenAi(payload: object) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: RequestInfo) => {
          const u = typeof url === "string" ? url : url.toString();
          if (u.includes("api.openai.com")) {
            return new Response(
              JSON.stringify({
                choices: [{ message: { content: JSON.stringify(payload) } }],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
          return new Response("not mocked", { status: 500 });
        }) as typeof fetch,
      );
    }

    it("returns null sourceUrl + sourceName when no URL is supplied", async () => {
      mockUserId.mockResolvedValue("u1");
      mockTier.mockResolvedValue("pro");
      mockOpenAi({ title: "X", ingredients: ["1 egg"], steps: [], notes: null });
      const fd = new FormData();
      fd.append("image", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "x.jpg");
      const res = await POST(
        new Request("http://localhost/api/recipe-import/image", { method: "POST", body: fd }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { sourceUrl: string | null; sourceName: string | null };
      expect(body.sourceUrl).toBeNull();
      expect(body.sourceName).toBeNull();
    });

    it("normalises a supplied sourceUrl + derives sourceName from hostname", async () => {
      mockUserId.mockResolvedValue("u1");
      mockTier.mockResolvedValue("pro");
      mockOpenAi({ title: "X", ingredients: ["1 egg"], steps: [], notes: null });
      const fd = new FormData();
      fd.append("image", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "x.jpg");
      fd.append("sourceUrl", "https://www.bbcgoodfood.com/recipes/example");
      const res = await POST(
        new Request("http://localhost/api/recipe-import/image", { method: "POST", body: fd }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { sourceUrl: string; sourceName: string };
      expect(body.sourceUrl).toBe("https://www.bbcgoodfood.com/recipes/example");
      // normaliseSource derives sourceName from hostname when not provided.
      expect(body.sourceName).toBeTruthy();
    });

    it("uses the supplied sourceName when provided alongside sourceUrl", async () => {
      mockUserId.mockResolvedValue("u1");
      mockTier.mockResolvedValue("pro");
      mockOpenAi({ title: "X", ingredients: ["1 egg"], steps: [], notes: null });
      const fd = new FormData();
      fd.append("image", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "x.jpg");
      fd.append("sourceUrl", "https://example.com/r/1");
      fd.append("sourceName", "Esther Clark");
      const res = await POST(
        new Request("http://localhost/api/recipe-import/image", { method: "POST", body: fd }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { sourceUrl: string; sourceName: string };
      expect(body.sourceUrl).toBe("https://example.com/r/1");
      expect(body.sourceName).toBe("Esther Clark");
    });

    it("drops a malformed value sent as sourceUrl (server contract: no URL, no name)", async () => {
      // Server-level contract: a malformed string arriving in the `sourceUrl`
      // field with no `sourceName` still normalises to null/null. The CLIENT
      // no longer sends malformed text this way (see the sourceName test
      // below) — this guards the route's own normalisation boundary.
      mockUserId.mockResolvedValue("u1");
      mockTier.mockResolvedValue("pro");
      mockOpenAi({ title: "X", ingredients: ["1 egg"], steps: [], notes: null });
      const fd = new FormData();
      fd.append("image", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "x.jpg");
      fd.append("sourceUrl", "not a url at all");
      const res = await POST(
        new Request("http://localhost/api/recipe-import/image", { method: "POST", body: fd }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { sourceUrl: string | null; sourceName: string | null };
      expect(body.sourceUrl).toBeNull();
      expect(body.sourceName).toBeNull();
    });

    // ENG-748 #13 (2026-05-27) — when the pasted attribution text can't be
    // parsed as a URL, the web + mobile clients now send it in the
    // `sourceName` field instead of `sourceUrl`, so the creator's note
    // survives as a non-linked source note rather than being silently
    // dropped (ODbL / viral-hook attribution correctness).
    it("keeps a malformed paste as a non-linked sourceName when sent that way", async () => {
      mockUserId.mockResolvedValue("u1");
      mockTier.mockResolvedValue("pro");
      mockOpenAi({ title: "X", ingredients: ["1 egg"], steps: [], notes: null });
      const fd = new FormData();
      fd.append("image", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "x.jpg");
      fd.append("sourceName", "from @nonna_kitchen on IG");
      const res = await POST(
        new Request("http://localhost/api/recipe-import/image", { method: "POST", body: fd }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { sourceUrl: string | null; sourceName: string | null };
      expect(body.sourceUrl).toBeNull();
      expect(body.sourceName).toBe("from @nonna_kitchen on IG");
    });
  });
});
