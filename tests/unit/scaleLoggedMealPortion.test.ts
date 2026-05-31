import { describe, expect, it } from "vitest";
import { scaleLoggedMealFiberAndMicros } from "@/lib/nutrition/scaleLoggedMealPortion";

/**
 * Regression for the fibre/micros portion-scaling bug (2026-05-30, Grace):
 * editing a logged entry to 0.5× halved kcal/protein/carbs/fat but left
 * fibre (and every micro) unchanged, because the edit sheet has no field for
 * them. `scaleLoggedMealFiberAndMicros` is the shared unit that both the
 * mobile `saveEditMeal` and the forthcoming web parity dialog call so the
 * two cannot drift. `ratio = newPortion / oldPortion`.
 */
describe("scaleLoggedMealFiberAndMicros", () => {
  it("halves fibre + every micro at ratio 0.5 (the reported scenario)", () => {
    const out = scaleLoggedMealFiberAndMicros({
      fiberG: 10.5,
      micros: { sugarG: 20, sodiumMg: 400 },
      ratio: 0.5,
    });
    // 10.5 → 5.25, surfaced at 1dp. Crucially NOT left at 10.5.
    expect(out.fiberG).toBe(5.3);
    expect(out.micros).toEqual({ sugarG: 10, sodiumMg: 200 });
  });

  it("doubles fibre + micros at ratio 2", () => {
    const out = scaleLoggedMealFiberAndMicros({
      fiberG: 8,
      micros: { sugarG: 5, sodiumMg: 150 },
      ratio: 2,
    });
    expect(out.fiberG).toBe(16);
    expect(out.micros).toEqual({ sugarG: 10, sodiumMg: 300 });
  });

  it("quarters at ratio 0.25 (e.g. an entry already at 2× edited down to 0.5×)", () => {
    const out = scaleLoggedMealFiberAndMicros({
      fiberG: 8,
      micros: { sugarG: 4 },
      ratio: 0.25,
    });
    expect(out.fiberG).toBe(2);
    expect(out.micros).toEqual({ sugarG: 1 });
  });

  it("scales a fiberG key carried inside the micros map too, by the same ratio", () => {
    const out = scaleLoggedMealFiberAndMicros({
      fiberG: 4,
      micros: { fiberG: 4, sugarG: 8 },
      ratio: 0.5,
    });
    expect(out.fiberG).toBe(2);
    expect(out.micros).toEqual({ fiberG: 2, sugarG: 4 });
  });

  it("preserves the micros decimal convention (grams 1dp, mg 0dp)", () => {
    const out = scaleLoggedMealFiberAndMicros({
      fiberG: 12.3,
      micros: { sugarG: 12.3, sodiumMg: 333 },
      ratio: 0.5,
    });
    expect(out.fiberG).toBe(6.2); // 6.15 → 1dp
    expect(out.micros).toEqual({ sugarG: 6.2, sodiumMg: 167 }); // 166.5 → 0dp
  });

  it("is a no-op at ratio exactly 1 — title/slot-only edits never re-round", () => {
    expect(
      scaleLoggedMealFiberAndMicros({ fiberG: 10.5, micros: { sugarG: 20 }, ratio: 1 }),
    ).toEqual({});
  });

  it("is a safe no-op for invalid ratios (0, negative, NaN, Infinity)", () => {
    for (const ratio of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        scaleLoggedMealFiberAndMicros({ fiberG: 10, micros: { sugarG: 5 }, ratio }),
      ).toEqual({});
    }
  });

  it("omits fiberG when absent and micros when absent", () => {
    expect(scaleLoggedMealFiberAndMicros({ micros: { sugarG: 6 }, ratio: 0.5 })).toEqual({
      micros: { sugarG: 3 },
    });
    expect(scaleLoggedMealFiberAndMicros({ fiberG: 6, ratio: 0.5 })).toEqual({ fiberG: 3 });
    expect(scaleLoggedMealFiberAndMicros({ ratio: 0.5 })).toEqual({});
  });

  it("drops micros that scale to zero (never invents a phantom trace)", () => {
    // 0-valued and sub-rounding micros fall out via scaleMicrosPerServing.
    const out = scaleLoggedMealFiberAndMicros({
      micros: { sugarG: 8, calciumMg: 0 },
      ratio: 0.5,
    });
    expect(out.micros).toEqual({ sugarG: 4 });
  });
});
