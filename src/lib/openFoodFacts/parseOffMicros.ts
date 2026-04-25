/**
 * F-79 (2026-04-25) — extract the full micronutrient set from an OFF
 * `nutriments` payload into the canonical camelCase keys used by
 * `nutrition_micros` jsonb. Output is per-100g, ready to be scaled by
 * (grams / 100) at the commit site.
 *
 * Key conventions match `MICRO_LINES` in `microNutrientDisplay.ts`. OFF
 * reports mass in grams across the board (sodium / cholesterol / caffeine
 * / minerals / vitamins) — convert to mg or mcg per the display row.
 *
 * Only positive finite numbers survive; absent / zero / NaN values are
 * dropped so the resulting object matches `parseNutritionMicrosJson`'s
 * "drop zero / non-finite" rule (see `apps/mobile/lib/nutritionJournal.ts`).
 */

type Nutriments = Record<string, number | undefined>;

/** Read the first non-zero finite number from a list of OFF nutriment keys. */
function read(n: Nutriments, keys: readonly string[]): number {
  for (const k of keys) {
    const raw = n[k];
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  }
  return 0;
}

function emit(out: Record<string, number>, key: string, value: number, decimals: number): void {
  if (!Number.isFinite(value) || value <= 0) return;
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  if (rounded > 0) out[key] = rounded;
}

/**
 * Parse an OFF `nutriments` payload into a per-100g `nutrition_micros`-shaped
 * record. Caller must scale by `grams / 100` before persisting on a logged
 * food entry. The shape is additive: keys missing from OFF are simply absent
 * (renders "—" in the display).
 *
 * NOTE: this helper does NOT handle kcal/protein/carbs/fat — those are
 * already top-level columns on `nutrition_entries` (`calories`, `protein`,
 * `carbs`, `fat`). Sugar/sodium/fiber overlap with the existing parser at
 * `fetchProductByBarcode.ts` so callers can pick whichever they need.
 */
