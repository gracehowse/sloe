/**
 * Search Open Food Facts by text query.
 * Works worldwide — uses local product names (courgette, aubergine, digestives, etc.)
 * and covers UK, EU, US, AU products.
 */

import { isPlausibleMacrosPer100g } from "../nutrition/macroPlausibility";
import { parseOffMicrosPer100g } from "./parseOffMicros";
import { reconcileOffPer100g } from "./reconcilePer100g";

export type OffSearchHit = {
  code: string;
  name: string;
  brand: string;
  /** per 100g */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  /** F-13 — null when OFF did not publish caffeine / alcohol. */
  caffeineMgPer100g?: number | null;
  alcoholGPer100g?: number | null;
  imageUrl?: string | null;
  servingSize?: string | null;
  /**
   * P0 (2026-05-26) — true when the published `*_100g` fields disagreed with
   * the per-serving basis and were reconstructed (or the row is otherwise
   * low-confidence on basis). Callers may demote / drop these rows.
   */
  _basisCorrected?: boolean;
  /** F-79 — full micronutrient set per 100g, canonical camelCase keys. */
  microsPer100g?: Record<string, number>;
  /** ENG-1305 — Unix seconds, OFF's last-edit timestamp. See `offStaleness.ts`. */
  lastModifiedT?: number | null;
};

/**
 * Search OFF by text. Uses world.openfoodfacts.org which covers all regions.
 * For better UK results, can also try uk.openfoodfacts.org.
 */
export async function searchOffProducts(
  query: string,
  opts?: { pageSize?: number; page?: number; countryTag?: string; timeoutMs?: number },
): Promise<OffSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const pageSize = opts?.pageSize ?? 10;
  const page = opts?.page && opts.page > 0 ? Math.floor(opts.page) : 1;
  const params = new URLSearchParams({
    search_terms: q,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(pageSize),
    page: String(page),
    // P0 (2026-05-26) — request `nutrition_data_per` + `serving_quantity` so
    // we can detect rows whose `*_100g` fields actually hold per-serving
    // values and reconstruct a genuine per-100g basis (reconcileOffPer100g).
    // ENG-1305 / ENG-1326 — last_modified_t powers corpus-derived staleness demotion
    // in verifyIngredients.ts (see offStaleness.ts).
    fields:
      "code,product_name,brands,nutriments,image_small_url,serving_size,nutrition_data_per,serving_quantity,last_modified_t",
  });
  // Optionally filter by country (e.g. "united-kingdom", "france")
  if (opts?.countryTag) {
    params.set("tagtype_0", "countries");
    params.set("tag_contains_0", "contains");
    params.set("tag_0", opts.countryTag);
  }

  const timeoutMs = opts?.timeoutMs && opts.timeoutMs > 0 ? Math.floor(opts.timeoutMs) : 12_000;

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "SupprNutritionVerifier/1.0",
        },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) return [];
    const text = await res.text();
    let data: { products?: unknown[] };
    try {
      data = JSON.parse(text);
    } catch {
      return [];
    }
    if (!Array.isArray(data.products)) return [];

    return data.products
      .filter((p: any) => p.product_name && p.nutriments)
      .map((p: any) => {
        const n = p.nutriments ?? {};
        // P0 (2026-05-26) — reconcile macros to a genuine per-100g basis.
        // For `nutrition_data_per:"serving"` rows the published `*_100g`
        // fields can secretly be per-serving (per-500g for a 500 g pot of
        // yogurt); reconcileOffPer100g rebuilds them from `*_serving` /
        // `serving_quantity` and flags the row when the bases disagree.
        const recon = reconcileOffPer100g(n, p);
        // ENG-738 (2026-05-26) — micros + fiber/sugar/sodium are read straight
        // off the raw `*_100g` fields, which on a `nutrition_data_per:"serving"`
        // row secretly hold per-serving values. Rescale them onto the same
        // true-per-100g basis the macros use via recon.per100gFactor (=1 for
        // genuine per-100g rows, a no-op).
        const f = recon.per100gFactor;
        const caffRaw = n.caffeine_100g ?? n.caffeine;
        const caffeineMgPer100g =
          typeof caffRaw === "number" && Number.isFinite(caffRaw) && caffRaw > 0
            ? Math.round(caffRaw * f * 1000 * 10) / 10
            : null;
        const alcRaw = n.alcohol_100g ?? n.alcohol;
        const alcoholGPer100g =
          typeof alcRaw === "number" && Number.isFinite(alcRaw) && alcRaw > 0
            ? Math.round(alcRaw * f * 100) / 100
            : null;
        return {
          code: p.code ?? "",
          name: p.product_name ?? "Unknown",
          brand: (p.brands ?? "").split(",")[0]?.trim() ?? "",
          calories: Math.round(recon.calories),
          protein: Math.round(recon.protein * 10) / 10,
          carbs: Math.round(recon.carbs * 10) / 10,
          fat: Math.round(recon.fat * 10) / 10,
          fiberG: Math.round((n.fiber_100g ?? 0) * f * 10) / 10,
          sugarG: Math.round((n["sugars_100g"] ?? 0) * f * 10) / 10,
          sodiumMg: Math.round((n.sodium_100g ?? 0) * f * 1000),
          caffeineMgPer100g,
          alcoholGPer100g,
          imageUrl: p.image_small_url ?? null,
          servingSize:
            typeof p.serving_size === "string" && p.serving_size.trim()
              ? p.serving_size.trim()
              : null,
          _basisCorrected: recon.corrected,
          // F-79 — pull every micro OFF exposes; commit sites scale + persist.
          // ENG-738 — scaled by the per-100g factor to match the macro basis.
          microsPer100g: parseOffMicrosPer100g(n, f),
          lastModifiedT: typeof p.last_modified_t === "number" ? p.last_modified_t : null,
        };
      })
      // F-77 (2026-04-25) — drop OFF rows that fail an Atwater plausibility
      // check. Closes the "Eggs · 210 kcal · 3 g protein" failure mode.
      .filter((h) =>
        isPlausibleMacrosPer100g({
          calories: h.calories,
          protein: h.protein,
          carbs: h.carbs,
          fat: h.fat,
        }),
      );
  } catch {
    return [];
  }
}
