import Constants from "expo-constants";
import { supabase } from "./supabase";
import { authedFetch } from "./authedFetch";
import {
  buildOffServingOptionsFromProduct,
  pickDefaultServingGrams,
  type OffServingOption,
} from "../../../src/lib/openFoodFacts/offServingPortions";
import { scaleFromPer100gGrams } from "../../../src/lib/openFoodFacts/scaleFromPer100g";
import { effectiveFoodSearchQuery } from "../../../src/lib/nutrition/foodSearchQuery";
import {
  effectiveMacros as effectiveIngredientMacros,
  recomputeRecipeTotals,
  type IngredientOverride,
} from "../../../src/lib/nutrition/ingredientOverrides";

/** Keep in sync with `RECIPE_INGREDIENT_REVIEW_CONFIDENCE` in `src/lib/nutrition/verifyIngredients.ts`. */
export const RECIPE_INGREDIENT_REVIEW_CONFIDENCE = 0.5;

type Extra = { supprApiUrl?: string };
function apiBase(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return (extra?.supprApiUrl ?? "").replace(/\/$/, "");
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
  /** Batch 2.7 — manual macro override takes precedence over the match in totals. */
  overrideMacros?: IngredientOverride;
  /** Batch 2.7 — row added by the user post-import (not importer-parsed). */
  addedByUser?: boolean;
};

/**
 * Batch 2.7 — expose the shared helpers directly so the verify screen
 * and any totaliser can compute effective per-ingredient macros without
 * re-implementing the override precedence rule.
 */
export { effectiveIngredientMacros, recomputeRecipeTotals };
export type { IngredientOverride };

export type FoodSearchResult = {
  fdcId: number;
  description: string;
  dataType?: string;
  /** Inline macros from search (per 100g, may be partial) */
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
};

export type BarcodeProduct = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  servingSizeG: number | null;
  /** OFF-style presets (label + grams) for scaling per-100g macros. */
  servingOptions?: OffServingOption[];
  /** Filled by scanner when confirming (e.g. "4 dumplings"). */
  portionSummary?: string;
  /** Source of the data */
  source?: "user" | "verified" | "open_food_facts";
  /** Whether this is a verified community entry */
  verified?: boolean;
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

  // Extract ingredient hints from parenthetical notes like "(we used almond milk)"
  const parenHint = text.match(/\(\s*(?:we (?:used|like|prefer)|such as|e\.?g\.?|like|preferably|ideally)\s+(.+?)\s*\)/i);
  if (parenHint) {
    // Replace the vague name + parens with the actual ingredient
    text = text.replace(/^[^(]*\(/, "").replace(/\)\s*$/, "");
    text = parenHint[1]!;
  } else {
    // Strip generic parenthetical notes
    text = text.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  }

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
    .select(
      "id, name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, is_verified, source, override_macros, added_by_user",
    )
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
    const ov = r.override_macros && typeof r.override_macros === "object" ? r.override_macros : null;
    const overrideMacros: IngredientOverride | undefined =
      ov &&
      Number.isFinite(ov.calories) &&
      Number.isFinite(ov.protein) &&
      Number.isFinite(ov.carbs) &&
      Number.isFinite(ov.fat)
        ? {
            calories: Number(ov.calories),
            protein: Number(ov.protein),
            carbs: Number(ov.carbs),
            fat: Number(ov.fat),
            ...(Number.isFinite(ov.fiber) ? { fiber: Number(ov.fiber) } : {}),
          }
        : undefined;
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
      ...(overrideMacros ? { overrideMacros } : {}),
      ...(r.added_by_user ? { addedByUser: true as const } : {}),
    };
  });
}

