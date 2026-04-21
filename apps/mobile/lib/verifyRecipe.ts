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
  pickEdamamPrimaryServing,
  pickUsdaBrandedPrimaryServing,
  pickUsdaFoodPortionsPrimaryServing,
  parseOffPrimaryServing,
  type PrimaryServing,
} from "../../../src/lib/nutrition/primaryServing";
import {
  effectiveMacros as effectiveIngredientMacros,
  recomputeRecipeTotals,
  type IngredientOverride,
} from "../../../src/lib/nutrition/ingredientOverrides";

/** Keep in sync with `RECIPE_INGREDIENT_REVIEW_CONFIDENCE` in `src/lib/nutrition/verifyIngredients.ts`. */
export const RECIPE_INGREDIENT_REVIEW_CONFIDENCE = 0.5;

// TODO: mobile verifyRecipe.ts should import from src/lib/recipe-import/ — see M4 note
// The web tree is resolvable from mobile (see the existing
// `../../../src/lib/...` imports above), so this is a consolidation,
// not a reachability, problem. Shared-lib candidates:
//   - `parseIngredientForSearch` (this file) vs `parseIngredientLine`
//     in `src/lib/recipe-ingredients/` — different intents today
//     (search-term extraction vs structured parse); revisit when the
//     mobile verify flow moves to structured parsing.
//   - `scaleMacros` — already delegates to `scaleFromPer100gGrams` in
//     `src/lib/openFoodFacts/scaleFromPer100g`; safe to call directly.

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
  /**
   * F-13 (2026-04-19) — caffeine (mg) + alcohol (g of ethanol) per 100 g.
   * `null` when the source did not publish the nutrient; the food-log
   * commit path treats `null` as 0 via `scaleCaffeineAlcohol` rather
   * than inventing a fallback (project rule: no invented nutrition values).
   */
  caffeineMgPer100g?: number | null;
  alcoholGPer100g?: number | null;
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
  /**
   * F-13 (2026-04-19) — caffeine (mg) + alcohol (g of ethanol) per 100 g
   * from the USDA inline nutrient envelope. Null when USDA didn't
   * publish for the hit.
   */
  caffeineMgPer100g?: number | null;
  alcoholGPer100g?: number | null;
  /**
   * Branded-food per-serving fields passed through from `/api/usda/search`
   * so the display layer can show a per-portion primary line (TestFlight
   * build 9 `APo0qS9vcFvmBJEJJ_-61YA`, 2026-04-19).
   */
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  /** Non-branded portions; empty for branded hits. */
  foodPortions?: Array<{
    gramWeight?: number;
    amount?: number;
    modifier?: string;
    portionDescription?: string;
    measureUnit?: { name?: string; abbreviation?: string };
  }>;
};

export type BarcodeProduct = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  servingSizeG: number | null;
  /**
   * F-13 (2026-04-19) — caffeine (mg) + alcohol (g ethanol) per 100 g.
   * Populated from OFF when available, null otherwise. Scanner confirm
   * flow scales with `scaleCaffeineAlcohol` on commit and auto-increments
   * `profiles.extra_caffeine_by_day` / `extra_alcohol_g_by_day`.
   */
  caffeineMgPer100g?: number | null;
  alcoholGPer100g?: number | null;
  /**
   * F-30 (2026-04-21) — micros exposed in the correction form + stored in
   * `user_foods`. All per 100 g; sodium in mg to match packaging convention.
   */
  sugarG?: number | null;
  sodiumMg?: number | null;
  saturatedFatG?: number | null;
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
  if (source === "Edamam") return "Edamam";
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

/** Search USDA foods via the Next.js API. `page` is 1-indexed and
 *  forwarded as `pageNumber`. TestFlight F-10
 *  (`AHnI_fIc7SKbaRcdd5SZB9Q`, 2026-04-19). */
export async function searchUsda(query: string, opts?: { page?: number }): Promise<FoodSearchResult[]> {
  const base = apiBase();
  const q = effectiveFoodSearchQuery(query);
  if (!base || !q.trim()) return [];
  const page = opts?.page && opts.page > 0 ? Math.floor(opts.page) : 1;

  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);
    const res = await authedFetch(
      `${base}/api/usda/search?q=${encodeURIComponent(q.trim())}&page=${page}`,
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
      // F-13 (2026-04-19) — pass caffeine + alcohol per 100 g through
      // from the USDA inline envelope so the Today log path can auto-track.
      caffeineMgPer100g: typeof h.caffeineMgPer100g === "number" ? h.caffeineMgPer100g : null,
      alcoholGPer100g: typeof h.alcoholGPer100g === "number" ? h.alcoholGPer100g : null,
      ...(typeof h.servingSize === "number" ? { servingSize: h.servingSize } : {}),
      ...(typeof h.servingSizeUnit === "string" ? { servingSizeUnit: h.servingSizeUnit } : {}),
      ...(typeof h.householdServingFullText === "string"
        ? { householdServingFullText: h.householdServingFullText }
        : {}),
      ...(Array.isArray(h.foodPortions) ? { foodPortions: h.foodPortions } : {}),
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
  /**
   * F-13 (2026-04-19) — caffeine (mg) + alcohol (g of ethanol) per 100 g.
   * `null` when OFF did not publish `caffeine_100g` / `alcohol_100g`.
   */
  caffeineMgPer100g: number | null;
  alcoholGPer100g: number | null;
  imageUrl: string | null;
  /** Free-text serving string from OFF, e.g. "1 slice (28 g)". */
  servingSize: string | null;
};

