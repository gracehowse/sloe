/**
 * ENG-717 — FatSecret OAuth token cold-start race guard.
 *
 * On a cold cache, a recipe-verify fan-out fires several FatSecret calls at
 * once. Without a guard each one races its own token fetch. These tests pin
 * the promise-singleton behaviour:
 *
 *  1. N concurrent cold callers trigger exactly ONE token fetch (the rest
 *     piggyback on the in-flight promise).
 *  2. After the token resolves, a later call reuses the cached token — still
 *     one token fetch total.
 *  3. A FAILED token fetch clears the in-flight cache so the NEXT call
 *     retries (the failure doesn't poison subsequent calls).
 *
 * The token fetch is internal (`getOAuth2Token`), so we drive it through the
 * public `fatSecretFoodSearch` entry point and count hits to the token URL
 * on the mocked `fetch`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetFatSecretOAuth2CacheForTests,
  fatSecretFoodSearch,
  type FatSecretConfig,
} from "../../src/lib/fatsecret/client";

const TOKEN_URL = "oauth.fatsecret.com/connect/token";
const CFG: FatSecretConfig = { consumerKey: "k", consumerSecret: "s", tier: "basic" };

beforeEach(() => {
  __resetFatSecretOAuth2CacheForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Mock fetch:
 *  - token URL → resolves (after a microtask) with a short-lived bearer,
 *    counting each call. `tokenOk=false` makes the token endpoint 401 so we
 *    can exercise the failure path.
 *  - API URL → returns an empty foods.search payload.
 */
function installFetchMock(opts: { tokenOk: boolean }): { tokenCalls: () => number } {
  let tokenCalls = 0;
  vi.spyOn(globalThis, "fetch" as never).mockImplementation((async (url: unknown) => {
    const u = typeof url === "string" ? url : (url as URL).toString();
    if (u.includes(TOKEN_URL)) {
      tokenCalls++;
      // Yield a microtask so concurrent callers all observe the same
      // in-flight promise before it settles (the race window).
      await Promise.resolve();
      if (!opts.tokenOk) {
        return { ok: false, status: 401, text: async () => "" } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok-123", expires_in: 3600 }),
      } as Response;
    }
    // API call (Bearer or OAuth1 fallback) — empty result set.
    return {
      ok: true,
      status: 200,
      json: async () => ({ foods: { food: [], total_results: "0" } }),
    } as Response;
  }) as never);
  return { tokenCalls: () => tokenCalls };
}

describe("FatSecret OAuth token promise-singleton", () => {
  it("N concurrent cold callers trigger exactly ONE token fetch", async () => {
    const { tokenCalls } = installFetchMock({ tokenOk: true });

    // 8 concurrent cold callers.
    await Promise.all(
      Array.from({ length: 8 }, () => fatSecretFoodSearch(CFG, "milk")),
    );

    expect(tokenCalls()).toBe(1);
  });

  it("reuses the cached token on a later call — still one token fetch", async () => {
    const { tokenCalls } = installFetchMock({ tokenOk: true });

    await Promise.all(Array.from({ length: 4 }, () => fatSecretFoodSearch(CFG, "milk")));
    // A later, sequential call should hit the warm cache, not re-fetch.
    await fatSecretFoodSearch(CFG, "eggs");

    expect(tokenCalls()).toBe(1);
  });

  it("a failed token fetch clears the cache so the next call retries", async () => {
    // First wave: token endpoint 401s. The client falls back to OAuth1
    // signing (which we let "succeed" with an empty payload), but no token
    // is cached. Each concurrent caller in this wave still shares ONE
    // in-flight token fetch.
    const failing = installFetchMock({ tokenOk: false });
    await Promise.all(Array.from({ length: 3 }, () => fatSecretFoodSearch(CFG, "milk")));
    expect(failing.tokenCalls()).toBe(1);

    // Swap in a healthy token endpoint. Because the prior failure cleared
    // the in-flight singleton (and never populated oauth2Cache), the next
    // call must issue a FRESH token fetch rather than reusing a dead one.
    vi.restoreAllMocks();
    const healthy = installFetchMock({ tokenOk: true });
    await fatSecretFoodSearch(CFG, "milk");
    expect(healthy.tokenCalls()).toBe(1);
  });
});
