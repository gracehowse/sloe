import Constants from "expo-constants";
import { supabase } from "./supabase";

type Extra = { platemateApiUrl?: string };
function apiBase(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return (extra?.platemateApiUrl ?? "").replace(/\/$/, "");
}

export type MacrosPer100g = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

export type FoodPortion = {
  label: string;
  gramWeight: number;
  amount: number;
};

export type VerifiableIngredient = {
  id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  source: string | null;
  confidence: number;
  matchedName: string | null;
  isVerified: boolean;
  isDirty: boolean;
  /** Stored so we can recalculate when amount changes */
  macrosPer100g: MacrosPer100g | null;
  /** Available portion options from USDA/OFF */
  portions: FoodPortion[];
  /** Currently chosen portion */
  chosenPortion: FoodPortion | null;
};

export type FoodSearchResult = {
  fdcId: number;
  description: string;
  dataType?: string;
  /** per 100g macros */
  macrosPer100g?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
  };
};

export type BarcodeProduct = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  servingSizeG: number | null;
};

const FRAC_MAP: Record<string, number> = {
  "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 0.33, "⅔": 0.67,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

/**
 * Parse a raw ingredient line like "1/2 small avocado, sliced" into:
 * - searchTerm: "avocado" (clean term for database search)
 * - amount: 0.5
 * - sizeHint: "small"
 */
export function parseIngredientForSearch(raw: string): {
  searchTerm: string;
  amount: number;
  sizeHint: string | null;
} {
  let text = raw.trim();
  let amount = 1;

  // Strip leading fractions: "½", "1/2", "1 1/2", "0.5"
  for (const [frac, val] of Object.entries(FRAC_MAP)) {
    if (text.startsWith(frac)) {
      amount = val;
      text = text.slice(frac.length).trim();
      break;
    }
  }
  const fracMatch = text.match(/^(\d+)\s*\/\s*(\d+)\s+/);
  if (fracMatch) {
    amount = parseInt(fracMatch[1]!) / parseInt(fracMatch[2]!);
    text = text.slice(fracMatch[0].length);
  } else {
    const numMatch = text.match(/^(\d+(?:\.\d+)?)\s+/);
    if (numMatch) {
      amount = parseFloat(numMatch[1]!);
      text = text.slice(numMatch[0].length);
    }
  }

  // Strip size words
  let sizeHint: string | null = null;
  const sizeMatch = text.match(/^(small|medium|large|heaped|level|generous|scant)\s+/i);
  if (sizeMatch) {
    sizeHint = sizeMatch[1]!.toLowerCase();
    text = text.slice(sizeMatch[0].length);
  }

  // Strip units that are part of the name
  const unitMatch = text.match(/^(tbsp|tsp|tablespoons?|teaspoons?|cups?|cloves?|heads?|slices?|rashers?|sprigs?|bunch(?:es)?|handfuls?|knobs?|drizzles?|pinch(?:es)?)\s+(?:of\s+)?/i);
  if (unitMatch) {
    text = text.slice(unitMatch[0].length);
  }

  // Strip "of" if leftover
  text = text.replace(/^of\s+/i, "");

  // Strip prep instructions after comma
  const commaIdx = text.indexOf(",");
  if (commaIdx > 3) text = text.slice(0, commaIdx);

  // Strip prep technique words but KEEP nutrition-critical state words
  // (cooked, raw, dried, frozen, canned, roasted, smoked, etc.)
  text = text
    .replace(/\b(finely|roughly|freshly|thinly)\s+(chopped|diced|sliced|grated|minced|crushed)\b/gi, "")
    .replace(/\b(chopped|diced|sliced|grated|minced|crushed|peeled|trimmed|drained|deseeded|deboned|pitted)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return { searchTerm: text || raw.trim(), amount, sizeHint };
}

/** Format source label for display. */
export function sourceLabel(source: string | null): string {
  if (!source) return "";
  if (source === "OFF") return "Product";
  if (source === "USDA") return "USDA";
  if (source === "FatSecret") return "FatSecret";
  if (source === "Estimated") return "Estimated";
  return source;
}

/** Load ingredients for verification from Supabase. */
export async function fetchIngredientsForVerification(
  recipeId: string,
): Promise<VerifiableIngredient[]> {
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select("id, name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, is_verified, source")
    .eq("recipe_id", recipeId);

  if (error || !data) return [];

  return data.map((r: any) => {
    let amount = r.amount;
    const unit = r.unit;
    if (amount == null && r.name) {
      const parsed = parseIngredientForSearch(r.name);
      amount = parsed.amount;
    }

    const grams = unit === "g" && amount ? amount : 100;
    const factor = grams / 100;
    const hasMacros = (r.calories ?? 0) > 0;
    const per100g: MacrosPer100g | null = factor > 0 && hasMacros ? {
      calories: Math.round((r.calories ?? 0) / factor),
      protein: Math.round(((r.protein ?? 0) / factor) * 10) / 10,
      carbs: Math.round(((r.carbs ?? 0) / factor) * 10) / 10,
      fat: Math.round(((r.fat ?? 0) / factor) * 10) / 10,
      fiberG: Math.round(((r.fiber_g ?? 0) / factor) * 10) / 10,
      sugarG: Math.round(((r.sugar_g ?? 0) / factor) * 10) / 10,
      sodiumMg: Math.round((r.sodium_mg ?? 0) / factor),
    } : null;
    return {
      id: r.id,
      name: r.name ?? "",
      amount,
      unit,
      calories: r.calories ?? 0,
      protein: r.protein ?? 0,
      carbs: r.carbs ?? 0,
      fat: r.fat ?? 0,
      fiberG: r.fiber_g ?? 0,
      sugarG: r.sugar_g ?? 0,
      sodiumMg: r.sodium_mg ?? 0,
      source: r.source ?? null,
      confidence: r.is_verified ? 0.9 : 0.3,
      matchedName: null,
      isVerified: r.is_verified ?? false,
      isDirty: false,
      macrosPer100g: per100g,
      portions: [],
      chosenPortion: null,
    };
  });
}

/** Search USDA foods via the Next.js API. */
export async function searchUsda(query: string): Promise<FoodSearchResult[]> {
  const base = apiBase();
  if (!base || !query.trim()) return [];

  try {
    const res = await fetch(
      `${base}/api/usda/search?q=${encodeURIComponent(query.trim())}`,
    );
    const json = await res.json();
    if (!json.ok || !Array.isArray(json.hits)) return [];
    return json.hits.map((h: any) => ({
      fdcId: h.fdcId,
      description: h.description ?? "Unknown",
      dataType: h.dataType ?? "",
    }));
  } catch {
    return [];
  }
}

export type OffSearchResult = {
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
  imageUrl: string | null;
};

/** Search Open Food Facts by text (real products with barcodes). */
export async function searchOpenFoodFacts(query: string): Promise<OffSearchResult[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query.trim())}&search_simple=1&action=process&json=1&page_size=15&fields=code,product_name,brands,nutriments,image_small_url`,
    );
    const data = await res.json();
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
          imageUrl: p.image_small_url ?? null,
        };
      });
  } catch {
    return [];
  }
}

/** Search all sources in parallel. */
export async function searchFoods(query: string): Promise<{
  usda: FoodSearchResult[];
  off: OffSearchResult[];
}> {
  const [usda, off] = await Promise.all([
    searchUsda(query),
    searchOpenFoodFacts(query),
  ]);
  return { usda, off };
}

/** Get full macros for a specific USDA food (per 100g) plus available portions. */
export async function getFoodMacros(
  fdcId: number,
): Promise<{ macrosPer100g: MacrosPer100g; portions: FoodPortion[] } | null> {
  const base = apiBase();
  if (!base) return null;

  try {
    const res = await fetch(`${base}/api/usda/food?fdcId=${fdcId}`);
    const json = await res.json();
    if (!json.ok) return null;
    const portions: FoodPortion[] = Array.isArray(json.portions) ? json.portions : [];
    return { macrosPer100g: json.macrosPer100g, portions };
  } catch {
    return null;
  }
}

/** Look up a barcode via Open Food Facts (client-side). */
export async function lookupBarcode(
  code: string,
): Promise<BarcodeProduct | null> {
  const trimmed = code.replace(/\s/g, "");
  if (!/^\d{8,14}$/.test(trimmed)) return null;

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${trimmed}.json`,
    );
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const n = p.nutriments ?? {};
    const brand = (p.brands ?? "").split(",")[0]?.trim() ?? "";
    const baseName =
      (p.product_name ?? p.product_name_en ?? p.generic_name ?? "").trim() ||
      "Packaged food";

    return {
      name: [brand, baseName].filter(Boolean).join(" · "),
      calories: Math.round(n["energy-kcal_100g"] ?? 0),
      protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
      carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
      fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
      fiberG: Math.round((n.fiber_100g ?? 0) * 10) / 10,
      servingSizeG: n.serving_quantity ?? null,
    };
  } catch {
    return null;
  }
}

