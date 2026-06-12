"use client";

/**
 * FoodSearchPanel (web) — shared, input-less food-search results +
 * preview region.
 *
 * Why this exists (2026-04-30 — web parity follow-up to mobile commit
 * `1968953`)
 * --------------------------------------------------------------
 * The previous web shape was: `<LogSheet>` rendered a `Pressable` styled
 * like a search input. Tapping it CLOSED the LogSheet and OPENED the
 * separate `<FoodSearch>` dialog whose first job was rendering an
 * `<Input type="text" />`. Two modals stacked, one extra animation, and
 * the user couldn't start typing immediately on sheet-open. Cal AI's
 * quick-add (the most direct competitor) is a real text input you type
 * into immediately — Suppr's nested-modal pattern was a learning step
 * no competitor required.
 *
 * Mobile shipped the lift in commit `1968953`. This is the web mirror.
 *
 * The fix is to lift the entire search-results + preview body out of
 * `<FoodSearch>` and into this presentational component. The caller —
 * either `<FoodSearch>` (dialog) or `<LogSheet>` (inline) — owns:
 *   - the modal / sheet chrome
 *   - the `<Input>` itself (lives in caller layout where it belongs
 *     visually)
 *   - the `query` state + onQueryChange handler
 *
 * The panel owns:
 *   - the debounced multi-source search (USDA + OFF + Edamam + custom)
 *   - the result list + infinite-scroll pagination + USDA backfill
 *   - the preview card (portion picker, fit-this-in, nutrition lines)
 *   - the create / edit / delete custom-food sub-flows
 *
 * `<FoodSearch>` becomes a thin wrapper: Dialog shell + Input + close
 * button + `<FoodSearchPanel mode="full" />`.
 * `<LogSheet>` mounts `<FoodSearchPanel mode="compact" />` inline once
 * the user starts typing, so search results render below the input
 * within the same sheet — no nested modal, no animation cost.
 *
 * Mode
 * ----
 * `"full"`     — current FoodSearch dialog density (px-6 paddings,
 *                full-size separators).
 * `"compact"`  — tighter rows for LogSheet's smaller vertical budget
 *                (px-3 paddings, tighter row spacing).
 *
 * Mobile mirror: `apps/mobile/components/food-search/FoodSearchPanel.tsx`.
 * Prop names + signatures kept identical for sync-enforcer cross-check.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Barcode, Loader2 } from "lucide-react";
import { Icons } from "../ui/icons";
import { Badge } from "../suppr/badge";
import {
  CreateCustomFoodDialog,
  type CreateCustomFoodPayload,
} from "../suppr/create-custom-food-dialog";
import { DestructiveConfirmDialog } from "../suppr/destructive-confirm-dialog";

import { effectiveFoodSearchQuery } from "@/lib/nutrition/foodSearchQuery";
import { matchGenericBeverage } from "@/lib/nutrition/genericBeverages";
import { matchGenericFood } from "@/lib/nutrition/genericFoods";
import { genericFoodMicrosPer100g } from "@/lib/nutrition/genericFoodMicros";
import { isPlausibleMacrosPer100g } from "@/lib/nutrition/macroPlausibility";
import {
  isBareGenericNounRow,
  isLowRelevanceNonVerifiedRow,
  isLowConfidenceDemotedRow,
} from "@/lib/nutrition/searchRowTrust";
import {
  projectRemaining,
  type MacroConsumed,
  type MacroTargets,
} from "@/lib/nutrition/remainingMacros";
import {
  createCustomFood,
  deleteCustomFood,
  listCustomFoods,
  searchCustomFoods,
  updateCustomFood,
} from "../../../lib/nutrition/customFoodsClient";
import {
  buildCustomFoodPortions,
  customFoodToMacrosPer100g,
  type CustomFood,
} from "../../../lib/nutrition/customFoods";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import {
  pickEdamamPrimaryServing,
  pickUsdaBrandedPrimaryServing,
  pickUsdaFoodPortionsPrimaryServing,
  parseOffPrimaryServing,
  type PrimaryServing,
} from "../../../lib/nutrition/primaryServing";
import { inferNaturalServingFromName } from "../../../lib/nutrition/inferNaturalServing";
import {
  resolveFoodSearchHeadline,
  FOOD_SEARCH_PER_SERVING_BADGE,
  FOOD_SEARCH_PER_100G_BADGE,
} from "../../../lib/nutrition/foodSearchHeadline";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import { track } from "../../../lib/analytics/track";
import { fetchFatSecretAutocomplete } from "@/lib/nutrition/fatsecretAutocompleteClient";
import { shouldShowBarcodeFallbackHint } from "@/lib/nutrition/foodSearchLocale";
import { portionEqualsLabel } from "@/lib/nutrition/portionEqualsLabel";
import {
  defaultEatenAtForNewLog,
  eatenAtFromLogDateAndTime,
  localTimeInputValueFromIso,
} from "@/lib/nutrition/mealEatenAt";
import { resolveInitialPortion, buildPortions, customFoodToHit, isPerServingPortion } from "@/lib/nutrition/foodSearchCore";
import { foodSearchPreviewExtraMicroRows } from "@/lib/nutrition/foodSearchPreviewNutrition";
import {
  foodSearchTrustWeight,
  foodSearchRankScore,
  searchRelevance,
  searchMatchScore,
  searchRowConfidenceTier,
  splitBestMatches,
  type SearchRowConfidenceTier,
  type SectionedSearchRows,
} from "@/lib/nutrition/foodSearchRanking";
import { foodSearchPreviewPlausibilityWarning } from "@/lib/nutrition/portionPicker";
import {
  matchHistoryFoods,
  historyMatchNameSet,
  dedupeDbAgainstHistory,
  normalizeHistoryName,
  type HistorySearchMatch,
} from "@/lib/nutrition/foodHistorySearch";
import {
  matchFavoriteFoods,
  favoriteFoodKeySet,
  isFavoriteRow,
  type FavoriteSearchItem,
  type FavoriteSearchMatch,
} from "@/lib/nutrition/favoriteFoodsSearch";
import { favoriteKey } from "@/lib/nutrition/favoriteFoods";
import { Star } from "lucide-react";
import { formatMacroTrailer } from "@/lib/nutrition/macroFormat";

// ── Types ────────────────────────────────────────────────────────────

export type MacrosPer100g = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  /** F-13 auto-track. Optional; null when the source doesn't expose the value. */
  caffeineMgPer100g?: number | null;
  alcoholGPer100g?: number | null;
};

// 2026-05-15: `servingFraction` lets us derive a "1 piece" portion
// from a "8 pieces" primary serving — fraction = 1/8, scales the
// per-serving macros accordingly. Default 1 (full serving). See
// `apps/mobile/lib/verifyRecipe.ts` for the canonical doc.
export type FoodPortion = {
  label: string;
  gramWeight: number;
  amount: number;
  servingFraction?: number;
};

type SearchResult = {
  key: string;
  name: string;
  /** Restaurant / brand byline shown beneath the title — set for Edamam restaurant + branded hits. */
  subtitle?: string;
  calsPer100g?: number;
  macrosPer100g?: MacrosPer100g;
  /** F-79 (2026-04-25) — full per-100g micronutrient set. */
  microsPer100g?: Record<string, number>;
  verified?: boolean;
  /**
   * ENG-807 — honest confidence tier derived from BOTH provenance AND the
   * computed match score (never source alone). Mirrors the mobile
   * `UnifiedSearchResult.confidenceTier`. The UI renders the legible
   * Verified / Estimated chip from this (next stage's lane). Stamped in
   * `mergeAndDedup`.
   */
  confidenceTier?: SearchRowConfidenceTier;
  imageUrl?: string | null;
  primaryServing?: PrimaryServing | null;
  _source: "USDA" | "OFF" | "CUSTOM" | "Edamam" | "FatSecret" | "GenericBeverage" | "GenericFood";
  _fdcId?: number;
  _offCode?: string;
  _edamamFoodId?: string;
  /** FatSecret food id — string. Used for the on-tap `food.get` detail fetch. */
  _fatSecretFoodId?: string;
  _custom?: CustomFood;
};

export type FoodSearchSelection = {
  name: string;
  /**
   * "history" (ENG-1033) discriminates a re-logged "Past logged" item — the
   * macros are the user's own prior per-serving totals, so the commit path
   * labels it neutrally ("Manual"), never misattributing to a database
   * source.
   */
  source: "USDA" | "OFF" | "CUSTOM" | "Edamam" | "FatSecret" | "history";
  /**
   * 2026-05-06 audit (D1): nullable for per-serving-only FatSecret
   * foods (no metric grounding). When null, `macrosPerServing`
   * carries the values and `chosenPortion.gramWeight` will be 0
   * (sentinel). The commit site treats this as "log N × 1 serving".
   */
  macrosPer100g: MacrosPer100g | null;
  macrosPerServing?: { calories: number; protein: number; carbs: number; fat: number } | null;
  microsPer100g?: Record<string, number>;
  microsPerServing?: Record<string, number>;
  portions: FoodPortion[];
  chosenPortion: FoodPortion;
  quantity: number;
  customFoodId?: string;
  servingLabel?: string;
  imageUrl?: string | null;
  /** ENG-772 — consumption instant from preview time picker. */
  eatenAt?: string;
};

/**
 * Supabase client shape. Kept loose so tests can pass a mock and so we
 * don't couple this file to the web-specific `browserClient`. When omitted,
 * the custom-food entry point is hidden and the panel behaves exactly as
 * before.
 */
export type SupabaseLike = { from: (table: string) => unknown };

export type FoodSearchPanelProps = {
  /** Current query string. Caller owns the input + state. */
  query: string;
  /** Original recipe amount — only meaningful in verify-ingredient hosts. */
  initialAmount?: number | string | null;
  initialUnit?: string | null;
  /** Original ingredient description shown as context in the preview. */
  originalDescription?: string | null;
  /** Daily budget context for fit-this-in projection. */
  macroTargets?: MacroTargets;
  macroConsumed?: MacroConsumed;
  /** Custom-foods wiring. When supabase + userId both provided, the
   *  panel surfaces the user's custom-food library, the create-custom-food
   *  CTA, and edit / delete affordances on custom rows. */
  supabase?: SupabaseLike;
  userId?: string | null;
  /** Fired when the user confirms a portion / quantity. The panel
   *  clears its own preview after firing — caller is responsible for
   *  closing any wrapping host (dialog / sheet) if that's the desired
   *  UX. */
  onSelect: (selection: FoodSearchSelection) => void;
  /** ENG-772 — journal day (`YYYY-MM-DD`) for preview time when `editable_eaten_at` is on. */
  logDateKey?: string;
  /**
   * `"full"`     — current FoodSearch dialog density.
   * `"compact"`  — tighter rows for LogSheet's smaller vertical budget.
   * Same data, same accessibility, same handlers — visual density only.
   */
  mode?: "full" | "compact";
  /**
   * Locale-aware empty-state hint (2026-04-26 — FatSecret Premier Free).
   * Premier Free is a US-only dataset; UK / EU / AU users searching
   * for a regional brand will hit the "No results" path. When this
   * callback is supplied AND the user's locale is non-US, the empty
   * state surfaces a "Brand not found? Try a barcode scan" CTA that
   * fires this handler. Caller is responsible for opening the
   * BarcodeScannerModal.
   *
   * If the host is already in barcode-scan mode (e.g. the LogSheet's
   * scan-tab is active), pass `inBarcodeMode={true}` to suppress the
   * hint and avoid the loop.
   */
  onScanBarcodePressed?: () => void;
  /** Suppresses the barcode-fallback hint when the host is already in barcode mode. */
  inBarcodeMode?: boolean;
  /**
   * Override for the resolved BCP-47 locale string. Defaults to
   * `Intl.DateTimeFormat().resolvedOptions().locale`. Tests override
   * this directly; production callers should leave it undefined.
   */
  localeOverride?: string;
  /**
   * History-first search (ENG-1033, MFP grammar) — the user's logging
   * history, newest-first (from `computeRecentMeals`). When a query is
   * typed, matching past-logged foods surface FIRST as a visually-distinct
   * "Past logged" group above the database results, de-duped (history wins).
   * Mobile parity: `apps/mobile/components/food-search/FoodSearchPanel.tsx`.
   * Hosts without a foodHistory available can omit; the group simply doesn't
   * render.
   */
  recentFoods?: Array<{
    recipeTitle: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    source?: string;
    /** Total log count — recency-weighted-frequency tiebreak. */
    count?: number;
    imageUrl?: string | null;
  }>;
  /**
   * Favourites-in-search (teardown #1, ENG-1041) — the user's
   * `user_favorite_foods` rows. Surfaces a "Favourites" group above "Past
   * logged" when the typed query matches a favourite and drives the per-row
   * star state. When omitted, no favourites surface. Mobile parity.
   */
  favoriteFoods?: FavoriteSearchItem[];
  /** Star/unstar handler — host owns the optimistic write + revert. */
  onToggleFavorite?: (food: {
    recipeTitle: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    source?: string;
    favoriteId?: string;
  }) => void;
  /** Keys of favourite toggles in flight (disabled + dimmed star). */
  favoritePendingKeys?: Set<string>;
};

