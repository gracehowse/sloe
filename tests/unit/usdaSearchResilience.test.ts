/**
 * ENG-1119 — `/api/usda/search` transient-failure resilience.
 *
 * Before this fix the route threw on ANY upstream failure → HTTP 502, which
 * broke the food-search merge pipeline instead of degrading gracefully (the
 * other three vendors — OFF / Edamam / FatSecret — return a degraded-200
 * envelope on failure). This file pins the new contract:
 *
 *   1. A transient 5xx is retried ONCE; if the retry succeeds, the success
 *      envelope is returned (and cached) — no 502, no degraded flag.
 *   2. A transient 5xx that fails BOTH attempts degrades honestly: HTTP 200,
 *      `{ ok: true, hits: [], degraded: true, degradedReason: "usda_unavailable" }`
 *      (same shape as quota-exhaustion / the OFF route) — NOT a 502.
 *   3. A non-transient 4xx is NOT retried (one attempt) and still degrades to
 *      the same 200 envelope rather than 502.
 *   4. A thrown network/timeout error (no HTTP status) is retried once.
 *   5. Quota is spent exactly ONCE per logical search, even when a retry fires.
 *   6. A degraded failure is never cached (only successes write the cache).
 *   7. The happy path is unchanged (success on first attempt → no retry).
 *
 * The cache + vendor client are mocked so the route's retry/degrade branch
 * logic is asserted in isolation (no Redis, no live USDA call).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fdcFoodsSearchMock = vi.fn();
vi.mock("@/lib/usda/fdcClient", () => ({
  fdcConfigFromEnv: () => ({ apiKey: "k" }),
  fdcFoodsSearch: (...a: unknown[]) => fdcFoodsSearchMock(...a),
}));

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

vi.mock("@/lib/server/rateLimit", () => ({ rateLimit: vi.fn(async () => ({ ok: true })) }));

const getUserIdFromRequestMock = vi.fn();
vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: (req: Request) => getUserIdFromRequestMock(req),
}));

vi.mock("@/lib/observability/captureRouteError", () => ({ captureRouteError: vi.fn() }));

function makeReq(url: string): Request {
  return new Request(url, { method: "GET", headers: { authorization: "Bearer t" } });
}

async function loadUsda() {
  return (await import("../../app/api/usda/search/route")).GET;
}

beforeEach(() => {
  vi.stubEnv("USDA_FDC_API_KEY", "k");
  getUserIdFromRequestMock.mockResolvedValue("user-1");

  getCachedSearchMock.mockResolvedValue(null);
  setCachedSearchMock.mockResolvedValue(undefined);
  checkQuotaMock.mockResolvedValue({ allowed: true, used: 0, cap: 1000 });
  consumeQuotaMock.mockResolvedValue({ allowed: true, used: 1, cap: 1000 });

  fdcFoodsSearchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("/api/usda/search — transient retry", () => {
  it("retries ONCE on a transient 5xx and returns the recovered success (no 502, no degraded)", async () => {
    fdcFoodsSearchMock
      .mockRejectedValueOnce(new Error("USDA FDC HTTP 503 service unavailable"))
      .mockResolvedValueOnce([{ fdcId: 7, description: "Chicken" }]);

    const GET = await loadUsda();
    const res = await GET(makeReq("http://localhost/api/usda/search?q=chicken"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, page: 1 });
    expect(json.hits).toEqual([{ fdcId: 7, description: "Chicken" }]);
    expect(json.degraded).toBeUndefined();
    // Two upstream attempts: the failed one + the retry.
    expect(fdcFoodsSearchMock).toHaveBeenCalledTimes(2);
    // The recovered success IS cached.
    expect(setCachedSearchMock).toHaveBeenCalledWith(
      "usda",
      "chicken",
      [{ fdcId: 7, description: "Chicken" }],
      expect.objectContaining({ page: 1 }),
    );
  });

  it("retries ONCE on a thrown network/timeout error (no HTTP status)", async () => {
    fdcFoodsSearchMock
      .mockRejectedValueOnce(new Error("The operation was aborted due to timeout"))
      .mockResolvedValueOnce([{ fdcId: 8, description: "Salmon" }]);

    const GET = await loadUsda();
    const res = await GET(makeReq("http://localhost/api/usda/search?q=salmon"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.hits).toEqual([{ fdcId: 8, description: "Salmon" }]);
    expect(json.degraded).toBeUndefined();
    expect(fdcFoodsSearchMock).toHaveBeenCalledTimes(2);
  });
});

describe("/api/usda/search — degraded-on-failure (was 502)", () => {
  it("degrades to a 200 envelope when BOTH attempts hit a transient 5xx", async () => {
    fdcFoodsSearchMock
      .mockRejectedValueOnce(new Error("USDA FDC HTTP 502 bad gateway"))
      .mockRejectedValueOnce(new Error("USDA FDC HTTP 502 bad gateway"));

    const GET = await loadUsda();
    const res = await GET(makeReq("http://localhost/api/usda/search?q=chicken"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      hits: [],
      page: 1,
      degraded: true,
      degradedReason: "usda_unavailable",
    });
    // No raw upstream message leaks to the client.
    expect(json.message).toBeUndefined();
    // Two attempts on a transient error.
    expect(fdcFoodsSearchMock).toHaveBeenCalledTimes(2);
    // The failure is NOT cached.
    expect(setCachedSearchMock).not.toHaveBeenCalled();
  });

  it("does NOT retry a non-transient 4xx and still degrades to a 200 envelope", async () => {
    fdcFoodsSearchMock.mockRejectedValueOnce(new Error("USDA FDC HTTP 400 bad request"));

    const GET = await loadUsda();
    const res = await GET(makeReq("http://localhost/api/usda/search?q=chicken"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      hits: [],
      degraded: true,
      degradedReason: "usda_unavailable",
    });
    // 4xx is not transient — exactly ONE attempt, no retry.
    expect(fdcFoodsSearchMock).toHaveBeenCalledTimes(1);
    expect(setCachedSearchMock).not.toHaveBeenCalled();
  });

  it("spends quota exactly ONCE per logical search even when a retry fires", async () => {
    fdcFoodsSearchMock
      .mockRejectedValueOnce(new Error("USDA FDC HTTP 500 internal"))
      .mockResolvedValueOnce([{ fdcId: 9, description: "Egg" }]);

    const GET = await loadUsda();
    await GET(makeReq("http://localhost/api/usda/search?q=egg"));

    expect(fdcFoodsSearchMock).toHaveBeenCalledTimes(2);
    expect(consumeQuotaMock).toHaveBeenCalledTimes(1);
    expect(consumeQuotaMock).toHaveBeenCalledWith("usda");
  });
});

describe("/api/usda/search — happy path unchanged", () => {
  it("returns the success envelope with no retry when the first attempt succeeds", async () => {
    fdcFoodsSearchMock.mockResolvedValueOnce([{ fdcId: 1, description: "Chicken" }]);

    const GET = await loadUsda();
    const res = await GET(makeReq("http://localhost/api/usda/search?q=chicken"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, hits: [{ fdcId: 1, description: "Chicken" }], page: 1 });
    expect(fdcFoodsSearchMock).toHaveBeenCalledTimes(1);
    expect(consumeQuotaMock).toHaveBeenCalledTimes(1);
    expect(setCachedSearchMock).toHaveBeenCalledTimes(1);
  });
});
