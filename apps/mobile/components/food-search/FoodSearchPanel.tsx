/**
 * FoodSearchPanel — shared, input-less food-search results + preview region.
 *
 * Why this exists (2026-04-30, customer-lens follow-up to the
 * 2026-04-28 search-first refactor)
 * --------------------------------------------------------------
 * The previous shape was: LogSheet rendered a `Pressable` styled like
 * a search input. Tapping it CLOSED the LogSheet and OPENED a separate
 * `<FoodSearchModal>` whose first job was rendering an actual
 * `<TextInput>`. Two modals stacked, one extra animation, and the
 * user couldn't start typing immediately on sheet-open. Cal AI's
 * quick-add (the most direct competitor) is a real `<TextInput>` you
 * type into immediately — Suppr's nested-modal pattern was a
 * learning step no competitor required (Grace, 2026-04-30).
 *
 * The fix is to lift the entire search-results + preview body out of
 * `<FoodSearchModal>` and into this presentational component. The
 * caller — either `<FoodSearchModal>` (full-screen) or `<LogSheet>`
 * (inline) — owns:
 *   - the modal / sheet chrome
 *   - the `<TextInput>` itself (lives in caller layout where it
 *     belongs visually)
 *   - the `query` state + onQueryChange handler
 * The panel owns:
 *   - the debounced searchFoods + custom-foods fetch
 *   - the result list (FlatList) + pagination + USDA backfill
 *   - the preview card (portion picker, fit-hint, nutrition lines)
 *   - the create-custom-food sub-sheet
 *
 * `<FoodSearchModal>` now becomes a thin wrapper: Modal shell +
 * TextInput + close button + `<FoodSearchPanel mode="full" />`.
 * `<LogSheet>` mounts `<FoodSearchPanel mode="compact" />` inline,
 * giving the user a real TextInput at the top of the sheet that
 * search results render below WITHIN THE SAME SHEET — no nested
 * modal, no animation cost.
 *
 * Mode
 * ----
 * `"full"`  — current FoodSearchModal density (paddings, separators).
 * `"compact"` — tighter rows for LogSheet's smaller vertical budget.
 *
 * Parity
 * ------
 * Web has the same nested-modal smell (`src/app/components/suppr/log-sheet.tsx`
 * → `<FoodSearch>` modal). Web parity for this lift is a separate
 * commit — flagged in the PR. The two surfaces will rejoin parity
 * once the web FoodSearchPanel ships.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react-native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from "react-native-svg";
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
} from "../../../../src/lib/nutrition/primaryServing";
import {
  resolveFoodSearchHeadline,
  FOOD_SEARCH_PER_SERVING_BADGE,
  FOOD_SEARCH_PER_100G_BADGE,
} from "../../../../src/lib/nutrition/foodSearchHeadline";
import {
  projectRemaining,
  type MacroConsumed,
  type MacroTargets,
} from "../../../../src/lib/nutrition/remainingMacros";
import {
  createCustomFood,
  deleteCustomFood,
  listCustomFoods,
  searchCustomFoods,
  updateCustomFood,
} from "../../../../src/lib/nutrition/customFoodsClient";
import {
  buildCustomFoodPortions,
  customFoodToMacrosPer100g,
  customFoodToPrimaryServing,
  type CustomFood,
} from "../../../../src/lib/nutrition/customFoods";
import CreateCustomFoodSheet, {
  type CreateCustomFoodPayload,
} from "../CreateCustomFoodSheet";
import Badge from "../Badge";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../../src/lib/analytics/events";

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

export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  caffeineMgPer100g?: number | null;
  alcoholGPer100g?: number | null;
};

export type SelectedFood = {
  name: string;
  source: "USDA" | "OFF" | "CUSTOM" | "Edamam";
  macrosPer100g: Macros;
  microsPer100g?: Record<string, number>;
  portions: FoodPortion[];
  chosenPortion: FoodPortion;
  quantity: number;
  fdcId?: number;
  barcode?: string;
  customFoodId?: string;
  servingLabel?: string;
};

export type SupabaseLike = { from: (table: string) => unknown };

/** Local superset of UnifiedSearchResult — see FoodSearchModal history. */
type SearchRow = Omit<UnifiedSearchResult, "_source"> & {
  _source: "USDA" | "OFF" | "CUSTOM" | "Edamam" | "GenericBeverage" | "GenericFood";
  _custom?: CustomFood;
};

