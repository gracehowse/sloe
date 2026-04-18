import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Swipeable } from "react-native-gesture-handler";

import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  dateKeyFromDate,
  newMealId,
  normalizeJournalSlotName,
  parseNutritionMicrosJson,
  type ByDay,
  type JournalMeal,
} from "@/lib/nutritionJournal";
import {
  buildDayNutrientDetailRows,
  formatMealNutritionMultiline,
  mealContributedFiberG,
  sumMicrosFromLoggedMeals,
} from "@/lib/healthDietaryNutrients";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import FoodSearchModal from "@/components/FoodSearchModal";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";

import CalorieRing from "@/components/charts/CalorieRing";
import { RemainingMacrosBar } from "@/components/RemainingMacrosBar";
import DayStrip from "@/components/charts/DayStrip";
import JournalDatePickerModal from "@/components/JournalDatePickerModal";
import CopyMealSheet from "@/components/CopyMealSheet";
import DuplicateDaySheet from "@/components/DuplicateDaySheet";
import VoiceLogSheet from "@/components/VoiceLogSheet";
import PhotoLogSheet from "@/components/PhotoLogSheet";
import { computeLoggingStreak } from "@/lib/trackerStats";
import {
  availableFreezes,
  readFreezeLedger,
  type FreezeLedger,
} from "@/lib/streakFreeze";
import {
  normalizeWeekSummaryMode,
  weekSummaryDateKeys,
  weekSummaryHeading,
  type WeekSummaryMode,
} from "../../../../src/lib/nutrition/weekSummaryWindow";
import { VOICE_LOG_NATIVE_BUILD_HINT } from "@/lib/voiceLog";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../../src/lib/analytics/events";
import { looksLikeMissingTableError } from "@/lib/supabaseErrors";
import { fetchMealPlanJson, fetchNutritionJournalByDay } from "../../../../src/lib/supabase/phase1LegacyJsonb";
import { refreshAdaptiveTdeeForUser } from "@/lib/refreshAdaptiveTdee";
import { subscribeOffline } from "@/lib/subscribeOffline";
import { NUTRITION_DEFAULTS, type NutritionDefaults } from "@/constants/nutritionDefaults";
import { maintenanceIntakeFromTargetCalories, resolveTargets } from "@/lib/calcTargets";
import { projectWeight } from "@/lib/weightProjection";
import {
  syncHealthDataThrottled,
  syncNutritionFromHealthThrottled,
  exportDayToHealth,
  isHealthSyncAvailable,
} from "@/lib/healthSync";
import { clampJournalDate } from "@/lib/journalNavigation";
import {
  computeEatAgainForSlot,
  computeFrequentMeals,
  computeRecentMeals,
  foodHistoryKey,
  type FoodHistoryItem,
} from "../../../../src/lib/nutrition/foodHistory";
import {
  cloneMealWithoutId,
  sanitizeCopyTargets,
} from "../../../../src/lib/nutrition/copyMeals";
import {
  addFavorite,
  favoriteKey,
  listFavorites,
  removeFavorite,
  type FavoriteFood,
} from "../../../../src/lib/nutrition/favoriteFoods";
import {
  parseDayNumberMap,
} from "../../../../src/lib/nutrition/hydrationStimulants";
import { HydrationStimulantsCard } from "@/components/HydrationStimulantsCard";
import SaveMealSheet from "@/components/SaveMealSheet";
import {
  createSavedMeal,
  deleteSavedMeal,
  incrementLogCount,
  listSavedMeals,
  renameSavedMeal,
  type SavedMeal,
  type SavedMealItem,
} from "../../../../src/lib/nutrition/savedMeals";
import {
  buildMealEntriesFromSavedMeal,
  summariseSavedMeal,
} from "../../../../src/lib/nutrition/savedMealsLogic";

type TrackerMacroTargets = Pick<
  NutritionDefaults,
  "calories" | "protein" | "carbs" | "fat" | "fiber"
>;

const DEFAULT_TRACKER_TARGETS: TrackerMacroTargets = {
  calories: NUTRITION_DEFAULTS.calories,
  protein: NUTRITION_DEFAULTS.protein,
  carbs: NUTRITION_DEFAULTS.carbs,
  fat: NUTRITION_DEFAULTS.fat,
  fiber: NUTRITION_DEFAULTS.fiber,
};

const MAX_JSONB_DAYS = 90;

function formatMealMacroDetail(m: JournalMeal): string {
  return formatMealNutritionMultiline({
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    fiberG: m.fiberG,
    micros: m.micros,
  });
}

/** Compact source line under a meal title (matches web NutritionSourceBadge intent). */
function formatMealSourceLabelForRow(source: string | null | undefined): string | null {
  if (source == null || !String(source).trim()) return null;
  const s = String(source).trim();
  const low = s.toLowerCase();
  if (low.includes("open food facts") && low.includes("adjusted")) return "OFF · adjusted";
  if (low.includes("open food facts")) return "Open Food Facts";
  if (low.includes("usda")) return "USDA";
  if (low.includes("ai photo")) return "AI photo";
  if (low.includes("ai voice")) return "AI voice";
  if (low.includes("quick entry")) return "Quick entry";
  if (low === "manual" || low.includes("manual")) return "Manual";
  if (low.includes("meal plan")) return "Meal plan";
  if (s.length <= 24) return s;
  return `${s.slice(0, 22)}…`;
}

/** Supabase JSONB sometimes arrives as a string; normalize to a day → number map. */
function parseByDayNumberMap(raw: unknown): Record<string, number> {
  let obj: Record<string, unknown> | null = null;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) obj = p as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return {};
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) next[k] = Math.round(n);
  }
  return next;
}

/**
 * Extra kcal added to the food budget when `prefer_activity_adjusted_calories` is on.
 * surplus-only: only adds burn ABOVE estimated maintenance TDEE.
 *   bonus = max(0, (resting + active) − maintenance)
 * Avoids double-counting since the calorie target already includes an activity estimate.
 * Fallback when no resting energy: logged workout calories only.
 */
function dayActivityBudgetAddon(
  prefer: boolean,
  _bonusOnly: boolean,
  activityByDay: Record<string, number>,
  basalByDay: Record<string, number>,
  maintenanceKcal: number,
  dk: string,
  workoutsByDay?: Record<string, Array<{ type: string; minutes: number; calories: number; source: string }>>,
): number {
  if (!prefer) return 0;
  const active = Math.round(activityByDay[dk] ?? 0);
  if (active <= 0) return 0;
  const basal = Math.round(basalByDay[dk] ?? 0);
  if (basal > 0 && maintenanceKcal > 0) {
    return Math.max(0, basal + active - maintenanceKcal);
  }
  // No resting data: use logged workout calories only
  const workouts = workoutsByDay?.[dk] ?? [];
  return Math.max(0, workouts.reduce((s, w) => s + (w.calories ?? 0), 0));
}

function pruneByDay<V>(map: Record<string, V>): Record<string, V> {
  const keys = Object.keys(map).sort().reverse().slice(0, MAX_JSONB_DAYS);
  const pruned: Record<string, V> = {};
  for (const k of keys) pruned[k] = map[k];
  return pruned;
}

