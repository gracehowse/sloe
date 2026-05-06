/**
 * Edamam Food Database API client.
 *
 * Docs: https://developer.edamam.com/food-database-api
 *
 * Free tier: 1,000 requests/day, 900K foods (325K branded, 200K restaurant, 75K common meals).
 * Pro tier: $0.00003/request, same database, no daily limit.
 *
 * Env vars: EDAMAM_APP_ID, EDAMAM_APP_KEY
 */

const BASE_URL = "https://api.edamam.com/api/food-database/v2";

export type EdamamConfig = {
  appId: string;
  appKey: string;
};

export type EdamamFoodHit = {
  food: {
    foodId: string;
    label: string;
    /** "Generic", "Packaged", "Generic meals" */
    category: string;
    categoryLabel: string;
    brand?: string;
    nutrients: {
      ENERC_KCAL?: number; // calories
      PROCNT?: number;     // protein g
      FAT?: number;        // fat g
      CHOCDF?: number;     // carbs g
      FIBTG?: number;      // fiber g
      SUGAR?: number;      // sugar g
      NA?: number;         // sodium mg
    };
    servingSizes?: Array<{
      uri: string;
      label: string;
      quantity: number;
    }>;
    image?: string;
  };
};

export type EdamamSearchResponse = {
  text: string;
  parsed: Array<{ food: EdamamFoodHit["food"] }>;
  hints: EdamamFoodHit[];
};

export function edamamConfigFromEnv(): EdamamConfig | null {
  const appId = process.env.EDAMAM_APP_ID?.trim();
  const appKey = process.env.EDAMAM_APP_KEY?.trim();
  if (!appId || !appKey) return null;
  return { appId, appKey };
}

export function hasEdamamConfig(): boolean {
  return edamamConfigFromEnv() !== null;
}

/**
 * Search the Edamam food database.
 * Returns up to `pageSize` food hits sorted by relevance.
 */
