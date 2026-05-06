/**
 * Tests for the FatSecret client's Premier-tier opt-in
 * (2026-04-26 — Premier Free upgrade).
 *
 * Pins:
 *  1. fatSecretTierFromEnv() defaults to "basic" when FATSECRET_TIER is unset.
 *  2. fatSecretTierFromEnv() returns "premier" only for an exact match
 *     (case-insensitive); anything else → "basic".
 *  3. fatSecretFoodsAutocomplete() throws FatSecretTierError on Basic.
 *  4. fatSecretFoodCategoriesGet() throws FatSecretTierError on Basic.
 *  5. Premier-tier autocomplete sends method=foods.autocomplete.v2 with
 *     the trimmed query in `expression` and clamped max_results.
 *  6. Premier-tier categories sends method=food_categories.get.
 *  7. Empty query → empty array (no network call).
 *  8. OAuth2 scope string includes "premier" only when tier = premier.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FatSecretTierError,
  __resetFatSecretOAuth2CacheForTests,
  fatSecretConfigFromEnv,
  fatSecretFoodCategoriesGet,
  fatSecretFoodsAutocomplete,
  fatSecretTierFromEnv,
} from "../../src/lib/fatsecret/client";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  __resetFatSecretOAuth2CacheForTests();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

// ── tier resolution ──────────────────────────────────────────────────

describe("fatSecretTierFromEnv", () => {
  it("defaults to basic when FATSECRET_TIER is unset", () => {
    delete process.env.FATSECRET_TIER;
    expect(fatSecretTierFromEnv()).toBe("basic");
  });

  it("returns premier on exact 'premier' value", () => {
    process.env.FATSECRET_TIER = "premier";
    expect(fatSecretTierFromEnv()).toBe("premier");
  });

  it("is case-insensitive on 'PREMIER'", () => {
    process.env.FATSECRET_TIER = "PREMIER";
    expect(fatSecretTierFromEnv()).toBe("premier");
  });

  it("ignores trailing whitespace", () => {
    process.env.FATSECRET_TIER = "  premier  ";
    expect(fatSecretTierFromEnv()).toBe("premier");
  });

  it("falls back to basic for any unknown value", () => {
    process.env.FATSECRET_TIER = "enterprise";
    expect(fatSecretTierFromEnv()).toBe("basic");
  });

  it("falls back to basic on empty string", () => {
    process.env.FATSECRET_TIER = "";
    expect(fatSecretTierFromEnv()).toBe("basic");
  });
});

// ── tier-gated endpoints ─────────────────────────────────────────────

describe("Premier-only methods on Basic tier throw FatSecretTierError", () => {
  it("fatSecretFoodsAutocomplete throws on basic", async () => {
    await expect(
      fatSecretFoodsAutocomplete(
        { consumerKey: "k", consumerSecret: "s", tier: "basic" },
        "milk",
      ),
    ).rejects.toThrow(FatSecretTierError);
  });

  it("fatSecretFoodCategoriesGet throws on basic", async () => {
    await expect(
      fatSecretFoodCategoriesGet({
        consumerKey: "k",
        consumerSecret: "s",
        tier: "basic",
      }),
    ).rejects.toThrow(FatSecretTierError);
  });

  it("FatSecretTierError carries the right name", async () => {
    try {
      await fatSecretFoodsAutocomplete(
        { consumerKey: "k", consumerSecret: "s", tier: "basic" },
        "milk",
      );
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(FatSecretTierError);
      expect((e as Error).name).toBe("FatSecretTierError");
    }
  });
});

// ── Premier-tier wire format ─────────────────────────────────────────

describe("Premier-tier wire format", () => {
  /**
   * The client tries OAuth2 first. We mock fetch to fail OAuth2 (so the
   * code falls back to OAuth1 — simpler to assert the body params on)
   * and then succeed with the autocomplete response.
   */
  function mockFetchSequence(
    sequence: Array<(req: { url: string; init?: RequestInit }) => unknown>,
  ): { calls: Array<{ url: string; body?: string }> } {
    const calls: Array<{ url: string; body?: string }> = [];
    let i = 0;
    vi.spyOn(globalThis, "fetch" as never).mockImplementation(
       
      ((url: any, init?: RequestInit) => {
        const u = typeof url === "string" ? url : (url as URL).toString();
        const rawBody = init?.body;
        const body =
          typeof rawBody === "string"
            ? rawBody
            : rawBody instanceof URLSearchParams
              ? rawBody.toString()
              : undefined;
        calls.push({ url: u, body });
        const handler = sequence[i++] ?? (() => Promise.reject(new Error("unexpected fetch")));
        return Promise.resolve(handler({ url: u, init }));
      }) as never,
    );
    return { calls };
  }

  it("autocomplete sends method=foods.autocomplete.v2 with clamped max_results", async () => {
    const { calls } = mockFetchSequence([
      // OAuth2 token attempt — fail so we fall back to OAuth1 signing.
      () => ({ ok: false, status: 401, text: async () => "" }) as Response,
      // The OAuth1-signed POST returns the autocomplete payload.
      () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            suggestions: { suggestion: ["whole milk", "skim milk", "almond milk"] },
          }),
        }) as Response,
    ]);
    const result = await fatSecretFoodsAutocomplete(
      { consumerKey: "k", consumerSecret: "s", tier: "premier" },
      "  milk  ",
      { maxResults: 50 }, // > 10, must clamp to 10
    );
    expect(result).toEqual([
      { suggestion: "whole milk" },
      { suggestion: "skim milk" },
      { suggestion: "almond milk" },
    ]);
    // The last call is the API call.
    const apiCall = calls[1]!;
    expect(apiCall.body ?? "").toContain("method=foods.autocomplete.v2");
    expect(apiCall.body ?? "").toContain("expression=milk");
    expect(apiCall.body ?? "").toContain("max_results=10");
  });

  it("autocomplete handles a single-suggestion (non-array) shape", async () => {
    mockFetchSequence([
      () => ({ ok: false, status: 401, text: async () => "" }) as Response,
      () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            suggestions: { suggestion: "milk" },
          }),
        }) as Response,
    ]);
    const result = await fatSecretFoodsAutocomplete(
      { consumerKey: "k", consumerSecret: "s", tier: "premier" },
      "milk",
    );
    expect(result).toEqual([{ suggestion: "milk" }]);
  });

  it("autocomplete returns [] when query is empty, no fetch issued", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch" as never).mockImplementation(
       
      (() => Promise.reject(new Error("should not have called fetch"))) as never,
    );
    const result = await fatSecretFoodsAutocomplete(
      { consumerKey: "k", consumerSecret: "s", tier: "premier" },
      "   ",
    );
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("categories sends method=food_categories.get and parses array shape", async () => {
    const { calls } = mockFetchSequence([
      () => ({ ok: false, status: 401, text: async () => "" }) as Response,
      () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            food_categories: {
              food_category: [
                { food_category_id: "1", food_category_name: "Beverages" },
                { food_category_id: "2", food_category_name: "Cereal" },
              ],
            },
          }),
        }) as Response,
    ]);
    const result = await fatSecretFoodCategoriesGet({
      consumerKey: "k",
      consumerSecret: "s",
      tier: "premier",
    });
    expect(result).toEqual([
      { food_category_id: "1", food_category_name: "Beverages" },
      { food_category_id: "2", food_category_name: "Cereal" },
    ]);
    expect(calls[1]?.body ?? "").toContain("method=food_categories.get");
  });
});