function formatMealTimeDisplay(time: string | undefined, createdAt?: string | null): string {
  const t = time?.trim();
  if (t) return t;
  if (!createdAt) return "";
  try {
    return new Date(createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function TrackerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; _t?: string; editMealId?: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  const colors = useThemeColors();

  const [byDay, setByDay] = useState<ByDay>({});
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileTargets, setProfileTargets] = useState(DEFAULT_TRACKER_TARGETS);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [ringExpanded, setRingExpanded] = useState(true);
  const [calorieDisplayMode, setCalorieDisplayMode] = useState<"remaining" | "consumed">("consumed");
  const DEFAULT_TRACKED_MACROS = ["protein", "carbs", "fat"];
  const [trackedMacros, setTrackedMacros] = useState<string[]>(DEFAULT_TRACKED_MACROS);
  const [weekStartDay, setWeekStartDay] = useState<"monday" | "sunday">("monday");
  // Batch 4.11 — freeze ledger for Today streak sub-label. Defaults
  // keep the sub-label hidden until the profile query returns.
  const [freezeLedger, setFreezeLedger] = useState<FreezeLedger>({
    earnedAt: [],
    usedHistory: [],
  });
  const [freezeBudgetMax, setFreezeBudgetMax] = useState<number>(3);
  const [activeMealSlot, setActiveMealSlot] = useState("Breakfast");
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [journalCalendarOpen, setJournalCalendarOpen] = useState(false);
  /** Batch 1.4 — Copy-meal sheet: the meal id being copied, or null. */
  const [copyMealTargetId, setCopyMealTargetId] = useState<string | null>(null);
  /** Batch 1.4 — Duplicate-day sheet visibility. */
  const [duplicateDayOpen, setDuplicateDayOpen] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);
  const [waterGoalMl, setWaterGoalMl] = useState(NUTRITION_DEFAULTS.water);
  const [extraWaterByDay, setExtraWaterByDay] = useState<Record<string, number>>({});
  /** Batch 2.5 — caffeine per-day (mg) + target (mg/day, default 400). */
  const [extraCaffeineByDay, setExtraCaffeineByDay] = useState<Record<string, number>>({});
  const [targetCaffeineMg, setTargetCaffeineMg] = useState<number>(400);
  /** Batch 2.5 — alcohol per-day (g ethanol) + weekly target (g; 0 = hidden). */
  const [extraAlcoholGByDay, setExtraAlcoholGByDay] = useState<Record<string, number>>({});
  const [targetAlcoholGWeekly, setTargetAlcoholGWeekly] = useState<number>(0);
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [activityBurnByDay, setActivityBurnByDay] = useState<Record<string, number>>({});
  const [workoutsByDay, setWorkoutsByDay] = useState<Record<string, Array<{ type: string; minutes: number; calories: number; source: string }>>>({});
  const [basalBurnByDay, setBasalBurnByDay] = useState<Record<string, number>>({});
  const [preferActivityAdjustedCalories, setPreferActivityAdjustedCalories] = useState(false);
  /** surplus-only: add only burn above maintenance TDEE (needs resting + active from Health). */
  const [activityBonusCaloriesOnly, setActivityBonusCaloriesOnly] = useState(false);
  const [nutrientsModalOpen, setNutrientsModalOpen] = useState(false);
  const [dailyStepsGoal, setDailyStepsGoal] = useState(NUTRITION_DEFAULTS.steps);
  const [plannedMeals, setPlannedMeals] = useState<Array<{name?: string; recipe_title?: string; calories?: number; protein?: number; carbs?: number; fat?: number}>>([]);
  const [activeFastStart, setActiveFastStart] = useState<string | null>(null);
  const [fabSheetOpen, setFabSheetOpen] = useState(false);
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [voiceInputOpen, setVoiceInputOpen] = useState(false);
  const [voiceInputText, setVoiceInputText] = useState("");
  // Batch 5.13 — Pro-gated Voice + AI photo logging state.
  const [voiceLogOpen, setVoiceLogOpen] = useState(false);
  const [photoLogOpen, setPhotoLogOpen] = useState(false);
  const [userTier, setUserTier] = useState<"free" | "base" | "pro">("free");
  const [editingMeal, setEditingMeal] = useState<JournalMeal | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editKcal, setEditKcal] = useState("");
  const [editProtein, setEditProtein] = useState("");
  const [editCarbs, setEditCarbs] = useState("");
  const [editFat, setEditFat] = useState("");
  const [editSlot, setEditSlot] = useState("Snacks");
  /** Portion multiplier (×); macros = canonical × portion. Synced from fields before changing portion via chips. */
  const [editPortion, setEditPortion] = useState("1");
  const waterActivityInitialLoadDone = useRef(false);
  const editCanonicalRef = useRef({ cal: 0, p: 0, cb: 0, f: 0 });
  const [fastingTick, setFastingTick] = useState(Date.now());
  const [isOffline, setIsOffline] = useState(false);
  const [targetCelebration, setTargetCelebration] = useState(false);
  const [completeDayOpen, setCompleteDayOpen] = useState(false);
  const [showMealTimestamps, setShowMealTimestamps] = useState(false);
  const [weekSummaryMode, setWeekSummaryMode] = useState<WeekSummaryMode>("rolling");
  const [profileWeightKg, setProfileWeightKg] = useState<number | null>(null);
  const [profileGoalWeightKg, setProfileGoalWeightKg] = useState<number | null>(null);
  const [profileGoal, setProfileGoal] = useState<string | null>(null);
  const targetHitPrevByDayRef = useRef<Record<string, boolean>>({});
  /** Once we celebrate (or user was already at goal on first load), do not celebrate again that calendar day if they dip and re-hit. */
  const targetsCelebratedForDayRef = useRef<Record<string, boolean>>({});

  // Handle date param from navigation (e.g. from Progress screen)
  useEffect(() => {
    if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      const [y, m, d] = params.date.split("-").map(Number);
      setSelectedDate(clampJournalDate(new Date(y, m - 1, d)));
      setViewMode("day");
    }
    // _t is a cache-buster so re-navigating to the same date still fires
  }, [params.date, params._t]);

  useEffect(() => subscribeOffline(setIsOffline), []);

  // Batch 5.13 — load profile tier for Voice / AI photo gating. Same
  // pattern as `planner.tsx`; defaults to "free" on any error.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("user_tier")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        const t = data?.user_tier as string | null;
        if (t === "free" || t === "base" || t === "pro") setUserTier(t);
        else setUserTier("free");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!activeFastStart) return;
    const id = setInterval(() => setFastingTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [activeFastStart]);

  const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

  // Quick add tabs — shared helpers build the three lists off `byDay`.
  const recentMeals = useMemo(() => computeRecentMeals(byDay, 20), [byDay]);
  const frequentMeals = useMemo(() => computeFrequentMeals(byDay, 20), [byDay]);
  const [quickAddTab, setQuickAddTab] = useState<"favourites" | "frequent" | "recent" | "saved">("recent");
  const [favoriteFoods, setFavoriteFoods] = useState<FavoriteFood[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesPending, setFavoritesPending] = useState<Set<string>>(new Set());

  // Batch 2.6 — saved-meal combos.
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [savedMealsLoading, setSavedMealsLoading] = useState(false);
  const [savedPendingIds, setSavedPendingIds] = useState<Set<string>>(new Set());
  const [saveMealSheetOpen, setSaveMealSheetOpen] = useState(false);
  const [saveMealSheetItems, setSaveMealSheetItems] = useState<Array<Omit<SavedMealItem, "id" | "position">>>([]);
  const [saveMealSheetDefaultSlot, setSaveMealSheetDefaultSlot] = useState<"Breakfast" | "Lunch" | "Dinner" | "Snacks" | undefined>(undefined);

  /** Load favourites when the Quick add panel opens and a user is signed in. */
  useEffect(() => {
    if (!showPrevious || !userId) return;
    let cancelled = false;
    setFavoritesLoading(true);
    listFavorites(supabase, userId)
      .then((rows) => { if (!cancelled) setFavoriteFoods(rows); })
      .finally(() => { if (!cancelled) setFavoritesLoading(false); });
    return () => { cancelled = true; };
  }, [showPrevious, userId]);

  /** Batch 2.6 — load saved meals when Quick add opens. */
  useEffect(() => {
    if (!showPrevious || !userId) return;
    let cancelled = false;
    setSavedMealsLoading(true);
    listSavedMeals(supabase, userId)
      .then((rows) => { if (!cancelled) setSavedMeals(rows); })
      .finally(() => { if (!cancelled) setSavedMealsLoading(false); });
    return () => { cancelled = true; };
  }, [showPrevious, userId]);

  /** Map "title|cal" -> favourite id so rows on any tab can show star state. */
  const favoriteIdByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of favoriteFoods) m.set(favoriteKey(f.recipeTitle, f.calories), f.id);
    return m;
  }, [favoriteFoods]);

  /** Unified row model for the three tabs. */
  const quickAddRows = useMemo<Array<FoodHistoryItem & { favoriteId?: string }>>(() => {
    if (quickAddTab === "favourites") {
      return favoriteFoods.map((f) => ({
        recipeTitle: f.recipeTitle,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        ...(f.fiber != null ? { fiber: f.fiber } : {}),
        ...(f.source ? { source: f.source } : {}),
        count: f.count,
        favoriteId: f.id,
      }));
    }
    const src = quickAddTab === "frequent" ? frequentMeals : recentMeals;
    return src.map((item) => {
      const id = favoriteIdByKey.get(foodHistoryKey(item.recipeTitle, item.calories));
      return id ? { ...item, favoriteId: id } : item;
    });
  }, [quickAddTab, favoriteFoods, frequentMeals, recentMeals, favoriteIdByKey]);

  const toggleFavoriteRow = useCallback(
    async (row: FoodHistoryItem & { favoriteId?: string }) => {
      if (!userId) {
        Alert.alert("Sign in", "Sign in to save favourites.");
        return;
      }
      const key = favoriteKey(row.recipeTitle, row.calories);
      if (favoritesPending.has(key)) return;
      setFavoritesPending((s) => { const n = new Set(s); n.add(key); return n; });
      const snapshot = favoriteFoods;
      const wasStarred = Boolean(row.favoriteId);
      try {
        if (wasStarred && row.favoriteId) {
          setFavoriteFoods((prev) => prev.filter((f) => f.id !== row.favoriteId));
          await removeFavorite(supabase, userId, row.favoriteId);
        } else {
          const tempId = `temp-${key}`;
          const optimistic: FavoriteFood = {
            id: tempId,
            recipeTitle: row.recipeTitle,
            calories: row.calories,
            protein: row.protein,
            carbs: row.carbs,
            fat: row.fat,
            ...(row.fiber != null ? { fiber: row.fiber } : {}),
            ...(row.source ? { source: row.source } : {}),
            count: 1,
            createdAt: new Date().toISOString(),
          };
          setFavoriteFoods((prev) => [optimistic, ...prev]);
          const saved = await addFavorite(supabase, userId, {
            recipeTitle: row.recipeTitle,
            calories: row.calories,
            protein: row.protein,
            carbs: row.carbs,
            fat: row.fat,
            fiber: row.fiber,
            source: row.source ?? null,
          });
          setFavoriteFoods((prev) => [saved, ...prev.filter((f) => f.id !== tempId)]);
        }
      } catch (err) {
        setFavoriteFoods(snapshot);
        Alert.alert(
          wasStarred ? "Could not remove favourite" : "Could not save favourite",
          "Please try again.",
        );
        // eslint-disable-next-line no-console
        console.warn("Favourite toggle failed", err);
      } finally {
        setFavoritesPending((s) => { const n = new Set(s); n.delete(key); return n; });
      }
    },
    [favoriteFoods, favoritesPending, userId],
  );

  // -- Batch 2.6 — saved-meal handlers --

  /** Open the save-meal sheet pre-filled with the items in `slotName` on
   * the active day. Gated on >=2 items so the UI never lets the user
   * save a single-item "combo". */
  const openSaveMealSheetForSlot = useCallback(
    (slotName: string) => {
      if (!userId) {
        Alert.alert("Sign in", "Sign in to save meal combos.");
        return;
      }
      const normalised = normalizeJournalSlotName(slotName);
      const currentDayKey = dateKeyFromDate(selectedDate);
      const slotMeals = (byDay[currentDayKey] ?? []).filter(
        (m) => normalizeJournalSlotName(m.name ?? "") === normalised,
      );
      if (slotMeals.length < 2) {
        Alert.alert(
          "Save meal combo",
          "Log 2 or more items in this slot first, then save the combo.",
        );
        return;
      }
      const items: Array<Omit<SavedMealItem, "id" | "position">> = slotMeals.map((m) => {
        const item: Omit<SavedMealItem, "id" | "position"> = {
          recipeTitle: m.recipeTitle,
          calories: Math.max(0, Math.round(m.calories)),
          protein: Math.max(0, Math.round(m.protein * 10) / 10),
          carbs: Math.max(0, Math.round(m.carbs * 10) / 10),
          fat: Math.max(0, Math.round(m.fat * 10) / 10),
          portionMultiplier: 1,
        };
        if (m.fiberG != null) item.fiber = Math.max(0, Math.round(m.fiberG * 10) / 10);
        if (m.waterMl != null) item.waterMl = Math.max(0, Math.round(m.waterMl));
        if (m.source) item.source = m.source;
        return item;
      });
      const slotIsKnown =
        normalised === "Breakfast" ||
        normalised === "Lunch" ||
        normalised === "Dinner" ||
        normalised === "Snacks";
      setSaveMealSheetItems(items);
      setSaveMealSheetDefaultSlot(slotIsKnown ? (normalised as "Breakfast" | "Lunch" | "Dinner" | "Snacks") : undefined);
      setSaveMealSheetOpen(true);
    },
    [userId, byDay, selectedDate],
  );

  const handleCreateSavedMeal = useCallback(
    async (payload: {
      name: string;
      defaultMealSlot?: "Breakfast" | "Lunch" | "Dinner" | "Snacks";
      items: Array<Omit<SavedMealItem, "id" | "position">>;
    }) => {
      if (!userId) return;
      const tempId = `temp-${Date.now()}`;
      const optimistic: SavedMeal = {
        id: tempId,
        name: payload.name,
        items: payload.items.map((it, i) => ({ position: i, ...it })),
        createdAt: new Date().toISOString(),
        logCount: 0,
        ...(payload.defaultMealSlot ? { defaultMealSlot: payload.defaultMealSlot } : {}),
      };
      setSavedMeals((prev) => [optimistic, ...prev]);
      try {
        const created = await createSavedMeal(supabase, userId, payload);
        setSavedMeals((prev) => [created, ...prev.filter((m) => m.id !== tempId)]);
        try {
          track(AnalyticsEvents.saved_meal_created, {
            itemCount: payload.items.length,
            defaultMealSlot: payload.defaultMealSlot,
          });
        } catch { /* noop */ }
        setQuickAddTab("saved");
      } catch (err) {
        setSavedMeals((prev) => prev.filter((m) => m.id !== tempId));
        Alert.alert("Could not save", "We couldn't save that combo. Try again.");
        // eslint-disable-next-line no-console
        console.warn("Saved-meal create failed", err);
      }
    },
    [userId],
  );

  /** Expand a saved-meal combo into per-item journal entries and insert
   * each via the same path as manual logs. Fires `saved_meal_logged`
   * once per combo tap. */
  const logSavedMealFromPanel = useCallback(
    (meal: SavedMeal) => {
      if (!userId || savedPendingIds.has(meal.id)) return;
      const slot = meal.defaultMealSlot ?? activeMealSlot;
      setSavedPendingIds((s) => { const n = new Set(s); n.add(meal.id); return n; });
      try {
        const timeLabel = new Date().toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });
        const entries = buildMealEntriesFromSavedMeal(meal, slot, timeLabel, () => newMealId());
        if (entries.length === 0) return;
        const newMeals: JournalMeal[] = entries.map((e) => {
          const jm: JournalMeal = {
            id: e.id,
            name: e.name,
            recipeTitle: e.recipeTitle,
            time: e.time,
            calories: e.calories,
            protein: e.protein,
            carbs: e.carbs,
            fat: e.fat,
          };
          if (e.fiberG != null) jm.fiberG = e.fiberG;
          if (e.waterMl != null) jm.waterMl = e.waterMl;
          if (e.source) jm.source = e.source;
          return jm;
        });
        const targetDayKey = dateKeyFromDate(selectedDate);
        setByDay((prev) => ({ ...prev, [targetDayKey]: [...(prev[targetDayKey] ?? []), ...newMeals] }));
        // Optimistic bump + resort (matches web panel behaviour).
        setSavedMeals((prev) => {
          const next = prev.map((m) =>
            m.id === meal.id
              ? { ...m, logCount: m.logCount + 1, lastLoggedAt: new Date().toISOString() }
              : m,
          );
          next.sort((a, b) => {
            const ta = a.lastLoggedAt ? Date.parse(a.lastLoggedAt) : 0;
            const tb = b.lastLoggedAt ? Date.parse(b.lastLoggedAt) : 0;
            if (ta !== tb) return tb - ta;
            return Date.parse(b.createdAt) - Date.parse(a.createdAt);
          });
          return next;
        });
        try {
          track(AnalyticsEvents.saved_meal_logged, {
            itemCount: entries.length,
            slot,
          });
        } catch { /* noop */ }
        void incrementLogCount(supabase, userId, meal.id).catch((err) => {
          // eslint-disable-next-line no-console
          console.warn("Saved-meal log-count bump failed", err);
        });
        setShowPrevious(false);
      } finally {
        setSavedPendingIds((s) => { const n = new Set(s); n.delete(meal.id); return n; });
      }
    },
    [userId, savedPendingIds, activeMealSlot, selectedDate],
  );

  const promptRenameSavedMeal = useCallback(
    (meal: SavedMeal) => {
      if (!userId) return;
      // Use Alert.prompt on iOS; fall back to a simple Alert flow on
      // Android (Alert.prompt is iOS-only). Android users get a cancel
      // path with no-op — rename is available in a follow-up modal.
      if (Platform.OS === "ios" && typeof (Alert as any).prompt === "function") {
        (Alert as any).prompt(
          "Rename meal combo",
          "Enter a new name.",
          async (text: string | undefined) => {
            const next = (text ?? "").trim();
            if (!next || next === meal.name) return;
            const snapshot = savedMeals;
            setSavedMeals((prev) => prev.map((m) => (m.id === meal.id ? { ...m, name: next } : m)));
            try {
              await renameSavedMeal(supabase, userId, meal.id, next);
            } catch (err) {
              setSavedMeals(snapshot);
              Alert.alert("Could not rename", "Please try again.");
              // eslint-disable-next-line no-console
              console.warn("Saved-meal rename failed", err);
            }
          },
          "plain-text",
          meal.name,
        );
      } else {
        Alert.alert(
          "Rename meal combo",
          "Renaming is coming to Android in a future update. For now, delete and re-create the combo with a new name.",
        );
      }
    },
    [userId, savedMeals],
  );

  const confirmDeleteSavedMeal = useCallback(
    (meal: SavedMeal) => {
      if (!userId) return;
      Alert.alert(
        "Delete saved meal",
        `Delete "${meal.name}"? This can't be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              const snapshot = savedMeals;
              setSavedMeals((prev) => prev.filter((m) => m.id !== meal.id));
              try {
                await deleteSavedMeal(supabase, userId, meal.id);
                try {
                  track(AnalyticsEvents.saved_meal_deleted, {
                    itemCount: meal.items.length,
                    defaultMealSlot: meal.defaultMealSlot,
                  });
                } catch { /* noop */ }
              } catch (err) {
                setSavedMeals(snapshot);
                Alert.alert("Could not delete", "Please try again.");
                // eslint-disable-next-line no-console
                console.warn("Saved-meal delete failed", err);
              }
            },
          },
        ],
      );
    },
    [userId, savedMeals],
  );

  const openSavedMealActions = useCallback(
    (meal: SavedMeal) => {
      Alert.alert(meal.name, `${meal.items.length} item${meal.items.length === 1 ? "" : "s"}`, [
        { text: "Rename", onPress: () => promptRenameSavedMeal(meal) },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => confirmDeleteSavedMeal(meal),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [promptRenameSavedMeal, confirmDeleteSavedMeal],
  );

  /** Infer the default slot for the Eat-again card from local clock time. */
  const currentSlotFromTime = useMemo(() => {
    const h = new Date().getHours();
    if (h < 10) return "Breakfast";
    if (h < 14) return "Lunch";
    if (h < 17) return "Snacks";
    return "Dinner";
  }, []);
  const eatAgainSuggestion = useMemo(
    () => computeEatAgainForSlot(byDay, currentSlotFromTime, new Date()),
    [byDay, currentSlotFromTime],
  );
  const [eatAgainDismissedKey, setEatAgainDismissedKey] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const v = await AsyncStorage.getItem("suppr-eat-again-dismissed");
        if (!cancelled) setEatAgainDismissedKey(v);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const dismissEatAgain = useCallback(async () => {
    const key = dateKeyFromDate(new Date());
    setEatAgainDismissedKey(key);
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem("suppr-eat-again-dismissed", key);
    } catch { /* noop */ }
  }, []);
  const eatAgainDismissedForToday = eatAgainDismissedKey === dateKeyFromDate(new Date());


  const loadProfileTargets = useCallback(async () => {
    if (!userId) return;
    // Batch 2.5: include new `target_caffeine_mg` + `target_alcohol_g_weekly` +
    // the two per-day maps. If the migration hasn't landed yet on this env,
    // fall through to the legacy select so quick-add water keeps working.
    let resp = await supabase
      .from("profiles")
      .select(
        "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, target_caffeine_mg, target_alcohol_g_weekly, extra_water_by_day, extra_caffeine_by_day, extra_alcohol_g_by_day, steps_by_day, activity_burn_by_day, workouts_by_day, basal_burn_by_day, daily_steps_goal, prefer_activity_adjusted_calories, fasting_sessions, tracked_macros, week_start_day, weight_kg, height_cm, sex, activity_level, goal, goal_weight_kg, dob, age, notification_prefs, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history",
      )
      .eq("id", userId)
      .maybeSingle();
    if (resp.error) {
      resp = await supabase
        .from("profiles")
        .select(
          "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, extra_water_by_day, steps_by_day, activity_burn_by_day, workouts_by_day, basal_burn_by_day, daily_steps_goal, prefer_activity_adjusted_calories, fasting_sessions, tracked_macros, week_start_day, weight_kg, height_cm, sex, activity_level, goal, goal_weight_kg, dob, age, notification_prefs",
        )
        .eq("id", userId)
        .maybeSingle();
    }
    const { data } = resp;
    if (!data) return;
    const d = data as any;
    const targets = resolveTargets(
      { target_calories: d.target_calories, target_protein: d.target_protein, target_carbs: d.target_carbs, target_fat: d.target_fat, target_fiber_g: d.target_fiber_g },
      {
        weight_kg: d.weight_kg,
        height_cm: d.height_cm,
        sex: d.sex,
        activity_level: d.activity_level,
        goal: d.goal,
        dob: d.dob,
        age: d.age != null ? Number(d.age) : null,
      },
    );
    setProfileTargets({
      calories: targets.calories,
      protein: targets.protein,
      carbs: targets.carbs,
      fat: targets.fat,
      fiber: targets.fiber,
    });
    const tw = data.target_water_ml != null ? Number(data.target_water_ml) : NUTRITION_DEFAULTS.water;
    setWaterGoalMl(Number.isFinite(tw) && tw > 0 ? Math.round(tw) : NUTRITION_DEFAULTS.water);
    // Batch 2.5 — caffeine + alcohol targets. Falls back to defaults if the
    // migration isn't applied on this env.
    const tc = (d as any).target_caffeine_mg;
    if (typeof tc === "number" && Number.isFinite(tc) && tc >= 0) {
      setTargetCaffeineMg(Math.round(tc));
    }
    const ta = (d as any).target_alcohol_g_weekly;
    if (typeof ta === "number" && Number.isFinite(ta) && ta >= 0) {
      setTargetAlcoholGWeekly(Math.round(ta));
    }
    // Water: only overwrite on initial load — subsequent tab focuses must not
    // clobber locally-added water that hasn't finished persisting yet.
    if (!waterActivityInitialLoadDone.current) {
      setExtraWaterByDay(parseByDayNumberMap(data.extra_water_by_day));
      // Same pattern for caffeine + alcohol — only hydrate local state on
      // the first focus so quick-add chips don't lose in-flight writes.
      setExtraCaffeineByDay(parseDayNumberMap((d as any).extra_caffeine_by_day));
      setExtraAlcoholGByDay(parseDayNumberMap((d as any).extra_alcohol_g_by_day));
      waterActivityInitialLoadDone.current = true;
    }
    // Burn maps, steps, and workouts come from HealthKit sync and are never
    // edited locally, so always refresh them to keep past-day data current.
    setStepsByDay(parseByDayNumberMap(data.steps_by_day));
    setActivityBurnByDay(parseByDayNumberMap(data.activity_burn_by_day));
    if (d.workouts_by_day && typeof d.workouts_by_day === "object" && !Array.isArray(d.workouts_by_day)) {
      setWorkoutsByDay(d.workouts_by_day as Record<string, Array<{ type: string; minutes: number; calories: number; source: string }>>);
    }
    setBasalBurnByDay(parseByDayNumberMap(d.basal_burn_by_day));
    setPreferActivityAdjustedCalories(Boolean(d.prefer_activity_adjusted_calories));
    const sg = data.daily_steps_goal != null ? Number(data.daily_steps_goal) : NUTRITION_DEFAULTS.steps;
    setDailyStepsGoal(Number.isFinite(sg) && sg > 0 ? Math.round(sg) : NUTRITION_DEFAULTS.steps);
    if (Array.isArray(data.fasting_sessions)) {
      const active = (data.fasting_sessions as Array<{start: string; end: string | null}>).find((s) => s.end === null);
      setActiveFastStart(active?.start ?? null);
    }
    if (Array.isArray(data.tracked_macros) && data.tracked_macros.length > 0) {
      setTrackedMacros(data.tracked_macros as string[]);
    }
    if (data.week_start_day === "sunday" || data.week_start_day === "monday") {
      setWeekStartDay(data.week_start_day);
    }
    // Batch 4.11 — freeze ledger (profile select above includes the new
    // columns; they fall back to defaults if the migration isn't live).
    const rawFreezeEarned = (d as any).streak_freezes_earned_at;
    const rawFreezeUsed = (d as any).streak_freezes_used_history;
    setFreezeLedger(
      readFreezeLedger({ earnedAt: rawFreezeEarned, usedHistory: rawFreezeUsed }),
    );
    const rawBudget = Number((d as any).streak_freeze_budget_max);
    setFreezeBudgetMax(Number.isFinite(rawBudget) ? Math.max(0, Math.min(10, rawBudget)) : 3);
    const wk = d.weight_kg != null ? Number(d.weight_kg) : null;
    setProfileWeightKg(Number.isFinite(wk) ? wk : null);
    const gwk = d.goal_weight_kg != null ? Number(d.goal_weight_kg) : null;
    setProfileGoalWeightKg(Number.isFinite(gwk) ? gwk : null);
    setProfileGoal(d.goal ?? null);
    const np = d.notification_prefs as {
      showMealTimestamps?: boolean;
      weekSummaryMode?: string;
      activity_bonus_calories?: boolean;
    } | null | undefined;
    setShowMealTimestamps(Boolean(np?.showMealTimestamps));
    setWeekSummaryMode(normalizeWeekSummaryMode(np?.weekSummaryMode));
    setActivityBonusCaloriesOnly(Boolean(np?.activity_bonus_calories));
  }, [userId]);

  const dayKey = dateKeyFromDate(selectedDate);

  /** Log any FoodHistoryItem to the active slot. Shared by Quick add
   * panel + Eat-again card so the persist/event shape stays aligned. */
  const logHistoryItemToSlot = useCallback(
    (item: FoodHistoryItem, slot: string) => {
      const meal: JournalMeal = {
        id: newMealId(),
        name: slot,
        recipeTitle: item.recipeTitle,
        time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        ...(item.fiber != null ? { fiberG: item.fiber } : {}),
        ...(item.source ? { source: item.source } : {}),
      };
      setByDay((prev) => ({ ...prev, [dayKey]: [...(prev[dayKey] ?? []), meal] }));
      try { track(AnalyticsEvents.food_logged, { source: "quick_add", slot }); } catch { /* noop */ }
    },
    [dayKey],
  );

  const trackerWeekSummaryKeys = useMemo(
    () => weekSummaryDateKeys(weekSummaryMode, selectedDate, weekStartDay),
    [weekSummaryMode, selectedDate, weekStartDay],
  );
  const mealsToday = byDay[dayKey] ?? [];
  const targets = profileTargets;
  const isToday = dayKey === dateKeyFromDate(new Date());

  const maintenanceKcal = useMemo(
    () => maintenanceIntakeFromTargetCalories(targets.calories, profileGoal),
    [targets.calories, profileGoal],
  );

  const persistActivityBonusPref = useCallback(
    async (nextVal: boolean) => {
      if (!userId) return;
      setActivityBonusCaloriesOnly(nextVal);
      const { data } = await supabase.from("profiles").select("notification_prefs").eq("id", userId).maybeSingle();
      const raw = (data as { notification_prefs?: unknown } | null)?.notification_prefs;
      const prev =
        raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
      await supabase
        .from("profiles")
        .update({ notification_prefs: { ...prev, activity_bonus_calories: nextVal } })
        .eq("id", userId);
    },
    [userId],
  );

  /** Master switch: without this, Health burn is never added to the calorie ring goal (web-only before). */
  const persistPreferActivityAdjustedCalories = useCallback(
    async (nextVal: boolean) => {
      if (!userId) return;
      setPreferActivityAdjustedCalories(nextVal);
      await supabase.from("profiles").update({ prefer_activity_adjusted_calories: nextVal }).eq("id", userId);
    },
    [userId],
  );

  const effectiveCalorieGoal = useMemo(
    () =>
      Math.max(
        0,
        targets.calories +
          dayActivityBudgetAddon(
            preferActivityAdjustedCalories,
            true,
            activityBurnByDay,
            basalBurnByDay,
            maintenanceKcal,
            dayKey,
          ),
      ),
    [
      targets.calories,
      preferActivityAdjustedCalories,
      activityBonusCaloriesOnly,
      activityBurnByDay,
      basalBurnByDay,
      maintenanceKcal,
      dayKey,
    ],
  );

  const todayActivityBudgetAddon = useMemo(
    () =>
      dayActivityBudgetAddon(
        preferActivityAdjustedCalories,
        activityBonusCaloriesOnly,
        activityBurnByDay,
        basalBurnByDay,
        maintenanceKcal,
        dayKey,
      ),
    [
      preferActivityAdjustedCalories,
      activityBonusCaloriesOnly,
      activityBurnByDay,
      basalBurnByDay,
      maintenanceKcal,
      dayKey,
    ],
  );

  const navigateDay = useCallback((offset: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + offset);
      return clampJournalDate(next);
    });
  }, []);

  const formatDateLabel = useCallback((d: Date) => {
    const today = new Date();
    const todayStr = dateKeyFromDate(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dk = dateKeyFromDate(d);
    if (dk === todayStr) return "Today";
    if (dk === dateKeyFromDate(yesterday)) return "Yesterday";
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }, []);

  // Week data: respects weekStartDay setting
  const weekData = useMemo(() => {
    const d = new Date(selectedDate);
    const dow = d.getDay(); // 0=Sun, 1=Mon, ...
    // Calculate offset to the start of the week
    const startOffset = weekStartDay === "monday"
      ? (dow === 0 ? -6 : 1 - dow)
      : -dow; // sunday start
    const weekFirst = new Date(d);
    weekFirst.setDate(d.getDate() + startOffset);

    const dayLabels = weekStartDay === "monday"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const days: { key: string; label: string; short: string; date: Date; meals: JournalMeal[]; totals: { calories: number; protein: number; carbs: number; fat: number } }[] = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(weekFirst);
      dd.setDate(weekFirst.getDate() + i);
      const dk = dateKeyFromDate(dd);
      const meals = byDay[dk] ?? [];
      const totals = meals.reduce(
        (acc, m) => ({
          calories: acc.calories + Math.max(0, m.calories),
          protein: acc.protein + Math.max(0, m.protein),
          carbs: acc.carbs + Math.max(0, m.carbs),
          fat: acc.fat + Math.max(0, m.fat),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      days.push({ key: dk, label: dayLabels[i], short: dayLabels[i], date: dd, meals, totals });
    }

    const weekTotals = days.reduce(
      (acc, d) => ({
        calories: acc.calories + d.totals.calories,
        protein: acc.protein + d.totals.protein,
        carbs: acc.carbs + d.totals.carbs,
        fat: acc.fat + d.totals.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    const daysWithFood = days.filter((d) => d.totals.calories > 0).length || 1;
    const weekAvg = {
      calories: Math.round(weekTotals.calories / daysWithFood),
      protein: Math.round(weekTotals.protein / daysWithFood),
      carbs: Math.round(weekTotals.carbs / daysWithFood),
      fat: Math.round(weekTotals.fat / daysWithFood),
    };

    const weekStartLabel = weekFirst.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const weekLast = new Date(weekFirst);
    weekLast.setDate(weekFirst.getDate() + 6);
    const weekEndLabel = weekLast.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    return { days, weekTotals, weekAvg, daysWithFood, label: `${weekStartLabel} – ${weekEndLabel}` };
  }, [selectedDate, byDay, weekStartDay]);

  const weekEffectiveCalorieBudget = useMemo(() => {
    if (!preferActivityAdjustedCalories) return targets.calories * 7;
    return weekData.days.reduce(
      (sum, d) =>
        sum +
        targets.calories +
        dayActivityBudgetAddon(
          preferActivityAdjustedCalories,
          activityBonusCaloriesOnly,
          activityBurnByDay,
          basalBurnByDay,
          maintenanceKcal,
          d.key,
        ),
      0,
    );
  }, [
    preferActivityAdjustedCalories,
    activityBonusCaloriesOnly,
    weekData.days,
    targets.calories,
    activityBurnByDay,
    basalBurnByDay,
    maintenanceKcal,
  ]);

  const navigateWeek = useCallback((offset: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + offset * 7);
      return clampJournalDate(next);
    });
  }, []);

  const totals = useMemo(() => {
    const raw = mealsToday.reduce(
      (acc, m) => ({
        calories: acc.calories + Math.max(0, m.calories),
        protein: acc.protein + Math.max(0, m.protein),
        carbs: acc.carbs + Math.max(0, m.carbs),
        fat: acc.fat + Math.max(0, m.fat),
        fiber: acc.fiber + mealContributedFiberG(m),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    );
    return {
      calories: Math.round(raw.calories),
      protein: Math.round(raw.protein),
      carbs: Math.round(raw.carbs),
      fat: Math.round(raw.fat),
      fiber: Math.round(raw.fiber),
    };
  }, [mealsToday]);

  const dayNutrientDetailRows = useMemo(() => {
    const microSum = sumMicrosFromLoggedMeals(mealsToday);
    return buildDayNutrientDetailRows(totals.fiber, microSum);
  }, [mealsToday, totals.fiber]);

  /** Fiber is already shown in the macro widget row when enabled in Dashboard Widgets — avoid duplicating it here. */
  const dayNutrientDetailRowsWithoutMacroDupes = useMemo(() => {
    if (trackedMacros.includes("fiber")) {
      return dayNutrientDetailRows.filter((r) => r.key !== "__fiber_day");
    }
    return dayNutrientDetailRows;
  }, [dayNutrientDetailRows, trackedMacros]);

  useEffect(() => {
    if (!hydrated) return;
    if (viewMode !== "day" || !isToday) return;
    const goalsOk = targets.calories > 0 && targets.protein > 0;
    const hit =
      goalsOk &&
      totals.calories >= effectiveCalorieGoal &&
      totals.protein >= targets.protein;

    const map = targetHitPrevByDayRef.current;
    const celebrated = targetsCelebratedForDayRef.current;
    const prev = map[dayKey];
    if (prev === undefined) {
      map[dayKey] = hit;
      if (hit) celebrated[dayKey] = true;
      return;
    }
    if (!prev && hit) {
      if (!celebrated[dayKey]) {
        setTargetCelebration(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        celebrated[dayKey] = true;
        const t = setTimeout(() => setTargetCelebration(false), 2500);
        map[dayKey] = hit;
        return () => clearTimeout(t);
      }
      map[dayKey] = hit;
      return;
    }
    map[dayKey] = hit;
  }, [
    hydrated,
    viewMode,
    isToday,
    dayKey,
    effectiveCalorieGoal,
    targets.protein,
    totals.calories,
    totals.protein,
  ]);

  const remaining = effectiveCalorieGoal - totals.calories;

  // Batch 5.12 — iOS widget snapshot. Writes today's totals + fast state
  // to a shared App Group-accessible snapshot (AsyncStorage always, file
  // best-effort). Debounced 500 ms so a rapid sequence of macro edits
  // doesn't flood disk. Only runs when viewing today — yesterday's numbers
  // should never appear in the widget.
  useEffect(() => {
    if (!hydrated || !isToday || viewMode !== "day") return;
    let cancelled = false;
    const handle = setTimeout(() => {
      if (cancelled) return;
      (async () => {
        const { buildWidgetSnapshot, writeWidgetSnapshot } = await import("@/lib/widgetSnapshot");
        const snapshot = buildWidgetSnapshot({
          kcalConsumed: totals.calories,
          kcalTarget: effectiveCalorieGoal,
          proteinTargetG: targets.protein,
          proteinConsumedG: totals.protein,
          carbsTargetG: targets.carbs,
          carbsConsumedG: totals.carbs,
          fatTargetG: targets.fat,
          fatConsumedG: totals.fat,
          fastStartsAt: activeFastStart,
          // TODO — thread profiles.fasting_window once Today reads it.
          // Snapshot falls back to 16h in the meantime.
        });
        const result = await writeWidgetSnapshot(snapshot);
        if (result.ok) {
          track(AnalyticsEvents.widget_snapshot_updated, {});
        }
      })().catch(() => {
        // Never let a widget persistence failure break Today.
      });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    hydrated,
    isToday,
    viewMode,
    totals.calories,
    totals.protein,
    totals.carbs,
    totals.fat,
    effectiveCalorieGoal,
    targets.protein,
    targets.carbs,
    targets.fat,
    activeFastStart,
  ]);

  const loggedDays = useMemo(() => {
    const s = new Set<string>();
    for (const k of Object.keys(byDay)) {
      if ((byDay[k] ?? []).length > 0) s.add(k);
    }
    return s;
  }, [byDay]);

  const streakDays = useMemo(
    () => computeLoggingStreak(byDay as any),
    [byDay],
  );
  // Batch 4.11 — freeze sub-label on the streak insight card.
  const freezesAvailableToday = useMemo(
    () => availableFreezes(freezeLedger, freezeBudgetMax),
    [freezeLedger, freezeBudgetMax],
  );

  const extraWaterToday = extraWaterByDay[dayKey] ?? 0;
  const waterFromMealsMl = useMemo(
    () => Math.round(mealsToday.reduce((a, m) => a + Math.max(0, m.waterMl ?? 0), 0)),
    [mealsToday],
  );
  /** Used for Today macro strip when "water" is enabled in dashboard widgets. */
  const totalWaterMl = extraWaterToday + waterFromMealsMl;
  /** Batch 2.5 — today's caffeine total in mg (from quick-add; per-meal
   *  caffeine lives in `nutrition_micros.caffeineMg` and is summed elsewhere). */
  const extraCaffeineToday = extraCaffeineByDay[dayKey] ?? 0;
  const stepsRecorded = Object.prototype.hasOwnProperty.call(stepsByDay, dayKey);
  const stepsCount = stepsRecorded ? (stepsByDay[dayKey] ?? 0) : null;
  const activityBurnRecorded = Object.prototype.hasOwnProperty.call(activityBurnByDay, dayKey);
  const activityBurnKcal = activityBurnRecorded ? (activityBurnByDay[dayKey] ?? 0) : null;
  const basalBurnKcal = basalBurnByDay[dayKey] ?? 0;
  const dayWorkouts = workoutsByDay[dayKey] ?? [];
  const totalBurnKcal = (activityBurnKcal ?? 0) + basalBurnKcal;
  const hasBurnData = activityBurnRecorded || basalBurnKcal > 0 || dayWorkouts.length > 0;

  // Batch 5.13 — resolve the web API base from expo-constants once per
  // render so the gated sheets don't each import Constants independently.
  const [apiBase, setApiBase] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Constants = (await import("expo-constants")).default;
        const extra = Constants.expoConfig?.extra as { supprApiUrl?: string } | undefined;
        if (!cancelled) setApiBase(extra?.supprApiUrl ?? "");
      } catch {
        if (!cancelled) setApiBase("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Batch 5.13 — commit AI-logged items (voice / photo) as journal meals.
  // Shared by the VoiceLogSheet + PhotoLogSheet. Mirrors the web's
  // `commitAiLoggedItems` in `NutritionTracker.tsx`.
  const commitAiLoggedItems = useCallback(
    (aiItems: import("../../../../src/lib/nutrition/aiLogging").AiLoggedItem[]) => {
      if (!aiItems.length) return;
      const timeLabel = new Date().toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      const newMeals: JournalMeal[] = aiItems.map((item) => ({
        id: newMealId(),
        name: activeMealSlot,
        recipeTitle: item.name,
        time: timeLabel,
        calories: Math.round(item.calories),
        protein: Math.round(item.protein),
        carbs: Math.round(item.carbs),
        fat: Math.round(item.fat),
        source: item.source === "voice" ? "AI voice" : "AI photo",
      }));
      setByDay((prev) => ({
        ...prev,
        [dayKey]: [...(prev[dayKey] ?? []), ...newMeals],
      }));
      track(AnalyticsEvents.food_logged, {
        source: aiItems[0]?.source === "voice" ? "voice" : "photo",
        count: newMeals.length,
      });
    },
    [activeMealSlot, dayKey],
  );

  // Batch 5.13 — Pro gate for Voice and AI photo logging. Free + Base
  // tiers are routed to the paywall; Pro opens the respective sheet.
  const handleOpenVoiceLog = useCallback(() => {
    if (userTier !== "pro") {
      track(AnalyticsEvents.voice_log_paywalled);
      router.push("/paywall?from=voice_log" as any);
      return;
    }
    setVoiceLogOpen(true);
  }, [router, userTier]);

  const handleOpenPhotoLog = useCallback(() => {
    if (userTier !== "pro") {
      track(AnalyticsEvents.ai_photo_log_paywalled);
      router.push("/paywall?from=photo_log" as any);
      return;
    }
    setPhotoLogOpen(true);
  }, [router, userTier]);

  const handlePhotoLog = useCallback(async () => {
    try {
      const ImagePicker = require("expo-image-picker");
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera access is required for photo logging.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;

      setPhotoAnalyzing(true);

      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("image", {
        uri: asset.uri,
        type: asset.mimeType ?? "image/jpeg",
        name: "meal.jpg",
      } as any);

      const ExpoConstants = (await import("expo-constants")).default;
      const extra = ExpoConstants.expoConfig?.extra as
        | { supprApiUrl?: string }
        | undefined;
      const apiBase = extra?.supprApiUrl ?? "";
      const resp = await fetch(`${apiBase}/api/nutrition/photo-log`, {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });
      const data = await resp.json();
      setPhotoAnalyzing(false);

      if (resp.status === 403 && data.error === "upgrade_required") {
        Alert.alert(
          "Upgrade required",
          typeof data.message === "string" && data.message
            ? data.message
            : "Photo meal logging is available on Base or Pro. Upgrade in the web app to continue.",
        );
        return;
      }

      if (!data.ok || !Array.isArray(data.items) || data.items.length === 0) {
        Alert.alert("Could not identify", data.message ?? "Try a clearer photo with better lighting.");
        return;
      }

      const itemNames = data.items.map((i: any) => `${i.name}: ${i.calories} kcal`).join("\n");
      Alert.alert(
        `Found ${data.items.length} item${data.items.length > 1 ? "s" : ""}`,
        `${itemNames}\n\nTotal: ${data.totalCalories} kcal`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Log All",
            onPress: () => {
              const newMeals: JournalMeal[] = data.items.map((item: any) => ({
                id: newMealId(),
                name: activeMealSlot,
                recipeTitle: item.name,
                time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
                calories: Math.round(item.calories),
                protein: Math.round(item.protein),
                carbs: Math.round(item.carbs),
                fat: Math.round(item.fat),
                source: "AI photo",
              }));
              setByDay((prev) => ({
                ...prev,
                [dayKey]: [...(prev[dayKey] ?? []), ...newMeals],
              }));
              track(AnalyticsEvents.food_logged, { source: "photo", count: newMeals.length });
            },
          },
        ],
      );
    } catch (e) {
      setPhotoAnalyzing(false);
      Alert.alert("Photo logging unavailable", "Camera requires a development build.");
    }
  }, [session, activeMealSlot, dayKey]);

  const handleVoiceLog = useCallback(async () => {
    try {
      const { isSpeechAvailable, listenForSpeech } = await import("@/lib/voiceLog");
      if (!isSpeechAvailable()) {
        // Native speech recognition not available — open text input fallback
        setVoiceInputOpen(true);
        return;
      }
      Alert.alert("Listening…", "Describe what you ate. Tap OK when done.", [
        { text: "Cancel", style: "cancel" },
        { text: "OK", onPress: () => {} },
      ]);
      const transcript = await listenForSpeech({ maxDurationMs: 10_000 });
      if (!transcript.trim()) {
        Alert.alert("No speech detected", "Try again or type what you ate instead.", [
          { text: "Type instead", onPress: () => setVoiceInputOpen(true) },
          { text: "Try again", onPress: () => handleVoiceLog() },
        ]);
        return;
      }
      await submitVoiceTranscript(transcript);
    } catch {
      // Speech recognition failed — fall back to text input
      setVoiceInputOpen(true);
    }
  }, [session, activeMealSlot, dayKey]);

  const submitVoiceTranscript = useCallback(async (transcript: string) => {
    try {
      const Constants = (await import("expo-constants")).default;
      const ex = Constants.expoConfig?.extra as { supprApiUrl?: string } | undefined;
      const apiBase = ex?.supprApiUrl ?? "";

      // Try the AI API first
      let data: any = null;
      try {
        const resp = await fetch(`${apiBase}/api/nutrition/voice-log`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ transcript }),
        });
        data = await resp.json();
        if (resp.status === 403 && data.error === "upgrade_required") {
          // Tier-gated — fall through to manual entry below
          data = null;
        }
      } catch {
        // Network error — fall through to manual entry
        data = null;
      }

      if (data?.ok && Array.isArray(data.items) && data.items.length > 0) {
        const itemNames = data.items.map((i: any) => `${i.name}: ${i.calories} kcal`).join("\n");
        Alert.alert(
          `Parsed ${data.items.length} item${data.items.length > 1 ? "s" : ""}`,
          `${itemNames}\n\nTotal: ${data.totalCalories} kcal`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Log All",
              onPress: () => {
                const newMeals: JournalMeal[] = data.items.map((item: any) => ({
                  id: newMealId(),
                  name: activeMealSlot,
                  recipeTitle: item.name,
                  time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
                  calories: Math.round(item.calories),
                  protein: Math.round(item.protein),
                  carbs: Math.round(item.carbs),
                  fat: Math.round(item.fat),
                  source: "AI voice",
                }));
                setByDay((prev) => ({
                  ...prev,
                  [dayKey]: [...(prev[dayKey] ?? []), ...newMeals],
                }));
              },
            },
          ],
        );
      } else {
        // AI unavailable or failed — log it as a quick entry with just the name
        Alert.alert(
          "Quick log",
          `AI parsing unavailable. Log "${transcript}" as a quick entry?\n\nYou can edit the calories after.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Log it",
              onPress: () => {
                const meal: JournalMeal = {
                  id: newMealId(),
                  name: activeMealSlot,
                  recipeTitle: transcript.trim(),
                  time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
                  calories: 0,
                  protein: 0,
                  carbs: 0,
                  fat: 0,
                  source: "Quick entry",
                };
                setByDay((prev) => ({
                  ...prev,
                  [dayKey]: [...(prev[dayKey] ?? []), meal],
                }));
              },
            },
          ],
        );
      }
    } catch {
      Alert.alert("Voice logging failed", "Please try again.");
    }
  }, [session, activeMealSlot, dayKey]);

  const addWaterMl = useCallback(
    async (ml: number) => {
      if (!userId) return;
      const add = Math.max(0, Math.round(ml));
      if (add === 0) return;
      let persisted: Record<string, number> | null = null;
      setExtraWaterByDay((prev) => {
        const next = pruneByDay({ ...prev, [dayKey]: (prev[dayKey] ?? 0) + add });
        persisted = next;
        return next;
      });
      // Await the persist so it completes before any re-fetch can race
      if (persisted) {
        await supabase.from("profiles").update({ extra_water_by_day: persisted }).eq("id", userId);
      }
      track(AnalyticsEvents.hydration_logged, {
        type: "water",
        amount: add,
        unit: "ml",
        preset: null,
      });
    },
    [userId, dayKey],
  );

  /** Batch 5.12 — start a fast from a deep link (Siri / Shortcuts app).
   *  No-ops when a fast is already active; uses the existing
   *  profiles.fasting_sessions shape so the fasting screen agrees. */
  const startFastFromShortcut = useCallback(
    async (hours: number) => {
      if (!userId) return;
      const { data } = await supabase
        .from("profiles")
        .select("fasting_sessions")
        .eq("id", userId)
        .maybeSingle();
      const existing: Array<{ start: string; end: string | null }> = Array.isArray(
        data?.fasting_sessions,
      )
        ? (data.fasting_sessions as Array<{ start: string; end: string | null }>)
        : [];
      if (existing.some((s) => s.end === null)) {
        // Already fasting — do not stack sessions.
        return;
      }
      const startIso = new Date().toISOString();
      const next = [...existing, { start: startIso, end: null }].slice(-90);
      await supabase.from("profiles").update({ fasting_sessions: next }).eq("id", userId);
      setActiveFastStart(startIso);
      // `hours` currently only informs the widget snapshot — the fasting
      // screen reads the window from `profiles.fasting_window`. When
      // users invoke `suppr://fast/start?hours=N` with a non-default N we
      // log it so analytics reflects actual use.
      track(AnalyticsEvents.siri_action_invoked, { kind: "start_fast", hours });
    },
    [userId],
  );

  /**
   * Batch 5.12 — flush any pending Siri / Shortcuts-app action that the
   * `_layout.tsx` deep-link handler enqueued before Today mounted. Runs
   * once per session load and after every return-to-foreground so
   * cold-start and warm deep links both work.
   */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const flush = async () => {
      const { consumePendingSiriAction } = await import("@/lib/siriPending");
      const action = await consumePendingSiriAction();
      if (!action || cancelled) return;
      if (action.kind === "log_water") {
        await addWaterMl(action.ml);
      } else if (action.kind === "start_fast") {
        await startFastFromShortcut(action.hours);
      }
      // `today_remaining` only needs the Today tab to be visible — the
      // router already handled that. No state mutation required here.
    };

    void flush();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void flush();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [userId, addWaterMl, startFastFromShortcut]);

  /** Batch 2.5 — caffeine quick-add for the selected day. */
  const addCaffeineMg = useCallback(
    async (mg: number, preset: string | null = null) => {
      if (!userId) return;
      const add = Math.max(0, Math.round(mg));
      if (add === 0) return;
      let persisted: Record<string, number> | null = null;
      setExtraCaffeineByDay((prev) => {
        const next = pruneByDay({ ...prev, [dayKey]: (prev[dayKey] ?? 0) + add });
        persisted = next;
        return next;
      });
      if (persisted) {
        await supabase
          .from("profiles")
          .update({ extra_caffeine_by_day: persisted })
          .eq("id", userId);
      }
      track(AnalyticsEvents.stimulant_logged, {
        type: "caffeine",
        amount: add,
        unit: "mg",
        preset,
      });
    },
    [userId, dayKey],
  );

  /** Batch 2.5 — alcohol quick-add (grams ethanol) for the selected day. */
  const addAlcoholG = useCallback(
    async (grams: number, preset: string | null = null) => {
      if (!userId) return;
      const add = Math.max(0, Math.round(grams));
      if (add === 0) return;
      let persisted: Record<string, number> | null = null;
      setExtraAlcoholGByDay((prev) => {
        const next = pruneByDay({ ...prev, [dayKey]: (prev[dayKey] ?? 0) + add });
        persisted = next;
        return next;
      });
      if (persisted) {
        await supabase
          .from("profiles")
          .update({ extra_alcohol_g_by_day: persisted })
          .eq("id", userId);
      }
      track(AnalyticsEvents.stimulant_logged, {
        type: "alcohol",
        amount: add,
        unit: "g",
        preset,
      });
    },
    [userId, dayKey],
  );

  /** Batch 2.5 — reset today's value for one of the three hydration rows. */
  const resetHydrationStimulantsForDay = useCallback(
    async (kind: "water" | "caffeine" | "alcohol") => {
      if (!userId) return;
      const column =
        kind === "water"
          ? "extra_water_by_day"
          : kind === "caffeine"
          ? "extra_caffeine_by_day"
          : "extra_alcohol_g_by_day";
      const apply = (prev: Record<string, number>): Record<string, number> => {
        if (prev[dayKey] == null) return prev;
        const next = { ...prev };
        delete next[dayKey];
        return next;
      };
      let persisted: Record<string, number> | null = null;
      if (kind === "water") {
        setExtraWaterByDay((prev) => {
          const next = apply(prev);
          persisted = next;
          return next;
        });
      } else if (kind === "caffeine") {
        setExtraCaffeineByDay((prev) => {
          const next = apply(prev);
          persisted = next;
          return next;
        });
      } else {
        setExtraAlcoholGByDay((prev) => {
          const next = apply(prev);
          persisted = next;
          return next;
        });
      }
      if (persisted) {
        await supabase.from("profiles").update({ [column]: persisted }).eq("id", userId);
      }
      track(
        kind === "water" ? AnalyticsEvents.hydration_logged : AnalyticsEvents.stimulant_logged,
        {
          type: kind,
          amount: 0,
          unit: kind === "water" ? "ml" : kind === "caffeine" ? "mg" : "g",
          preset: "reset",
        },
      );
    },
    [userId, dayKey],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 120, gap: Spacing.lg },


        dateNav: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: colors.card,
          borderRadius: Radius.md,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.xl,
        },
        dateNavArrow: { color: colors.textSecondary, fontSize: 22, fontWeight: "600" },
        dateNavLabel: { color: colors.text, fontSize: 16, fontWeight: "600" },

        card: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.xl,
          gap: Spacing.md,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        },
        cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },

        macroBarBlock: { gap: Spacing.xs, paddingVertical: Spacing.sm },
        macroBarTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
        macroBarTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 1 },
        macroBarNums: { fontSize: 12, color: colors.textTertiary, fontVariant: ["tabular-nums"] },
        macroBarTrack: {
          height: 6,
          backgroundColor: colors.border,
          borderRadius: 3,
          overflow: "hidden",
        },
        macroBarFill: { height: 6, borderRadius: 3 },

        // Calorie math
        calorieMathRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.md,
        },
        calorieMathItem: { alignItems: "center" },
        calorieMathNumber: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
        calorieMathLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
        calorieMathOp: { fontSize: 18, color: colors.textTertiary, fontWeight: "600" },

        // Meal sections
        mealSlotHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        mealSlotName: { fontSize: 18, fontWeight: "700", color: colors.text },
        mealSlotCals: { fontSize: 15, fontWeight: "600", color: colors.textSecondary, fontVariant: ["tabular-nums"] },
        mealSlotMacros: { fontSize: 12, color: colors.textSecondary },
        mealRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: Spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        mealName: { fontSize: 15, fontWeight: "500", color: colors.text },
        mealMeta: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
        mealCals: { fontSize: 16, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },

        addFoodBtn: {
          borderWidth: 1,
          borderColor: Accent.primary + "60",
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: "center",
          backgroundColor: Accent.primary + "08",
        },
        addFoodBtnText: { color: Accent.primary, fontWeight: "700", fontSize: 14 },

        emptyText: { color: colors.textTertiary, textAlign: "center", fontSize: 14 },

        // Add food form
        input: {
          backgroundColor: colors.inputBg,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          color: colors.text,
          fontSize: 15,
        },
        inputRow: { flexDirection: "row", gap: Spacing.sm },
        submitBtn: {
          backgroundColor: Accent.primary,
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: "center",
        },
        submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

        offlineBanner: {
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          backgroundColor: colors.card,
          borderRadius: Radius.md,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.lg,
          borderWidth: 1,
          borderColor: Accent.primary + "40",
        },
        offlineBannerText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },

      }),
    [colors],
  );

  const loadJournal = useCallback(async () => {
    if (!userId) return;

    const loadLegacyByDay = async (): Promise<ByDay | null> => {
      const raw = await fetchNutritionJournalByDay(supabase, userId);
      if (!raw) return null;
      const out: ByDay = {};
      for (const [dayKey, meals] of Object.entries(raw)) {
        if (!Array.isArray(meals)) continue;
        out[dayKey] = meals.map((m: Record<string, unknown>) => ({
          id: typeof m.id === "string" ? m.id : newMealId(),
          name: normalizeJournalSlotName(String(m.name ?? "")),
          recipeTitle: String(m.recipeTitle ?? m.recipe_title ?? ""),
          time: String(m.time ?? m.time_label ?? ""),
          calories: Number(m.calories) || 0,
          protein: Number(m.protein) || 0,
          carbs: Number(m.carbs) || 0,
          fat: Number(m.fat) || 0,
          fiberG: m.fiberG != null ? Number(m.fiberG) : m.fiber_g != null ? Number(m.fiber_g) : undefined,
          waterMl: m.waterMl != null ? Number(m.waterMl) : m.water_ml != null ? Number(m.water_ml) : undefined,
          portionMultiplier:
            m.portionMultiplier != null
              ? Number(m.portionMultiplier)
              : m.portion_multiplier != null
                ? Number(m.portion_multiplier)
                : undefined,
          source: m.source != null && String(m.source).trim() !== "" ? String(m.source) : undefined,
        }));
      }
      return out;
    };

    const { data: rows, error } = await supabase
      .from("nutrition_entries")
      .select("id, date_key, name, recipe_title, time_label, calories, protein, carbs, fat, fiber_g, water_ml, portion_multiplier, source, created_at, nutrition_micros")
      .eq("user_id", userId)
      .order("date_key", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(20_000);

    let loaded: ByDay = {};

    if (error) {
      const msg = error.message ?? "";
      if (looksLikeMissingTableError(msg)) {
        const legacy = await loadLegacyByDay();
        setByDay(legacy ?? {});
      } else {
        console.error("[tracker] load failed:", msg);
        setLoadError("Could not load your journal.");
        setByDay({});
      }
    } else {
      setLoadError(null);
      for (const r of rows ?? []) {
        const k = r.date_key as string;
        if (!loaded[k]) loaded[k] = [];
        loaded[k].push({
          id: r.id as string,
          name: normalizeJournalSlotName((r.name as string) ?? ""),
          recipeTitle: (r.recipe_title as string) ?? "",
          time: (r.time_label as string) ?? "",
          calories: (r.calories as number) ?? 0,
          protein: (r.protein as number) ?? 0,
          carbs: (r.carbs as number) ?? 0,
          fat: (r.fat as number) ?? 0,
          fiberG: (r.fiber_g as number) ?? undefined,
          waterMl: (r.water_ml as number) ?? undefined,
          portionMultiplier: (r.portion_multiplier as number) ?? undefined,
          micros: parseNutritionMicrosJson((r as { nutrition_micros?: unknown }).nutrition_micros),
          source: (r.source as string) ?? undefined,
          createdAt: (r as { created_at?: string }).created_at ?? undefined,
        });
      }
      if (Object.keys(loaded).length === 0) {
        const legacy = await loadLegacyByDay();
        if (legacy && Object.keys(legacy).length > 0) loaded = legacy;
      }
      setByDay(loaded);
    }
    setHydrated(true);

    // Today's planned meals: relational `meal_plan_days` + `meal_plan_meals`, else legacy JSON plan
    const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay();
    const { data: dayRow } = await supabase
      .from("meal_plan_days")
      .select("id")
      .eq("user_id", userId)
      .eq("day", todayDow)
      .eq("slot_id", "default")
      .maybeSingle();

    if (dayRow?.id) {
      const { data: mealRows } = await supabase
        .from("meal_plan_meals")
        .select("name, recipe_title, calories, protein, carbs, fat")
        .eq("plan_day_id", dayRow.id)
        .order("slot_index", { ascending: true });
      if (mealRows && mealRows.length > 0) {
        setPlannedMeals(
          mealRows.map((m) => ({
            name: (m.name as string) ?? "",
            recipe_title: (m.recipe_title as string) ?? "",
            calories: (m.calories as number) ?? 0,
            protein: (m.protein as number) ?? 0,
            carbs: (m.carbs as number) ?? 0,
            fat: (m.fat as number) ?? 0,
          })),
        );
      } else {
        setPlannedMeals([]);
      }
    } else {
      const planJson = await fetchMealPlanJson(supabase, userId);
      type LegacyMeal = {
        name?: string;
        recipeTitle?: string;
        recipe_title?: string;
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
      };
      type LegacyDay = { day: number; meals?: LegacyMeal[] };
      if (planJson != null && Array.isArray(planJson)) {
        const dayPlan = (planJson as LegacyDay[]).find((d) => d.day === todayDow);
        const meals = dayPlan?.meals ?? [];
        setPlannedMeals(
          meals.map((m) => ({
            name: m.name,
            recipe_title: m.recipeTitle ?? m.recipe_title,
            calories: m.calories,
            protein: m.protein,
            carbs: m.carbs,
            fat: m.fat,
          })),
        );
      } else {
        setPlannedMeals([]);
      }
    }
  }, [userId]);

  // Reload journal + targets every time this tab comes into focus
  useFocusEffect(
    useCallback(() => {
      void loadJournal();
      void loadProfileTargets();
    }, [loadJournal, loadProfileTargets]),
  );

  // Pull steps / weight / active energy from HealthKit into `profiles`, then refresh targets (throttled app-wide).
  useFocusEffect(
    useCallback(() => {
      if (!userId || !isHealthSyncAvailable()) return;
      void (async () => {
        try {
          await syncHealthDataThrottled(userId);
          await syncNutritionFromHealthThrottled(userId);
          await loadProfileTargets();
          await loadJournal();
        } catch {
          // HealthKit or network — ignore; user can sync from More → Connected
        }
      })();
    }, [userId, loadProfileTargets, loadJournal]),
  );

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Sync journal to relational nutrition_entries table
  useEffect(() => {
    if (!userId || !hydrated) return;
    const t = setTimeout(() => {
      const dk = dateKeyFromDate(selectedDate);
      const todayMeals = byDay[dk] ?? [];
      if (todayMeals.length > 0) {
        const rows = todayMeals.map((m) => ({
          id: UUID_RE.test(m.id) ? m.id : newMealId(),
          user_id: userId,
          date_key: dk,
          name: m.name,
          recipe_title: m.recipeTitle,
          time_label: m.time,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          fiber_g: m.fiberG ?? null,
          water_ml: m.waterMl ?? null,
          portion_multiplier: m.portionMultiplier ?? 1,
          nutrition_micros: m.micros && Object.keys(m.micros).length > 0 ? m.micros : {},
          source: m.source ?? null,
        }));
        void supabase
          .from("nutrition_entries")
          .upsert(rows, { onConflict: "id" })
          .then(({ error }) => {
            if (error) console.error("[tracker] sync failed:", error.message);
            else void refreshAdaptiveTdeeForUser(supabase, userId);
          });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [userId, hydrated, byDay, selectedDate]);

  const addMeal = useCallback(() => {
    const cal = Number(kcal) || 0;
    const p = Number(protein) || 0;
    const cb = Number(carbs) || 0;
    const f = Number(fat) || 0;
    if (cal <= 0) return;

    const meal: JournalMeal = {
      id: newMealId(),
      name: activeMealSlot,
      recipeTitle: title.trim() || "Quick entry",
      time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      calories: Math.round(cal),
      protein: Math.round(p),
      carbs: Math.round(cb),
      fat: Math.round(f),
      source: "Manual",
    };
    setByDay((prev) => ({
      ...prev,
      [dayKey]: [...(prev[dayKey] ?? []), meal],
    }));
    setTitle("");
    setKcal("");
    setProtein("");
    setCarbs("");
    setFat("");
    setAddOpen(false);
  }, [dayKey, kcal, protein, carbs, fat, title, activeMealSlot]);

  const deleteMeal = useCallback((mealId: string) => {
    setByDay((prev) => ({
      ...prev,
      [dayKey]: (prev[dayKey] ?? []).filter((m) => m.id !== mealId),
    }));

    // Persist deletion to Supabase (relational table).
    // Without this, the meal reappears on next app launch.
    if (userId) {
      void supabase
        .from("nutrition_entries")
        .delete()
        .eq("id", mealId)
        .then(({ error }) => {
          if (error) {
            console.error("[tracker] delete meal failed:", error.message);
          }
        });
    }
  }, [dayKey, userId]);

  /**
   * Shared insert primitive for batch 1.4 "copy meal" / "duplicate day".
   *
   * Optimistically adds rows to `byDay[targetDayKey]` and writes them
   * straight to `nutrition_entries`. We cannot reuse the debounced
   * selected-day sync effect because the target day may not be the
   * currently selected day — without the explicit insert those rows
   * would only persist once the user navigates to that day.
   *
   * `rows` are clones produced by `cloneMealWithoutId`, so there is no
   * id on them yet; a fresh `newMealId()` is minted per row.
   */
  const insertClonedRowsIntoDay = useCallback(
    async (targetDayKey: string, clones: Array<Omit<JournalMeal, "id">>): Promise<void> => {
      if (clones.length === 0) return;
      const withIds: JournalMeal[] = clones.map((c) => ({ ...c, id: newMealId() } as JournalMeal));
      setByDay((prev) => ({
        ...prev,
        [targetDayKey]: [...(prev[targetDayKey] ?? []), ...withIds],
      }));
      if (!userId) return;
      const dbRows = withIds.map((m) => ({
        id: m.id,
        user_id: userId,
        date_key: targetDayKey,
        name: m.name,
        recipe_title: m.recipeTitle,
        time_label: m.time,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        fiber_g: m.fiberG ?? null,
        water_ml: m.waterMl ?? null,
        portion_multiplier: m.portionMultiplier ?? 1,
        nutrition_micros: m.micros && Object.keys(m.micros).length > 0 ? m.micros : {},
        source: m.source ?? null,
      }));
      const { error } = await supabase.from("nutrition_entries").insert(dbRows);
      if (error) {
        console.error("[tracker] copy/duplicate insert failed:", error.message);
        // Roll back optimistic add.
        setByDay((prev) => ({
          ...prev,
          [targetDayKey]: (prev[targetDayKey] ?? []).filter((m) => !withIds.some((w) => w.id === m.id)),
        }));
        Alert.alert("Couldn't copy", error.message);
      } else {
        void refreshAdaptiveTdeeForUser(supabase, userId);
      }
    },
    [userId],
  );

  const copyMealToDate = useCallback(
    async (sourceDayKey: string, mealId: string, targetDayKey: string): Promise<void> => {
      if (!sourceDayKey || !mealId || !targetDayKey) return;
      if (sourceDayKey === targetDayKey) return;
      const meal = (byDay[sourceDayKey] ?? []).find((m) => m.id === mealId);
      if (!meal) return;
      const cloned = cloneMealWithoutId(meal) as Omit<JournalMeal, "id">;
      await insertClonedRowsIntoDay(targetDayKey, [cloned]);
      try { track(AnalyticsEvents.meal_copied, { source: "copy_meal", batchSize: 1, targetDayCount: 1 }); } catch { /* noop */ }
    },
    [byDay, insertClonedRowsIntoDay],
  );

  const copyMealToDateRange = useCallback(
    async (sourceDayKey: string, mealId: string, targetDayKeys: string[]): Promise<void> => {
      if (!sourceDayKey || !mealId) return;
      const clean = sanitizeCopyTargets(sourceDayKey, targetDayKeys);
      if (clean.length === 0) return;
      const meal = (byDay[sourceDayKey] ?? []).find((m) => m.id === mealId);
      if (!meal) return;
      for (const t of clean) {
        const cloned = cloneMealWithoutId(meal) as Omit<JournalMeal, "id">;
        await insertClonedRowsIntoDay(t, [cloned]);
      }
      try {
        track(AnalyticsEvents.meal_copied, { source: "copy_meal", batchSize: 1, targetDayCount: clean.length });
      } catch { /* noop */ }
    },
    [byDay, insertClonedRowsIntoDay],
  );

  const duplicateDay = useCallback(
    async (sourceDayKey: string, targetDayKey: string): Promise<void> => {
      if (!sourceDayKey || !targetDayKey) return;
      if (sourceDayKey === targetDayKey) return;
      const src = byDay[sourceDayKey] ?? [];
      if (src.length === 0) return;
      const clones = src.map((m) => cloneMealWithoutId(m) as Omit<JournalMeal, "id">);
      await insertClonedRowsIntoDay(targetDayKey, clones);
      try {
        track(AnalyticsEvents.day_duplicated, { source: "duplicate_day", batchSize: src.length, targetDayCount: 1 });
      } catch { /* noop */ }
    },
    [byDay, insertClonedRowsIntoDay],
  );

  const duplicateDayToDateRange = useCallback(
    async (sourceDayKey: string, targetDayKeys: string[]): Promise<void> => {
      if (!sourceDayKey) return;
      const clean = sanitizeCopyTargets(sourceDayKey, targetDayKeys);
      if (clean.length === 0) return;
      const src = byDay[sourceDayKey] ?? [];
      if (src.length === 0) return;
      for (const t of clean) {
        const clones = src.map((m) => cloneMealWithoutId(m) as Omit<JournalMeal, "id">);
        await insertClonedRowsIntoDay(t, clones);
      }
      try {
        track(AnalyticsEvents.day_duplicated, { source: "duplicate_day", batchSize: src.length, targetDayCount: clean.length });
      } catch { /* noop */ }
    },
    [byDay, insertClonedRowsIntoDay],
  );

  const syncEditCanonicalFromFields = useCallback(() => {
    const p = parseFloat(editPortion.replace(",", ".")) || 1;
    if (p <= 0) return;
    editCanonicalRef.current = {
      cal: (Number(editKcal) || 0) / p,
      p: (Number(editProtein) || 0) / p,
      cb: (Number(editCarbs) || 0) / p,
      f: (Number(editFat) || 0) / p,
    };
  }, [editPortion, editKcal, editProtein, editCarbs, editFat]);

  const applyEditPortionMultiplier = useCallback(
    (raw: number) => {
      syncEditCanonicalFromFields();
      const clamped = Math.max(0.125, Math.min(24, raw));
      const c = editCanonicalRef.current;
      const roundedP = Math.round(clamped * 1000) / 1000;
      setEditPortion(String(roundedP));
      setEditKcal(String(Math.round(c.cal * clamped)));
      setEditProtein(String(Math.round(c.p * clamped * 10) / 10));
      setEditCarbs(String(Math.round(c.cb * clamped * 10) / 10));
      setEditFat(String(Math.round(c.f * clamped * 10) / 10));
    },
    [syncEditCanonicalFromFields],
  );

  const openEditMeal = useCallback((meal: JournalMeal) => {
    const p0 = meal.portionMultiplier ?? 1;
    editCanonicalRef.current = {
      cal: meal.calories / p0,
      p: meal.protein / p0,
      cb: meal.carbs / p0,
      f: meal.fat / p0,
    };
    const pLabel = Number.isInteger(p0) ? String(p0) : String(Math.round(p0 * 100) / 100);
    setEditPortion(pLabel);
    setEditingMeal(meal);
    setEditTitle(meal.recipeTitle);
    setEditKcal(String(Math.round(meal.calories)));
    setEditProtein(String(Math.round(meal.protein * 10) / 10));
    setEditCarbs(String(Math.round(meal.carbs * 10) / 10));
    setEditFat(String(Math.round(meal.fat * 10) / 10));
    setEditSlot(normalizeJournalSlotName(meal.name) || "Snacks");
  }, []);

  /** Open edit modal when returning from meal nutrition screen with `editMealId`. */
  useEffect(() => {
    const raw = params.editMealId;
    const editId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
    if (!editId || !hydrated) return;
    const dk =
      params.date && /^\d{4}-\d{2}-\d{2}$/.test(String(params.date))
        ? String(params.date)
        : dateKeyFromDate(selectedDate);
    const meal = (byDay[dk] ?? []).find((m) => m.id === editId);
    if (meal) {
      openEditMeal(meal);
      router.setParams({ editMealId: undefined } as Record<string, undefined>);
    }
  }, [params.editMealId, params.date, hydrated, byDay, selectedDate, openEditMeal, router]);

  const saveEditMeal = useCallback(() => {
    if (!editingMeal) return;
    const portionMul = Math.max(0.125, Math.min(24, parseFloat(editPortion.replace(",", ".")) || 1));
    const updated: JournalMeal = {
      ...editingMeal,
      recipeTitle: editTitle.trim() || editingMeal.recipeTitle,
      name: editSlot,
      calories: Math.round(Number(editKcal) || editingMeal.calories),
      protein: Math.round((Number(editProtein) || 0) * 10) / 10,
      carbs: Math.round((Number(editCarbs) || 0) * 10) / 10,
      fat: Math.round((Number(editFat) || 0) * 10) / 10,
      portionMultiplier: portionMul,
    };
    setByDay((prev) => ({
      ...prev,
      [dayKey]: (prev[dayKey] ?? []).map((m) => (m.id === editingMeal.id ? updated : m)),
    }));
    setEditingMeal(null);
  }, [editingMeal, editTitle, editSlot, editKcal, editProtein, editCarbs, editFat, editPortion, dayKey]);

  const logPlannedMealWithPortion = useCallback(
    async (
      pm: { name?: string; recipe_title?: string; calories?: number; protein?: number; carbs?: number; fat?: number },
      portion: number,
    ) => {
      if (!userId) return;
      const mult = Math.max(0.125, Math.min(24, portion));
      const entryId = newMealId();
      const dk = dateKeyFromDate(selectedDate);
      const { error } = await supabase.from("nutrition_entries").insert({
        id: entryId,
        user_id: userId,
        date_key: dk,
        name: pm.name ?? pm.recipe_title ?? "",
        recipe_title: pm.recipe_title ?? pm.name ?? "",
        time_label: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        calories: Math.round((pm.calories ?? 0) * mult),
        protein: Math.round((pm.protein ?? 0) * mult * 10) / 10,
        carbs: Math.round((pm.carbs ?? 0) * mult * 10) / 10,
        fat: Math.round((pm.fat ?? 0) * mult * 10) / 10,
        fiber_g: (pm as any).fiber_g != null ? Math.round(Number((pm as any).fiber_g) * mult * 10) / 10 : null,
        water_ml: (pm as any).water_ml != null ? Math.round(Number((pm as any).water_ml) * mult) : null,
        portion_multiplier: mult,
        source: "Meal plan",
      });
      if (error) {
        Alert.alert("Log failed", error.message);
      } else {
        void loadJournal();
      }
    },
    [userId, selectedDate, loadJournal],
  );

  // Group meals by slot
  const mealGroups = useMemo(() => {
    const groups: Record<string, JournalMeal[]> = {};
    for (const m of mealsToday) {
      const slot = m.name || "Other";
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(m);
    }
    return groups;
  }, [mealsToday]);

  const toggleSlotCollapse = useCallback((slot: string) => {
    setCollapsedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }, []);

  if (!hydrated && !loadError) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.scroll}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ width: 80, height: 20, backgroundColor: colors.border, borderRadius: Radius.sm }} />
            <View style={{ width: 72, height: 16, backgroundColor: colors.border, borderRadius: Radius.sm }} />
          </View>
          <View style={{ height: 160, backgroundColor: colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border }} />
          <View style={{ height: 80, backgroundColor: colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border }} />
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ height: 64, backgroundColor: colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border }} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, position: "relative" }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Date navigation header */}
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable onPress={() => viewMode === "week" ? navigateWeek(-1) : navigateDay(-1)} hitSlop={12} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="chevron-back" size={16} color={colors.text} />
              </Pressable>
              <Pressable onPress={() => { setSelectedDate(new Date()); setViewMode("day"); }} hitSlop={8}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textTertiary, letterSpacing: 1, textTransform: "uppercase" }}>
                  {viewMode === "week" ? weekData.label : `${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${selectedDate.toLocaleDateString("en-US", { weekday: "long" })}`}
                </Text>
                <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text, letterSpacing: -0.4, marginTop: 1 }}>
                  {viewMode === "week" ? "This Week" : isToday ? "Today" : formatDateLabel(selectedDate)}
                </Text>
              </Pressable>
              <Pressable onPress={() => viewMode === "week" ? navigateWeek(1) : navigateDay(1)} hitSlop={12} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="chevron-forward" size={16} color={colors.text} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {/* Day / Week toggle */}
              <View style={{ flexDirection: "row", borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" }}>
                <Pressable
                  onPress={() => setViewMode("day")}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: viewMode === "day" ? Accent.primary : "transparent" }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: viewMode === "day" ? "#fff" : colors.textSecondary }}>Day</Text>
                </Pressable>
                <Pressable
                  onPress={() => setViewMode("week")}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: viewMode === "week" ? Accent.primary : "transparent" }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: viewMode === "week" ? "#fff" : colors.textSecondary }}>Week</Text>
                </Pressable>
              </View>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: Accent.primary + "10", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.primary }}>
                  {session?.user?.email?.[0]?.toUpperCase() ?? "U"}
                </Text>
              </View>
            </View>
          </View>
          {/* Mini day strip in day mode — tap a day to jump */}
          {viewMode === "day" && (
            <DayStrip
              selectedDate={selectedDate}
              weekStartDay={weekStartDay}
              loggedDays={loggedDays}
              onSelectDate={(d) => setSelectedDate(clampJournalDate(d))}
              onOpenCalendar={() => setJournalCalendarOpen(true)}
              textColor={colors.text}
              secondaryColor={colors.textSecondary}
            />
          )}
        </View>

        {isOffline && (
          <View style={styles.offlineBanner} accessibilityRole="alert">
            <Ionicons name="cloud-offline-outline" size={18} color={Accent.primary} />
            <Text style={styles.offlineBannerText}>{"You're offline. Changes sync when you reconnect."}</Text>
          </View>
        )}

        {/* Error banner */}
        {loadError && (
          <Pressable
            onPress={() => { setLoadError(null); void loadJournal(); }}
            style={{ backgroundColor: Accent.destructive + "15", borderRadius: Radius.md, padding: Spacing.md, flexDirection: "row", alignItems: "center", gap: Spacing.sm }}
          >
            <Ionicons name="alert-circle" size={18} color={Accent.destructive} />
            <Text style={{ flex: 1, fontSize: 13, color: Accent.destructive, fontWeight: "600" }}>
              Could not load journal. Tap to retry.
            </Text>
          </Pressable>
        )}

        {/* Day-of-week strip in week mode */}
        {viewMode === "week" && (
          <DayStrip
            selectedDate={selectedDate}
            weekStartDay={weekStartDay}
            loggedDays={loggedDays}
            onSelectDate={(d) => {
              setSelectedDate(clampJournalDate(d));
              setViewMode("day");
            }}
            onOpenCalendar={() => setJournalCalendarOpen(true)}
            textColor={colors.text}
            secondaryColor={colors.textSecondary}
          />
        )}

        {/* Streak badge — removed from here, shown after meals section in prototype style */}

        {/* Fasting status pill */}
        {viewMode === "day" && activeFastStart && (() => {
          const elapsedH = Math.max(0, (fastingTick - new Date(activeFastStart).getTime()) / 3600_000);
          const h = Math.floor(elapsedH);
          const m = Math.floor((elapsedH - h) * 60);
          return (
            <Pressable
              onPress={() => router.push("/fasting")}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                paddingVertical: 6, paddingHorizontal: Spacing.lg,
                alignSelf: "center",
                backgroundColor: Accent.primary + "15",
                borderRadius: Radius.md,
                marginVertical: Spacing.xs,
              }}
            >
              <Ionicons name="time" size={16} color={Accent.primary} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: Accent.primary }}>
                Fasting — {h}h {m}m
              </Text>
            </Pressable>
          );
        })()}

        {viewMode === "week" ? (
          <>
            {/* Weekly bar chart */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly Calories</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 140, marginTop: Spacing.md }}>
                {weekData.days.map((day) => {
                  const dayGoal =
                    targets.calories +
                    dayActivityBudgetAddon(
                      preferActivityAdjustedCalories,
                      activityBonusCaloriesOnly,
                      activityBurnByDay,
                      basalBurnByDay,
                      maintenanceKcal,
                      day.key,
                    );
                  const maxCal = Math.max(
                    1,
                    ...weekData.days.map((d) =>
                      Math.max(
                        d.totals.calories,
                        targets.calories +
                          dayActivityBudgetAddon(
                            preferActivityAdjustedCalories,
                            activityBonusCaloriesOnly,
                            activityBurnByDay,
                            basalBurnByDay,
                            maintenanceKcal,
                            d.key,
                          ),
                      ),
                    ),
                  );
                  const barHeight = maxCal > 0 ? Math.max(4, (day.totals.calories / maxCal) * 110) : 4;
                  const over = day.totals.calories > dayGoal;
                  const todayDk = dateKeyFromDate(new Date());
                  const isCurrentDay = day.key === todayDk;
                  return (
                    <Pressable
                      key={day.key}
                      onPress={() => { setSelectedDate(day.date); setViewMode("day"); }}
                      style={{ alignItems: "center", flex: 1, gap: 4 }}
                    >
                      <Text style={{ fontSize: 10, color: colors.textTertiary, fontVariant: ["tabular-nums"] }}>
                        {day.totals.calories > 0 ? Math.round(day.totals.calories) : ""}
                      </Text>
                      <View
                        style={{
                          width: 28,
                          height: barHeight,
                          borderRadius: 4,
                          backgroundColor: over ? Accent.destructive + "CC" : day.totals.calories > 0 ? Accent.primary : colors.border,
                        }}
                      />
                      <Text style={{
                        fontSize: 11,
                        fontWeight: isCurrentDay ? "800" : "600",
                        color: isCurrentDay ? Accent.primary : colors.textSecondary,
                      }}>
                        {day.short}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {/* Goal line label */}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 4 }}>
                <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                  {preferActivityAdjustedCalories
                    ? activityBonusCaloriesOnly
                      ? `Goal: ${targets.calories} kcal base + bonus burn (above ~${maintenanceKcal} kcal maintenance) from Health`
                      : `Goal: ${targets.calories} kcal base + active energy from Health`
                    : `Daily goal: ${targets.calories} kcal`}
                </Text>
              </View>
            </View>

            {/* Weekly summary */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly Summary</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: Spacing.md }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>{Math.round(weekData.weekTotals.calories)}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Total kcal</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: Accent.primary, fontVariant: ["tabular-nums"] }}>{Math.round(weekData.weekAvg.calories)}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Daily avg</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: weekEffectiveCalorieBudget > weekData.weekTotals.calories ? Accent.success : Accent.destructive, fontVariant: ["tabular-nums"] }}>
                    {Math.round(Math.abs(weekEffectiveCalorieBudget - weekData.weekTotals.calories))}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {weekEffectiveCalorieBudget > weekData.weekTotals.calories ? "Under budget" : "Over budget"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Weekly macro averages */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily Averages</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: Spacing.sm }}>
                Based on {weekData.daysWithFood} day{weekData.daysWithFood !== 1 ? "s" : ""} with logged food
              </Text>
              <MacroBarRow label="PROTEIN" current={weekData.weekAvg.protein} goal={targets.protein} color={MacroColors.protein} styles={styles} />
              <MacroBarRow label="CARBS" current={weekData.weekAvg.carbs} goal={targets.carbs} color={MacroColors.carbs} styles={styles} />
              <MacroBarRow label="FATS" current={weekData.weekAvg.fat} goal={targets.fat} color={MacroColors.fat} styles={styles} />
            </View>

            {/* Macro bars per day */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Macro Breakdown</Text>
              <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
                {weekData.days.map((day) => (
                  <Pressable
                    key={day.key}
                    onPress={() => { setSelectedDate(day.date); setViewMode("day"); }}
                    style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}
                  >
                    <Text style={{ width: 30, fontSize: 11, fontWeight: "600", color: colors.textSecondary }}>{day.short}</Text>
                    <View style={{ flex: 1, flexDirection: "row", height: 14, borderRadius: 3, overflow: "hidden", backgroundColor: colors.border }}>
                      {day.totals.calories > 0 && (() => {
                        const total = day.totals.protein + day.totals.carbs + day.totals.fat || 1;
                        return (
                          <>
                            <View style={{ width: `${(day.totals.protein / total) * 100}%`, backgroundColor: MacroColors.protein }} />
                            <View style={{ width: `${(day.totals.carbs / total) * 100}%`, backgroundColor: MacroColors.carbs }} />
                            <View style={{ width: `${(day.totals.fat / total) * 100}%`, backgroundColor: MacroColors.fat }} />
                          </>
                        );
                      })()}
                    </View>
                    <Text style={{ width: 45, fontSize: 11, color: colors.textTertiary, textAlign: "right", fontVariant: ["tabular-nums"] }}>
                      {day.totals.calories > 0 ? `${Math.round(day.totals.calories)}` : "—"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: Spacing.lg, justifyContent: "center", marginTop: Spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MacroColors.protein }} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>Protein</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MacroColors.carbs }} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>Carbs</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MacroColors.fat }} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>Fat</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Calorie Ring — centered, tappable, prototype style */}
            <View style={{ alignItems: "center", paddingVertical: 14 }}>
              <CalorieRing
                consumed={totals.calories}
                goal={effectiveCalorieGoal}
                baseGoal={todayActivityBudgetAddon > 0 ? targets.calories : undefined}
                textColor={colors.text}
                secondaryColor={colors.textSecondary}
                trackColor={colors.border}
                proteinPct={targets.protein > 0 ? Math.min(totals.protein / targets.protein, 1) : 0}
                carbsPct={targets.carbs > 0 ? Math.min(totals.carbs / targets.carbs, 1) : 0}
                fatPct={targets.fat > 0 ? Math.min(totals.fat / targets.fat, 1) : 0}
                expanded={ringExpanded}
                onToggle={() => setRingExpanded((e) => !e)}
                displayMode={calorieDisplayMode}
                onToggleDisplayMode={() => setCalorieDisplayMode((m) => m === "remaining" ? "consumed" : "remaining")}
              />
              <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 6, textAlign: "center" }}>
                {ringExpanded ? "Tap to hide macros" : "Tap to show macros"}
              </Text>
            </View>

            {/* Remaining macros — kcal / P / C / F (+ fiber when tracked) left today. Parity: web RemainingMacrosBar. */}
            <RemainingMacrosBar
              style={{ marginBottom: Spacing.md }}
              targets={{
                calories: effectiveCalorieGoal,
                protein: targets.protein,
                carbs: targets.carbs,
                fat: targets.fat,
                fiber: targets.fiber,
              }}
              consumed={{
                calories: totals.calories,
                protein: totals.protein,
                carbs: totals.carbs,
                fat: totals.fat,
                fiber: totals.fiber,
              }}
            />

            {/* Dynamic Macro Cards */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {trackedMacros.map((macro) => {
                const microSum = mealsToday.reduce((a, m) => ({
                  sugarG: a.sugarG + ((m.micros as any)?.sugarG ?? 0),
                  sodiumMg: a.sodiumMg + ((m.micros as any)?.sodiumMg ?? 0),
                }), { sugarG: 0, sodiumMg: 0 });
                const macroMap: Record<string, { label: string; cur: number; tgt: number; color: string; unit: string }> = {
                  protein: { label: "Protein", cur: totals.protein, tgt: targets.protein, color: MacroColors.protein, unit: "g" },
                  carbs: { label: "Carbs", cur: totals.carbs, tgt: targets.carbs, color: MacroColors.carbs, unit: "g" },
                  fat: { label: "Fat", cur: totals.fat, tgt: targets.fat, color: MacroColors.fat, unit: "g" },
                  fiber: { label: "Fiber", cur: totals.fiber, tgt: targets.fiber, color: Accent.success, unit: "g" },
                  sugar: { label: "Sugar", cur: Math.round(microSum.sugarG * 10) / 10, tgt: 50, color: Accent.warning, unit: "g" },
                  sodium: { label: "Sodium", cur: Math.round(microSum.sodiumMg), tgt: 2300, color: Accent.destructive, unit: "mg" },
                  water: { label: "Water", cur: totalWaterMl, tgt: waterGoalMl, color: MacroColors.water ?? Accent.info, unit: "ml" },
                };
                const m = macroMap[macro];
                if (!m) return null;
                const displayAmount =
                  macro === "fiber" ? Math.round(m.cur * 10) / 10 : Math.round(m.cur);
                return (
                  <Pressable
                    key={macro}
                    onPress={() => router.push({ pathname: "/macro-detail", params: { macro, date: dayKey } })}
                    style={{ flex: 1, minWidth: 70, padding: 10, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 5 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: m.color }} />
                      <Text style={{ fontSize: 10, fontWeight: "600", color: colors.textTertiary, letterSpacing: 0.5 }}>{m.label}</Text>
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] }}>{displayAmount}{m.unit}</Text>
                    <View style={{ marginTop: 5, height: 4, borderRadius: 2, backgroundColor: colors.border }}>
                      <View style={{ width: `${Math.min(m.cur / Math.max(m.tgt, 1), 1) * 100}%`, height: "100%", borderRadius: 2, backgroundColor: m.color }} />
                    </View>
                    <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 3, fontVariant: ["tabular-nums"] }}>
                      {m.cur < m.tgt ? `${Math.round(m.tgt - m.cur)}${m.unit} left` : `of ${m.tgt}${m.unit}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* All nutrients detail link */}
            {dayNutrientDetailRowsWithoutMacroDupes.length > 0 ? (
              <Pressable onPress={() => setNutrientsModalOpen(true)} style={{ marginBottom: 12, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: Accent.primary, textAlign: "center" }}>
                  View all nutrients ({dayNutrientDetailRowsWithoutMacroDupes.length})
                </Text>
              </Pressable>
            ) : null}

            {/* 4 Quick-log chips — prototype style.
                Batch 5.13 — Voice and Photo are Pro features; free + base
                tiers see a lock icon and the Pro paywall on tap. Mirrors
                the web quick-log strip ordering. */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
              {([
                ["Search", "search-outline" as const, Accent.warning, () => { setSearchOpen(true); }, false],
                ["Voice", "mic-outline" as const, Accent.success, handleOpenVoiceLog, userTier !== "pro"],
                ["Snap", "camera-outline" as const, Accent.primary, handleOpenPhotoLog, userTier !== "pro"],
                ["Scan", "scan-outline" as const, Accent.magenta, () => { setBarcodeOpen(true); }, false],
              ] as const).map(([label, iconName, color, onPress, locked]) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={locked ? `${label} — Pro feature` : label}
                  onPress={onPress}
                  style={{ flex: 1, alignItems: "center", gap: 5, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: color + "18", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={iconName} size={14} color={color} />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: "500", color: colors.textSecondary }}>{label}</Text>
                    {locked && <Ionicons name="lock-closed" size={9} color={colors.textTertiary} />}
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Streak insight card — prototype style (after meals) */}
        {viewMode === "day" && streakDays > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Accent.success + "08", borderWidth: 1, borderColor: Accent.success + "18" }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Accent.success + "18", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="flame" size={18} color={Accent.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: Accent.success }}>{streakDays}-day logging streak</Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>You&apos;ve logged meals {streakDays} days in a row.</Text>
              {freezesAvailableToday > 0 ? (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}
                  accessible
                  accessibilityLabel={`${freezesAvailableToday} streak freeze${freezesAvailableToday === 1 ? "" : "s"} available`}
                >
                  <Ionicons name="snow-outline" size={11} color={Accent.primary} />
                  <Text style={{ fontSize: 11, color: Accent.primary, fontWeight: "600" }}>
                    {freezesAvailableToday} freeze{freezesAvailableToday === 1 ? "" : "s"} available
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Deficit insight */}
        {viewMode === "day" && isToday && remaining > 0 && (
          <View style={{ backgroundColor: Accent.primary + "12", borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Accent.primary + "25" }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: Accent.primary }}>
              ~{remaining} kcal under budget so far today
            </Text>
            {(() => {
              const keys = weekSummaryDateKeys(weekSummaryMode, selectedDate, weekStartDay);
              const keysWithMeals = keys.filter((k) => (byDay[k] ?? []).length > 0);
              if (keysWithMeals.length < 2) return null;
              const avgDeficit = Math.round(
                keysWithMeals.reduce((sum, k) => {
                  const dayCals = (byDay[k] ?? []).reduce((a, m) => a + m.calories, 0);
                  const dayGoal =
                    targets.calories +
                    dayActivityBudgetAddon(
                      preferActivityAdjustedCalories,
                      activityBonusCaloriesOnly,
                      activityBurnByDay,
                      basalBurnByDay,
                      maintenanceKcal,
                      k,
                    );
                  return sum + (dayGoal - dayCals);
                }, 0) / keysWithMeals.length,
              );
              if (avgDeficit <= 0) return null;
              return (
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                  {weekSummaryMode === "calendar_week" ? "Week avg" : "7-day avg"}: ~{avgDeficit} kcal/day under goal
                </Text>
              );
            })()}
          </View>
        )}

        {/* Meal sections (day view only) — prototype style: single card, IconBox per slot */}
        {/* Eat again — suggest re-logging the most recent meal in the
            slot matching the current clock time. Dismissible per day. */}
        {viewMode === "day" && isToday && eatAgainSuggestion && !eatAgainDismissedForToday && (
          <View style={{
            marginBottom: Spacing.md,
            backgroundColor: Accent.primary + "10",
            borderWidth: 1,
            borderColor: Accent.primary + "40",
            borderRadius: Radius.lg,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.sm,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: Accent.primary, letterSpacing: 1 }}>EAT AGAIN</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 2 }} numberOfLines={1}>
                {eatAgainSuggestion.recipeTitle}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                {Math.round(eatAgainSuggestion.calories)} kcal · P {Math.round(eatAgainSuggestion.protein)}g · C {Math.round(eatAgainSuggestion.carbs)}g · F {Math.round(eatAgainSuggestion.fat)}g · into {currentSlotFromTime}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Log ${eatAgainSuggestion.recipeTitle} to ${currentSlotFromTime}`}
              onPress={() => logHistoryItemToSlot(eatAgainSuggestion, currentSlotFromTime)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.sm, backgroundColor: Accent.primary }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff", letterSpacing: 0.5 }}>LOG</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss Eat again suggestion"
              onPress={dismissEatAgain}
              hitSlop={8}
              style={{ padding: 4 }}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}

        {viewMode === "day" && (() => {
          const slotIcon = (s: string): keyof typeof Ionicons.glyphMap =>
            ({
              Breakfast: "cafe-outline",
              Lunch: "sunny-outline",
              Dinner: "restaurant-outline",
              Snacks: "cafe-outline",
              Snack: "cafe-outline",
            }[s] ?? "restaurant-outline") as any;
          const slotColor = (s: string) =>
            ({
              Breakfast: Accent.warning,
              Lunch: Accent.success,
              Dinner: Accent.primary,
              Snacks: MacroColors.fat,
              Snack: MacroColors.fat,
            }[s] ?? Accent.primary);
          return (
            <View>
              {/* Batch 1.4 — Day header action: duplicate today's meals to another day */}
              {mealsToday.length > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 6 }}>
                  <Pressable
                    onPress={() => setDuplicateDayOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Duplicate this day to another day"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: Accent.primary + "12",
                    }}
                  >
                    <Ionicons name="copy-outline" size={12} color={Accent.primary} />
                    <Text style={{ fontSize: 11, fontWeight: "600", color: Accent.primary }}>
                      Duplicate day…
                    </Text>
                  </Pressable>
                </View>
              )}
              <View style={{ backgroundColor: colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden", marginBottom: Spacing.lg }}>
              {MEAL_SLOTS.map((slot) => {
                const meals = mealGroups[slot] ?? [];
                const slotCals = Math.round(meals.reduce((a, m) => a + m.calories, 0));
                const isOpen = !collapsedSlots.has(slot);
                const hasMeals = meals.length > 0;
                const ic = slotIcon(slot);
                const col = slotColor(slot);
                return (
                  <View key={slot}>
                    {/* Slot header — tap to expand/collapse or add; per-meal nutrients on each meal row */}
                    <Pressable
                      onPress={() => (hasMeals ? toggleSlotCollapse(slot) : (() => { setActiveMealSlot(slot); setFabSheetOpen(true); })())}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        borderBottomWidth: 1,
                        borderBottomColor: colors.cardBorder,
                        opacity: hasMeals ? 1 : 0.45,
                        padding: 12,
                        paddingHorizontal: 14,
                        gap: 10,
                      }}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: col + "18", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={ic} size={16} color={col} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>{slot}</Text>
                        {hasMeals ? (
                          <Text style={{ fontSize: 11, color: colors.textTertiary }}>{meals.length} item{meals.length > 1 ? "s" : ""} · tap a meal for full nutrition</Text>
                        ) : (
                          <Text style={{ fontSize: 11, color: colors.textTertiary }}>Tap to add</Text>
                        )}
                      </View>
                      {hasMeals ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {/* Batch 2.6 — save this slot as a meal combo when the slot has 2+ items */}
                          {meals.length >= 2 && (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation?.();
                                openSaveMealSheetForSlot(slot);
                              }}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={`Save ${slot} items as a meal combo`}
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: colors.cardBorder,
                                backgroundColor: "transparent",
                              }}
                            >
                              <Text style={{ fontSize: 10, fontWeight: "600", color: colors.textSecondary }}>
                                Save combo
                              </Text>
                            </Pressable>
                          )}
                          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] }}>{slotCals}</Text>
                          <Text style={{ fontSize: 10, color: colors.textTertiary }}>kcal</Text>
                        </View>
                      ) : (
                        <Ionicons name="add" size={14} color={colors.textTertiary} />
                      )}
                    </Pressable>
                    {/* Expanded meal items */}
                    {hasMeals && isOpen && meals.map((m) => (
                      <Swipeable
                        key={m.id}
                        overshootRight={false}
                        friction={2}
                        renderRightActions={() => (
                          <View style={{ flexDirection: "row", alignItems: "stretch" }}>
                            <Pressable
                              onPress={() => {
                                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                deleteMeal(m.id);
                              }}
                              style={{
                                width: 88,
                                backgroundColor: Accent.destructive,
                                justifyContent: "center",
                                alignItems: "center",
                                paddingVertical: 8,
                              }}
                              accessibilityRole="button"
                              accessibilityLabel="Remove meal"
                            >
                              <Ionicons name="trash-outline" size={22} color="#fff" />
                              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 4 }}>Remove</Text>
                            </Pressable>
                          </View>
                        )}
                      >
                        <Pressable
                          onPress={() => router.push(`/meal-nutrition?id=${encodeURIComponent(m.id)}` as const)}
                          onLongPress={() => {
                            Alert.alert(m.recipeTitle, formatMealMacroDetail(m), [
                              { text: "Cancel", style: "cancel" },
                              { text: "Edit", onPress: () => openEditMeal(m) },
                              { text: "Copy to another day", onPress: () => setCopyMealTargetId(m.id) },
                              { text: "Delete", style: "destructive", onPress: () => deleteMeal(m.id) },
                            ]);
                          }}
                          style={{
                            paddingVertical: 9,
                            paddingLeft: 56,
                            paddingRight: 14,
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottomWidth: 1,
                            borderBottomColor: colors.cardBorder + "08",
                            backgroundColor: colors.card,
                          }}
                        >
                          <View style={{ flex: 1, gap: 2 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Accent.success }} />
                              <Text style={{ fontSize: 12, color: colors.text }} numberOfLines={1}>
                                {m.recipeTitle}
                              </Text>
                            </View>
                            {showMealTimestamps ? (
                              (() => {
                                const ts = formatMealTimeDisplay(m.time, m.createdAt);
                                return ts ? (
                                  <Text style={{ fontSize: 10, color: colors.textTertiary, marginLeft: 12 }}>{ts}</Text>
                                ) : null;
                              })()
                            ) : null}
                            {formatMealSourceLabelForRow(m.source) ? (
                              <Text style={{ fontSize: 9, color: colors.textTertiary, marginLeft: 12, fontWeight: "500" }}>
                                {formatMealSourceLabelForRow(m.source)}
                              </Text>
                            ) : null}
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                              {Math.round(m.calories)}
                            </Text>
                            <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />
                          </View>
                        </Pressable>
                      </Swipeable>
                    ))}
                  </View>
                );
              })}
              {/* Add meal footer */}
              <Pressable
                style={{ padding: 12, alignItems: "center" }}
                onPress={() => { setActiveMealSlot("Snacks"); setFabSheetOpen(true); }}
              >
                <Text style={{ fontSize: 12, color: Accent.primary, fontWeight: "500" }}>+ Add Food</Text>
              </Pressable>
              </View>
            </View>
          );
        })()}

        {/* Planned meals from the planner */}
        {viewMode === "day" && plannedMeals.length > 0 && (
          <View style={styles.card}>
            <View style={styles.mealSlotHeader}>
              <Text style={[styles.mealSlotName, { color: Accent.primary }]}>Planned</Text>
            </View>
            {plannedMeals.map((pm, i) => (
              <View key={`planned-${i}`} style={styles.mealRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mealName, { opacity: 0.7 }]}>{pm.recipe_title ?? pm.name}</Text>
                  <Text style={styles.mealMeta}>
                    {Math.round(pm.calories ?? 0)} kcal · P {Math.round(pm.protein ?? 0)}g · C {Math.round(pm.carbs ?? 0)}g · F {Math.round(pm.fat ?? 0)}g
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    Alert.alert("Log planned meal", "Pick portion vs the planned serving.", [
                      { text: "Cancel", style: "cancel" },
                      { text: "½×", onPress: () => void logPlannedMealWithPortion(pm, 0.5) },
                      { text: "1×", onPress: () => void logPlannedMealWithPortion(pm, 1) },
                      { text: "1½×", onPress: () => void logPlannedMealWithPortion(pm, 1.5) },
                      { text: "2×", onPress: () => void logPlannedMealWithPortion(pm, 2) },
                    ]);
                  }}
                  style={{ paddingHorizontal: 8, paddingVertical: 12 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.primary }}>Log today</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Add food form */}
        {viewMode === "day" && addOpen && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Log to {activeMealSlot}</Text>
            {/* Meal slot quick-switch */}
            <View style={{ flexDirection: "row", gap: Spacing.xs }}>
              {MEAL_SLOTS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setActiveMealSlot(s)}
                  style={{
                    flex: 1, paddingVertical: 6, borderRadius: Radius.sm, alignItems: "center",
                    backgroundColor: activeMealSlot === s ? Accent.primary : colors.border + "40",
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: activeMealSlot === s ? "#fff" : colors.textSecondary }}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              placeholder="Food name"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              style={styles.input}
            />
            <View style={styles.inputRow}>
              <TextInput
                placeholder="Calories"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={kcal}
                onChangeText={setKcal}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                placeholder="Protein"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={protein}
                onChangeText={setProtein}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
            <View style={styles.inputRow}>
              <TextInput
                placeholder="Carbs"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={carbs}
                onChangeText={setCarbs}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                placeholder="Fat"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={fat}
                onChangeText={setFat}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <Pressable style={[styles.submitBtn, { flex: 1 }]} onPress={addMeal}>
                <Text style={styles.submitBtnText}>Add to Today</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, { flex: 1, backgroundColor: Accent.primary }]}
                onPress={() => { setAddOpen(false); setSearchOpen(true); }}
              >
                <Ionicons name="search" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.submitBtnText}>Search</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Batch 2.5 — hydration & stimulants (water + caffeine + alcohol). */}
        {viewMode === "day" && (
          <HydrationStimulantsCard
            selectedDateKey={dayKey}
            weekStartDay={weekStartDay}
            targets={{
              waterMl: waterGoalMl,
              caffeineMg: targetCaffeineMg,
              alcoholGWeekly: targetAlcoholGWeekly,
            }}
            waterTotalMl={totalWaterMl}
            waterFromMealsMl={waterFromMealsMl}
            caffeineTotalMg={extraCaffeineToday}
            alcoholByDayG={extraAlcoholGByDay}
            onAddWater={(ml) => void addWaterMl(ml)}
            onAddCaffeine={(mg, preset) => void addCaffeineMg(mg, preset ?? null)}
            onAddAlcohol={(g, preset) => void addAlcoholG(g, preset ?? null)}
            onReset={(kind) => void resetHydrationStimulantsForDay(kind)}
          />
        )}

        {/* Steps, active energy — per selected day (historic via header / DayStrip).
            Water + stimulants moved into `HydrationStimulantsCard` above. */}
        {viewMode === "day" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Steps & activity</Text>
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: Spacing.md }}>
              {isToday ? "Today" : formatDateLabel(selectedDate)}
            </Text>

            <View style={{ gap: Spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="footsteps-outline" size={18} color={colors.textSecondary} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>Steps</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>
                  {stepsCount != null ? stepsCount.toLocaleString() : "—"}
                  {stepsCount != null && (
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textTertiary }}>
                      {" "}/ {dailyStepsGoal.toLocaleString()}
                    </Text>
                  )}
                </Text>
              </View>
              {stepsCount != null && dailyStepsGoal > 0 && (
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
                  <View
                    style={{
                      width: `${Math.min(stepsCount / dailyStepsGoal, 1) * 100}%`,
                      height: "100%",
                      borderRadius: 3,
                      backgroundColor: stepsCount >= dailyStepsGoal ? Accent.success : Accent.primary,
                    }}
                  />
                </View>
              )}

              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="flame-outline" size={18} color={Accent.warning} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>Active energy</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>
                  {activityBurnKcal != null ? `${activityBurnKcal.toLocaleString()} kcal` : "—"}
                </Text>
              </View>
              {activityBurnKcal == null && (
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                  Apple Health active calories appear here after you sync from More → Connected.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Activity Bonus — show on Today even before Health fills burn maps, so prefs are discoverable */}
        {viewMode === "day" && userId && (hasBurnData || isToday) && (
          <View style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: Spacing.sm }}>
              <Ionicons name="flame" size={20} color={Accent.warning} />
              <Text style={styles.cardTitle}>Activity Bonus</Text>
            </View>

            {!hasBurnData && isToday ? (
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: Spacing.md, lineHeight: 18 }}>
                No resting or active energy for this day in Suppr yet. Open{" "}
                <Text style={{ fontWeight: "700", color: colors.text }}>More → Connected</Text>, enable Apple Health,
                then pull to refresh or revisit this tab to sync.
              </Text>
            ) : null}

            {/* Summary row: total TDEE | food logged in Suppr | net burn − logged */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm }}>
              <View style={{ alignItems: "center", flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>
                  {totalBurnKcal.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>{isToday ? "Burn so far" : "Total burn"}</Text>
              </View>
              <View style={{ width: 1, backgroundColor: colors.border }} />
              <View style={{ alignItems: "center", flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>
                  {totals.calories.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>Food logged</Text>
              </View>
              <View style={{ width: 1, backgroundColor: colors.border }} />
              <View style={{ alignItems: "center", flex: 1 }}>
                {(() => {
                  const consumed = totals.calories;
                  const net = totalBurnKcal - consumed;
                  const isDeficit = net >= 0;
                  return (
                    <>
                      <Text style={{ fontSize: 20, fontWeight: "800", color: isDeficit ? Accent.success : Accent.destructive, fontVariant: ["tabular-nums"] }}>
                        {Math.abs(net).toLocaleString()}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>
                        {isDeficit ? "Net deficit" : "Net surplus"}
                      </Text>
                    </>
                  );
                })()}
              </View>
            </View>
            {effectiveCalorieGoal > 0 && (
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: Spacing.sm, textAlign: "center" }}>
                Calorie goal for this day: {effectiveCalorieGoal.toLocaleString()} kcal
              </Text>
            )}

            {/* Burn summary — tap for surplus-only detail screen */}
            {((activityBurnKcal ?? 0) > 0 || basalBurnKcal > 0) && (
              <Pressable
                onPress={() => router.push({ pathname: "/burn-detail", params: { date: dayKey } } as any)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: Spacing.md,
                  marginBottom: Spacing.md,
                  borderRadius: Radius.md,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="flame-outline" size={14} color={Accent.warning} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                      {(basalBurnKcal + (activityBurnKcal ?? 0)).toLocaleString()} kcal {isToday ? "burned so far" : "burned"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: Spacing.md }}>
                    {(activityBurnKcal ?? 0) > 0 && (
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Active {(activityBurnKcal ?? 0).toLocaleString()}</Text>
                    )}
                    {basalBurnKcal > 0 && (
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Resting {basalBurnKcal.toLocaleString()}</Text>
                    )}
                    {todayActivityBudgetAddon > 0 && (
                      <Text style={{ fontSize: 11, fontWeight: "700", color: Accent.warning }}>+{todayActivityBudgetAddon.toLocaleString()} {isToday ? "bonus so far" : "bonus earned"}</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </Pressable>
            )}

            {/* Workouts list */}
            {dayWorkouts.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text, marginBottom: 2 }}>Workouts</Text>
                {dayWorkouts.map((w, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
                    <Ionicons name="barbell-outline" size={16} color={Accent.primary} />
                    <Text style={{ fontSize: 13, color: colors.text, flex: 1 }}>{w.type}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                      {w.minutes > 0 ? `${w.minutes} min` : ""}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.warning, fontVariant: ["tabular-nums"] }}>
                      {w.calories > 0 ? `${w.calories} kcal` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Weekly deficit summary */}
            {(() => {
              let weekBurn = 0;
              let weekConsumed = 0;
              for (const dk of trackerWeekSummaryKeys) {
                weekBurn += (activityBurnByDay[dk] ?? 0) + (basalBurnByDay[dk] ?? 0);
                const dayMeals = byDay[dk] ?? [];
                weekConsumed += dayMeals.reduce((s, m) => s + Math.max(0, m.calories), 0);
              }
              if (weekBurn === 0) return null;
              const weekDeficit = weekBurn - weekConsumed;
              const dailyAvgDeficit = Math.round(weekDeficit / 7);
              const weeklyLbsRate = Math.abs(weekDeficit) / 3500; // 3500 kcal ≈ 1 lb
              const weeklyKgRate = weeklyLbsRate * 0.4536;
              const isDeficit = weekDeficit >= 0;
              return (
                <View style={{ marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text, marginBottom: 6 }}>
                    {weekSummaryHeading(weekSummaryMode)}
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      Avg daily {isDeficit ? "deficit" : "surplus"}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: isDeficit ? Accent.success : Accent.destructive, fontVariant: ["tabular-nums"] }}>
                      {Math.abs(dailyAvgDeficit).toLocaleString()} kcal
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      Weekly {isDeficit ? "deficit" : "surplus"}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: isDeficit ? Accent.success : Accent.destructive, fontVariant: ["tabular-nums"] }}>
                      {Math.abs(weekDeficit).toLocaleString()} kcal
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      Projected weekly {isDeficit ? "loss" : "gain"}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: isDeficit ? Accent.success : Accent.destructive, fontVariant: ["tabular-nums"] }}>
                      {weeklyKgRate.toFixed(2)} kg
                    </Text>
                  </View>
                </View>
              );
            })()}
          </View>
        )}

        {/* Complete Day button — only when viewing today and there are logged meals */}
        {viewMode === "day" && isToday && mealsToday.length > 0 && !addOpen && (
          <Pressable
            onPress={async () => {
              setCompleteDayOpen(true);
              // Auto-export to HealthKit if enabled
              if (userId && isHealthSyncAvailable()) {
                try {
                  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
                  const exp = await AsyncStorage.getItem("health_export_nutrition");
                  if (exp === "true") {
                    const dk = dateKeyFromDate(selectedDate);
                    void exportDayToHealth(userId, dk);
                  }
                } catch {}
              }
            }}
            style={{
              marginTop: Spacing.lg,
              paddingVertical: 16,
              borderRadius: Radius.md,
              backgroundColor: Accent.primary,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Complete Day</Text>
          </Pressable>
        )}

      </ScrollView>

      {/* Complete Day Modal */}
      <Modal visible={completeDayOpen} transparent animationType="slide" onRequestClose={() => setCompleteDayOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
            onPress={() => setCompleteDayOpen(false)}
          />
          <View style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.xl,
            alignItems: "center",
          }}>
            <Pressable onPress={() => setCompleteDayOpen(false)} style={{ position: "absolute", top: 16, left: 20 }}>
              <Ionicons name="close" size={24} color={colors.textTertiary} />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 24 }}>{isToday ? "Day logged!" : "Day complete"}</Text>

            {/* Checkmark circle */}
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: Accent.primary + "18",
              alignItems: "center", justifyContent: "center",
              marginBottom: 24,
            }}>
              <Ionicons name="checkmark" size={40} color={Accent.primary} />
            </View>

            {/* Weight projection */}
            {profileWeightKg != null && totals.calories > 0 ? (() => {
              const prediction = projectWeight({
                currentWeightKg: profileWeightKg,
                todayCalories: totals.calories,
                targetCalories: effectiveCalorieGoal,
                goal: profileGoal,
              });
              return (
                <>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center", lineHeight: 26, marginBottom: 8 }}>
                    {isToday ? "Today\u2019s trajectory" : "This day\u2019s trajectory"}:{" "}
                    <Text style={{ color: Accent.primary }}>{prediction.projectedWeightKg} kg</Text>
                    {" "}in ~{prediction.projectionWeeks} weeks
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", marginBottom: 24, paddingHorizontal: 20 }}>
                    {isToday
                      ? "Based on today\u2019s logged calories repeated daily (7,700 kcal \u2248 1 kg). Your Journey page uses your 7-day average, so the number there may differ."
                      : "Based on this day\u2019s logged calories repeated daily (7,700 kcal \u2248 1 kg). Your Journey page uses your 7-day average, so the number there may differ."}
                  </Text>
                </>
              );
            })() : (
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: 24 }}>
                Great work logging today! Set your weight in your profile to see weight projections here.
              </Text>
            )}

            <Pressable
              onPress={() => {
                setCompleteDayOpen(false);
                router.navigate("/(tabs)/progress" as any);
              }}
              style={{
                width: "100%",
                paddingVertical: 16,
                borderRadius: Radius.md,
                backgroundColor: Accent.primary,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>View my progress</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* FAB — always visible, opens bottom sheet */}
      {viewMode === "day" && !addOpen && !showPrevious && !fabSheetOpen && (
        <Pressable
          onPress={() => setFabSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Log food"
          accessibilityHint="Opens a menu to add meals"
          style={{
            position: "absolute",
            right: Spacing.xl,
            bottom: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: Accent.primary,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Accent.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Ionicons name="add" size={28} color="#fff" accessibilityElementsHidden importantForAccessibility="no" />
        </Pressable>
      )}

      <Modal
        visible={fabSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFabSheetOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.5)" }]}
            onPress={() => setFabSheetOpen(false)}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: Spacing.sm }}>Log Food</Text>
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: Spacing.lg, lineHeight: 16 }}>
              Photo and voice send data to our servers and may use AI (see Privacy policy in More).
            </Text>

            {/* Primary actions */}
            <View style={{ flexDirection: "row", gap: Spacing.md }}>
              {[
                { icon: "time-outline" as const, label: "Previous", onPress: () => { setFabSheetOpen(false); setShowPrevious(true); } },
                { icon: "search" as const, label: "Search", onPress: () => { setFabSheetOpen(false); setSearchOpen(true); } },
                { icon: "barcode-outline" as const, label: "Scan", onPress: () => { setFabSheetOpen(false); setBarcodeOpen(true); } },
                { icon: "add-circle-outline" as const, label: "Quick Add", onPress: () => { setFabSheetOpen(false); setAddOpen(true); } },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={item.onPress}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: Spacing.lg,
                    borderRadius: Radius.md,
                    backgroundColor: Accent.primary + "15",
                    borderWidth: 1,
                    borderColor: Accent.primary + "30",
                  }}
                >
                  <Ionicons name={item.icon} size={24} color={Accent.primary} accessibilityElementsHidden importantForAccessibility="no" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.primary, marginTop: 6 }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            {/* Secondary actions */}
            <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm }}>
              {[
                { icon: "camera-outline" as const, label: "Photo (AI)", onPress: () => { setFabSheetOpen(false); handleOpenPhotoLog(); } },
                { icon: "mic-outline" as const, label: "Voice", onPress: () => { setFabSheetOpen(false); handleOpenVoiceLog(); } },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={item.onPress}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: Spacing.md,
                    borderRadius: Radius.md,
                    backgroundColor: colors.inputBg,
                  }}
                >
                  <Ionicons name={item.icon} size={20} color={colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary, marginTop: 4 }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {targetCelebration && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 50 }}
        >
          <View
            style={{
              backgroundColor: Accent.primary + "E8",
              paddingHorizontal: Spacing.xxl,
              paddingVertical: Spacing.lg,
              borderRadius: Radius.lg,
              maxWidth: "88%",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff", textAlign: "center" }}>
              Goals hit!
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff", textAlign: "center", marginTop: 4, opacity: 0.95 }}>
              Calories and protein targets met for today
            </Text>
          </View>
        </View>
      )}

      {/* Photo analyzing overlay */}
      {photoAnalyzing && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}>
          <View style={{ backgroundColor: colors.card, borderRadius: Radius.lg, padding: Spacing.xxxl, alignItems: "center", gap: Spacing.md }}>
            <ActivityIndicator size="large" color={Accent.primary} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Analyzing meal...</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center" }}>AI is identifying food items.{"\n"}This may take a moment.</Text>
          </View>
        </View>
      )}

      {/* Voice input modal (cross-platform) */}
      {voiceInputOpen && (
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={() => setVoiceInputOpen(false)}
        >
          <Pressable
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: Spacing.sm }}>Voice Log</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.lg }}>
              {"Describe what you ate in natural language (e.g. \"2 scrambled eggs and toast with butter\") and AI will estimate the nutrition."}
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.inputBg,
                borderRadius: Radius.md,
                paddingHorizontal: Spacing.lg,
                paddingVertical: Spacing.md,
                color: colors.text,
                fontSize: 15,
                minHeight: 48,
              }}
              placeholder="Type what you ate..."
              placeholderTextColor={colors.textTertiary}
              value={voiceInputText}
              onChangeText={setVoiceInputText}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                if (voiceInputText.trim()) {
                  setVoiceInputOpen(false);
                  submitVoiceTranscript(voiceInputText.trim());
                  setVoiceInputText("");
                }
              }}
            />
            <Pressable
              style={{ backgroundColor: Accent.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: "center", marginTop: Spacing.md }}
              onPress={() => {
                if (voiceInputText.trim()) {
                  setVoiceInputOpen(false);
                  submitVoiceTranscript(voiceInputText.trim());
                  setVoiceInputText("");
                }
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Log Food</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {/* Edit meal modal */}
      <Modal
        visible={!!editingMeal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingMeal(null)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.5)" }]}
            onPress={() => setEditingMeal(null)}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: Spacing.md }}>Edit Entry</Text>

            {/* Meal slot selector */}
            <View style={{ flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.md }}>
              {MEAL_SLOTS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setEditSlot(s)}
                  style={{
                    flex: 1, paddingVertical: 6, borderRadius: Radius.sm, alignItems: "center",
                    backgroundColor: editSlot === s ? Accent.primary : colors.border + "40",
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: editSlot === s ? "#fff" : colors.textSecondary }}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginBottom: Spacing.xs }}>
              Portion (×)
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: Spacing.sm }}>
              {([0.5, 0.75, 1, 1.25, 1.5, 2] as const).map((mult) => (
                <Pressable
                  key={mult}
                  onPress={() => applyEditPortionMultiplier(mult)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: Radius.sm,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>{mult}×</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.input, { marginBottom: Spacing.md }]}
              placeholder="Portion multiplier (e.g. 1.25)"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              value={editPortion}
              onChangeText={setEditPortion}
              onBlur={() => {
                const p = parseFloat(editPortion.replace(",", ".")) || 1;
                applyEditPortionMultiplier(p);
              }}
            />

            <TextInput
              style={styles.input}
              placeholder="Food name"
              placeholderTextColor={colors.textTertiary}
              value={editTitle}
              onChangeText={setEditTitle}
            />
            <View style={[styles.inputRow, { marginTop: Spacing.sm }]}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Calories"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={editKcal}
                onChangeText={setEditKcal}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Protein"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={editProtein}
                onChangeText={setEditProtein}
              />
            </View>
            <View style={[styles.inputRow, { marginTop: Spacing.sm }]}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Carbs"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={editCarbs}
                onChangeText={setEditCarbs}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Fat"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={editFat}
                onChangeText={setEditFat}
              />
            </View>
            <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md }}>
              <Pressable style={[styles.submitBtn, { flex: 1 }]} onPress={saveEditMeal}>
                <Text style={styles.submitBtnText}>Save Changes</Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, borderWidth: 1, borderColor: Accent.destructive + "40", paddingVertical: 14 }}
                onPress={() => {
                  if (editingMeal) {
                    deleteMeal(editingMeal.id);
                    setEditingMeal(null);
                  }
                }}
              >
                <Text style={{ color: Accent.destructive, fontWeight: "700", fontSize: 14 }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Food search modal for logging */}
      <FoodSearchModal
        visible={searchOpen}
        initialQuery=""
        macroTargets={{
          calories: effectiveCalorieGoal,
          protein: targets.protein,
          carbs: targets.carbs,
          fat: targets.fat,
          fiber: targets.fiber,
        }}
        macroConsumed={{
          calories: totals.calories,
          protein: totals.protein,
          carbs: totals.carbs,
          fat: totals.fat,
          fiber: totals.fiber,
        }}
        onSelect={(result: any) => {
          const grams = result.chosenPortion.gramWeight * result.quantity;
          const f = grams / 100;
          const meal: JournalMeal = {
            id: newMealId(),
            name: activeMealSlot,
            recipeTitle: result.name,
            time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
            calories: Math.round(result.macrosPer100g.calories * f),
            protein: Math.round(result.macrosPer100g.protein * f * 10) / 10,
            carbs: Math.round(result.macrosPer100g.carbs * f * 10) / 10,
            fat: Math.round(result.macrosPer100g.fat * f * 10) / 10,
            source: "USDA FoodData Central",
          };
          setByDay((prev) => ({
            ...prev,
            [dayKey]: [...(prev[dayKey] ?? []), meal],
          }));
          setSearchOpen(false);
        }}
        onClose={() => setSearchOpen(false)}
      />

      {/* Barcode scanner */}
      <BarcodeScannerModal
        visible={barcodeOpen}
        onScan={(_code: string, product) => {
          setBarcodeOpen(false);
          const meal: JournalMeal = {
            id: newMealId(),
            name: activeMealSlot,
            recipeTitle: product.portionSummary ? `${product.name} (${product.portionSummary})` : product.name,
            time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
            calories: Math.round(product.calories),
            protein: Math.round(product.protein * 10) / 10,
            carbs: Math.round(product.carbs * 10) / 10,
            fat: Math.round(product.fat * 10) / 10,
            source: "Open Food Facts",
            ...(product.fiberG > 0 ? { fiberG: Math.round(product.fiberG * 10) / 10 } : {}),
            ...((product as any).waterMl > 0 ? { waterMl: Math.round((product as any).waterMl) } : {}),
            micros: {
              ...((product as any).sugarG > 0 ? { sugarG: Math.round((product as any).sugarG * 10) / 10 } : {}),
              ...((product as any).sodiumMg > 0 ? { sodiumMg: Math.round((product as any).sodiumMg) } : {}),
            },
          };
          setByDay((prev) => ({
            ...prev,
            [dayKey]: [...(prev[dayKey] ?? []), meal],
          }));
          track(AnalyticsEvents.food_logged, { source: "barcode", slot: activeMealSlot });
          Alert.alert("Logged", `${product.name} added to ${activeMealSlot}.`);
        }}
        onClose={() => setBarcodeOpen(false)}
      />

      {/* Quick add panel — Favourites / Frequent / Recent tabs. */}
      {showPrevious && (
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0, top: 0,
          backgroundColor: colors.background, paddingTop: insets.top,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Quick add</Text>
              <Text style={{ fontSize: 12, color: Accent.primary, fontWeight: "600", marginTop: 2 }}>
                Logging to {activeMealSlot}
              </Text>
            </View>
            <Pressable onPress={() => setShowPrevious(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close quick add">
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          {/* Tab row */}
          <View style={{ flexDirection: "row", gap: Spacing.xs, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm }}>
            {(["favourites", "frequent", "recent", "saved"] as const).map((t) => {
              const active = quickAddTab === t;
              const label =
                t === "favourites"
                  ? "Favourites"
                  : t === "frequent"
                  ? "Frequent"
                  : t === "recent"
                  ? "Recent"
                  : "My meals";
              return (
                <Pressable
                  key={t}
                  onPress={() => setQuickAddTab(t)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${label} tab`}
                  style={{
                    flex: 1, paddingVertical: 6, borderRadius: Radius.sm, alignItems: "center",
                    backgroundColor: active ? Accent.primary : colors.border + "40",
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#fff" : colors.textSecondary }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {quickAddTab === "saved" ? (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: 40, gap: Spacing.sm }}
              keyboardShouldPersistTaps="handled"
            >
              {savedMealsLoading && (
                <View style={{ paddingTop: 40, alignItems: "center" }}>
                  <ActivityIndicator color={Accent.primary} />
                </View>
              )}
              {!savedMealsLoading && !userId && (
                <Text style={{ color: colors.textSecondary, textAlign: "center", paddingTop: 40 }}>
                  Sign in to save meal combos for one-tap re-logging.
                </Text>
              )}
              {!savedMealsLoading && userId && savedMeals.length === 0 && (
                <Text style={{ color: colors.textSecondary, textAlign: "center", paddingTop: 40 }}>
                  Log 2 or more items in a slot, then tap "Save combo" on the slot header to re-log it in one tap.
                </Text>
              )}
              {!savedMealsLoading && savedMeals.map((meal) => {
                const summary = summariseSavedMeal(meal);
                const pending = savedPendingIds.has(meal.id);
                const itemsLabel = summary.itemCount === 1 ? "1 item" : `${summary.itemCount} items`;
                const slotLabel = meal.defaultMealSlot ?? activeMealSlot;
                const summaryLabel = `${itemsLabel}, ${summary.totalCalories} kcal, protein ${Math.round(
                  summary.totalProtein,
                )} grams, carbs ${Math.round(summary.totalCarbs)} grams, fat ${Math.round(
                  summary.totalFat,
                )} grams`;
                return (
                  <Pressable
                    key={meal.id}
                    onPress={() => logSavedMealFromPanel(meal)}
                    onLongPress={() => openSavedMealActions(meal)}
                    disabled={pending || summary.itemCount === 0}
                    accessibilityRole="button"
                    accessibilityLabel={`Log ${meal.name} to ${slotLabel}. ${summaryLabel}. Long-press for more actions.`}
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: Radius.md,
                      padding: Spacing.md,
                      flexDirection: "row",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: pending ? 0.6 : 1,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 15, fontWeight: "600", color: colors.text }}
                      >
                        {meal.name}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}
                      >
                        {itemsLabel} · {summary.totalCalories} kcal · P {Math.round(summary.totalProtein)}g · C{" "}
                        {Math.round(summary.totalCarbs)}g · F {Math.round(summary.totalFat)}g
                      </Text>
                    </View>
                    <Pressable
                      onPress={(e) => { e.stopPropagation?.(); openSavedMealActions(meal); }}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel={`More actions for ${meal.name}`}
                      style={{ paddingHorizontal: 6 }}
                    >
                      <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
                    </Pressable>
                    <Ionicons name="add-circle" size={24} color={Accent.primary} />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: 40, gap: Spacing.sm }} keyboardShouldPersistTaps="handled">
            {quickAddTab === "favourites" && favoritesLoading && (
              <View style={{ paddingTop: 40, alignItems: "center" }}>
                <ActivityIndicator color={Accent.primary} />
              </View>
            )}
            {quickAddRows.length === 0 && !(quickAddTab === "favourites" && favoritesLoading) && (
              <Text style={{ color: colors.textSecondary, textAlign: "center", paddingTop: 40 }}>
                {quickAddTab === "favourites"
                  ? "Star meals you log often for one-tap re-logging."
                  : quickAddTab === "frequent"
                  ? "Your most-logged meals will show up here after a few days of tracking."
                  : "No previous meals to show. Start logging to build your history."}
              </Text>
            )}
            {quickAddRows.map((row, idx) => {
              const starred = Boolean(row.favoriteId);
              const pending = favoritesPending.has(favoriteKey(row.recipeTitle, row.calories));
              return (
                <Pressable
                  key={`${row.recipeTitle}-${row.calories}-${idx}`}
                  style={{
                    backgroundColor: colors.card, borderRadius: Radius.md,
                    padding: Spacing.md, flexDirection: "row", alignItems: "center",
                    borderWidth: 1, borderColor: colors.border,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Log ${row.recipeTitle} to ${activeMealSlot}`}
                  onPress={() => {
                    logHistoryItemToSlot(row, activeMealSlot);
                    setShowPrevious(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>{row.recipeTitle}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {Math.round(row.calories)} kcal · P {Math.round(row.protein)}g · C {Math.round(row.carbs)}g · F {Math.round(row.fat)}g
                      {row.count > 1 ? `  ·  ${row.count}×` : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={(e) => { e.stopPropagation?.(); toggleFavoriteRow(row); }}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={starred ? "Unstar meal" : "Favourite this meal"}
                    accessibilityState={{ selected: starred, disabled: pending }}
                    style={{ paddingHorizontal: 6, opacity: pending ? 0.5 : 1 }}
                  >
                    <Ionicons
                      name={starred ? "star" : "star-outline"}
                      size={22}
                      color={starred ? "#f59e0b" : colors.textSecondary}
                    />
                  </Pressable>
                  <Ionicons name="add-circle" size={24} color={Accent.primary} />
                </Pressable>
              );
            })}
          </ScrollView>
          )}
        </View>
      )}

      {/* Batch 2.6 — Save meal combo sheet */}
      <SaveMealSheet
        visible={saveMealSheetOpen}
        onClose={() => setSaveMealSheetOpen(false)}
        initialItems={saveMealSheetItems}
        defaultSlot={saveMealSheetDefaultSlot}
        suggestedName={
          saveMealSheetDefaultSlot
            ? `My ${saveMealSheetDefaultSlot.toLowerCase()} combo`
            : undefined
        }
        onSave={handleCreateSavedMeal}
        colors={{
          text: colors.text,
          textSecondary: colors.textSecondary,
          textTertiary: colors.textTertiary,
          card: colors.card,
          cardBorder: colors.cardBorder,
          background: colors.background,
        }}
      />

      <Modal visible={nutrientsModalOpen} animationType="slide" transparent onRequestClose={() => setNutrientsModalOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setNutrientsModalOpen(false)} accessibilityLabel="Close" />
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              paddingTop: 12,
              paddingBottom: insets.bottom + 20,
              maxHeight: "82%",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>Day nutrients</Text>
              <Pressable onPress={() => setNutrientsModalOpen(false)} hitSlop={12} accessibilityRole="button">
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {dayNutrientDetailRowsWithoutMacroDupes.map((row) => (
                  <View
                    key={row.key}
                    style={{
                      width: "48%",
                      flexGrow: 1,
                      minWidth: 140,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                    }}
                  >
                    <Text style={{ fontSize: 10, color: colors.textTertiary }}>{row.label}</Text>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"], marginTop: 4 }}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <JournalDatePickerModal
        visible={journalCalendarOpen}
        onClose={() => setJournalCalendarOpen(false)}
        selectedDate={selectedDate}
        onSelectDate={(d) => {
          setSelectedDate(clampJournalDate(d));
          setViewMode("day");
        }}
        colors={{
          text: colors.text,
          textSecondary: colors.textSecondary,
          textTertiary: colors.textTertiary,
          card: colors.card,
          cardBorder: colors.cardBorder,
          background: colors.background,
        }}
      />

      {/* Batch 1.4 — Copy meal sheet */}
      {copyMealTargetId && (() => {
        const meal = (byDay[dayKey] ?? []).find((m) => m.id === copyMealTargetId);
        if (!meal) return null;
        return (
          <CopyMealSheet
            visible={true}
            onClose={() => setCopyMealTargetId(null)}
            sourceDayKey={dayKey}
            mealLabel={meal.recipeTitle}
            onConfirm={(targetDayKeys, summary) => {
              if (targetDayKeys.length === 0) {
                Alert.alert("Copy meal", summary);
                return;
              }
              if (targetDayKeys.length === 1) {
                void copyMealToDate(dayKey, meal.id, targetDayKeys[0]!);
              } else {
                void copyMealToDateRange(dayKey, meal.id, targetDayKeys);
              }
              Alert.alert("Copied", summary);
            }}
            colors={{
              text: colors.text,
              textSecondary: colors.textSecondary,
              textTertiary: colors.textTertiary,
              card: colors.card,
              cardBorder: colors.cardBorder,
              background: colors.background,
            }}
          />
        );
      })()}

      {/* Batch 1.4 — Duplicate day sheet */}
      <DuplicateDaySheet
        visible={duplicateDayOpen}
        onClose={() => setDuplicateDayOpen(false)}
        sourceDayKey={dayKey}
        sourceMealCount={mealsToday.length}
        onConfirm={(targetDayKeys, summary) => {
          if (targetDayKeys.length === 0) {
            Alert.alert("Duplicate day", summary);
            return;
          }
          if (targetDayKeys.length === 1) {
            void duplicateDay(dayKey, targetDayKeys[0]!);
          } else {
            void duplicateDayToDateRange(dayKey, targetDayKeys);
          }
          Alert.alert("Duplicated", summary);
        }}
        colors={{
          text: colors.text,
          textSecondary: colors.textSecondary,
          textTertiary: colors.textTertiary,
          card: colors.card,
          cardBorder: colors.cardBorder,
          background: colors.background,
        }}
      />

      {/* Batch 5.13 — Voice log sheet (Pro). */}
      <VoiceLogSheet
        visible={voiceLogOpen}
        onClose={() => setVoiceLogOpen(false)}
        activeSlot={activeMealSlot}
        accessToken={session?.access_token ?? null}
        apiBase={apiBase}
        onCommit={commitAiLoggedItems}
        colors={{
          text: colors.text,
          textSecondary: colors.textSecondary,
          textTertiary: colors.textTertiary,
          card: colors.card,
          cardBorder: colors.cardBorder,
          background: colors.background,
          inputBg: colors.inputBg,
          border: colors.border,
        }}
      />

      {/* Batch 5.13 — AI photo log sheet (Pro). */}
      <PhotoLogSheet
        visible={photoLogOpen}
        onClose={() => setPhotoLogOpen(false)}
        activeSlot={activeMealSlot}
        accessToken={session?.access_token ?? null}
        apiBase={apiBase}
        onCommit={commitAiLoggedItems}
        colors={{
          text: colors.text,
          textSecondary: colors.textSecondary,
          textTertiary: colors.textTertiary,
          card: colors.card,
          cardBorder: colors.cardBorder,
          background: colors.background,
          inputBg: colors.inputBg,
          border: colors.border,
        }}
      />
    </View>
  );
}

function MacroBarRow({
  label,
  current,
  goal,
  color,
  styles,
}: {
  label: string;
  current: number;
  goal: number;
  color: string;
  styles: Record<string, any>;
}) {
  const pct = goal > 0 ? Math.min(1, current / goal) : 0;
  const rem = Math.max(0, Math.round(goal - current));
  return (
    <View style={styles.macroBarBlock}>
      <View style={styles.macroBarTop}>
        <Text style={[styles.macroBarTitle, { color }]}>{label}</Text>
        <Text style={styles.macroBarNums}>
          {Math.round(current)}g / {Math.round(goal)}g · {rem}g left
        </Text>
      </View>
      <View style={styles.macroBarTrack}>
        <View style={[styles.macroBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}
