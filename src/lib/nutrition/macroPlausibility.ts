// F-77 (2026-04-25) — reject physically-impossible OFF / Edamam / USDA-branded
// nutrition rows before they reach search results. Closes the "Eggs · 1 egg
// 40 g · 210 kcal · 3 g protein" failure mode where an OFF user-uploaded row
// for an unrelated food named "Eggs" outranked verified USDA generics.
//
// Atwater check: kcal_per_100g should be within tolerance of
// 4·protein + 4·carbs + 9·fat. Strict by default; the tolerance covers
// real-world rounding, alcohol kcal (7 kcal/g, not modelled here), fibre
// kcal differences, and per-source rounding on the macros.

export type MacrosPer100gShape = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type PlausibilityVerdict =
  | { ok: true }
  | { ok: false; reason: "atwater_mismatch" | "out_of_range" | "all_zero" | "single_macro_only" };

const KCAL_MIN = 0;
const KCAL_MAX = 900; // pure fat tops at 900 kcal/100g; anything above is junk
const TOL_ABS = 25;   // absolute kcal tolerance
const TOL_PCT = 0.20; // 20% relative tolerance

/**
 * Returns ok:true when the per-100g macros pass an Atwater plausibility
 * check. Use at every ingest point that can persist a search hit
 * (OFF search, OFF barcode lookup, Edamam search) so user-facing surfaces
 * never see a row whose claimed kcal does not match its claimed macros.
 *
 * Reasons:
 *  - all_zero: every macro AND kcal is 0/missing — caller should treat as
 *    "no nutrition data" and skip.
 *  - out_of_range: kcal/100g outside 0–900 window.
 *  - single_macro_only: only one macro is non-zero AND kcal is implied to
 *    come from that macro, but kcal disagrees with it (e.g. 210 kcal claimed
 *    from "3 g protein" alone). This catches the screenshot case.
 *  - atwater_mismatch: |kcal − (4P + 4C + 9F)| exceeds max(TOL_ABS, TOL_PCT·kcal).
 */
export function checkMacroPlausibility(m: MacrosPer100gShape): PlausibilityVerdict {
  const cal = Number(m.calories) || 0;
  const p = Number(m.protein) || 0;
  const c = Number(m.carbs) || 0;
  const f = Number(m.fat) || 0;

  if (cal === 0 && p === 0 && c === 0 && f === 0) {
    return { ok: false, reason: "all_zero" };
  }

  if (cal < KCAL_MIN || cal > KCAL_MAX) {
    return { ok: false, reason: "out_of_range" };
  }

  const atwater = 4 * p + 4 * c + 9 * f;
  const tol = Math.max(TOL_ABS, cal * TOL_PCT);
  const diff = Math.abs(cal - atwater);

  // Single-macro case (the screenshot bug): one macro non-zero, kcal
  // disagrees substantially with it.
  const nonZeroCount = (p > 0 ? 1 : 0) + (c > 0 ? 1 : 0) + (f > 0 ? 1 : 0);
  if (nonZeroCount === 1 && cal > 50 && diff > tol) {
    return { ok: false, reason: "single_macro_only" };
  }

  // General case: macros provided, but kcal disagrees with Atwater sum.
  // Skip the check when all three macros are zero (kcal-only row) — those
  // are handled by the all_zero / out_of_range cases above.
  if (nonZeroCount > 0 && diff > tol) {
    return { ok: false, reason: "atwater_mismatch" };
  }

  return { ok: true };
}

export function isPlausibleMacrosPer100g(m: MacrosPer100gShape): boolean {
  return checkMacroPlausibility(m).ok;
}

// ───────────────────────────────────────────────────────────────────────────
// P0 (2026-05-26) — post-scale log plausibility guard.
//
// The Atwater gate above runs on PER-100g source rows. It does NOT catch the
// "Chobani Greek yogurt · 500 g · 1,325 kcal · 265 g protein" failure, because
// the bug is in the SOURCE BASIS, not the macro internal consistency: an OFF
// product with `nutrition_data_per: "serving"` stores per-serving (per-500g)
// values in its `*_100g` fields, so the legitimate ×5 grams-scale becomes ×25.
// The scaled row is internally Atwater-consistent (265 P · 53 C · etc. roughly
// sum to 1,325 kcal), so the per-100g gate passes it.
//
// This guard runs on POST-SCALE macros for a KNOWN gram weight and rejects
// rows that are physically impossible for that mass. Thresholds are generous
// on purpose: pure oil (~884 kcal/100g, 9 kcal/g) and protein isolate
// (~90 g protein/100g) MUST pass; nothing edible exceeds them.
// ───────────────────────────────────────────────────────────────────────────

export type ScaledMacrosShape = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type ScaledLogPlausibilityResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "kcal_per_gram"
        | "protein_exceeds_mass"
        | "kcal_per_100g_ceiling"
        | "protein_per_100g_ceiling"
        | "carbs_per_100g_ceiling"
        | "fat_per_100g_ceiling"
        | "source_basis_mismatch";
    };

