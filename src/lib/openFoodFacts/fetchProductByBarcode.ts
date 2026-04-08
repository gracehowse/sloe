export interface OffProductMacros {
  name: string;
  /** Nutrients per 100g (approximate; user can scale in the diary). */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  servingLabel: string;
  /** If OFF provides a serving size like "50 g", parse to grams. */
  servingSizeG?: number;
}

function parseServingSizeToGrams(raw: string | undefined): number | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  const m = t.match(/(\d+(?:\.\d+)?)\s*(g|gram|grams|ml)\b/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2]!;
  // Treat ml as grams for most beverages (good-enough MVP).
  if (unit === "ml") return n;
  return n;
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
    const servingSizeG = parseServingSizeToGrams(p.serving_size);
    return {
      ok: true,
      product: {
        name,
        calories,
        protein,
        carbs,
        fat,
        fiberG,
        servingLabel: servingSizeG ? `per 100g (serving: ${p.serving_size})` : "per 100g (approximate)",
        servingSizeG: servingSizeG ?? undefined,
      },
    };
  } catch (e) {
    return { ok: false, error: "network", message: e instanceof Error ? e.message : undefined };
  }
}
