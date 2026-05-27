/**
 * Volume → grams converter for custom-food entry (ENG-748 #15, 2026-05-27).
 *
 * MFP-parity gap from TestFlight feedback (`AMbt66gRLJwsjswlQ2aKpG4` —
 * "more options for servings different weights ... parity with mfp"):
 * users entering a custom food expect to type a volume measure ("1 cup",
 * "1 tbsp") and get grams. Previously `CreateCustomFoodSheet` only showed a
 * static "1 cup ≈ 240 g" reference line, which is silently WRONG for
 * non-water foods (a cup of flour ≈ 120 g, not 240 g).
 *
 * Nutrition-correctness rule (CLAUDE.md + nutrition-approximation-policy §A2):
 * volume → mass is density-dependent. We do NOT invent densities and we do
 * NOT silently assume water (1.0 g/ml) for arbitrary foods. This converter:
 *
 *   - Resolves density from the EXISTING sourced `STAPLES` table via
 *     `densityForName` (the same data the recipe nutrition engine uses —
 *     see `estimateIngredientMacros.ts`). No new density table is invented.
 *   - When the density is KNOWN, converts precisely via the shared
 *     `measureToGramsDetailed` (single source of truth for ml-per-unit
 *     constants) and returns `{ grams, densityKnown: true }`.
 *   - When the density is UNKNOWN, returns `{ densityKnown: false }` so the
 *     UI tells the user to enter grams manually rather than guessing.
 *
 * The one exception is water-like liquids the user names explicitly as
 * water — handled by the staple table (`water` has gPerMl 1.0). There is no
 * hardcoded fallback density here on purpose.
 */

import { densityForName } from "./estimateIngredientMacros";
import { measureToGramsDetailed } from "./measureToGrams";
import type { CupRegion } from "./measureToGrams";

/** Volume units this converter accepts. Mass/count units don't need it. */
export const VOLUME_UNITS = ["cup", "tbsp", "tsp", "ml", "l", "fl oz"] as const;
export type VolumeUnit = (typeof VOLUME_UNITS)[number];

export function isVolumeUnit(unit: string): unit is VolumeUnit {
  return (VOLUME_UNITS as readonly string[]).includes(unit.trim().toLowerCase());
}

export interface VolumeToGramsInput {
  /** Food name — used to resolve a known density. */
  foodName: string;
  /** Numeric amount of the volume unit (e.g. 1, 0.5, 2). */
  amount: number;
  unit: VolumeUnit;
  /** Cup convention. Defaults to US (matches the rest of the engine). */
  cupRegion?: CupRegion;
}

export type VolumeToGramsResult =
  | {
      /** A known density let us convert precisely. */
      densityKnown: true;
      grams: number;
      /** g/ml used, surfaced so the UI can show "(at 0.53 g/ml — flour)". */
      gPerMl: number;
    }
  | {
      /** Density unknown — caller must fall back to manual grams. */
      densityKnown: false;
    };

/**
 * Convert a volume measure to grams using a KNOWN density only.
 *
 * Returns `{ densityKnown: false }` when the food name can't be matched to a
 * staple with a density — the caller must NOT convert in that case.
 */
export function volumeToGrams(input: VolumeToGramsInput): VolumeToGramsResult {
  const amount = Number.isFinite(input.amount) && input.amount > 0 ? input.amount : NaN;
  if (!Number.isFinite(amount)) return { densityKnown: false };

  const gPerMl = densityForName(input.foodName);
  if (gPerMl === undefined) {
    // No sourced density — refuse to guess (nutrition-approximation-policy §A2).
    return { densityKnown: false };
  }

  // Delegate the ml-per-unit math to the shared resolver, passing the known
  // density so it never falls back to the 0.9 g/ml cup default.
  const { grams } = measureToGramsDetailed({
    name: input.foodName,
    amount,
    unit: input.unit,
    gPerMl,
    cupRegion: input.cupRegion,
  });

  return {
    densityKnown: true,
    // Round to 1 dp — grams entry doesn't need more precision than the scale.
    grams: Math.round(grams * 10) / 10,
    gPerMl,
  };
}
