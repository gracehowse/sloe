import { describe, it, expect } from "vitest";
import { scaleRecipeMicros, fetchPlannedMealMicros } from "../../src/lib/planning/plannedMealMicros.ts";

describe("scaleRecipeMicros", () => {
  it("scales fiber / sugar / sodium by the portion multiplier", () => {
    const r = { fiber_g: 4, sugar_g: 10, sodium_mg: 300 };
    expect(scaleRecipeMicros(r, 1)).toEqual({
      fiberG: 4,
      micros: { sugarG: 10, sodiumMg: 300 },
      macrosAreCoerced: false,
    });
    expect(scaleRecipeMicros(r, 0.5)).toEqual({
      fiberG: 2,
      micros: { sugarG: 5, sodiumMg: 150 },
      macrosAreCoerced: false,
    });
    expect(scaleRecipeMicros(r, 2)).toEqual({
      fiberG: 8,
      micros: { sugarG: 20, sodiumMg: 600 },
      macrosAreCoerced: false,
    });
  });

  it("omits zero / null values rather than writing 0", () => {
    const out = scaleRecipeMicros({ fiber_g: 0, sugar_g: null, sodium_mg: 120 }, 1);
    expect(out.fiberG).toBeNull();
    expect(out.micros).toEqual({ sodiumMg: 120 });
    expect(out.macrosAreCoerced).toBe(false);
  });

  it("falls back to mult=1 on invalid multipliers", () => {
    expect(scaleRecipeMicros({ fiber_g: 4 }, -1)).toEqual({
      fiberG: 4,
      micros: {},
      macrosAreCoerced: false,
    });
    expect(scaleRecipeMicros({ fiber_g: 4 }, NaN)).toEqual({
      fiberG: 4,
      micros: {},
      macrosAreCoerced: false,
    });
  });

  it("returns empty when recipe has no micros at all", () => {
    expect(scaleRecipeMicros({}, 1)).toEqual({
      fiberG: null,
      micros: {},
      macrosAreCoerced: false,
    });
  });
});

describe("scaleRecipeMicros — T4 macrosAreCoerced detection", () => {
  it("flags macrosAreCoerced=true when recipe has calories but gram columns under-explain them", () => {
    // 400 kcal, 0 g P/C/F → 0% of kcal explained → coercion would fire
    const out = scaleRecipeMicros(
      { fiber_g: 2, calories: 400, protein: 0, carbs: 0, fat: 0 },
      1,
    );
    expect(out.macrosAreCoerced).toBe(true);
  });

  it("flags macrosAreCoerced=false for coherent recipes", () => {
    const out = scaleRecipeMicros(
      { calories: 400, protein: 30, carbs: 40, fat: 12 },
      1,
    );
    expect(out.macrosAreCoerced).toBe(false);
  });

  it("flags macrosAreCoerced=false when recipe has zero calories", () => {
    const out = scaleRecipeMicros({ calories: 0, protein: 0, carbs: 0, fat: 0 }, 1);
    expect(out.macrosAreCoerced).toBe(false);
  });
});

describe("fetchPlannedMealMicros", () => {
  function fakeSupabase(result: { data: unknown; error: unknown }) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => result }),
        }),
      }),
    };
  }

  it("returns empty payload when recipeId is missing / not a uuid", async () => {
    const sb = fakeSupabase({ data: null, error: null });
    expect(await fetchPlannedMealMicros(sb, null, 1)).toEqual({
      fiberG: null,
      micros: {},
      macrosAreCoerced: false,
    });
    expect(await fetchPlannedMealMicros(sb, "not-a-uuid", 1)).toEqual({
      fiberG: null,
      micros: {},
      macrosAreCoerced: false,
    });
  });

  it("scales fiber + micros when the recipe has them", async () => {
    const sb = fakeSupabase({
      data: {
        fiber_g: 6,
        sugar_g: 14,
        sodium_mg: 420,
        calories: 500,
        protein: 35,
        carbs: 50,
        fat: 15,
      },
      error: null,
    });
    const out = await fetchPlannedMealMicros(sb, "11111111-1111-1111-1111-111111111111", 0.5);
    expect(out).toEqual({
      fiberG: 3,
      micros: { sugarG: 7, sodiumMg: 210 },
      macrosAreCoerced: false,
    });
  });

  it("T4: signals macrosAreCoerced=true when the recipe row has kcal but 0 macros", async () => {
    const sb = fakeSupabase({
      data: { fiber_g: null, sugar_g: null, sodium_mg: null, calories: 400, protein: 0, carbs: 0, fat: 0 },
      error: null,
    });
    const out = await fetchPlannedMealMicros(sb, "11111111-1111-1111-1111-111111111111", 1);
    expect(out.macrosAreCoerced).toBe(true);
  });

  it("returns empty payload on supabase error (never blocks log)", async () => {
    const sb = fakeSupabase({ data: null, error: { message: "boom" } });
    const out = await fetchPlannedMealMicros(sb, "11111111-1111-1111-1111-111111111111", 1);
    expect(out).toEqual({
      fiberG: null,
      micros: {},
      macrosAreCoerced: false,
    });
  });
});
