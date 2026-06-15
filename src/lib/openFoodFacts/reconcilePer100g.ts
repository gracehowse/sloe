/**
 * P0 (2026-05-26) — Open Food Facts per-100g hardening.
 *
 * Root cause of the "Chobani Greek yogurt · 500 g · 1,325 kcal · 265 g
 * protein" bug: OFF products with `nutrition_data_per: "serving"` (or that
 * only publish per-serving fields) store per-serving values in the `*_100g`
 * fields. Trusting `energy-kcal_100g` as genuine per-100g means the
 * legitimate ×5 grams-scale on a 500 g portion silently becomes ×25.
 *
 * This module reconstructs the TRUE per-100g basis from the per-serving
 * fields + `serving_quantity`, cross-checks it against the published
 * `*_100g`, and tells the caller whether the published values are
 * trustworthy. Per CLAUDE.md "reject low-confidence matches" — when the two
 * bases disagree beyond tolerance we prefer the reconstructed value (or
 * signal the caller to drop the row). We never invent a value.
 *
 * No `@/` alias — imported directly by mobile via `@suppr/shared/...`.
 */

type Nutriments = Record<string, number | string | undefined>;

/** Tolerance for "published per-100g agrees with reconstructed per-100g". */
export const OFF_BASIS_DISAGREEMENT_TOLERANCE = 0.25; // 25%

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number.parseFloat(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * `serving_quantity` is OFF's machine-readable serving mass. It is usually
 * grams, but `serving_quantity_unit` can be "ml"; for nutrition-basis math
 * we treat the numeric quantity as the denominator regardless (per-serving
 * fields are published against exactly this quantity).
 */
function servingQuantityGrams(product: {
  serving_quantity?: string | number;
}): number | null {
  const sq = num(product.serving_quantity);
  if (sq != null && sq > 0 && sq < 100_000) return sq;
  return null;
}

export type ReconciledPer100gMacro = {
  /** The value to trust for per-100g (kcal or grams). */
  value: number;
  /** True when the published `_100g` field disagreed with the reconstructed basis. */
  corrected: boolean;
};

/**
 * Reconcile a single nutriment to per-100g.
 *
 * @param published the `*_100g` field value (may be per-serving in disguise)
 * @param perServing the `*_serving` field value
 * @param servingG `serving_quantity` (the mass the per-serving fields apply to)
 * @param treatServingAsTruth when true (basis is per-serving), prefer the
 *   reconstructed value on disagreement; when false, prefer published.
 */
function reconcileOne(
  published: number | null,
  perServing: number | null,
  servingG: number | null,
  treatServingAsTruth: boolean,
): ReconciledPer100gMacro {
  const pub = published ?? 0;

  // Can't reconstruct without both a per-serving value and a serving mass.
  if (perServing == null || servingG == null || servingG <= 0) {
    // ENG-774: a product that DECLARES a per-serving basis but omits
    // `serving_quantity` gives us no mass to reconstruct or verify — its
    // published `*_100g` field may actually hold per-serving values (the
    // Chobani-class bug) and we cannot correct it. Flag the row so the existing
    // soft-warn fires ("double-check these numbers") and confidence is demoted;
    // never silently trust it. The value is left as `pub` (we have nothing
    // better) and `per100gFactor` stays 1 (no scaling on an unverifiable row).
    // A genuine per-100g row, or a serving-basis row that still has a mass but
    // is missing only THIS macro's per-serving value, is not the documented
    // danger — leave those unflagged.
    const noServingMass = servingG == null || servingG <= 0;
    return { value: pub, corrected: treatServingAsTruth && noServingMass && pub > 0 };
  }

  const reconstructed = perServing / (servingG / 100);
  if (!Number.isFinite(reconstructed) || reconstructed < 0) {
    return { value: pub, corrected: false };
  }

  // If there is no published per-100g at all, the reconstruction is all we
  // have — use it.
  if (pub <= 0) {
    return { value: Math.round(reconstructed * 100) / 100, corrected: reconstructed > 0 };
  }

  const diff = Math.abs(pub - reconstructed);
  const tol = Math.max(reconstructed, pub) * OFF_BASIS_DISAGREEMENT_TOLERANCE;
  const disagrees = diff > tol;

  if (!disagrees) {
    // Bases agree — published is genuine per-100g.
    return { value: pub, corrected: false };
  }

  // Bases disagree. When the declared basis is per-serving, the published
  // `_100g` field is the suspect one (it actually holds per-serving values),
  // so prefer the reconstructed per-100g. Otherwise (basis is per-100g but
  // the per-serving math disagrees) we keep the published value but flag the
  // row as corrected/low-confidence so the caller can demote it.
  return {
    value: treatServingAsTruth ? Math.round(reconstructed * 100) / 100 : pub,
    corrected: true,
  };
}

export type ReconciledOffPer100g = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /**
   * True when ANY macro's published `_100g` disagreed with the reconstructed
   * per-serving basis beyond tolerance. Callers should treat the row as
   * low-confidence — prefer the reconstructed values (already applied here)
   * or drop the product from results.
   */
  corrected: boolean;
  /**
   * True when the product declares a per-serving basis (`nutrition_data_per`
   * === "serving" OR a `serving_quantity` is present). Drives which side wins
   * a disagreement.
   */
  servingBasis: boolean;
  /**
   * ENG-774 — declared serving-basis row with no convertible serving mass
   * (`serving_quantity` absent or zero). Per-100g reconstruction is
   * unverifiable; callers should prefer `extractOffMacrosPerServing`.
   */
  servingNoMass: boolean;
  /**
   * ENG-738 (2026-05-26) — the multiplier that converts a RAW `*_100g`
   * nutriment (which secretly holds per-serving data on a corrected
   * serving-basis row) to a TRUE per-100g value. It is the SAME transform
   * `reconcileOne` applied to the macros above, so micros / fiber / sugar /
   * sodium — which are still read straight off the raw `*_100g` fields at the
   * call sites — can be brought onto the same basis as the macros.
   *
   * - When the row was corrected (serving-basis, mislabeled): the energy
   *   ratio `recon.calories / rawEnergyKcal100g` (guarded `rawEnergy > 0`),
   *   falling back to `100 / serving_quantity` when energy is absent.
   * - Otherwise (not serving-basis, or bases agreed): `1` — a no-op, the
   *   common case. Multiplying any raw value by 1 leaves it unchanged.
   */
  per100gFactor: number;
};

