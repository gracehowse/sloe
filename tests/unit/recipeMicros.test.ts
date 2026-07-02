/**
 * ENG-1299 — recipe-level micronutrient aggregation.
 *
 * `perServingMicrosFromRows` rolls the per-ingredient absolute micro maps
 * carried by the verify pipeline up to the per-serving panel persisted on
 * `recipes.nutrition_micros`. This pins the two correctness invariants that
 * matter for nutrition trust: absent ≠ zero (unpublished micros are never
 * synthesised) and the sum-then-divide-then-round order (values follow the
 * exact food-log decimal convention via `scaleMicrosPerServing`).
 */
import { describe, expect, it } from "vitest";
import {
  sumMicroMaps,
  perServingMicrosFromRows,
} from "@/lib/nutrition/recipeMicros";

describe("sumMicroMaps", () => {
  it("sums shared keys and unions distinct keys across rows", () => {
    const out = sumMicroMaps([
      { sodiumMg: 600, fiberG: 4, saturatedFatG: 2 },
      { sodiumMg: 400, fiberG: 2 },
    ]);
    expect(out).toEqual({ sodiumMg: 1000, fiberG: 6, saturatedFatG: 2 });
  });

  it("skips null / undefined rows — a row with no micros contributes nothing (absent ≠ zero)", () => {
    const out = sumMicroMaps([
      { sodiumMg: 500 },
      null,
      undefined,
      { sodiumMg: 250 },
    ]);
    expect(out).toEqual({ sodiumMg: 750 });
  });

  it("drops zero / negative / non-finite values rather than summing them", () => {
    const out = sumMicroMaps([
      { sodiumMg: 500, zeroKey: 0, negKey: -5, nanKey: Number.NaN, infKey: Number.POSITIVE_INFINITY },
    ]);
    expect(out).toEqual({ sodiumMg: 500 });
  });

  it("returns an empty panel when every row is absent", () => {
    expect(sumMicroMaps([null, undefined, {}])).toEqual({});
  });
});

describe("perServingMicrosFromRows", () => {
  it("sums accepted rows then divides by servings, rounding G→1dp and mg→0dp", () => {
    const out = perServingMicrosFromRows(
      [
        { sodiumMg: 600, fiberG: 4, saturatedFatG: 2 },
        { sodiumMg: 400, fiberG: 2 },
      ],
      4,
    );
    // sum = { sodiumMg: 1000, fiberG: 6, saturatedFatG: 2 } ÷ 4 servings
    expect(out).toEqual({ sodiumMg: 250, fiberG: 1.5, saturatedFatG: 0.5 });
  });

  it("treats servings ≤ 0 or non-finite as a single serving (no divide-by-zero blow-up)", () => {
    const rows = [{ sodiumMg: 300, fiberG: 2 }];
    const expected = { sodiumMg: 300, fiberG: 2 };
    expect(perServingMicrosFromRows(rows, 0)).toEqual(expected);
    expect(perServingMicrosFromRows(rows, -3)).toEqual(expected);
    expect(perServingMicrosFromRows(rows, Number.NaN)).toEqual(expected);
  });

  it("returns an empty panel when no row published micros", () => {
    expect(perServingMicrosFromRows([null, undefined], 4)).toEqual({});
  });
});