// ── OAuth2 scope behaviour ───────────────────────────────────────────

describe("OAuth2 scope flag for Premier tier", () => {
  it("Premier requests 'basic premier' scope; Basic requests 'basic'", async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, "fetch" as never).mockImplementation(
       
      ((url: any, init?: RequestInit) => {
        const u = typeof url === "string" ? url : (url as URL).toString();
        if (u.includes("oauth.fatsecret.com/connect/token")) {
          const rawBody = init?.body;
          const body =
            typeof rawBody === "string"
              ? rawBody
              : rawBody instanceof URLSearchParams
                ? rawBody.toString()
                : "";
          calls.push(body);
          // Force OAuth2 to fail so the test doesn't continue into the
          // signed POST. We only care about the body of the token call.
          return Promise.resolve({ ok: false, status: 401, text: async () => "" } as Response);
        }
        // The OAuth1 fallback POST — return an empty payload to short-circuit.
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ suggestions: { suggestion: [] } }),
        } as Response);
      }) as never,
    );
    await fatSecretFoodsAutocomplete(
      { consumerKey: "k", consumerSecret: "s", tier: "premier" },
      "milk",
    );
    expect(calls.at(-1) ?? "").toContain("scope=basic+premier");
    __resetFatSecretOAuth2CacheForTests();
    // Run a Basic-tier call via foods.search (allowed on Basic).
    // We use fatSecretConfigFromEnv() so the scope branch in
    // getOAuth2Token sees tier="basic".
    process.env.FATSECRET_CONSUMER_KEY = "k";
    process.env.FATSECRET_CONSUMER_SECRET = "s";
    delete process.env.FATSECRET_TIER;
    const cfg = fatSecretConfigFromEnv();
    expect(cfg.tier).toBe("basic");
    // Re-resolve a token by issuing any call (here, a foods.search-shape
    // OAuth1 call still triggers the token attempt first).
    const { fatSecretFoodSearch } = await import("../../src/lib/fatsecret/client");
    await fatSecretFoodSearch(cfg, "milk").catch(() => {
      // Ignore — we only care about the token body the spy captured.
    });
    expect(calls.at(-1) ?? "").toContain("scope=basic");
    expect(calls.at(-1) ?? "").not.toContain("premier");
  });
});
