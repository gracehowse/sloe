/**
 * ENG-1117 — route-level wiring of the per-foodId detail cache + account-level
 * quota guard into the on-tap nutrition-DETAIL routes `/api/edamam/food`
 * (Edamam `/nutrients`) and `/api/usda/food` (USDA food-get).
 *
 * The bug: the account-wide vendor quota guard that protects `/api/{vendor}/search`
 * was NOT applied to these detail routes, so on-tap detail fetches could blow
 * Edamam's 1,000/day (and USDA's ~1,000/hr) account-wide ceilings unguarded.
 *
 * What these tests pin (per route):
 *   (a) CACHE HIT  → serve the cached detail, NO vendor call, NO quota spend,
 *       envelope carries `cached: true`.
 *   (b) CACHE MISS + QUOTA OK → consume exactly one quota unit, call the vendor,
 *       and CACHE the successful response.
 *   (c) QUOTA EXHAUSTED → skip the vendor entirely, return the SAME degraded
 *       envelope shape the search route uses (`degraded: true,
 *       degradedReason: "quota_exhausted"`) — NOT an unguarded vendor call.
 *   (d) Upstream failure is NOT cached.
 *
 * The cache module is mocked so each route's branch logic is asserted in
 * isolation, with no Redis and no live vendor calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Cache-module mock (shared across both detail routes) ─────────────────
const getCachedDetailMock = vi.fn();
const setCachedDetailMock = vi.fn();
const checkQuotaMock = vi.fn();
const consumeQuotaMock = vi.fn();

vi.mock("@/lib/server/vendorSearchCache", () => ({
  getCachedDetail: (...a: unknown[]) => getCachedDetailMock(...a),
  setCachedDetail: (...a: unknown[]) => setCachedDetailMock(...a),
  checkQuota: (...a: unknown[]) => checkQuotaMock(...a),
  consumeQuota: (...a: unknown[]) => consumeQuotaMock(...a),
}));

// ── Vendor-client mocks ───────────────────────────────────────────────────
const fetchEdamamMicrosPer100gMock = vi.fn();
vi.mock("@/lib/edamam/client", () => ({
  edamamConfigFromEnv: () => ({ appId: "id", appKey: "key" }),
  fetchEdamamMicrosPer100g: (...a: unknown[]) => fetchEdamamMicrosPer100gMock(...a),
}));

const fdcFoodGetMock = vi.fn();
vi.mock("@/lib/usda/fdcClient", () => ({
  fdcConfigFromEnv: () => ({ apiKey: "k" }),
  fdcFoodGet: (...a: unknown[]) => fdcFoodGetMock(...a),
}));

// USDA normalisers + portion picker — deterministic, not under test here.
vi.mock("@/lib/nutrition/usdaNormalize", () => ({
  fdcFoodMacrosPer100g: () => ({ calories: 89, protein: 1.1, carbs: 23, fat: 0.3 }),
  fdcFoodMicrosPer100g: () => ({ potassiumMg: 358 }),
}));
vi.mock("@/lib/nutrition/primaryServing", () => ({
  pickUsdaFoodPortionsPrimaryServing: () => ({ label: "1 medium", gramWeight: 118, amount: 1 }),
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
  getUserIdFromRequestMock.mockResolvedValue("user-1");

  // Default: cold cache, quota healthy.
  getCachedDetailMock.mockResolvedValue(null);
  setCachedDetailMock.mockResolvedValue(undefined);
  checkQuotaMock.mockResolvedValue({ allowed: true, used: 0, cap: 1000 });
  consumeQuotaMock.mockResolvedValue({ allowed: true, used: 1, cap: 1000 });

  fetchEdamamMicrosPer100gMock.mockReset().mockResolvedValue({ ironMg: 2.7, vitaminCMg: 0 });
  fdcFoodGetMock.mockReset().mockResolvedValue({
    description: "Banana, raw",
    foodPortions: [{ amount: 1, gramWeight: 118, measureUnit: { name: "medium" }, modifier: "medium" }],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

async function loadEdamamFood() {
  return (await import("../../app/api/edamam/food/route")).GET;
}
async function loadUsdaFood() {
  return (await import("../../app/api/usda/food/route")).GET;
}

describe("/api/edamam/food — detail cache + quota wiring (ENG-1117)", () => {
  it("(a) CACHE HIT — returns cached micros, never calls Edamam, never spends quota", async () => {
    getCachedDetailMock.mockResolvedValueOnce({ microsPer100g: { ironMg: 9 } });
    const GET = await loadEdamamFood();
    const res = await GET(makeReq("http://localhost/api/edamam/food?foodId=food_abc"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, cached: true, foodId: "food_abc", microsPer100g: { ironMg: 9 } });
    expect(fetchEdamamMicrosPer100gMock).not.toHaveBeenCalled();
    expect(checkQuotaMock).not.toHaveBeenCalled();
    expect(consumeQuotaMock).not.toHaveBeenCalled();
  });

  it("(b) CACHE MISS + QUOTA OK — consumes quota, calls Edamam, caches the success", async () => {
    const GET = await loadEdamamFood();
    const res = await GET(makeReq("http://localhost/api/edamam/food?foodId=food_abc"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, foodId: "food_abc", microsPer100g: { ironMg: 2.7, vitaminCMg: 0 } });
    expect(json.cached).toBeUndefined();
    expect(consumeQuotaMock).toHaveBeenCalledTimes(1);
    expect(consumeQuotaMock).toHaveBeenCalledWith("edamam");
    expect(fetchEdamamMicrosPer100gMock).toHaveBeenCalledTimes(1);
    expect(setCachedDetailMock).toHaveBeenCalledWith("edamam", "food_abc", { microsPer100g: { ironMg: 2.7, vitaminCMg: 0 } });
  });

  it("(c) QUOTA EXHAUSTED — skips Edamam, returns degraded envelope, no vendor call", async () => {
    checkQuotaMock.mockResolvedValueOnce({ allowed: false, used: 900, cap: 1000, reason: "quota_exhausted" });
    const GET = await loadEdamamFood();
    const res = await GET(makeReq("http://localhost/api/edamam/food?foodId=food_abc"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, foodId: "food_abc", degraded: true, degradedReason: "quota_exhausted" });
    expect(fetchEdamamMicrosPer100gMock).not.toHaveBeenCalled();
    expect(consumeQuotaMock).not.toHaveBeenCalled();
    expect(setCachedDetailMock).not.toHaveBeenCalled();
  });

  it("(d) upstream failure is NOT cached (still spends the one attempt's quota)", async () => {
    fetchEdamamMicrosPer100gMock.mockRejectedValueOnce(new Error("Edamam /nutrients 500"));
    const GET = await loadEdamamFood();
    const res = await GET(makeReq("http://localhost/api/edamam/food?foodId=food_abc"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, foodId: "food_abc" });
    expect(consumeQuotaMock).toHaveBeenCalledTimes(1);
    expect(setCachedDetailMock).not.toHaveBeenCalled();
  });

  it("rejects a missing foodId before touching cache or quota", async () => {
    const GET = await loadEdamamFood();
    const res = await GET(makeReq("http://localhost/api/edamam/food?foodId="));
    expect(res.status).toBe(400);
    expect(getCachedDetailMock).not.toHaveBeenCalled();
    expect(checkQuotaMock).not.toHaveBeenCalled();
  });
});

describe("/api/usda/food — detail cache + quota wiring (ENG-1117)", () => {
  it("(a) CACHE HIT — returns cached detail, never calls USDA, never spends quota", async () => {
    getCachedDetailMock.mockResolvedValueOnce({
      ok: true,
      fdcId: 173944,
      description: "Banana, raw",
      macrosPer100g: { calories: 89 },
      portions: [],
    });
    const GET = await loadUsdaFood();
    const res = await GET(makeReq("http://localhost/api/usda/food?fdcId=173944"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, cached: true, fdcId: 173944, description: "Banana, raw" });
    expect(fdcFoodGetMock).not.toHaveBeenCalled();
    expect(checkQuotaMock).not.toHaveBeenCalled();
    expect(consumeQuotaMock).not.toHaveBeenCalled();
  });

  it("(b) CACHE MISS + QUOTA OK — consumes quota, calls USDA, caches the success", async () => {
    const GET = await loadUsdaFood();
    const res = await GET(makeReq("http://localhost/api/usda/food?fdcId=173944"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, fdcId: 173944, description: "Banana, raw" });
    expect(json.cached).toBeUndefined();
    expect(consumeQuotaMock).toHaveBeenCalledTimes(1);
    expect(consumeQuotaMock).toHaveBeenCalledWith("usda");
    expect(fdcFoodGetMock).toHaveBeenCalledTimes(1);
    // Caches under the stringified fdcId, with the full success payload.
    expect(setCachedDetailMock).toHaveBeenCalledTimes(1);
    const [vendorArg, idArg, payloadArg] = setCachedDetailMock.mock.calls[0];
    expect(vendorArg).toBe("usda");
    expect(idArg).toBe("173944");
    expect(payloadArg).toMatchObject({ ok: true, fdcId: 173944, description: "Banana, raw" });
  });

  it("(c) QUOTA EXHAUSTED — skips USDA, returns degraded envelope, no vendor call", async () => {
    checkQuotaMock.mockResolvedValueOnce({ allowed: false, used: 1000, cap: 1000, reason: "quota_exhausted" });
    const GET = await loadUsdaFood();
    const res = await GET(makeReq("http://localhost/api/usda/food?fdcId=173944"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, fdcId: 173944, degraded: true, degradedReason: "quota_exhausted" });
    expect(fdcFoodGetMock).not.toHaveBeenCalled();
    expect(consumeQuotaMock).not.toHaveBeenCalled();
    expect(setCachedDetailMock).not.toHaveBeenCalled();
  });

  it("(d) upstream failure is NOT cached (502 path, still spends the one attempt's quota)", async () => {
    fdcFoodGetMock.mockRejectedValueOnce(new Error("USDA 502"));
    const GET = await loadUsdaFood();
    const res = await GET(makeReq("http://localhost/api/usda/food?fdcId=173944"));
    expect(res.status).toBe(502);
    expect(consumeQuotaMock).toHaveBeenCalledTimes(1);
    expect(setCachedDetailMock).not.toHaveBeenCalled();
  });

  it("a not_found result is NOT cached (404), but the attempt's quota is spent", async () => {
    fdcFoodGetMock.mockResolvedValueOnce(null);
    const GET = await loadUsdaFood();
    const res = await GET(makeReq("http://localhost/api/usda/food?fdcId=999999"));
    expect(res.status).toBe(404);
    expect(consumeQuotaMock).toHaveBeenCalledTimes(1);
    expect(setCachedDetailMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid fdcId before touching cache or quota", async () => {
    const GET = await loadUsdaFood();
    const res = await GET(makeReq("http://localhost/api/usda/food?fdcId=notanumber"));
    expect(res.status).toBe(400);
    expect(getCachedDetailMock).not.toHaveBeenCalled();
    expect(checkQuotaMock).not.toHaveBeenCalled();
  });
});
