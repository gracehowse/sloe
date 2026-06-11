/**
 * @vitest-environment node
 *
 * ENG-1055 — when the honest SupprBot direct fetch is bot-blocked (402/403),
 * the route falls back to Supadata scrape (vendor egress) before fetch_failed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(async () => "user-123"),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => false,
  hasFatSecretConfig: () => false,
  hasEdamamConfig: () => false,
  hasSupabaseServiceConfig: () => false,
}));

vi.mock("@/lib/server/featureFlags", () => ({
  isServerFeatureEnabled: vi.fn(async () => false),
}));

vi.mock("@/lib/server/supadata/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/supadata/client")>();
  return {
    ...actual,
    hasSupadataConfig: vi.fn(() => true),
  };
});

import { POST } from "../../app/api/recipe-import/route";
import {
  setAcquisitionAdapter,
  resetAcquisitionAdapter,
  type AcquisitionAdapter,
} from "@/lib/server/supadata/acquisitionAdapter";

const JSON_LD_RECIPE = `<html><head><script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Bot-Block Fallback Cake",
  recipeIngredient: ["200g flour", "2 eggs"],
  recipeInstructions: ["Mix", "Bake"],
  recipeYield: "4",
})}</script></head><body>Cake</body></html>`;

const BLOCKED_URL = "https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/";

function makeReq(url: string): Request {
  return new Request("http://localhost/api/recipe-import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

function scrapeAdapter(content: string): AcquisitionAdapter {
  return {
    name: "supadata",
    isConfigured: () => true,
    acquire: vi.fn(async () => ({
      ok: true as const,
      data: {
        content,
        source: "supadata" as const,
        kind: "scrape" as const,
        platform: "blog" as const,
        title: "Bot-Block Fallback Cake",
        description: null,
        image: null,
      },
    })),
  };
}

describe("POST /api/recipe-import — ENG-1055 bot-block Supadata fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAcquisitionAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAcquisitionAdapter();
  });

  it("returns a recipe via Supadata when the direct page fetch is 402", async () => {
    setAcquisitionAdapter(scrapeAdapter(JSON_LD_RECIPE));
    const liveFetch = vi.fn(async (input: unknown) => {
      const u = typeof input === "string" ? input : String((input as Request)?.url ?? "");
      if (u.includes("allrecipes.com")) {
        return {
          status: 402,
          ok: false,
          headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "text/html" : null) },
          text: async () => "<html><body>blocked</body></html>",
        };
      }
      return {
        status: 200,
        ok: true,
        headers: { get: () => null },
        json: async () => ({}),
        text: async () => "",
      } as unknown as Response;
    });
    vi.stubGlobal("fetch", liveFetch as unknown as typeof fetch);

    const res = await POST(makeReq(BLOCKED_URL));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.recipe.title).toBe("Bot-Block Fallback Cake");
    expect(body.recipe.ingredients).toEqual(["200g flour", "2 eggs"]);
  });
});
