import Constants from "expo-constants";
import { supabase } from "./supabase";
import { authedFetch } from "./authedFetch";
import { captureException } from "./errorTracking";
import {
  type OffServingOption,
} from "@suppr/shared/openFoodFacts/offServingPortions";
import { scaleFromPer100gGrams } from "@suppr/shared/openFoodFacts/scaleFromPer100g";
import { effectiveFoodSearchQuery } from "@suppr/nutrition-core/foodSearchQuery";
import { matchGenericBeverage } from "@suppr/nutrition-core/genericBeverages";
import { matchGenericFood } from "@suppr/nutrition-core/genericFoods";
import { genericFoodMicrosPer100g } from "@suppr/nutrition-core/genericFoodMicros";
import {
  pickEdamamPrimaryServing,
  pickUsdaBrandedPrimaryServing,
  pickUsdaFoodPortionsPrimaryServing,
  parseOffPrimaryServing,
  type PrimaryServing,
} from "@suppr/nutrition-core/primaryServing";
import { inferNaturalServingFromName } from "@suppr/nutrition-core/inferNaturalServing";
import { measureToGrams } from "@suppr/nutrition-core/measureToGrams";
import { checkSubmissionPlausibility } from "@suppr/shared/foodCorrection/plausibility";
import {
  effectiveMacros as effectiveIngredientMacros,
  recomputeRecipeTotals,
  type IngredientOverride,
} from "@suppr/nutrition-core/ingredientOverrides";
import {
  totalGramsForVerifyScale as totalGramsForVerifyScaleImpl,
  totalGramsForVerifyScaleDetailed as totalGramsForVerifyScaleDetailedImpl,
  type VerifyScaleResult,
} from "@suppr/nutrition-core/totalGramsForVerifyScale";
import { inferAllergensFromIngredients } from "@suppr/nutrition-core/inferAllergens";
import { isPlausibleMacrosPer100g } from "@suppr/nutrition-core/macroPlausibility";
import {
  isBareGenericNounRow,
  isLowRelevanceNonVerifiedRow,
  isLowConfidenceDemotedRow,
} from "@suppr/nutrition-core/searchRowTrust";
import { stripSectionPrefix } from "@suppr/shared/recipe-import/socialUrlHelpers";

/**
 * P1-8 (2026-04-25): re-export the canonical threshold from
 * `verifyConfidencePolicy.ts` (single source of truth) instead of
 * maintaining a hand-synced duplicate. Same value as before (0.50);
 * the import path is now stable across web + mobile.
 */
import { RECIPE_INGREDIENT_REVIEW_CONFIDENCE } from "@suppr/nutrition-core/verifyConfidencePolicy";
import {
  foodSearchRankScore,
  searchMatchScore,
  searchRowConfidenceTier,
  splitBestMatches,
  type SearchRowConfidenceTier,
  type SectionedSearchRows,
} from "@suppr/nutrition-core/foodSearchRanking";
import { mergeFoodSearchRows } from "@suppr/shared/nutrition/foodSearchMerge";
export { RECIPE_INGREDIENT_REVIEW_CONFIDENCE };

// Consolidation note (M4): shared parsing lives under `src/lib/recipe-ingredients/`
// vs search-oriented helpers here — see `docs/product/web-mobile-parity-scope.md`
// and planning backlog if we unify structured parse on mobile verify.

type Extra = { supprApiUrl?: string };
function apiBase(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return (extra?.supprApiUrl ?? "").replace(/\/$/, "");
}

/**
 * ENG-1038 — resolved locale appended to vendor-search URLs so the
 * server-side cache partitions hits by region (FatSecret is a US-only
 * dataset; bucketing keeps the cache from cross-serving US ↔ non-US rows).
 * Hermes supports `Intl` from SDK 53; guard for safety and return "" when
 * unavailable so the URL stays well-formed.
 */
function localeQueryParam(): string {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale;
    return loc ? `&locale=${encodeURIComponent(loc)}` : "";
  } catch {
    // Intentional silent fallback — pre-SDK-53 Hermes without `Intl` is an
    // expected runtime condition, not an error. Reporting it would be pure
    // noise; we just omit the locale param. Not a swallowed error (ENG-717).
    return "";
  }
}

/**
 * ENG-1038 — keyed vendors that share an account-wide quota and can be
 * skipped when exhausted. OFF is excluded: it's free, keyless, and called
 * directly from the client (not via a Suppr route), so it has no shared
 * ceiling to guard. Kept as a local type so this RN module never imports the
 * server-only `vendorSearchCache.ts` (which pulls in `@upstash/redis`).
 */
export type VendorId = "usda" | "edamam" | "fatsecret" | "off";

/**
 * ENG-1038 — a route returns `degraded: true` when a vendor's account-wide
 * quota is exhausted and it was SKIPPED (not a genuine empty). The food
 * search clients propagate this so the UI can show an honest "showing saved
 * results" notice rather than a silent blank.
 */
