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
  Barcode,
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
import { Accent, FontWeight, MacroColors, MacroColorsDark, Spacing, Radius, Type } from "@/constants/theme";
import { useAccent, useResolvedScheme } from "@/context/theme";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  defaultEatenAtForNewLog,
  eatenAtFromLogDateAndTime,
  localTimeInputValueFromIso,
} from "@suppr/nutrition-core/mealEatenAt";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import {
  searchFoods,
  getFoodMacros,
  getEdamamFoodMicros,
  getFatSecretFood,
  scaleMacrosByGrams,
  splitFoodSearchResults,
  type UnifiedSearchResult,
  type FoodPortion,
} from "@/lib/verifyRecipe";
import type { SearchRowConfidenceTier } from "@suppr/nutrition-core/foodSearchRanking";
import {
  primaryServingToPortionChip,
  type PrimaryServing,
} from "@suppr/nutrition-core/primaryServing";
import {
  resolveFoodSearchHeadline,
  FOOD_SEARCH_PER_SERVING_BADGE,
  FOOD_SEARCH_PER_100G_BADGE,
} from "@suppr/nutrition-core/foodSearchHeadline";
import {
  projectRemaining,
  portionFitHintForPreview,
  type MacroConsumed,
  type MacroTargets,
} from "@suppr/nutrition-core/remainingMacros";
import {
  createCustomFood,
  deleteCustomFood,
  listCustomFoods,
  searchCustomFoods,
  updateCustomFood,
} from "@suppr/nutrition-core/customFoodsClient";
import {
  buildCustomFoodPortions,
  customFoodToMacrosPer100g,
  isLearnedCustomFood,
  isLearnedCustomFoodSource,
  LEARNED_CUSTOM_FOOD_REUSE_CUE,
  type CustomFood,
} from "@suppr/nutrition-core/customFoods";
import CreateCustomFoodSheet, {
  type CreateCustomFoodPayload,
} from "../CreateCustomFoodSheet";
import Badge from "../Badge";
import { SearchResultConfidenceChip } from "../ui/SearchResultConfidenceChip";
import { SupprButton } from "@/components/ui/SupprButton";
import { FatSecretBadge } from "../ui/FatSecretBadge";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { fetchFatSecretAutocomplete } from "@suppr/nutrition-core/fatsecretAutocompleteClient";
import { shouldShowBarcodeFallbackHint } from "@suppr/nutrition-core/foodSearchLocale";
import { formatMacroTrailer } from "@suppr/nutrition-core/macroFormat";
import { portionEqualsLabel } from "@suppr/nutrition-core/portionEqualsLabel";
import { resolveInitialPortion, buildPortions, customFoodToHit, isPerServingPortion, buildUsdaPreviewFields } from "@suppr/nutrition-core/foodSearchCore";
import { ConfirmFoodMacroPreview } from "./ConfirmFoodMacroPreview";
import { foodSearchPreviewExtraMicroRows } from "@suppr/nutrition-core/foodSearchPreviewNutrition";
import { foodSearchPreviewPlausibilityWarning } from "@suppr/nutrition-core/portionPicker";
import {
  matchHistoryFoods,
  historyMatchNameSet,
  dedupeDbAgainstHistory,
  normalizeHistoryName,
  type HistorySearchMatch,
} from "@suppr/nutrition-core/foodHistorySearch";
import {
  matchFavoriteFoods,
  favoriteFoodKeySet,
  orderRecentWithFavoritesFirst,
  isFavoriteRow,
  type FavoriteSearchItem,
  type FavoriteSearchMatch,
} from "@suppr/nutrition-core/favoriteFoodsSearch";
import { favoriteKey } from "@suppr/nutrition-core/favoriteFoods";
import {
  optionalSanitizedMicrosPer100g,
  sanitizeMicrosPer100g,
} from "@suppr/nutrition-core/microPlausibility";
import { FavoriteStarButton } from "./FavoriteStarButton";

// 2026-05-15 (ENG-550 phase 2): `STANDARD_UNITS` and `buildPortionList`
// extracted to `@/lib/nutrition/foodSearchCore` as `STANDARD_UNITS` and
// `buildPortions`. The mobile-side names were aliases; both files now
// import from the single shared source.

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
  source: "USDA" | "OFF" | "CUSTOM" | "Edamam" | "FatSecret";
  /**
   * 2026-05-06: nullable for per-serving-only FatSecret foods (no
   * metric serving in `food.get`). When null, `macrosPerServing`
   * carries the values and `chosenPortion.gramWeight` will be 0
   * (sentinel). The commit site treats this as "log N × 1 serving".
   */
  macrosPer100g: Macros | null;
  macrosPerServing?: { calories: number; protein: number; carbs: number; fat: number } | null;
  microsPer100g?: Record<string, number>;
  /**
   * 2026-05-06: per-serving micros (absolute) for FatSecret no-metric
   * foods. Commit path uses `microsPerServing × quantity`.
   */
  microsPerServing?: Record<string, number>;
  portions: FoodPortion[];
  chosenPortion: FoodPortion;
  quantity: number;
  fdcId?: number;
  barcode?: string;
  customFoodId?: string;
  fatSecretFoodId?: string;
  servingLabel?: string;
  imageUrl?: string | null;
  /** ENG-772 — consumption instant from preview time picker. */
  eatenAt?: string;
};

export type SupabaseLike = { from: (table: string) => unknown };

/** Local superset of UnifiedSearchResult — see FoodSearchModal history. */
type SearchRow = Omit<UnifiedSearchResult, "_source"> & {
  _source: "USDA" | "OFF" | "CUSTOM" | "Edamam" | "FatSecret" | "GenericBeverage" | "GenericFood";
  _custom?: CustomFood;
};

/**
 * Redesign (ENG-814) — discriminated FlatList feed row for the sectioned,
 * grouped-card results body. `header` rows render a section label
 * ("Best matches" / "More results"); `row` rows render a result inside its
 * section's soft-elevated card, carrying within-card position so the card
 * corners + inset seams render correctly. Only used on the
 * `redesign_search_results`-flagged path.
 */
type RenderRow =
  | { kind: "header"; key: string; label: string }
  | { kind: "row"; key: string; row: SearchRow; isFirst: boolean; isLast: boolean };

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
  /** ENG-772 — journal day (`YYYY-MM-DD`) for preview time when `editable_eaten_at` is on. */
  logDateKey?: string;
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
  /**
   * Locale-aware empty-state hint (2026-04-26 — FatSecret Premier Free).
   * Premier Free is a US-only dataset; UK / EU / AU users searching
   * for a regional brand will hit the "No results" path. When this
   * callback is supplied AND the user's locale is non-US, the empty
   * state surfaces a "Brand not found? Try a barcode scan" CTA that
   * fires this handler. Caller is responsible for opening the
   * BarcodeScannerModal.
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
   * 2026-05-12 round 5 (premium-bar audit #12, MFP borrow): when
   * the query is empty, render a "Recent foods" section above the
   * results FlatList. Each row taps directly to `onSelect` with a
   * SelectedFood built from the FoodHistoryItem's per-serving
   * macros (no grams basis — `macrosPer100g: null`, `quantity: 1`).
   * Hosts that don't have a foodHistory available can omit this
   * prop; the panel falls back to the legacy empty-query state
   * (no results rendered).
   */
  recentFoods?: Array<{
    recipeTitle: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    source?: string;
    /** Total log count for this (title, kcal) — recency-weighted-frequency
     *  tiebreak in the history-first "Past logged" group (ENG-1033). */
    count?: number;
    imageUrl?: string | null;
  }>;
  /**
   * Favourites-in-search (teardown #1, ENG-1041, 2026-06-11). The user's
   * `user_favorite_foods` rows, threaded so the panel can (a) surface a
   * "Favourites" group above "Past logged" when the typed query matches a
   * favourite, (b) order the empty-query "Recent" strip favourites-first, and
   * (c) render the correct star state on every history-style row. When
   * omitted, no favourites surface and the star is hidden. Mirrors the web prop.
   */
  favoriteFoods?: FavoriteSearchItem[];
  /**
   * Star/unstar handler. The host owns the optimistic add/remove + Supabase
   * write + revert. `favoriteId` is the row id when unstarring, else undefined
   * (the host adds). When omitted, the star affordance is hidden.
   */
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
  /** Keys of favourite toggles currently in flight (disabled + dimmed star —
   *  no double-submit). Optional; host owns the pending set. */
  favoritePendingKeys?: Set<string>;
  /**
   * Multi-add basket (teardown #2, ENG-1042). When wired, the portion preview
   * shows an "Add" action alongside "Use this": "Add" stages the selection into
   * the host's basket (the panel returns to results so the user keeps building)
   * WITHOUT committing or closing the sheet; "Use this" stays the instant
   * single-item log. The host commits the whole basket in one round-trip via
   * the LogSheet's basket bar. When omitted, only "Use this" shows (today's
   * behaviour). Same `SelectedFood` payload as `onSelect`. */
  onAddToBasket?: (result: SelectedFood) => void;
};

// 2026-05-15 (ENG-550): inline `resolveInitialPortion` extracted to
// `../../../../src/lib/nutrition/foodSearchCore` so web + mobile share
// one source of truth. The previous mobile-side function (with its
// `UNIT_TO_LABEL` and `UNIT_GRAMS` tables) was byte-identical to the
// web version apart from formatting.

