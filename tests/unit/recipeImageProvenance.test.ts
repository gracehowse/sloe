import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();
const maybeSingleMock = vi.fn();
const eqMock = vi.fn();

vi.mock("@/lib/api/assertOrigin", () => ({ assertOrigin: () => null }));
vi.mock("@/lib/server/featureFlags", () => ({ isServerFeatureEnabled: vi.fn(async () => false) }));
vi.mock("@/lib/server/rateLimit", () => ({ rateLimit: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(async () => "user-1"),
  getUserTier: vi.fn(async () => "pro"),
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
    maybeSingleMock.mockResolvedValue({
      data: { id: "recipe-1", title: "Pasta", author_id: "user-1", image_url: null },
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
});