export type OffMacrosPerServing = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** Read per-serving macro fields when the label publishes no gram mass. */
export function extractOffMacrosPerServing(n: Nutriments): OffMacrosPerServing | null {
  const cal = num(n["energy-kcal_serving"]);
  const protein = num(n.proteins_serving);
  const carbs = num(n.carbohydrates_serving);
  const fat = num(n.fat_serving);
  if (cal == null && protein == null && carbs == null && fat == null) return null;
  return {
    calories: Math.round(cal ?? 0),
    protein: Math.round((protein ?? 0) * 10) / 10,
    carbs: Math.round((carbs ?? 0) * 10) / 10,
    fat: Math.round((fat ?? 0) * 10) / 10,
  };
}

/**
 * Reconstruct trustworthy per-100g macros from an OFF nutriments payload.
 *
 * @param nutriments the OFF `product.nutriments` object
 * @param product the OFF product (for `nutrition_data_per` / `serving_quantity`)
 */
export function reconcileOffPer100g(
  nutriments: Nutriments,
  product: {
    nutrition_data_per?: string;
    serving_quantity?: string | number;
  },
): ReconciledOffPer100g {
  const n = nutriments ?? {};
  const declaredServingBasis =
    String(product.nutrition_data_per ?? "").toLowerCase() === "serving";
  const servingG = servingQuantityGrams(product);
  // Per the spec: per-serving basis when `nutrition_data_per === "serving"`
  // OR a `serving_quantity` is present. The reconstruction only fires when we
  // also have per-serving fields + a serving mass, so a present
  // `serving_quantity` with agreeing bases is a no-op (the common case).
  const servingBasis = declaredServingBasis || servingG != null;
  const servingNoMass = servingBasis && (servingG == null || servingG <= 0);

  const cal = reconcileOne(
    num(n["energy-kcal_100g"]),
    num(n["energy-kcal_serving"]),
    servingG,
    servingBasis,
  );
  const protein = reconcileOne(
    num(n.proteins_100g),
    num(n.proteins_serving),
    servingG,
    servingBasis,
  );
  const carbs = reconcileOne(
    num(n.carbohydrates_100g),
    num(n.carbohydrates_serving),
    servingG,
    servingBasis,
  );
  const fat = reconcileOne(num(n.fat_100g), num(n.fat_serving), servingG, servingBasis);

  const corrected = cal.corrected || protein.corrected || carbs.corrected || fat.corrected;

  // ENG-738 — derive the raw-`*_100g` → true-per-100g multiplier so the
  // micros / fiber / sugar / sodium reads at the call sites land on the same
  // basis as the macros. When nothing was corrected the factor is 1 (no-op).
  const rawEnergyKcal100g = num(n["energy-kcal_100g"]);
  let per100gFactor = 1;
  if (corrected) {
    if (rawEnergyKcal100g != null && rawEnergyKcal100g > 0) {
      // Prefer the energy ratio: it is exactly the transform reconcileOne
      // applied to the (now-trusted) per-100g calories.
      per100gFactor = cal.value / rawEnergyKcal100g;
    } else if (servingG != null && servingG > 0) {
      // Energy absent — fall back to the serving-mass ratio (per-serving
      // fields are published against `serving_quantity` grams).
      per100gFactor = 100 / servingG;
    }
  }
  // Guard against a degenerate ratio (NaN / ≤0) — never scale by garbage.
  if (!Number.isFinite(per100gFactor) || per100gFactor <= 0) {
    per100gFactor = 1;
  }

  return {
    calories: cal.value,
    protein: protein.value,
    carbs: carbs.value,
    fat: fat.value,
    corrected,
    servingBasis,
    servingNoMass,
    per100gFactor,
  };
}
