"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { effectiveFoodSearchQuery } from "@/lib/nutrition/foodSearchQuery";
import {
  projectRemaining,
  type MacroConsumed,
  type MacroTargets,
} from "@/lib/nutrition/remainingMacros";
import { Loader2 } from "lucide-react";
import { Icons } from "./ui/icons";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog.tsx";
import { Input } from "./ui/input.tsx";
import { CreateCustomFoodDialog } from "./suppr/create-custom-food-dialog";
import type { CreateCustomFoodPayload } from "./suppr/create-custom-food-dialog";
import { Badge } from "./suppr/badge";
import { DestructiveConfirmDialog } from "./suppr/destructive-confirm-dialog";
import {
  createCustomFood,
  deleteCustomFood,
  listCustomFoods,
  searchCustomFoods,
  updateCustomFood,
} from "../../lib/nutrition/customFoodsClient";
import {
  buildCustomFoodPortions,
  customFoodToMacrosPer100g,
  customFoodToPrimaryServing,
  type CustomFood,
} from "../../lib/nutrition/customFoods";
import {
  pickEdamamPrimaryServing,
  pickUsdaBrandedPrimaryServing,
  pickUsdaFoodPortionsPrimaryServing,
  parseOffPrimaryServing,
  primaryServingToPortionChip,
  type PrimaryServing,
} from "../../lib/nutrition/primaryServing";
import { AnalyticsEvents } from "../../lib/analytics/events";
import { track } from "../../lib/analytics/track";

// ── Types ────────────────────────────────────────────────────────────

type MacrosPer100g = {
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

type FoodPortion = { label: string; gramWeight: number; amount: number };

type SearchResult = {
  key: string;
  name: string;
  /** Restaurant / brand byline shown beneath the title — set for Edamam restaurant + branded hits. */
  subtitle?: string;
  calsPer100g?: number;
  macrosPer100g?: MacrosPer100g;
  verified?: boolean;
  imageUrl?: string | null;
  /**
   * Natural portion derived from the source (Edamam `servingSizes`, USDA
   * branded `servingSize`, OFF `serving_size`). Null when the source
   * exposes only a per-gram fallback — display falls back to /100g only.
   * TestFlight `APo0qS9vcFvmBJEJJ_-61YA` (2026-04-19).
   */
  primaryServing?: PrimaryServing | null;
  _source: "USDA" | "OFF" | "CUSTOM" | "Edamam";
  _fdcId?: number;
  _offCode?: string;
  /** Edamam food identifier (string, not numeric). */
  _edamamFoodId?: string;
  /** Populated for `_source === "CUSTOM"` rows so edit/delete can act on the underlying row. */
  _custom?: CustomFood;
};

export type FoodSearchSelection = {
  name: string;
  source: "USDA" | "OFF" | "CUSTOM";
  macrosPer100g: MacrosPer100g;
  portions: FoodPortion[];
  chosenPortion: FoodPortion;
  quantity: number;
  /** Present when the user selected one of their own custom foods. */
  customFoodId?: string;
  /** Non-gram named serving label chosen from the custom food's saved chips. */
  servingLabel?: string;
};

/**
 * Supabase client shape FoodSearch needs for custom-food CRUD. Kept loose on
 * purpose so tests can pass a mock and so we don't couple this file to the
 * web-specific `browserClient`. When omitted, the custom-food entry point
 * is hidden and the search behaves exactly as before.
 */
type SupabaseLike = { from: (table: string) => unknown };

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: FoodSearchSelection) => void;
  initialQuery?: string;
  /** Original recipe amount (e.g. 2 for "2 chicken breasts") */
  initialAmount?: number | string | null;
  /** Original recipe unit (e.g. "lb", "cup", "g") */
  initialUnit?: string | null;
  /** Original ingredient description shown as context (e.g. "1 lb chicken breast") */
  originalDescription?: string | null;
  /**
   * Optional budget context. When both `macroTargets` and `macroConsumed`
   * are provided the portion preview shows a "If you log this:" fit-this-in
   * hint using the shared remainingMacros helper. Omitting them (e.g. in
   * verify-ingredient flows) hides the hint.
   */
  macroTargets?: MacroTargets;
  macroConsumed?: MacroConsumed;
  /**
   * Custom-foods wiring (Batch 3.9). When both `supabase` and `userId` are
   * provided the panel lists the user's custom foods at the top of results,
   * shows a "+ Create custom food" entry point, and exposes edit/delete on
   * custom rows. Omit to hide the feature entirely (e.g. tests, offline).
   */
  supabase?: SupabaseLike;
  userId?: string | null;
};

