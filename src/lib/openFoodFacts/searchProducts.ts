/**
 * Search Open Food Facts by text query.
 * Works worldwide — uses local product names (courgette, aubergine, digestives, etc.)
 * and covers UK, EU, US, AU products.
 */

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
};

/**
 * Search OFF by text. Uses world.openfoodfacts.org which covers all regions.
 * For better UK results, can also try uk.openfoodfacts.org.
 */
export async function searchOffProducts(
  query: string,
  opts?: { pageSize?: number; countryTag?: string },
): Promise<OffSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const pageSize = opts?.pageSize ?? 10;
  const params = new URLSearchParams({
    search_terms: q,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(pageSize),
    fields: "code,product_name,brands,nutriments",
  });
  // Optionally filter by country (e.g. "united-kingdom", "france")
  if (opts?.countryTag) {
    params.set("tagtype_0", "countries");
    params.set("tag_contains_0", "contains");
    params.set("tag_0", opts.countryTag);
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "PlatemateNutritionVerifier/1.0",
        },
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
        return {
          code: p.code ?? "",
          name: p.product_name ?? "Unknown",
          brand: (p.brands ?? "").split(",")[0]?.trim() ?? "",
          calories: Math.round(n["energy-kcal_100g"] ?? 0),
          protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
          carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
          fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
          fiberG: Math.round((n.fiber_100g ?? 0) * 10) / 10,
          sugarG: Math.round((n["sugars_100g"] ?? 0) * 10) / 10,
          sodiumMg: Math.round((n.sodium_100g ?? 0) * 1000),
        };
      })
      .filter((h) => h.calories > 0 || h.protein > 0); // Skip items with no nutrition data
  } catch {
    return [];
  }
}
