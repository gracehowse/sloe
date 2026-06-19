/**
 * Generic-food micros — select→commit behavioural pin (ENG-738, mobile).
 *
 * Drives the REAL `searchFoods` helper (which builds the GenericFood row
 * via `genericFoodToUnifiedResult` — the function changed in ENG-738) and
 * then runs the REAL commit-path scale (`scaleMicrosForGrams`, the exact
 * helper `handleFoodSearchSelect` calls). Proves that logging a generic
 * staple now produces a NON-EMPTY `nutrition_micros` instead of the empty
 * object that pre-ENG-738 left the meal-detail "Vitamins, minerals & more"
 * card showing "did not publish…".
 *
 * Network is short-circuited: the `expo-constants` shim ships an empty
 * `supprApiUrl`, so USDA / Edamam / FatSecret return `[]` without a
 * round-trip; OFF uses raw `fetch`, mocked here to return zero products.
 * The only surviving result is the in-memory generic-food row, which is
 * exactly what we want to assert against.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `verifyRecipe` imports `./supabase`, which constructs a real Supabase
// client at module load (throws on an empty URL). `searchFoods` never
// touches it on the generic-food path, so a minimal stub keeps the import
// graph happy without a network client. Mirrors `deletedHealthSamples.test.ts`.
vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({}),
  },
}));

/* eslint-disable import/first -- deferred until after the supabase vi.mock above */
import { searchFoods } from "../../lib/verifyRecipe";
import { scaleMicrosForGrams } from "@suppr/shared/openFoodFacts/parseOffMicros";
import { genericFoodMicrosPer100g } from "@suppr/nutrition-core/genericFoodMicros";
/* eslint-enable import/first */

beforeEach(() => {
  // OFF (`world.openfoodfacts.org`) is the only source that uses raw
  // `fetch`; return an empty product list so the generic-food row is the
  // sole result. Quiet the `[searchFoods]` console.log too.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ products: [] }),
      text: async () => JSON.stringify({ products: [] }),
    })) as unknown as typeof fetch,
  );
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ENG-738 — generic food → row → scaled nutrition_micros (mobile)", () => {
  it("surfaces a carrot row carrying the baked per-100g micros", async () => {
    const rows = await searchFoods("carrot");
    const carrot = rows.find((r) => r.key === "generic-food:carrot");
    expect(carrot, "carrot generic row should surface").toBeDefined();
    expect(carrot!._source).toBe("GenericFood");
    expect(carrot!.microsPer100g).toBeDefined();
    // The row must carry the exact baked table reference.
    expect(carrot!.microsPer100g).toEqual(genericFoodMicrosPer100g("carrot"));
    expect(carrot!.microsPer100g!.vitaminAMcgRae).toBeCloseTo(835, 0);
    expect(carrot!.microsPer100g!.potassiumMg).toBeCloseTo(320, 0);
  });

  it("commit-scaling a carrot serving writes a NON-EMPTY nutrition_micros", async () => {
    const rows = await searchFoods("carrot");
    const carrot = rows.find((r) => r.key === "generic-food:carrot")!;

    // Mirror the commit path: `scaleMicrosForGrams(result.microsPer100g ??
    // {}, grams)`. Default carrot serving is 61g.
    const grams = carrot.primaryServing?.grams ?? 61;
    const nutritionMicros = scaleMicrosForGrams(carrot.microsPer100g ?? {}, grams);

    expect(Object.keys(nutritionMicros).length).toBeGreaterThan(0);
    // 835 µg/100g × 61g/100 ≈ 509 µg RAE.
    expect(nutritionMicros.vitaminAMcgRae).toBeCloseTo((835 * grams) / 100, 0);
    // 320 mg/100g × 61g/100 ≈ 195 mg potassium.
    expect(nutritionMicros.potassiumMg).toBeCloseTo((320 * grams) / 100, 0);
  });

  it("spinach carries + scales its hallmark vitamin K / folate", async () => {
    const rows = await searchFoods("spinach");
    const spinach = rows.find((r) => r.key === "generic-food:spinach")!;
    expect(spinach.microsPer100g).toBeDefined();

    const grams = spinach.primaryServing?.grams ?? 30;
    const nutritionMicros = scaleMicrosForGrams(spinach.microsPer100g ?? {}, grams);
    expect(Object.keys(nutritionMicros).length).toBeGreaterThan(0);
    expect(nutritionMicros.vitaminKMcg).toBeCloseTo((482.9 * grams) / 100, 0);
    expect(nutritionMicros.folateMcg).toBeCloseTo((194 * grams) / 100, 0);
  });

  it("a generic food with no baked panel commits an empty micros set, not a crash", async () => {
    // Regression guard for the conditional-spread: an unbaked id (none
    // exist today, but the threading must be undefined-safe) yields an
    // empty — never a thrown — `nutrition_micros`.
    const empty = scaleMicrosForGrams(genericFoodMicrosPer100g("not-real") ?? {}, 100);
    expect(empty).toEqual({});
  });
});
