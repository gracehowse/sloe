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

import { POST } from "../../app/api/recipe-import/image/route";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockTier = getUserTier as ReturnType<typeof vi.fn>;

describe("POST /api/recipe-import/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      title: "Test soup",
      ingredients: ["200 g chicken breast", "1 tbsp olive oil"],
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
});
