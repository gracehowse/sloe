/**
 * ENG-1038 / P1-3 — graceful-degradation flag propagation through the mobile
 * food-search clients (`searchUsda` / `searchEdamam` / `searchFatSecret`).
 *
 * When a vendor's account-wide quota is exhausted, its `/api/{vendor}/search`
 * route SKIPS the live call and returns `{ ok: true, hits: [], degraded: true,
 * degradedReason: "quota_exhausted" }`. The mobile clients must surface that
 * via their `onDegraded` callback so `FoodSearchPanel` can show an honest
 * "showing saved results" notice instead of a silent blank.
 *
 * These drive the REAL client functions with a mocked `authedFetch`, proving:
 *   - a `degraded: true` envelope fires `onDegraded` (and returns [] hits);
 *   - a normal envelope does NOT fire it;
 *   - the locale param is appended to the request URL (cache partitioning).
 *
 * Mirrors the network-mocking idiom in `edamamMicrosCommit.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { extra: { supprApiUrl: "https://api.suppr-club.test" } },
    manifest: null,
    manifest2: null,
    platform: { ios: { model: "simulator" } },
  },
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    from: () => ({}),
  },
}));

vi.mock("../../lib/authedFetch", () => ({
  authedFetch: vi.fn(),
}));

/* eslint-disable import/first -- deferred until after the vi.mock calls above */
import { searchUsda, searchEdamam, searchFatSecret } from "../../lib/verifyRecipe";
import { authedFetch } from "../../lib/authedFetch";
/* eslint-enable import/first */

const mockedFetch = authedFetch as ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mockedFetch.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ENG-1038 — degraded flag propagation (mobile clients)", () => {
  it("searchUsda fires onDegraded on a quota-exhausted envelope and returns []", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, hits: [], page: 1, degraded: true, degradedReason: "quota_exhausted" }),
    );
    const onDegraded = vi.fn();
    const rows = await searchUsda("chicken", { onDegraded });
    expect(onDegraded).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([]);
  });

  it("searchUsda does NOT fire onDegraded on a normal (non-degraded) response", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, hits: [{ fdcId: 1, description: "Chicken breast" }], page: 1 }),
    );
    const onDegraded = vi.fn();
    const rows = await searchUsda("chicken", { onDegraded });
    expect(onDegraded).not.toHaveBeenCalled();
    expect(rows.length).toBe(1);
  });

  it("searchEdamam fires onDegraded on a quota-exhausted envelope", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, mode: "foods", hits: [], page: 1, degraded: true, degradedReason: "quota_exhausted" }),
    );
    const onDegraded = vi.fn();
    const rows = await searchEdamam("egg", { onDegraded });
    expect(onDegraded).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([]);
  });

  it("searchFatSecret fires onDegraded on a quota-exhausted envelope", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, hits: [], page: 1, degraded: true, degradedReason: "quota_exhausted" }),
    );
    const onDegraded = vi.fn();
    const rows = await searchFatSecret("salmon", { onDegraded });
    expect(onDegraded).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([]);
  });

  it("appends a locale param to the request URL (cache partitioning)", async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse({ ok: true, hits: [], page: 1 }));
    await searchUsda("chicken");
    const calledUrl = String(mockedFetch.mock.calls[0]?.[0] ?? "");
    expect(calledUrl).toContain("/api/usda/search?q=chicken");
    // Hermes Intl in the test env resolves to a locale → a locale param is
    // appended. We assert the param key is present (value is env-dependent).
    expect(calledUrl).toMatch(/&locale=/);
  });
});