/** Scale per-100g macros to a given gram weight. */
export function scaleMacros(
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG?: number; sodiumMg?: number },
  grams: number,
) {
  const f = grams / 100;
  return {
    calories: Math.round(per100g.calories * f),
    protein: Math.round(per100g.protein * f * 10) / 10,
    carbs: Math.round(per100g.carbs * f * 10) / 10,
    fat: Math.round(per100g.fat * f * 10) / 10,
    fiberG: Math.round((per100g.fiberG ?? 0) * f * 10) / 10,
    sugarG: Math.round((per100g.sugarG ?? 0) * f * 10) / 10,
    sodiumMg: Math.round((per100g.sodiumMg ?? 0) * f),
  };
}

/** Save verified ingredients back to Supabase and update recipe totals. */
export async function saveVerifiedIngredients(
  recipeId: string,
  ingredients: VerifiableIngredient[],
  servings: number,
): Promise<{ ok: true } | { error: string }> {
  // Update each dirty ingredient
  for (const ing of ingredients) {
    if (!ing.isDirty) continue;
    const { error } = await supabase
      .from("recipe_ingredients")
      .update({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        calories: Math.round(ing.calories),
        protein: Math.round(ing.protein),
        carbs: Math.round(ing.carbs),
        fat: Math.round(ing.fat),
        fiber_g: Math.round(ing.fiberG * 10) / 10,
        sugar_g: Math.round(ing.sugarG * 10) / 10,
        sodium_mg: Math.round(ing.sodiumMg),
        is_verified: true,
        source: ing.source,
      })
      .eq("id", ing.id);

    if (error) return { error: `Failed to update ${ing.name}: ${error.message}` };
  }

  // Compute recipe totals (per serving)
  const totals = ingredients.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein: acc.protein + i.protein,
      carbs: acc.carbs + i.carbs,
      fat: acc.fat + i.fat,
      fiberG: acc.fiberG + i.fiberG,
      sugarG: acc.sugarG + i.sugarG,
      sodiumMg: acc.sodiumMg + i.sodiumMg,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 },
  );

  const perServing = {
    calories: Math.round(totals.calories / servings),
    protein: Math.round(totals.protein / servings),
    carbs: Math.round(totals.carbs / servings),
    fat: Math.round(totals.fat / servings),
    fiberG: Math.round((totals.fiberG / servings) * 10) / 10,
    sugarG: Math.round((totals.sugarG / servings) * 10) / 10,
    sodiumMg: Math.round(totals.sodiumMg / servings),
  };

  const { error: recipeErr } = await supabase
    .from("recipes")
    .update({
      calories: perServing.calories,
      protein: perServing.protein,
      carbs: perServing.carbs,
      fat: perServing.fat,
      fiber_g: perServing.fiberG,
      sugar_g: perServing.sugarG,
      sodium_mg: perServing.sodiumMg,
      is_verified: true,
    })
    .eq("id", recipeId);

  if (recipeErr) return { error: recipeErr.message };
  return { ok: true };
}
