import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  searchFoods,
  getFoodMacros,
  scaleMacros,
  type UnifiedSearchResult,
  type FoodPortion,
} from "@/lib/verifyRecipe";
import {
  primaryServingToPortionChip,
  type PrimaryServing,
} from "../../../src/lib/nutrition/primaryServing";
import {
  projectRemaining,
  type MacroConsumed,
  type MacroTargets,
} from "../../../src/lib/nutrition/remainingMacros";
import {
  createCustomFood,
  deleteCustomFood,
  listCustomFoods,
  searchCustomFoods,
  updateCustomFood,
} from "../../../src/lib/nutrition/customFoodsClient";
import {
  buildCustomFoodPortions,
  customFoodToMacrosPer100g,
  type CustomFood,
} from "../../../src/lib/nutrition/customFoods";
import CreateCustomFoodSheet, {
  type CreateCustomFoodPayload,
} from "./CreateCustomFoodSheet";
import Badge from "./Badge";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";

/** Standard units always available regardless of data source */
const STANDARD_UNITS: FoodPortion[] = [
  { label: "g", gramWeight: 1, amount: 1 },
  { label: "oz", gramWeight: 28.35, amount: 1 },
  { label: "lb", gramWeight: 453.59, amount: 1 },
  { label: "tbsp", gramWeight: 14.79, amount: 1 },
  { label: "tsp", gramWeight: 4.93, amount: 1 },
  { label: "cup", gramWeight: 236.59, amount: 1 },
  { label: "ml", gramWeight: 1, amount: 1 },
];

type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

export type SelectedFood = {
  name: string;
  source: "USDA" | "OFF" | "CUSTOM";
  macrosPer100g: Macros;
  portions: FoodPortion[];
  chosenPortion: FoodPortion;
  quantity: number;
  fdcId?: number;
  barcode?: string;
  /** Present when the user selected one of their own custom foods. */
  customFoodId?: string;
  /** Non-gram named serving label chosen from the custom food's saved chips. */
  servingLabel?: string;
};

type SupabaseLike = { from: (table: string) => unknown };

/** Local superset of UnifiedSearchResult that allows a CUSTOM source.
 *  We don't widen the shared type because verifyRecipe.ts lives under
 *  src/lib and other call sites assume only USDA/OFF results. */
type SearchRow = Omit<UnifiedSearchResult, "_source"> & {
  _source: "USDA" | "OFF" | "CUSTOM" | "Edamam";
  _custom?: CustomFood;
};

type Props = {
  visible: boolean;
  initialQuery: string;
  /** Original recipe amount (e.g. 2 for "2 chicken breasts") */
  initialAmount?: number | null;
  /** Original recipe unit (e.g. "lb", "cup", "g") */
  initialUnit?: string | null;
  /** Original ingredient description shown as context (e.g. "1 lb chicken breast") */
  originalDescription?: string | null;
  /**
   * Optional daily budget context. When provided together with `macroConsumed`,
   * the portion preview shows a fit-this-in hint:
   * "If you log this: N kcal / P / C / F left" using the shared
   * remainingMacros helper. Omit in verify-ingredient flows where there
   * is no tracker budget context.
   */
  macroTargets?: MacroTargets;
  macroConsumed?: MacroConsumed;
  /**
   * Custom-foods wiring (Batch 3.9). When both `supabase` and `userId` are
   * provided, the modal lists the user's custom foods at the top of results,
   * shows a "+ Create custom food" row, and exposes edit/delete via a
   * long-press action sheet. Omit to hide the feature entirely.
   */
  supabase?: SupabaseLike;
  userId?: string | null;
  onSelect: (result: SelectedFood) => void;
  onClose: () => void;
};

