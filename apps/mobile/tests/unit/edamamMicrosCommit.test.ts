/**
 * Edamam full-micros — select→commit behavioural pin (ENG-738, mobile).
 *
 * Drives the REAL `getEdamamFoodMicros` helper (the `/api/edamam/food`
 * client the Edamam SELECT branch now calls) and then runs the REAL
 * commit-path scale (`scaleMicrosForGrams`, the exact helper the food-log
 * commit calls). Proves that logging an Edamam food now produces a
 * NON-EMPTY `nutrition_micros` with the FULL panel (vitamins + minerals +
 * fat breakdown) instead of the sodium-only object pre-ENG-738 left the
 * meal-detail "Vitamins, minerals & more" card showing "did not publish…".
 *
 * Network: `expo-constants` is mocked to supply a non-empty `supprApiUrl`
 * (so `apiBase()` resolves) and `./authedFetch` is mocked so the helper's
 * fetch + parse behaviour is exercised, not the route itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Non-empty supprApiUrl so apiBase() resolves and the helper actually
// calls authedFetch (the default shim ships "" → short-circuit to {}).
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { extra: { supprApiUrl: "https://api.suppr-club.test" } },
    manifest: null,
    manifest2: null,
    platform: { ios: { model: "simulator" } },
  },
}));

// `verifyRecipe` imports `./supabase` (real client at module load). The
// getEdamamFoodMicros path never touches it; a minimal stub keeps the
// import graph happy. Mirrors `genericFoodMicrosCommit.test.ts`.
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
import { getEdamamFoodMicros } from "../../lib/verifyRecipe";
import { authedFetch } from "../../lib/authedFetch";
import { scaleMicrosForGrams } from "@suppr/shared/openFoodFacts/parseOffMicros";
/* eslint-enable import/first */

const mockedFetch = authedFetch as ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// The full per-100g panel as `/api/edamam/food` returns it (already
// remapped to canonical keys by the route's `fetchEdamamMicrosPer100g`).
const FULL_PANEL = {
  sodiumMg: 74,
  potassiumMg: 256,
  calciumMg: 15,
  ironMg: 1,
  magnesiumMg: 29,
  phosphorusMg: 228,
  zincMg: 1,
  saturatedFatG: 1,
  monoFatG: 1.2,
  polyFatG: 0.8,
  cholesterolMg: 85,
  vitaminB6Mg: 0.6,
  niacinMg: 13.7,
  vitaminB12Mcg: 0.3,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ENG-738 — Edamam food → /api/edamam/food → scaled nutrition_micros (mobile)", () => {
  it("fetches /api/edamam/food with the foodId and returns the full panel", async () => {
    mockedFetch.mockResolvedValue(jsonResponse({ ok: true, foodId: "food_chk_1", microsPer100g: FULL_PANEL }));

    const micros = await getEdamamFoodMicros("food_chk_1");

    expect(micros).toEqual(FULL_PANEL);
    const [url] = mockedFetch.mock.calls[0]!;
    expect(String(url)).toContain("/api/edamam/food?foodId=food_chk_1");
  });

  it("commit-scaling the panel writes a NON-EMPTY nutrition_micros with the full set", async () => {
    mockedFetch.mockResolvedValue(jsonResponse({ ok: true, foodId: "food_chk_1", microsPer100g: FULL_PANEL }));

    const microsPer100g = await getEdamamFoodMicros("food_chk_1");
    // Mirror the commit path: `scaleMicrosForGrams(result.microsPer100g ?? {}, grams)`.
    const grams = 150;
    const nutritionMicros = scaleMicrosForGrams(microsPer100g, grams);

    expect(Object.keys(nutritionMicros).length).toBeGreaterThan(3);
    // 256 mg/100g × 150g/100 = 384 mg potassium.
    expect(nutritionMicros.potassiumMg).toBe((256 * grams) / 100);
    // 85 mg/100g × 1.5 = 127.5 → rounds to 128 mg cholesterol (0dp).
    expect(nutritionMicros.cholesterolMg).toBe(Math.round((85 * grams) / 100));
    // Vitamins survive the scale too.
    expect(nutritionMicros.vitaminB6Mg).toBeGreaterThan(0);
  });

  it("returns {} when the route reports no extra panel (food still logs)", async () => {
    mockedFetch.mockResolvedValue(jsonResponse({ ok: true, foodId: "food_water" }));
    await expect(getEdamamFoodMicros("food_water")).resolves.toEqual({});
  });

  it("returns {} (never throws) on a non-ok route body", async () => {
    mockedFetch.mockResolvedValue(jsonResponse({ ok: false, error: "server_misconfigured" }));
    await expect(getEdamamFoodMicros("food_x")).resolves.toEqual({});
  });

  it("returns {} (never throws) on a network error", async () => {
    mockedFetch.mockRejectedValue(new Error("boom"));
    await expect(getEdamamFoodMicros("food_x")).resolves.toEqual({});
  });

  it("returns {} for an empty foodId without calling the network", async () => {
    await expect(getEdamamFoodMicros("")).resolves.toEqual({});
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