/** Search Open Food Facts by text (real products with barcodes).
 *  `page` is 1-indexed; OFF supports it natively. TestFlight F-10
 *  (`AHnI_fIc7SKbaRcdd5SZB9Q`, 2026-04-19). */
export async function searchOpenFoodFacts(query: string, opts?: { page?: number }): Promise<OffSearchResult[]> {
  const q = effectiveFoodSearchQuery(query);
  if (!q.trim()) return [];
  const page = opts?.page && opts.page > 0 ? Math.floor(opts.page) : 1;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q.trim())}&search_simple=1&action=process&json=1&page_size=10&page=${page}&fields=code,product_name,brands,nutriments,image_small_url,serving_size`,
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
        // F-13 (2026-04-19) — caffeine + alcohol per 100 g. OFF reports
        // caffeine in g (convert to mg) and alcohol in g already.
        const caffRaw = n.caffeine_100g ?? n.caffeine;
        const caffeineMgPer100g =
          typeof caffRaw === "number" && Number.isFinite(caffRaw) && caffRaw > 0
            ? Math.round(caffRaw * 1000 * 10) / 10
            : null;
        const alcRaw = n.alcohol_100g ?? n.alcohol;
        const alcoholGPer100g =
          typeof alcRaw === "number" && Number.isFinite(alcRaw) && alcRaw > 0
            ? Math.round(alcRaw * 100) / 100
            : null;
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
          caffeineMgPer100g,
          alcoholGPer100g,
          imageUrl: p.image_small_url ?? null,
          servingSize: typeof p.serving_size === "string" && p.serving_size.trim()
            ? p.serving_size.trim()
            : null,
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
  /** per 100g macros (available immediately for OFF/Edamam; fetched on tap for USDA) */
  macrosPer100g?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
    /**
     * F-13 (2026-04-19) — caffeine (mg) + alcohol (g ethanol) per 100 g.
     * `null` when the source didn't publish; commit path uses
     * `scaleCaffeineAlcohol` which returns 0 on null (never invents).
     */
    caffeineMgPer100g?: number | null;
    alcoholGPer100g?: number | null;
  };
  /** Quick calorie display (per 100g) */
  calsPer100g?: number;
  imageUrl?: string | null;
  /** Trusted source (USDA Foundation/SR Legacy/Survey) */
  verified?: boolean;
  /**
   * Natural portion derived from the source (Edamam `servingSizes`, USDA
   * branded `servingSize`, USDA `foodPortions`, OFF `serving_size`).
   * Null when the source exposes only a per-gram fallback — display
   * layer falls back to the /100g-only format in that case (TestFlight
   * `APo0qS9vcFvmBJEJJ_-61YA`, 2026-04-19).
   */
  primaryServing?: PrimaryServing | null;
  /** Internal: source type for fetching full data on tap */
  _source: "USDA" | "OFF" | "Edamam";
  _fdcId?: number;
  _offCode?: string;
  /** Edamam food identifier — stable string, not numeric. */
  _edamamFoodId?: string;
};

/** Edamam hit shape returned by `/api/edamam/search`. */
export type EdamamSearchResult = {
  foodId: string;
  label: string;
  category: string;
  categoryLabel: string;
  brand: string | null;
  imageUrl: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  /**
   * F-13 (2026-04-19) — caffeine (mg) + alcohol (g of ethanol) per 100 g
   * from Edamam's `CAFFN` / `ALC` nutrients. Null when absent.
   */
  caffeineMgPer100g?: number | null;
  alcoholGPer100g?: number | null;
  /**
   * `servingSizes[]` — Edamam often exposes the "real" gram weight of
   * the natural portion here (e.g. `{label:"Serving", quantity:230}` for
   * a Pret sandwich). Passed straight through from the API route so the
   * primary-serving inference helper can pick the non-"Gram" entry.
   */
  servingSizes?: Array<{ uri?: string; label?: string; quantity?: number }>;
};

/**
 * Search Edamam (restaurant + branded foods) via our Next.js API route.
 * Empty on network / server / rate-limit errors so it never blocks
 * USDA / OFF from rendering. TestFlight `AOI9xgY88Dx-uphiXI8IzEk`.
 */
export async function searchEdamam(
  query: string,
  opts?: { mode?: "foods" | "meals"; page?: number },
): Promise<EdamamSearchResult[]> {
  const base = apiBase();
  const q = effectiveFoodSearchQuery(query);
  if (!base || !q.trim()) return [];
  const mode = opts?.mode ?? "foods";
  // Edamam's parser endpoint is not natively paginated; the API route
  // returns an empty hits array for page > 1 so fan-out stays uniform.
  // TestFlight F-10 (`AHnI_fIc7SKbaRcdd5SZB9Q`, 2026-04-19).
  const page = opts?.page && opts.page > 0 ? Math.floor(opts.page) : 1;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    const res = await authedFetch(
      `${base}/api/edamam/search?q=${encodeURIComponent(q.trim())}&mode=${mode}&page=${page}`,
      { signal: ac.signal },
    );
    clearTimeout(t);
    const json = await res.json();
    if (!json.ok || !Array.isArray(json.hits)) return [];
    // Route already shapes each hit to the EdamamSearchResult envelope
    // (including `servingSizes`), so we pass the array through.
    return json.hits as EdamamSearchResult[];
  } catch (e) {
    console.error("[searchEdamam] failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

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

/** Search all sources in parallel, return unified ranked list.
 *  Sources: USDA FDC (verified generic foods), OpenFoodFacts (branded /
 *  barcode products), Edamam food DB (branded + restaurant meals —
 *  TestFlight `AOI9xgY88Dx-uphiXI8IzEk`, 2026-04-18).
 *
 *  `opts.page` (1-indexed, default 1) drives infinite scroll in the
 *  food-search UI — TestFlight F-10 (`AHnI_fIc7SKbaRcdd5SZB9Q`,
 *  2026-04-19). USDA is the primary paginator; OFF paginates natively;
 *  Edamam returns empty for page > 1. `opts.limit` caps the merged
 *  slice per page (default 24 to match pre-pagination behaviour). */
export async function searchFoods(
  query: string,
  onPartial?: (results: UnifiedSearchResult[]) => void,
  opts?: { page?: number; limit?: number },
): Promise<UnifiedSearchResult[]> {
  const t = query.trim();
  if (!t) return [];
  const qRank = effectiveFoodSearchQuery(t);
  if (!qRank.trim()) return [];
  const page = opts?.page && opts.page > 0 ? Math.floor(opts.page) : 1;
  const limit = opts?.limit && opts.limit > 0 ? Math.floor(opts.limit) : 24;
  const usdaP = searchUsda(t, { page });
  const offP = searchOpenFoodFacts(t, { page });
  const edamamP = searchEdamam(t, { page });

  let usda: FoodSearchResult[] = [];
  let off: OffSearchResult[] = [];
  let eda: EdamamSearchResult[] = [];

  if (onPartial) {
    // Stream: deliver whichever source responds first, then keep appending
    // as the others resolve. Users see USDA / OFF hits instantly without
    // waiting for Edamam's network round-trip.
    const usdaLabelled = usdaP.then((r) => { usda = r; return "usda" as const; });
    const offLabelled = offP.then((r) => { off = r; return "off" as const; });
    const edaLabelled = edamamP.then((r) => { eda = r; return "edamam" as const; });
    const pending = new Set<Promise<"usda" | "off" | "edamam">>([
      usdaLabelled,
      offLabelled,
      edaLabelled,
    ]);
    while (pending.size > 0) {
      const done = await Promise.race(pending);
      pending.delete(
        done === "usda" ? usdaLabelled : done === "off" ? offLabelled : edaLabelled,
      );
      onPartial(mergeResults(qRank, usda, off, eda, limit));
    }
  } else {
    [usda, off, eda] = await Promise.all([usdaP, offP, edamamP]);
  }

  return mergeResults(qRank, usda, off, eda, limit);
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
  edamam: EdamamSearchResult[] = [],
  limit: number = 24,
): UnifiedSearchResult[] {
  const results: (UnifiedSearchResult & { _relevance: number })[] = [];

  for (const item of usda) {
    const isVerified = /foundation|sr legacy|survey/i.test(item.dataType ?? "");
    const hasCals = (item.calories ?? 0) > 0 || (item.protein ?? 0) > 0 || (item.fat ?? 0) > 0 || (item.carbs ?? 0) > 0;
    const per100g = {
      calories: item.calories ?? 0,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
    };
    // Branded foods → `servingSize` + `householdServingFullText`.
    // Foundation / Survey / SR Legacy → `foodPortions[]`.
    const primaryServing = hasCals
      ? (pickUsdaBrandedPrimaryServing(per100g, {
          servingSize: item.servingSize ?? null,
          servingSizeUnit: item.servingSizeUnit ?? null,
          householdServingFullText: item.householdServingFullText ?? null,
        }) ?? pickUsdaFoodPortionsPrimaryServing(per100g, item.foodPortions ?? null))
      : null;
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
        // F-13 — carry USDA caffeine/alcohol per 100 g through from the
        // search envelope so auto-track fires on first tap.
        caffeineMgPer100g: item.caffeineMgPer100g ?? null,
        alcoholGPer100g: item.alcoholGPer100g ?? null,
      } : undefined,
      verified: isVerified,
      primaryServing,
      _source: "USDA",
      _fdcId: item.fdcId,
      _relevance: searchRelevance(query, item.description),
    });
  }

  for (const item of off) {
    const brand = titleCase(item.brand);
    const name = titleCase(item.name);
    const displayName = [brand, name].filter(Boolean).join(" · ");
    const primaryServing = parseOffPrimaryServing(
      { calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat },
      item.servingSize,
    );
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
        // F-13 — caffeine/alcohol per 100 g from OFF `nutriments`.
        caffeineMgPer100g: item.caffeineMgPer100g,
        alcoholGPer100g: item.alcoholGPer100g,
      },
      imageUrl: item.imageUrl,
      primaryServing,
      _source: "OFF",
      _offCode: item.code,
      _relevance: searchRelevance(query, displayName),
    });
  }

  for (const item of edamam) {
    const brand = item.brand ? titleCase(item.brand) : "";
    const cleanLabel = titleCase(item.label);
    const displayName = brand ? `${brand} · ${cleanLabel}` : cleanLabel;
    const isMeal =
      item.category?.toLowerCase().includes("meal") ||
      Boolean(item.brand && item.category?.toLowerCase().includes("packaged"));
    const primaryServing = pickEdamamPrimaryServing(
      { calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat },
      item.servingSizes ?? null,
    );
    results.push({
      key: `edamam-${item.foodId}`,
      name: displayName,
      subtitle: isMeal ? (brand ? `Restaurant · ${brand}` : "Restaurant meal") : undefined,
      calsPer100g: item.calories,
      macrosPer100g: {
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiberG: item.fiberG,
        sugarG: item.sugarG,
        sodiumMg: item.sodiumMg,
        // F-13 — caffeine/alcohol per 100 g from Edamam `CAFFN` / `ALC`.
        caffeineMgPer100g: item.caffeineMgPer100g ?? null,
        alcoholGPer100g: item.alcoholGPer100g ?? null,
      },
      imageUrl: item.imageUrl,
      primaryServing,
      _source: "Edamam",
      _edamamFoodId: item.foodId,
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
    if (deduped.length >= limit) break;
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
    // F-13 (2026-04-19) — caffeine + alcohol per 100 g. OFF reports
    // caffeine in g (convert to mg) and alcohol in g already. Null when
    // absent so the commit path knows to skip rather than assume zero.
    const caffRaw = n.caffeine_100g ?? n.caffeine;
    const caffeineMgPer100g =
      typeof caffRaw === "number" && Number.isFinite(caffRaw) && caffRaw > 0
        ? Math.round(caffRaw * 1000 * 10) / 10
        : null;
    const alcRaw = n.alcohol_100g ?? n.alcohol;
    const alcoholGPer100g =
      typeof alcRaw === "number" && Number.isFinite(alcRaw) && alcRaw > 0
        ? Math.round(alcRaw * 100) / 100
        : null;

    return {
      name: [brand, baseName].filter(Boolean).join(" · "),
      calories: Math.round(n["energy-kcal_100g"] ?? 0),
      protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
      carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
      fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
      fiberG: Math.round((n.fiber_100g ?? 0) * 10) / 10,
      servingSizeG,
      caffeineMgPer100g,
      alcoholGPer100g,
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
  /** F-30 (2026-04-21) — optional micro corrections. */
  sugarG?: number;
  sodiumMg?: number;
  saturatedFatG?: number;
  servingSizeG?: number;
  userId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await import("@/lib/supabase");
    // F-30: include micro columns only when provided > 0 so older DB
    // schemas (pre-20260430100000 migration) don't break if a device
    // running a newer JS bundle hits a not-yet-migrated project. The
    // `upsert` with spread-conditional keys keeps writes compatible
    // either way.
    const payload: Record<string, unknown> = {
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
    };
    if (opts.sugarG != null && opts.sugarG > 0) payload.sugar_g = opts.sugarG;
    if (opts.sodiumMg != null && opts.sodiumMg > 0) payload.sodium_mg = opts.sodiumMg;
    if (opts.saturatedFatG != null && opts.saturatedFatG > 0) payload.saturated_fat_g = opts.saturatedFatG;
    const { error } = await supabase.from("user_foods").upsert(payload, { onConflict: "barcode,submitted_by" });
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