// ── Standard units ──────────────────────────────────────────────────

const STANDARD_UNITS: FoodPortion[] = [
  { label: "g", gramWeight: 1, amount: 1 },
  { label: "oz", gramWeight: 28.35, amount: 1 },
  { label: "lb", gramWeight: 453.59, amount: 1 },
  { label: "tbsp", gramWeight: 14.79, amount: 1 },
  { label: "tsp", gramWeight: 4.93, amount: 1 },
  { label: "cup", gramWeight: 236.59, amount: 1 },
  { label: "ml", gramWeight: 1, amount: 1 },
];

// ── Helpers (ported from mobile verifyRecipe.ts) ────────────────────

function titleCase(s: string): string {
  const upper = s.replace(/[^A-Z]/g, "").length;
  const lower = s.replace(/[^a-z]/g, "").length;
  if (upper > lower * 2 || (lower > 0 && upper === 0 && s === s.toLowerCase())) {
    return s.toLowerCase().replace(/(?:^|\s|[-/])\w/g, (c) => c.toUpperCase());
  }
  return s;
}

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
  const brevity = Math.min(1, 4 / Math.max(1, nTokens.size));
  return recall * 0.7 + recall * brevity * 0.3;
}

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

// ── Search API calls ────────────────────────────────────────────────

async function searchUsda(query: string, page: number = 1): Promise<SearchResult[]> {
  const q = effectiveFoodSearchQuery(query);
  if (!q.trim()) return [];
  try {
    const res = await fetch(`/api/usda/search?q=${encodeURIComponent(q.trim())}&page=${page}`);
    const json = await res.json();
    if (!json.ok || !Array.isArray(json.hits)) return [];
    return json.hits.map((h: any) => {
      const per100g = {
        calories: h.calories ?? 0,
        protein: h.protein ?? 0,
        carbs: h.carbs ?? 0,
        fat: h.fat ?? 0,
      };
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
        );
      return {
        key: `usda-${h.fdcId}`,
        name: titleCase(h.description ?? "Unknown"),
        calsPer100g: h.calories,
        macrosPer100g: h.calories != null ? { calories: h.calories, protein: h.protein ?? 0, carbs: h.carbs ?? 0, fat: h.fat ?? 0, fiberG: 0, sugarG: 0, sodiumMg: 0 } : undefined,
        verified: /foundation|sr legacy|survey/i.test(h.dataType ?? ""),
        primaryServing,
        _source: "USDA" as const,
        _fdcId: h.fdcId,
      };
    });
  } catch { return []; }
}