function responseIsDegraded(json: unknown): boolean {
  return Boolean(json && typeof json === "object" && (json as { degraded?: unknown }).degraded === true);
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
  /**
   * 2026-05-15: fraction of `macrosPerServing` represented by ONE
   * unit of this portion. Used when a FatSecret/USDA food has a
   * compound primary serving like "8 pieces" — we surface BOTH the
   * original "8 pieces" portion (servingFraction = 1) AND a derived
   * "1 piece" portion (servingFraction = 1/8) so the user can log
   * individual pieces without doing 0.625-pack arithmetic.
   *
   * Default 1 (the portion = one full serving). previewMacros multiplies
   * `quantity × servingFraction × macrosPerServing` in the per-serving
   * branch; per-100g math is unchanged (it uses gramWeight directly).
   */
  servingFraction?: number;
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
  /** F-74 cross-device (2026-05-08): scaled caffeine + alcohol for
   *  this ingredient's gram weight. Populated from `macrosPer100g.
   *  {caffeineMgPer100g,alcoholGPer100g}` via `scaleMacros` and
   *  rolled up to `recipes.caffeine_mg / alcohol_g` in
   *  `saveVerifiedIngredients`. */
  caffeineMg: number;
  alcoholG: number;
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
  foodPortions?: {
    gramWeight?: number;
    amount?: number;
    modifier?: string;
    portionDescription?: string;
    measureUnit?: { name?: string; abbreviation?: string };
  }[];
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
  /**
   * F-79 (2026-04-25) — full per-100g micronutrient set in canonical
   * camelCase keys. Scale by `grams / 100` on commit and merge into
   * `nutrition_micros`. Closes the "every micro row shows —" failure.
   */
  microsPer100g?: Record<string, number>;
  /** OFF-style presets (label + grams) for scaling per-100g macros. */
  servingOptions?: OffServingOption[];
  /** Filled by scanner when confirming (e.g. "4 dumplings"). */
  portionSummary?: string;
  /** Source of the data */
  source?: "user" | "verified" | "open_food_facts";
  /** Whether this is a verified community entry */
  verified?: boolean;
  verificationStatus?: "pending" | "verified" | "rejected";
  /** True when tier-2 `user_foods` row belongs to the signed-in viewer. */
  isOwnSubmission?: boolean;
  /**
   * P0 (2026-05-26) — true when OFF's published `*_100g` macros disagreed
   * with the per-serving basis and were reconstructed. Barcode commit path
   * surfaces a "double-check these numbers" warning when set.
   */
  basisCorrected?: boolean;
  /** ENG-774 — per-serving label with no gram mass; scale by serving count. */
  macrosPerServing?: { calories: number; protein: number; carbs: number; fat: number };
  servingNoMass?: boolean;
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

// Honest Verified / Estimated tier for a scanned barcode product. Defined in
// the side-effect-free `./barcodeConfidence` module (no Supabase import) so it
// is unit-testable without the data layer; re-exported here for screen call
// sites that already import from verifyRecipe.
export { barcodeConfidenceTier, type BarcodeConfidenceTier } from "./barcodeConfidence";

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
      // GW-08 P2 (audit 2026-04-28): added `confidence`.
      // F-74 cross-device (2026-05-08): added caffeine_mg, alcohol_g.
      "id, name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, caffeine_mg, alcohol_g, is_verified, source, override_macros, added_by_user, confidence",
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

    // F-150 (2026-05-10): the previous fallback (`unit === "g" && amount ? amount : 100`)
    // silently corrupted per-100g back-calc for any ingredient stored in non-gram
    // units. A recipe row with `unit="cup"` `amount=1` of cooked rice would have
    // its 158g-of-rice macros divided by factor=1, producing per-100g macros that
    // are 58% too high. `measureToGrams` covers eggs, cups (region-aware), tins,
    // counts (medium/large/small), and the COUNT_WEIGHT_G table so non-gram units
    // resolve to a defensible weight before the back-calc.
    let grams: number;
    if (unit === "g" && amount && amount > 0) {
      grams = amount;
    } else if (unit && amount && amount > 0 && r.name) {
      const inferred = measureToGrams({ name: String(r.name), amount: Number(amount), unit: String(unit) });
      grams = inferred > 0 ? inferred : 100;
    } else {
      grams = 100;
    }
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
    // F-34 defence-in-depth (TestFlight ANmFiVpOfYEN re-fired 2026-04-25):
    // strip "For [section]:" prefix at READ time too, not just at import time.
    // Older imports + LLM regressions can leave the prefix baked into the
    // stored row; stripping on display keeps the verify list legible without
    // a destructive backfill. Underlying DB row stays intact.
    const displayName = stripSectionPrefix(r.name ?? "");
    return {
      id: r.id,
      name: displayName,
      amount,
      unit,
      calories: r.calories ?? 0,
      protein: r.protein ?? 0,
      carbs: r.carbs ?? 0,
      fat: r.fat ?? 0,
      fiberG: r.fiber_g ?? 0,
      sugarG: r.sugar_g ?? 0,
      sodiumMg: r.sodium_mg ?? 0,
      // F-74 cross-device (2026-05-08): hydrate scaled caffeine /
      // alcohol from the new columns. Pre-migration rows return null
      // / undefined → default to 0 (matches the column default).
      caffeineMg: typeof r.caffeine_mg === "number" ? r.caffeine_mg : 0,
      alcoholG: typeof r.alcohol_g === "number" ? r.alcohol_g : 0,
      source: r.source ?? null,
      // GW-08 P2 (audit 2026-04-28): pre-fix this was always
      // `r.is_verified ? 0.9 : 0.3` — a circular synthesis (the
      // `is_verified` bit feeds the confidence value, which then
      // feeds the recipe-level trust rollup that ultimately reads
      // back the same bit). Now hydrates the real persisted
      // `recipe_ingredients.confidence` column when present, with
      // the legacy synthesis as fallback for pre-migration rows
      // (column was added by `20260408143000_add_verified_nutrition_micros.sql`
      // but rows persisted before that fix carry NULL).
      confidence:
        typeof r.confidence === "number" && Number.isFinite(r.confidence)
          ? r.confidence
          : r.is_verified
            ? 0.9
            : 0.3,
      matchedName: null,
      isVerified: r.is_verified ?? false,
      isDirty: false,
      macrosPer100g: per100g,
      portions: [],
      chosenPortion:
        unit === "g" || unit === "ml"
          ? { label: unit, gramWeight: 1, amount: 1 }
          : null,
      ...(overrideMacros ? { overrideMacros } : {}),
      ...(r.added_by_user ? { addedByUser: true as const } : {}),
    };
  });
}

/** Search USDA foods via the Next.js API. `page` is 1-indexed and
 *  forwarded as `pageNumber`. TestFlight F-10
 *  (`AHnI_fIc7SKbaRcdd5SZB9Q`, 2026-04-19). */
export async function searchUsda(
  query: string,
  opts?: { page?: number; onDegraded?: () => void },
): Promise<FoodSearchResult[]> {
  const base = apiBase();
  const q = effectiveFoodSearchQuery(query);
  if (!base || !q.trim()) return [];
  const page = opts?.page && opts.page > 0 ? Math.floor(opts.page) : 1;

  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);
    const res = await authedFetch(
      `${base}/api/usda/search?q=${encodeURIComponent(q.trim())}&page=${page}${localeQueryParam()}`,
      { signal: ac.signal },
    );
    clearTimeout(t);
    const json = await res.json();
    if (responseIsDegraded(json)) opts?.onDegraded?.();
    // 2026-05-06 (Grace) — surface why a search returned empty so
    // TestFlight / sim logs show the actual failure mode (env var,
    // OAuth, rate-limit, etc.) instead of silently disappearing.
    if (!json.ok || !Array.isArray(json.hits)) {
      const errCode = typeof json?.error === "string" ? json.error : "unknown";
      const sampleMsg = typeof json?.message === "string" ? json.message.slice(0, 120) : null;
      console.warn(
        `[searchUsda] empty result — status=${res.status} error=${errCode}${
          sampleMsg ? ` msg="${sampleMsg}"` : ""
        }`,
      );
      return [];
    }
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
    // F-81 (2026-04-25) — AbortError is benign: fired when the user types
    // another character (debounced re-fetch cancels the in-flight request)
    // or when the component unmounts. Console.error here surfaces as a
    // LogBox / toast on TestFlight ("[searchUsda] failed: Aborted") even
    // though nothing is actually wrong. Swallow benign aborts; only log
    // genuine network / server errors.
    if (!isBenignAbort(e)) {
      console.error("[searchUsda] failed:", e instanceof Error ? e.message : e);
    }
    return [];
  }
}

/**
 * F-81 — distinguish AbortController-fired aborts (benign — just means a
 * later request superseded this one) from real network errors. Native
 * fetch on iOS / Android throws a `DOMException` with `name === "AbortError"`,
 * but the message can be `"Aborted"` or `"The operation was aborted"`.
 * Cross-runtime safe: also handles plain `Error` objects with `.name`
 * stamped to `"AbortError"`.
 */
function isBenignAbort(e: unknown): boolean {
  if (!e) return false;
  if (typeof e !== "object") return false;
  const name = (e as { name?: unknown }).name;
  if (typeof name === "string" && name === "AbortError") return true;
  const message = (e as { message?: unknown }).message;
  if (typeof message === "string" && /^aborted$/i.test(message.trim())) return true;
  return false;
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
  /**
   * F-79 (2026-04-25) — full per-100g micronutrient set in canonical
   * camelCase keys. Scale by `grams / 100` and persist on
   * `nutrition_entries.nutrition_micros` so the meal-detail "Vitamins,
   * minerals & more" panel renders real values instead of every row "—".
   */
  microsPer100g?: Record<string, number>;
  imageUrl: string | null;
  /** Free-text serving string from OFF, e.g. "1 slice (28 g)". */
  servingSize: string | null;
};

/** Search Open Food Facts via the proxied `/api/off/search` route (ENG-1059).
 *  `page` is 1-indexed. TestFlight F-10 (`AHnI_fIc7SKbaRcdd5SZB9Q`, 2026-04-19). */
