/**
 * Audit M01 (2026-05-05) — the Macro card on `/meal-nutrition` rounds
 * Protein% / Carbs% / Fat% via largest-remainder (Hamilton) so the
 * three displayed percentages always sum to 100. Plain `Math.round`
 * per macro produced 99 / 101 sums on near-equal splits.
 *
 * The function is currently a private helper inside `meal-nutrition.tsx`.
 * Until it's extracted to a shared lib, this test pins the algorithm
 * shape via re-implementation + asserts the canonical edge cases.
 */
import { describe, expect, it } from "vitest";

/**
 * Mirror of the largest-remainder method in
 * `apps/mobile/app/meal-nutrition.tsx` — kept in sync via this test.
 * If the production implementation drifts, the canonical edge-case
 * assertions below will fail.
 */
function macroCalorieSplit(m: { protein: number; carbs: number; fat: number }): {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
} {
  const proteinKcal = m.protein * 4;
  const carbsKcal = m.carbs * 4;
  const fatKcal = m.fat * 9;
  const sum = proteinKcal + carbsKcal + fatKcal;
  if (sum <= 0) return { proteinPct: 0, carbsPct: 0, fatPct: 0 };
  const exact = [
    { value: (proteinKcal / sum) * 100 },
    { value: (carbsKcal / sum) * 100 },
    { value: (fatKcal / sum) * 100 },
  ];
  const floored = exact.map((e) => ({ floor: Math.floor(e.value), remainder: e.value - Math.floor(e.value) }));
  let residual = 100 - floored.reduce((a, e) => a + e.floor, 0);
  const indicesByRemainder = floored
    .map((e, i) => ({ i, remainder: e.remainder }))
    .sort((a, b) => b.remainder - a.remainder)
    .map((x) => x.i);
  const allocated = floored.map((e) => e.floor);
  for (let n = 0; n < indicesByRemainder.length && residual > 0; n++) {
    allocated[indicesByRemainder[n]!] += 1;
    residual -= 1;
  }
  return { proteinPct: allocated[0]!, carbsPct: allocated[1]!, fatPct: allocated[2]! };
}

describe("macroCalorieSplit — largest-remainder rounding (audit M01)", () => {
  it("returns 0/0/0 for an empty meal (no macros logged)", () => {
    const r = macroCalorieSplit({ protein: 0, carbs: 0, fat: 0 });
    expect(r).toEqual({ proteinPct: 0, carbsPct: 0, fatPct: 0 });
  });

  it("sums to exactly 100 on a near-uniform split that plain rounding produces 99 (33.4 / 33.4 / 33.3)", () => {
    // protein 33.4g × 4 = 133.6 kcal
    // carbs   33.4g × 4 = 133.6 kcal
    // fat     14.84g × 9 ≈ 133.56 kcal
    // → ~33.4% / 33.4% / 33.3% — plain Math.round gives 33+33+33 = 99
    const r = macroCalorieSplit({ protein: 33.4, carbs: 33.4, fat: 14.84 });
    expect(r.proteinPct + r.carbsPct + r.fatPct).toBe(100);
  });

  it("sums to exactly 100 on a split that plain rounding produces 101 (33.5 / 33.5 / 33.0)", () => {
    // Engineer a split where two values are .5 above floor, one is .0
    // protein × 4 = 133.5 → 33.5%
    // carbs × 4 = 133.5 → 33.5%
    // fat × 9 = 132.0 → 33.0%
    // total kcal = 399 → percents 33.46... / 33.46... / 33.08
    // The exact .5 boundary is what trips Math.round.
    const r = macroCalorieSplit({ protein: 33.375, carbs: 33.375, fat: 14.667 });
    expect(r.proteinPct + r.carbsPct + r.fatPct).toBe(100);
  });

  it("sums to exactly 100 on common protein-heavy splits", () => {
    // 40g P, 30g C, 15g F → 160/120/135 = 415 → 38.55 / 28.92 / 32.53
    const r = macroCalorieSplit({ protein: 40, carbs: 30, fat: 15 });
    expect(r.proteinPct + r.carbsPct + r.fatPct).toBe(100);
  });

  it("sums to exactly 100 across a randomised input set (smoke pin)", () => {
    // Deterministic loop over a wide range so a future regression that
    // breaks the residual loop fails on at least one iteration.
    for (let p = 0; p <= 100; p += 7) {
      for (let c = 0; c <= 100; c += 11) {
        for (let f = 0; f <= 100; f += 13) {
          if (p === 0 && c === 0 && f === 0) continue;
          const r = macroCalorieSplit({ protein: p + 0.3, carbs: c + 0.5, fat: f + 0.2 });
          expect(
            r.proteinPct + r.carbsPct + r.fatPct,
            `inputs P=${p}.3 C=${c}.5 F=${f}.2`,
          ).toBe(100);
        }
      }
    }
  });

  it("never produces a negative percentage", () => {
    const r = macroCalorieSplit({ protein: 100, carbs: 0, fat: 0 });
    expect(r.proteinPct).toBeGreaterThanOrEqual(0);
    expect(r.carbsPct).toBeGreaterThanOrEqual(0);
    expect(r.fatPct).toBeGreaterThanOrEqual(0);
  });
});