export function parseOffMicrosPer100g(nutriments: Nutriments | null | undefined): Record<string, number> {
  const n = nutriments ?? {};
  const out: Record<string, number> = {};

  // Sugars / fibre / sodium — already extracted by the macro parser, but
  // emit here too so callers using only this helper get a complete shape.
  emit(out, "sugarG", read(n, ["sugars_100g", "sugars"]), 1);
  emit(out, "fiberG", read(n, ["fiber_100g", "fiber"]), 1);
  // OFF sodium is in g per 100g; convert to mg.
  emit(out, "sodiumMg", read(n, ["sodium_100g", "sodium"]) * 1000, 0);

  // Fat breakdown — all in grams.
  emit(out, "saturatedFatG", read(n, ["saturated-fat_100g", "saturated-fat"]), 1);
  emit(out, "monoFatG", read(n, ["monounsaturated-fat_100g", "monounsaturated-fat"]), 1);
  emit(out, "polyFatG", read(n, ["polyunsaturated-fat_100g", "polyunsaturated-fat"]), 1);
  emit(out, "transFatG", read(n, ["trans-fat_100g", "trans-fat"]), 1);

  // Cholesterol + caffeine — OFF reports in grams; convert to mg.
  emit(out, "cholesterolMg", read(n, ["cholesterol_100g", "cholesterol"]) * 1000, 0);
  emit(out, "caffeineMg", read(n, ["caffeine_100g", "caffeine"]) * 1000, 1);

  // Minerals — OFF in grams → mg (or mcg for trace minerals).
  emit(out, "calciumMg", read(n, ["calcium_100g", "calcium"]) * 1000, 0);
  emit(out, "ironMg", read(n, ["iron_100g", "iron"]) * 1000, 1);
  emit(out, "magnesiumMg", read(n, ["magnesium_100g", "magnesium"]) * 1000, 0);
  emit(out, "phosphorusMg", read(n, ["phosphorus_100g", "phosphorus"]) * 1000, 0);
  emit(out, "potassiumMg", read(n, ["potassium_100g", "potassium"]) * 1000, 0);
  emit(out, "zincMg", read(n, ["zinc_100g", "zinc"]) * 1000, 1);
  emit(out, "copperMg", read(n, ["copper_100g", "copper"]) * 1000, 2);
  emit(out, "manganeseMg", read(n, ["manganese_100g", "manganese"]) * 1000, 2);
  emit(out, "chlorideMg", read(n, ["chloride_100g", "chloride"]) * 1000, 0);
  emit(out, "seleniumMcg", read(n, ["selenium_100g", "selenium"]) * 1_000_000, 0);
  emit(out, "iodineMcg", read(n, ["iodine_100g", "iodine"]) * 1_000_000, 0);
  emit(out, "chromiumMcg", read(n, ["chromium_100g", "chromium"]) * 1_000_000, 0);
  emit(out, "molybdenumMcg", read(n, ["molybdenum_100g", "molybdenum"]) * 1_000_000, 0);

  // Vitamins — OFF in grams → mg or mcg per display convention.
  emit(out, "thiaminMg", read(n, ["vitamin-b1_100g", "vitamin-b1"]) * 1000, 2);
  emit(out, "riboflavinMg", read(n, ["vitamin-b2_100g", "vitamin-b2"]) * 1000, 2);
  emit(out, "niacinMg", read(n, ["vitamin-pp_100g", "vitamin-pp", "vitamin-b3_100g", "vitamin-b3"]) * 1000, 1);
  emit(out, "pantothenicAcidMg", read(n, ["pantothenic-acid_100g", "pantothenic-acid", "vitamin-b5_100g", "vitamin-b5"]) * 1000, 2);
  emit(out, "vitaminB6Mg", read(n, ["vitamin-b6_100g", "vitamin-b6"]) * 1000, 2);
  emit(out, "biotinMcg", read(n, ["biotin_100g", "biotin", "vitamin-b8_100g", "vitamin-b8"]) * 1_000_000, 0);
  emit(out, "folateMcg", read(n, ["folates_100g", "folates", "folate_100g", "folate", "vitamin-b9_100g", "vitamin-b9"]) * 1_000_000, 0);
  emit(out, "vitaminB12Mcg", read(n, ["vitamin-b12_100g", "vitamin-b12"]) * 1_000_000, 1);
  emit(out, "vitaminCMg", read(n, ["vitamin-c_100g", "vitamin-c"]) * 1000, 1);
  emit(out, "vitaminDMcg", read(n, ["vitamin-d_100g", "vitamin-d"]) * 1_000_000, 1);
  emit(out, "vitaminEMg", read(n, ["vitamin-e_100g", "vitamin-e"]) * 1000, 1);
  emit(out, "vitaminKMcg", read(n, ["vitamin-k_100g", "vitamin-k"]) * 1_000_000, 1);
  emit(out, "vitaminAMcgRae", read(n, ["vitamin-a_100g", "vitamin-a"]) * 1_000_000, 0);

  return out;
}

/**
 * Scale a per-100g micros record by `grams / 100`. Returns a fresh object;
 * drops zero/non-finite values so the result is safe to spread directly into
 * `nutrition_micros`. Keys present in `merge` (e.g. F-13 caffeine/alcohol
 * already computed) win over the scaled OFF micros.
 */
export function scaleMicrosForGrams(
  per100g: Record<string, number>,
  grams: number,
  merge: Record<string, number> = {},
): Record<string, number> {
  const factor = grams > 0 ? grams / 100 : 0;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(per100g)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    const scaled = v * factor;
    if (!Number.isFinite(scaled) || scaled <= 0) continue;
    // Decimals — keep 1dp for grams, 0dp for mg/mcg, 1dp for explicit mg
    // values where 0 would lose meaning. Cheap heuristic from key suffix.
    const decimals = k.endsWith("G") ? 1 : k.endsWith("Mcg") ? 0 : k === "caffeineMg" || k === "ironMg" || k === "vitaminB12Mcg" ? 1 : 0;
    const factor2 = 10 ** decimals;
    const rounded = Math.round(scaled * factor2) / factor2;
    if (rounded > 0) out[k] = rounded;
  }
  // Caller-provided overrides (e.g. F-13 caffeine/alcohol explicitly computed).
  for (const [k, v] of Object.entries(merge)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    out[k] = v;
  }
  return out;
}