function buildPortionList(
  apiPortions: FoodPortion[],
  primary?: PrimaryServing | null,
): FoodPortion[] {
  const seen = new Set<string>();
  const result: FoodPortion[] = [];
  // Primary (natural) portion goes first so it's the visual + tap default.
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
    if (!seen.has(key) && key !== "100 g") {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

/** Find the best matching portion for the original recipe unit, returning portion + quantity */
function resolveInitialPortion(
  portions: FoodPortion[],
  amount: number | null | undefined,
  unit: string | null | undefined,
): { portion: FoodPortion; quantity: number } {
  const amt = amount != null && amount > 0 ? amount : 1;
  const u = (unit ?? "").trim().toLowerCase();

  if (!u) {
    // No unit — default to grams with the amount
    const gPortion = portions.find((p) => p.label === "g");
    return { portion: gPortion ?? portions[0], quantity: amt > 10 ? amt : 100 };
  }

  // Map common unit names to portion labels
  const UNIT_TO_LABEL: Record<string, string[]> = {
    g: ["g"],
    gram: ["g"], grams: ["g"],
    oz: ["oz"],
    ounce: ["oz"], ounces: ["oz"],
    lb: ["lb"],
    pound: ["lb"], pounds: ["lb"],
    cup: ["cup"], cups: ["cup"],
    tbsp: ["tbsp"], tablespoon: ["tbsp"], tablespoons: ["tbsp"],
    tsp: ["tsp"], teaspoon: ["tsp"], teaspoons: ["tsp"],
    ml: ["ml"],
    "fl oz": ["fl oz"],
    kg: ["g"], // convert kg → g with multiplied amount
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

  // Try matching portion labels directly (handles USDA-specific portions like "1 RACC")
  const directMatch = portions.find((p) => p.label.toLowerCase() === u);
  if (directMatch) {
    return { portion: directMatch, quantity: amt };
  }

  // Fallback: convert to grams using known weights
  const UNIT_GRAMS: Record<string, number> = {
    lb: 453.6, pound: 453.6, pounds: 453.6,
    oz: 28.35, ounce: 28.35, ounces: 28.35,
    kg: 1000,
    cup: 236.59, cups: 236.59,
    tbsp: 14.79, tablespoon: 14.79,
    tsp: 4.93, teaspoon: 4.93,
    ml: 1,
    "fl oz": 29.57,
    breast: 200, thigh: 120, drumstick: 90, wing: 40, fillet: 170,
    chop: 150, steak: 225, leg: 250,
    medium: 110, large: 180, small: 80,
    slice: 25, rasher: 28, clove: 4,
    tin: 400, can: 400,
  };

  const gPerUnit = UNIT_GRAMS[u];
  if (gPerUnit) {
    const gPortion = portions.find((p) => p.label === "g");
    if (gPortion) {
      return { portion: gPortion, quantity: Math.round(amt * gPerUnit) };
    }
  }

  // Last resort: use first portion with the amount
  return { portion: portions[0], quantity: amt };
}

/** Adapter that wraps the shared `customFoodToMacrosPer100g` helper into a
 *  SearchRow — mobile keeps the adapter local because it also attaches the
 *  `_custom` reference the long-press action-sheet needs. */
function customFoodToRow(food: CustomFood): SearchRow {
  const macrosPer100g = customFoodToMacrosPer100g(food);
  const displayName = food.brand ? `${food.name} · ${food.brand}` : food.name;
  return {
    key: `custom-${food.id}`,
    name: displayName,
    calsPer100g: macrosPer100g.calories,
    macrosPer100g,
    verified: false,
    _source: "CUSTOM",
    _custom: food,
  };
}

export default function FoodSearchModal({
  visible,
  initialQuery,
  initialAmount,
  initialUnit,
  originalDescription,
  macroTargets,
  macroConsumed,
  supabase,
  userId,
  onSelect,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    name: string;
    source: "USDA" | "OFF" | "CUSTOM";
    macrosPer100g: Macros;
    portions: FoodPortion[];
    chosenPortion: FoodPortion;
    quantity: number;
    quantityText: string;
    fdcId?: number;
    barcode?: string;
    customFoodId?: string;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backfillRef = useRef(0);

  // Custom foods (Batch 3.9) — only active when both supabase + userId provided.
  const customEnabled = Boolean(supabase && userId);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<CustomFood | undefined>(undefined);

  const refreshCustomLibrary = useCallback(async () => {
    if (!customEnabled || !supabase || !userId) return [] as CustomFood[];
    return await listCustomFoods(
      supabase as Parameters<typeof listCustomFoods>[0],
      userId,
    );
  }, [customEnabled, supabase, userId]);

  /** Fetch full macros for USDA results that are missing inline nutrients */
  const backfillMissingMacros = useCallback((items: SearchRow[]) => {
    const id = ++backfillRef.current;
    const missing = items
      .filter((r) => r._source === "USDA" && r._fdcId && !r.macrosPer100g && !(r.calsPer100g && r.calsPer100g > 0))
      .slice(0, 2); // Limit to avoid burning USDA API quota
    if (missing.length === 0) return;

    for (const item of missing) {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
      Promise.race([getFoodMacros(item._fdcId!), timeout])
        .then((detail) => {
          if (!detail || backfillRef.current !== id) return;
          setResults((prev) =>
            prev.map((r) =>
              r.key === item.key
                ? {
                    ...r,
                    macrosPer100g: detail.macrosPer100g,
                    calsPer100g: detail.macrosPer100g.calories,
                  }
                : r,
            ),
          );
        })
        .catch(() => {});
    }
  }, []);

  /** Merge custom-food matches at the top of USDA/OFF results. Custom
   *  rows are never de-duped against external rows — the user explicitly
   *  saved the custom version so we preserve that intent. */
  const mergeWithCustom = useCallback((external: UnifiedSearchResult[], customs: CustomFood[]): SearchRow[] => {
    const customRows: SearchRow[] = customs.map(customFoodToRow);
    const merged: SearchRow[] = [...customRows, ...(external as SearchRow[])];
    // Cap the combined list so a user with a huge library never pushes
    // USDA results entirely off-screen.
    return merged.slice(0, 30);
  }, []);

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setResults([]);
      setPreview(null);
      backfillRef.current++;
      if (customEnabled) void refreshCustomLibrary();
      if (initialQuery.trim()) {
        setLoading(true);
        const externalP = searchFoods(initialQuery, (partial) => {
          // While waiting for custom results, still show the external
          // partials so the modal doesn't appear frozen. Once customs
          // resolve we replace with the merged list below.
          setResults(partial as SearchRow[]);
        });
        const customP: Promise<CustomFood[]> = customEnabled && supabase && userId
          ? searchCustomFoods(
              supabase as Parameters<typeof searchCustomFoods>[0],
              userId,
              initialQuery,
            )
          : Promise.resolve([] as CustomFood[]);
        Promise.all([externalP, customP]).then(([r, customs]) => {
          const merged = mergeWithCustom(r, customs);
          setResults(merged);
          setLoading(false);
          backfillMissingMacros(merged);
        });
      }
    }
  }, [visible, initialQuery, backfillMissingMacros, customEnabled, refreshCustomLibrary, supabase, userId, mergeWithCustom]);

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    backfillRef.current++;
    const q = text.trim();
    if (!q) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const externalP = searchFoods(q, (partial) => setResults(partial as SearchRow[]));
      const customP: Promise<CustomFood[]> = customEnabled && supabase && userId
        ? searchCustomFoods(
            supabase as Parameters<typeof searchCustomFoods>[0],
            userId,
            q,
          )
        : Promise.resolve([] as CustomFood[]);
      const [r, customs] = await Promise.all([externalP, customP]);
      const merged = mergeWithCustom(r, customs);
      setResults(merged);
      setLoading(false);
      backfillMissingMacros(merged);
    }, 400);
  }, [backfillMissingMacros, customEnabled, supabase, userId, mergeWithCustom]);

  const onPickResult = useCallback(
    async (item: SearchRow) => {
      setLoadingKey(item.key);

      if (item._source === "USDA" && item._fdcId) {
        const result = await getFoodMacros(item._fdcId);
        setLoadingKey(null);
        if (!result) return;
        const allPortions = buildPortionList(result.portions, item.primaryServing);
        // Default to the natural portion when the source exposes one —
        // TestFlight `APo0qS9vcFvmBJEJJ_-61YA` (2026-04-19): MFP/LoseIt
        // parity. Otherwise fall back to the recipe-hint resolution.
        const { portion, quantity } = item.primaryServing
          ? { portion: allPortions[0], quantity: 1 }
          : resolveInitialPortion(allPortions, initialAmount, initialUnit);
        setPreview({
          name: item.name,
          source: "USDA",
          macrosPer100g: result.macrosPer100g,
          portions: allPortions,
          chosenPortion: portion,
          quantity,
          quantityText: String(quantity),
          fdcId: item._fdcId,
        });
      } else if (item._source === "OFF" && item.macrosPer100g) {
        setLoadingKey(null);
        const allPortions = buildPortionList([], item.primaryServing);
        const { portion, quantity } = item.primaryServing
          ? { portion: allPortions[0], quantity: 1 }
          : resolveInitialPortion(allPortions, initialAmount, initialUnit);
        setPreview({
          name: item.name,
          source: "OFF",
          macrosPer100g: item.macrosPer100g,
          portions: allPortions,
          chosenPortion: portion,
          quantity,
          quantityText: String(quantity),
          barcode: item._offCode,
        });
      } else if (item._source === "Edamam" && item.macrosPer100g) {
        // Edamam (restaurant + branded foods) — TestFlight `AOI9xgY88Dx-uphiXI8IzEk`,
        // 2026-04-18. Macros come back per-100 g already inline so the
        // tap path is the same shape as OFF — no extra fetch.
        setLoadingKey(null);
        const allPortions = buildPortionList([], item.primaryServing);
        const { portion, quantity } = item.primaryServing
          ? { portion: allPortions[0], quantity: 1 }
          : resolveInitialPortion(allPortions, initialAmount, initialUnit);
        setPreview({
          name: item.name,
          source: "OFF", // re-uses the OFF preview rendering path; full Edamam-branded UI is a follow-up
          macrosPer100g: item.macrosPer100g,
          portions: allPortions,
          chosenPortion: portion,
          quantity,
          quantityText: String(quantity),
        });
      } else if (item._source === "CUSTOM" && item._custom) {
        setLoadingKey(null);
        const food = item._custom;
        const macrosPer100g = customFoodToMacrosPer100g(food);
        const allPortions = buildCustomFoodPortions(food);
        // Prefer the first saved named serving so a single tap-to-log is
        // possible; fall back to grams only when the user hasn't saved
        // any servings yet.
        const firstNamed = allPortions.find((p) => p.label !== "g");
        const chosen = firstNamed ?? allPortions[0];
        const defaultQty = chosen.label === "g" ? (food.baseGrams > 0 ? food.baseGrams : 100) : 1;
        setPreview({
          name: item.name,
          source: "CUSTOM",
          macrosPer100g,
          portions: allPortions,
          chosenPortion: chosen,
          quantity: defaultQty,
          quantityText: String(defaultQty),
          customFoodId: food.id,
        });
      } else {
        setLoadingKey(null);
      }
    },
    [initialAmount, initialUnit],
  );

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
      setEditingFood(undefined);
      setCreateOpen(false);
      // Auto-select the newly created food so the user lands in the
      // portion picker and can log immediately.
      const allPortions = buildCustomFoodPortions(fresh);
      const firstNamed = allPortions.find((p) => p.label !== "g");
      const chosen = firstNamed ?? allPortions[0];
      const defaultQty = chosen.label === "g" ? (fresh.baseGrams > 0 ? fresh.baseGrams : 100) : 1;
      setPreview({
        name: fresh.brand ? `${fresh.name} · ${fresh.brand}` : fresh.name,
        source: "CUSTOM",
        macrosPer100g: customFoodToMacrosPer100g(fresh),
        portions: allPortions,
        chosenPortion: chosen,
        quantity: defaultQty,
        quantityText: String(defaultQty),
        customFoodId: fresh.id,
      });
    },
    [customEnabled, supabase, userId, refreshCustomLibrary],
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
    },
    [customEnabled, supabase, userId, editingFood, refreshCustomLibrary],
  );

  const confirmAndDeleteCustomFood = useCallback(
    async (food: CustomFood) => {
      if (!customEnabled || !supabase || !userId) return;
      try {
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
        setResults((prev) =>
          prev.filter((r) => !(r._source === "CUSTOM" && r._custom?.id === food.id)),
        );
        setPreview((prev) => (prev && prev.customFoodId === food.id ? null : prev));
        await refreshCustomLibrary();
      } catch {
        Alert.alert("Couldn't delete", "Please try again.");
      }
    },
    [customEnabled, supabase, userId, refreshCustomLibrary],
  );

  /** Long-press on a custom-food row surfaces edit / delete. Matches
   *  web's overflow menu using the native alert idiom. */
  const openCustomFoodActions = useCallback(
    (food: CustomFood) => {
      Alert.alert(food.name, food.brand ? `Brand: ${food.brand}` : undefined, [
        {
          text: "Edit",
          onPress: () => {
            setEditingFood(food);
            setCreateOpen(true);
          },
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            Alert.alert(`Delete "${food.name}"?`, "This can't be undone.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => void confirmAndDeleteCustomFood(food),
              },
            ]),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [confirmAndDeleteCustomFood],
  );

  const parseQuantityText = useCallback((text: string): number => {
    const t = text.trim();
    if (!t) return 0;
    const fracMatch = t.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fracMatch) {
      const num = parseInt(fracMatch[1], 10);
      const den = parseInt(fracMatch[2], 10);
      if (den > 0) return num / den;
    }
    const mixedMatch = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixedMatch) {
      const whole = parseInt(mixedMatch[1], 10);
      const num = parseInt(mixedMatch[2], 10);
      const den = parseInt(mixedMatch[3], 10);
      if (den > 0) return whole + num / den;
    }
    const n = parseFloat(t);
    return isNaN(n) ? 0 : n;
  }, []);

  const onQuantityTextChange = useCallback((text: string) => {
    const num = parseQuantityText(text);
    setPreview((p) => p ? { ...p, quantityText: text, quantity: Math.max(0, num) } : p);
  }, [parseQuantityText]);

  const onConfirmPreview = useCallback(() => {
    if (preview) {
      const servingLabel =
        preview.source === "CUSTOM" &&
        preview.chosenPortion.label !== "g" &&
        preview.chosenPortion.label !== "ml"
          ? preview.chosenPortion.label
          : undefined;
      if (preview.source === "CUSTOM") {
        try {
          const grams = Math.round(preview.chosenPortion.gramWeight * preview.quantity * 10) / 10;
          const evt: Record<string, unknown> = { grams };
          if (servingLabel) evt.servingLabel = servingLabel;
          track(AnalyticsEvents.custom_food_logged, evt);
        } catch {
          // Analytics must never block a log.
        }
      }
      // L6 G1 (2026-04-18) — `food_logged` is fired by the HOST of
      // this modal (Today's onSelect, see `apps/mobile/app/(tabs)/index.tsx`)
      // because verify flows (`recipe/verify.tsx`, `create-recipe.tsx`)
      // also mount this modal and must NOT emit `food_logged`. The
      // `source` the host emits is `"custom_food"` iff
      // `selection.source === "CUSTOM"`, else `"manual"`.
      onSelect({
        name: preview.name,
        source: preview.source,
        macrosPer100g: preview.macrosPer100g,
        portions: preview.portions,
        chosenPortion: preview.chosenPortion,
        quantity: preview.quantity,
        fdcId: preview.fdcId,
        barcode: preview.barcode,
        ...(preview.customFoodId ? { customFoodId: preview.customFoodId } : {}),
        ...(servingLabel ? { servingLabel } : {}),
      });
      setPreview(null);
    }
  }, [preview, onSelect]);

  const previewMacros = useMemo(() => {
    if (!preview) return null;
    const grams = preview.chosenPortion.gramWeight * preview.quantity;
    return scaleMacros(preview.macrosPer100g, grams);
  }, [preview]);

  const totalGrams = useMemo(() => {
    if (!preview) return 0;
    return Math.round(preview.chosenPortion.gramWeight * preview.quantity * 10) / 10;
  }, [preview]);

  /**
   * "If you log this" — fit-this-in projection. Null unless caller
   * provided both daily targets and today's running totals AND we have
   * scaled macros to project. Over-budget → destructive colour + "over".
   */
  const fitHint = useMemo(() => {
    if (!macroTargets || !macroConsumed || !previewMacros) return null;
    return projectRemaining(macroTargets, macroConsumed, {
      calories: previewMacros.calories,
      protein: previewMacros.protein,
      carbs: previewMacros.carbs,
      fat: previewMacros.fat,
      fiber: previewMacros.fiberG,
    });
  }, [macroTargets, macroConsumed, previewMacros]);

  /**
   * Fire `fit_this_in_previewed` once per distinct `(food, quantity,
   * unit)` preview — keyed on name + quantity + portion label so slider
   * drags and stepper holds don't spam PostHog. Cleared when the preview
   * closes so re-opening the same food re-emits exactly once.
   */
  const lastFitKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!preview || !fitHint || !previewMacros) {
      lastFitKeyRef.current = null;
      return;
    }
    const key = `${preview.name}|${preview.quantity}|${preview.chosenPortion.label}`;
    if (lastFitKeyRef.current === key) return;
    lastFitKeyRef.current = key;
    track(AnalyticsEvents.fit_this_in_previewed, {
      overCalories: fitHint.overCalories,
      kcalDelta: previewMacros.calories,
    });
  }, [preview, fitHint, previewMacros]);

  const renderItem = useCallback(
    ({ item }: { item: SearchRow }) => {
      const isLoading = loadingKey === item.key;
      const hasMacros = item.macrosPer100g && item.macrosPer100g.calories > 0;
      const cals = item.calsPer100g ?? item.macrosPer100g?.calories;
      const isCustom = item._source === "CUSTOM";
      const customFood = isCustom ? item._custom : null;
      const primary = item.primaryServing ?? null;

      return (
        <Pressable
          style={styles.resultRow}
          onPress={() => onPickResult(item)}
          onLongPress={isCustom && customFood ? () => openCustomFoodActions(customFood) : undefined}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={
            isCustom
              ? `Custom food: ${item.name}. Long-press for edit or delete.`
              : primary
                ? `${item.name}. ${primary.kcal} kcal per ${primary.label}, ${primary.grams} grams.`
                : item.name
          }
        >
          {item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={styles.productImage} />
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {isCustom && <Badge variant="custom">Custom</Badge>}
              {item.verified && !isCustom && (
                <Ionicons name="checkmark-circle" size={14} color={Accent.success} />
              )}
              <Text style={styles.resultName} numberOfLines={2}>
                {item.name}
              </Text>
            </View>
            {primary ? (
              <>
                <View style={styles.macroPreview}>
                  <Text style={styles.macroPreviewText}>{primary.kcal} kcal</Text>
                  <Text style={[styles.macroPreviewText, { color: MacroColors.protein }]}>P:{primary.protein}g</Text>
                  <Text style={[styles.macroPreviewText, { color: MacroColors.carbs }]}>C:{primary.carbs}g</Text>
                  <Text style={[styles.macroPreviewText, { color: MacroColors.fat }]}>F:{primary.fat}g</Text>
                </View>
                <Text style={styles.per100g}>
                  {primary.label} ({primary.grams} g)
                  {cals != null && cals > 0 ? ` · ${cals} kcal / 100 g` : ""}
                </Text>
              </>
            ) : hasMacros ? (
              <>
                <View style={styles.macroPreview}>
                  <Text style={styles.macroPreviewText}>{item.macrosPer100g!.calories} kcal</Text>
                  <Text style={[styles.macroPreviewText, { color: MacroColors.protein }]}>P:{item.macrosPer100g!.protein}g</Text>
                  <Text style={[styles.macroPreviewText, { color: MacroColors.carbs }]}>C:{item.macrosPer100g!.carbs}g</Text>
                  <Text style={[styles.macroPreviewText, { color: MacroColors.fat }]}>F:{item.macrosPer100g!.fat}g</Text>
                </View>
                <Text style={styles.per100g}>per 100g</Text>
              </>
            ) : cals != null && cals > 0 ? (
              <>
                <Text style={styles.macroPreviewText}>{cals} kcal</Text>
                <Text style={styles.per100g}>per 100g</Text>
              </>
            ) : (
              <Text style={styles.per100g}>Tap for nutrition info</Text>
            )}
          </View>
          {primary ? (
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"], marginRight: 4 }}>{primary.kcal}</Text>
          ) : cals != null && cals > 0 && !isLoading ? (
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"], marginRight: 4 }}>{cals}</Text>
          ) : null}
          {isLoading ? (
            <ActivityIndicator size="small" color={Accent.primary} />
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          )}
        </Pressable>
      );
    },
    [loadingKey, onPickResult, colors, openCustomFoodActions],
  );

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.md,
    },
    title: { fontSize: 18, fontWeight: "700", color: colors.text },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: Spacing.xl,
      backgroundColor: colors.card,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
    },
    searchIcon: { marginRight: Spacing.sm },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      paddingVertical: 14,
    },
    centered: { alignItems: "center", paddingTop: 60, gap: Spacing.md },
    hint: { color: colors.textSecondary, fontSize: 14 },
    list: { paddingHorizontal: Spacing.xl, paddingBottom: 40 },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: Spacing.md,
    },
    productImage: {
      width: 40,
      height: 40,
      borderRadius: Radius.sm,
      backgroundColor: colors.card,
    },
    resultName: { fontSize: 14, color: colors.text, fontWeight: "500" },
    macroPreview: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: 4,
    },
    macroPreviewText: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
    per100g: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      paddingTop: 40,
    },
  }), [colors]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Search Foods</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={onChangeText}
            placeholder="Search foods..."
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {/* Preview card */}
        {preview && previewMacros && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{
              backgroundColor: colors.card, borderRadius: Radius.lg,
              borderWidth: 1, borderColor: Accent.success + "40",
              padding: Spacing.xl, gap: Spacing.md,
            }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{preview.name}</Text>

              {originalDescription ? (
                <Text style={{ fontSize: 13, fontStyle: "italic", color: colors.textSecondary }}>
                  Recipe calls for: {originalDescription}
                </Text>
              ) : null}

              {/* Serving size */}
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1 }}>
                SERVING SIZE
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: Spacing.sm }}
                keyboardShouldPersistTaps="handled"
              >
                {preview.portions.map((p, idx) => {
                  const isActive = preview.chosenPortion.label === p.label;
                  return (
                    <Pressable
                      key={`${p.label}-${idx}`}
                      onPress={() => {
                        setPreview((prev) => {
                          if (!prev) return prev;
                          const defaultQty = p.label === "g" || p.label === "ml" ? 100 : 1;
                          return { ...prev, chosenPortion: p, quantity: defaultQty, quantityText: String(defaultQty) };
                        });
                      }}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8,
                        borderRadius: Radius.md, borderWidth: 1,
                        borderColor: isActive ? Accent.success : colors.border,
                        backgroundColor: isActive ? Accent.success + "15" : "transparent",
                        minWidth: 50, alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: isActive ? "700" : "500", color: isActive ? Accent.success : colors.text }}>
                        {p.label}
                      </Text>
                      {p.gramWeight !== 1 && (
                        <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                          {p.gramWeight} g
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Number of servings */}
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1 }}>
                NUMBER OF SERVINGS
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                <Pressable
                  onPress={() => {
                    setPreview((p) => {
                      if (!p || p.quantity <= 0.25) return p;
                      const step = p.chosenPortion.label === "g" || p.chosenPortion.label === "ml" ? 5 : 0.25;
                      const newQ = Math.max(0, Math.round((p.quantity - step) * 100) / 100);
                      return { ...p, quantity: newQ, quantityText: String(newQ) };
                    });
                  }}
                  style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </Pressable>
                <TextInput
                  value={preview.quantityText}
                  onChangeText={onQuantityTextChange}
                  keyboardType="decimal-pad"
                  style={{
                    backgroundColor: colors.background, borderRadius: Radius.sm,
                    borderWidth: 1, borderColor: colors.border,
                    paddingHorizontal: Spacing.md, paddingVertical: 8,
                    color: colors.text, fontSize: 16, fontWeight: "700",
                    width: 80, textAlign: "center",
                  }}
                  selectTextOnFocus
                />
                <Pressable
                  onPress={() => {
                    setPreview((p) => {
                      if (!p) return p;
                      const step = p.chosenPortion.label === "g" || p.chosenPortion.label === "ml" ? 5 : 0.25;
                      const newQ = Math.round((p.quantity + step) * 100) / 100;
                      return { ...p, quantity: newQ, quantityText: String(newQ) };
                    });
                  }}
                  style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </Pressable>
                <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
                  = {totalGrams} g
                </Text>
              </View>

              {/* Nutrition */}
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1, marginTop: Spacing.xs }}>
                NUTRITION
              </Text>
              <View style={{ gap: Spacing.sm }}>
                {[
                  ["Calories", `${previewMacros.calories} kcal`],
                  ["Protein", `${previewMacros.protein} g`],
                  ["Carbohydrates", `${previewMacros.carbs} g`],
                  ["Fat", `${previewMacros.fat} g`],
                  ...(previewMacros.fiberG > 0 ? [["Fibre", `${previewMacros.fiberG} g`]] : []),
                  ...(previewMacros.sugarG > 0 ? [["Sugar", `${previewMacros.sugarG} g`]] : []),
                  ...(previewMacros.sodiumMg > 0 ? [["Sodium", `${previewMacros.sodiumMg} mg`]] : []),
                ].map(([label, val]) => (
                  <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>{label}</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{val}</Text>
                  </View>
                ))}
              </View>
              {fitHint ? (
                <View
                  accessible
                  accessibilityRole="summary"
                  accessibilityLabel="Projected remaining macros after logging this portion"
                  style={{
                    marginTop: Spacing.sm,
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.sm,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.8, color: colors.textTertiary, marginBottom: 4, textTransform: "uppercase" }}>
                    If you log this
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 }}>
                    {[
                      { label: "kcal", value: fitHint.calories, delta: fitHint.deltas.calories, over: fitHint.overCalories, unit: "" as string },
                      { label: "P", value: fitHint.protein, delta: fitHint.deltas.protein, over: fitHint.overProtein, unit: "g" },
                      { label: "C", value: fitHint.carbs, delta: fitHint.deltas.carbs, over: fitHint.overCarbs, unit: "g" },
                      { label: "F", value: fitHint.fat, delta: fitHint.deltas.fat, over: fitHint.overFat, unit: "g" },
                      ...(fitHint.fiber != null
                        ? [{ label: "Fi", value: fitHint.fiber, delta: fitHint.deltas.fiber ?? 0, over: fitHint.overFiber, unit: "g" }]
                        : []),
                    ].map((m) => (
                      <View key={m.label} style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            fontVariant: ["tabular-nums"],
                            color: m.over ? Accent.destructive : colors.text,
                          }}
                        >
                          {m.over ? `+${Math.abs(m.delta)}` : m.value}{m.unit}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>{m.label}</Text>
                        <Text style={{ fontSize: 11, color: colors.textTertiary }}>{m.over ? "over" : "left"}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm }}>
                <Pressable
                  style={{ flex: 1, backgroundColor: Accent.success, borderRadius: Radius.md, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: Spacing.sm }}
                  onPress={onConfirmPreview}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Use this</Text>
                </Pressable>
                <Pressable
                  style={{ flex: 1, borderRadius: Radius.md, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
                  onPress={() => setPreview(null)}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>Back to results</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}

        {loading && results.length === 0 && !preview && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Accent.primary} />
            <Text style={styles.hint}>Searching...</Text>
          </View>
        )}

        {!preview && (
          <FlatList<SearchRow>
            data={results}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              !loading && query.trim() ? (
                <Text style={styles.emptyText}>
                  No results for &quot;{query}&quot;.
                  {customEnabled ? " Can't find it? Create your own." : " Try a simpler or more specific term."}
                </Text>
              ) : null
            }
            ListFooterComponent={
              customEnabled ? (
                <Pressable
                  onPress={() => {
                    setEditingFood(undefined);
                    setCreateOpen(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Create a new custom food"
                  style={{
                    marginTop: Spacing.md,
                    paddingVertical: Spacing.md,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: Spacing.sm,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderStyle: "dashed",
                    borderRadius: Radius.md,
                  }}
                >
                  <Ionicons name="add" size={16} color={Accent.primary} />
                  <Text style={{ fontSize: 14, fontWeight: "600", color: Accent.primary }}>
                    Create custom food
                  </Text>
                </Pressable>
              ) : null
            }
          />
        )}

        {/* Custom food create/edit sheet — rendered outside the FlatList
            so it survives search-result churn. */}
        {customEnabled && (
          <CreateCustomFoodSheet
            visible={createOpen}
            onClose={() => {
              setCreateOpen(false);
              setEditingFood(undefined);
            }}
            initialFood={editingFood}
            initialName={editingFood ? undefined : query.trim() || undefined}
            onSave={editingFood ? handleUpdateCustomFood : handleCreateCustomFood}
            colors={{
              text: colors.text,
              textSecondary: colors.textSecondary,
              textTertiary: colors.textTertiary,
              card: colors.card,
              cardBorder: colors.cardBorder,
              background: colors.background,
            }}
          />
        )}
      </View>
    </Modal>
  );
}
