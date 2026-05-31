import { scaleMicrosPerServing } from "./scaleMicrosPerServing";

/**
 * Scale a logged entry's fibre + micros when its portion changes.
 *
 * The edit-entry sheet (mobile `saveEditMeal` in `app/(tabs)/index.tsx`,
 * and the forthcoming web parity dialog) only exposes kcal / P / C / F
 * fields. Fibre and the full micros map (sugar, sodium, vitamins…) have no
 * field, so when the user changes the portion they must be scaled by the
 * same ratio the four macros move. Without this they ride through the
 * entry-update spread unchanged, so a 0.5× edit halves the four macros but
 * leaves fibre / sugar / sodium at the original amount.
 *
 * `ratio` is the new portion divided by the portion the entry was opened
 * at. Stored macros are baked (display-ready) on both platforms — see
 * `scaledMacro` / `dayPlanTotalsFromMeals` in `portionMultiplier.ts` — so
 * scaling the baked fibre by `newPortion / oldPortion` lands it at the new
 * baked amount, consistent with how the four macros are stored.
 *
 * A ratio of exactly 1 (or a non-finite / non-positive ratio) is a no-op:
 * an empty object is returned so the caller's existing `...meal` spread
 * stays authoritative — a title-or-slot-only edit never re-rounds fibre or
 * drops a zero-valued micro.
 */
export function scaleLoggedMealFiberAndMicros(input: {
  fiberG?: number | null;
  micros?: Record<string, number> | null;
  ratio: number;
}): { fiberG?: number; micros?: Record<string, number> } {
  const { fiberG, micros, ratio } = input;
  if (!Number.isFinite(ratio) || ratio <= 0 || Math.abs(ratio - 1) <= 1e-6) {
    return {};
  }
  const out: { fiberG?: number; micros?: Record<string, number> } = {};
  if (fiberG != null && Number.isFinite(fiberG)) {
    out.fiberG = Math.round(fiberG * ratio * 10) / 10;
  }
  if (micros) {
    out.micros = scaleMicrosPerServing(micros, ratio);
  }
  return out;
}