export async function searchOpenFoodFacts(
  query: string,
  opts?: { page?: number; onDegraded?: () => void },
): Promise<OffSearchResult[]> {
  const base = apiBase();
  const q = effectiveFoodSearchQuery(query);
  if (!base || !q.trim()) return [];
  const page = opts?.page && opts.page > 0 ? Math.floor(opts.page) : 1;

  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);
    const res = await authedFetch(
      `${base}/api/off/search?q=${encodeURIComponent(q.trim())}&page=${page}${localeQueryParam()}`,
      { signal: ac.signal },
    );
    clearTimeout(t);
    const json = await res.json();
    if (responseIsDegraded(json)) opts?.onDegraded?.();
    if (!json.ok || !Array.isArray(json.hits)) {
      const errCode = typeof json?.error === "string" ? json.error : "unknown";
      console.warn(`[searchOFF] empty result — status=${res.status} error=${errCode}`);
      return [];
    }
    return json.hits.map((h: {
      code: string;
      name: string;
      brand?: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiberG: number;
      sugarG: number;
      sodiumMg: number;
      caffeineMgPer100g?: number | null;
      alcoholGPer100g?: number | null;
      microsPer100g?: Record<string, number>;
      imageUrl?: string | null;
      servingSize?: string | null;
    }) => ({
      code: h.code ?? "",
      name: h.name ?? "Unknown",
      brand: h.brand ?? "",
      calories: h.calories,
      protein: h.protein,
      carbs: h.carbs,
      fat: h.fat,
      fiberG: h.fiberG,
      sugarG: h.sugarG,
      sodiumMg: h.sodiumMg,
      caffeineMgPer100g: h.caffeineMgPer100g ?? null,
      alcoholGPer100g: h.alcoholGPer100g ?? null,
      microsPer100g: h.microsPer100g,
      imageUrl: h.imageUrl ?? null,
      servingSize: h.servingSize ?? null,
    }));
  } catch (e) {
    if (isBenignAbort(e)) return [];
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
  /**
   * F-79 (2026-04-25) — full per-100g micronutrient set in canonical
   * camelCase keys (`saturatedFatG`, `cholesterolMg`, etc.). Populated
   * from OFF; empty for USDA / Edamam until those sources are extended.
   * Commit sites scale by `grams / 100` and merge into `nutrition_micros`.
   */
  microsPer100g?: Record<string, number>;
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
  /**
   * ENG-807 — honest confidence tier derived from BOTH provenance AND the
   * computed match score (never source alone). `"verified"` only for an
   * authoritative corpus (verified USDA / Suppr generic) WITH a strong name
   * match; everything else is `"estimated"`. The UI renders the legible
   * confidence chip from this (soft-blue Verified / amber Estimated — see the
   * ENG-798 prototype). Present on every merged row.
   */
  confidenceTier?: SearchRowConfidenceTier;
  /** Internal: source type for fetching full data on tap.
   *  F-73 (2026-04-27): "GenericBeverage" + "GenericFood" rows are seeded
   *  in-memory from `src/lib/nutrition/genericBeverages.ts` /
   *  `genericFoods.ts` and need no on-tap fetch.
   *  Lane-A 2026-04-30: "FatSecret" added as the 4th external source —
   *  per-serving rows carry no per-100g macros until `food.get` lands. */
  _source: "USDA" | "OFF" | "Edamam" | "FatSecret" | "GenericBeverage" | "GenericFood";
  _fdcId?: number;
  _offCode?: string;
  /** Edamam food identifier — stable string, not numeric. */
  _edamamFoodId?: string;
  /** FatSecret food identifier — stable string. Used by `getFatSecretFood`. */
  _fatSecretFoodId?: string;
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
   * 2026-05-06 — Edamam Food Database publishes only fiber/sugar/sodium
   * (no vitamins/minerals on this endpoint), so this map only ever
   * contains those three keys. Routed through so the meal-detail
   * "Vitamins, minerals & more" surface populates them; the rest of
   * the panel will still show "Edamam did not publish" rows.
   */
  microsPer100g?: Record<string, number>;
  /**
   * `servingSizes[]` — Edamam often exposes the "real" gram weight of
   * the natural portion here (e.g. `{label:"Serving", quantity:230}` for
   * a Pret sandwich). Passed straight through from the API route so the
   * primary-serving inference helper can pick the non-"Gram" entry.
   */
  servingSizes?: { uri?: string; label?: string; quantity?: number }[];
};

/**
 * Search Edamam (restaurant + branded foods) via our Next.js API route.
 * Empty on network / server / rate-limit errors so it never blocks
 * USDA / OFF from rendering. TestFlight `AOI9xgY88Dx-uphiXI8IzEk`.
 */
