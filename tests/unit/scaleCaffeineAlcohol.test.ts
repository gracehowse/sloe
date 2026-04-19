/**
 * F-13 (2026-04-19) — proof the shared scaler `scaleCaffeineAlcohol` is
 * proportional, null-safe, clamped, and never invents a value.
 *
 * The scaler sits between every food-log commit path on both platforms
 * and the `profiles.extra_caffeine_by_day` / `extra_alcohol_g_by_day`
 * write call. If this logic regresses the daily totals either drift or
 * fabricate nutrition — so the asserts here map to the exact guardrails
 * the task spec calls out.
 */
import { describe, it, expect } from "vitest";
import { scaleCaffeineAlcohol } from "@/lib/nutrition/scaleCaffeineAlcoholForGrams";

describe("scaleCaffeineAlcohol", () => {
  it("scales linearly — 200 g of 40 mg/100g → 80 mg", () => {
    const result = scaleCaffeineAlcohol({
      grams: 200,
      caffeineMgPer100g: 40,
      alcoholGPer100g: null,
    });
    expect(result).toEqual({ caffeineMg: 80, alcoholG: 0 });
  });

  it("scales linearly — 150 ml wine at 9.5 g/100 ml → 14.3 g (1 dp)", () => {
    // Wine at 12% ABV ≈ 9.5 g ethanol per 100 ml (density 0.789).
    // OFF stores alcohol_100g on ready-to-drink products; the grams
    // input here would be the drink's gram weight (≈150 g for 150 ml).
    const result = scaleCaffeineAlcohol({
      grams: 150,
      caffeineMgPer100g: null,
      alcoholGPer100g: 9.5,
    });
    expect(result.caffeineMg).toBe(0);
    // 9.5 * 1.5 = 14.25 → rounds to 14.3 at 1 dp
    expect(result.alcoholG).toBe(14.3);
  });

  it("both nutrients on the same call scale independently", () => {
    // Cola at 10 mg/100g caffeine, 330 g pour → 33 mg caffeine.
    // A weird hypothetical cola also at 1 g/100g alcohol → 3.3 g.
    const result = scaleCaffeineAlcohol({
      grams: 330,
      caffeineMgPer100g: 10,
      alcoholGPer100g: 1,
    });
    expect(result.caffeineMg).toBe(33);
    expect(result.alcoholG).toBe(3.3);
  });

  it("null caffeine / null alcohol → zero (never invents)", () => {
    const result = scaleCaffeineAlcohol({
      grams: 100,
      caffeineMgPer100g: null,
      alcoholGPer100g: null,
    });
    expect(result).toEqual({ caffeineMg: 0, alcoholG: 0 });
  });

  it("null grams → zero for both (never guesses a portion)", () => {
    expect(
      scaleCaffeineAlcohol({
        grams: null,
        caffeineMgPer100g: 100,
        alcoholGPer100g: 10,
      }),
    ).toEqual({ caffeineMg: 0, alcoholG: 0 });
  });

  it("zero grams → zero", () => {
    expect(
      scaleCaffeineAlcohol({
        grams: 0,
        caffeineMgPer100g: 100,
        alcoholGPer100g: 10,
      }),
    ).toEqual({ caffeineMg: 0, alcoholG: 0 });
  });

  it("negative grams rejected → zero (defensive)", () => {
    // A pathological negative gram weight must never decrement the daily
    // total through the auto-track path. Delete uses a negative *mg*
    // delta against the updater, not negative grams here.
    expect(
      scaleCaffeineAlcohol({
        grams: -50,
        caffeineMgPer100g: 40,
        alcoholGPer100g: 10,
      }),
    ).toEqual({ caffeineMg: 0, alcoholG: 0 });
  });

  it("non-finite grams (NaN, Infinity) → zero", () => {
    expect(
      scaleCaffeineAlcohol({
        grams: Number.NaN,
        caffeineMgPer100g: 40,
        alcoholGPer100g: 10,
      }),
    ).toEqual({ caffeineMg: 0, alcoholG: 0 });
    expect(
      scaleCaffeineAlcohol({
        grams: Number.POSITIVE_INFINITY,
        caffeineMgPer100g: 40,
        alcoholGPer100g: 10,
      }),
    ).toEqual({ caffeineMg: 0, alcoholG: 0 });
  });

  it("negative per-100 g values clamp to zero (defensive)", () => {
    // An upstream parse bug that hands us a negative nutrient must not
    // be allowed to subtract from the daily total via the auto-track
    // pipeline. Clamp silently at zero — the calling code can decide
    // whether to surface a warning.
    const result = scaleCaffeineAlcohol({
      grams: 100,
      caffeineMgPer100g: -10,
      alcoholGPer100g: -5,
    });
    expect(result).toEqual({ caffeineMg: 0, alcoholG: 0 });
  });

  it("non-finite per-100 g values → zero (never NaN)", () => {
    const result = scaleCaffeineAlcohol({
      grams: 100,
      caffeineMgPer100g: Number.NaN,
      alcoholGPer100g: Number.POSITIVE_INFINITY,
    });
    expect(result).toEqual({ caffeineMg: 0, alcoholG: 0 });
  });

  it("small portion (30 g espresso) with 213 mg/100g → 64 mg", () => {
    // Canonical espresso per-100 g ≈ 213 mg (source-in-test,
    // matches the mobile quick-add chip). 30 g shot → 64 mg. Used as
    // the representative end-to-end smoke case.
    const result = scaleCaffeineAlcohol({
      grams: 30,
      caffeineMgPer100g: 213,
      alcoholGPer100g: null,
    });
    expect(result.caffeineMg).toBe(64);
  });

  it("output is always >= 0", () => {
    for (const c of [0, 1, 500]) {
      for (const a of [0, 1, 50]) {
        const r = scaleCaffeineAlcohol({
          grams: 100,
          caffeineMgPer100g: c,
          alcoholGPer100g: a,
        });
        expect(r.caffeineMg).toBeGreaterThanOrEqual(0);
        expect(r.alcoholG).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("caffeine is rounded to an integer (storage shape)", () => {
    // 77 g × 43 mg/100 g = 33.11 mg → rounds to 33.
    const r = scaleCaffeineAlcohol({
      grams: 77,
      caffeineMgPer100g: 43,
      alcoholGPer100g: null,
    });
    expect(Number.isInteger(r.caffeineMg)).toBe(true);
    expect(r.caffeineMg).toBe(33);
  });

  it("alcohol is rounded to 1 decimal place (storage shape)", () => {
    // 125 g × 9.3 g/100 g = 11.625 g → rounds to 11.6 at 1 dp.
    const r = scaleCaffeineAlcohol({
      grams: 125,
      caffeineMgPer100g: null,
      alcoholGPer100g: 9.3,
    });
    expect(r.alcoholG).toBe(11.6);
    // 10 * value must be an integer after rounding to 1 dp.
    expect(Number.isInteger(Math.round(r.alcoholG * 10))).toBe(true);
  });
});
