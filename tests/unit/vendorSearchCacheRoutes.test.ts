/**
 * ENG-1038 / P1-3 — route-level wiring of the cross-request vendor cache +
 * account-level quota guard into `/api/usda/search`, `/api/edamam/search`,
 * `/api/fatsecret/search`.
 *
 * What these tests pin (per route):
 *   1. CACHE HIT  → serve cached hits, NO vendor call, NO quota spend,
 *      envelope carries `cached: true`.
 *   2. QUOTA EXHAUSTED → skip the vendor, return a DEGRADED envelope
 *      (`degraded: true, degradedReason: "quota_exhausted"`), NO vendor call.
 *      This is the graceful-degradation contract the clients consume.
 *   3. CACHE MISS + QUOTA OK → call the vendor, consume one quota unit, and
 *      CACHE the successful response (never an error/degraded — pinned by the
 *      "do not cache an upstream failure" case on Edamam/FatSecret).
 *   4. UPSTREAM FAILURE is NOT cached (Edamam/FatSecret swallow to ok+empty;
 *      OFF degrades honestly to a 200 `degraded` envelope — audit P2 #6;
 *      `setCachedSearch` must NOT be called on any failure path).
 *
 * The cache module is mocked so each route's branch logic is asserted in
 * isolation, with no Redis and no live vendor calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Cache-module mock (shared across all three routes) ───────────────────
const getCachedSearchMock = vi.fn();
const setCachedSearchMock = vi.fn();
const checkQuotaMock = vi.fn();
const consumeQuotaMock = vi.fn();

vi.mock("@/lib/server/vendorSearchCache", () => ({
  getCachedSearch: (...a: unknown[]) => getCachedSearchMock(...a),
  setCachedSearch: (...a: unknown[]) => setCachedSearchMock(...a),
  checkQuota: (...a: unknown[]) => checkQuotaMock(...a),
  consumeQuota: (...a: unknown[]) => consumeQuotaMock(...a),
}));

// ── Vendor-client mocks ───────────────────────────────────────────────────
const fdcFoodsSearchMock = vi.fn();
vi.mock("@/lib/usda/fdcClient", () => ({
  fdcConfigFromEnv: () => ({ apiKey: "k" }),
  fdcFoodsSearch: (...a: unknown[]) => fdcFoodsSearchMock(...a),
}));

const edamamFoodSearchMock = vi.fn();
vi.mock("@/lib/edamam/client", () => ({
  edamamConfigFromEnv: () => ({ appId: "id", appKey: "key" }),
  edamamFoodSearch: (...a: unknown[]) => edamamFoodSearchMock(...a),
  edamamFoodMacrosPer100g: () => ({ calories: 100, protein: 5, carbs: 10, fat: 2, fiberG: 1, sugarG: 1, sodiumMg: 10 }),
  edamamFoodMicrosPer100g: () => ({}),
}));

const fatSecretFoodSearchMock = vi.fn();
vi.mock("@/lib/fatsecret/client", () => ({
  fatSecretConfigFromEnv: () => ({ consumerKey: "k", consumerSecret: "s", tier: "premier" as const }),
  fatSecretFoodSearch: (...a: unknown[]) => fatSecretFoodSearchMock(...a),
}));

const searchOffProductsMock = vi.fn();
vi.mock("@/lib/openFoodFacts/searchProducts", () => ({
  searchOffProducts: (...a: unknown[]) => searchOffProductsMock(...a),
}));

// ── Shared route plumbing mocks ───────────────────────────────────────────
vi.mock("@/lib/server/rateLimit", () => ({ rateLimit: vi.fn(async () => ({ ok: true })) }));

const getUserIdFromRequestMock = vi.fn();
vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: (req: Request) => getUserIdFromRequestMock(req),
}));

vi.mock("@/lib/observability/captureRouteError", () => ({ captureRouteError: vi.fn() }));

function makeReq(url: string): Request {
  return new Request(url, { method: "GET", headers: { authorization: "Bearer t" } });
}

beforeEach(() => {
  // Env so each route's misconfig guard passes.
  vi.stubEnv("USDA_FDC_API_KEY", "k");
  vi.stubEnv("EDAMAM_APP_ID", "id");
  vi.stubEnv("EDAMAM_APP_KEY", "key");
  vi.stubEnv("FATSECRET_CLIENT_ID", "k");
  vi.stubEnv("FATSECRET_CLIENT_SECRET", "s");
  getUserIdFromRequestMock.mockResolvedValue("user-1");

  // Default: cold cache, quota healthy.
  getCachedSearchMock.mockResolvedValue(null);
  setCachedSearchMock.mockResolvedValue(undefined);
  checkQuotaMock.mockResolvedValue({ allowed: true, used: 0, cap: 1000 });
  consumeQuotaMock.mockResolvedValue({ allowed: true, used: 1, cap: 1000 });

  fdcFoodsSearchMock.mockReset().mockResolvedValue([{ fdcId: 1, description: "Chicken" }]);
  edamamFoodSearchMock.mockReset().mockResolvedValue([
    { food: { foodId: "e1", label: "Egg", category: "Generic foods", categoryLabel: "food" } },
  ]);
  fatSecretFoodSearchMock.mockReset().mockResolvedValue([
    { food_id: "f1", food_name: "Salmon", brand_name: "", food_description: "Per 100g - Calories: 208kcal | Fat: 13.40g | Carbs: 0.00g | Protein: 20.00g" },
  ]);
  searchOffProductsMock.mockReset().mockResolvedValue([
    { code: "123", name: "Yogurt", brand: "Brand", calories: 60, protein: 3, carbs: 8, fat: 2, fiberG: 0, sugarG: 6, sodiumMg: 40 },
  ]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

async function loadUsda() {
  return (await import("../../app/api/usda/search/route")).GET;
}
async function loadEdamam() {
  return (await import("../../app/api/edamam/search/route")).GET;
}
async function loadFatSecret() {
  return (await import("../../app/api/fatsecret/search/route")).GET;
}
async function loadOff() {
  return (await import("../../app/api/off/search/route")).GET;
}

describe("/api/usda/search — cache + quota wiring", () => {
  it("CACHE HIT — returns cached hits, never calls USDA, never spends quota", async () => {
    getCachedSearchMock.mockResolvedValueOnce([{ fdcId: 99, description: "Cached" }]);
    const GET = await loadUsda();
    const res = await GET(makeReq("http://localhost/api/usda/search?q=chicken"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, cached: true });
    expect(json.hits).toEqual([{ fdcId: 99, description: "Cached" }]);
    expect(fdcFoodsSearchMock).not.toHaveBeenCalled();
    expect(consumeQuotaMock).not.toHaveBeenCalled();
  });

  it("QUOTA EXHAUSTED — skips USDA, returns degraded envelope", async () => {
    checkQuotaMock.mockResolvedValueOnce({ allowed: false, used: 1000, cap: 1000, reason: "quota_exhausted" });
    const GET = await loadUsda();
    const res = await GET(makeReq("http://localhost/api/usda/search?q=chicken"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, hits: [], degraded: true, degradedReason: "quota_exhausted" });
    expect(fdcFoodsSearchMock).not.toHaveBeenCalled();
  });

  it("MISS + QUOTA OK — calls USDA, consumes quota, caches the success", async () => {
    const GET = await loadUsda();
    const res = await GET(makeReq("http://localhost/api/usda/search?q=chicken"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true });
    expect(json.hits).toEqual([{ fdcId: 1, description: "Chicken" }]);
    expect(consumeQuotaMock).toHaveBeenCalledWith("usda");
    expect(setCachedSearchMock).toHaveBeenCalledWith(
      "usda",
      "chicken",
      [{ fdcId: 1, description: "Chicken" }],
      expect.objectContaining({ page: 1 }),
    );
  });

  it("does NOT cache a USDA hard failure (502 path)", async () => {
    fdcFoodsSearchMock.mockRejectedValueOnce(new Error("USDA 502"));
    const GET = await loadUsda();
    const res = await GET(makeReq("http://localhost/api/usda/search?q=chicken"));
    expect(res.status).toBe(502);
    expect(setCachedSearchMock).not.toHaveBeenCalled();
  });
});

describe("/api/edamam/search — cache + quota wiring", () => {
  it("CACHE HIT — returns cached hits, never calls Edamam", async () => {
    getCachedSearchMock.mockResolvedValueOnce([{ foodId: "cached", label: "Cached" }]);
    const GET = await loadEdamam();
    const res = await GET(makeReq("http://localhost/api/edamam/search?q=egg"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, cached: true });
    expect(edamamFoodSearchMock).not.toHaveBeenCalled();
    expect(consumeQuotaMock).not.toHaveBeenCalled();
  });

  it("QUOTA EXHAUSTED — skips Edamam, returns degraded envelope", async () => {
    checkQuotaMock.mockResolvedValueOnce({ allowed: false, used: 900, cap: 1000, reason: "quota_exhausted" });
    const GET = await loadEdamam();
    const res = await GET(makeReq("http://localhost/api/edamam/search?q=egg"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, hits: [], degraded: true, degradedReason: "quota_exhausted" });
    expect(edamamFoodSearchMock).not.toHaveBeenCalled();
  });

  it("MISS + QUOTA OK — calls Edamam, consumes quota, caches the success", async () => {
    const GET = await loadEdamam();
    const res = await GET(makeReq("http://localhost/api/edamam/search?q=egg"));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.hits.length).toBe(1);
    expect(consumeQuotaMock).toHaveBeenCalledWith("edamam");
    expect(setCachedSearchMock).toHaveBeenCalledWith(
      "edamam",
      "foods::egg",
      expect.any(Array),
      expect.objectContaining({ page: 1 }),
    );
  });

  it("does NOT cache an Edamam upstream failure (ok+empty fallback path)", async () => {
    edamamFoodSearchMock.mockRejectedValueOnce(new Error("Edamam 500"));
    const GET = await loadEdamam();
    const res = await GET(makeReq("http://localhost/api/edamam/search?q=egg"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, hits: [] });
    // The success cache write must not fire on the failure path.
    expect(setCachedSearchMock).not.toHaveBeenCalled();
  });
});

describe("/api/fatsecret/search — cache + quota wiring", () => {
  it("CACHE HIT — returns cached hits, never calls FatSecret", async () => {
    getCachedSearchMock.mockResolvedValueOnce([{ foodId: "cached", label: "Cached" }]);
    const GET = await loadFatSecret();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=salmon"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, cached: true });
    expect(fatSecretFoodSearchMock).not.toHaveBeenCalled();
    expect(consumeQuotaMock).not.toHaveBeenCalled();
  });

  it("QUOTA EXHAUSTED — skips FatSecret, returns degraded envelope", async () => {
    checkQuotaMock.mockResolvedValueOnce({ allowed: false, used: 10000, cap: 10000, reason: "quota_exhausted" });
    const GET = await loadFatSecret();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=salmon"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, hits: [], degraded: true, degradedReason: "quota_exhausted" });
    expect(fatSecretFoodSearchMock).not.toHaveBeenCalled();
  });

  it("MISS + QUOTA OK — calls FatSecret, consumes quota, caches the success", async () => {
    const GET = await loadFatSecret();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=salmon"));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.hits.length).toBe(1);
    expect(consumeQuotaMock).toHaveBeenCalledWith("fatsecret");
    expect(setCachedSearchMock).toHaveBeenCalledWith(
      "fatsecret",
      "salmon",
      expect.any(Array),
      expect.objectContaining({ page: 1 }),
    );
  });

  it("does NOT cache a FatSecret upstream failure (ok+empty fallback path)", async () => {
    fatSecretFoodSearchMock.mockRejectedValueOnce(new Error("FatSecret 502"));
    const GET = await loadFatSecret();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=salmon"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, hits: [] });
    expect(setCachedSearchMock).not.toHaveBeenCalled();
  });
});

describe("/api/off/search — cache + quota wiring (ENG-1059)", () => {
  it("CACHE HIT — returns cached hits, never calls OFF", async () => {
    getCachedSearchMock.mockResolvedValueOnce([{ code: "cached", name: "Cached" }]);
    const GET = await loadOff();
    const res = await GET(makeReq("http://localhost/api/off/search?q=yogurt"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, cached: true });
    expect(searchOffProductsMock).not.toHaveBeenCalled();
    expect(consumeQuotaMock).not.toHaveBeenCalled();
  });

  it("QUOTA EXHAUSTED — skips OFF, returns degraded envelope", async () => {
    checkQuotaMock.mockResolvedValueOnce({ allowed: false, used: 50000, cap: 50000, reason: "quota_exhausted" });
    const GET = await loadOff();
    const res = await GET(makeReq("http://localhost/api/off/search?q=yogurt"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, hits: [], degraded: true, degradedReason: "quota_exhausted" });
    expect(searchOffProductsMock).not.toHaveBeenCalled();
  });

  it("MISS + QUOTA OK — calls OFF, consumes quota, caches the success", async () => {
    const GET = await loadOff();
    const res = await GET(makeReq("http://localhost/api/off/search?q=yogurt"));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.hits.length).toBe(1);
    expect(consumeQuotaMock).toHaveBeenCalledWith("off");
    expect(setCachedSearchMock).toHaveBeenCalledWith(
      "off",
      "yogurt",
      expect.any(Array),
      expect.objectContaining({ page: 1 }),
    );
  });

  it("HARD FAILURE — degrades honestly (200 + degraded envelope), does NOT cache", async () => {
    // A hard OFF failure no longer 502s silently — it returns the same
    // degraded envelope shape as quota exhaustion so both clients' degraded
    // notice fires. The failure must still NOT be cached (only successes are).
    searchOffProductsMock.mockRejectedValueOnce(new Error("OFF 502"));
    const GET = await loadOff();
    const res = await GET(makeReq("http://localhost/api/off/search?q=yogurt"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      hits: [],
      degraded: true,
      degradedReason: "off_unavailable",
    });
    // Static error message only — no raw upstream message in the envelope.
    expect(json.message).toBeUndefined();
    expect(setCachedSearchMock).not.toHaveBeenCalled();
  });

  it("HARD FAILURE — consumes only the one attempt's quota, never spends extra on the degrade", async () => {
    // The degraded-on-failure path must not double-spend quota: exactly one
    // consumeQuota("off") for the single upstream attempt, and nothing more
    // once it throws.
    searchOffProductsMock.mockRejectedValueOnce(new Error("OFF unreachable"));
    const GET = await loadOff();
    const res = await GET(makeReq("http://localhost/api/off/search?q=yogurt"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, degraded: true, degradedReason: "off_unavailable" });
    expect(consumeQuotaMock).toHaveBeenCalledTimes(1);
    expect(consumeQuotaMock).toHaveBeenCalledWith("off");
  });
});
