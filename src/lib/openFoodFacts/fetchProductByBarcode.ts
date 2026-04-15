import {
  buildOffServingOptionsFromProduct,
  pickDefaultServingGrams,
  type OffServingOption,
} from "./offServingPortions.ts";

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
  servingLabel: string;
  /** If OFF provides a serving size like "50 g", parse to grams. */
  servingSizeG?: number;
  /** Label + gram weight presets (e.g. "4 dumplings", "1 dumpling (~20 g)", "100 g"). */
  servingOptions: OffServingOption[];
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
      { headers: { Accept: "application/json" } },
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
    const calories = Math.round(n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0);
    const protein = Math.round(n.proteins_100g ?? n.proteins ?? 0);
    const carbs = Math.round(n.carbohydrates_100g ?? n.carbohydrates ?? 0);
    const fat = Math.round(n.fat_100g ?? n.fat ?? 0);
    const fiberG = Math.round(n.fiber_100g ?? n.fiber ?? 0);
    const sugarG = Math.round((n["sugars_100g"] ?? n.sugars ?? 0) * 10) / 10;
    const sodiumMg = Math.round((n.sodium_100g ?? n.sodium ?? 0) * 1000);
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
        servingLabel: rawServing ? `per 100 g (label: ${rawServing})` : "per 100 g (approximate)",
        servingSizeG,
        servingOptions,
      },
    };
  } catch (e) {
    return { ok: false, error: "network", message: e instanceof Error ? e.message : undefined };
  }
}