// ── Helpers (carried over verbatim from FoodSearch.tsx) ─────────────

function titleCase(s: string): string {
  const upper = s.replace(/[^A-Z]/g, "").length;
  const lower = s.replace(/[^a-z]/g, "").length;
  if (upper > lower * 2 || (lower > 0 && upper === 0 && s === s.toLowerCase())) {
    return s.toLowerCase().replace(/(?:^|\s|[-/])\w/g, (c) => c.toUpperCase());
  }
  return s;
}


// ── Search API calls (carried over verbatim from FoodSearch.tsx) ────

function scaleMacros(per100g: MacrosPer100g, grams: number): MacrosPer100g {
  const f = grams / 100;
  return {
    calories: Math.round(per100g.calories * f),
    protein: Math.round(per100g.protein * f * 10) / 10,
    carbs: Math.round(per100g.carbs * f * 10) / 10,
    fat: Math.round(per100g.fat * f * 10) / 10,
    fiberG: Math.round(per100g.fiberG * f * 10) / 10,
    sugarG: Math.round(per100g.sugarG * f * 10) / 10,
    sodiumMg: Math.round(per100g.sodiumMg * f),
  };
}

// ── Search API calls (carried over verbatim from FoodSearch.tsx) ────

/**
 * ENG-1038 — resolved locale appended to vendor-search URLs so the server
 * cache partitions hits by region (parity with mobile `verifyRecipe.ts`).
 */
function localeQueryParam(): string {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale;
    return loc ? `&locale=${encodeURIComponent(loc)}` : "";
  } catch {
    return "";
  }
}

/**
 * ENG-1038 — a vendor route returns `degraded: true` when its account-wide
 * quota is exhausted and it was SKIPPED. The search clients propagate this
 * so the UI shows an honest "showing saved results" notice, not a silent
 * blank (parity with mobile).
 */
function responseIsDegraded(json: unknown): boolean {
  return Boolean(json && typeof json === "object" && (json as { degraded?: unknown }).degraded === true);
}

async function searchUsda(
  query: string,
  page: number = 1,
  onDegraded?: () => void,
): Promise<SearchResult[]> {
  const q = effectiveFoodSearchQuery(query);
  if (!q.trim()) return [];
  try {
    // 13s client timeout > the server's 12s vendor AbortSignal, so the server
    // resolves (with its own degraded/empty envelope) before we abort. On the
    // rare client-side abort the catch below returns the same empty result.
    const res = await fetch(`/api/usda/search?q=${encodeURIComponent(q.trim())}&page=${page}${localeQueryParam()}`, {
      signal: AbortSignal.timeout(13_000),
    });
    const json = await res.json();
    if (responseIsDegraded(json)) onDegraded?.();
    if (!json.ok || !Array.isArray(json.hits)) return [];
    return json.hits.map((h: any) => {
      const per100g = {
        calories: h.calories ?? 0,
        protein: h.protein ?? 0,
        carbs: h.carbs ?? 0,
        fat: h.fat ?? 0,
      };
      const isVerified = /foundation|sr legacy|survey/i.test(h.dataType ?? "");
      const primaryServing =
        pickUsdaBrandedPrimaryServing(per100g, {
          servingSize: typeof h.servingSize === "number" ? h.servingSize : null,
          servingSizeUnit: typeof h.servingSizeUnit === "string" ? h.servingSizeUnit : null,
          householdServingFullText:
            typeof h.householdServingFullText === "string" ? h.householdServingFullText : null,
        }) ??
        pickUsdaFoodPortionsPrimaryServing(
          per100g,
          Array.isArray(h.foodPortions) ? h.foodPortions : null,
        ) ??
        inferNaturalServingFromName(h.description ?? "", per100g, isVerified);
      return {
        key: `usda-${h.fdcId}`,
        name: titleCase(h.description ?? "Unknown"),
        calsPer100g: h.calories,
        macrosPer100g: h.calories != null ? { calories: h.calories, protein: h.protein ?? 0, carbs: h.carbs ?? 0, fat: h.fat ?? 0, fiberG: 0, sugarG: 0, sodiumMg: 0 } : undefined,
        verified: isVerified,
        primaryServing,
        _source: "USDA" as const,
        _fdcId: h.fdcId,
      };
    });
  } catch { return []; }
}

async function searchOff(
  query: string,
  page: number = 1,
  onDegraded?: () => void,
): Promise<SearchResult[]> {
  const q = effectiveFoodSearchQuery(query);
  if (!q.trim()) return [];
  try {
    // 13s client timeout > the server's 12s vendor AbortSignal (see searchUsda).
    const res = await fetch(
      `/api/off/search?q=${encodeURIComponent(q.trim())}&page=${page}${localeQueryParam()}`,
      { signal: AbortSignal.timeout(13_000) },
    );
    const json = await res.json();
    if (responseIsDegraded(json)) onDegraded?.();
    if (!json.ok || !Array.isArray(json.hits)) return [];
    return json.hits
      .map((h: {
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
        microsPer100g?: Record<string, number>;
        servingSize?: string | null;
      }) => {
        const brand = titleCase(h.brand ?? "");
        const name = titleCase(h.name ?? "Unknown");
        const displayName = [brand, name].filter(Boolean).join(" · ");
        const cals = h.calories;
        const macros =
          cals > 0
            ? {
                calories: cals,
                protein: h.protein,
                carbs: h.carbs,
                fat: h.fat,
                fiberG: h.fiberG,
                sugarG: h.sugarG,
                sodiumMg: h.sodiumMg,
              }
            : undefined;
        const primaryServing = macros
          ? parseOffPrimaryServing(
              {
                calories: macros.calories,
                protein: macros.protein,
                carbs: macros.carbs,
                fat: macros.fat,
              },
              h.servingSize ?? null,
            )
          : null;
        return {
          key: `off-${h.code}`,
          name: displayName,
          calsPer100g: cals,
          macrosPer100g: macros,
          microsPer100g: h.microsPer100g,
          primaryServing,
          _source: "OFF" as const,
          _offCode: h.code,
        };
      })
      .filter((r: SearchResult) => {
        if (!r.calsPer100g || r.calsPer100g <= 0) return false;
        if (!r.macrosPer100g) return false;
        return isPlausibleMacrosPer100g({
          calories: r.macrosPer100g.calories,
          protein: r.macrosPer100g.protein,
          carbs: r.macrosPer100g.carbs,
          fat: r.macrosPer100g.fat,
        });
      });
  } catch {
    return [];
  }
}

async function searchEdamam(
  query: string,
  page: number = 1,
  onDegraded?: () => void,
): Promise<SearchResult[]> {
  const q = effectiveFoodSearchQuery(query);
  if (!q.trim()) return [];
  try {
    // 13s client timeout > the server's 12s vendor AbortSignal (see searchUsda).
    const res = await fetch(`/api/edamam/search?q=${encodeURIComponent(q.trim())}&page=${page}${localeQueryParam()}`, {
      signal: AbortSignal.timeout(13_000),
    });
    const json = await res.json();
    if (responseIsDegraded(json)) onDegraded?.();
    if (!json.ok || !Array.isArray(json.hits)) return [];
    return (json.hits as Array<{
      foodId: string; label: string; brand: string | null;
      category: string; categoryLabel: string; imageUrl: string | null;
      calories: number; protein: number; carbs: number; fat: number;
      fiberG: number; sugarG: number; sodiumMg: number;
      microsPer100g?: Record<string, number>;
      servingSizes?: Array<{ uri?: string; label?: string; quantity?: number }>;
    }>).map((h) => {
      const brand = h.brand ? titleCase(h.brand) : "";
      const label = titleCase(h.label);
      const displayName = brand ? `${brand} · ${label}` : label;
      const isMeal =
        h.category?.toLowerCase().includes("meal") ||
        Boolean(h.brand && h.category?.toLowerCase().includes("packaged"));
      const primaryServing = pickEdamamPrimaryServing(
        { calories: h.calories, protein: h.protein, carbs: h.carbs, fat: h.fat },
        h.servingSizes ?? null,
      );
      return {
        key: `edamam-${h.foodId}`,
        name: displayName,
        subtitle: isMeal ? (brand ? `Restaurant · ${brand}` : "Restaurant meal") : undefined,
        calsPer100g: h.calories,
        macrosPer100g: {
          calories: h.calories,
          protein: h.protein,
          carbs: h.carbs,
          fat: h.fat,
          fiberG: h.fiberG,
          sugarG: h.sugarG,
          sodiumMg: h.sodiumMg,
        },
        // ENG-738 (2026-05-26) — carry the route's minimal micros panel
        // (fiber/sugar/sodium) through to the row, matching mobile
        // (`verifyRecipe.ts` Edamam mapping). Pre-ENG-738 web dropped it
        // entirely, so web Edamam logs persisted NO micros while mobile
        // kept three. The select path merges the `/nutrients` superset
        // OVER this on tap. Conditional spread keeps the key absent (not
        // null) when the route shipped no micros.
        ...(h.microsPer100g ? { microsPer100g: h.microsPer100g } : {}),
        imageUrl: h.imageUrl,
        primaryServing,
        _source: "Edamam" as const,
        _edamamFoodId: h.foodId,
      };
    });
  } catch {
    return [];
  }
}

/**
 * FatSecret search (4th source in the merge alongside USDA / OFF /
 * Edamam). Wired 2026-04-30 — Premier Free creds were valid in
 * production but no `/api/fatsecret/search` route existed, so the merge
 * pipeline never carried FatSecret hits. See
 * `app/api/fatsecret/search/route.ts` for the route shape.
 *
 * Resolves to an empty list on any failure so the merge keeps the other
 * three sources rendering. Per-100g macros land directly when FatSecret
 * shipped a "Per 100g" envelope; per-serving rows surface with no
 * inline macros so the on-tap `food.get` path can fetch the canonical
 * panel. We never invent macros.
 */
async function searchFatSecret(
  query: string,
  page: number = 1,
  onDegraded?: () => void,
): Promise<SearchResult[]> {
  const q = effectiveFoodSearchQuery(query);
  if (!q.trim()) return [];
  try {
    // 13s client timeout > the server's 12s vendor AbortSignal (see searchUsda).
    const res = await fetch(`/api/fatsecret/search?q=${encodeURIComponent(q.trim())}&page=${page}${localeQueryParam()}`, {
      signal: AbortSignal.timeout(13_000),
    });
    const json = await res.json();
    if (responseIsDegraded(json)) onDegraded?.();
    if (!json.ok || !Array.isArray(json.hits)) return [];
    return (json.hits as Array<{
      foodId: string;
      label: string;
      brand: string | null;
      macrosPer100g: { calories: number; protein: number; carbs: number; fat: number } | null;
      servingLabel: string | null;
      servingGrams: number | null;
      macrosPerServing: { calories: number; protein: number; carbs: number; fat: number } | null;
    }>).map((h) => {
      const name = titleCase(h.label ?? "Unknown");
      const macrosPer100g = h.macrosPer100g
        ? {
            calories: h.macrosPer100g.calories,
            protein: h.macrosPer100g.protein,
            carbs: h.macrosPer100g.carbs,
            fat: h.macrosPer100g.fat,
            fiberG: 0,
            sugarG: 0,
            sodiumMg: 0,
          }
        : undefined;
      // Synthesise a primary serving when FatSecret described the row
      // per a named portion AND embedded a gram weight (e.g. "1 sandwich
      // (240g)"). Without the gram weight we can't scale, so we leave
      // the row with a per-100g headline placeholder and let the on-tap
      // `food.get` fetch land the real serving panel.
      const primaryServing: PrimaryServing | null =
        h.macrosPerServing && h.servingLabel && h.servingGrams && h.servingGrams > 0
          ? {
              label: h.servingLabel,
              grams: h.servingGrams,
              kcal: h.macrosPerServing.calories,
              protein: h.macrosPerServing.protein,
              carbs: h.macrosPerServing.carbs,
              fat: h.macrosPerServing.fat,
            }
          : null;
      return {
        key: `fatsecret-${h.foodId}`,
        name,
        calsPer100g: macrosPer100g?.calories,
        macrosPer100g,
        primaryServing,
        _source: "FatSecret" as const,
        _fatSecretFoodId: h.foodId,
      };
    });
  } catch {
    return [];
  }
}

async function fetchUsdaDetail(
  fdcId: number,
): Promise<{
  macrosPer100g: MacrosPer100g;
  // 2026-05-26 fix: the /api/usda/food route returns the full micro panel
  // (fdcFoodMicrosPer100g, added 2026-05-06), but this client detail-fetch
  // was never updated to read it — so USDA foods logged macros only while
  // OFF / FatSecret carried micros. Thread it through like the others.
  microsPer100g?: Record<string, number>;
  portions: FoodPortion[];
  primaryPortion?: PrimaryServing | null;
} | null> {
  try {
    const res = await fetch(`/api/usda/food?fdcId=${fdcId}`);
    const json = await res.json();
    if (!json.ok) return null;
    return {
      macrosPer100g: json.macrosPer100g,
      ...(json.microsPer100g ? { microsPer100g: json.microsPer100g } : {}),
      portions: Array.isArray(json.portions) ? json.portions : [],
      primaryPortion: json.primaryPortion ?? null,
    };
  } catch { return null; }
}

