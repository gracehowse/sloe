/**
 * @vitest-environment node
 *
 * Integration tests for the Supadata acquisition wiring (ENG-994) in
 * POST /api/recipe-import. Proves the `supadata-acquisition` flag gate + the
 * graceful-fallback contract end-to-end through the route, with NO live calls:
 *   - fetch is stubbed (`vi.stubGlobal`)
 *   - the acquisition adapter is swapped for a stub (`setAcquisitionAdapter`)
 *   - the server feature flag is mocked
 *
 * Behaviour pins:
 *   - flag ON + Supadata acquires a JSON-LD recipe → route uses Supadata
 *     content (the live page fetch is NOT performed)
 *   - flag ON + Supadata fails (e.g. 429) → route falls back to the existing
 *     live-fetch + parse path (old path alive in the else); request still
 *     succeeds from the live HTML
 *   - flag OFF → Supadata adapter is never consulted; existing path runs
 *
 * Node environment so `vi.stubGlobal("fetch", …)` replaces the same `fetch`
 * the route handler invokes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(async () => "user-123"),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

// Disable external nutrition providers so verifyIngredients stays offline.
vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => false,
  hasFatSecretConfig: () => false,
  hasEdamamConfig: () => false,
  hasSupabaseServiceConfig: () => false,
}));

// Mock the server feature-flag check so we drive the `supadata-acquisition`
// (and `kill_recipe_import`) flags deterministically.
const flagState: Record<string, boolean> = {};
vi.mock("@/lib/server/featureFlags", () => ({
  isServerFeatureEnabled: vi.fn(async (flag: string) => flagState[flag] ?? false),
}));

import { POST } from "../../app/api/recipe-import/route";
import {
  setAcquisitionAdapter,
  resetAcquisitionAdapter,
  type AcquisitionAdapter,
} from "@/lib/server/supadata/acquisitionAdapter";

const JSON_LD_RECIPE = `<html><head><script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Supadata Test Cake",
  recipeIngredient: ["200g flour", "2 eggs"],
  recipeInstructions: ["Mix", "Bake"],
  recipeYield: "4",
})}</script></head><body>Cake</body></html>`;

function makeReq(url: string): Request {
  return new Request("http://localhost/api/recipe-import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

/** A stub adapter that returns the JSON-LD HTML as scraped content. */
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
        title: "Supadata Test Cake",
        description: null,
        image: null,
      },
    })),
  };
}

/** A stub adapter that always fails (rate-limited) so the route must fall back. */
function rateLimitedAdapter(): AcquisitionAdapter {
  return {
    name: "supadata",
    isConfigured: () => true,
    acquire: vi.fn(async () => ({
      ok: false as const,
      reason: "rate_limited" as const,
      retryAfterSec: 60,
      detail: "quota exhausted",
    })),
  };
}

describe("POST /api/recipe-import — Supadata acquisition wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(flagState)) delete flagState[k];
    resetAcquisitionAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAcquisitionAdapter();
  });

  it("flag ON + Supadata acquires → uses Supadata content, skips live page fetch", async () => {
    flagState["supadata-acquisition"] = true;
    setAcquisitionAdapter(scrapeAdapter(JSON_LD_RECIPE));
    const RECIPE_URL = "https://smittenkitchen.com/cake";
    // `fetch` is still invoked downstream by nutrition providers + PostHog, so
    // we assert the PAGE URL was never fetched (not total call count). A
    // non-page fetch resolves benignly so the route can complete.
    const liveFetch = vi.fn(async (input: unknown) => {
      const u = typeof input === "string" ? input : String((input as Request)?.url ?? "");
      if (u.includes("smittenkitchen.com")) {
        throw new Error("live page fetch must NOT run when Supadata acquired content");
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

    const res = await POST(makeReq(RECIPE_URL));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.recipe.title).toBe("Supadata Test Cake");
    expect(body.recipe.ingredients).toEqual(["200g flour", "2 eggs"]);
    // The live page fetch (to the recipe URL) was never invoked.
    const pageFetched = liveFetch.mock.calls.some((c) => String(c[0]).includes("smittenkitchen.com"));
    expect(pageFetched).toBe(false);
  });

  it("flag ON + Supadata rate-limited → falls back to existing live-fetch path", async () => {
    flagState["supadata-acquisition"] = true;
    setAcquisitionAdapter(rateLimitedAdapter());
    const liveFetch = vi.fn(async () => ({
      status: 200,
      ok: true,
      headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "text/html" : null) },
      text: async () => JSON_LD_RECIPE,
    }));
    vi.stubGlobal("fetch", liveFetch as unknown as typeof fetch);

    const res = await POST(makeReq("https://smittenkitchen.com/cake"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.recipe.title).toBe("Supadata Test Cake");
    // The fallback path performed the live PAGE fetch.
    const pageFetched = liveFetch.mock.calls.some((c) => String(c[0]).includes("smittenkitchen.com"));
    expect(pageFetched).toBe(true);
  });

  it("flag OFF → Supadata adapter is never consulted; existing path runs", async () => {
    flagState["supadata-acquisition"] = false;
    const adapter = scrapeAdapter(JSON_LD_RECIPE);
    setAcquisitionAdapter(adapter);
    const liveFetch = vi.fn(async () => ({
      status: 200,
      ok: true,
      headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "text/html" : null) },
      text: async () => JSON_LD_RECIPE,
    }));
    vi.stubGlobal("fetch", liveFetch as unknown as typeof fetch);

    const res = await POST(makeReq("https://smittenkitchen.com/cake"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(adapter.acquire).not.toHaveBeenCalled(); // flag gated it off
    const pageFetched = liveFetch.mock.calls.some((c) => String(c[0]).includes("smittenkitchen.com"));
    expect(pageFetched).toBe(true);
  });
});