export async function searchEdamam(
  query: string,
  opts?: { mode?: "foods" | "meals"; page?: number; onDegraded?: () => void },
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
      `${base}/api/edamam/search?q=${encodeURIComponent(q.trim())}&mode=${mode}&page=${page}${localeQueryParam()}`,
      { signal: ac.signal },
    );
    clearTimeout(t);
    const json = await res.json();
    if (responseIsDegraded(json)) opts?.onDegraded?.();
    // 2026-05-06 (Grace) — surface why a search returned empty.
    if (!json.ok || !Array.isArray(json.hits)) {
      const errCode = typeof json?.error === "string" ? json.error : "unknown";
      const sampleMsg = typeof json?.message === "string" ? json.message.slice(0, 120) : null;
      console.warn(
        `[searchEdamam] empty result — status=${res.status} error=${errCode}${
          sampleMsg ? ` msg="${sampleMsg}"` : ""
        }`,
      );
      return [];
    }
    // 2026-05-06 (Grace) — the route returns ok:true with hits:[]
    // when the upstream call fails. Surface its `_diag` echo so prod
    // failures show up in Metro logs.
    if (Array.isArray(json.hits) && json.hits.length === 0 && json._diag) {
      const upstream = typeof json._diag?.upstream === "string" ? json._diag.upstream : "unknown";
      const upstreamMsg = typeof json._diag?.message === "string" ? json._diag.message : "";
      console.warn(
        `[searchEdamam] upstream ${upstream} (route returned ok+empty)${
          upstreamMsg ? ` — ${upstreamMsg}` : ""
        }`,
      );
    }
    // Route already shapes each hit to the EdamamSearchResult envelope
    // (including `servingSizes`), so we pass the array through.
    return json.hits as EdamamSearchResult[];
  } catch (e) {
    if (isBenignAbort(e)) return [];
    console.error("[searchEdamam] failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** FatSecret hit shape returned by `/api/fatsecret/search`. */
export type FatSecretSearchResult = {
  foodId: string;
  label: string;
  brand: string | null;
  /** Per-100g macros — only present when the inline `food_description` was per 100g. */
  macrosPer100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
  /** Free-text serving label from FatSecret (e.g. "1 sandwich (240g)"). */
  servingLabel: string | null;
  /** Gram weight pulled from "(N g)" suffix when present. */
  servingGrams: number | null;
  /** Per-serving macros — present when the row was per-serving. */
  macrosPerServing: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
};

/**
 * Search FatSecret via our Next.js API route. Lane-A 2026-04-30 wired
 * FatSecret in as the 4th source (alongside USDA / OFF / Edamam) so
 * branded queries like "Big Mac" / "Starbucks grande latte" surface
 * with brand attribution rather than a no-results state.
 *
 * Empty on network / server / rate-limit errors so it never blocks the
 * other three sources from rendering. Per-serving rows surface with
 * null per-100g macros — the on-tap detail fetch (`getFatSecretFood`)
 * lands the canonical panel before the preview opens. Never invents
 * macros.
 */
export async function searchFatSecret(
  query: string,
  opts?: { page?: number; onDegraded?: () => void },
): Promise<FatSecretSearchResult[]> {
  const base = apiBase();
  const q = effectiveFoodSearchQuery(query);
  if (!base || !q.trim()) return [];
  const page = opts?.page && opts.page > 0 ? Math.floor(opts.page) : 1;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    const res = await authedFetch(
      `${base}/api/fatsecret/search?q=${encodeURIComponent(q.trim())}&page=${page}${localeQueryParam()}`,
      { signal: ac.signal },
    );
    clearTimeout(t);
    const json = await res.json();
    if (responseIsDegraded(json)) opts?.onDegraded?.();
    // 2026-05-06 (Grace) — production smoke test showed no FatSecret
    // hits surfacing in the merge. Was: silently returned [] on any
    // non-ok shape, so the cause (server_misconfigured / OAuth
    // expired / rate-limited / etc.) was invisible from
    // mobile/TestFlight logs. Now surfaces the route's `error` token
    // + status so the failure mode is greppable in device logs.
    if (!json.ok || !Array.isArray(json.hits)) {
      const errCode = typeof json?.error === "string" ? json.error : "unknown";
      const sampleMsg = typeof json?.message === "string" ? json.message.slice(0, 120) : null;
      console.warn(
        `[searchFatSecret] empty result — status=${res.status} error=${errCode}${
          sampleMsg ? ` msg="${sampleMsg}"` : ""
        }`,
      );
      return [];
    }
    // 2026-05-06 (Grace) — the route returns ok:true with hits:[] when
    // the upstream call fails (so the merge keeps USDA/OFF rendering).
    // The route now also echoes a `_diag` field on that fallback path.
    // Surface it in Metro logs so prod-side failures don't require
    // chasing Vercel runtime logs.
    if (Array.isArray(json.hits) && json.hits.length === 0 && json._diag) {
      const upstream = typeof json._diag?.upstream === "string" ? json._diag.upstream : "unknown";
      const upstreamMsg = typeof json._diag?.message === "string" ? json._diag.message : "";
      console.warn(
        `[searchFatSecret] upstream ${upstream} (route returned ok+empty)${
          upstreamMsg ? ` — ${upstreamMsg}` : ""
        }`,
      );
    }
    return json.hits as FatSecretSearchResult[];
  } catch (e) {
    if (isBenignAbort(e)) return [];
    console.error("[searchFatSecret] failed:", e instanceof Error ? e.message : e);
    return [];
  }
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
  opts?: {
    page?: number;
    limit?: number;
    /**
     * ENG-1038 — called once when ≥1 keyed vendor (USDA / Edamam /
     * FatSecret) was skipped because its account-wide quota was exhausted.
     * The UI uses this to show an honest "showing saved results" notice
     * rather than a silent blank. OFF is proxied with cache/quota (ENG-1059);
     * when it has hits the search is still useful — the notice is advisory, not
     * an error.
     */
    onDegraded?: (info: { sources: VendorId[] }) => void;
  },
): Promise<UnifiedSearchResult[]> {
  const t = query.trim();
  if (!t) return [];
  const qRank = effectiveFoodSearchQuery(t);
  if (!qRank.trim()) return [];
  const page = opts?.page && opts.page > 0 ? Math.floor(opts.page) : 1;
  const limit = opts?.limit && opts.limit > 0 ? Math.floor(opts.limit) : 24;

  // ENG-1038 — collect which keyed vendors were skipped for quota so we can
  // emit a single degraded notice after the fan-out resolves.
  const degradedSources = new Set<VendorId>();
  const noteDegraded = (v: VendorId) => () => degradedSources.add(v);

  // F-73 (2026-04-27) — generic-beverages preempt USDA Branded for known
  // coffee-drink queries ("cortado" returning Spanish cheese was the
  // canonical bug). Match runs against an alias list; when it lands the
  // entry is prepended to the merged results so the user sees the right
  // row first. Other sources still load and surface below.
  //
  // Same-day extension: generic-foods table covers fruit/veg/grain/
  // protein/dairy queries that hit the parallel USDA-Branded-noise
  // class (e.g. "apple" → branded "Apple Cinnamon Bagel"). Beverages
  // match first because of how query-overlap shakes out (e.g. typing
  // "milk" matches a beverage; nothing in the food table aliases on
  // bare "milk"); guard not strictly needed but keeps order stable.
  const genericBeverage = matchGenericBeverage(t);
  const genericFood = genericBeverage ? null : matchGenericFood(t);

  const usdaP = searchUsda(t, { page, onDegraded: noteDegraded("usda") });
  const offP = searchOpenFoodFacts(t, { page, onDegraded: noteDegraded("off") });
  const edamamP = searchEdamam(t, { page, onDegraded: noteDegraded("edamam") });
  const fatsecretP = searchFatSecret(t, { page, onDegraded: noteDegraded("fatsecret") });

  let usda: FoodSearchResult[] = [];
  let off: OffSearchResult[] = [];
  let eda: EdamamSearchResult[] = [];
  let fs: FatSecretSearchResult[] = [];

  // F-73: when a generic match landed, surface it synchronously (no
  // async wait) so the user sees the right answer instantly. Other
  // sources still load and append below.
  // ENG-807 — stamp the honest confidence tier on the seeded generic row too
  // (it bypasses `mergeResults`). Curated generic foods/beverages have
  // verifiable provenance; the tier still gates on the name match vs the query
  // so a weak alias hit doesn't claim "Verified". Query is in scope here.
  const genericRowsRaw: UnifiedSearchResult[] = genericBeverage
    ? [genericBeverageToUnifiedResult(genericBeverage)]
    : genericFood
      ? [genericFoodToUnifiedResult(genericFood)]
      : [];
  const genericRows: UnifiedSearchResult[] = genericRowsRaw.map((r) => ({
    ...r,
    confidenceTier: searchRowConfidenceTier({
      source: r._source,
      verified: Boolean(r.verified),
      matchScore: searchMatchScore(qRank, r.name),
    }),
  }));
  if (genericRows.length > 0 && onPartial) onPartial(genericRows);

  if (onPartial) {
    // Stream: deliver whichever source responds first, then keep appending
    // as the others resolve. Users see USDA / OFF hits instantly without
    // waiting for Edamam / FatSecret's network round-trip.
    const usdaLabelled = usdaP.then((r) => { usda = r; return "usda" as const; });
    const offLabelled = offP.then((r) => { off = r; return "off" as const; });
    const edaLabelled = edamamP.then((r) => { eda = r; return "edamam" as const; });
    const fsLabelled = fatsecretP.then((r) => { fs = r; return "fatsecret" as const; });
    const pending = new Set<Promise<"usda" | "off" | "edamam" | "fatsecret">>([
      usdaLabelled,
      offLabelled,
      edaLabelled,
      fsLabelled,
    ]);
    while (pending.size > 0) {
      const done = await Promise.race(pending);
      pending.delete(
        done === "usda"
          ? usdaLabelled
          : done === "off"
            ? offLabelled
            : done === "edamam"
              ? edaLabelled
              : fsLabelled,
      );
      onPartial([...genericRows, ...mergeResults(qRank, usda, off, eda, fs, limit - genericRows.length)]);
    }
  } else {
    [usda, off, eda, fs] = await Promise.all([usdaP, offP, edamamP, fatsecretP]);
  }

  // ENG-1038 — if any keyed vendor was skipped for quota, tell the UI so it
  // can render an honest "showing saved results" notice. Fired once, after
  // the fan-out resolves, with the set of degraded sources.
  if (degradedSources.size > 0 && opts?.onDegraded) {
    opts.onDegraded({ sources: [...degradedSources] });
  }

  return [...genericRows, ...mergeResults(qRank, usda, off, eda, fs, limit - genericRows.length)];
}

/**
 * F-73 (2026-04-27) — convert a GenericBeverage entry to a
 * UnifiedSearchResult so it slots into the search results list. The
 * `key` is `generic-beverage:{id}` so commit paths can recognise the
 * source if they need to (currently they don't — the macros + caffeine
 * are read directly).
 */
function genericBeverageToUnifiedResult(b: import("@suppr/nutrition-core/genericBeverages").GenericBeverage): UnifiedSearchResult {
  return {
    key: `generic-beverage:${b.id}`,
    name: b.name,
    subtitle: b.subtitle,
    _source: "GenericBeverage",
    macrosPer100g: {
      calories: b.per100ml.calories,
      protein: b.per100ml.protein,
      carbs: b.per100ml.carbs,
      fat: b.per100ml.fat,
      fiberG: 0,
      sugarG: 0,
      sodiumMg: 0,
      // F-74 alcohol auto-track reads `alcoholGPer100g`; treat ml as g
      // for liquids (1g/ml is close enough across coffee/tea/wine/beer
      // — the tracker rounds to 0.1g anyway).
      caffeineMgPer100g: b.caffeineMgPer100ml,
      alcoholGPer100g: b.alcoholGPer100ml ?? 0,
    },
    calsPer100g: b.per100ml.calories,
    verified: true,
    primaryServing: {
      label: `${b.servingMl} ml`,
      grams: b.servingMl,
      kcal: Math.round((b.per100ml.calories * b.servingMl) / 100),
      protein: Math.round((b.per100ml.protein * b.servingMl) / 100 * 10) / 10,
      carbs: Math.round((b.per100ml.carbs * b.servingMl) / 100 * 10) / 10,
      fat: Math.round((b.per100ml.fat * b.servingMl) / 100 * 10) / 10,
    },
  };
}

/**
 * F-73 follow-up (2026-04-27) — convert a GenericFood entry to a
 * UnifiedSearchResult. Same shape as the beverage helper but solid-food
 * sized: per-100g macros land directly (no ml→g coercion), and the
 * primary serving carries the curated `servingLabel` (e.g.
 * "1 medium (182g)" for an apple).
 */
function genericFoodToUnifiedResult(f: import("@suppr/nutrition-core/genericFoods").GenericFood): UnifiedSearchResult {
  // ENG-738 — attach the baked per-100g USDA micronutrient panel for this
  // generic food so the meal-detail "Vitamins, minerals & more" card
  // populates after it's logged. Mirrors the OFF row (which carries
  // `microsPer100g` at construction) and the web `buildGenericMatchRow`.
  // `undefined` for an unbaked id keeps the key absent rather than null.
  const genericMicros = genericFoodMicrosPer100g(f.id);
  return {
    key: `generic-food:${f.id}`,
    name: f.name,
    subtitle: f.subtitle,
    _source: "GenericFood",
    macrosPer100g: {
      calories: f.per100g.calories,
      protein: f.per100g.protein,
      carbs: f.per100g.carbs,
      fat: f.per100g.fat,
      fiberG: f.per100g.fiberG,
      sugarG: f.per100g.sugarG,
      sodiumMg: f.per100g.sodiumMg,
      caffeineMgPer100g: 0,
      alcoholGPer100g: 0,
    },
    ...(genericMicros ? { microsPer100g: genericMicros } : {}),
    calsPer100g: f.per100g.calories,
    verified: true,
    primaryServing: {
      label: f.servingLabel,
      grams: f.servingG,
      kcal: Math.round((f.per100g.calories * f.servingG) / 100),
      protein: Math.round((f.per100g.protein * f.servingG) / 100 * 10) / 10,
      carbs: Math.round((f.per100g.carbs * f.servingG) / 100 * 10) / 10,
      fat: Math.round((f.per100g.fat * f.servingG) / 100 * 10) / 10,
    },
  };
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
  fatsecret: FatSecretSearchResult[] = [],
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
    // F-91 (2026-04-25) — USDA's `/foods/search` endpoint does not ship
    // `foodPortions[]` for Foundation / SR Legacy hits, so the previous
    // chain returned null for "Eggs, Grade A, Large, egg whole" /
    // "Bananas, raw" / etc, leaving the search row to render "per 100g".
    // Pattern-match the description against a known-natural-serving
    // table (1 large egg = 50g, 1 medium banana = 118g, …) when other
    // sources of primary serving are absent, but only on verified rows.
    const primaryServing = hasCals
      ? (pickUsdaBrandedPrimaryServing(per100g, {
          servingSize: item.servingSize ?? null,
          servingSizeUnit: item.servingSizeUnit ?? null,
          householdServingFullText: item.householdServingFullText ?? null,
        })
        ?? pickUsdaFoodPortionsPrimaryServing(per100g, item.foodPortions ?? null)
        ?? inferNaturalServingFromName(item.description, per100g, isVerified))
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
      // F-87 (2026-04-25) — trust-weight USDA results: verified types
      // (Foundation / SR Legacy / Survey) get a small boost; USDA Branded
      // takes a larger penalty than OFF-branded because the failure mode
      // is worse (USDA Branded "EGGS" looks authoritative but is a misnamed
      // packaged product, where OFF-branded at least has a real brand
      // string). Closes the "1 egg 40g 210 kcal" failure where a
      // 525-kcal/100g branded "EGGS" outranked the verified Foundation
      // "Eggs, Grade A, Large, egg whole" row.
      _relevance: foodSearchRankScore({
        query,
        name: item.description,
        source: "USDA",
        verified: isVerified,
      }),
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
    // F-77 (2026-04-25) — trust-weight: OFF user-uploaded rows lose to
    // USDA on tie/near-tie via shared `foodSearchRankScore`.
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
      // F-79 — thread the OFF micro set through so commit sites can
      // persist on `nutrition_entries.nutrition_micros`.
      microsPer100g: item.microsPer100g,
      imageUrl: item.imageUrl,
      primaryServing,
      _source: "OFF",
      _offCode: item.code,
      _relevance: foodSearchRankScore({
        query,
        name: displayName,
        source: "OFF",
      }),
    });
  }

  for (const item of edamam) {
    // 2026-05-06 — drop Edamam rows whose per-100g panel is entirely
    // unusable (no kcal AND no macros). TestFlight feedback: branded
    // McDonald's variants like "Big Mac Salad" surfaced with no kcal
    // headline + "Tap for nutrition info" + un-clickable. Those rows
    // are Edamam stubs with calories=0 and protein+carbs+fat=0 — there
    // is nothing the user can do with them, and the existing tap path
    // requires `item.macrosPer100g` to be present so they're inert
    // anyway.
    const macroMass = (item.protein ?? 0) + (item.carbs ?? 0) + (item.fat ?? 0);
    if ((item.calories ?? 0) <= 1 && macroMass < 0.5) continue;
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
      // 2026-05-06 — thread Edamam's fiber/sugar/sodium micros through
      // so the meal-detail panel populates them. Edamam Food Database
      // doesn't ship richer micros on this endpoint; the rest of the
      // panel will read "Edamam did not publish".
      ...(item.microsPer100g ? { microsPer100g: item.microsPer100g } : {}),
      imageUrl: item.imageUrl,
      primaryServing,
      _source: "Edamam",
      _edamamFoodId: item.foodId,
      _relevance: foodSearchRankScore({
        query,
        name: displayName,
        source: "Edamam",
      }),
    });
  }

  for (const item of fatsecret) {
    const brand = item.brand ? titleCase(item.brand) : "";
    const cleanLabel = titleCase(
      // Server label may already be "Brand · Name" — strip the prefix
      // so we don't double-render the brand. Defensive; the route shape
      // is currently the joined string.
      brand && item.label.startsWith(`${brand} · `) ? item.label.slice(brand.length + 3) : item.label,
    );
    const displayName = brand ? `${brand} · ${cleanLabel}` : cleanLabel;
    // Synthesise primary serving from whatever FatSecret provides:
    //   - With grams ("Per 1 sandwich (240g)") → label + gram-grounded
    //     serving, so the search row renders kcal + macros AND the
    //     portion picker can scale by grams.
    //   - Without grams ("Per 1 serving") → label-only serving with
    //     `grams: 0` (sentinel meaning "per-serving only, no gram
    //     scaling"). The search row still renders kcal + macros so
    //     the user knows what they're picking; the on-tap commit
    //     uses `macrosPerServing × quantity` directly.
    //
    // 2026-05-06: previously only the with-grams path synthesised a
    // primaryServing, so per-serving-only FatSecret rows like
    // McDonald's Big Mac surfaced as placeholder ("Tap for nutrition
    // info") in the search list — invisible kcal headline.
    const primaryServing: PrimaryServing | null =
      item.macrosPerServing && item.servingLabel
        ? {
            label: item.servingLabel,
            grams: item.servingGrams && item.servingGrams > 0 ? item.servingGrams : 0,
            kcal: item.macrosPerServing.calories,
            protein: item.macrosPerServing.protein,
            carbs: item.macrosPerServing.carbs,
            fat: item.macrosPerServing.fat,
          }
        : null;
    // Lane-A (2026-04-30) — FatSecret is a commercial source with high
    // brand coverage. Same trust band as Edamam (-0.05); the merge
    // still defers to verified USDA on tie. Without this, branded
    // queries like "Big Mac" / "Starbucks" never surfaced because
    // FatSecret wasn't in the merge AT ALL pre-Lane-A.
    results.push({
      key: `fatsecret-${item.foodId}`,
      name: displayName,
      calsPer100g: item.macrosPer100g?.calories ?? undefined,
      macrosPer100g: item.macrosPer100g
        ? {
            calories: item.macrosPer100g.calories,
            protein: item.macrosPer100g.protein,
            carbs: item.macrosPer100g.carbs,
            fat: item.macrosPer100g.fat,
            fiberG: 0,
            sugarG: 0,
            sodiumMg: 0,
            caffeineMgPer100g: null,
            alcoholGPer100g: null,
          }
        : undefined,
      primaryServing,
      _source: "FatSecret",
      _fatSecretFoodId: item.foodId,
      _relevance: foodSearchRankScore({
        query,
        name: displayName,
        source: "FatSecret",
      }),
    });
  }

  return mergeFoodSearchRows({
    query,
    rows: results,
    limit,
  });
}

