/**
 * Lane-A wire-up regression pin (2026-04-30) — `/api/fatsecret/search`.
 *
 * Pre-Lane-A, Premier Free credentials were valid in production but the
 * search route did not exist; the food-search merge pipeline therefore
 * never carried FatSecret hits and every branded query ("Big Mac",
 * "Starbucks grande latte", "Trader Joe's …") surfaced as USDA-only.
 * This file pins:
 *
 *   1. Empty query → 400 `missing_q`.
 *   2. Unauth'd request → 401.
 *   3. Missing FatSecret creds → 503 server_misconfigured.
 *   4. Successful search returns the SearchResult-compatible envelope
 *      (`{ ok, hits, page }`) with `foodId / label / brand / macrosPer100g
 *      / servingLabel / servingGrams / macrosPerServing`.
 *   5. Per-100g description rows surface with macrosPer100g populated
 *      and macrosPerServing null.
 *   6. Per-serving description rows surface with macrosPer100g null and
 *      macrosPerServing populated (we never invent per-100g values).
 *   7. Upstream FatSecret failure is swallowed: returns 200 with empty
 *      `hits` so the merge keeps the other three sources rendering.
 *   8. Pagination — `?page=2` is mapped to FatSecret's 0-indexed
 *      `page_number=1`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fatSecretFoodSearchMock = vi.fn();

vi.mock("@/lib/fatsecret/client", () => ({
  fatSecretConfigFromEnv: () => ({
    consumerKey: "k",
    consumerSecret: "s",
    tier: "premier" as const,
  }),
  fatSecretFoodSearch: (
    cfg: unknown,
    query: string,
    opts?: { maxResults?: number; pageNumber?: number },
  ) => fatSecretFoodSearchMock(cfg, query, opts),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true })),
}));

const getUserIdFromRequestMock = vi.fn();
vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: (req: Request) => getUserIdFromRequestMock(req),
}));

async function loadRoute() {
  const mod = await import("../../app/api/fatsecret/search/route");
  return mod.GET;
}

function makeReq(url: string): Request {
  return new Request(url, {
    method: "GET",
    headers: {
      authorization: "Bearer test-token",
    },
  });
}

beforeEach(() => {
  vi.stubEnv("FATSECRET_CONSUMER_KEY", "k");
  vi.stubEnv("FATSECRET_CONSUMER_SECRET", "s");
  getUserIdFromRequestMock.mockResolvedValue("user-1");
  fatSecretFoodSearchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("/api/fatsecret/search — auth + validation", () => {
  it("returns 401 when no userId resolved", async () => {
    getUserIdFromRequestMock.mockResolvedValueOnce(null);
    const GET = await loadRoute();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=milk"));
    expect(res.status).toBe(401);
  });

  it("returns 400 missing_q on empty query", async () => {
    const GET = await loadRoute();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q="));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: "missing_q" });
  });

  it("returns 503 when FatSecret creds are missing", async () => {
    vi.unstubAllEnvs();
    const GET = await loadRoute();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=milk"));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: "server_misconfigured" });
  });

  it("accepts canonical OAuth 2.0 env names (FATSECRET_CLIENT_ID/CLIENT_SECRET) without legacy ones", async () => {
    // 2026-05-06 — pin the env-var rename. After dropping the legacy
    // OAuth 1.0a-era CONSUMER_KEY/SECRET names, only the OAuth 2.0
    // CLIENT_ID/CLIENT_SECRET pair must satisfy `hasFatSecretConfig()`.
    vi.unstubAllEnvs();
    vi.stubEnv("FATSECRET_CLIENT_ID", "k");
    vi.stubEnv("FATSECRET_CLIENT_SECRET", "s");
    fatSecretFoodSearchMock.mockResolvedValueOnce([]);
    const GET = await loadRoute();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=milk"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, hits: [], page: 1 });
  });
});

describe("/api/fatsecret/search — result mapping", () => {
  it("maps a per-100g row: macrosPer100g populated, macrosPerServing null", async () => {
    fatSecretFoodSearchMock.mockResolvedValueOnce([
      {
        food_id: "1234",
        food_name: "Salmon, raw",
        brand_name: "",
        food_description: "Per 100g - Calories: 208kcal | Fat: 13.40g | Carbs: 0.00g | Protein: 20.00g",
      },
    ]);
    const GET = await loadRoute();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=salmon"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.hits)).toBe(true);
    expect(json.hits).toHaveLength(1);
    const h = json.hits[0]!;
    expect(h.foodId).toBe("1234");
    expect(h.label).toBe("Salmon, raw");
    expect(h.brand).toBeNull();
    expect(h.macrosPer100g).toEqual({
      calories: 208,
      protein: 20,
      carbs: 0,
      fat: 13.4,
    });
    expect(h.macrosPerServing).toBeNull();
    expect(h.servingLabel).toBe("100g");
  });

  it("maps a per-serving row: macrosPer100g null, macrosPerServing populated", async () => {
    fatSecretFoodSearchMock.mockResolvedValueOnce([
      {
        food_id: "5678",
        food_name: "Big Mac",
        brand_name: "McDonald's",
        food_description: "Per 1 sandwich (240g) - Calories: 540kcal | Fat: 28.00g | Carbs: 45.00g | Protein: 25.00g",
      },
    ]);
    const GET = await loadRoute();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=big+mac"));
    expect(res.status).toBe(200);
    const json = await res.json();
    const h = json.hits[0]!;
    expect(h.foodId).toBe("5678");
    expect(h.label).toBe("McDonald's · Big Mac");
    expect(h.brand).toBe("McDonald's");
    expect(h.macrosPer100g).toBeNull();
    expect(h.macrosPerServing).toEqual({
      calories: 540,
      protein: 25,
      carbs: 45,
      fat: 28,
    });
    expect(h.servingLabel).toBe("1 sandwich (240g)");
    expect(h.servingGrams).toBe(240);
  });

  it("returns empty hits when FatSecret returns no rows", async () => {
    fatSecretFoodSearchMock.mockResolvedValueOnce([]);
    const GET = await loadRoute();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=zzzznotafood"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, hits: [], page: 1 });
  });

  it("swallows upstream errors — returns 200 with empty hits so the merge stays alive", async () => {
    fatSecretFoodSearchMock.mockRejectedValueOnce(new Error("FatSecret HTTP 502"));
    const GET = await loadRoute();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=milk"));
    expect(res.status).toBe(200);
    const json = await res.json();
    // 2026-05-06 (Grace) — empty fallback now also echoes a `_diag`
    // field carrying the upstream error so the mobile / web client
    // diagnostic surfaces the cause without chasing Vercel runtime
    // logs. Pin both the contract (ok+empty) and the diag shape.
    expect(json.ok).toBe(true);
    expect(json.hits).toEqual([]);
    expect(json.page).toBe(1);
    expect(json._diag).toEqual({
      upstream: "failed",
      message: "FatSecret HTTP 502",
    });
  });

  it("skips placeholder rows where every macro is zero", async () => {
    fatSecretFoodSearchMock.mockResolvedValueOnce([
      {
        food_id: "stub",
        food_name: "Olive Oil (placeholder)",
        food_description: "Per 100g - Calories: 0kcal | Fat: 0.00g | Carbs: 0.00g | Protein: 0.00g",
      },
    ]);
    const GET = await loadRoute();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=olive+oil"));
    const json = await res.json();
    // The row is still returned (so the user can tap to land the
    // canonical detail panel), but with `macrosPer100g: null` because
    // the inline envelope was unusable.
    expect(json.hits[0]!.macrosPer100g).toBeNull();
    expect(json.hits[0]!.macrosPerServing).toBeNull();
  });
});

describe("/api/fatsecret/search — pagination", () => {
  it("maps 1-indexed page param to FatSecret's 0-indexed page_number", async () => {
    fatSecretFoodSearchMock.mockResolvedValueOnce([]);
    const GET = await loadRoute();
    await GET(makeReq("http://localhost/api/fatsecret/search?q=milk&page=2"));
    expect(fatSecretFoodSearchMock).toHaveBeenCalledWith(
      expect.anything(),
      "milk",
      expect.objectContaining({ pageNumber: 1, maxResults: 25 }),
    );
  });

  it("defaults to page 1 (FatSecret page_number=0) when page is omitted", async () => {
    fatSecretFoodSearchMock.mockResolvedValueOnce([]);
    const GET = await loadRoute();
    await GET(makeReq("http://localhost/api/fatsecret/search?q=milk"));
    expect(fatSecretFoodSearchMock).toHaveBeenCalledWith(
      expect.anything(),
      "milk",
      expect.objectContaining({ pageNumber: 0 }),
    );
  });
});

describe("parseFatSecretFoodDescription — edge cases", () => {
  it("returns null on missing description", async () => {
    const { parseFatSecretFoodDescription } = await import(
      "../../src/lib/fatsecret/parseFoodDescription"
    );
    expect(parseFatSecretFoodDescription(null)).toBeNull();
    expect(parseFatSecretFoodDescription(undefined)).toBeNull();
    expect(parseFatSecretFoodDescription("")).toBeNull();
  });

  it("returns null on a non-FatSecret string", async () => {
    const { parseFatSecretFoodDescription } = await import(
      "../../src/lib/fatsecret/parseFoodDescription"
    );
    expect(parseFatSecretFoodDescription("Just a brand name with no macros")).toBeNull();
  });

  it("parses per-100g description", async () => {
    const { parseFatSecretFoodDescription } = await import(
      "../../src/lib/fatsecret/parseFoodDescription"
    );
    const r = parseFatSecretFoodDescription(
      "Per 100g - Calories: 240kcal | Fat: 11.10g | Carbs: 31.20g | Protein: 4.60g",
    );
    expect(r).toEqual({
      basis: "100g",
      servingLabel: "100g",
      servingGrams: null,
      calories: 240,
      protein: 4.6,
      carbs: 31.2,
      fat: 11.1,
    });
  });

  it("parses per-serving description with embedded grams", async () => {
    const { parseFatSecretFoodDescription } = await import(
      "../../src/lib/fatsecret/parseFoodDescription"
    );
    const r = parseFatSecretFoodDescription(
      "Per 1 sandwich (240g) - Calories: 540kcal | Fat: 28.00g | Carbs: 45.00g | Protein: 25.00g",
    );
    expect(r?.basis).toBe("serving");
    expect(r?.servingGrams).toBe(240);
    expect(r?.calories).toBe(540);
  });

  it("parses 'Carbohydrate' spelling variant", async () => {
    const { parseFatSecretFoodDescription } = await import(
      "../../src/lib/fatsecret/parseFoodDescription"
    );
    const r = parseFatSecretFoodDescription(
      "Per 100g - Calories: 100kcal | Fat: 1.00g | Carbohydrate: 20.00g | Protein: 5.00g",
    );
    expect(r?.carbs).toBe(20);
  });
});