export type FoodSearchPanelProps = {
  /** Current query string. Caller owns the input + state. */
  query: string;
  /** Original recipe amount — only meaningful in verify-ingredient hosts. */
  initialAmount?: number | null;
  initialUnit?: string | null;
  /** Original ingredient description for context display in the preview. */
  originalDescription?: string | null;
  /** Daily budget context — see FoodSearchModal docstring. */
  macroTargets?: MacroTargets;
  macroConsumed?: MacroConsumed;
  /** Custom-foods wiring — see FoodSearchModal docstring. */
  supabase?: SupabaseLike;
  userId?: string | null;
  /** Fired when the user confirms a portion / quantity. */
  onSelect: (result: SelectedFood) => void;
  /**
   * `"full"` matches the legacy FoodSearchModal density (separator
   * lines, generous paddings).
   * `"compact"` is tighter — for use inside LogSheet whose vertical
   * budget is smaller. Same data, same accessibility, same handlers
   * — visual density only.
   */
  mode?: "full" | "compact";
  /**
   * When the user backs out of the preview, the panel returns to the
   * results list. When the panel itself should close (e.g. caller is
   * a sheet that wants to dismiss after a successful log), the host
   * is responsible — the panel never tells the host to close. This
   * keeps the panel host-agnostic.
   */
};