/**
 * Fetch the full per-100g micronutrient panel for an Edamam food.
 *
 * ENG-738 (2026-05-26) — the `/api/edamam/search` hit only carries the
 * minimal panel (fiber/sugar/sodium). The full set (fat breakdown,
 * cholesterol, vitamins, minerals) lives behind Edamam's `/nutrients`
 * endpoint, keyed by `foodId`. We fetch it on select and thread it into
 * the preview so the commit path scales + persists it — exactly like the
 * USDA branch threads `fetchUsdaDetail.microsPer100g`.
 *
 * Returns `{}` on any failure so the Edamam log path never breaks — the
 * food still logs with its macros, just without the extra micros. Mobile
 * mirror: `getEdamamFoodMicros` in `apps/mobile/lib/verifyRecipe.ts`.
 */
async function fetchEdamamMicros(foodId: string): Promise<Record<string, number>> {
  try {
    const res = await fetch(`/api/edamam/food?foodId=${encodeURIComponent(foodId)}`);
    const json = await res.json();
    if (!json.ok || !json.microsPer100g || typeof json.microsPer100g !== "object") return {};
    return json.microsPer100g as Record<string, number>;
  } catch {
    return {};
  }
}

/**
 * Fetch the canonical per-100g macro panel + portions for a FatSecret
 * food. Mirrors `fetchUsdaDetail`. Returns null on failure so the
 * on-tap handler quietly drops the row instead of surfacing a broken
 * preview.
 */
async function fetchFatSecretDetail(
  foodId: string,
): Promise<{
  /**
   * 2026-05-06 audit (D1): nullable. FatSecret's `food.get` for some
   * branded items (e.g. McDonald's Big Mac) returns "1 serving" with
   * no `metric_serving_amount`. The route now returns `macrosPer100g:
   * null` + `macrosPerServing` for that case. Mirrors mobile
   * `getFatSecretFood` shape.
   */
  macrosPer100g: MacrosPer100g | null;
  macrosPerServing?: { calories: number; protein: number; carbs: number; fat: number } | null;
  microsPer100g?: Record<string, number>;
  microsPerServing?: Record<string, number>;
  portions: FoodPortion[];
  primaryPortion?: PrimaryServing | null;
} | null> {
  try {
    const res = await fetch(`/api/fatsecret/food?foodId=${encodeURIComponent(foodId)}`);
    const json = await res.json();
    if (!json.ok) return null;
    return {
      macrosPer100g: json.macrosPer100g ?? null,
      ...(json.macrosPerServing ? { macrosPerServing: json.macrosPerServing } : {}),
      ...(json.microsPer100g ? { microsPer100g: json.microsPer100g } : {}),
      ...(json.microsPerServing ? { microsPerServing: json.microsPerServing } : {}),
      portions: Array.isArray(json.portions) ? json.portions : [],
      primaryPortion: json.primaryPortion ?? null,
    };
  } catch { return null; }
}

// 2026-05-15 (ENG-550): inline `resolveInitialPortion` extracted to
// `@/lib/nutrition/foodSearchCore` so web + mobile share one source of
// truth. The previous web-side function (with its `UNIT_TO_LABEL` and
// `UNIT_GRAMS` tables) was byte-identical to the mobile version apart
// from formatting.

// 2026-05-16 (ENG-550 phase 3): `customFoodToSearchResult` moved to
// `@/lib/nutrition/foodSearchCore` as `customFoodToHit`. The web's
// `SearchResult` accepts the returned `CustomFoodHit` structurally;
// the alias below preserves the call-site for readability.
const customFoodToSearchResult = customFoodToHit;

/**
 * ENG-807 — split a ranked, merged search-result list into the prototype's
 * "Best matches" / "More results" sections by the shared score threshold.
 *
 * Pure + shared with mobile (both call `splitBestMatches` from
 * `foodSearchRanking.ts`) so the two surfaces section identically. Rows carry
 * `_rel` (the combined trust-weighted rank score) at runtime when they came
 * through `mergeAndDedup`; rows without it (defensive) recompute from the
 * shared scorer so the split stays honest rather than defaulting into Best.
 * The UI consumes this — the JSX is the next stage's lane.
 */
export function splitFoodSearchResults(
  query: string,
  rows: SearchResult[],
): SectionedSearchRows<SearchResult> {
  return splitBestMatches(rows, (r) => {
    const rel = (r as SearchResult & { _rel?: number })._rel;
    if (typeof rel === "number") return rel;
    return foodSearchRankScore({
      query,
      name: r.name,
      source: r._source,
      verified: Boolean(r.verified),
    });
  });
}

/**
 * ENG-815 (redesign_search_results) — human-readable provenance label shown on
 * the redesigned result row's "per 100g · <source>" byline. Mirrors the
 * mobile sibling lane's label map so both surfaces name the same source the
 * same way. Custom rows carry their own "Custom" badge, so they fall through
 * to "Custom".
 */
function foodSearchSourceLabel(source: SearchResult["_source"]): string {
  switch (source) {
    case "USDA":
      return "USDA";
    case "OFF":
      return "Open Food Facts";
    case "Edamam":
      return "Edamam";
    case "FatSecret":
      return "FatSecret";
    case "CUSTOM":
      return "Custom";
    case "GenericBeverage":
    case "GenericFood":
      return "Suppr";
  }
}

function buildGenericMatchRow(query: string): SearchResult | null {
  const q = query.trim();
  if (!q) return null;
  const beverage = matchGenericBeverage(q);
  if (beverage) {
    const servingG = beverage.servingMl;
    return {
      key: `generic-beverage:${beverage.id}`,
      name: beverage.name,
      subtitle: beverage.subtitle,
      _source: "GenericBeverage",
      verified: true,
      macrosPer100g: {
        calories: beverage.per100ml.calories,
        protein: beverage.per100ml.protein,
        carbs: beverage.per100ml.carbs,
        fat: beverage.per100ml.fat,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0,
        caffeineMgPer100g: beverage.caffeineMgPer100ml,
        alcoholGPer100g: beverage.alcoholGPer100ml ?? 0,
      },
      calsPer100g: beverage.per100ml.calories,
      primaryServing: {
        label: `${beverage.servingMl} ml`,
        grams: servingG,
        kcal: Math.round((beverage.per100ml.calories * servingG) / 100),
        protein: Math.round((beverage.per100ml.protein * servingG) / 100 * 10) / 10,
        carbs: Math.round((beverage.per100ml.carbs * servingG) / 100 * 10) / 10,
        fat: Math.round((beverage.per100ml.fat * servingG) / 100 * 10) / 10,
      },
    };
  }
  const food = matchGenericFood(q);
  if (food) {
    // ENG-738 — attach the baked per-100g USDA micronutrient panel for
    // this generic food so the meal-detail "Vitamins, minerals & more"
    // card populates after it's logged. Mirrors the OFF row, which also
    // carries `microsPer100g` at construction. `undefined` for an unbaked
    // id (the conditional spread keeps the key absent rather than null).
    const genericMicros = genericFoodMicrosPer100g(food.id);
    return {
      key: `generic-food:${food.id}`,
      name: food.name,
      subtitle: food.subtitle,
      _source: "GenericFood",
      verified: true,
      macrosPer100g: {
        calories: food.per100g.calories,
        protein: food.per100g.protein,
        carbs: food.per100g.carbs,
        fat: food.per100g.fat,
        fiberG: food.per100g.fiberG,
        sugarG: food.per100g.sugarG,
        sodiumMg: food.per100g.sodiumMg,
        caffeineMgPer100g: 0,
        alcoholGPer100g: 0,
      },
      ...(genericMicros ? { microsPer100g: genericMicros } : {}),
      calsPer100g: food.per100g.calories,
      primaryServing: {
        label: food.servingLabel,
        grams: food.servingG,
        kcal: Math.round((food.per100g.calories * food.servingG) / 100),
        protein: Math.round((food.per100g.protein * food.servingG) / 100 * 10) / 10,
        carbs: Math.round((food.per100g.carbs * food.servingG) / 100 * 10) / 10,
        fat: Math.round((food.per100g.fat * food.servingG) / 100 * 10) / 10,
      },
    };
  }
  return null;
}

// 2026-05-15 (ENG-550 phase 2): inline `buildPortions` and
// `STANDARD_UNITS` both extracted to `@/lib/nutrition/foodSearchCore`.
// Same logic, same dedup order — see foodSearchCore.test.ts for the
// behaviour pin.

// ── Component ────────────────────────────────────────────────────────