/**
 * ENG-807 — split a ranked, merged search-result list into the prototype's
 * "Best matches" / "More results" sections by the shared score threshold.
 *
 * Pure + shared with web (both platforms call `splitBestMatches` from
 * `foodSearchRanking.ts`) so the two surfaces section identically. Rows from
 * `searchFoods` carry `_relevance` (the combined rank score) when they came
 * through `mergeResults`; generic seeded rows that bypass the merge default to
 * a best-match score so curated foods lead. The UI consumes this; the JSX is
 * the next stage's lane.
 */
export function splitFoodSearchResults(
  query: string,
  rows: UnifiedSearchResult[],
): SectionedSearchRows<UnifiedSearchResult> {
  return splitBestMatches(rows, (r) => {
    const rel = (r as UnifiedSearchResult & { _relevance?: number })._relevance;
    if (typeof rel === "number") return rel;
    // Rows that didn't carry a precomputed rank score (e.g. seeded generic
    // rows prepended ahead of the merge) — recompute from the shared scorer so
    // the split stays honest rather than defaulting them blindly into Best.
    return foodSearchRankScore({
      query,
      name: r.name,
      source: r._source,
      verified: Boolean(r.verified),
    });
  });
}

/** Get full macros for a specific USDA food (per 100g) plus available portions. */
export async function getFoodMacros(
  fdcId: number,
): Promise<{
  macrosPer100g: MacrosPer100g;
  /**
   * 2026-05-06 — wider per-100g micronutrient panel from USDA
   * (sat/poly/mono fat, cholesterol, calcium, iron, B-vitamins,
   * vitamin C/D/E/K/A, etc) so the meal-detail "Vitamins, minerals
   * & more" surface populates for USDA-sourced logs. Empty / absent
   * when USDA didn't publish micros for this food.
   */
  microsPer100g?: Record<string, number>;
  portions: FoodPortion[];
  /**
   * F-88 (2026-04-25) — best-fit natural-portion ("1 medium" / "1 large")
   * derived from the food's foodPortions[]. The client defaults the
   * portion picker to this when the search-stage primaryServing was null
   * (USDA's search endpoint doesn't ship foodPortions on non-branded
   * hits). Null when every portion is a placeholder (NLEA / undetermined).
   */
  primaryPortion?: PrimaryServing | null;
} | null> {
  const base = apiBase();
  if (!base) return null;

  try {
    const res = await authedFetch(`${base}/api/usda/food?fdcId=${fdcId}`);
    const json = await res.json();
    if (!json.ok) return null;
    const portions: FoodPortion[] = Array.isArray(json.portions) ? json.portions : [];
    const primaryPortion: PrimaryServing | null = json.primaryPortion ?? null;
    const microsPer100g =
      json.microsPer100g && typeof json.microsPer100g === "object"
        ? (json.microsPer100g as Record<string, number>)
        : undefined;
    return {
      macrosPer100g: json.macrosPer100g,
      ...(microsPer100g ? { microsPer100g } : {}),
      portions,
      primaryPortion,
    };
  } catch (e) {
    if (isBenignAbort(e)) return null;
    console.error("[getFoodMacros] failed for fdcId", fdcId, ":", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Fetch the full per-100g micronutrient panel for an Edamam food via
 * `/api/edamam/food`. Mirrors `getFoodMacros` (USDA detail).
 *
 * ENG-738 (2026-05-26) — the `/api/edamam/search` hit only carries the
 * minimal panel (fiber/sugar/sodium). The full set (fat breakdown,
 * cholesterol, vitamins, minerals) lives behind Edamam's `/nutrients`
 * endpoint, keyed by `foodId`. We fetch it on select and thread it into
 * the preview so the commit path scales + persists it — exactly like
 * USDA threads its detail micros.
 *
 * Returns `{}` on ANY failure so the Edamam log path never breaks — the
 * food still logs with its macros, just without the extra micros. Web
 * mirror: `fetchEdamamMicros` in
 * `src/app/components/food-search/FoodSearchPanel.tsx`.
 */
export async function getEdamamFoodMicros(
  foodId: string,
): Promise<Record<string, number>> {
  const base = apiBase();
  if (!base || !foodId) return {};
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    const res = await authedFetch(
      `${base}/api/edamam/food?foodId=${encodeURIComponent(foodId)}`,
      { signal: ac.signal },
    );
    clearTimeout(t);
    const json = await res.json();
    if (!json.ok || !json.microsPer100g || typeof json.microsPer100g !== "object") return {};
    return json.microsPer100g as Record<string, number>;
  } catch (e) {
    if (isBenignAbort(e)) return {};
    console.error("[getEdamamFoodMicros] failed for foodId", foodId, ":", e instanceof Error ? e.message : e);
    return {};
  }
}

/**
 * Fetch the canonical per-100g macro panel + portions for a FatSecret
 * food via `/api/fatsecret/food`. Mirrors `getFoodMacros` (USDA detail).
 *
 * Returns null on failure so the on-tap handler quietly drops the row
 * instead of surfacing a broken preview. Per-serving FatSecret rows
 * carry no inline per-100g macros from the search route — this is the
 * canonical-panel resolver before opening the preview.
 */
export async function getFatSecretFood(
  foodId: string,
): Promise<{
  /**
   * Per-100g panel — null when FatSecret's `food.get` ships only a
   * "1 serving" entry with no `metric_serving_amount` (e.g. McDonald's
   * Big Mac). Caller should fall back to `macrosPerServing` in that
   * case rather than invent a per-100g denominator.
   */
  macrosPer100g: MacrosPer100g | null;
  /**
   * 2026-05-06 — populated when `macrosPer100g` is null. Lets the
   * caller commit a meal as "N × 1 serving" honestly.
   */
  macrosPerServing?: { calories: number; protein: number; carbs: number; fat: number } | null;
  /**
   * 2026-05-06 — Premier-tier per-100g panel (sat/poly/mono/trans fat,
   * cholesterol, sodium, potassium). Calcium/iron/vitamins NOT
   * included for unit ambiguity (FatSecret returns these as %DV
   * sometimes, mg sometimes). Empty / absent on Basic tier, or
   * when there's no metric grounding to scale by.
   */
  microsPer100g?: Record<string, number>;
  /**
   * 2026-05-06 — per-serving (absolute) Premier panel, used when
   * `macrosPer100g` is null. Same unit-safety filter as the per-100g
   * extractor. Caller commits `microsPerServing × quantity` directly
   * — no gram scaling.
   */
  microsPerServing?: Record<string, number>;
  portions: FoodPortion[];
  primaryPortion?: PrimaryServing | null;
} | null> {
  const base = apiBase();
  if (!base || !foodId) return null;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    const res = await authedFetch(
      `${base}/api/fatsecret/food?foodId=${encodeURIComponent(foodId)}`,
      { signal: ac.signal },
    );
    clearTimeout(t);
    const json = await res.json();
    if (!json.ok) return null;
    const portions: FoodPortion[] = Array.isArray(json.portions) ? json.portions : [];
    const primaryPortion: PrimaryServing | null = json.primaryPortion ?? null;
    const microsPer100g =
      json.microsPer100g && typeof json.microsPer100g === "object"
        ? (json.microsPer100g as Record<string, number>)
        : undefined;
    const microsPerServing =
      json.microsPerServing && typeof json.microsPerServing === "object"
        ? (json.microsPerServing as Record<string, number>)
        : undefined;
    const macrosPerServing =
      json.macrosPerServing && typeof json.macrosPerServing === "object"
        ? (json.macrosPerServing as { calories: number; protein: number; carbs: number; fat: number })
        : null;
    return {
      macrosPer100g: json.macrosPer100g ?? null,
      ...(macrosPerServing ? { macrosPerServing } : {}),
      ...(microsPer100g ? { microsPer100g } : {}),
      ...(microsPerServing ? { microsPerServing } : {}),
      portions,
      primaryPortion,
    };
  } catch (e) {
    if (isBenignAbort(e)) return null;
    console.error("[getFatSecretFood] failed for foodId", foodId, ":", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Look up a barcode via Open Food Facts (client-side). */
export async function lookupBarcode(
  code: string,
): Promise<BarcodeProduct | null> {
  const trimmed = code.replace(/\s/g, "");
  if (!/^\d{8,14}$/.test(trimmed)) return null;

  // F-138 Phase 1 (P0 schema hardening, migration
  // 20260512100000_user_foods_p0_hardening.sql) — three-tier read path:
  //   1. `verified_food_canonical` (PK lookup, single row) — authoritative
  //      verified value, computed by the recompute trigger
  //   2. Caller's OWN `user_foods` row (so users see their pending
  //      submissions / private corrections immediately)
  //   3. Open Food Facts fallback
  //
  // Pre-fix: lex-sort `verification_status` ascending put 'pending' before
  // 'verified' (alphabetical). The `find(...verified)` fallback masked the
  // bug, but the sort sometimes served a high-upvoted REJECTED row when
  // no verified row existed. Post-fix: PK hit on canonical table, then
  // explicit own-pending lookup with verification_status NEQ 'rejected'.
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data: sessionData } = await supabase.auth.getSession();
    const viewerId = sessionData.session?.user.id ?? null;
    const { data: canon } = await supabase
      .from("verified_food_canonical")
      .select(
        "name, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, saturated_fat_g, serving_size_g, consensus_method, consensus_confidence",
      )
      .eq("barcode", trimmed)
      .maybeSingle();

    if (canon) {
      return {
        name: canon.name,
        calories: Math.round(Number(canon.calories) || 0),
        protein: Math.round((Number(canon.protein) || 0) * 10) / 10,
        carbs: Math.round((Number(canon.carbs) || 0) * 10) / 10,
        fat: Math.round((Number(canon.fat) || 0) * 10) / 10,
        fiberG: Math.round((Number(canon.fiber_g) || 0) * 10) / 10,
        sugarG: canon.sugar_g != null ? Math.round(Number(canon.sugar_g) * 10) / 10 : null,
        sodiumMg: canon.sodium_mg != null ? Math.round(Number(canon.sodium_mg)) : null,
        saturatedFatG:
          canon.saturated_fat_g != null
            ? Math.round(Number(canon.saturated_fat_g) * 10) / 10
            : null,
        servingSizeG: Number(canon.serving_size_g) || 100,
        source: "verified",
        verified: true,
        verificationStatus: "verified",
        isOwnSubmission: false,
      };
    }

    // Tier 2: caller's own pending submission (RLS allows viewing own
    // rows even when status != 'verified'). Filter `rejected` so a
    // user-rejected row doesn't override OFF.
    const { data: ownRows } = await supabase
      .from("user_foods")
      .select(
        "name, calories, protein, carbs, fat, fiber_g, serving_size_g, verification_status, submitted_by",
      )
      .eq("barcode", trimmed)
      .neq("verification_status", "rejected")
      .order("updated_at", { ascending: false })
      .limit(1);

    const own = ownRows?.[0];
    if (own) {
      const status = own.verification_status as
        | "pending"
        | "verified"
        | "rejected"
        | undefined;
      const isOwn = viewerId != null && own.submitted_by === viewerId;
      const verified = status === "verified";
      return {
        name: own.name,
        calories: Math.round(Number(own.calories) || 0),
        protein: Math.round((Number(own.protein) || 0) * 10) / 10,
        carbs: Math.round((Number(own.carbs) || 0) * 10) / 10,
        fat: Math.round((Number(own.fat) || 0) * 10) / 10,
        fiberG: Math.round((Number(own.fiber_g) || 0) * 10) / 10,
        servingSizeG: Number(own.serving_size_g) || 100,
        source: "user",
        verified,
        verificationStatus: status,
        isOwnSubmission: isOwn,
      };
    }
  } catch (e) {
    // ENG-717 — don't swallow silently: report so a broken
    // verified_food_canonical / user_foods read (RLS regression, network,
    // schema drift) is visible in Sentry. Behaviour is unchanged — we
    // still fall through to the Open Food Facts fallback below.
    captureException(e);
  }

  // 2. Fall back to Open Food Facts via the authenticated proxy (ENG-1075 /
  // ENG-1145 — web parity: curated overrides + per-user rate limit + cache).
  try {
    const base = apiBase();
    if (!base) return null;
    const res = await authedFetch(
      `${base}/api/off/barcode?code=${encodeURIComponent(trimmed)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      product?: {
        name: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiberG: number;
        sugarG?: number;
        sodiumMg?: number;
        caffeineMgPer100g?: number | null;
        alcoholGPer100g?: number | null;
        microsPer100g?: Record<string, number>;
        servingSizeG?: number;
        servingOptions?: OffServingOption[];
        basisCorrected?: boolean;
        macrosPerServing?: { calories: number; protein: number; carbs: number; fat: number };
        servingNoMass?: boolean;
      };
    };
    if (!data.ok || !data.product) return null;
    const p = data.product;
    return {
      name: p.name,
      calories: Math.round(p.calories),
      protein: Math.round(p.protein * 10) / 10,
      carbs: Math.round(p.carbs * 10) / 10,
      fat: Math.round(p.fat * 10) / 10,
      fiberG: Math.round(p.fiberG * 10) / 10,
      sugarG: p.sugarG != null ? Math.round(p.sugarG * 10) / 10 : null,
      sodiumMg: p.sodiumMg != null ? Math.round(p.sodiumMg) : null,
      servingSizeG: p.servingSizeG ?? 100,
      basisCorrected: p.basisCorrected,
      caffeineMgPer100g: p.caffeineMgPer100g ?? null,
      alcoholGPer100g: p.alcoholGPer100g ?? null,
      microsPer100g: p.microsPer100g,
      servingOptions: p.servingOptions,
      source: "open_food_facts",
      verified: false,
      ...(p.macrosPerServing ? { macrosPerServing: p.macrosPerServing } : {}),
      ...(p.servingNoMass ? { servingNoMass: true } : {}),
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
}): Promise<{ ok: boolean; error?: string; reasons?: string[] }> {
  // F-138 Phase 2 — server-side plausibility gate. Catches typos and
  // unit errors before they pollute user_foods. Block-tier failures
  // surface to the form so the user can fix and re-submit; warn-tier
  // submissions still write but stay `pending`.
  const plausibility = checkSubmissionPlausibility({
    calories: opts.calories,
    protein: opts.protein,
    carbs: opts.carbs,
    fat: opts.fat,
    fiber: opts.fiberG ?? 0,
    sugar: opts.sugarG ?? 0,
    satFat: opts.saturatedFatG ?? 0,
    sodium: opts.sodiumMg ?? 0,
  });
  if (plausibility.verdict === "block") {
    return {
      ok: false,
      error: "plausibility_blocked",
      reasons: plausibility.reasons,
    };
  }

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

export function totalGramsForVerifyScale(ing: VerifiableIngredient, amountNum: number): number {
  return totalGramsForVerifyScaleImpl(ing, amountNum);
}

/**
 * P0-2 (2026-04-25): density-aware variant returning grams + a flag when
 * unit is `ml` and no density resolved. Surface the flag in UI as a
 * "needs density — switch to g/oz" hint.
 */
export function totalGramsForVerifyScaleDetailed(
  ing: VerifiableIngredient,
  amountNum: number,
): VerifyScaleResult {
  return totalGramsForVerifyScaleDetailedImpl(ing, amountNum);
}

/**
 * Scale per-100g macros to a given gram weight.
 *
 * P0 parity footgun (2026-05-26): renamed from `scaleMacros` →
 * `scaleMacrosByGrams`. The web `verifyIngredients.scaleMacros` takes a
 * FACTOR (grams/100); this one takes GRAMS. Same-named functions with
 * different arg meanings let a grams value silently flow into a factor slot
 * (or vice-versa) — the second-order cause of the 1,325-kcal-yogurt class of
 * bug. The explicit `ByGrams` suffix makes the unit un-confusable at every
 * call site. Behaviour is unchanged.
 */
export function scaleMacrosByGrams(
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG?: number; sodiumMg?: number },
  grams: number,
) {
  return scaleFromPer100gGrams(per100g, grams);
}

/** Save verified ingredients back to Supabase and update recipe totals.
 *
 * VR-01 fix (2026-04-28): the recipe-level `is_verified` flag is now
 * gated on whether EVERY ingredient is matched at or above
 * `RECIPE_INGREDIENT_REVIEW_CONFIDENCE`. Previously the flag was set
 * unconditionally to true, so a recipe whose oats matched against
 * "rolled oat sushi" with 35% confidence got a green Verified
 * TrustChip on detail. Per CLAUDE.md: "If nutrition / ingredient
 * matching is uncertain, do not guess." The recipe is only verified
 * when no row needs review.
 */
export async function saveVerifiedIngredients(
  recipeId: string,
  ingredients: VerifiableIngredient[],
  servings: number,
): Promise<{ ok: true } | { error: string }> {
  // VR-01: any ingredient unverified or below the review threshold
  // disqualifies the recipe from `is_verified=true`.
  const allRowsVerified = ingredients.every(
    (ing) => ing.isVerified && ing.confidence >= RECIPE_INGREDIENT_REVIEW_CONFIDENCE,
  );
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
        // F-74 cross-device (2026-05-08): roll up scaled caffeine +
        // alcohol so `recipes.{caffeine_mg,alcohol_g}` reflect the
        // ingredient sum / servings — the planner-tab + recipe-detail
        // "Add to today" log paths read these.
        caffeineMg: acc.caffeineMg + (i.caffeineMg ?? 0),
        alcoholG: acc.alcoholG + (i.alcoholG ?? 0),
      };
    },
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiberG: 0,
      sugarG: 0,
      sodiumMg: 0,
      caffeineMg: 0,
      alcoholG: 0,
    },
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
    caffeineMg: Math.round(totals.caffeineMg / safeServings),
    alcoholG: Math.round((totals.alcoholG / safeServings) * 10) / 10,
  };

  // T12 (2026-04-24): infer regulated allergens from ingredient names
  // at ≥0.70 match confidence. Closes DI-P0-01 on the verify path
  // (import path is wired in the same commit via the same helper).
  const inferredAllergens = inferAllergensFromIngredients(
    ingredients.map((ing) => ({
      name: ing.matchedName ?? ing.name,
      confidence: ing.confidence,
    })),
  );

  // ENG-673: atomic write via RPC — both the recipe-totals update and all
  // ingredient-row updates happen inside a single PL/pgSQL statement
  // transaction so a mid-loop failure can no longer leave the DB split.
  const ingredientUpdates = ingredients
    .filter((ing) => ing.isDirty)
    .map((ing) => {
      // GW-08 (audit 2026-04-28): only mark a row verified when its
      // confidence clears the review threshold.
      const rowIsVerified =
        typeof ing.confidence === "number" &&
        ing.confidence >= RECIPE_INGREDIENT_REVIEW_CONFIDENCE;
      return {
        id: ing.id,
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
        // F-74 cross-device (2026-05-08): persist scaled caffeine + alcohol
        // per ingredient so the recipe-level rollup re-computes correctly.
        caffeine_mg: Math.round((ing.caffeineMg ?? 0) * 10) / 10,
        alcohol_g: Math.round((ing.alcoholG ?? 0) * 10) / 10,
        is_verified: rowIsVerified,
        source: ing.source,
        confidence:
          typeof ing.confidence === "number" && Number.isFinite(ing.confidence)
            ? ing.confidence
            : null,
        override_macros: ing.overrideMacros ?? null,
        added_by_user: ing.addedByUser ?? false,
      };
    });

  const { error: rpcErr } = await supabase.rpc("save_verified_ingredients", {
    p_recipe_id: recipeId,
    p_recipe_update: {
      calories: perServing.calories,
      protein: perServing.protein,
      carbs: perServing.carbs,
      fat: perServing.fat,
      fiber_g: perServing.fiberG,
      sugar_g: perServing.sugarG,
      sodium_mg: perServing.sodiumMg,
      caffeine_mg: perServing.caffeineMg,
      alcohol_g: perServing.alcoholG,
      allergens: inferredAllergens,
    },
    p_ingredient_updates: ingredientUpdates,
  });

  if (rpcErr) return { error: rpcErr.message };
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
    /** F-74 cross-device (2026-05-08) — optional. Defaults to 0 when omitted. */
    caffeineMg?: number;
    alcoholG?: number;
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
    // F-74 cross-device (2026-05-08): forward caffeine + alcohol when
    // the caller has them. Defaults to 0 (matches the column default)
    // for adders that don't carry the per-100g basis (e.g. manual
    // typed entries).
    caffeine_mg: Math.round((payload.caffeineMg ?? 0) * 10) / 10,
    alcohol_g: Math.round((payload.alcoholG ?? 0) * 10) / 10,
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