function buildPortionList(
  apiPortions: FoodPortion[],
  primary?: PrimaryServing | null,
): FoodPortion[] {
  const seen = new Set<string>();
  const result: FoodPortion[] = [];
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

function resolveInitialPortion(
  portions: FoodPortion[],
  amount: number | null | undefined,
  unit: string | null | undefined,
): { portion: FoodPortion; quantity: number } {
  const amt = amount != null && amount > 0 ? amount : 1;
  const u = (unit ?? "").trim().toLowerCase();

  if (!u) {
    const gPortion = portions.find((p) => p.label === "g");
    return { portion: gPortion ?? portions[0], quantity: amt > 10 ? amt : 100 };
  }

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
  if (directMatch) {
    return { portion: directMatch, quantity: amt };
  }

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

  return { portion: portions[0], quantity: amt };
}

function customFoodToRow(food: CustomFood): SearchRow {
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

export default function FoodSearchPanel({
  query,
  initialAmount,
  initialUnit,
  originalDescription,
  macroTargets,
  macroConsumed,
  supabase,
  userId,
  onSelect,
  mode = "full",
}: FoodSearchPanelProps) {
  const colors = useThemeColors();
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    name: string;
    source: "USDA" | "OFF" | "CUSTOM" | "Edamam";
    macrosPer100g: Macros;
    microsPer100g?: Record<string, number>;
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

  const backfillMissingMacros = useCallback((items: SearchRow[]) => {
    const id = ++backfillRef.current;
    const missing = items
      .filter((r) => r._source === "USDA" && r._fdcId && !r.macrosPer100g && !(r.calsPer100g && r.calsPer100g > 0))
      .slice(0, 2);
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

  const mergeWithCustom = useCallback((external: UnifiedSearchResult[], customs: CustomFood[]): SearchRow[] => {
    const customRows: SearchRow[] = customs.map(customFoodToRow);
    return [...customRows, ...(external as SearchRow[])];
  }, []);

  const appendPage = useCallback(
    (prev: SearchRow[], next: UnifiedSearchResult[]): SearchRow[] => {
      const seen = new Set<string>(prev.map((r) => r.key));
      const fresh = (next as SearchRow[]).filter((r) => !seen.has(r.key));
      return [...prev, ...fresh];
    },
    [],
  );

  // Re-run search whenever `query` changes. Caller-driven state — the
  // panel is purely reactive to its `query` prop. Debounced 400 ms to
  // avoid network spam while the user is mid-typing. Empty query =
  // empty results (caller may render its own browse UI in that
  // condition).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    backfillRef.current++;
    pageRef.current = 1;
    hasMoreRef.current = true;
    if (customEnabled) void refreshCustomLibrary();
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const externalP = searchFoods(
        q,
        (partial) => setResults(partial as SearchRow[]),
        { page: 1 },
      );
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
      hasMoreRef.current = r.length > 0;
      backfillMissingMacros(merged);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, customEnabled, supabase, userId, refreshCustomLibrary, mergeWithCustom, backfillMissingMacros]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    if (!hasMoreRef.current) return;
    const q = query.trim();
    if (!q) return;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    try {
      const more = await searchFoods(q, undefined, { page: nextPage });
      if (more.length === 0) {
        hasMoreRef.current = false;
        return;
      }
      pageRef.current = nextPage;
      setResults((prev) => {
        const appended = appendPage(prev, more);
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

  const onPickResult = useCallback(
    async (item: SearchRow) => {
      setLoadingKey(item.key);

      if (
        (item._source === "GenericBeverage" || item._source === "GenericFood") &&
        item.macrosPer100g
      ) {
        setLoadingKey(null);
        const allPortions = buildPortionList([], item.primaryServing);
        const { portion, quantity } = item.primaryServing
          ? { portion: allPortions[0], quantity: 1 }
          : resolveInitialPortion(allPortions, initialAmount, initialUnit);
        setPreview({
          name: item.name,
          source: "USDA",
          macrosPer100g: item.macrosPer100g,
          portions: allPortions,
          chosenPortion: portion,
          quantity,
          quantityText: String(quantity),
        });
        return;
      }

      if (item._source === "USDA" && item._fdcId) {
        const result = await getFoodMacros(item._fdcId);
        setLoadingKey(null);
        if (!result) return;
        const effectivePrimary = item.primaryServing ?? result.primaryPortion ?? null;
        const allPortions = buildPortionList(result.portions, effectivePrimary);
        const { portion, quantity } = effectivePrimary
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
          microsPer100g: item.microsPer100g,
          portions: allPortions,
          chosenPortion: portion,
          quantity,
          quantityText: String(quantity),
          barcode: item._offCode,
        });
      } else if (item._source === "Edamam" && item.macrosPer100g) {
        setLoadingKey(null);
        const allPortions = buildPortionList([], item.primaryServing);
        const { portion, quantity } = item.primaryServing
          ? { portion: allPortions[0], quantity: 1 }
          : resolveInitialPortion(allPortions, initialAmount, initialUnit);
        setPreview({
          name: item.name,
          source: "Edamam",
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
        // noop
      }
      const library = await refreshCustomLibrary();
      const fresh = library.find((f) => f.id === created.id) ?? created;
      setEditingFood(undefined);
      setCreateOpen(false);
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
          // noop
        }
      }
      onSelect({
        name: preview.name,
        source: preview.source,
        macrosPer100g: preview.macrosPer100g,
        ...(preview.microsPer100g ? { microsPer100g: preview.microsPer100g } : {}),
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

  const styles = useMemo(() => StyleSheet.create({
    list: {
      paddingHorizontal: mode === "compact" ? Spacing.md : Spacing.xl,
      paddingBottom: 40,
    },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: mode === "compact" ? Spacing.sm : Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: Spacing.md,
    },
    resultName: { fontSize: 14, color: colors.text, fontWeight: "500" },
    macroPreview: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: 4,
    },
    macroPreviewText: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
    per100g: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
    perLabel: {
      fontSize: 10,
      color: Accent.success,
      fontWeight: "700",
      letterSpacing: 0.4,
      marginTop: 2,
      textTransform: "uppercase",
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      paddingTop: 40,
    },
    centered: { alignItems: "center", paddingTop: mode === "compact" ? 24 : 60, gap: Spacing.md },
    hint: { color: colors.textSecondary, fontSize: 14 },
  }), [colors, mode]);

  const renderItem = useCallback(
    ({ item }: { item: SearchRow }) => {
      const isLoading = loadingKey === item.key;
      const isCustom = item._source === "CUSTOM";
      const customFood = isCustom ? item._custom : null;
      const headline = resolveFoodSearchHeadline(item);
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
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {isCustom && <Badge variant="custom">Custom</Badge>}
              {item.verified && !isCustom && (
                <CheckCircle2 size={14} color={Accent.success} />
              )}
              <Text style={styles.resultName} numberOfLines={2}>
                {item.name}
              </Text>
            </View>
            {headline.mode === "per-serving" ? (
              <>
                <View style={styles.macroPreview}>
                  <Text style={[styles.macroPreviewText, { color: MacroColors.protein }]}>P {headline.macros.protein}g</Text>
                  <Text style={[styles.macroPreviewText, { color: MacroColors.carbs }]}>C {headline.macros.carbs}g</Text>
                  <Text style={[styles.macroPreviewText, { color: MacroColors.fat }]}>F {headline.macros.fat}g</Text>
                </View>
                <Text style={styles.perLabel}>{FOOD_SEARCH_PER_SERVING_BADGE}</Text>
                <Text style={styles.per100g}>
                  {headline.servingLabel}
                  {headline.per100gReference ? ` · ${headline.per100gReference}` : ""}
                </Text>
              </>
            ) : headline.mode === "per-100g" && headline.macros ? (
              <>
                <View style={styles.macroPreview}>
                  <Text style={[styles.macroPreviewText, { color: MacroColors.protein }]}>P {headline.macros.protein}g</Text>
                  <Text style={[styles.macroPreviewText, { color: MacroColors.carbs }]}>C {headline.macros.carbs}g</Text>
                  <Text style={[styles.macroPreviewText, { color: MacroColors.fat }]}>F {headline.macros.fat}g</Text>
                </View>
                <Text style={styles.per100g}>{FOOD_SEARCH_PER_100G_BADGE}</Text>
              </>
            ) : headline.mode === "per-100g" ? (
              <Text style={styles.per100g}>{FOOD_SEARCH_PER_100G_BADGE}</Text>
            ) : (
              <Text style={styles.per100g}>Tap for nutrition info</Text>
            )}
          </View>
          {headline.mode !== "placeholder" && !isLoading ? (
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"], marginRight: 4 }}>{headline.headlineKcal}</Text>
          ) : null}
          {isLoading ? (
            <ActivityIndicator size="small" color={Accent.primary} />
          ) : (
            <ChevronRight size={16} color={colors.textTertiary} />
          )}
        </Pressable>
      );
    },
    [loadingKey, onPickResult, colors, openCustomFoodActions, styles],
  );

  // Preview overlays the list when set. Caller's wrapping View should
  // give the panel `flex: 1` so the FlatList / ScrollView can scroll
  // independently of the caller's surrounding chrome.
  if (preview && previewMacros) {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: mode === "compact" ? Spacing.md : Spacing.xl,
          paddingTop: Spacing.lg,
          paddingBottom: 40,
        }}
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

          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1 }}>
            SERVING SIZE
          </Text>
          <View style={{ position: "relative" }}>
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
            <View
              pointerEvents="none"
              style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 24 }}
            >
              <Svg width="100%" height="100%">
                <Defs>
                  <SvgLinearGradient id="portionFade" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={colors.card} stopOpacity="0" />
                    <Stop offset="1" stopColor={colors.card} stopOpacity="1" />
                  </SvgLinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#portionFade)" />
              </Svg>
            </View>
          </View>

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
              <Minus size={18} color={colors.text} />
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
              <Plus size={18} color={colors.text} />
            </Pressable>
            <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
              = {totalGrams} g
            </Text>
          </View>

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
              <Check size={18} color="#fff" />
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
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {loading && results.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Accent.primary} />
          <Text style={styles.hint}>Searching...</Text>
        </View>
      ) : (
        <FlatList<SearchRow>
          data={results}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => {
            void loadMore();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            !loading && query.trim() ? (
              <Text style={styles.emptyText}>
                No results for &quot;{query}&quot;.
                {customEnabled ? " Can't find it? Create your own." : " Try a simpler or more specific term."}
              </Text>
            ) : null
          }
          ListFooterComponent={
            <View>
              {loadingMore ? (
                <View style={{ paddingVertical: Spacing.md, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={Accent.primary} />
                </View>
              ) : null}
              {customEnabled ? (
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
                  <Plus size={16} color={Accent.primary} />
                  <Text style={{ fontSize: 14, fontWeight: "600", color: Accent.primary }}>
                    Create custom food
                  </Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
      )}

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
  );
}