/**
 * Absolute ceilings for derived per-100g (post-scale macros ÷ (grams/100)).
 * Generous: pure fat/oil ~884 kcal/100g, protein isolate ~90 g/100g.
 */
export const SCALED_KCAL_PER_GRAM_MAX = 9.1; // pure fat ~9 kcal/g; nothing edible exceeds this
export const SCALED_PROTEIN_MASS_FRACTION_MAX = 0.95; // no whole food is >95% protein by mass
export const SCALED_KCAL_PER_100G_CEILING = 900;
export const SCALED_PROTEIN_PER_100G_CEILING = 90;
export const SCALED_CARBS_PER_100G_CEILING = 100;
export const SCALED_FAT_PER_100G_CEILING = 100;
/** OFF basis cross-check tolerance: scaled kcal vs (sourcePer100g.kcal × grams/100). */
export const SCALED_SOURCE_BASIS_TOLERANCE = 0.25; // 25%

/**
 * Plausibility guard for macros that have ALREADY been scaled to a known gram
 * weight (e.g. an OFF/USDA per-100g row × grams/100, a barcode portion, or a
 * recipe-import line resolved to grams). Returns `ok:false` with a reason when
 * the scaled row is physically impossible for that mass.
 *
 * When `sourcePer100g` is supplied (the panel the scaled macros were derived
 * from), the most direct catch fires: scaled kcal must be within 25% of
 * `sourcePer100g.calories × grams/100`. A `nutrition_data_per:"serving"` OFF
 * row whose `*_100g` fields actually hold per-serving values fails this cross-
 * check because the published "per-100g" kcal is really per-serving.
 *
 * @param macros post-scale macros (absolute kcal / grams for the portion)
 * @param grams  the gram weight `macros` was scaled to (> 0)
 * @param sourcePer100g optional per-100g panel the scale derived from
 */
export function checkScaledLogPlausibility(
  macros: ScaledMacrosShape,
  grams: number,
  sourcePer100g?: { calories: number; protein?: number; carbs?: number; fat?: number },
): ScaledLogPlausibilityResult {
  const kcal = Number(macros.calories) || 0;
  const p = Number(macros.protein) || 0;
  const c = Number(macros.carbs) || 0;
  const f = Number(macros.fat) || 0;
  const g = Number(grams) || 0;

  // No gram weight → can't reason about density; treat as plausible (the
  // per-100g Atwater gate covers the source row separately). Zero macros are
  // legitimate (e.g. water, a rounded-down tiny portion).
  if (g <= 0) return { ok: true };
  if (kcal === 0 && p === 0 && c === 0 && f === 0) return { ok: true };

  // 1. Energy density ceiling — nothing edible exceeds pure fat.
  if (kcal / g > SCALED_KCAL_PER_GRAM_MAX) {
    return { ok: false, reason: "kcal_per_gram" };
  }

  // 2. Protein cannot exceed ~95% of the food's mass.
  if (p > g * SCALED_PROTEIN_MASS_FRACTION_MAX) {
    return { ok: false, reason: "protein_exceeds_mass" };
  }

  // 3. Derived per-100g ceilings.
  const per100 = 100 / g;
  if (kcal * per100 > SCALED_KCAL_PER_100G_CEILING) {
    return { ok: false, reason: "kcal_per_100g_ceiling" };
  }
  if (p * per100 > SCALED_PROTEIN_PER_100G_CEILING) {
    return { ok: false, reason: "protein_per_100g_ceiling" };
  }
  if (c * per100 > SCALED_CARBS_PER_100G_CEILING) {
    return { ok: false, reason: "carbs_per_100g_ceiling" };
  }
  if (f * per100 > SCALED_FAT_PER_100G_CEILING) {
    return { ok: false, reason: "fat_per_100g_ceiling" };
  }

  // 4. Source-basis cross-check (the most direct catch for the OFF
  //    per-serving-masquerading-as-per-100g bug). Only runs when the caller
  //    can supply the panel the scale was derived from.
  if (sourcePer100g && Number.isFinite(sourcePer100g.calories) && sourcePer100g.calories > 0) {
    const expectedKcal = sourcePer100g.calories * (g / 100);
    if (expectedKcal > 0) {
      const diff = Math.abs(kcal - expectedKcal);
      const tol = expectedKcal * SCALED_SOURCE_BASIS_TOLERANCE;
      if (diff > tol) {
        return { ok: false, reason: "source_basis_mismatch" };
      }
    }
  }

  return { ok: true };
}

/** Boolean convenience wrapper for {@link checkScaledLogPlausibility}. */
export function isPlausibleScaledLog(
  macros: ScaledMacrosShape,
  grams: number,
  sourcePer100g?: { calories: number; protein?: number; carbs?: number; fat?: number },
): boolean {
  return checkScaledLogPlausibility(macros, grams, sourcePer100g).ok;
}