export function FoodSearchPanel({
  query,
  initialAmount,
  initialUnit,
  originalDescription,
  macroTargets,
  macroConsumed,
  supabase,
  userId,
  onSelect,
  logDateKey,
  mode = "full",
  onScanBarcodePressed,
  inBarcodeMode = false,
  localeOverride,
  recentFoods,
  favoriteFoods,
  onToggleFavorite,
  favoritePendingKeys,
}: FoodSearchPanelProps) {
  // 2026-05-31 design-direction (LANE: commit-colour CTAs): blue is the
  // single commit-action colour. The "Use this" log commit CTA below used
  // `bg-success` (green) as a button fill — green is now reserved strictly
  // for the calorie-ring state + macro identity, never a commit button.
  // Gate behind `design_system_colours`:
  //   flag ON  → blue commit CTA (`bg-primary`)
  //   flag OFF → existing green (old path stays alive in the ternary else).
  const commitCtaClass = isFeatureEnabled("design_system_colours")
    ? "bg-primary text-primary-foreground hover:bg-primary/90"
    : "bg-success text-white hover:bg-success/90";
  // ENG-815 (LANE: search-results UI). Gate the redesigned results body —
  // one segmented control, elevated grouped result cards, a legible
  // Verified / Estimated confidence chip, Best/More split — behind
  // `redesign_search_results`. flag OFF keeps the legacy flat hairline list
  // alive in the `else` (the old `divide-y` block below). Pixel + behaviour
  // parity with the mobile sibling lane (same flag, same prototype).
  const searchResultsRedesign = isFeatureEnabled("redesign_search_results");
  // ENG P5 parity (gap #5/#9). Two-flag relationship on this surface:
  //   `redesign_search_results` = STRUCTURE (segmented control + grouped cards)
  //   `design_system_elevation` = DEPTH (the soft `--elev-card-soft` shadow)
  // Mobile routes the identical surface through `useCardElevation()`, which
  // reads `design_system_elevation` and falls back to a flat hairline border
  // when off. Web previously painted the soft shadow UNCONDITIONALLY inside the
  // structural block — so if elevation is held off while the structural flag
  // ramps, web showed soft shadows mobile suppresses. Gate the depth here too,
  // mirroring the other web consumers (Settings.tsx:652, RecipeDetail.tsx:322):
  //   flag ON  → `--elev-card-soft` shadow, border dropped (no double edge).
  //   flag OFF → flat hairline (`border border-border`), no shadow.
  const elevated = isFeatureEnabled("design_system_elevation");
  const [results, setResults] = useState<SearchResult[]>([]);
  // ENG-815 — one unified segmented control (replaces the prototype's two
  // clashing filter languages). Every category here has REAL backing logic —
  // a presentational `_source` filter over the existing merged `results` — so
  // no chip is a dead affordance. Mirrors the mobile sibling's category set
  // ("Custom" = user-authored, "Branded" = FatSecret Premier, "Generic" =
  // USDA/OFF/Edamam/Generic*). Only consumed on the redesigned path.
  const [activeCategory, setActiveCategory] = useState<
    "All" | "Custom" | "Branded" | "Generic"
  >("All");
  const SEARCH_CATEGORIES = ["All", "Custom", "Branded", "Generic"] as const;
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // ENG-1038 — true when a keyed vendor (USDA / Edamam / FatSecret) was
  // skipped because its account-wide quota was exhausted. Drives an honest
  // "showing saved results" notice instead of a silent blank at viral scale.
  // Parity with mobile `FoodSearchPanel`.
  const [searchDegraded, setSearchDegraded] = useState(false);
  /**
   * Premier-tier autocomplete suggestions (2026-04-26 — FatSecret
   * Premier Free). Surfaced as a fast typeahead row that renders
   * BEFORE the full-search results. State is cleared whenever the
   * query changes; never blocks the main search.
   */
  const [autocomplete, setAutocomplete] = useState<{ tier: "basic" | "premier"; suggestions: string[] }>(
    { tier: "basic", suggestions: [] },
  );
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const autocompleteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    name: string;
    source: "USDA" | "OFF" | "CUSTOM" | "Edamam" | "FatSecret";
    /**
     * 2026-05-06 audit (D1): nullable for per-serving-only FatSecret
     * foods (no metric grounding). When null, `macrosPerServing`
     * carries the values and the only valid portion is the inline
     * serving (gramWeight: 0 sentinel). Mirrors the mobile preview
     * shape.
     */
    macrosPer100g: MacrosPer100g | null;
    macrosPerServing?: { calories: number; protein: number; carbs: number; fat: number } | null;
    microsPer100g?: Record<string, number>;
    microsPerServing?: Record<string, number>;
    portions: FoodPortion[];
    chosenPortion: FoodPortion;
    quantity: number;
    customFoodId?: string;
    imageUrl?: string | null;
  } | null>(null);
  const [previewEatenAtTime, setPreviewEatenAtTime] = useState("12:00");
  const previewEatenAtEnabled =
    Boolean(logDateKey) && isFeatureEnabled("editable_eaten_at");
  const previewSessionKey = preview
    ? `${preview.name}|${preview.source}|${preview.chosenPortion.label}`
    : null;
  useEffect(() => {
    if (!previewSessionKey || !logDateKey || !previewEatenAtEnabled) return;
    setPreviewEatenAtTime(
      localTimeInputValueFromIso(defaultEatenAtForNewLog(logDateKey)),
    );
  }, [previewSessionKey, logDateKey, previewEatenAtEnabled]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backfillRef = useRef(0);
  // No-result loop (audit move-blocker #2, 2026-05-02 — replaces
  // stale PR #36): dedupe the `food_search_no_result` event per
  // (trimmed, lowercase) query so a re-render doesn't double-fire.
  // See identical mobile shape in
  // `apps/mobile/components/food-search/FoodSearchPanel.tsx`.
  const lastNoResultQueryRef = useRef<string | null>(null);
  // Tracks dictionary-add CTA confirmations to avoid spammy re-fires
  // if the user double-clicks. Per-query (case-insensitive, trimmed).
  const dictionaryAddRequestedRef = useRef<string | null>(null);
  // Lightweight inline confirmation message shown after the user taps
  // "Tell us we're missing this" — no toast dependency to avoid
  // pulling sonner into a tight render path.
  const [dictionaryAddRequested, setDictionaryAddRequested] = useState<string | null>(null);

  const customEnabled = Boolean(supabase && userId);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<CustomFood | undefined>(undefined);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<CustomFood | null>(null);

  // Density tokens — shared by both modes so we avoid magic numbers in
  // the JSX. `compact` shaves vertical padding for LogSheet's smaller
  // budget; everything else stays identical.
  const px = mode === "compact" ? "px-3" : "px-6";
  const rowPy = mode === "compact" ? "py-1.5" : "py-2";

  const backfillMissingMacros = useCallback((items: SearchResult[]) => {
    const id = ++backfillRef.current;
    const missing = items
      .filter((r) => r._source === "USDA" && r._fdcId && !r.macrosPer100g && !(r.calsPer100g && r.calsPer100g > 0))
      .slice(0, 2);
    if (missing.length === 0) return;
    for (const item of missing) {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
      Promise.race([fetchUsdaDetail(item._fdcId!), timeout])
        .then((detail) => {
          if (!detail || backfillRef.current !== id) return;
          setResults((prev) =>
            prev.map((r) =>
              r.key === item.key
                ? { ...r, macrosPer100g: detail.macrosPer100g, calsPer100g: detail.macrosPer100g.calories }
                : r,
            ),
          );
        })
        .catch(() => {});
    }
  }, []);

  const refreshCustomLibrary = useCallback(async () => {
    if (!customEnabled || !supabase || !userId) return [] as CustomFood[];
    return await listCustomFoods(
      supabase as Parameters<typeof listCustomFoods>[0],
      userId,
    );
  }, [customEnabled, supabase, userId]);

  // Same merge / dedup / trust-weight logic as the legacy FoodSearch
  // had. Kept inline because it closes over `searchRelevance` (module
  // scope) and the local SearchResult type. F-77 + F-87 + F-89 + F-90.
  const mergeAndDedup = useCallback(
    (
      q: string,
      usda: SearchResult[],
      off: SearchResult[],
      edamam: SearchResult[] = [],
      fatsecret: SearchResult[] = [],
      customs: CustomFood[] = [],
      limit: number = 25,
      generics: SearchResult[] = [],
    ): SearchResult[] => {
      const customResults = customs
        .map((c) => ({ ...customFoodToSearchResult(c), _rel: searchRelevance(q, c.name) }))
        .sort((a, b) => (b._rel as number) - (a._rel as number));
      const trustWeight = (r: SearchResult): number =>
        foodSearchTrustWeight({
          source: r._source,
          verified: r.verified,
          name: r.name,
        });
      const external = [...usda, ...off, ...edamam, ...fatsecret]
        .map((r) => ({ ...r, _rel: Math.max(0, searchRelevance(q, r.name) + trustWeight(r)) }))
        .sort((a, b) => (b._rel as number) - (a._rel as number))
        .filter((r) => {
          const isVerified = Boolean(r.verified);
          if (isBareGenericNounRow(r.name, isVerified)) return false;
          if (isLowRelevanceNonVerifiedRow(r._rel as number, isVerified)) return false;
          // ENG-807 — honest low-confidence demotion keyed off the REAL tier
          // (provenance + name match), not the raw `verified` flag. Drops e.g.
          // a USDA Branded "EGGS" row that carries `verified: false` but high
          // token overlap. `matchScore` is name-only (trust weight is already
          // in `_rel` and the tier provenance check — not double-counted).
          const tier = searchRowConfidenceTier({
            source: r._source,
            verified: isVerified,
            matchScore: searchMatchScore(q, r.name),
          });
          if (isLowConfidenceDemotedRow({ tier, score: r._rel as number })) return false;
          return true;
        });
      // 2026-05-06: Per-source dedup (not cross-source). Same-named
      // foods from different sources (USDA "Mcdonald's, Big Mac" vs
      // FatSecret "McDonald's · Big Mac" both normalising to
      // "mcdonaldsbigmac") used to collapse to a single row, which
      // hid FatSecret entries entirely from "big mac" searches.
      // Per-source dedup gives the user explicit choice between
      // sources, matching MFP / Cronometer / Lose It UX.
      const seen = new Set<string>();
      const deduped: SearchResult[] = [];
      for (const r of [...customResults, ...generics, ...external]) {
        const norm = r._source === "CUSTOM"
          ? `custom:${r._custom?.id ?? r.key}`
          : r._source === "GenericBeverage" || r._source === "GenericFood"
            ? `generic:${r.key}`
            : `${r._source}|${r.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
        if (seen.has(norm)) continue;
        seen.add(norm);
        // ENG-807 — stamp the honest confidence tier on every surviving row so
        // the UI (next stage's lane) can render the Verified / Estimated chip
        // without recomputing the match. Derived from BOTH provenance and the
        // name match (never source alone). Custom rows are user-authored →
        // "estimated"; the row already carries its own "Custom" badge.
        deduped.push({
          ...r,
          confidenceTier: searchRowConfidenceTier({
            source: r._source,
            verified: Boolean(r.verified),
            matchScore: searchMatchScore(q, r.name),
          }),
        });
        if (deduped.length >= limit) break;
      }
      return deduped;
    },
    [],
  );

  const appendPage = useCallback(
    (prev: SearchResult[], next: SearchResult[]): SearchResult[] => {
      const seenKeys = new Set<string>(prev.map((r) => r.key));
      // Per-source name dedup so source-crossing overlap on
      // pagination doesn't drop FatSecret/Edamam hits that share a
      // normalized name with a USDA hit on a previous page.
      const seenSourceNames = new Set<string>(
        prev
          .filter((r) => r._source !== "CUSTOM")
          .map((r) => `${r._source}|${r.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`),
      );
      const fresh: SearchResult[] = [];
      for (const r of next) {
        if (seenKeys.has(r.key)) continue;
        const sourceName = `${r._source}|${r.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
        if (seenSourceNames.has(sourceName)) continue;
        seenKeys.add(r.key);
        seenSourceNames.add(sourceName);
        fresh.push(r);
      }
      return [...prev, ...fresh];
    },
    [],
  );

  // ── Premier-tier autocomplete typeahead ────────────────────────────
  //
  // Debounced 250 ms so we fire ~5x faster than the full search (which
  // sits on 400 ms). On Basic tier the route returns an empty list so
  // this is effectively a no-op. Cancellation via AbortController so
  // an in-flight autocomplete is cancelled when the user keeps typing.
  useEffect(() => {
    if (autocompleteDebounceRef.current) clearTimeout(autocompleteDebounceRef.current);
    if (autocompleteAbortRef.current) {
      autocompleteAbortRef.current.abort();
      autocompleteAbortRef.current = null;
    }
    const q = query.trim();
    if (!q) {
      setAutocomplete({ tier: "basic", suggestions: [] });
      return;
    }
    autocompleteDebounceRef.current = setTimeout(async () => {
      const ctl = new AbortController();
      autocompleteAbortRef.current = ctl;
      const result = await fetchFatSecretAutocomplete(q, { signal: ctl.signal, maxResults: 4 });
      // Discard a stale resolution if the user kept typing.
      if (autocompleteAbortRef.current !== ctl) return;
      setAutocomplete(result);
    }, 250);
    return () => {
      if (autocompleteDebounceRef.current) clearTimeout(autocompleteDebounceRef.current);
      if (autocompleteAbortRef.current) autocompleteAbortRef.current.abort();
    };
  }, [query]);

  // Re-run the multi-source search whenever `query` changes. Caller-owned
  // state — the panel is purely reactive. Debounced 400 ms.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    backfillRef.current++;
    pageRef.current = 1;
    hasMoreRef.current = true;
    setMenuOpenFor(null);
    if (customEnabled) void refreshCustomLibrary();
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      setSearchDegraded(false);
      return;
    }
    setLoading(true);
    // ENG-1038 — clear any prior degraded notice when a fresh query starts;
    // the new fan-out re-asserts it only if a vendor is still exhausted.
    setSearchDegraded(false);
    debounceRef.current = setTimeout(async () => {
      // F-114 broader sweep (2026-05-07): mirror mobile — wrap the
      // debounced first-page search in try/catch/finally so a
      // throwing source doesn't strand the user on a perpetual
      // spinner.
      const rankQ = effectiveFoodSearchQuery(q);
      const customPromise: Promise<CustomFood[]> = customEnabled && supabase && userId
        ? searchCustomFoods(
            supabase as Parameters<typeof searchCustomFoods>[0],
            userId,
            q,
          )
        : Promise.resolve([] as CustomFood[]);
      // ENG-686: stream first results as each source resolves instead of
      // gating on the slowest provider. Mirrors the Promise.race loop in
      // mobile's searchFoods — users see USDA / FatSecret hits in <1s
      // without waiting for Edamam / OFF's network round-trip.
      //
      // backfillRef is shared with backfillMissingMacros (it increments
      // the same counter). Capture gen BEFORE any backfill call so the
      // stale-render guard is stable throughout the streaming loop.
      const gen = backfillRef.current;
      const generic = buildGenericMatchRow(q);

      let partialUsda: Awaited<ReturnType<typeof searchUsda>> = [];
      let partialOff: Awaited<ReturnType<typeof searchOff>> = [];
      let partialEdamam: Awaited<ReturnType<typeof searchEdamam>> = [];
      let partialFatSecret: Awaited<ReturnType<typeof searchFatSecret>> = [];

      // Re-render with whatever has arrived so far.
      // `backfillMissingMacros` is called only once after the final render
      // (it increments backfillRef — calling it mid-loop would break the
      // gen === backfillRef.current guard below).
      const renderMerged = (custom: CustomFood[], final: boolean): SearchResult[] => {
        if (backfillRef.current !== gen) return [];
        const merged = mergeAndDedup(rankQ, partialUsda, partialOff, partialEdamam, partialFatSecret, custom, 25, generic ? [generic] : []);
        setResults(merged);
        if (final) {
          hasMoreRef.current =
            partialUsda.length + partialOff.length + partialEdamam.length + partialFatSecret.length > 0;
          const dedupKey = q.toLowerCase();
          if (merged.length === 0 && lastNoResultQueryRef.current !== dedupKey) {
            lastNoResultQueryRef.current = dedupKey;
            dictionaryAddRequestedRef.current = null;
            setDictionaryAddRequested(null);
            track(AnalyticsEvents.food_search_no_result, { query: q, len: q.length, source: "web" });
          } else if (merged.length > 0 && lastNoResultQueryRef.current === dedupKey) {
            lastNoResultQueryRef.current = null;
          }
        }
        return merged;
      };

      // ENG-1038 — flip the degraded notice if any keyed vendor was skipped
      // for account-wide quota. Fired from inside each source fetch.
      const onVendorDegraded = () => setSearchDegraded(true);

      // Label each external source so Promise.race can identify the winner.
      const usdaL = searchUsda(q, 1, onVendorDegraded).catch(() => [] as typeof partialUsda).then(r => { partialUsda = r; return "usda" as const; });
      const offL = searchOff(q, 1, onVendorDegraded).catch(() => [] as typeof partialOff).then(r => { partialOff = r; return "off" as const; });
      const edamamL = searchEdamam(q, 1, onVendorDegraded).catch(() => [] as typeof partialEdamam).then(r => { partialEdamam = r; return "edamam" as const; });
      const fatsecretL = searchFatSecret(q, 1, onVendorDegraded).catch(() => [] as typeof partialFatSecret).then(r => { partialFatSecret = r; return "fatsecret" as const; });
      const sourceMap = { usda: usdaL, off: offL, edamam: edamamL, fatsecret: fatsecretL } as const;
      const pending = new Set<Promise<keyof typeof sourceMap>>([usdaL, offL, edamamL, fatsecretL]);

      let firstArrived = false;
      while (pending.size > 0) {
        const done = await Promise.race(pending);
        pending.delete(sourceMap[done]);
        if (!firstArrived && backfillRef.current === gen) {
          firstArrived = true;
          setLoading(false);
        }
        renderMerged([], false);
      }
      if (!firstArrived) setLoading(false);

      // Await custom then do the final re-render with custom merged in.
      const customResult = await customPromise.catch(() => [] as CustomFood[]);
      const finalMerged = renderMerged(customResult, true);
      if (finalMerged.length > 0) backfillMissingMacros(finalMerged);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, customEnabled, supabase, userId, refreshCustomLibrary, mergeAndDedup, backfillMissingMacros]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    if (!hasMoreRef.current) return;
    const q = query.trim();
    if (!q) return;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    try {
      const [usda, off, edamam, fatsecret] = await Promise.all([
        searchUsda(q, nextPage),
        searchOff(q, nextPage),
        searchEdamam(q, nextPage),
        searchFatSecret(q, nextPage),
      ]);
      if (usda.length + off.length + edamam.length + fatsecret.length === 0) {
        hasMoreRef.current = false;
        return;
      }
      const rankQ = effectiveFoodSearchQuery(q);
      const pageMerged = mergeAndDedup(rankQ, usda, off, edamam, fatsecret, [], 50);
      if (pageMerged.length === 0) {
        hasMoreRef.current = false;
        return;
      }
      pageRef.current = nextPage;
      setResults((prev) => {
        const appended = appendPage(prev, pageMerged);
        if (appended.length === prev.length) {
          hasMoreRef.current = false;
        }
        backfillMissingMacros(appended);
        return appended;
      });
    } catch (e) {
      // F-114 (`AHOkMJ8yu5hA`, "Gets stuck trying to get more data"):
      // mirror mobile — a failed pagination fetch must stop further
      // attempts so the user doesn't see a perpetual loading-more
      // spinner on every scroll-to-bottom retry.
      hasMoreRef.current = false;
      console.warn("[FoodSearchPanel] loadMore failed:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, query, appendPage, backfillMissingMacros, mergeAndDedup]);

  const openCustomFoodPreview = useCallback(
    (food: CustomFood) => {
      setMenuOpenFor(null);
      const portions = buildCustomFoodPortions(food);
      const macros = customFoodToMacrosPer100g(food);
      const firstNamed = portions.find((p) => p.label !== "g");
      const chosen = firstNamed ?? portions[0];
      const quantity = chosen.label === "g" ? (food.baseGrams > 0 ? food.baseGrams : 100) : 1;
      setPreview({
        name: food.brand ? `${food.name} · ${food.brand}` : food.name,
        source: "CUSTOM",
        macrosPer100g: macros,
        portions,
        chosenPortion: chosen,
        quantity,
        customFoodId: food.id,
      });
    },
    [],
  );

  // Log a "Past logged" history row directly (ENG-1033) — per-serving food,
  // no per-100g basis, so the host commit path uses macrosPerServing ×
  // quantity. Mirrors the mobile `onSelectHistoryItem`.
  const onSelectHistoryItem = useCallback(
    (item: {
      recipeTitle: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      source?: string;
      imageUrl?: string | null;
    }) => {
      onSelect({
        name: item.recipeTitle,
        source: "history",
        macrosPer100g: null,
        macrosPerServing: {
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
        },
        portions: [{ label: "1 serving", gramWeight: 0, amount: 1 }],
        chosenPortion: { label: "1 serving", gramWeight: 0, amount: 1 },
        quantity: 1,
        ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      });
    },
    [onSelect],
  );

  const onPickResult = useCallback(async (item: SearchResult) => {
    setLoadingKey(item.key);
    if (item._source === "CUSTOM" && item._custom) {
      setLoadingKey(null);
      openCustomFoodPreview(item._custom);
      return;
    }
    if (
      (item._source === "GenericBeverage" || item._source === "GenericFood") &&
      item.macrosPer100g
    ) {
      setLoadingKey(null);
      const portions = buildPortions([], item.primaryServing);
      const { portion, quantity } = item.primaryServing
        ? { portion: portions[0], quantity: 1 }
        : resolveInitialPortion(portions, initialAmount, initialUnit);
      setPreview({
        name: item.name,
        source: "USDA",
        macrosPer100g: item.macrosPer100g,
        // ENG-738 — thread the baked generic-food micros through to the
        // preview (and onward to the commit/scale path) exactly like the
        // OFF/USDA branches. GenericBeverage rows carry no micros (beverage
        // micros deferred), so the conditional spread leaves them untouched.
        ...(item.microsPer100g ? { microsPer100g: item.microsPer100g } : {}),
        portions,
        chosenPortion: portion,
        quantity,
      });
      return;
    }
    if (item._source === "USDA" && item._fdcId) {
      const detail = await fetchUsdaDetail(item._fdcId);
      setLoadingKey(null);
      if (!detail) return;
      const effectivePrimary = item.primaryServing ?? detail.primaryPortion ?? null;
      const portions = buildPortions(detail.portions, effectivePrimary);
      const { portion, quantity } = effectivePrimary
        ? { portion: portions[0], quantity: 1 }
        : resolveInitialPortion(portions, initialAmount, initialUnit);
      setPreview({ name: item.name, source: "USDA", macrosPer100g: detail.macrosPer100g, ...(detail.microsPer100g ? { microsPer100g: detail.microsPer100g } : {}), portions, chosenPortion: portion, quantity });
    } else if (item._source === "OFF" && item.macrosPer100g) {
      setLoadingKey(null);
      const portions = buildPortions([], item.primaryServing);
      const { portion, quantity } = item.primaryServing
        ? { portion: portions[0], quantity: 1 }
        : resolveInitialPortion(portions, initialAmount, initialUnit);
      setPreview({
        name: item.name,
        source: "OFF",
        macrosPer100g: item.macrosPer100g,
        microsPer100g: item.microsPer100g,
        portions,
        chosenPortion: portion,
        quantity,
        imageUrl: item.imageUrl,
      });
    } else if (item._source === "Edamam" && item.macrosPer100g) {
      // ENG-738 (2026-05-26) — fetch the full per-100g micronutrient
      // panel from Edamam's `/nutrients` endpoint on select. The search
      // hit only carries fiber/sugar/sodium; `/api/edamam/food` returns
      // the fat breakdown + cholesterol + vitamins + minerals. We merge
      // the fetched set OVER the search-hit micros (the fetch is the
      // authoritative superset; `{}` on failure leaves the search-hit
      // micros intact so the food still logs). The commit path then
      // scales + persists via `scaleMicrosForGrams`.
      const fetchedMicros = item._edamamFoodId
        ? await fetchEdamamMicros(item._edamamFoodId)
        : {};
      setLoadingKey(null);
      const mergedMicros = { ...(item.microsPer100g ?? {}), ...fetchedMicros };
      const portions = buildPortions([], item.primaryServing);
      const { portion, quantity } = item.primaryServing
        ? { portion: portions[0], quantity: 1 }
        : resolveInitialPortion(portions, initialAmount, initialUnit);
      setPreview({
        name: item.name,
        source: "Edamam",
        macrosPer100g: item.macrosPer100g,
        ...(Object.keys(mergedMicros).length > 0 ? { microsPer100g: mergedMicros } : {}),
        portions,
        chosenPortion: portion,
        quantity,
        imageUrl: item.imageUrl,
      });
    } else if (item._source === "FatSecret" && item._fatSecretFoodId) {
      // Branded FatSecret rows usually surface in the search list with
      // null per-100g macros (the row was per-serving). Fetch the full
      // detail panel before opening the preview so the portion picker
      // has real values to scale. Never invent macros.
      //
      // 2026-05-06 audit (D1): FatSecret per-serving-only foods (e.g.
      // McDonald's Big Mac with no `metric_serving_amount`) return
      // `macrosPer100g: null` + `macrosPerServing` from the route.
      // Thread both through so the commit path can scale by quantity
      // without grams. Mirrors mobile behaviour.
      const detail = await fetchFatSecretDetail(item._fatSecretFoodId);
      setLoadingKey(null);
      if (!detail) return;
      const effectivePrimary = item.primaryServing ?? detail.primaryPortion ?? null;
      const portions = buildPortions(detail.portions, effectivePrimary);
      const { portion, quantity } = effectivePrimary
        ? { portion: portions[0], quantity: 1 }
        : resolveInitialPortion(portions, initialAmount, initialUnit);
      setPreview({
        name: item.name,
        source: "FatSecret",
        macrosPer100g: detail.macrosPer100g,
        ...(detail.macrosPerServing ? { macrosPerServing: detail.macrosPerServing } : {}),
        ...(detail.microsPer100g ? { microsPer100g: detail.microsPer100g } : {}),
        ...(detail.microsPerServing ? { microsPerServing: detail.microsPerServing } : {}),
        portions,
        chosenPortion: portion,
        quantity,
      });
    } else {
      setLoadingKey(null);
    }
  }, [initialAmount, initialUnit, openCustomFoodPreview]);

  // Custom-food CRUD ───────────────────────────────────────────────────
  const handleCreateCustomFood = useCallback(
    async (payload: CreateCustomFoodPayload) => {
      if (!customEnabled || !supabase || !userId) return;
      const created = await createCustomFood(
        supabase as Parameters<typeof createCustomFood>[0],
        userId,
        payload,
      );
      try {
        track(AnalyticsEvents.custom_food_created, {
          hasBrand: Boolean(created.brand),
          servingCount: created.servings.length,
        });
      } catch {
        // Analytics must never block a save.
      }
      const library = await refreshCustomLibrary();
      const fresh = library.find((f) => f.id === created.id) ?? created;
      setEditingFood(undefined);
      setCreateOpen(false);
      openCustomFoodPreview(fresh);
    },
    [customEnabled, supabase, userId, refreshCustomLibrary, openCustomFoodPreview],
  );

  const handleUpdateCustomFood = useCallback(
    async (payload: CreateCustomFoodPayload) => {
      if (!customEnabled || !supabase || !userId || !editingFood) return;
      const updated = await updateCustomFood(
        supabase as Parameters<typeof updateCustomFood>[0],
        userId,
        editingFood.id,
        payload,
      );
      try {
        track(AnalyticsEvents.custom_food_updated, {
          hasBrand: Boolean(updated.brand),
          servingCount: updated.servings.length,
        });
      } catch {
        // noop
      }
      await refreshCustomLibrary();
      setPreview((prev) =>
        prev && prev.customFoodId === updated.id
          ? {
              ...prev,
              name: updated.brand ? `${updated.name} · ${updated.brand}` : updated.name,
              macrosPer100g: customFoodToMacrosPer100g(updated),
              portions: buildCustomFoodPortions(updated),
            }
          : prev,
      );
      setEditingFood(undefined);
      setCreateOpen(false);
    },
    [customEnabled, supabase, userId, editingFood, refreshCustomLibrary],
  );

  const handleDeleteCustomFood = useCallback(
    (food: CustomFood) => {
      if (!customEnabled || !supabase || !userId) return;
      setDeleteCandidate(food);
    },
    [customEnabled, supabase, userId],
  );

  const commitDeleteCustomFood = useCallback(
    async (food: CustomFood) => {
      if (!customEnabled || !supabase || !userId) return;
      await deleteCustomFood(
        supabase as Parameters<typeof deleteCustomFood>[0],
        userId,
        food.id,
      );
      try {
        track(AnalyticsEvents.custom_food_deleted, { customFoodId: food.id });
      } catch {
        // noop
      }
      setMenuOpenFor(null);
      setResults((prev) => prev.filter((r) => !(r._source === "CUSTOM" && r._custom?.id === food.id)));
      setPreview((prev) => (prev && prev.customFoodId === food.id ? null : prev));
      await refreshCustomLibrary();
    },
    [customEnabled, supabase, userId, refreshCustomLibrary],
  );

  // ── Preview confirm ────────────────────────────────────────────────
  const onConfirm = useCallback(() => {
    if (!preview) return;
    const selection: FoodSearchSelection = {
      name: preview.name,
      source: preview.source,
      macrosPer100g: preview.macrosPer100g,
      ...(preview.macrosPerServing ? { macrosPerServing: preview.macrosPerServing } : {}),
      ...(preview.microsPer100g ? { microsPer100g: preview.microsPer100g } : {}),
      ...(preview.microsPerServing ? { microsPerServing: preview.microsPerServing } : {}),
      portions: preview.portions,
      chosenPortion: preview.chosenPortion,
      quantity: preview.quantity,
      ...(preview.imageUrl ? { imageUrl: preview.imageUrl } : {}),
      ...(previewEatenAtEnabled && logDateKey
        ? { eatenAt: eatenAtFromLogDateAndTime(logDateKey, previewEatenAtTime) }
        : {}),
    };
    if (preview.source === "CUSTOM") {
      selection.customFoodId = preview.customFoodId;
      if (preview.chosenPortion.label !== "g") {
        selection.servingLabel = preview.chosenPortion.label;
      }
      try {
        const grams = Math.round(preview.chosenPortion.gramWeight * preview.quantity * 10) / 10;
        const evt: Record<string, unknown> = { grams };
        if (selection.servingLabel) evt.servingLabel = selection.servingLabel;
        track(AnalyticsEvents.custom_food_logged, evt);
      } catch {
        // Analytics must never block a log.
      }
    }
    onSelect(selection);
    setPreview(null);
  }, [preview, onSelect, previewEatenAtEnabled, logDateKey, previewEatenAtTime]);

  const scaled = useMemo(() => {
    if (!preview) return null;
    // 2026-05-06 audit (D1): per-serving-only path (FatSecret no-
    // metric foods). gramWeight: 0 + macrosPerServing populated →
    // scale by quantity directly without per-100g math.
    //
    // 2026-05-15: condition widened to fire whenever the chosen
    // portion has gramWeight = 0 (no metric grounding), regardless of
    // whether macrosPer100g is populated — mixed-grounding FatSecret
    // foods (e.g. "8 pieces" primary + "100 g" alternate) need this
    // branch when the user picks the no-metric portion. Per-100g
    // math still runs for any portion that DOES have a gram weight.
    // `servingFraction` lets a derived "1 piece" portion scale the
    // macros to 1/N of the full serving (default 1 = full serving).
    // ENG-745: one shared predicate across preview + both commits.
    if (
      isPerServingPortion({
        gramWeight: preview.chosenPortion.gramWeight,
        hasMacrosPerServing: Boolean(preview.macrosPerServing),
      })
    ) {
      const fraction = preview.chosenPortion.servingFraction ?? 1;
      const q = preview.quantity * fraction;
      const ps = preview.macrosPerServing!;
      const m = preview.microsPerServing ?? {};
      const fiberPerServing = typeof m.fiberG === "number" ? m.fiberG : 0;
      const sugarPerServing = typeof m.sugarG === "number" ? m.sugarG : 0;
      const sodiumPerServing = typeof m.sodiumMg === "number" ? m.sodiumMg : 0;
      return {
        calories: Math.round(ps.calories * q),
        protein: Math.round(ps.protein * q * 10) / 10,
        carbs: Math.round(ps.carbs * q * 10) / 10,
        fat: Math.round(ps.fat * q * 10) / 10,
        fiberG: Math.round(fiberPerServing * q * 10) / 10,
        sugarG: Math.round(sugarPerServing * q * 10) / 10,
        sodiumMg: Math.round(sodiumPerServing * q),
      };
    }
    if (!preview.macrosPer100g) return null;
    return scaleMacros(preview.macrosPer100g, preview.chosenPortion.gramWeight * preview.quantity);
  }, [preview]);

  const totalGrams = preview ? Math.round(preview.chosenPortion.gramWeight * preview.quantity * 10) / 10 : 0;

  const previewExtraMicroRows = useMemo(
    () =>
      preview && scaled
        ? foodSearchPreviewExtraMicroRows({
            scaledMacros: scaled,
            microsPer100g: preview.microsPer100g,
            microsPerServing: preview.microsPerServing,
            hasMacrosPerServing: Boolean(preview.macrosPerServing),
            chosenPortion: preview.chosenPortion,
            quantity: preview.quantity,
          })
        : [],
    [preview, scaled],
  );

  const previewPlausibilityWarning = useMemo(
    () =>
      foodSearchPreviewPlausibilityWarning(
        preview?.macrosPer100g ?? null,
        scaled,
        totalGrams,
      ),
    [preview?.macrosPer100g, scaled, totalGrams],
  );

  const fitHint = useMemo(() => {
    if (!macroTargets || !macroConsumed || !scaled) return null;
    const projection = projectRemaining(macroTargets, macroConsumed, {
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      fiber: scaled.fiberG,
    });
    return projection;
  }, [macroTargets, macroConsumed, scaled]);

  // Fire `fit_this_in_previewed` once per distinct (food, qty, unit).
  const lastFitKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!preview || !fitHint || !scaled) {
      lastFitKeyRef.current = null;
      return;
    }
    const key = `${preview.name}|${preview.quantity}|${preview.chosenPortion.label}`;
    if (lastFitKeyRef.current === key) return;
    lastFitKeyRef.current = key;
    track(AnalyticsEvents.fit_this_in_previewed, {
      overCalories: fitHint.overCalories,
      kcalDelta: scaled.calories,
    });
  }, [preview, fitHint, scaled]);

  // Infinite-scroll IntersectionObserver — re-attached when results
  // change. Skipped while preview is open (no list to observe).
  useEffect(() => {
    if (preview) return;
    const node = sentinelRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void loadMore();
          }
        }
      },
      { rootMargin: "120px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [preview, results.length, loadMore]);

  // Locale-resolved hint flag (2026-04-26 — Premier Free is US-only).
  // Memoised so we don't re-evaluate Intl on every render. Hoisted
  // ABOVE the preview-mode early return so React's hook-order
  // invariant is preserved when the user toggles into the preview.
  const showBarcodeFallbackHint = useMemo(() => {
    if (inBarcodeMode) return false;
    if (!onScanBarcodePressed) return false;
    let locale = localeOverride;
    if (!locale) {
      try {
        locale = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().locale : undefined;
      } catch {
        locale = undefined;
      }
    }
    return shouldShowBarcodeFallbackHint(locale ?? null);
  }, [inBarcodeMode, onScanBarcodePressed, localeOverride]);

  // ── History-first search (ENG-1033) ──────────────────────────────────
  // MFP grammar: when the user has TYPED a query, surface matching items from
  // their own logging history FIRST, as a visually-distinct "Past logged"
  // group above the database results. The shared matcher ranks + de-dupes +
  // caps `recentFoods` (newest-first). Group renders only on the All /
  // Recents filters (Branded/Generic/Custom intents are "search-result
  // shape"). Mobile sections identically off the same shared functions.
  const historyMatches = useMemo<HistorySearchMatch[]>(() => {
    if (!query.trim() || !recentFoods || recentFoods.length === 0) return [];
    // Only on the "All" filter — Branded / Generic / Custom intents are
    // explicitly "search-result shape" and shouldn't be topped with history.
    if (activeCategory !== "All") return [];
    return matchHistoryFoods(recentFoods, query);
  }, [query, recentFoods, activeCategory]);

  // ── Favourites-in-search (teardown #1, ENG-1041) ─────────────────────
  // Per-row star state (filled vs outline) on every history-style row,
  // without a per-row Supabase call.
  const favoriteKeys = useMemo(
    () => favoriteFoodKeySet(favoriteFoods ?? []),
    [favoriteFoods],
  );
  // Typed-query "Favourites" group — favourites matching the query, ranked +
  // capped, rendered ABOVE "Past logged" (same All-only gate as history).
  const favoriteMatches = useMemo<FavoriteSearchMatch[]>(() => {
    if (!query.trim() || !favoriteFoods || favoriteFoods.length === 0) return [];
    if (activeCategory !== "All") return [];
    return matchFavoriteFoods(favoriteFoods, query);
  }, [query, favoriteFoods, activeCategory]);
  // A food that's BOTH favourite and in history shows once, in Favourites
  // (favourites win — the user deliberately starred it).
  const favoriteMatchKeys = useMemo(
    () =>
      new Set(favoriteMatches.map((m) => favoriteKey(m.item.recipeTitle, m.item.calories))),
    [favoriteMatches],
  );
  const historyMatchesDeduped = useMemo<HistorySearchMatch[]>(() => {
    if (favoriteMatchKeys.size === 0) return historyMatches;
    return historyMatches.filter(
      (m) => !favoriteMatchKeys.has(favoriteKey(m.item.recipeTitle, m.item.calories)),
    );
  }, [historyMatches, favoriteMatchKeys]);

  // Toggle a star from any history-style row — resolve the favourite id (when
  // unstarring) so the host can remove by id.
  const toggleFavoriteFor = useCallback(
    (food: {
      recipeTitle: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      source?: string;
    }) => {
      if (!onToggleFavorite) return;
      const key = favoriteKey(food.recipeTitle, food.calories);
      const existing = (favoriteFoods ?? []).find(
        (f) => favoriteKey(f.recipeTitle, f.calories) === key,
      );
      onToggleFavorite({ ...food, favoriteId: existing?.id });
    },
    [onToggleFavorite, favoriteFoods],
  );

  // De-dupe DB results against the history group — a database row whose name
  // exactly matches a "Past logged" row shows once (history wins). Catalogue
  // kcal is per-100g and never matches the per-serving history kcal, so the
  // honest cross-source identity is the EXACT normalized name.
  const historyNames = useMemo(() => historyMatchNameSet(historyMatches), [historyMatches]);
  const dedupedResults = useMemo<SearchResult[]>(() => {
    if (historyNames.size === 0) return results;
    return dedupeDbAgainstHistory(results, historyNames, (r) => normalizeHistoryName(r.name));
  }, [results, historyNames]);

  // ENG-815 — apply the active category filter, then split into Best/More via
  // the shared `splitFoodSearchResults` (same threshold + scorer as mobile).
  // Only used on the redesigned path; computed unconditionally so React's
  // hook order is stable when the flag toggles. `All` is identity. Each branch
  // filters by `_source` exactly like the mobile sibling lane. Operates over
  // `dedupedResults` so the "Past logged" group never repeats below (ENG-1033).
  const filteredResults = useMemo<SearchResult[]>(() => {
    switch (activeCategory) {
      case "Custom":
        return dedupedResults.filter((r) => r._source === "CUSTOM");
      case "Branded":
        return dedupedResults.filter((r) => r._source === "FatSecret");
      case "Generic":
        return dedupedResults.filter(
          (r) =>
            r._source === "USDA" ||
            r._source === "OFF" ||
            r._source === "Edamam" ||
            r._source === "GenericBeverage" ||
            r._source === "GenericFood",
        );
      case "All":
      default:
        return dedupedResults;
    }
  }, [dedupedResults, activeCategory]);
  const sectionedResults = useMemo(
    () => splitFoodSearchResults(query.trim(), filteredResults),
    [query, filteredResults],
  );

  // ENG-815 — render one redesigned (elevated, chip-bearing) result row.
  // Shares all behaviour with the legacy row (same `onPickResult`, same
  // custom-food edit/delete menu, same headline data) — only the chrome
  // changes: card seam instead of hairline, legible confidence chip instead
  // of the 14px green tick, "per 100g · source" byline. Defined as a closure
  // so it reuses the component's handlers + state without prop drilling.
  const renderRedesignedRow = (item: SearchResult) => {
    const isCustom = item._source === "CUSTOM";
    const customFood = isCustom ? item._custom : null;
    const headline = resolveFoodSearchHeadline(item);
    // Custom rows keep their own "Custom" badge (not a confidence chip). For
    // every other row, render the honest tier the data layer stamped. We never
    // invent a chip the model didn't back — fall back to "estimated" only when
    // the tier is genuinely absent (defensive; `mergeAndDedup` always stamps).
    const tier: SearchRowConfidenceTier = item.confidenceTier ?? "estimated";
    const sourceLabel = foodSearchSourceLabel(item._source);
    return (
      <div
        key={item.key}
        className="flex items-center gap-2 px-4 py-3.5 transition-colors hover:bg-muted/50 [&+&]:shadow-[inset_0_1px_0_var(--border)] relative"
      >
        <button
          type="button"
          onClick={() => onPickResult(item)}
          disabled={loadingKey === item.key}
          className="flex-1 min-w-0 flex items-center gap-3 text-left"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-semibold text-foreground truncate">{item.name}</span>
              {isCustom ? (
                <Badge variant="custom">Custom</Badge>
              ) : (
                <span
                  data-testid={`food-search-confidence-${tier}`}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide ${
                    tier === "verified" ? "bg-primary/10 text-primary" : ""
                  }`}
                  // ENG P5 parity (gap #11): the Estimated chip must NOT reuse
                  // the over-budget `--warning` orange — that exact token paints
                  // the over-budget fat macro in this same row, so one colour
                  // would mean both "estimated data" and "over-budget". Use the
                  // dedicated warm-amber `--chip-estimated` (#BF8324) token,
                  // mirroring the mobile chip
                  // (apps/mobile/components/ui/SearchResultConfidenceChip.tsx:60)
                  // exactly. Verified branch unchanged.
                  style={
                    tier === "verified"
                      ? undefined
                      : {
                          color: "var(--chip-estimated)",
                          backgroundColor: "var(--chip-estimated-soft)",
                        }
                  }
                >
                  {tier === "verified" ? (
                    <Icons.check className="h-2.5 w-2.5" aria-hidden />
                  ) : (
                    <Icons.info className="h-2.5 w-2.5" aria-hidden />
                  )}
                  {tier === "verified" ? "Verified" : "Estimated"}
                </span>
              )}
            </div>
            {headline.mode === "per-serving" ? (
              <>
                <div className="flex gap-2 mt-1 text-[11px] font-semibold text-muted-foreground">
                  <span className="text-destructive">P {headline.macros.protein}g</span>
                  <span className="text-[var(--macro-carbs)]">C {headline.macros.carbs}g</span>
                  <span className="text-warning">F {headline.macros.fat}g</span>
                </div>
                <span className="block mt-0.5 text-[11px] text-muted-foreground/80">
                  {headline.servingLabel}
                  {headline.per100gReference ? ` · ${headline.per100gReference}` : ""} · {sourceLabel}
                </span>
              </>
            ) : headline.mode === "per-100g" && headline.macros ? (
              <>
                <div className="flex gap-2 mt-1 text-[11px] font-semibold text-muted-foreground">
                  <span className="text-destructive">P {headline.macros.protein}g</span>
                  <span className="text-[var(--macro-carbs)]">C {headline.macros.carbs}g</span>
                  <span className="text-warning">F {headline.macros.fat}g</span>
                </div>
                <span className="block mt-0.5 text-[11px] text-muted-foreground/80">
                  {FOOD_SEARCH_PER_100G_BADGE} · {sourceLabel}
                </span>
              </>
            ) : headline.mode === "per-100g" ? (
              <span className="block mt-1 text-[11px] text-muted-foreground/80">
                {FOOD_SEARCH_PER_100G_BADGE} · {sourceLabel}
              </span>
            ) : (
              <span className="block mt-1 text-xs text-muted-foreground">Tap for nutrition info</span>
            )}
          </div>
          {headline.mode !== "placeholder" && loadingKey !== item.key ? (
            <div className="flex flex-col items-end shrink-0">
              <span className="text-[18px] font-extrabold text-foreground tabular-nums leading-none">{headline.headlineKcal}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mt-0.5">kcal</span>
            </div>
          ) : null}
          {loadingKey === item.key ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          ) : (
            <Icons.forward className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>
        {isCustom && customFood && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenFor((cur) => (cur === customFood.id ? null : customFood.id));
              }}
              aria-label={`More options for ${customFood.name}`}
              aria-haspopup="menu"
              aria-expanded={menuOpenFor === customFood.id}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <span aria-hidden="true" className="text-lg leading-none">⋯</span>
            </button>
            {menuOpenFor === customFood.id && (
              <div
                role="menu"
                className="absolute right-0 top-9 z-10 min-w-[9rem] rounded-md border border-border bg-card shadow-lg py-1"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpenFor(null);
                    setEditingFood(customFood);
                    setCreateOpen(true);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-muted/60"
                >
                  Edit
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleDeleteCustomFood(customFood)}
                  className="w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-muted/60"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Preview takes over the panel when set.
  if (preview && scaled) {
    return (
      <div className={`flex flex-col h-full ${px}`}>
        <div className="flex-1 overflow-y-auto pb-3 space-y-4">
          <button onClick={() => setPreview(null)} className="text-sm text-primary hover:underline flex items-center gap-1">
            <Icons.forward className="h-3 w-3 rotate-180" /> Back to results
          </button>

          <h3 className="font-semibold text-foreground">{preview.name}</h3>

          {originalDescription && (
            <p className="text-sm italic text-muted-foreground -mt-1">
              Recipe calls for: {originalDescription}
            </p>
          )}

          {/* Serving size */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Serving size</p>
            <div className="flex flex-wrap gap-1.5">
              {preview.portions.map((p, i) => (
                <button
                  key={`${p.label}-${i}`}
                  onClick={() => setPreview((prev) => {
                    if (!prev) return prev;
                    const defaultQty = p.label === "g" || p.label === "ml" ? 100 : 1;
                    return { ...prev, chosenPortion: p, quantity: defaultQty };
                  })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    preview.chosenPortion.label === p.label
                      ? "border-success bg-success/15 text-success"
                      : "border-border text-muted-foreground hover:border-border/80"
                  }`}
                >
                  {p.label}
                  {p.gramWeight !== 1 && p.gramWeight > 0 && <span className="block text-[10px] text-muted-foreground">{p.gramWeight}g</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Number of servings</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreview((p) => {
                  if (!p || p.quantity <= 0.25) return p;
                  const step = p.chosenPortion.label === "g" || p.chosenPortion.label === "ml" ? 5 : 0.25;
                  return { ...p, quantity: Math.max(0, Math.round((p.quantity - step) * 100) / 100) };
                })}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/60"
              >
                -
              </button>
              <input
                type="number"
                value={preview.quantity}
                onChange={(e) => {
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num) && num >= 0) setPreview((p) => p ? { ...p, quantity: num } : p);
                }}
                className="w-20 text-center font-semibold border border-border rounded-lg py-1.5 bg-transparent text-foreground"
              />
              <button
                onClick={() => setPreview((p) => {
                  if (!p) return p;
                  const step = p.chosenPortion.label === "g" || p.chosenPortion.label === "ml" ? 5 : 0.25;
                  return { ...p, quantity: Math.round((p.quantity + step) * 100) / 100 };
                })}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/60"
              >
                +
              </button>
              <span className="text-sm text-muted-foreground">
                {portionEqualsLabel({
                  quantity: preview.quantity,
                  label: preview.chosenPortion.label,
                  gramWeight: preview.chosenPortion.gramWeight,
                  totalGrams,
                })}
              </span>
            </div>
          </div>

          {/* Nutrition */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Nutrition</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["Calories", `${scaled.calories} kcal`],
                ["Protein", `${scaled.protein}g`],
                ["Carbs", `${scaled.carbs}g`],
                ["Fat", `${scaled.fat}g`],
                ...(scaled.fiberG > 0 ? [["Fibre", `${scaled.fiberG}g`]] : []),
                ...(scaled.sugarG > 0 ? [["Sugar", `${scaled.sugarG}g`]] : []),
                ...(scaled.sodiumMg > 0 ? [["Sodium", `${scaled.sodiumMg}mg`]] : []),
                ...previewExtraMicroRows.map((r) => [r.label, r.value] as const),
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {previewPlausibilityWarning ? (
            <p className="text-xs text-destructive" role="alert">
              {previewPlausibilityWarning}
            </p>
          ) : null}

          {previewEatenAtEnabled ? (
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Time eaten
              </span>
              <input
                type="time"
                value={previewEatenAtTime}
                onChange={(e) => setPreviewEatenAtTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
              />
            </label>
          ) : null}

          {fitHint && (
            <div
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
              role="status"
              aria-label="Projected remaining macros after logging this portion"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                If you log this
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
                {[
                  { label: "kcal", value: fitHint.calories, delta: fitHint.deltas.calories, over: fitHint.overCalories },
                  { label: "P", value: fitHint.protein, delta: fitHint.deltas.protein, over: fitHint.overProtein, unit: "g" },
                  { label: "C", value: fitHint.carbs, delta: fitHint.deltas.carbs, over: fitHint.overCarbs, unit: "g" },
                  { label: "F", value: fitHint.fat, delta: fitHint.deltas.fat, over: fitHint.overFat, unit: "g" },
                  ...(fitHint.fiber != null
                    ? [{ label: "Fi", value: fitHint.fiber, delta: fitHint.deltas.fiber ?? 0, over: fitHint.overFiber, unit: "g" }]
                    : []),
                ].map((m) => (
                  <span key={m.label} className="flex items-baseline gap-0.5">
                    <span
                      className="font-semibold"
                      style={{ color: m.over ? "var(--destructive)" : "var(--foreground)" }}
                    >
                      {m.over ? `+${Math.abs(m.delta)}` : m.value}
                      {m.unit ? m.unit : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {m.label}
                    </span>
                    <span className="text-muted-foreground">
                      {m.over ? " over" : " left"}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky "Use this" CTA — kept on a border-t footer (visual-qa
            P0 fix from 2026-04-30) so on short viewports the button is
            always reachable without scrolling. */}
        <div className="border-t border-border bg-card -mx-3 px-3 py-3 shrink-0">
          <button
            onClick={onConfirm}
            className={`w-full py-3 rounded-xl ${commitCtaClass} font-semibold transition-colors flex items-center justify-center gap-2`}
          >
            <Icons.check className="h-4 w-4" />
            Use this
          </button>
        </div>

        {/* Edit-custom-food dialog stays mounted in preview mode in case
            the user opens edit from elsewhere. Render once for the
            whole panel. */}
        {customEnabled && (
          <CreateCustomFoodDialog
            open={createOpen}
            onOpenChange={(next) => {
              setCreateOpen(next);
              if (!next) setEditingFood(undefined);
            }}
            initialFood={editingFood}
            initialName={editingFood ? undefined : (query.trim() || undefined)}
            onSave={editingFood ? handleUpdateCustomFood : handleCreateCustomFood}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${px}`}>
      <div className="flex-1 overflow-y-auto pb-3">
        {/* Premier-tier autocomplete typeahead row.
            Only renders when the server has confirmed Premier tier AND
            we have at least one suggestion. On Basic this stays empty
            (no UI cost). The full-search results render below as
            normal — autocomplete is additive, not replacement. */}
        {autocomplete.tier === "premier" && autocomplete.suggestions.length > 0 && query.trim() && (
          <div
            data-testid="fatsecret-autocomplete-row"
            className="mb-2 flex flex-wrap gap-1.5"
            role="listbox"
            aria-label="Suggested completions"
          >
            {autocomplete.suggestions.map((s) => (
              <span
                key={s}
                role="option"
                aria-selected="false"
                className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* ENG-815 — one unified segmented control (redesigned path only).
            Replaces the prototype's two clashing filter languages with a
            single horizontal control. Every chip filters real `_source` rows
            (see `filteredResults`) — no dead affordance.
            ENG P5 parity (gap #30): mobile renders this strip whenever the
            panel is active with a query (`apps/mobile/.../FoodSearchPanel.tsx`
            renders the category ScrollView unconditionally in the return),
            NOT result-count gated. Web previously hid it on zero-result
            queries — a parity break. Relaxed to render whenever the user has
            searched (`query.trim()`), so a no-result query keeps the filter
            control visible above the "No results" empty state, matching mobile.
            The inactive pill's soft shadow is depth (`design_system_elevation`,
            gap #5); the strip's STRUCTURE stays under `redesign_search_results`. */}
        {searchResultsRedesign && query.trim() && (
          <div
            role="tablist"
            aria-label="Filter food results"
            data-testid="food-search-category-tabs"
            className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {SEARCH_CATEGORIES.map((cat) => {
              const isActive = cat === activeCategory;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`food-search-category-${cat}`}
                  onClick={() => setActiveCategory(cat)}
                  // Chip grammar (web parity 2026-06-10, ENG-1022): filter
                  // chips are `rounded-full`; selected = `bg-primary-soft` fill
                  // + `primary-solid` label + `font-semibold`, NO ring/border;
                  // unselected = quiet `bg-card` + muted label, NO border. Was
                  // `rounded-xl border` + a solid `bg-primary` selected slab.
                  className={`shrink-0 rounded-full px-4 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    isActive
                      ? "bg-primary-soft text-primary-solid font-semibold"
                      : "bg-card text-muted-foreground font-medium hover:bg-muted/60"
                  }`}
                  style={
                    !isActive && elevated
                      ? { boxShadow: "var(--elev-card-soft)" }
                      : undefined
                  }
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {/* ENG-1038 — graceful degradation notice. When a keyed vendor's
            account-wide quota is exhausted at viral scale, the search layer
            flags it and we tell the user honestly that some live sources are
            paused — rather than letting search silently look broken. Amber
            (warning) family: advisory, never destructive red. Mobile parity. */}
        {searchDegraded && !loading && (
          <div
            data-testid="food-search-degraded-notice"
            className="mx-1 mt-2 mb-1 rounded-md border border-warning bg-warning-soft px-3 py-2 text-[13px] leading-snug text-warning-solid"
            role="status"
          >
            Some live food sources are busy right now — showing saved and
            verified results. Try again shortly for the full list.
          </div>
        )}

        {loading && results.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* Favourites-in-search (teardown #1, ENG-1041, MFP/Lifesum grammar):
            when the user has TYPED a query, the foods they've STARRED that
            match it surface in a "Favourites" group ABOVE "Past logged" — the
            curated set leads the recall set. Mobile parity. */}
        {favoriteMatches.length > 0 && (
          <div data-testid="food-search-favourites" className="mb-3.5">
            <p className="mt-2.5 mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Favourites
            </p>
            <div className="divide-y divide-border">
              {favoriteMatches.map((m, i) => {
                const item = m.item;
                const pending = favoritePendingKeys?.has(
                  favoriteKey(item.recipeTitle, item.calories),
                );
                return (
                  <button
                    key={`fav-${m.key}`}
                    type="button"
                    data-testid={`food-search-favourites-${i}`}
                    onClick={() => onSelectHistoryItem(item)}
                    className="flex w-full items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label={`Log ${item.recipeTitle}, ${Math.round(item.calories)} calories`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-foreground">
                        {item.recipeTitle}
                      </span>
                      <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                        {formatMacroTrailer({
                          calories: item.calories,
                          protein: item.protein,
                          carbs: item.carbs,
                          fat: item.fat,
                        })}
                      </span>
                    </div>
                    {onToggleFavorite ? (
                      <FavoriteStar
                        starred
                        pending={pending}
                        onToggle={() => toggleFavoriteFor(item)}
                        testId={`food-search-favourites-${i}-star`}
                      />
                    ) : null}
                    <Icons.forward className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* History-first search (ENG-1033, MFP grammar): when the user has
            TYPED a query, the foods they've logged before that match it
            surface as a visually-distinct "Past logged" group above the
            database results. De-dupe (history wins) is applied to the DB list
            below via `dedupedResults`; favourites win over history within this
            sheet via `historyMatchesDeduped`. Mobile parity:
            `apps/mobile/components/food-search/FoodSearchPanel.tsx`. */}
        {historyMatchesDeduped.length > 0 && (
          <div data-testid="food-search-past-logged" className="mb-3.5">
            <p className="mt-2.5 mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Past logged
            </p>
            <div className="divide-y divide-border">
              {historyMatchesDeduped.map((m, i) => {
                const item = m.item;
                const starred = isFavoriteRow(favoriteKeys, item.recipeTitle, item.calories);
                const pending = favoritePendingKeys?.has(
                  favoriteKey(item.recipeTitle, item.calories),
                );
                return (
                  <button
                    key={`past-${m.key}`}
                    type="button"
                    data-testid={`food-search-past-logged-${i}`}
                    onClick={() => onSelectHistoryItem(item)}
                    className="flex w-full items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label={`Log ${item.recipeTitle}, ${Math.round(item.calories)} calories`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-foreground">
                        {item.recipeTitle}
                      </span>
                      <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                        {formatMacroTrailer({
                          calories: item.calories,
                          protein: item.protein,
                          carbs: item.carbs,
                          fat: item.fat,
                        })}
                      </span>
                    </div>
                    {onToggleFavorite ? (
                      <FavoriteStar
                        starred={starred}
                        pending={pending}
                        onToggle={() => toggleFavoriteFor(item)}
                        testId={`food-search-past-logged-${i}-star`}
                      />
                    ) : null}
                    <Icons.forward className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ENG-815 — redesigned results body: elevated grouped result cards,
            Best/More split, legible Verified/Estimated confidence chip. Old
            flat hairline list stays alive in the `else` below. */}
        {searchResultsRedesign && results.length > 0 ? (
          <div data-testid="food-search-results-redesign">
            {filteredResults.length === 0 ? (
              <p
                className="py-6 text-center text-sm text-muted-foreground"
                data-testid="food-search-category-empty"
              >
                No {activeCategory.toLowerCase()} foods in these results.
              </p>
            ) : (
              [
                { label: "Best matches", rows: sectionedResults.best },
                { label: "More results", rows: sectionedResults.more },
              ]
                .filter((section) => section.rows.length > 0)
                .map((section) => (
                  <div key={section.label}>
                    <p className="mt-2.5 mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                      {section.label}
                    </p>
                    <div
                      className={`mb-3.5 overflow-hidden rounded-2xl bg-card ${
                        elevated ? "border-0" : "border border-border"
                      }`}
                      style={elevated ? { boxShadow: "var(--elev-card-soft)" } : undefined}
                    >
                      {section.rows.map((item) => renderRedesignedRow(item))}
                    </div>
                  </div>
                ))
            )}
          </div>
        ) : dedupedResults.length > 0 ? (
          <div className="divide-y divide-border">
            {dedupedResults.map((item) => {
              const isCustom = item._source === "CUSTOM";
              const customFood = isCustom ? item._custom : null;
              const headline = resolveFoodSearchHeadline(item);
              return (
                <div
                  key={item.key}
                  className={`flex items-center gap-1 ${rowPy} px-2 -mx-2 rounded-lg hover:bg-muted/60 transition-colors relative`}
                >
                  <button
                    type="button"
                    onClick={() => onPickResult(item)}
                    disabled={loadingKey === item.key}
                    className="flex-1 min-w-0 flex items-center gap-3 py-2 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isCustom && (
                          <Badge variant="custom">Custom</Badge>
                        )}
                        {item.verified && !isCustom && (
                          <Icons.check className="h-3.5 w-3.5 text-success shrink-0" />
                        )}
                        <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                      </div>
                      {headline.mode === "per-serving" ? (
                        <>
                          <div className="flex gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <span>{headline.macros.calories} kcal</span>
                            <span className="text-[var(--macro-protein)]">P:{headline.macros.protein}g</span>
                            <span className="text-[var(--macro-carbs)]">C:{headline.macros.carbs}g</span>
                            <span className="text-[var(--macro-fat)]">F:{headline.macros.fat}g</span>
                          </div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-success">
                            {FOOD_SEARCH_PER_SERVING_BADGE}
                          </span>
                          <span className="block text-[10px] text-muted-foreground/80">
                            {headline.servingLabel}
                            {headline.per100gReference ? ` · ${headline.per100gReference}` : ""}
                          </span>
                        </>
                      ) : headline.mode === "per-100g" && headline.macros ? (
                        <>
                          <div className="flex gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <span>{headline.macros.calories} kcal</span>
                            <span className="text-[var(--macro-protein)]">P:{headline.macros.protein}g</span>
                            <span className="text-[var(--macro-carbs)]">C:{headline.macros.carbs}g</span>
                            <span className="text-[var(--macro-fat)]">F:{headline.macros.fat}g</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground/80">{FOOD_SEARCH_PER_100G_BADGE}</span>
                        </>
                      ) : headline.mode === "per-100g" ? (
                        <span className="text-[11px] text-muted-foreground">{headline.headlineKcal} kcal {FOOD_SEARCH_PER_100G_BADGE}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Tap for nutrition info</span>
                      )}
                    </div>
                    {headline.mode !== "placeholder" && loadingKey !== item.key ? (
                      <span className="text-sm font-bold text-foreground tabular-nums">{headline.headlineKcal}</span>
                    ) : null}
                    {loadingKey === item.key ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <Icons.forward className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {isCustom && customFood && (
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenFor((cur) => (cur === customFood.id ? null : customFood.id));
                        }}
                        aria-label={`More options for ${customFood.name}`}
                        aria-haspopup="menu"
                        aria-expanded={menuOpenFor === customFood.id}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <span aria-hidden="true" className="text-lg leading-none">⋯</span>
                      </button>
                      {menuOpenFor === customFood.id && (
                        <div
                          role="menu"
                          className="absolute right-0 top-9 z-10 min-w-[9rem] rounded-md border border-border bg-card shadow-lg py-1"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuOpenFor(null);
                              setEditingFood(customFood);
                              setCreateOpen(true);
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-muted/60"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleDeleteCustomFood(customFood)}
                            className="w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-muted/60"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Infinite-scroll sentinel — F-10. */}
        {results.length > 0 && (
          <>
            <div
              ref={sentinelRef}
              aria-hidden="true"
              data-testid="food-search-load-more-sentinel"
              className="h-px w-full"
            />
            {loadingMore ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : null}
          </>
        )}

        {!loading && query.trim() && results.length === 0 && (
          <div
            className="py-6 px-4 flex flex-col gap-3"
            data-testid="food-search-no-result-empty-state"
          >
            <p className="text-sm text-muted-foreground text-center">
              No results for &quot;{query}&quot;.
            </p>
            <p className="text-xs text-muted-foreground/80 text-center -mt-2">
              {customEnabled
                ? "Add it yourself, or let us know we should."
                : "Try a simpler or more specific term."}
            </p>
            {/* No-result loop (audit move-blocker #2, 2026-05-02 —
                replaces stale PR #36): two-CTA empty state. The
                "Add as custom food" CTA opens the existing
                CreateCustomFoodDialog with the query pre-filled (the
                same path the persistent footer button uses, but here
                it's the primary action because the user clearly
                didn't find what they wanted). The "Tell us we're
                missing this" CTA fires a dictionary-add event so the
                backfill workstream knows which queries to prioritise.
                Both CTAs are deduped per query — triple-tap = one
                emit. */}
            {customEnabled ? (
              <button
                type="button"
                onClick={() => {
                  setEditingFood(undefined);
                  setCreateOpen(true);
                }}
                aria-label={`Add "${query}" as a custom food`}
                data-testid="food-search-no-result-add-custom"
                className="w-full flex items-center gap-2 justify-center py-2.5 rounded-lg border border-primary bg-primary/10 text-sm font-bold text-primary hover:bg-primary/15 transition-colors"
              >
                <span aria-hidden="true" className="text-base leading-none">+</span>
                Add as custom food
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const q = query.trim();
                if (!q) return;
                const dedupKey = q.toLowerCase();
                if (dictionaryAddRequestedRef.current === dedupKey) return;
                dictionaryAddRequestedRef.current = dedupKey;
                setDictionaryAddRequested(q);
                track(AnalyticsEvents.food_search_request_dictionary_add, {
                  query: q,
                  len: q.length,
                  source: "web",
                });
              }}
              aria-label="Tell us we're missing this food"
              data-testid="food-search-no-result-request-add"
              className="w-full flex items-center gap-2 justify-center py-2.5 rounded-lg border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              Tell us we&apos;re missing this
            </button>
            {dictionaryAddRequested && dictionaryAddRequested === query.trim() ? (
              <p
                className="text-xs text-success text-center"
                data-testid="food-search-no-result-request-confirmation"
                role="status"
              >
                Thanks — we&apos;ll prioritise adding this to our food database.
              </p>
            ) : null}
            {showBarcodeFallbackHint && (
              <button
                type="button"
                onClick={onScanBarcodePressed}
                data-testid="food-search-barcode-fallback-hint"
                className="w-full flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left hover:bg-muted/40 transition-colors"
                aria-label="Scan a barcode — works for UK and EU products"
              >
                <Barcode className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="flex-1 text-sm text-foreground">
                  Brand not found? Try a barcode scan — works for UK &amp; EU products
                </span>
                <Icons.forward className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Persistent "+ Create custom food" entry point. */}
        {customEnabled && (
          <button
            type="button"
            onClick={() => {
              setEditingFood(undefined);
              setCreateOpen(true);
            }}
            aria-label="Create a new custom food"
            className="mt-3 w-full flex items-center gap-2 justify-center py-3 rounded-lg border border-dashed border-border text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            <span aria-hidden="true" className="text-base leading-none">+</span>
            Create custom food
          </button>
        )}
      </div>

      {/* Custom-food create / edit dialog — rendered outside the
          results list so it survives panel re-renders. */}
      {customEnabled && (
        <CreateCustomFoodDialog
          open={createOpen}
          onOpenChange={(next) => {
            setCreateOpen(next);
            if (!next) setEditingFood(undefined);
          }}
          initialFood={editingFood}
          initialName={editingFood ? undefined : (query.trim() || undefined)}
          onSave={editingFood ? handleUpdateCustomFood : handleCreateCustomFood}
        />
      )}
      {/* Themed destructive-confirm dialog — replaces window.confirm. */}
      {customEnabled && (
        <DestructiveConfirmDialog
          open={deleteCandidate != null}
          onOpenChange={(o) => {
            if (!o) setDeleteCandidate(null);
          }}
          title={deleteCandidate ? `Delete "${deleteCandidate.name}"?` : "Delete food?"}
          description="This can't be undone."
          confirmLabel="Delete"
          onConfirm={async () => {
            if (deleteCandidate) await commitDeleteCustomFood(deleteCandidate);
          }}
        />
      )}
    </div>
  );
}

/**
 * FavoriteStar — the star toggle on history-style search rows (teardown #1,
 * ENG-1041). Rendered as a `role="button"` span (not a `<button>`) because the
 * row itself is a `<button>` and nested buttons are invalid HTML — same
 * pattern as the LogSheet `RightEdgeIcons`. `stopPropagation` so a star tap
 * doesn't also fire the row's log action. Filled amber = starred, outline
 * muted = not; disabled + dimmed while a toggle is in flight (no double
 * submit). Tokenised on `--accent-win` (Sloe amber/win family) to match the
 * mobile `FavoriteStarButton`.
 */
function FavoriteStar({
  starred,
  pending,
  onToggle,
  testId,
}: {
  starred: boolean;
  pending?: boolean;
  onToggle: () => void;
  testId?: string;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      data-testid={testId}
      aria-label={starred ? "Unstar food" : "Favourite this food"}
      aria-pressed={starred}
      aria-disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        if (pending) return;
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          if (pending) return;
          onToggle();
        }
      }}
      className={`grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        pending ? "opacity-50" : ""
      }`}
    >
      <Star
        className="h-5 w-5"
        style={{
          color: starred ? "var(--accent-win)" : "var(--muted-foreground)",
          fill: starred ? "var(--accent-win)" : "transparent",
        }}
        strokeWidth={2.25}
        aria-hidden
      />
    </span>
  );
}

export default FoodSearchPanel;