export async function edamamFoodSearch(
  config: EdamamConfig,
  query: string,
  opts?: { pageSize?: number },
): Promise<EdamamFoodHit[]> {
  const pageSize = opts?.pageSize ?? 10;
  const url = new URL(`${BASE_URL}/parser`);
  url.searchParams.set("app_id", config.appId);
  url.searchParams.set("app_key", config.appKey);
  url.searchParams.set("ingr", query);
  url.searchParams.set("nutrition-type", "logging");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    if (res.status === 429) {
      console.warn("[edamam] Rate limited — daily quota may be exhausted");
      return [];
    }
    console.error(`[edamam] Search failed: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = (await res.json()) as EdamamSearchResponse;

  // `parsed` contains exact matches; `hints` contains fuzzy matches.
  // Combine them, deduplicating by foodId, with parsed first.
  const seen = new Set<string>();
  const results: EdamamFoodHit[] = [];

  for (const p of data.parsed ?? []) {
    if (p.food?.foodId && !seen.has(p.food.foodId)) {
      seen.add(p.food.foodId);
      results.push({ food: p.food });
    }
  }
  for (const h of data.hints ?? []) {
    if (h.food?.foodId && !seen.has(h.food.foodId)) {
      seen.add(h.food.foodId);
      results.push(h);
    }
    if (results.length >= pageSize) break;
  }

  return results.slice(0, pageSize);
}

/**
 * Extract per-100g macros from an Edamam food hit.
 * Edamam's `nutrients` on the `food` object are already per 100g for generic foods.
 */
export function edamamFoodMacrosPer100g(food: EdamamFoodHit["food"]): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
} {
  const n = food.nutrients ?? {};
  return {
    calories: n.ENERC_KCAL ?? 0,
    protein: n.PROCNT ?? 0,
    carbs: n.CHOCDF ?? 0,
    fat: n.FAT ?? 0,
    fiberG: n.FIBTG ?? 0,
    sugarG: n.SUGAR ?? 0,
    sodiumMg: n.NA ?? 0,
  };
}

/**
 * Extract the per-100g micronutrient panel from an Edamam food hit.
 *
 * Edamam Food Database (`/parser`) is intentionally minimal — the
 * `nutrients` block on a hit only carries
 * `ENERC_KCAL/PROCNT/FAT/CHOCDF/FIBTG/SUGAR/NA`. There is no fat
 * breakdown, no cholesterol, no vitamins, no minerals beyond sodium.
 *
 * So this extractor only emits `fiberG/sugarG/sodiumMg` — the meal
 * detail panel will still show the empty-state copy ("Edamam did not
 * publish vitamin or mineral data") because that's accurate: Edamam
 * Food Database genuinely does not publish them on this endpoint.
 * The richer `Nutrition Analysis` API does, but it's a separate
 * paid product and uses ingredient-line input, not food IDs.
 */
export function edamamFoodMicrosPer100g(
  food: EdamamFoodHit["food"],
): Record<string, number> {
  const n = food.nutrients ?? {};
  const out: Record<string, number> = {};
  function emit(key: string, raw: number | undefined, decimals: number): void {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return;
    const f = 10 ** decimals;
    const rounded = Math.round(raw * f) / f;
    if (rounded > 0) out[key] = rounded;
  }
  emit("fiberG", n.FIBTG, 1);
  emit("sugarG", n.SUGAR, 1);
  emit("sodiumMg", n.NA, 0);
  return out;
}

/* ────────────────────────────────────────────────────
 * Edamam Nutrition Analysis API — full recipe-level
 * analysis from a list of ingredient lines.
 *
 * Docs: https://developer.edamam.com/edamam-nutrition-api
 * Uses the same EDAMAM_APP_ID + EDAMAM_APP_KEY credentials.
 * ──────────────────────────────────────────────────── */

const NUTRITION_API_URL = "https://api.edamam.com/api/nutrition-details";

export type EdamamNutrientInfo = {
  label: string;
  quantity: number;
  unit: string;
};

export type EdamamParsedIngredient = {
  quantity: number;
  measure: string;
  food: string;
  foodId: string;
  weight: number; // grams
  nutrients: Record<string, EdamamNutrientInfo>;
  status: string;
};

export type EdamamNutritionAnalysis = {
  calories: number;
  totalWeight: number;
  ingredients: EdamamParsedIngredient[];
  totalNutrients: Record<string, EdamamNutrientInfo>;
  totalDaily: Record<string, EdamamNutrientInfo>;
};

/**
 * Analyze a full recipe via the Edamam Nutrition Analysis API.
 * Accepts raw ingredient lines (e.g. "200g chicken breast", "1 cup rice").
 * Returns total and per-ingredient macros with weights in grams.
 */
export async function edamamNutritionAnalysis(
  config: EdamamConfig,
  ingredientLines: string[],
  opts?: { title?: string },
): Promise<EdamamNutritionAnalysis | null> {
  if (ingredientLines.length === 0) return null;

  const url = new URL(NUTRITION_API_URL);
  url.searchParams.set("app_id", config.appId);
  url.searchParams.set("app_key", config.appKey);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      title: opts?.title ?? "Recipe",
      ingr: ingredientLines,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    if (res.status === 429) {
      console.warn("[edamam] Nutrition Analysis rate limited");
      return null;
    }
    if (res.status === 555) {
      // 555 = recipe with insufficient quality data
      console.warn("[edamam] Nutrition Analysis: insufficient data for recipe");
      return null;
    }
    console.error(`[edamam] Nutrition Analysis failed: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  return {
    calories: data.calories ?? 0,
    totalWeight: data.totalWeight ?? 0,
    ingredients: data.ingredients ?? [],
    totalNutrients: data.totalNutrients ?? {},
    totalDaily: data.totalDaily ?? {},
  };
}

/**
 * Extract standard macros from an Edamam Nutrition Analysis result.
 */
export function edamamAnalysisMacros(analysis: EdamamNutritionAnalysis): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
} {
  const tn = analysis.totalNutrients;
  return {
    calories: Math.round(analysis.calories ?? 0),
    protein: Math.round((tn.PROCNT?.quantity ?? 0) * 10) / 10,
    carbs: Math.round((tn.CHOCDF?.quantity ?? 0) * 10) / 10,
    fat: Math.round((tn.FAT?.quantity ?? 0) * 10) / 10,
    fiberG: Math.round((tn.FIBTG?.quantity ?? 0) * 10) / 10,
    sugarG: Math.round((tn.SUGAR?.quantity ?? 0) * 10) / 10,
    sodiumMg: Math.round(tn.NA?.quantity ?? 0),
  };
}
