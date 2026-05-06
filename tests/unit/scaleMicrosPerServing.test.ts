/**
 * 2026-05-06 audit (E2): pin the per-serving-only micros scaling
 * logic. Used at the food-search commit site for FatSecret no-metric
 * foods (e.g. McDonald's Big Mac with no `metric_serving_amount`)
 * where the only way to log accurately is `microsPerServing × quantity`
 * with no per-100g basis.
 */
import { describe, expect, it } from "vitest";
import { scaleMicrosPerServing } from "@/lib/nutrition/scaleMicrosPerServing";

describe("scaleMicrosPerServing", () => {
  it("scales per-serving micros by quantity (Big Mac × 1)", () => {
    const out = scaleMicrosPerServing(
      {
        fiberG: 3,
        sugarG: 7,
        sodiumMg: 1060,
        saturatedFatG: 11,
        cholesterolMg: 85,
        potassiumMg: 370,
      },
      1,
    );
    expect(out).toEqual({
      fiberG: 3,
      sugarG: 7,
      sodiumMg: 1060,
      saturatedFatG: 11,
      cholesterolMg: 85,
      potassiumMg: 370,
    });
  });

  it("scales by quantity > 1 (Big Mac × 2)", () => {
    const out = scaleMicrosPerServing(
      { fiberG: 3, sodiumMg: 1060, saturatedFatG: 11 },
      2,
    );
    expect(out).toEqual({ fiberG: 6, sodiumMg: 2120, saturatedFatG: 22 });
  });

  it("scales by fractional quantity (½ Big Mac)", () => {
    const out = scaleMicrosPerServing(
      { fiberG: 3, sodiumMg: 1060, saturatedFatG: 11 },
      0.5,
    );
    expect(out).toEqual({ fiberG: 1.5, sodiumMg: 530, saturatedFatG: 5.5 });
  });

  it("rounds gram keys to 1dp, mg keys to 0dp (matches scaleMicrosForGrams convention)", () => {
    const out = scaleMicrosPerServing(
      { fiberG: 1.234, sodiumMg: 1234.78 },
      1,
    );
    expect(out.fiberG).toBe(1.2);
    expect(out.sodiumMg).toBe(1235);
  });

  it("drops zero / non-finite / negative input values", () => {
    const out = scaleMicrosPerServing(
      {
        fiberG: 0,
        sodiumMg: Number.NaN,
        saturatedFatG: -1,
        cholesterolMg: 85,
      },
      1,
    );
    expect(out).toEqual({ cholesterolMg: 85 });
  });

  it("returns empty when quantity is 0 or non-finite", () => {
    expect(scaleMicrosPerServing({ fiberG: 3 }, 0)).toEqual({});
    expect(scaleMicrosPerServing({ fiberG: 3 }, Number.NaN)).toEqual({});
    expect(scaleMicrosPerServing({ fiberG: 3 }, -1)).toEqual({});
  });

  it("returns empty when input is null or undefined", () => {
    expect(scaleMicrosPerServing(null, 1)).toEqual({});
    expect(scaleMicrosPerServing(undefined, 1)).toEqual({});
    expect(scaleMicrosPerServing({}, 1)).toEqual({});
  });

  it("drops post-scale zeros (e.g. 0.04g → rounds to 0g, dropped)", () => {
    // 0.04g × 1 = 0.04 → round(0.04 * 10) / 10 = 0 → dropped.
    const out = scaleMicrosPerServing({ fiberG: 0.04, sodiumMg: 0.4 }, 1);
    expect(out.fiberG).toBeUndefined();
    expect(out.sodiumMg).toBeUndefined();
  });
});