// 2026-05-16 (ENG-550 phase 3): `customFoodToRow` moved to
// `@/lib/nutrition/foodSearchCore` as `customFoodToHit`. Mobile's
// `SearchRow` accepts the returned `CustomFoodHit` structurally.
// Alias kept for call-site readability.
const customFoodToRow = customFoodToHit;

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
  logDateKey,
  mode = "full",
  onScanBarcodePressed,
  inBarcodeMode = false,
  localeOverride,
  recentFoods,
  favoriteFoods,
  onToggleFavorite,
  favoritePendingKeys,
  onAddToBasket,
}: FoodSearchPanelProps) {
  const colors = useThemeColors(), mc = useResolvedScheme() === "dark" ? MacroColorsDark : MacroColors;
  // Secondary accent (Frost flag → damson, else clay) for this panel's CTAs,
  // the "Add custom"/barcode affordances, and the segmented/tab active state.
  // Source/confidence chrome and `MacroColors` stay warm.
  const accent = useAccent();
  // 2026-05-31 design-direction (LANE: commit-colour CTAs): the single
  // commit-action colour is the secondary accent. The "Use this" log
  // commit CTA below historically painted `Accent.success` (green) — but
  // green is now reserved strictly for the calorie-ring state + macro
  // identity, never a commit-button fill. Gate behind `design_system_colours`:
  //   flag ON  → accent commit CTA (damson under Frost, else clay)
  //   flag OFF → existing green (old path stays alive in the `else`).
  const commitCtaColor = isFeatureEnabled("design_system_colours")
    ? accent.primary
    : Accent.success;
  // 2026-05-31 design-direction (LANE: search-results UI — ENG-814).
  // Gate the redesigned results body behind `redesign_search_results`:
  //   flag ON  → unified segmented control + softly-elevated grouped
  //              result cards + "Best matches"/"More results" section
  //              headers + a legible confidence chip (soft-blue Verified
  //              / amber Estimated) driven by each row's `confidenceTier`.
  //   flag OFF → the existing pill row + flat hairline list + CheckCircle2
  //              tick (the old path stays alive, untouched, in the `else`).
  // Matches docs/prototypes/2026-05-31-design-direction/surface-search-results.html.
  const redesignSearch = isFeatureEnabled("redesign_search_results");
  // Soft-elevation treatment for the grouped result cards (light = soft
  // shadow + no border; dark = tonal lift + hairline; flag-off = flat).
  // Only consumed on the redesigned path.
  const cardElevation = useCardElevation();
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // ENG-1038 — true when a keyed vendor (USDA / Edamam / FatSecret) was
  // skipped because its account-wide quota was exhausted. Drives an honest
  // "showing saved results" notice instead of a silent blank at viral scale.
  const [searchDegraded, setSearchDegraded] = useState(false);
  // 2026-05-14 premium-bar polish #3: lightweight category-filter tab
  // row. The active category is a presentational filter over the
  // existing `results` list (and gates whether `recentFoods` renders).
  // `All` keeps current behaviour. `Recents` only shows the recent-
  // foods block + suppresses the FlatList. `Custom` filters to
  // user-authored foods. `Branded` filters to FatSecret-sourced rows
  // (Premier branded dataset). `Generic` filters to USDA / OFF /
  // Edamam / Generic* fallbacks (no brand).
  // Favourites tab removed pending a real favourites model — see
  // ENG-748 #8. It rendered as a visible tab that always returned the
  // unfiltered list (no isFavourite-per-row data shape exists), so it
  // was a dead affordance; removing it (rather than shipping a no-op
  // tab) is the honest state until the favouriting workstream lands.
  type FoodCategory = "All" | "Recents" | "Custom" | "Branded" | "Generic";
  const CATEGORY_LIST: readonly FoodCategory[] = [
    "All",
    "Recents",
    "Custom",
    "Branded",
    "Generic",
  ];
  const [activeCategory, setActiveCategory] = useState<FoodCategory>("All");
  /** Premier-tier autocomplete state (2026-04-26 — Premier Free upgrade). */
  const [autocomplete, setAutocomplete] = useState<{ tier: "basic" | "premier"; suggestions: string[] }>(
    { tier: "basic", suggestions: [] },
  );
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const autocompleteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    name: string;
    source: "USDA" | "OFF" | "CUSTOM" | "Edamam" | "FatSecret";
    /**
     * 2026-05-06: nullable for per-serving-only FatSecret foods (e.g.
     * McDonald's Big Mac, where FatSecret ships no metric serving so
     * we can't scale by grams). When null, `macrosPerServing` carries
     * the values and the only valid portion is the inline serving
     * (gramWeight: 0 sentinel).
     */
    macrosPer100g: Macros | null;
    macrosPerServing?: { calories: number; protein: number; carbs: number; fat: number } | null;
    microsPer100g?: Record<string, number>;
    /**
     * 2026-05-06: per-serving micros (absolute) for FatSecret
     * no-metric foods. Commit path uses `microsPerServing × quantity`.
     */
    microsPerServing?: Record<string, number>;
    portions: FoodPortion[];
    chosenPortion: FoodPortion;
    quantity: number;
    quantityText: string;
    fdcId?: number;
    barcode?: string;
    customFoodId?: string;
    fatSecretFoodId?: string;
    imageUrl?: string | null;
    /** ENG-976 — remembered photo/voice correction reuse cue. */
    showLearnedReuseCue?: boolean;
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
  // stale PR #36): dedupe the `food_search_no_result` PostHog event
  // per (trimmed, lowercase) query so a mid-typing pause + re-render
  // doesn't double-fire. Cleared implicitly when the user types a
  // new query (the ref's last value won't match). Mirrors the
  // identical web shape — see
  // `src/app/components/food-search/FoodSearchPanel.tsx`.
  const lastNoResultQueryRef = useRef<string | null>(null);
  // Tracks whether the user has already fired the
  // `food_search_request_dictionary_add` event for the current
  // empty-state — avoids spammy re-fires if they tap repeatedly.
  // Per-query (case-insensitive, trimmed); resets when a new
  // empty-state for a different query mounts.
  const dictionaryAddRequestedRef = useRef<string | null>(null);
  // Inline confirmation row state — softer than a native Alert
  // (Grace, 2026-05-02). Holds the trimmed query the user just
  // confirmed so the row can render right under the CTA and
  // disappear when the query changes.
  const [dictionaryAddRequested, setDictionaryAddRequested] = useState<string | null>(null);

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

  // ── Premier-tier autocomplete typeahead (2026-04-26) ────────────
  // Debounced 250 ms — fires faster than the full search (400 ms).
  // On Basic tier the route returns an empty list so this is a no-op.
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
      if (autocompleteAbortRef.current !== ctl) return;
      setAutocomplete(result);
    }, 250);
    return () => {
      if (autocompleteDebounceRef.current) clearTimeout(autocompleteDebounceRef.current);
      if (autocompleteAbortRef.current) autocompleteAbortRef.current.abort();
    };
  }, [query]);

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
      setSearchDegraded(false);
      return;
    }
    setLoading(true);
    // ENG-1038 — clear any prior degraded notice when a fresh query starts;
    // the new fan-out re-asserts it only if a vendor is still exhausted.
    setSearchDegraded(false);
    debounceRef.current = setTimeout(async () => {
      // F-114 broader sweep (2026-05-07): wrap the debounced first-page
      // search in try/catch/finally. Pre-fix shape was bare `await
      // Promise.all` — if either side rejected, `setLoading(false)`
      // never ran and the user saw an indefinite spinner. Same bug
      // shape as PR #129's loadMore fix, applied to the initial page.
      let r: Awaited<ReturnType<typeof searchFoods>> = [];
      let customs: CustomFood[] = [];
      try {
        const externalP = searchFoods(
          q,
          (partial) => setResults(partial as SearchRow[]),
          { page: 1, onDegraded: () => setSearchDegraded(true) },
        );
        const customP: Promise<CustomFood[]> = customEnabled && supabase && userId
          ? searchCustomFoods(
              supabase as Parameters<typeof searchCustomFoods>[0],
              userId,
              q,
            )
          : Promise.resolve([] as CustomFood[]);
        [r, customs] = await Promise.all([externalP, customP]);
      } catch (e) {
        console.warn("[FoodSearchPanel] initial search failed:", e);
        // r / customs default to []; merge below is empty + the user
        // sees the no-result state instead of a stuck spinner.
      } finally {
        setLoading(false);
      }
      const merged = mergeWithCustom(r, customs);
      setResults(merged);
      hasMoreRef.current = r.length > 0;
      backfillMissingMacros(merged);
      // No-result loop (audit move-blocker #2, 2026-05-02): when the
      // merged search returns 0 hits across every source — USDA, OFF,
      // Edamam, FatSecret, generic, and the user's custom foods —
      // emit a single `food_search_no_result` event for the trimmed
      // query so backfill prioritisation has visibility into the
      // dictionary gaps testers are hitting. Dedup'd per
      // (case-insensitive) query via `lastNoResultQueryRef` so a
      // re-render with the same query does NOT double-emit.
      const dedupKey = q.toLowerCase();
      if (merged.length === 0 && lastNoResultQueryRef.current !== dedupKey) {
        lastNoResultQueryRef.current = dedupKey;
        // Reset the user-confirmed signal + inline confirmation so
        // a fresh empty state can register a fresh dictionary-add
        // request.
        dictionaryAddRequestedRef.current = null;
        setDictionaryAddRequested(null);
        track(AnalyticsEvents.food_search_no_result, {
          query: q,
          len: q.length,
          source: "mobile",
        });
      } else if (merged.length > 0 && lastNoResultQueryRef.current === dedupKey) {
        // The current query had zero hits a tick ago but now does
        // (custom-food write landed, network resolved late, etc.).
        // Clear the ref so a future zero-result query can re-fire.
        lastNoResultQueryRef.current = null;
      }
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
    } catch (e) {
      // F-114 (`AHOkMJ8yu5hA`, "Gets stuck trying to get more data"):
      // a failed pagination fetch must not leave `hasMoreRef` dangling
      // true — otherwise every subsequent scroll-to-bottom retriggers
      // the same failing fetch and the user sees an endless spinner
      // cycle. Stop further attempts once a page errors so the list
      // settles into a final state.
      hasMoreRef.current = false;
      console.warn("[FoodSearchPanel] loadMore failed:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, query, appendPage, backfillMissingMacros]);

  const onPickResult = useCallback(
    async (item: SearchRow) => {
      setLoadingKey(item.key);
      try {
      if (
        (item._source === "GenericBeverage" || item._source === "GenericFood") &&
        item.macrosPer100g
      ) {
        setLoadingKey(null);
        const allPortions = buildPortions([], item.primaryServing);
        const { portion, quantity } = item.primaryServing
          ? { portion: allPortions[0], quantity: 1 }
          : resolveInitialPortion(allPortions, initialAmount, initialUnit);
        setPreview({
          name: item.name,
          source: "USDA",
          macrosPer100g: item.macrosPer100g,
          // ENG-738 — thread the baked generic-food micros through to the
          // preview (and onward to the commit/scale path) exactly like the
          // OFF/USDA branches. GenericBeverage rows carry no micros (beverage
          // micros deferred), so the conditional spread leaves them untouched.
          ...(item.microsPer100g ? { microsPer100g: item.microsPer100g } : {}),
          portions: allPortions,
          chosenPortion: portion,
          quantity,
          quantityText: String(quantity),
        });
        return;
      }

      if (item._source === "USDA" && item._fdcId) {
        const result = await getFoodMacros(item._fdcId);
        const preview = buildUsdaPreviewFields(
          {
            name: item.name,
            fdcId: item._fdcId,
            macrosPer100g: item.macrosPer100g,
            microsPer100g: item.microsPer100g,
            primaryServing: item.primaryServing,
          },
          result,
          initialAmount,
          initialUnit,
        );
        if (!preview) {
          Alert.alert(
            "Couldn't load this item",
            "Please check your connection and try again, or pick another option.",
          );
          return;
        }
        setPreview(preview);
      } else if (item._source === "OFF" && item.macrosPer100g) {
        setLoadingKey(null);
        const allPortions = buildPortions([], item.primaryServing);
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
          imageUrl: item.imageUrl,
        });
      } else if (item._source === "Edamam" && item.macrosPer100g) {
        // ENG-738 (2026-05-26) — fetch the full per-100g micronutrient
        // panel from Edamam's `/nutrients` endpoint on select. The
        // search hit only carries fiber/sugar/sodium; `/api/edamam/food`
        // returns the fat breakdown + cholesterol + vitamins + minerals.
        // Merge the fetched set OVER the search-hit micros (the fetch is
        // the authoritative superset; `{}` on failure leaves the
        // search-hit micros intact so the food still logs). The commit
        // path then scales + persists via `scaleMicrosForGrams`. Mirrors
        // the USDA detail branch above. Web mirror in
        // `src/app/components/food-search/FoodSearchPanel.tsx`.
        const fetchedMicros = item._edamamFoodId
          ? await getEdamamFoodMicros(item._edamamFoodId)
          : {};
        setLoadingKey(null);
        const mergedMicros = sanitizeMicrosPer100g({ ...(item.microsPer100g ?? {}), ...fetchedMicros });
        const allPortions = buildPortions([], item.primaryServing);
        const { portion, quantity } = item.primaryServing
          ? { portion: allPortions[0], quantity: 1 }
          : resolveInitialPortion(allPortions, initialAmount, initialUnit);
        setPreview({
          name: item.name,
          source: "Edamam",
          macrosPer100g: item.macrosPer100g,
          ...(Object.keys(mergedMicros).length > 0 ? { microsPer100g: mergedMicros } : {}),
          portions: allPortions,
          chosenPortion: portion,
          quantity,
          quantityText: String(quantity),
          imageUrl: item.imageUrl,
        });
      } else if (item._source === "FatSecret" && item._fatSecretFoodId) {
        // Lane-A (2026-04-30) — branded FatSecret rows usually surface
        // with null per-100g macros (the inline `food_description` was
        // per-serving). Fetch the canonical panel before opening the
        // preview so the portion picker has real values to scale.
        const result = await getFatSecretFood(item._fatSecretFoodId);
        setLoadingKey(null);
        if (!result) {
          // 2026-05-06 audit (C2): give the user feedback when the
          // detail fetch fails. Previously a silent return — user
          // taps Big Mac, nothing happens, taps again, still nothing.
          Alert.alert(
            "Couldn't load this item",
            "Please check your connection and try again, or pick another option.",
          );
          return;
        }
        const effectivePrimary = item.primaryServing ?? result.primaryPortion ?? null;
        const allPortions = buildPortions(result.portions, effectivePrimary);
        const { portion, quantity } = effectivePrimary
          ? { portion: allPortions[0], quantity: 1 }
          : resolveInitialPortion(allPortions, initialAmount, initialUnit);
        setPreview({
          name: item.name,
          source: "FatSecret",
          macrosPer100g: result.macrosPer100g,
          // 2026-05-06 — when `macrosPer100g` is null (FatSecret has
          // no metric grounding for this food, e.g. McDonald's Big
          // Mac), thread the per-serving payload so the commit path
          // can log "N × 1 serving" without scaling by grams.
          ...(result.macrosPerServing ? { macrosPerServing: result.macrosPerServing } : {}),
          // 2026-05-06 — pull through FatSecret Premier's wider
          // per-100g panel (sat/poly/mono fat, cholesterol, sodium,
          // potassium) so the meal-detail "Vitamins, minerals & more"
          // surface populates for FatSecret-sourced logs.
          ...(optionalSanitizedMicrosPer100g(result.microsPer100g)
            ? { microsPer100g: optionalSanitizedMicrosPer100g(result.microsPer100g) }
            : {}),
          // 2026-05-06 — per-serving micros for the no-metric path,
          // commit applies `× quantity` directly without gram scaling.
          ...(result.microsPerServing ? { microsPerServing: result.microsPerServing } : {}),
          portions: allPortions,
          chosenPortion: portion,
          quantity,
          quantityText: String(quantity),
          fatSecretFoodId: item._fatSecretFoodId,
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
          showLearnedReuseCue: isLearnedCustomFood(food),
        });
      } else {
        setLoadingKey(null);
      }
      } finally {
        setLoadingKey(null);
      }
    },
    [initialAmount, initialUnit],
  );

  /** ENG-931 — log default serving without opening preview (row body still opens preview). */
  const onQuickLogResult = useCallback(
    async (item: SearchRow) => {
      if (item._source === "CUSTOM") {
        await onPickResult(item);
        return;
      }
      setLoadingKey(item.key);
      try {
        const commit = (fields: Omit<SelectedFood, never>) => {
          onSelect(fields as SelectedFood);
        };

        if (
          (item._source === "GenericBeverage" || item._source === "GenericFood") &&
          item.macrosPer100g
        ) {
          const allPortions = buildPortions([], item.primaryServing);
          const { portion, quantity } = item.primaryServing
            ? { portion: allPortions[0], quantity: 1 }
            : resolveInitialPortion(allPortions, initialAmount, initialUnit);
          commit({
            name: item.name,
            source: "USDA",
            macrosPer100g: item.macrosPer100g,
            ...(item.microsPer100g ? { microsPer100g: item.microsPer100g } : {}),
            portions: allPortions,
            chosenPortion: portion,
            quantity,
          });
          return;
        }

        if (item._source === "OFF" && item.macrosPer100g) {
          const allPortions = buildPortions([], item.primaryServing);
          const { portion, quantity } = item.primaryServing
            ? { portion: allPortions[0], quantity: 1 }
            : resolveInitialPortion(allPortions, initialAmount, initialUnit);
          commit({
            name: item.name,
            source: "OFF",
            macrosPer100g: item.macrosPer100g,
            microsPer100g: item.microsPer100g,
            portions: allPortions,
            chosenPortion: portion,
            quantity,
            barcode: item._offCode,
            imageUrl: item.imageUrl,
          });
          return;
        }

        if (item._source === "USDA" && item._fdcId) {
          const result = await getFoodMacros(item._fdcId);
          const fields = buildUsdaPreviewFields(
            {
              name: item.name,
              fdcId: item._fdcId,
              macrosPer100g: item.macrosPer100g,
              microsPer100g: item.microsPer100g,
              primaryServing: item.primaryServing,
            },
            result,
            initialAmount,
            initialUnit,
          );
          if (!fields) {
            Alert.alert(
              "Couldn't load this item",
              "Please check your connection and try again, or pick another option.",
            );
            return;
          }
          commit({
            ...fields,
            quantity: fields.quantity,
          });
          return;
        }

        await onPickResult(item);
      } finally {
        setLoadingKey(null);
      }
    },
    [initialAmount, initialUnit, onPickResult, onSelect],
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
              showLearnedReuseCue: isLearnedCustomFood(updated),
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

  // Build the canonical SelectedFood payload from the current preview. Shared
  // by "Use this" (instant log) and "Add" (basket-stage, teardown #2) so the
  // two paths emit an identical selection — a basketed item logs exactly like
  // an instant-logged one. Fires the custom-food-logged analytics for the
  // CUSTOM source on either path.
  const buildSelectionFromPreview = useCallback((): SelectedFood | null => {
    if (!preview) return null;
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
    return {
      name: preview.name,
      source: preview.source,
      macrosPer100g: preview.macrosPer100g,
      ...(preview.macrosPerServing ? { macrosPerServing: preview.macrosPerServing } : {}),
      ...(preview.microsPer100g ? { microsPer100g: preview.microsPer100g } : {}),
      ...(preview.microsPerServing ? { microsPerServing: preview.microsPerServing } : {}),
      portions: preview.portions,
      chosenPortion: preview.chosenPortion,
      quantity: preview.quantity,
      fdcId: preview.fdcId,
      barcode: preview.barcode,
      ...(preview.customFoodId ? { customFoodId: preview.customFoodId } : {}),
      ...(preview.fatSecretFoodId ? { fatSecretFoodId: preview.fatSecretFoodId } : {}),
      ...(servingLabel ? { servingLabel } : {}),
      ...(preview.imageUrl ? { imageUrl: preview.imageUrl } : {}),
      ...(previewEatenAtEnabled && logDateKey
        ? { eatenAt: eatenAtFromLogDateAndTime(logDateKey, previewEatenAtTime) }
        : {}),
    };
  }, [preview, previewEatenAtEnabled, logDateKey, previewEatenAtTime]);

  const onConfirmPreview = useCallback(() => {
    const selection = buildSelectionFromPreview();
    if (!selection) return;
    onSelect(selection);
    setPreview(null);
  }, [buildSelectionFromPreview, onSelect]);

  // Multi-add basket (teardown #2): stage the current preview into the host's
  // basket and return to the results list (the sheet stays open). The host
  // commits the whole basket in one round-trip via the LogSheet basket bar.
  const onAddPreviewToBasket = useCallback(() => {
    if (!onAddToBasket) return;
    const selection = buildSelectionFromPreview();
    if (!selection) return;
    onAddToBasket(selection);
    setPreview(null);
  }, [buildSelectionFromPreview, onAddToBasket]);

  const previewMacros = useMemo(() => {
    if (!preview) return null;
    // 2026-05-06: per-serving-only path (FatSecret no-metric foods).
    // gramWeight: 0 + macrosPerServing populated → scale by quantity
    // directly without per-100g math.
    //
    // 2026-05-14: the original condition also required
    // `macrosPer100g === null`, which broke MIXED-grounding foods —
    // primary serving like "8 pieces" (no metric, gramWeight 0) on a
    // food that also has metric servings (per-100g exists). The server
    // now populates `macrosPerServing` for every FatSecret food, and
    // the per-serving branch fires whenever the chosen portion has
    // gramWeight 0. Per-100g math still runs for any portion that DOES
    // have a gram weight (g/oz/lb/etc.).
    // ENG-745: one shared predicate across preview + both commits.
    if (
      isPerServingPortion({
        gramWeight: preview.chosenPortion.gramWeight,
        hasMacrosPerServing: Boolean(preview.macrosPerServing),
      })
    ) {
      // 2026-05-15: `servingFraction` lets a derived "1 piece" portion
      // scale macros to 1/N of the FatSecret per-serving payload. The
      // primary "N pieces" portion keeps servingFraction = 1 (full
      // serving). Default 1 for back-compat with older portion data.
      const fraction = preview.chosenPortion.servingFraction ?? 1;
      const q = preview.quantity * fraction;
      const ps = preview.macrosPerServing!;
      // 2026-05-06 audit (D3): pull fiber / sugar / sodium from
      // `microsPerServing` when available so the preview tile
      // matches the meal-detail panel that ultimately gets persisted.
      // Was hardcoded to 0 — preview tile reads "Fiber 0g · Sugar 0g
      // · Sodium 0mg" momentarily for FatSecret per-serving foods
      // even though those values exist in the Premier panel.
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
    const grams = preview.chosenPortion.gramWeight * preview.quantity;
    return scaleMacrosByGrams(preview.macrosPer100g, grams);
  }, [preview]);

  const totalGrams = useMemo(() => {
    if (!preview) return 0;
    return Math.round(preview.chosenPortion.gramWeight * preview.quantity * 10) / 10;
  }, [preview]);

  const previewExtraMicroRows = useMemo(
    () =>
      preview && previewMacros
        ? foodSearchPreviewExtraMicroRows({
            scaledMacros: previewMacros,
            microsPer100g: preview.microsPer100g,
            microsPerServing: preview.microsPerServing,
            hasMacrosPerServing: Boolean(preview.macrosPerServing),
            chosenPortion: preview.chosenPortion,
            quantity: preview.quantity,
          })
        : [],
    [preview, previewMacros],
  );

  const previewPlausibilityWarning = useMemo(
    () =>
      foodSearchPreviewPlausibilityWarning(
        preview?.macrosPer100g ?? null,
        previewMacros,
        totalGrams,
      ),
    [preview?.macrosPer100g, previewMacros, totalGrams],
  );

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

  // ENG-854 — "how much of THIS fits what's left?" body-neutral line.
  // Default-OFF flag; all math + copy live in `portionFitHintForPreview`
  // (no fabricated gram number when confidence is low). Mirrors web.
  const portionFitHintText = useMemo(
    () =>
      isFeatureEnabled("portion_fit_hint_v1")
        ? portionFitHintForPreview(macroTargets, macroConsumed, preview)
        : null,
    [macroTargets, macroConsumed, preview],
  );

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

  // Log a "Recent" / "Past logged" history row directly — per-serving food,
  // no per-100g basis, so the host commit path uses macrosPerServing ×
  // quantity. Single source of truth for both the empty-query recents strip
  // and the typed-query "Past logged" group (ENG-1033), so the two paths
  // can't drift in what they commit.
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
        source: (item.source as never) ?? "history",
        macrosPer100g: null,
        macrosPerServing: {
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiberG: item.fiber ?? 0,
          sugarG: 0,
          sodiumMg: 0,
        },
        quantity: 1,
        chosenPortion: { label: "1 serving", gramWeight: 0 },
        portions: [{ label: "1 serving", gramWeight: 0 }],
        ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      } as never);
    },
    [onSelect],
  );

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
    // ENG-1038 — graceful-degradation notice. Amber (warning) family: this is
    // an advisory "some sources paused", not an error (never destructive red).
    degradedNotice: {
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Accent.warning,
      backgroundColor: Accent.warning + "14",
    },
    degradedNoticeText: {
      color: Accent.warningSolid,
      fontSize: 13,
      lineHeight: 18,
    },
  }), [colors, mode]);

  const renderItem = useCallback(
    ({ item }: { item: SearchRow }) => {
      const isLoading = loadingKey === item.key;
      const isCustom = item._source === "CUSTOM";
      const customFood = isCustom ? item._custom : null;
      const headline = resolveFoodSearchHeadline(item);
      const primary = item.primaryServing ?? null;

      return (
        <View style={styles.resultRow}>
          <Pressable
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.md }}
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, flexWrap: "wrap" }}>
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
                    <Text style={[styles.macroPreviewText, { color: mc.protein }]}>P {headline.macros.protein}g</Text>
                    <Text style={[styles.macroPreviewText, { color: mc.carbs }]}>C {headline.macros.carbs}g</Text>
                    <Text style={[styles.macroPreviewText, { color: mc.fat }]}>F {headline.macros.fat}g</Text>
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
                    <Text style={[styles.macroPreviewText, { color: mc.protein }]}>P {headline.macros.protein}g</Text>
                    <Text style={[styles.macroPreviewText, { color: mc.carbs }]}>C {headline.macros.carbs}g</Text>
                    <Text style={[styles.macroPreviewText, { color: mc.fat }]}>F {headline.macros.fat}g</Text>
                  </View>
                  <Text style={styles.per100g}>{FOOD_SEARCH_PER_100G_BADGE}</Text>
                </>
              ) : headline.mode === "per-100g" ? (
                <Text style={styles.per100g}>{FOOD_SEARCH_PER_100G_BADGE}</Text>
              ) : (
                <Text style={styles.per100g}>Tap for nutrition info</Text>
              )}
              {customFood && isLearnedCustomFoodSource(customFood.source) ? (
                <Text
                  testID="learned-custom-food-cue"
                  style={{ fontSize: 11, fontStyle: "italic", color: colors.textSecondary, marginTop: 2 }}
                >
                  {LEARNED_CUSTOM_FOOD_REUSE_CUE}
                </Text>
              ) : null}
            </View>
            {headline.mode !== "placeholder" && !isLoading ? (
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"], marginRight: 4 }}>{headline.headlineKcal}</Text>
            ) : null}
          </Pressable>
          {isLoading ? (
            <ActivityIndicator size="small" color={accent.primary} />
          ) : item._source !== "CUSTOM" ? (
            <Pressable
              onPress={() => void onQuickLogResult(item)}
              accessibilityRole="button"
              accessibilityLabel={`Quick log ${item.name} at default serving`}
              testID={`food-search-quick-log-${item.key}`}
              hitSlop={8}
              style={{ padding: 4 }}
            >
              <Plus size={18} color={accent.primarySolid} strokeWidth={2.5} />
            </Pressable>
          ) : (
            <ChevronRight size={16} color={colors.textTertiary} />
          )}
        </View>
      );
    },
    [loadingKey, onPickResult, onQuickLogResult, colors, accent, openCustomFoodActions, styles],
  );

  // ── History-first search (ENG-1033) ──────────────────────────────────
  // MFP grammar: when the user has TYPED a query, surface matching items from
  // their own logging history FIRST, as a visually-distinct "Past logged"
  // group above the database results. `recentFoods` already carries the
  // user's history newest-first (computeRecentMeals); the shared matcher
  // ranks + de-dupes + caps it. The group renders only on the All/Recents
  // filters (Branded/Generic/Custom intents are explicitly "search-result
  // shape" and shouldn't be topped with history). Web sections identically
  // off the same shared functions — parity.
  const historyMatches = useMemo<HistorySearchMatch[]>(() => {
    if (!query.trim() || !recentFoods || recentFoods.length === 0) return [];
    if (activeCategory !== "All" && activeCategory !== "Recents") return [];
    return matchHistoryFoods(recentFoods, query);
  }, [query, recentFoods, activeCategory]);

  // ── Favourites-in-search (teardown #1, ENG-1041) ─────────────────────
  // The set of favourite keys drives the per-row star state (filled vs
  // outline) on every history-style row, with no per-row Supabase call.
  const favoriteKeys = useMemo(
    () => favoriteFoodKeySet(favoriteFoods ?? []),
    [favoriteFoods],
  );
  // Typed-query "Favourites" group — favourites matching the query, ranked +
  // capped by the shared matcher, rendered ABOVE "Past logged". Same gate as
  // the history group (All / Recents filters only).
  const favoriteMatches = useMemo<FavoriteSearchMatch[]>(() => {
    if (!query.trim() || !favoriteFoods || favoriteFoods.length === 0) return [];
    if (activeCategory !== "All" && activeCategory !== "Recents") return [];
    return matchFavoriteFoods(favoriteFoods, query);
  }, [query, favoriteFoods, activeCategory]);
  // De-dupe: a food that's BOTH a favourite and in recent history shows once,
  // in the Favourites group (favourites win — the user deliberately starred
  // it). Suppress it from "Past logged" by key.
  const favoriteMatchKeys = useMemo(
    () => new Set(favoriteMatches.map((m) => favoriteKey(m.item.recipeTitle, m.item.calories))),
    [favoriteMatches],
  );
  const historyMatchesDeduped = useMemo<HistorySearchMatch[]>(() => {
    if (favoriteMatchKeys.size === 0) return historyMatches;
    return historyMatches.filter(
      (m) => !favoriteMatchKeys.has(favoriteKey(m.item.recipeTitle, m.item.calories)),
    );
  }, [historyMatches, favoriteMatchKeys]);

  // Toggle a star from any history-style row. Resolve the favourite id (when
  // unstarring) from the favourites list so the host can remove by id.
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
  const dedupedResults = useMemo<SearchRow[]>(() => {
    if (historyNames.size === 0) return results;
    return dedupeDbAgainstHistory(results, historyNames, (r) => normalizeHistoryName(r.name));
  }, [results, historyNames]);

  // 2026-05-14 premium-bar polish #3: derive the filtered list once
  // per render. `All` is identity. `Recents` suppresses results so
  // only the recent-foods block above shows. `Custom`, `Branded`,
  // `Generic` filter by `_source`. (Favourites removed — see ENG-748 #8.)
  // Operates over `dedupedResults` so the "Past logged" group never repeats
  // below in the database list (ENG-1033, history wins).
  const filteredResults = useMemo<SearchRow[]>(() => {
    switch (activeCategory) {
      case "Recents":
        return [];
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
  // Recent-foods strip visibility — the block only renders when the
  // user is on `All` or `Recents` (and the query is empty). On other
  // tabs the filter intent is "search-result-shape", so suppressing
  // Recents keeps the surface coherent.
  const showRecentFoodsBlock =
    !query.trim() &&
    !!recentFoods &&
    recentFoods.length > 0 &&
    (activeCategory === "All" || activeCategory === "Recents");
  // Empty-query "Recent" strip ordered favourites-first (teardown #1) —
  // starred foods lead, then the rest of recents in their existing recency
  // order. A no-op when the user has no favourites.
  const recentFoodsOrdered = useMemo(
    () => orderRecentWithFavoritesFirst(recentFoods ?? [], favoriteKeys),
    [recentFoods, favoriteKeys],
  );

  // ── Redesign (ENG-814) — unified segmented control + sectioned cards ──
  // The redesigned filter uses the prototype's friendlier wording while
  // every segment stays backed by the SAME real `FoodCategory` filter — no
  // dead affordance (cf. the favourites tab removed in ENG-748 #8). There
  // is deliberately no "Saved meals" segment here: saved-meals data lives
  // in the LogSheet browse grammar (a sibling surface/ticket), NOT in this
  // panel, so adding one would render a no-op. The unified label is purely
  // presentational over the existing internal value.
  const UNIFIED_LABEL: Record<FoodCategory, string> = {
    All: "All",
    Recents: "Recent",
    Custom: "My foods",
    Branded: "Branded",
    Generic: "Generic",
  };

  // Split the (already-ranked, already-filtered) result list into the
  // prototype's "Best matches" / "More results" sections using the SHARED
  // scorer (`splitFoodSearchResults` → `splitBestMatches`). Web sections
  // identically off the same function, so the two surfaces never drift.
  // Only computed on the redesigned path; falls back to a single Best
  // section otherwise (the flat list ignores it).
  const sectionedResults = useMemo(
    () =>
      redesignSearch
        ? splitFoodSearchResults(query.trim(), filteredResults as UnifiedSearchResult[])
        : { best: [] as UnifiedSearchResult[], more: [] as UnifiedSearchResult[] },
    [redesignSearch, query, filteredResults],
  );

  /** ENG-1121 — FatSecret attribution when branded rows or premier autocomplete show. */
  const showFatSecretAttribution = useMemo(() => {
    if (preview?.source === "FatSecret") return true;
    if (results.some((r) => r._source === "FatSecret")) return true;
    if (
      autocomplete.tier === "premier" &&
      autocomplete.suggestions.length > 0 &&
      query.trim()
    ) {
      return true;
    }
    return false;
  }, [preview, results, autocomplete, query]);

  // Flatten the best/more sections into an ordered FlatList feed of
  // discriminated render-rows so pagination (`onEndReached`), the empty
  // state and the footer all stay on the SAME FlatList as the flat path.
  // Each data row carries its section + within-card position so the card
  // renderer can draw the soft-elevated wrapper + section header + inset
  // seam without grouping support in FlatList.
  const redesignFeed = useMemo<RenderRow[]>(() => {
    if (!redesignSearch) return [];
    const feed: RenderRow[] = [];
    const pushSection = (label: string, rows: SearchRow[]) => {
      if (rows.length === 0) return;
      feed.push({ kind: "header", key: `header-${label}`, label });
      rows.forEach((row, i) => {
        feed.push({
          kind: "row",
          key: row.key,
          row,
          isFirst: i === 0,
          isLast: i === rows.length - 1,
        });
      });
    };
    pushSection("Best matches", sectionedResults.best as SearchRow[]);
    pushSection("More results", sectionedResults.more as SearchRow[]);
    return feed;
  }, [redesignSearch, sectionedResults]);

  // The legible confidence chip is the canonical shared
  // `<SearchResultConfidenceChip>` (also used by the barcode + voice-log
  // result surfaces) so the chip language can't drift between logging entry
  // points. The tier is computed upstream (ENG-807) from BOTH provenance AND
  // the name match — never source alone — so "Verified" is always backed by a
  // real signal (CLAUDE.md trust posture). A defensively-absent tier falls
  // back to the CONSERVATIVE "Estimated" label — never "Verified" — so a
  // missing signal can never over-claim trust. Matches the web sibling
  // (ENG-815).
  const renderConfidenceChip = useCallback(
    (tier: SearchRowConfidenceTier | undefined) => (
      <SearchResultConfidenceChip tier={tier === "verified" ? "verified" : "estimated"} />
    ),
    [],
  );

  // Grouped-card result row (redesign path). Same tap target + a11y as the
  // flat row, but framed inside a soft-elevated card with the confidence
  // chip on the topline and a faint inset seam between rows (not a hairline
  // divider). `isFirst` suppresses the seam on the first row of a card.
  const renderCardRow = useCallback(
    (item: SearchRow, isFirst: boolean) => {
      const isLoading = loadingKey === item.key;
      const isCustom = item._source === "CUSTOM";
      const customFood = isCustom ? item._custom : null;
      const headline = resolveFoodSearchHeadline(item);
      const primary = item.primaryServing ?? null;
      return (
        <Pressable
          key={item.key}
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
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            borderTopWidth: isFirst ? 0 : StyleSheet.hairlineWidth,
            borderTopColor: colors.cardBorder,
            backgroundColor: pressed ? colors.background : "transparent",
          })}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, flexWrap: "wrap" }}>
              {isCustom && <Badge variant="custom">Custom</Badge>}
              {renderConfidenceChip(item.confidenceTier)}
              <Text style={styles.resultName} numberOfLines={2}>
                {item.name}
              </Text>
            </View>
            {headline.mode === "per-serving" ? (
              <>
                <View style={styles.macroPreview}>
                  <Text style={[styles.macroPreviewText, { color: mc.protein }]}>P {headline.macros.protein}g</Text>
                  <Text style={[styles.macroPreviewText, { color: mc.carbs }]}>C {headline.macros.carbs}g</Text>
                  <Text style={[styles.macroPreviewText, { color: mc.fat }]}>F {headline.macros.fat}g</Text>
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
                  <Text style={[styles.macroPreviewText, { color: mc.protein }]}>P {headline.macros.protein}g</Text>
                  <Text style={[styles.macroPreviewText, { color: mc.carbs }]}>C {headline.macros.carbs}g</Text>
                  <Text style={[styles.macroPreviewText, { color: mc.fat }]}>F {headline.macros.fat}g</Text>
                </View>
                <Text style={styles.per100g}>{FOOD_SEARCH_PER_100G_BADGE}</Text>
              </>
            ) : headline.mode === "per-100g" ? (
              <Text style={styles.per100g}>{FOOD_SEARCH_PER_100G_BADGE}</Text>
            ) : (
              <Text style={styles.per100g}>Tap for nutrition info</Text>
            )}
            {customFood && isLearnedCustomFoodSource(customFood.source) ? (
              <Text
                testID="learned-custom-food-cue"
                style={{ fontSize: 11, fontStyle: "italic", color: colors.textSecondary, marginTop: 2 }}
              >
                {LEARNED_CUSTOM_FOOD_REUSE_CUE}
              </Text>
            ) : null}
          </View>
          {headline.mode !== "placeholder" && !isLoading ? (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>
                {headline.headlineKcal}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.4 }}>KCAL</Text>
            </View>
          ) : null}
          {isLoading ? (
            <ActivityIndicator size="small" color={accent.primary} />
          ) : (
            <ChevronRight size={16} color={colors.textTertiary} />
          )}
        </Pressable>
      );
    },
    [loadingKey, onPickResult, openCustomFoodActions, renderConfidenceChip, colors, styles],
  );

  // FlatList renderItem for the redesigned, sectioned feed. Headers render
  // the uppercase section label; rows render `renderCardRow` wrapped in a
  // per-section soft-elevated card (rounded top on the first row, rounded
  // bottom on the last, so contiguous rows read as one pressable card).
  const renderRedesignItem = useCallback(
    ({ item }: { item: RenderRow }) => {
      if (item.kind === "header") {
        return (
          <Text
            testID={`food-search-section-${item.label === "Best matches" ? "best" : "more"}`}
            style={{
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 0.6,
              color: colors.textTertiary,
              textTransform: "uppercase",
              marginTop: Spacing.md,
              marginBottom: Spacing.sm,
              marginHorizontal: 2,
            }}
          >
            {item.label}
          </Text>
        );
      }
      // Soft-elevated grouped card. The shadow lives on the same View as the
      // row content (no `overflow: hidden`, so iOS shadows are not clipped);
      // corner radius is applied per card-position so the section reads as a
      // single card. Dark mode uses the tonal lift + hairline (per
      // `useCardElevation`); light mode uses the soft shadow.
      return (
        <View
          style={[
            {
              backgroundColor: cardElevation.liftBg ?? colors.card,
              borderTopLeftRadius: item.isFirst ? Radius.lg : 0,
              borderTopRightRadius: item.isFirst ? Radius.lg : 0,
              borderBottomLeftRadius: item.isLast ? Radius.lg : 0,
              borderBottomRightRadius: item.isLast ? Radius.lg : 0,
              borderLeftWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
              borderRightWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
              borderTopWidth: cardElevation.useBorder && item.isFirst ? StyleSheet.hairlineWidth : 0,
              borderBottomWidth: cardElevation.useBorder && item.isLast ? StyleSheet.hairlineWidth : 0,
              borderColor: colors.cardBorder,
            },
            // Apply the soft shadow only on the first row of a card; a single
            // shadow on the top row reads as the card's lift without stacking
            // four overlapping shadows down the group.
            item.isFirst ? cardElevation.shadowStyle : undefined,
          ]}
        >
          {renderCardRow(item.row, item.isFirst)}
        </View>
      );
    },
    [renderCardRow, cardElevation, colors],
  );

  // Locale-resolved hint flag (2026-04-26 — Premier Free is US-only).
  // Hoisted ABOVE the preview-mode early return so React's hook-order
  // invariant survives the user toggling into and out of preview mode.
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

  // Preview overlays the list when set. Caller's wrapping View should
  // give the panel `flex: 1` so the FlatList / ScrollView can scroll
  // independently of the caller's surrounding chrome.
  if (preview && previewMacros) {
    const previewHorizontalPad = mode === "compact" ? Spacing.md : Spacing.xl;
    return (
      <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: previewHorizontalPad,
          paddingTop: Spacing.lg,
          paddingBottom: Spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{
          backgroundColor: colors.card, borderRadius: Radius.lg,
          borderWidth: 1, borderColor: Accent.success + "40",
          padding: Spacing.xl, gap: Spacing.md,
        }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{preview.name}</Text>

          {preview.showLearnedReuseCue ? (
            <Text
              testID="learned-custom-food-cue"
              style={{ fontSize: 13, fontStyle: "italic", color: colors.textSecondary }}
            >
              {LEARNED_CUSTOM_FOOD_REUSE_CUE}
            </Text>
          ) : null}

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
                      paddingHorizontal: Spacing.dense, paddingVertical: 8,
                      borderRadius: Radius.md, borderWidth: 1,
                      borderColor: isActive ? commitCtaColor : colors.border,
                      backgroundColor: isActive ? commitCtaColor + "15" : "transparent",
                      minWidth: 50, alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: isActive ? "700" : "500", color: isActive ? commitCtaColor : colors.text }}>
                      {p.label}
                    </Text>
                    {p.gramWeight !== 1 && p.gramWeight > 0 && (
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
              style={{ width: 36, height: 36, borderRadius: Radius.full, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
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
              style={{ width: 36, height: 36, borderRadius: Radius.full, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
            >
              <Plus size={18} color={colors.text} />
            </Pressable>
            <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
              {portionEqualsLabel({
                quantity: preview.quantity,
                label: preview.chosenPortion.label,
                gramWeight: preview.chosenPortion.gramWeight,
                totalGrams,
              })}
            </Text>
          </View>

          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1, marginTop: Spacing.xs }}>
            NUTRITION
          </Text>
          <ConfirmFoodMacroPreview
            calories={previewMacros.calories}
            proteinG={previewMacros.protein}
            carbsG={previewMacros.carbs}
            fatG={previewMacros.fat}
          />
          <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
            {[
              ...(previewMacros.fiberG > 0 ? [["Fibre", `${previewMacros.fiberG} g`]] : []),
              ...(previewMacros.sugarG > 0 ? [["Sugar", `${previewMacros.sugarG} g`]] : []),
              ...(previewMacros.sodiumMg > 0 ? [["Sodium", `${previewMacros.sodiumMg} mg`]] : []),
              ...previewExtraMicroRows.map((r) => [r.label, r.value] as const),
            ].map(([label, val]) => (
              <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>{label}</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{val}</Text>
              </View>
            ))}
          </View>
          {previewPlausibilityWarning ? (
            <Text
              accessibilityRole="alert"
              style={{ fontSize: 12, color: mc.calories, marginTop: Spacing.sm }}
            >
              {previewPlausibilityWarning}
            </Text>
          ) : null}
          {fitHint ? (
            <View
              accessible
              accessibilityRole="summary"
              accessibilityLabel="Projected remaining macros after logging this portion"
              style={{ marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}
            >
              <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.8, color: colors.textTertiary, marginBottom: 4, textTransform: "uppercase" }}>If you log this</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: Spacing.dense, rowGap: 4 }}>
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
                    <Text style={{ fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"], color: m.over ? Accent.destructive : colors.text }}>
                      {m.over ? `+${Math.abs(m.delta)}` : m.value}{m.unit}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>{m.label}</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>{m.over ? "over" : "left"}</Text>
                  </View>
                ))}
              </View>
              {portionFitHintText ? (
                <Text accessibilityLabel={portionFitHintText} style={{ fontSize: 12, color: colors.textSecondary, marginTop: Spacing.sm }}>
                  {portionFitHintText}
                </Text>
              ) : null}
            </View>
          ) : null}
          {previewEatenAtEnabled ? (
            <>
              {/* Token retrofit (audit 2026-06-12 P2): the `fontSize:11 /
                  fontWeight:"700"` uppercase label was the value-identical
                  `Type.label` ramp step (11/700, uppercase). Swapped — colour +
                  marginTop stay call-site overrides. letterSpacing snaps 1 →
                  0.88 (the token's 0.08em, sub-perceptible at 11px). */}
              <Text style={{ ...Type.label, color: colors.textTertiary, marginTop: Spacing.xs }}>
                TIME EATEN
              </Text>
              <TextInput
                value={previewEatenAtTime}
                onChangeText={setPreviewEatenAtTime}
                placeholder="HH:mm (24h)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="Time eaten"
                style={{
                  backgroundColor: colors.background,
                  borderRadius: Radius.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                  color: colors.text,
                  // `fontWeight` snapped to the `FontWeight.semibold` token.
                  // `fontSize: 16` kept deliberately — it's the iOS no-zoom
                  // input size (≥16 prevents focus zoom), and there is no
                  // value-identical Type token at 16 (ramp is 14/17/20).
                  fontSize: 16,
                  fontWeight: FontWeight.semibold,
                }}
              />
            </>
          ) : null}
          {preview.source === "FatSecret" ? (
            <FatSecretBadge variant="text" testID="food-search-fatsecret-badge" />
          ) : null}
        </View>
      </ScrollView>
      {/* ENG-1054 — pin commit CTAs above the keyboard / fold so "Use this"
          stays visible without scrolling past nutrition + fit-hint rows. */}
      <View
        testID="food-search-preview-sticky-footer"
        style={{
          paddingHorizontal: previewHorizontalPad,
          paddingTop: Spacing.sm,
          paddingBottom: Spacing.lg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          gap: Spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", gap: Spacing.md }}>
          <Pressable
            testID="food-search-preview-use-this"
            style={{ flex: 1, backgroundColor: commitCtaColor, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: Spacing.sm }}
            onPress={onConfirmPreview}
          >
            <Check size={18} color={colors.primaryForeground} />
            <Text style={{ color: colors.primaryForeground, fontWeight: "700", fontSize: 15 }}>Use this</Text>
          </Pressable>
          {onAddToBasket ? (
            // Sloe button-system canon (2026-06-12): "Add" is the secondary
            // basket-stage action sitting beside the dominant solid "Use this"
            // log commit — so it is variant="ghost" (transparent, NO border,
            // plum label + plum icon), the treatment that retires the old
            // aubergine OUTLINE. NOT primary: two solid CTAs in one row would
            // break the one-filled-CTA rule and erase the log/stage hierarchy.
            <SupprButton
              variant="ghost"
              testID="food-search-preview-add-to-basket"
              accessibilityLabel={`Add ${preview.name} to basket`}
              style={{ flex: 1 }}
              onPress={onAddPreviewToBasket}
            >
              <Plus size={18} color={accent.primarySolid} />
              <Text style={{ color: accent.primarySolid, fontWeight: "700", fontSize: 15, marginLeft: Spacing.sm }}>Add</Text>
            </SupprButton>
          ) : null}
        </View>
        <Pressable
          style={{ borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: "center" }}
          onPress={() => setPreview(null)}
        >
          <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>Back to results</Text>
        </Pressable>
      </View>
      </View>
    );
  }

  // Shared no-result empty state + persistent footer, lifted out of the
  // FlatList props so BOTH the flat (flag-off) and sectioned (flag-on)
  // FlatLists render the identical empty state, the same two CTAs, the same
  // dictionary-add event, the inline confirmation and the barcode-fallback
  // hint — no behaviour divergence between paths.
  const renderEmptyState =
    !loading && query.trim() ? (
      <View
        testID="food-search-no-result-empty-state"
        style={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, gap: Spacing.md }}
      >
        <Text style={styles.emptyText}>
          No results for &quot;{query}&quot;.
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: colors.textTertiary,
            textAlign: "center",
            marginTop: -Spacing.sm,
          }}
        >
          {customEnabled
            ? "Add it yourself, or let us know we should."
            : "Try a simpler or more specific term."}
        </Text>
        {/* No-result loop (audit move-blocker #2, 2026-05-02 —
            replaces stale PR #36): two-CTA empty state. The
            "Add as custom food" CTA routes to the existing
            CreateCustomFoodSheet flow (the same path the
            persistent footer button uses) with the query
            pre-filled. The "Tell us we&apos;re missing this"
            CTA fires a dedicated PostHog event so the
            dictionary-backfill workstream knows which queries
            to prioritise. It is NOT a bug report — the user
            can keep going by adding the food themselves. */}
        {customEnabled ? (
          <Pressable
            onPress={() => {
              setEditingFood(undefined);
              setCreateOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Add "${query}" as a custom food`}
            testID="food-search-no-result-add-custom"
            style={{
              paddingVertical: Spacing.md,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: Spacing.sm,
              borderWidth: 1,
              borderColor: accent.primary,
              borderRadius: Radius.md,
              backgroundColor: accent.primary + "10",
            }}
          >
            <Plus size={16} color={accent.primary} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: accent.primary }}>
              Add as custom food
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => {
            const q = query.trim();
            if (!q) return;
            const dedupKey = q.toLowerCase();
            if (dictionaryAddRequestedRef.current === dedupKey) return;
            dictionaryAddRequestedRef.current = dedupKey;
            setDictionaryAddRequested(q);
            track(AnalyticsEvents.food_search_request_dictionary_add, {
              query: q,
              len: q.length,
              source: "mobile",
            });
          }}
          accessibilityRole="button"
          accessibilityLabel="Tell us we're missing this food"
          testID="food-search-no-result-request-add"
          style={{
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
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textSecondary }}>
            Tell us we&apos;re missing this
          </Text>
        </Pressable>
        {/* Inline confirmation row — softer than a native
            Alert (Grace, 2026-05-02). Dismisses implicitly
            when the query changes (the ref + state both
            reset on a fresh empty state for a new query). */}
        {dictionaryAddRequested && dictionaryAddRequested === query.trim() ? (
          <View
            accessibilityRole="text"
            accessible
            testID="food-search-no-result-request-confirmation"
            style={{
              paddingVertical: Spacing.sm,
              paddingHorizontal: Spacing.md,
              borderRadius: Radius.md,
              backgroundColor: Accent.success + "15",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: Spacing.sm,
            }}
          >
            <Text style={{ flex: 1, fontSize: 12, color: Accent.success, fontWeight: "600" }}>
              Thanks — we&apos;ll prioritise adding this to our food database.
            </Text>
            <Pressable
              onPress={() => setDictionaryAddRequested(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss confirmation"
              hitSlop={8}
              testID="food-search-no-result-request-confirmation-dismiss"
            >
              <Text style={{ fontSize: 12, color: Accent.success, fontWeight: "700" }}>
                Dismiss
              </Text>
            </Pressable>
          </View>
        ) : null}
        {showBarcodeFallbackHint ? (
          <Pressable
            testID="food-search-barcode-fallback-hint"
            accessibilityRole="button"
            accessibilityLabel="Scan a barcode — works for UK and EU products"
            onPress={onScanBarcodePressed}
            style={{
              marginTop: Spacing.sm,
              paddingVertical: Spacing.dense,
              paddingHorizontal: Spacing.dense,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: Radius.md,
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.sm,
              backgroundColor: colors.card,
            }}
          >
            <Barcode size={20} color={accent.primary} />
            <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>
              Brand not found? Try a barcode scan — works for UK &amp; EU products
            </Text>
            <ChevronRight size={16} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
    ) : null;

  const renderListFooter = (
    <View>
      {loadingMore ? (
        <View style={{ paddingVertical: Spacing.md, alignItems: "center" }}>
          <ActivityIndicator size="small" color={accent.primary} />
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
          <Plus size={16} color={accent.primary} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: accent.primary }}>
            Create custom food
          </Text>
        </Pressable>
      ) : null}
      {showFatSecretAttribution ? (
        <FatSecretBadge
          variant="text"
          testID="food-search-fatsecret-badge"
          style={{ marginTop: Spacing.md }}
        />
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* 2026-05-14 premium-bar polish #3: category-filter pill row.
          Horizontal scroll so the six chips fit on every device width.
          Active pill uses the brand primary fill; inactive pills sit
          quiet on a transparent background with the standard border.
          Filter logic lives in `filteredResults` above. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // 2026-05-16 fix: without `flexGrow: 0`, this horizontal
        // ScrollView (sitting inside the `flex: 1` outer View) expanded
        // to fill the entire vertical space, which forced each child
        // Pressable to stretch full-height and made the pill row
        // dominate the whole sheet (Grace TF screenshot 2026-05-16).
        // `flexGrow: 0` sizes the strip to its content, and
        // `alignItems: "center"` on the content container is a belt-
        // and-braces guard so the pills never expand vertically even
        // if a future parent layout change reintroduces growth.
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.sm,
          paddingBottom: Spacing.xs,
          gap: 8,
          alignItems: "center",
        }}
        keyboardShouldPersistTaps="handled"
        testID="food-search-category-tabs"
      >
        {CATEGORY_LIST.map((cat) => {
          const isActive = cat === activeCategory;
          // Redesign (ENG-814): one unified segmented control — softly
          // elevated rounded-rect segments with the prototype's friendlier
          // labels. Flag OFF keeps the existing full-pill chips. Same
          // underlying `activeCategory` filter in both paths.
          if (redesignSearch) {
            const liftStyle =
              cardElevation.shadowStyle && !isActive ? cardElevation.shadowStyle : undefined;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                accessibilityRole="button"
                accessibilityLabel={`${UNIFIED_LABEL[cat]} foods`}
                accessibilityState={{ selected: isActive }}
                testID={`food-search-category-${cat}`}
                hitSlop={6}
                style={[
                  {
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor: isActive ? accent.primary : colors.cardBorder,
                    backgroundColor: isActive ? accent.primary : colors.card,
                  },
                  liftStyle,
                ]}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: isActive ? accent.primaryForeground : colors.textSecondary,
                    letterSpacing: 0.2,
                  }}
                >
                  {UNIFIED_LABEL[cat]}
                </Text>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={cat}
              onPress={() => setActiveCategory(cat)}
              accessibilityRole="button"
              accessibilityLabel={`${cat} foods`}
              accessibilityState={{ selected: isActive }}
              testID={`food-search-category-${cat}`}
              hitSlop={6}
              style={{
                paddingHorizontal: Spacing.dense,
                paddingVertical: Spacing.sm,
                borderRadius: Radius.full,
                borderWidth: 1,
                borderColor: isActive ? accent.primary : colors.border,
                backgroundColor: isActive ? accent.primary : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: isActive ? accent.primaryForeground : colors.textSecondary,
                  letterSpacing: 0.2,
                }}
              >
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Premier-tier autocomplete typeahead row. Hidden on Basic. */}
      {autocomplete.tier === "premier" && autocomplete.suggestions.length > 0 && query.trim() ? (
        <View
          testID="fatsecret-autocomplete-row"
          accessibilityRole="list"
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            paddingHorizontal: Spacing.md,
            paddingTop: Spacing.sm,
            gap: Spacing.sm,
          }}
        >
          {autocomplete.suggestions.map((s) => (
            <View
              key={s}
              accessibilityRole="text"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.cardBorder,
                borderRadius: Radius.full,
                paddingVertical: 4,
                paddingHorizontal: Spacing.dense,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* 2026-05-12 round 5 (premium-bar audit #12, MFP borrow):
          Recent foods on mount. When the query is empty AND the host
          passed in recentFoods, render them as a tap-to-log list.
          Suppresses if query is non-empty (search results take over)
          or if no recents are supplied. The first 5 are rendered to
          keep the list scannable; if the user wants more they can
          type or tap into Recents on the canonical LogSheet. */}
      {showRecentFoodsBlock && recentFoods ? (
        <View
          style={{
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.sm,
            paddingBottom: Spacing.md,
          }}
          testID="food-search-recent-foods"
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            Recent
          </Text>
          {recentFoodsOrdered.slice(0, 5).map((item, i) => {
            const starred = isFavoriteRow(favoriteKeys, item.recipeTitle, item.calories);
            const pending = favoritePendingKeys?.has(
              favoriteKey(item.recipeTitle, item.calories),
            );
            return (
              <Pressable
                key={`recent-${i}-${item.recipeTitle}`}
                testID={`food-search-recent-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`Log ${item.recipeTitle}, ${Math.round(item.calories)} calories`}
                onPress={() => onSelectHistoryItem(item)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: Spacing.dense,
                  borderBottomWidth:
                    i < Math.min(4, recentFoodsOrdered.length - 1)
                      ? StyleSheet.hairlineWidth
                      : 0,
                  borderBottomColor: colors.border,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{ fontSize: 15, fontWeight: "600", color: colors.text }}
                    numberOfLines={1}
                  >
                    {item.recipeTitle}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 2,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {formatMacroTrailer({
                      calories: item.calories,
                      protein: item.protein,
                      carbs: item.carbs,
                      fat: item.fat,
                    })}
                  </Text>
                </View>
                {onToggleFavorite ? (
                  <FavoriteStarButton
                    starred={starred}
                    pending={pending}
                    onToggle={() => toggleFavoriteFor(item)}
                    testID={`food-search-recent-${i}-star`}
                  />
                ) : null}
                <Text style={{ fontSize: 13, color: colors.textTertiary, marginLeft: 8 }}>
                  ›
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Favourites-in-search (teardown #1, ENG-1041, MFP/Lifesum grammar):
          when the user has TYPED a query, the foods they've STARRED that match
          it surface in a "Favourites" group ABOVE "Past logged" — the curated
          set leads the recall set. Same row grammar (title + macro trailer +
          star + chevron) so the three history-style groups read identically. */}
      {favoriteMatches.length > 0 ? (
        <View
          style={{
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.sm,
            paddingBottom: Spacing.md,
          }}
          testID="food-search-favourites"
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            Favourites
          </Text>
          {favoriteMatches.map((m, i) => {
            const item = m.item;
            const pending = favoritePendingKeys?.has(
              favoriteKey(item.recipeTitle, item.calories),
            );
            return (
              <Pressable
                key={`fav-${m.key}`}
                testID={`food-search-favourites-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`Log ${item.recipeTitle}, ${Math.round(item.calories)} calories`}
                onPress={() => onSelectHistoryItem(item)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: Spacing.dense,
                  borderBottomWidth:
                    i < favoriteMatches.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: colors.border,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{ fontSize: 15, fontWeight: "600", color: colors.text }}
                    numberOfLines={1}
                  >
                    {item.recipeTitle}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 2,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {formatMacroTrailer({
                      calories: item.calories,
                      protein: item.protein,
                      carbs: item.carbs,
                      fat: item.fat,
                    })}
                  </Text>
                </View>
                {onToggleFavorite ? (
                  <FavoriteStarButton
                    starred
                    pending={pending}
                    onToggle={() => toggleFavoriteFor(item)}
                    testID={`food-search-favourites-${i}-star`}
                  />
                ) : null}
                <Text style={{ fontSize: 13, color: colors.textTertiary, marginLeft: 8 }}>
                  ›
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* History-first search (ENG-1033, MFP grammar): when the user has
          TYPED a query, the foods they've logged before that match it
          surface as a visually-distinct "Past logged" group above the
          database results. Reuses the recent-row grammar (title + macro
          trailer + chevron) and the Type.label eyebrow used by the empty-
          query "Recent" strip. De-dupe (history wins) is applied to the DB
          list above via `dedupedResults`; favourites win over history within
          this sheet via `historyMatchesDeduped`. */}
      {historyMatchesDeduped.length > 0 ? (
        <View
          style={{
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.sm,
            paddingBottom: Spacing.md,
          }}
          testID="food-search-past-logged"
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            Past logged
          </Text>
          {historyMatchesDeduped.map((m, i) => {
            const item = m.item;
            const starred = isFavoriteRow(favoriteKeys, item.recipeTitle, item.calories);
            const pending = favoritePendingKeys?.has(
              favoriteKey(item.recipeTitle, item.calories),
            );
            return (
              <Pressable
                key={`past-${m.key}`}
                testID={`food-search-past-logged-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`Log ${item.recipeTitle}, ${Math.round(item.calories)} calories`}
                onPress={() => onSelectHistoryItem(item)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: Spacing.dense,
                  borderBottomWidth:
                    i < historyMatchesDeduped.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: colors.border,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{ fontSize: 15, fontWeight: "600", color: colors.text }}
                    numberOfLines={1}
                  >
                    {item.recipeTitle}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 2,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {formatMacroTrailer({
                      calories: item.calories,
                      protein: item.protein,
                      carbs: item.carbs,
                      fat: item.fat,
                    })}
                  </Text>
                </View>
                {onToggleFavorite ? (
                  <FavoriteStarButton
                    starred={starred}
                    pending={pending}
                    onToggle={() => toggleFavoriteFor(item)}
                    testID={`food-search-past-logged-${i}-star`}
                  />
                ) : null}
                <Text style={{ fontSize: 13, color: colors.textTertiary, marginLeft: 8 }}>
                  ›
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* ENG-1038 — graceful degradation notice. When a keyed vendor's
          account-wide quota is exhausted at viral scale, the search layer
          flags it and we tell the user honestly that some live sources are
          paused — rather than letting search silently look broken. Tokens
          only. */}
      {searchDegraded && !loading ? (
        <View testID="food-search-degraded-notice" style={styles.degradedNotice}>
          <Text style={styles.degradedNoticeText}>
            Some live food sources are busy right now — showing saved and
            verified results. Try again shortly for the full list.
          </Text>
        </View>
      ) : null}

      {loading && results.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent.primary} />
          <Text style={styles.hint}>Searching...</Text>
        </View>
      ) : redesignSearch ? (
        <FlatList<RenderRow>
          data={redesignFeed}
          keyExtractor={(item) => item.key}
          renderItem={renderRedesignItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => {
            void loadMore();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderListFooter}
        />
      ) : (
        <FlatList<SearchRow>
          data={filteredResults}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => {
            void loadMore();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderListFooter}
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