async function searchOff(query: string, page: number = 1): Promise<SearchResult[]> {
  const q = effectiveFoodSearchQuery(query);
  if (!q.trim()) return [];
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q.trim())}&search_simple=1&action=process&json=1&page_size=10&page=${page}&fields=code,product_name,brands,nutriments,serving_size`,
    );
    const data = await res.json();
    if (!Array.isArray(data.products)) return [];
    return data.products
      .filter((p: any) => p.product_name && p.nutriments)
      .map((p: any) => {
        const n = p.nutriments ?? {};
        const brand = titleCase((p.brands ?? "").split(",")[0]?.trim() ?? "");
        const name = titleCase(p.product_name ?? "Unknown");
        const displayName = [brand, name].filter(Boolean).join(" · ");
        const cals = Math.round(n["energy-kcal_100g"] ?? 0);
        const macros = cals > 0
          ? {
              calories: cals,
              protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
              carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
              fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
              fiberG: Math.round((n.fiber_100g ?? 0) * 10) / 10,
              sugarG: Math.round((n["sugars_100g"] ?? 0) * 10) / 10,
              sodiumMg: Math.round((n.sodium_100g ?? 0) * 1000),
            }
          : undefined;
        const primaryServing = macros
          ? parseOffPrimaryServing(
              { calories: macros.calories, protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
              typeof p.serving_size === "string" ? p.serving_size : null,
            )
          : null;
        return {
          key: `off-${p.code}`,
          name: displayName,
          calsPer100g: cals,
          macrosPer100g: macros,
          primaryServing,
          _source: "OFF" as const,
          _offCode: p.code,
        };
      })
      .filter((r: SearchResult) => r.calsPer100g && r.calsPer100g > 0);
  } catch { return []; }
}

/**
 * Search Edamam (restaurant + branded foods) via our auth-gated API route.
 * Mirrors the mobile `searchEdamam` helper — same `/api/edamam/search`
 * envelope, same UnifiedSearchResult-shaped output. TestFlight
 * `AOI9xgY88Dx-uphiXI8IzEk` (2026-04-18). Empty on network / server /
 * rate-limit errors so it never blocks USDA / OFF from rendering.
 */
async function searchEdamam(query: string, page: number = 1): Promise<SearchResult[]> {
  const q = effectiveFoodSearchQuery(query);
  if (!q.trim()) return [];
  try {
    const res = await fetch(`/api/edamam/search?q=${encodeURIComponent(q.trim())}&page=${page}`);
    const json = await res.json();
    if (!json.ok || !Array.isArray(json.hits)) return [];
    return (json.hits as Array<{
      foodId: string; label: string; brand: string | null;
      category: string; categoryLabel: string; imageUrl: string | null;
      calories: number; protein: number; carbs: number; fat: number;
      fiberG: number; sugarG: number; sodiumMg: number;
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

async function fetchUsdaDetail(fdcId: number): Promise<{ macrosPer100g: MacrosPer100g; portions: FoodPortion[] } | null> {
  try {
    const res = await fetch(`/api/usda/food?fdcId=${fdcId}`);
    const json = await res.json();
    if (!json.ok) return null;
    return { macrosPer100g: json.macrosPer100g, portions: Array.isArray(json.portions) ? json.portions : [] };
  } catch { return null; }
}

/** Find the best matching portion for the original recipe unit, returning portion + quantity */
function resolveInitialPortion(
  portions: FoodPortion[],
  amount: number | string | null | undefined,
  unit: string | null | undefined,
): { portion: FoodPortion; quantity: number } {
  const rawAmt = typeof amount === "string" ? parseFloat(amount) : amount;
  const amt = rawAmt != null && rawAmt > 0 ? rawAmt : 1;
  const u = (unit ?? "").trim().toLowerCase();

  if (!u) {
    const gPortion = portions.find((p) => p.label === "g");
    return { portion: gPortion ?? portions[0], quantity: amt > 10 ? amt : 100 };
  }

  const UNIT_TO_LABEL: Record<string, string[]> = {
    g: ["g"], gram: ["g"], grams: ["g"],
    oz: ["oz"], ounce: ["oz"], ounces: ["oz"],
    lb: ["lb"], pound: ["lb"], pounds: ["lb"],
    cup: ["cup"], cups: ["cup"],
    tbsp: ["tbsp"], tablespoon: ["tbsp"], tablespoons: ["tbsp"],
    tsp: ["tsp"], teaspoon: ["tsp"], teaspoons: ["tsp"],
    ml: ["ml"],
    "fl oz": ["fl oz"],
    kg: ["g"],
  };

  const labels = UNIT_TO_LABEL[u];
  if (labels) {
    for (const label of labels) {
      const match = portions.find((p) => p.label.toLowerCase() === label);
      if (match) {
        const qty = u === "kg" ? amt * 1000 : amt;
        return { portion: match, quantity: qty };
      }
    }
  }

  const directMatch = portions.find((p) => p.label.toLowerCase() === u);
  if (directMatch) return { portion: directMatch, quantity: amt };

  const UNIT_GRAMS: Record<string, number> = {
    lb: 453.6, pound: 453.6, pounds: 453.6,
    oz: 28.35, ounce: 28.35, ounces: 28.35, kg: 1000,
    cup: 236.59, cups: 236.59, tbsp: 14.79, tsp: 4.93, ml: 1, "fl oz": 29.57,
    breast: 200, thigh: 120, drumstick: 90, wing: 40, fillet: 170,
    chop: 150, steak: 225, leg: 250,
    medium: 110, large: 180, small: 80,
    slice: 25, rasher: 28, clove: 4, tin: 400, can: 400,
  };
  const gPerUnit = UNIT_GRAMS[u];
  if (gPerUnit) {
    const gPortion = portions.find((p) => p.label === "g");
    if (gPortion) return { portion: gPortion, quantity: Math.round(amt * gPerUnit) };
  }

  return { portion: portions[0], quantity: amt };
}

// ── Component ───────────────────────────────────────────────────────

/**
 * Project a custom food into the same `SearchResult` shape USDA/OFF use so
 * rendering stays uniform. The `_source` discriminator lets the row
 * render a "Custom" badge and show the edit/delete overflow menu.
 *
 * `primaryServing` is populated from the food's first saved serving via
 * `customFoodToPrimaryServing` so custom-food rows render with the same
 * natural-portion primary line A2 gave Pret sandwiches (e.g. "Homemade
 * granola · 120 kcal · 1 slice (30 g)"). Falls back to `null` when the
 * food has no natural serving — existing /100g-only display unchanged.
 * TestFlight `AE52_fIRZ-ZIupmoJ8T4yaI` (fix B + A2 integration).
 */
function customFoodToSearchResult(food: CustomFood): SearchResult {
  const macrosPer100g = customFoodToMacrosPer100g(food);
  const displayName = food.brand ? `${food.name} · ${food.brand}` : food.name;
  const primaryServing = customFoodToPrimaryServing(food);
  return {
    key: `custom-${food.id}`,
    name: displayName,
    calsPer100g: macrosPer100g.calories,
    macrosPer100g,
    verified: false,
    primaryServing: primaryServing ?? null,
    _source: "CUSTOM",
    _custom: food,
  };
}

export function FoodSearch({ open, onClose, onSelect, initialQuery = "", initialAmount, initialUnit, originalDescription, macroTargets, macroConsumed, supabase, userId }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** 1-indexed page counter for infinite scroll — F-10
   *  (`AHnI_fIc7SKbaRcdd5SZB9Q`, 2026-04-19). Reset on every new query;
   *  incremented when the scroll sentinel enters the viewport. Paired
   *  with `hasMoreRef` so we stop fetching once a page returns zero
   *  new external rows. */
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    name: string;
    source: "USDA" | "OFF" | "CUSTOM";
    macrosPer100g: MacrosPer100g;
    portions: FoodPortion[];
    chosenPortion: FoodPortion;
    quantity: number;
    customFoodId?: string;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backfillRef = useRef(0);
  // Custom foods (Batch 3.9 wire-up) — only active when supabase+userId provided.
  const customEnabled = Boolean(supabase && userId);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<CustomFood | undefined>(undefined);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  // Themed destructive-confirm dialog for Custom food delete
  // (audit M7, 2026-04-18). Replaces the prior `window.confirm`.
  const [deleteCandidate, setDeleteCandidate] = useState<CustomFood | null>(null);

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

  // Pull the user's full custom-food library on demand. We don't memoise
  // the rows into local state because the rendered list is rebuilt from
  // search results; instead we hand the snapshot back to the caller.
  const refreshCustomLibrary = useCallback(async () => {
    if (!customEnabled || !supabase || !userId) return [] as CustomFood[];
    return await listCustomFoods(
      supabase as Parameters<typeof listCustomFoods>[0],
      userId,
    );
  }, [customEnabled, supabase, userId]);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setResults([]);
      setPreview(null);
      setMenuOpenFor(null);
      backfillRef.current++;
      pageRef.current = 1;
      hasMoreRef.current = true;
      // Load the custom library whenever the modal opens so the "+ Create
      // custom food" row + any zero-query browsing is immediate.
      if (customEnabled) void refreshCustomLibrary();
      if (initialQuery.trim()) {
        setLoading(true);
        const customPromise: Promise<CustomFood[]> = customEnabled && supabase && userId
          ? searchCustomFoods(
              supabase as Parameters<typeof searchCustomFoods>[0],
              userId,
              initialQuery,
            )
          : Promise.resolve([] as CustomFood[]);
        Promise.all([
          searchUsda(initialQuery, 1),
          searchOff(initialQuery, 1),
          searchEdamam(initialQuery, 1),
          customPromise,
        ]).then(([usda, off, edamam, custom]) => {
          const rankQ = effectiveFoodSearchQuery(initialQuery);
          const merged = mergeAndDedup(rankQ, usda, off, edamam, custom);
          setResults(merged);
          setLoading(false);
          hasMoreRef.current = usda.length + off.length + edamam.length > 0;
          backfillMissingMacros(merged);
        });
      }
    }
  }, [open, initialQuery, backfillMissingMacros, customEnabled, refreshCustomLibrary, supabase, userId]);

  const onChangeQuery = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    backfillRef.current++;
    pageRef.current = 1;
    hasMoreRef.current = true;
    setMenuOpenFor(null);
    const q = text.trim();
    if (!q) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const rankQ = effectiveFoodSearchQuery(q);
      const customPromise: Promise<CustomFood[]> = customEnabled && supabase && userId
        ? searchCustomFoods(
            supabase as Parameters<typeof searchCustomFoods>[0],
            userId,
            q,
          )
        : Promise.resolve([] as CustomFood[]);
      const [usda, off, edamam, custom] = await Promise.all([
        searchUsda(q, 1),
        searchOff(q, 1),
        searchEdamam(q, 1),
        customPromise,
      ]);
      const merged = mergeAndDedup(rankQ, usda, off, edamam, custom);
      setResults(merged);
      setLoading(false);
      hasMoreRef.current = usda.length + off.length + edamam.length > 0;
      backfillMissingMacros(merged);
    }, 400);
  }, [backfillMissingMacros, customEnabled, supabase, userId]);

  function mergeAndDedup(
    q: string,
    usda: SearchResult[],
    off: SearchResult[],
    edamam: SearchResult[] = [],
    customs: CustomFood[] = [],
    limit: number = 25,
  ): SearchResult[] {
    // Custom foods always surface first, ranked by the same relevance
    // scorer so tapping a search also ordered by name match — never by
    // database insertion order.
    const customResults = customs
      .map((c) => ({ ...customFoodToSearchResult(c), _rel: searchRelevance(q, c.name) }))
      .sort((a, b) => b._rel - a._rel);
    const external = [...usda, ...off, ...edamam]
      .map((r) => ({ ...r, _rel: searchRelevance(q, r.name) }))
      .sort((a, b) => b._rel - a._rel);
    const seen = new Set<string>();
    const deduped: SearchResult[] = [];
    for (const r of [...customResults, ...external]) {
      // Don't collapse custom rows into USDA/OFF/Edamam rows even when names
      // collide — the user explicitly saved the custom version.
      const norm = r._source === "CUSTOM"
        ? `custom:${r._custom?.id ?? r.key}`
        : r.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(norm)) continue;
      seen.add(norm);
      deduped.push(r);
      if (deduped.length >= limit) break;
    }
    return deduped;
  }

  /** Append a freshly-fetched page of external results onto the existing
   *  list, dropping any row whose key OR normalised name collides. Custom
   *  rows are preserved in place (pagination only extends the external
   *  tail). F-10 (`AHnI_fIc7SKbaRcdd5SZB9Q`, 2026-04-19). */
  const appendPage = useCallback(
    (prev: SearchResult[], next: SearchResult[]): SearchResult[] => {
      const seenKeys = new Set<string>(prev.map((r) => r.key));
      const seenNames = new Set<string>(
        prev
          .filter((r) => r._source !== "CUSTOM")
          .map((r) => r.name.toLowerCase().replace(/[^a-z0-9]/g, "")),
      );
      const fresh: SearchResult[] = [];
      for (const r of next) {
        if (seenKeys.has(r.key)) continue;
        const norm = r.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seenNames.has(norm)) continue;
        seenKeys.add(r.key);
        seenNames.add(norm);
        fresh.push(r);
      }
      return [...prev, ...fresh];
    },
    [],
  );

  /** Fetch the next page of USDA + OFF + Edamam and append to results.
   *  Concurrent-safe via `loadingMore` flag and `hasMoreRef` terminal
   *  latch. Custom-food rows are page-invariant so they're excluded
   *  from the paginated fetch entirely. F-10. */
  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    if (!hasMoreRef.current) return;
    const q = query.trim();
    if (!q) return;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    try {
      const [usda, off, edamam] = await Promise.all([
        searchUsda(q, nextPage),
        searchOff(q, nextPage),
        searchEdamam(q, nextPage),
      ]);
      if (usda.length + off.length + edamam.length === 0) {
        hasMoreRef.current = false;
        return;
      }
      const rankQ = effectiveFoodSearchQuery(q);
      // Re-use the same ranker + dedup inside the page's own bucket so
      // the new rows stay ordered by relevance before we splice them on.
      const pageMerged = mergeAndDedup(rankQ, usda, off, edamam, [], 50);
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
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, query, appendPage, backfillMissingMacros]);

  /**
   * Opens the portion picker for a custom food. Uses its saved servings as
   * the chip list; default selection is the first saved serving (so a
   * single tap-to-log is possible) falling back to grams.
   */
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

  const onPickResult = useCallback(async (item: SearchResult) => {
    setLoadingKey(item.key);
    if (item._source === "CUSTOM" && item._custom) {
      setLoadingKey(null);
      openCustomFoodPreview(item._custom);
      return;
    }
    if (item._source === "USDA" && item._fdcId) {
      const detail = await fetchUsdaDetail(item._fdcId);
      setLoadingKey(null);
      if (!detail) return;
      const portions = buildPortions(detail.portions, item.primaryServing);
      // Default to natural portion when present — TestFlight
      // `APo0qS9vcFvmBJEJJ_-61YA` (2026-04-19). Otherwise honour the
      // recipe-hint resolution used elsewhere in the codebase.
      const { portion, quantity } = item.primaryServing
        ? { portion: portions[0], quantity: 1 }
        : resolveInitialPortion(portions, initialAmount, initialUnit);
      setPreview({ name: item.name, source: "USDA", macrosPer100g: detail.macrosPer100g, portions, chosenPortion: portion, quantity });
    } else if (item._source === "OFF" && item.macrosPer100g) {
      setLoadingKey(null);
      const portions = buildPortions([], item.primaryServing);
      const { portion, quantity } = item.primaryServing
        ? { portion: portions[0], quantity: 1 }
        : resolveInitialPortion(portions, initialAmount, initialUnit);
      setPreview({ name: item.name, source: "OFF", macrosPer100g: item.macrosPer100g, portions, chosenPortion: portion, quantity });
    } else if (item._source === "Edamam" && item.macrosPer100g) {
      // Edamam (restaurant + branded foods) — TestFlight `AOI9xgY88Dx-uphiXI8IzEk`,
      // 2026-04-18. Macros come back per-100 g already inline so the tap
      // path mirrors OFF — no extra fetch. The OFF preview source value
      // is reused so the existing log path doesn't need a new branch.
      setLoadingKey(null);
      const portions = buildPortions([], item.primaryServing);
      const { portion, quantity } = item.primaryServing
        ? { portion: portions[0], quantity: 1 }
        : resolveInitialPortion(portions, initialAmount, initialUnit);
      setPreview({ name: item.name, source: "OFF", macrosPer100g: item.macrosPer100g, portions, chosenPortion: portion, quantity });
    } else {
      setLoadingKey(null);
    }
  }, [initialAmount, initialUnit, openCustomFoodPreview]);

  // Custom-food CRUD handlers ──────────────────────────────────────────
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
      // Auto-select: drop the user straight into the portion picker so
      // they can log the food they just created without a second tap.
      setEditingFood(undefined);
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
      // If we were previewing this food, refresh the preview so stale
      // macros can't leak to the log.
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
    },
    [customEnabled, supabase, userId, editingFood, refreshCustomLibrary],
  );

  // Opens the themed destructive-confirm dialog (audit M7,
  // 2026-04-18). The actual delete lives in `commitDeleteCustomFood`
  // and is invoked by the dialog's confirm action.
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

  function buildPortions(
    apiPortions: FoodPortion[],
    primary?: PrimaryServing | null,
  ): FoodPortion[] {
    const seen = new Set<string>();
    const result: FoodPortion[] = [];
    // Primary (natural) portion first — TestFlight `APo0qS9vcFvmBJEJJ_-61YA`.
    if (primary) {
      const chip = primaryServingToPortionChip(primary);
      seen.add(chip.label.toLowerCase());
      result.push(chip);
    }
    for (const u of STANDARD_UNITS) {
      const key = u.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(u);
    }
    for (const p of apiPortions) {
      const key = p.label.toLowerCase().trim();
      if (!seen.has(key) && key !== "100 g") { seen.add(key); result.push(p); }
    }
    return result;
  }

  const onConfirm = useCallback(() => {
    if (!preview) return;
    const selection: FoodSearchSelection = {
      name: preview.name,
      source: preview.source,
      macrosPer100g: preview.macrosPer100g,
      portions: preview.portions,
      chosenPortion: preview.chosenPortion,
      quantity: preview.quantity,
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
    onClose();
  }, [preview, onSelect, onClose]);

  const scaled = useMemo(() => {
    if (!preview) return null;
    return scaleMacros(preview.macrosPer100g, preview.chosenPortion.gramWeight * preview.quantity);
  }, [preview]);

  const totalGrams = preview ? Math.round(preview.chosenPortion.gramWeight * preview.quantity * 10) / 10 : 0;

  // Fit-this-in hint — only when both budget context and a scaled portion exist.
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

  /**
   * Fire `fit_this_in_previewed` once per distinct `(food, quantity, unit)`
   * preview. The ref-keyed guard is what stops event spam when the user
   * holds an increment button or drags a slider: the effect still runs on
   * every render, but `track()` only fires when the tuple has actually
   * changed. Resetting the key when `preview` clears means re-opening the
   * same food in the same modal instance re-emits once, which is the
   * desired behaviour.
   */
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

  /** Infinite-scroll sentinel. An IntersectionObserver watches the div
   *  rendered at the tail of the results list; when it enters the
   *  viewport, `loadMore` fetches the next page. Re-created whenever
   *  the dialog opens / closes or the results length changes so the
   *  observer always targets the current sentinel node. F-10
   *  (`AHnI_fIc7SKbaRcdd5SZB9Q`, 2026-04-19). */
  useEffect(() => {
    if (!open) return;
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
  }, [open, preview, results.length, loadMore]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Search Foods</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="px-6 pb-3">
          <div className="relative">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => onChangeQuery(e.target.value)}
              placeholder="Search foods..."
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        {/* Results or Preview */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {preview && scaled ? (
            <div className="space-y-4">
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
                      {p.gramWeight !== 1 && <span className="block text-[10px] text-muted-foreground">{p.gramWeight}g</span>}
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
                  <span className="text-sm text-muted-foreground">= {totalGrams}g</span>
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
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

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

              <button
                onClick={onConfirm}
                className="w-full py-3 rounded-xl bg-success text-white font-semibold hover:bg-success/90 transition-colors flex items-center justify-center gap-2"
              >
                <Icons.check className="h-4 w-4" />
                Use this
              </button>
            </div>
          ) : (
            <>
              {loading && results.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              {results.length > 0 && (
                <div className="divide-y divide-border">
                  {results.map((item) => {
                    const isCustom = item._source === "CUSTOM";
                    const customFood = isCustom ? item._custom : null;
                    return (
                      <div
                        key={item.key}
                        className="flex items-center gap-1 py-1 px-2 -mx-2 rounded-lg hover:bg-muted/60 transition-colors relative"
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
                            {item.primaryServing ? (
                              <>
                                <div className="flex gap-2 mt-0.5 text-[11px] text-muted-foreground">
                                  <span>{item.primaryServing.kcal} kcal</span>
                                  <span className="text-destructive">P:{item.primaryServing.protein}g</span>
                                  <span className="text-primary">C:{item.primaryServing.carbs}g</span>
                                  <span className="text-warning">F:{item.primaryServing.fat}g</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground/80">
                                  {item.primaryServing.label} ({item.primaryServing.grams} g)
                                  {item.calsPer100g != null && item.calsPer100g > 0
                                    ? ` · ${item.calsPer100g} kcal / 100 g`
                                    : ""}
                                </span>
                              </>
                            ) : item.macrosPer100g ? (
                              <>
                                <div className="flex gap-2 mt-0.5 text-[11px] text-muted-foreground">
                                  <span>{item.macrosPer100g.calories} kcal</span>
                                  <span className="text-destructive">P:{item.macrosPer100g.protein}g</span>
                                  <span className="text-primary">C:{item.macrosPer100g.carbs}g</span>
                                  <span className="text-warning">F:{item.macrosPer100g.fat}g</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground/80">per 100 g</span>
                              </>
                            ) : item.calsPer100g != null && item.calsPer100g > 0 ? (
                              <span className="text-[11px] text-muted-foreground">{item.calsPer100g} kcal per 100g</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Tap for nutrition info</span>
                            )}
                          </div>
                          {item.primaryServing ? (
                            <span className="text-sm font-bold text-foreground tabular-nums">{item.primaryServing.kcal}</span>
                          ) : item.calsPer100g != null && item.calsPer100g > 0 && loadingKey !== item.key ? (
                            <span className="text-sm font-bold text-foreground tabular-nums">{item.calsPer100g}</span>
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
                                  onClick={() => void handleDeleteCustomFood(customFood)}
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
              )}

              {/* Infinite-scroll sentinel + footer spinner — F-10
                  (`AHnI_fIc7SKbaRcdd5SZB9Q`, 2026-04-19). The ref is
                  observed by an IntersectionObserver above; when
                  visible, `loadMore` fetches the next page. Kept
                  inside the scroll container so entry into the
                  viewport corresponds to the user reaching the bottom
                  of the results list. */}
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
                <p className="text-sm text-muted-foreground text-center py-8">
                  No results for &quot;{query}&quot;.
                  {customEnabled ? " Can't find it? Create your own." : " Try a simpler term."}
                </p>
              )}

              {/* Persistent "+ Create custom food" entry point. Always visible
                  when custom foods are enabled — matches the audit's
                  discoverability requirement without hiding it behind an
                  empty-state branch. */}
              {customEnabled && !preview && (
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
            </>
          )}
        </div>

        {/* Custom food create/edit dialog. Rendered outside the results
            list so it's unaffected by FoodSearch close/reopen cycles. */}
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
        {/* Destructive-confirm dialog for Custom food delete
            (audit M7, 2026-04-18). Replaces the native
            `window.confirm` — themed, focus-trapped, screen-reader
            friendly. */}
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
      </DialogContent>
    </Dialog>
  );
}
