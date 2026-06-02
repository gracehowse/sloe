/**
 * Shared macro calorie-split — the per-meal "P% / C% / F% of kcal" breakdown
 * used by the meal-nutrition detail surface on BOTH platforms.
 *
 * Web imports via `@/lib/nutrition/macroCalorieSplit`; mobile imports via
 * `@suppr/shared/nutrition/macroCalorieSplit` (the alias resolves to this same
 * file). Single source of truth so the rounding can never drift between web and
 * mobile — that drift is precisely what this extraction (P5 parity gap #15,
 * 2026-05-31) removes. Previously the algorithm lived as a private helper inside
 * `apps/mobile/app/meal-nutrition.tsx` with a mobile test re-implementing it to
 * pin the shape.
 *
 * Audit M01 (2026-05-05) — the three displayed percentages use largest-
 * remainder (Hamilton) rounding so they always sum to exactly 100. Plain
 * `Math.round` per macro produced sums of 99 / 101 on near-equal splits
 * (e.g. 33.4 / 33.4 / 33.3 → 33+33+33 = 99; 33.5 / 33.5 / 33.0 → 34+34+33 = 101).
 * This method floors each percentage, then adds 1 to the macros with the
 * largest fractional remainders until the sum hits 100. Atwater factors:
 * protein/carbs = 4 kcal/g, fat = 9 kcal/g.
 */

export type MacroCalorieSplitInput = {
  protein: number;
  carbs: number;
  fat: number;
};

export type MacroCalorieSplit = {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
};

/**
 * Compute the per-macro kcal contribution + the largest-remainder-rounded
 * percentage of total macro calories.
 *
 * Returns all-zero when the macros contribute no calories (so callers can
 * render a neutral skeleton rather than dividing by zero).
 */
export function macroCalorieSplit(m: MacroCalorieSplitInput): MacroCalorieSplit {
  const proteinKcal = (Number(m.protein) || 0) * 4;
  const carbsKcal = (Number(m.carbs) || 0) * 4;
  const fatKcal = (Number(m.fat) || 0) * 9;
  const sum = proteinKcal + carbsKcal + fatKcal;
  if (sum <= 0) {
    return { proteinPct: 0, carbsPct: 0, fatPct: 0, proteinKcal: 0, carbsKcal: 0, fatKcal: 0 };
  }

  const exact = [
    { key: "protein", value: (proteinKcal / sum) * 100 },
    { key: "carbs", value: (carbsKcal / sum) * 100 },
    { key: "fat", value: (fatKcal / sum) * 100 },
  ] as const;
  const floored = exact.map((e) => ({
    key: e.key,
    floor: Math.floor(e.value),
    remainder: e.value - Math.floor(e.value),
  }));
  let residual = 100 - floored.reduce((acc, e) => acc + e.floor, 0);
  // Sort indices by remainder descending; ties resolve in original macro
  // order (protein → carbs → fat) so output is deterministic.
  const indicesByRemainder = floored
    .map((e, i) => ({ i, remainder: e.remainder }))
    .sort((a, b) => b.remainder - a.remainder)
    .map((x) => x.i);
  const allocated = floored.map((e) => e.floor);
  for (let n = 0; n < indicesByRemainder.length && residual > 0; n++) {
    allocated[indicesByRemainder[n]!] += 1;
    residual -= 1;
  }

  return {
    proteinPct: allocated[0]!,
    carbsPct: allocated[1]!,
    fatPct: allocated[2]!,
    proteinKcal,
    carbsKcal,
    fatKcal,
  };
}
