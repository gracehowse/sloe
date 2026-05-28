import {
  buildOffServingOptionsFromProduct,
  pickDefaultServingGrams,
  type OffServingOption,
} from "./offServingPortions.ts";
import { parseOffMicrosPer100g } from "./parseOffMicros.ts";
import { reconcileOffPer100g } from "./reconcilePer100g.ts";

export type { OffServingOption };

export interface OffProductMacros {
  name: string;
  /** Nutrients per 100g (approximate; user can scale in the diary). */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  /** F-13 auto-track; null when OFF doesn't expose it. */
  caffeineMgPer100g?: number | null;
  alcoholGPer100g?: number | null;
  /**
   * F-79 (2026-04-25) — full OFF micronutrient set per 100g, in canonical
   * camelCase keys matching `MICRO_LINES` in `microNutrientDisplay.ts`.
   * Scale by `grams / 100` and merge into `nutrition_micros` at commit time
   * so the food-detail "Vitamins, minerals & more" panel renders real
   * values instead of "—" on every row.
   */
  microsPer100g?: Record<string, number>;
  servingLabel: string;
  /** If OFF provides a serving size like "50 g", parse to grams. */
  servingSizeG?: number;
  /** Label + gram weight presets (e.g. "4 dumplings", "1 dumpling (~20 g)", "100 g"). */
  servingOptions: OffServingOption[];
  /**
   * P0 (2026-05-26) — true when the published `*_100g` macros disagreed with
   * the per-serving basis and were reconstructed. Commit paths surface a
   * "double-check these numbers" warning when set.
   */
  basisCorrected?: boolean;
}

export async function fetchProductByBarcode(code: string): Promise<
  | { ok: true; product: OffProductMacros }
  | { ok: false; error: "not_found" | "network" | "invalid"; message?: string }
> {
  const trimmed = code.replace(/\s/g, "");
  if (!/^\d{8,14}$/.test(trimmed)) {
    return { ok: false, error: "invalid" };
  }
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(trimmed)}.json`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) {
      return { ok: false, error: "network", message: String(res.status) };
    }
    const data = (await res.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        product_name_en?: string;
        generic_name?: string;
        brands?: string;
        quantity?: string;
        serving_size?: string;
        serving_quantity?: string | number;
        serving_quantity_unit?: string;
        /** P0 (2026-05-26) — "100g" | "serving"; drives per-100g reconcile. */
        nutrition_data_per?: string;
        nutriments?: Record<string, number | undefined>;
      };
    };
    if (data.status !== 1 || !data.product) {
      return { ok: false, error: "not_found" };
    }
    const p = data.product;
    const n = p.nutriments ?? {};
    const baseName =
      (p.product_name ?? p.product_name_en ?? p.generic_name ?? "").trim() ||
      "Packaged food";
    const brand = (p.brands ?? "").split(",")[0]?.trim() ?? "";
    const qty = (p.quantity ?? "").trim();
    const name = [brand, baseName, qty].filter(Boolean).join(" · ");
    // P0 (2026-05-26) — reconcile macros to a genuine per-100g basis before
    // anything scales them. CRITICAL: dropped the per-serving fallbacks
    // (`?? n["energy-kcal"]`, `?? n.proteins`, etc.). Those bare fields are
    // PER-SERVING when `nutrition_data_per:"serving"` and were masquerading
    // as per-100g — a 500 g pot of Greek yogurt's per-pot energy then
    // scaled ×5 to a physically-impossible 1,325 kcal. reconcileOffPer100g
    // rebuilds per-100g from `*_serving` / `serving_quantity` and flags
    // basis disagreement. fiber/sugar/sodium stay on their `_100g` fields
    // only (no per-serving fallback) for the same reason.
    const recon = reconcileOffPer100g(n, p);
    // ENG-738 (2026-05-26) — fiber/sugar/sodium + micros below still read the
    // raw `*_100g` fields, which secretly hold per-serving values on a
    // `nutrition_data_per:"serving"` row. Rescale them onto the same
    // true-per-100g basis the macros use (factor = 1 for genuine per-100g).
    const f = recon.per100gFactor;
    const calories = Math.round(recon.calories);
    const protein = Math.round(recon.protein);
    const carbs = Math.round(recon.carbs);
    const fat = Math.round(recon.fat);
    const fiberG = Math.round((n.fiber_100g ?? 0) * f);
    // P0 (2026-05-26) — sugar/sodium use the `_100g` field only; the bare
    // `n.sugars` / `n.sodium` fallbacks were per-serving in disguise.
    const sugarG = Math.round((n["sugars_100g"] ?? 0) * f * 10) / 10;
    const sodiumMg = Math.round((n.sodium_100g ?? 0) * f * 1000);
    // F-79 (2026-04-25) — extract F-13 caffeine/alcohol + the full
    // micronutrient set so commit sites can persist them on
    // `nutrition_entries.nutrition_micros`. Caffeine/alcohol keep their
    // `_100g`-first reads (these are genuinely sparse, not per-serving
    // masqueraders) but reconcile already corrected the macro basis above.
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
    // ENG-738 — scale micros by the per-100g factor to match the macro basis.
    const microsPer100g = parseOffMicrosPer100g(n, f);
    const servingOptions = buildOffServingOptionsFromProduct(p);
    const servingSizeG = pickDefaultServingGrams(servingOptions);
    const rawServing = (p.serving_size ?? "").trim();
    return {
      ok: true,
      product: {
        name,
        calories,
        protein,
        carbs,
        fat,
        fiberG,
        sugarG,
        sodiumMg,
        caffeineMgPer100g,
        alcoholGPer100g,
        microsPer100g,
        servingLabel: rawServing ? `per 100 g (label: ${rawServing})` : "per 100 g (approximate)",
        servingSizeG,
        servingOptions,
        basisCorrected: recon.corrected,
      },
    };
  } catch (e) {
    return { ok: false, error: "network", message: e instanceof Error ? e.message : undefined };
  }
}
