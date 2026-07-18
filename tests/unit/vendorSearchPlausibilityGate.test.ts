/**
 * ENG-1423 (mp-F3/plaus-F3) — extend the server-side Atwater plausibility
 * gate (`isPlausibleMacrosPer100g`, F-77) from OFF-only to USDA, Edamam, and
 * FatSecret search. Before this fix only `/api/off/search` filtered
 * physically-impossible per-100g rows (`searchProducts.ts:149-152`); the
 * other three vendors returned them straight into the merge/cache.
 *
 * Per-vendor behaviour differs deliberately:
 *   - USDA / Edamam: an implausible row is DROPPED from `hits` entirely,
 *     mirroring OFF exactly (both sources' inline macros are the row's only
 *     nutrition signal at search time).
 *   - USDA additionally: a hit reporting NO macro field at all (a real,
 *     common case — `FdcFoodSearchHit.calories` etc. are optional, and many
 *     Foundation/SR Legacy/Survey search hits carry no matching nutrient)
 *     must NOT be dropped — that's "no data", not "implausible data".
 *   - FatSecret: an implausible per-100g reading is NULLED
 *     (`macrosPer100g: null`), not dropped — the row still surfaces by name
 *     for a `food.get` detail fetch on tap, matching the file's existing
 *     "didn't parse → null" convention. `macrosPerServing` is never run
 *     through the gate (it isn't a per-100g figure).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fdcFoodsSearchMock = vi.fn();
vi.mock("@/lib/usda/fdcClient", () => ({
  fdcConfigFromEnv: () => ({ apiKey: "k" }),
  fdcFoodsSearch: (...a: unknown[]) => fdcFoodsSearchMock(...a),
}));

const edamamFoodSearchMock = vi.fn();
const edamamMacrosMock = vi.fn();
vi.mock("@/lib/edamam/client", () => ({
  edamamConfigFromEnv: () => ({ appId: "id", appKey: "key" }),
  edamamFoodSearch: (...a: unknown[]) => edamamFoodSearchMock(...a),
  edamamFoodMacrosPer100g: (...a: unknown[]) => edamamMacrosMock(...a),
  edamamFoodMicrosPer100g: () => ({}),
}));

const fatSecretFoodSearchMock = vi.fn();
vi.mock("@/lib/fatsecret/client", () => ({
  fatSecretConfigFromEnv: () => ({ consumerKey: "k", consumerSecret: "s", tier: "premier" as const }),
  fatSecretFoodSearch: (...a: unknown[]) => fatSecretFoodSearchMock(...a),
}));

vi.mock("@/lib/server/vendorSearchCache", () => ({
  getCachedSearch: vi.fn(async () => null),
  setCachedSearch: vi.fn(async () => undefined),
  checkQuota: vi.fn(async () => ({ allowed: true, used: 0, cap: 10000 })),
  consumeQuota: vi.fn(async () => ({ allowed: true, used: 1, cap: 10000 })),
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
async function loadEdamam() {
  return (await import("../../app/api/edamam/search/route")).GET;
}
async function loadFatSecret() {
  return (await import("../../app/api/fatsecret/search/route")).GET;
}

beforeEach(() => {
  vi.stubEnv("USDA_FDC_API_KEY", "k");
  vi.stubEnv("EDAMAM_APP_ID", "id");
  vi.stubEnv("EDAMAM_APP_KEY", "key");
  vi.stubEnv("FATSECRET_CLIENT_ID", "k");
  vi.stubEnv("FATSECRET_CLIENT_SECRET", "s");
  getUserIdFromRequestMock.mockResolvedValue("user-1");
  fdcFoodsSearchMock.mockReset();
  edamamFoodSearchMock.mockReset();
  edamamMacrosMock.mockReset();
  fatSecretFoodSearchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("/api/usda/search — plausibility gate", () => {
  it("drops a row whose inline macros fail the Atwater check (the F-77 'Eggs · 210 kcal · 3g protein' case)", async () => {
    fdcFoodsSearchMock.mockResolvedValueOnce([
      { fdcId: 1, description: "Eggs (implausible)", calories: 210, protein: 3, carbs: 0, fat: 0 },
      { fdcId: 2, description: "Eggs (plausible)", calories: 143, protein: 13, carbs: 1, fat: 10 },
    ]);
    const GET = await loadUsda();
    const res = await GET(makeReq("http://localhost/api/usda/search?q=eggs"));
    const json = await res.json();
    expect(json.hits.map((h: { fdcId: number }) => h.fdcId)).toEqual([2]);
  });

  it("keeps a hit with NO inline macro field at all — 'no data' is not 'implausible data'", async () => {
    fdcFoodsSearchMock.mockResolvedValueOnce([{ fdcId: 5, description: "Water, tap" }]);
    const GET = await loadUsda();
    const res = await GET(makeReq("http://localhost/api/usda/search?q=water"));
    const json = await res.json();
    expect(json.hits).toEqual([{ fdcId: 5, description: "Water, tap" }]);
  });

  it("keeps a genuinely all-zero row when it reported at least one macro field explicitly (mirrors OFF's all_zero rejection only when data was actually supplied)", async () => {
    // calories present (0) but no macros reported at all → all fields
    // resolve to 0 → the shared gate's all_zero branch rejects it, same as
    // OFF would for an identical row. This is deliberately conservative:
    // once a source claims ANY macro field, the row is held to the same bar.
    fdcFoodsSearchMock.mockResolvedValueOnce([
      { fdcId: 6, description: "Zero-macro stub", calories: 0 },
    ]);
    const GET = await loadUsda();
    const res = await GET(makeReq("http://localhost/api/usda/search?q=stub"));
    const json = await res.json();
    expect(json.hits).toEqual([]);
  });
});

describe("/api/edamam/search — plausibility gate", () => {
  it("drops a row whose per-100g macros fail the Atwater check", async () => {
    edamamFoodSearchMock.mockResolvedValueOnce([
      { food: { foodId: "bad", label: "Eggs (implausible)", category: "Generic foods" } },
      { food: { foodId: "good", label: "Eggs (plausible)", category: "Generic foods" } },
    ]);
    edamamMacrosMock
      .mockReturnValueOnce({ calories: 210, protein: 3, carbs: 0, fat: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 })
      .mockReturnValueOnce({ calories: 143, protein: 13, carbs: 1, fat: 10, fiberG: 0, sugarG: 0, sodiumMg: 0 });
    const GET = await loadEdamam();
    const res = await GET(makeReq("http://localhost/api/edamam/search?q=eggs"));
    const json = await res.json();
    expect(json.hits.map((h: { foodId: string }) => h.foodId)).toEqual(["good"]);
  });
});

describe("/api/fatsecret/search — plausibility gate", () => {
  it("nulls (does not drop) a row whose per-100g description fails the Atwater check", async () => {
    fatSecretFoodSearchMock.mockResolvedValueOnce([
      {
        food_id: "bad100",
        food_name: "Eggs (implausible)",
        brand_name: "",
        food_description: "Per 100g - Calories: 210kcal | Fat: 0.00g | Carbs: 0.00g | Protein: 3.00g",
      },
    ]);
    const GET = await loadFatSecret();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=eggs"));
    const json = await res.json();
    expect(json.hits.length).toBe(1);
    expect(json.hits[0].macrosPer100g).toBeNull();
    expect(json.hits[0].macrosPerServing).toBeNull();
  });

  it("keeps a plausible per-100g row's macros untouched", async () => {
    fatSecretFoodSearchMock.mockResolvedValueOnce([
      {
        food_id: "good100",
        food_name: "Salmon",
        brand_name: "",
        food_description: "Per 100g - Calories: 208kcal | Fat: 13.40g | Carbs: 0.00g | Protein: 20.00g",
      },
    ]);
    const GET = await loadFatSecret();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=salmon"));
    const json = await res.json();
    expect(json.hits[0].macrosPer100g).toEqual({ calories: 208, protein: 20, carbs: 0, fat: 13.4 });
  });

  it("never runs the per-100g gate on macrosPerServing (a whole serving can legitimately exceed the per-100g kcal ceiling)", async () => {
    // 900+ kcal in a single large serving is normal (a full meal) and must
    // NOT be judged by the per-100g 900kcal ceiling — that ceiling only
    // makes sense per 100g of food, not per arbitrary serving size.
    fatSecretFoodSearchMock.mockResolvedValueOnce([
      {
        food_id: "bigmeal",
        food_name: "Family lasagna tray",
        brand_name: "",
        food_description:
          "Per 1 tray (1200g) - Calories: 2400kcal | Fat: 120.00g | Carbs: 200.00g | Protein: 100.00g",
      },
    ]);
    const GET = await loadFatSecret();
    const res = await GET(makeReq("http://localhost/api/fatsecret/search?q=lasagna"));
    const json = await res.json();
    expect(json.hits[0].macrosPer100g).toBeNull();
    expect(json.hits[0].macrosPerServing).toEqual({
      calories: 2400,
      protein: 100,
      carbs: 200,
      fat: 120,
    });
  });
});
