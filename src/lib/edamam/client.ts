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
 * Extract the per-100g micronutrient panel from an Edamam SEARCH hit.
 *
 * The `/parser` search endpoint is intentionally minimal — the
 * `nutrients` block on a hit only carries
 * `ENERC_KCAL/PROCNT/FAT/CHOCDF/FIBTG/SUGAR/NA`. So this extractor only
 * emits `fiberG/sugarG/sodiumMg` — the three the search hit can ground.
 *
 * ENG-738 (2026-05-26): the FULL 35-field panel (fat breakdown,
 * cholesterol, vitamins, minerals) IS available from the SAME food
 * database via the `/nutrients` POST endpoint, keyed by `foodId` — see
 * `fetchEdamamMicrosPer100g` below. The food-log SELECT path now calls
 * that on tap, so a logged Edamam food ends with the full panel, not
 * just these three. This search-hit extractor stays minimal because the
 * search list doesn't pay the extra per-hit `/nutrients` round-trip.
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
 * Edamam Food Database `/nutrients` endpoint — full
 * per-100g micronutrient panel for a single foodId.
 *
 * ENG-738 (2026-05-26). The `/parser` search endpoint
 * (`edamamFoodSearch`) only carries the minimal nutrient
 * block (ENERC_KCAL/PROCNT/FAT/CHOCDF/FIBTG/SUGAR/NA). The
 * full 35-field panel — fat breakdown, cholesterol, all the
 * vitamins + minerals — is available from the SAME database
 * via the `/nutrients` POST endpoint, keyed by `foodId`.
 *
 * We POST a single ingredient at exactly 100 g (gram measure
 * URI), so the returned `totalNutrients[CODE].quantity` values
 * ARE per-100g — no division needed. Units already match our
 * canonical `nutrition_micros` keys (mg / mcg / g), so we emit
 * `quantity` verbatim with NO unit conversion — only the
 * code → key remap below. (Contrast OFF, which reports grams
 * across the board and needs ×1000 / ×1e6 scaling.)
 * ──────────────────────────────────────────────────── */

const NUTRIENTS_API_URL = `${BASE_URL}/nutrients`;

/** The gram-measure ontology URI Edamam expects for a 100 g basis. */
const GRAM_MEASURE_URI =
  "http://www.edamam.com/ontologies/edamam.owl#Measure_gram";

/**
 * Edamam `totalNutrients` code → our canonical `nutrition_micros` key.
 * Units already match (Edamam emits mg / mcg / g exactly as our keys
 * expect), so the value is emitted verbatim. Codes absent from this map
 * are dropped. Keys here MUST match what `parseOffMicrosPer100g` /
 * `fdcFoodMicrosPer100g` emit and `MICRO_LINES` reads.
 */
const EDAMAM_NUTRIENT_KEY_MAP: Readonly<Record<string, string>> = {
  // Minerals
  NA: "sodiumMg",
  CA: "calciumMg",
  MG: "magnesiumMg",
  K: "potassiumMg",
  FE: "ironMg",
  ZN: "zincMg",
  P: "phosphorusMg",
  // Vitamins
  VITA_RAE: "vitaminAMcgRae",
  VITC: "vitaminCMg",
  THIA: "thiaminMg",
  RIBF: "riboflavinMg",
  NIA: "niacinMg",
  VITB6A: "vitaminB6Mg",
  FOLDFE: "folateMcg",
  VITB12: "vitaminB12Mcg",
  VITD: "vitaminDMcg",
  TOCPHA: "vitaminEMg",
  VITK1: "vitaminKMcg",
  // Fat breakdown + cholesterol
  FASAT: "saturatedFatG",
  FAMS: "monoFatG",
  FAPU: "polyFatG",
  FATRN: "transFatG",
  CHOLE: "cholesterolMg",
  // Macros that double as micros (uniform with OFF / USDA panels)
  FIBTG: "fiberG",
  SUGAR: "sugarG",
};

/**
 * Map an Edamam `totalNutrients` payload (the `/nutrients` response shape)
 * to our canonical per-100g `nutrition_micros` record.
 *
 * Pure, sync, and exported for unit testing. Emits `quantity` verbatim —
 * no unit conversion (Edamam units already match our keys). Drops any code
 * not in `EDAMAM_NUTRIENT_KEY_MAP` and any zero / non-finite value (the
 * shared "drop zero / non-finite" emit convention).
 */
export function mapEdamamNutrientsToMicros(
  totalNutrients: Record<string, { label?: string; quantity?: number; unit?: string }> | null | undefined,
): Record<string, number> {
  const tn = totalNutrients ?? {};
  const out: Record<string, number> = {};
  for (const [code, key] of Object.entries(EDAMAM_NUTRIENT_KEY_MAP)) {
    const raw = tn[code]?.quantity;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;
    // Round to the same precision the display rows use: 1dp for grams,
    // 1dp for the few mg/mcg keys that lose meaning at 0dp, else 0dp.
    const decimals = key.endsWith("G")
      ? 1
      : key === "ironMg" || key === "vitaminB12Mcg" || key === "vitaminCMg" || key === "vitaminDMcg" || key === "vitaminEMg" || key.startsWith("thiamin") || key.startsWith("riboflavin") || key.startsWith("niacin") || key === "vitaminB6Mg"
        ? 1
        : 0;
    const f = 10 ** decimals;
    const rounded = Math.round(raw * f) / f;
    if (rounded > 0) out[key] = rounded;
  }
  return out;
}

/**
 * Fetch the full per-100g micronutrient panel for a single Edamam food.
 *
 * POSTs the food at a 100 g gram-measure basis to the `/nutrients`
 * endpoint, so the returned quantities are already per-100g, then remaps
 * via `EDAMAM_NUTRIENT_KEY_MAP`. Returns `{}` on ANY failure (bad config,
 * network, non-2xx, malformed body, empty foodId) so this NEVER throws
 * into the food-log path — the caller just logs without the extra micros.
 */
export async function fetchEdamamMicrosPer100g(
  config: EdamamConfig,
  foodId: string,
): Promise<Record<string, number>> {
  const id = foodId?.trim();
  if (!id) return {};

  const url = new URL(NUTRIENTS_API_URL);
  url.searchParams.set("app_id", config.appId);
  url.searchParams.set("app_key", config.appKey);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        ingredients: [
          {
            quantity: 100,
            measureURI: GRAM_MEASURE_URI,
            foodId: id,
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.warn("[edamam] /nutrients rate limited — daily quota may be exhausted");
      } else {
        console.error(`[edamam] /nutrients failed: ${res.status} ${res.statusText}`);
      }
      return {};
    }

    const data = (await res.json()) as {
      totalNutrients?: Record<string, { label?: string; quantity?: number; unit?: string }>;
    };
    return mapEdamamNutrientsToMicros(data.totalNutrients);
  } catch (e) {
    console.error("[edamam] /nutrients error:", e instanceof Error ? e.message : e);
    return {};
  }
}

/*
 * NOTE: The Edamam Nutrition Analysis API (`/nutrition-details`) client
 * (`edamamNutritionAnalysis` + `edamamAnalysisMacros`) was removed 2026-06-17
 * (ENG-1159a) — it had no callers. The product grounds recipe nutrition via
 * the per-ingredient `edamamFoodSearch` path in `verifyIngredients.ts`, not a
 * full-recipe Edamam analysis. Re-add from git history if a recipe-level
 * Edamam call is ever genuinely needed.
 */
