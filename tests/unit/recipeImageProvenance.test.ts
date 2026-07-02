import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();
const maybeSingleMock = vi.fn();
const eqMock = vi.fn();
const getUserTierMock = vi.fn(async () => "pro");

vi.mock("@/lib/api/assertOrigin", () => ({ assertOrigin: () => null }));
vi.mock("@/lib/server/featureFlags", () => ({ isServerFeatureEnabled: vi.fn(async () => false) }));
vi.mock("@/lib/server/rateLimit", () => ({ rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })) }));
vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(async () => "user-1"),
  getUserTier: (...args: unknown[]) => getUserTierMock(...args),
}));
vi.mock("@/lib/observability/captureRouteError", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/server/falImageGenerator", () => ({
  FAL_IMAGE_MODEL: "fal-ai/test-model",
  isFalConfigured: vi.fn(() => true),
  generateDishImage: vi.fn(async () => ({ ok: true, url: "https://cdn.example.com/hero.webp", requestId: "req-1" })),
}));
vi.mock("@/lib/supabase/serverAdminClient", () => ({
  getSupabaseAdminClient: () => ({
    from: vi.fn((table: string) => {
      expect(table).toBe("recipes");
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: maybeSingleMock,
          })),
        })),
        update: updateMock,
      };
    }),
  }),
}));

import { POST } from "../../app/api/recipe-import/image-hero/route";

describe("recipe image provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserTierMock.mockResolvedValue("pro");
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "recipe-1",
        title: "Pasta",
        author_id: "user-1",
        image_url: null,
        image_source: null,
        published: false,
      },
      error: null,
    });
    eqMock.mockReturnValue({ eq: eqMock });
    updateMock.mockReturnValue({ eq: eqMock });
  });

  it("writes provenance fields when a generated hero is saved", async () => {
    const response = await POST(
      new Request("https://suppr.test/api/recipe-import/image-hero", {
        method: "POST",
        body: JSON.stringify({ recipeId: "recipe-1", title: "Pasta", ingredients: ["tomato"] }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ ok: true, url: "https://cdn.example.com/hero.webp" });
    expect(updateMock).toHaveBeenCalledWith({
      image_url: "https://cdn.example.com/hero.webp",
      image_source: "ai_generated",
      image_model: "fal-ai/test-model",
      image_generated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("allows free-tier first base generation (ENG-865)", async () => {
    getUserTierMock.mockResolvedValue("free");
    const response = await POST(
      new Request("https://suppr.test/api/recipe-import/image-hero", {
        method: "POST",
        body: JSON.stringify({ recipeId: "recipe-1", title: "Pasta", ingredients: ["tomato"], preview: true }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, preview: true });
  });

  it("returns pro_required when a free user regenerates an existing Sloe hero", async () => {
    getUserTierMock.mockResolvedValue("free");
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "recipe-1",
        title: "Pasta",
        author_id: "user-1",
        image_url: "https://cdn.example.com/old.webp",
        image_source: "ai_generated",
        published: false,
      },
      error: null,
    });
    const response = await POST(
      new Request("https://suppr.test/api/recipe-import/image-hero", {
        method: "POST",
        body: JSON.stringify({
          recipeId: "recipe-1",
          title: "Pasta",
          ingredients: ["tomato"],
          preview: true,
          regenerate: true,
        }),
      }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "pro_required" });
  });
});