/** Search USDA foods via the Next.js API. */
export async function searchUsda(query: string): Promise<FoodSearchResult[]> {
  const base = apiBase();
  const q = effectiveFoodSearchQuery(query);
  if (!base || !q.trim()) return [];

  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);
    const res = await authedFetch(
      `${base}/api/usda/search?q=${encodeURIComponent(q.trim())}`,
      { signal: ac.signal },
    );
    clearTimeout(t);
    const json = await res.json();
    if (!json.ok || !Array.isArray(json.hits)) return [];
    return json.hits.map((h: any) => ({
      fdcId: h.fdcId,
      description: h.description ?? "Unknown",
      dataType: h.dataType ?? "",
      calories: h.calories,
      protein: h.protein,
      fat: h.fat,
      carbs: h.carbs,
    }));
  } catch (e) {
    console.error("[searchUsda] failed:", e instanceof Error ? e.message : e);
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
  const q = effectiveFoodSearchQuery(query);
  if (!q.trim()) return [];
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q.trim())}&search_simple=1&action=process&json=1&page_size=10&fields=code,product_name,brands,nutriments,image_small_url`,
      {
        signal: ac.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "SupprApp/1.0",
        },
      },
    );
    clearTimeout(t);
    if (!res.ok) return [];
    const text = await res.text();
    let data: { products?: unknown[] };
    try {
      data = JSON.parse(text);
    } catch {
      console.warn("[searchOFF] non-JSON response:", text.slice(0, 200));
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
          imageUrl: p.image_small_url ?? null,
        };
      });
  } catch (e) {
    console.error("[searchOFF] failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Unified search result — source-agnostic */
export type UnifiedSearchResult = {
  key: string;
  name: string;
  subtitle?: string;
  /** per 100g macros (available immediately for OFF; fetched on tap for USDA) */
  macrosPer100g?: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG: number; sodiumMg: number };
  /** Quick calorie display (per 100g) */
  calsPer100g?: number;
  imageUrl?: string | null;
  /** Trusted source (USDA Foundation/SR Legacy/Survey) */
  verified?: boolean;
  /** Internal: source type for fetching full data on tap */
  _source: "USDA" | "OFF";
  _fdcId?: number;
  _offCode?: string;
};

/** Simple word-overlap relevance score for ranking */
function searchRelevance(query: string, name: string): number {
  const q = query.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const n = name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!q || !n) return 0;
  if (q === n) return 1;
  const qTokens = q.split(" ").filter(Boolean);
  const nTokens = new Set(n.split(" ").filter(Boolean));
  let hits = 0;
  for (const t of qTokens) if (nTokens.has(t)) hits++;
  const recall = hits / Math.max(1, qTokens.length);
  // Shorter names that match well = more relevant
  const brevity = Math.min(1, 4 / Math.max(1, nTokens.size));
  return recall * 0.7 + recall * brevity * 0.3;
}

/** Search all sources in parallel, return unified ranked list. */
export async function searchFoods(
  query: string,
  onPartial?: (results: UnifiedSearchResult[]) => void,
): Promise<UnifiedSearchResult[]> {
  const t = query.trim();
  if (!t) return [];
  const qRank = effectiveFoodSearchQuery(t);
  if (!qRank.trim()) return [];
  // Run both searches in parallel; deliver partial results as each resolves
  const usdaP = searchUsda(t);
  const offP = searchOpenFoodFacts(t);

  let usda: FoodSearchResult[] = [];
  let off: OffSearchResult[] = [];

  // If a callback is provided, deliver whichever source responds first
  if (onPartial) {
    const first = await Promise.race([
      offP.then((r) => { off = r; return "off" as const; }),
      usdaP.then((r) => { usda = r; return "usda" as const; }),
    ]);
    onPartial(mergeResults(qRank, usda, off));
    // Now wait for the other
    if (first === "off") usda = await usdaP;
    else off = await offP;
  } else {
    [usda, off] = await Promise.all([usdaP, offP]);
  }

  return mergeResults(qRank, usda, off);
}

/** Convert ALL CAPS or all-lowercase to Title Case */
function titleCase(s: string): string {
  // Only transform if mostly uppercase or all lowercase
  const upper = s.replace(/[^A-Z]/g, "").length;
  const lower = s.replace(/[^a-z]/g, "").length;
  if (upper > lower * 2 || (lower > 0 && upper === 0 && s === s.toLowerCase())) {
    return s.toLowerCase().replace(/(?:^|\s|[-/])\w/g, (c) => c.toUpperCase());
  }
  return s;
}

function mergeResults(
  query: string,
  usda: FoodSearchResult[],
  off: OffSearchResult[],
): UnifiedSearchResult[] {
  const results: (UnifiedSearchResult & { _relevance: number })[] = [];

  for (const item of usda) {
    const isVerified = /foundation|sr legacy|survey/i.test(item.dataType ?? "");
    const hasCals = (item.calories ?? 0) > 0 || (item.protein ?? 0) > 0 || (item.fat ?? 0) > 0 || (item.carbs ?? 0) > 0;
    results.push({
      key: `usda-${item.fdcId}`,
      name: titleCase(item.description),
      calsPer100g: item.calories,
      macrosPer100g: hasCals ? {
        calories: item.calories ?? 0,
        protein: item.protein ?? 0,
        carbs: item.carbs ?? 0,
        fat: item.fat ?? 0,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0,
      } : undefined,
      verified: isVerified,
      _source: "USDA",
      _fdcId: item.fdcId,
      _relevance: searchRelevance(query, item.description),
    });
  }

  for (const item of off) {
    const brand = titleCase(item.brand);
    const name = titleCase(item.name);
    const displayName = [brand, name].filter(Boolean).join(" · ");
    results.push({
      key: `off-${item.code}`,
      name: displayName,
      calsPer100g: item.calories,
      macrosPer100g: {
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiberG: item.fiberG,
        sugarG: item.sugarG,
        sodiumMg: item.sodiumMg,
      },
      imageUrl: item.imageUrl,
      _source: "OFF",
      _offCode: item.code,
      _relevance: searchRelevance(query, displayName),
    });
  }

  results.sort((a, b) => b._relevance - a._relevance);

  // Deduplicate — skip items with same normalized name
  const seen = new Set<string>();
  const deduped: UnifiedSearchResult[] = [];
  for (const r of results) {
    const norm = r.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(norm)) continue;
    seen.add(norm);
    deduped.push(r);
    if (deduped.length >= 20) break;
  }

  return deduped;
}

/** Get full macros for a specific USDA food (per 100g) plus available portions. */
export async function getFoodMacros(
  fdcId: number,
): Promise<{ macrosPer100g: MacrosPer100g; portions: FoodPortion[] } | null> {
  const base = apiBase();
  if (!base) return null;

  try {
    const res = await authedFetch(`${base}/api/usda/food?fdcId=${fdcId}`);
    const json = await res.json();
    if (!json.ok) return null;
    const portions: FoodPortion[] = Array.isArray(json.portions) ? json.portions : [];
    return { macrosPer100g: json.macrosPer100g, portions };
  } catch (e) {
    console.error("[getFoodMacros] failed for fdcId", fdcId, ":", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Look up a barcode via Open Food Facts (client-side). */
export async function lookupBarcode(
  code: string,
): Promise<BarcodeProduct | null> {
  const trimmed = code.replace(/\s/g, "");
  if (!/^\d{8,14}$/.test(trimmed)) return null;

  // 1. Check user-contributed foods first — prioritise verified entries
  try {
    const { supabase } = await import("@/lib/supabase");
    // Try verified entries first, then fall back to any user entry
    const { data: userFoods } = await supabase
      .from("user_foods")
      .select("name, calories, protein, carbs, fat, fiber_g, serving_size_g, verification_status")
      .eq("barcode", trimmed)
      .order("verification_status", { ascending: true }) // 'verified' sorts before 'pending'
      .order("upvotes", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(5);

    if (userFoods && userFoods.length > 0) {
      // Pick verified entry if available, otherwise the top-voted
      const best = userFoods.find((f) => f.verification_status === "verified") ?? userFoods[0];
      if (best) {
        const isVerified = best.verification_status === "verified";
        return {
          name: best.name,
          calories: Math.round(Number(best.calories) || 0),
          protein: Math.round((Number(best.protein) || 0) * 10) / 10,
          carbs: Math.round((Number(best.carbs) || 0) * 10) / 10,
          fat: Math.round((Number(best.fat) || 0) * 10) / 10,
          fiberG: Math.round((Number(best.fiber_g) || 0) * 10) / 10,
          servingSizeG: Number(best.serving_size_g) || 100,
          source: isVerified ? "verified" : "user",
          verified: isVerified,
        };
      }
    }
  } catch {
    // Fall through to Open Food Facts
  }

  // 2. Fall back to Open Food Facts API
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${trimmed}.json`,
    );
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product as {
      brands?: string;
      product_name?: string;
      product_name_en?: string;
      generic_name?: string;
      serving_size?: string;
      serving_quantity?: string | number;
      serving_quantity_unit?: string;
      nutriments?: Record<string, number | undefined>;
    };
    const n = p.nutriments ?? {};
    const brand = (p.brands ?? "").split(",")[0]?.trim() ?? "";
    const baseName =
      (p.product_name ?? p.product_name_en ?? p.generic_name ?? "").trim() ||
      "Packaged food";

    const servingOptions = buildOffServingOptionsFromProduct(p);
    const servingSizeG = pickDefaultServingGrams(servingOptions);

    return {
      name: [brand, baseName].filter(Boolean).join(" · "),
      calories: Math.round(n["energy-kcal_100g"] ?? 0),
      protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
      carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
      fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
      fiberG: Math.round((n.fiber_100g ?? 0) * 10) / 10,
      servingSizeG,
      servingOptions,
      source: "open_food_facts",
      verified: false,
    };
  } catch (e) {
    console.error("[lookupBarcode] failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Submit a correction or new entry to the user_foods table. */
export async function submitFoodCorrection(opts: {
  barcode: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  servingSizeG?: number;
  userId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await import("@/lib/supabase");
    const { error } = await supabase.from("user_foods").upsert(
      {
        barcode: opts.barcode,
        name: opts.name,
        calories: opts.calories,
        protein: opts.protein,
        carbs: opts.carbs,
        fat: opts.fat,
        fiber_g: opts.fiberG ?? 0,
        serving_size_g: opts.servingSizeG ?? 100,
        submitted_by: opts.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "barcode,submitted_by" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Unknown error" };
  }
}

/** Scale per-100g macros to a given gram weight. */
export function scaleMacros(
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG?: number; sodiumMg?: number },
  grams: number,
) {
  return scaleFromPer100gGrams(per100g, grams);
}

/** Save verified ingredients back to Supabase and update recipe totals. */
export async function saveVerifiedIngredients(
  recipeId: string,
  ingredients: VerifiableIngredient[],
  servings: number,
): Promise<{ ok: true } | { error: string }> {
  // 1. Compute and save recipe totals FIRST — ensures recipe-level macros always
  //    reflect the user's intent even if per-ingredient updates partially fail.
  //    We use `effectiveIngredientMacros` so per-ingredient overrides take
  //    precedence when summing (Batch 2.7).
  const totals = ingredients.reduce(
    (acc, i) => {
      const eff = effectiveIngredientMacros(i);
      return {
        calories: acc.calories + eff.calories,
        protein: acc.protein + eff.protein,
        carbs: acc.carbs + eff.carbs,
        fat: acc.fat + eff.fat,
        // fiber comes from override when set, else from the snapshot column.
        fiberG: acc.fiberG + (eff.fiber ?? i.fiberG),
        sugarG: acc.sugarG + i.sugarG,
        sodiumMg: acc.sodiumMg + i.sodiumMg,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 },
  );

  const safeServings = Math.max(1, servings || 1);
  const perServing = {
    calories: Math.round(totals.calories / safeServings),
    protein: Math.round(totals.protein / safeServings),
    carbs: Math.round(totals.carbs / safeServings),
    fat: Math.round(totals.fat / safeServings),
    fiberG: Math.round((totals.fiberG / safeServings) * 10) / 10,
    sugarG: Math.round((totals.sugarG / safeServings) * 10) / 10,
    sodiumMg: Math.round(totals.sodiumMg / safeServings),
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

  // 2. Update individual ingredients — collect errors instead of aborting on
  //    first failure. Preserve `override_macros` and `added_by_user` on every
  //    dirty row so existing overrides survive a save that only touched other
  //    fields.
  const errors: string[] = [];
  for (const ing of ingredients) {
    if (!ing.isDirty) continue;
    const updates: Record<string, unknown> = {
      name: ing.matchedName ?? ing.name,
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
      // Allow caller to clear an override by setting `overrideMacros` to
      // undefined on a dirty row — we pass `null` to wipe the jsonb column.
      override_macros: ing.overrideMacros ?? null,
    };
    if (ing.addedByUser) updates.added_by_user = true;

    const { error } = await supabase
      .from("recipe_ingredients")
      .update(updates)
      .eq("id", ing.id);

    if (error) errors.push(`${ing.matchedName ?? ing.name}: ${error.message}`);
  }

  if (errors.length > 0) {
    return { error: `Recipe totals saved but some ingredients failed: ${errors.join("; ")}` };
  }
  return { ok: true };
}

/**
 * Insert a new user-added ingredient row (Batch 2.7). Returns the inserted
 * row so the caller can push it straight into the on-screen list without a
 * refetch. Non-atomic with existing-row edits on purpose — the mobile
 * verify screen fires this inline from the Add-ingredient sheet.
 */
export async function addUserIngredient(
  recipeId: string,
  payload: {
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
    source: string;
    confidence: number;
    hasMatch: boolean;
    overrideMacros?: IngredientOverride;
  },
): Promise<{ ok: true; id: string } | { error: string }> {
  const insertRow: Record<string, unknown> = {
    recipe_id: recipeId,
    name: payload.name,
    amount: payload.amount,
    unit: payload.unit,
    calories: Math.round(payload.calories),
    protein: Math.round(payload.protein * 10) / 10,
    carbs: Math.round(payload.carbs * 10) / 10,
    fat: Math.round(payload.fat * 10) / 10,
    fiber_g: Math.round(payload.fiberG * 10) / 10,
    sugar_g: Math.round(payload.sugarG * 10) / 10,
    sodium_mg: Math.round(payload.sodiumMg),
    is_verified: payload.hasMatch && payload.confidence >= 0.5,
    source: payload.source,
    confidence: payload.confidence,
    added_by_user: true,
  };
  if (payload.overrideMacros) insertRow.override_macros = payload.overrideMacros;

  const { data, error } = await supabase
    .from("recipe_ingredients")
    .insert(insertRow)
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Insert failed" };
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * Pin or clear a manual macro override on a single row (Batch 2.7).
 * Returns the persisted override (or null when cleared).
 */
export async function setIngredientOverride(
  ingredientId: string,
  override: IngredientOverride | null,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("recipe_ingredients")
    .update({ override_macros: override })
    .eq("id", ingredientId);
  if (error) return { error: error.message };
  return { ok: true };
}
