import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Keyboard,
  Modal,
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
import { Accent, Spacing, Radius } from "@/constants/theme";
import FoodSearchModal from "@/components/FoodSearchModal";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";

import DayStrip from "@/components/charts/DayStrip";
import JournalDatePickerModal from "@/components/JournalDatePickerModal";
import CopyMealSheet from "@/components/CopyMealSheet";
import DuplicateDaySheet from "@/components/DuplicateDaySheet";
import VoiceLogSheet from "@/components/VoiceLogSheet";
import PhotoLogSheet from "@/components/PhotoLogSheet";
import AiPaywallSheet, { type AiPaywallFeature } from "@/components/AiPaywallSheet";
import { computeLoggingStreak } from "@/lib/trackerStats";
import {
  availableFreezes,
  computeProtectedStreak,
  readFreezeLedger,
  type FreezeLedger,
} from "@/lib/streakFreeze";
import { didStreakReset } from "../../../../src/lib/nutrition/streakReset";
import {
  normalizeWeekSummaryMode,
  weekSummaryDateKeys,
  type WeekSummaryMode,
} from "../../../../src/lib/nutrition/weekSummaryWindow";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../../src/lib/analytics/events";
import { looksLikeMissingTableError } from "@/lib/supabaseErrors";
import { fetchMealPlanJson, fetchNutritionJournalByDay } from "../../../../src/lib/supabase/phase1LegacyJsonb";
import { refreshAdaptiveTdeeForUser } from "@/lib/refreshAdaptiveTdee";
import { snapshotDailyTargetIfMissing } from "../../../../src/lib/nutrition/dailyTargetSnapshot";
import { refreshExpoPushTokenIfChanged } from "@/lib/expoPushToken";
import { subscribeOffline } from "@/lib/subscribeOffline";
import { NUTRITION_DEFAULTS, type NutritionDefaults } from "@/constants/nutritionDefaults";
import { calculateTDEE, maintenanceIntakeFromTargetCalories, resolveTargets } from "@/lib/calcTargets";
import { resolveMaintenance } from "../../../../src/lib/nutrition/resolveMaintenance";
import {
  syncHealthDataThrottled,
  syncNutritionFromHealthThrottled,
  exportDayToHealth,
  isHealthSyncAvailable,
} from "@/lib/healthSync";
import { clampJournalDate } from "@/lib/journalNavigation";
import {
  computeEatAgainForSlot,
  type FoodHistoryItem,
} from "../../../../src/lib/nutrition/foodHistory";
import { isMealSlot } from "../../../../src/lib/nutrition/mealSlots";
import {
  LEGACY_STORAGE_KEY_V1 as EAT_AGAIN_LEGACY_KEY_V1,
  STORAGE_KEY as EAT_AGAIN_STORAGE_KEY,
  readDismissState as readEatAgainDismiss,
  recordDismiss as recordEatAgainDismiss,
  serialiseDismissState as serialiseEatAgainDismiss,
  shouldShowEatAgain,
  type DismissState as EatAgainDismissState,
} from "../../../../src/lib/nutrition/eatAgainDismiss";
import {
  cloneMealWithoutId,
  sanitizeCopyTargets,
} from "../../../../src/lib/nutrition/copyMeals";
import {
  parseDayNumberMap,
} from "../../../../src/lib/nutrition/hydrationStimulants";
import {
  QUICK_ADD_COLLAPSED_STORAGE_KEY,
  isHydrationCardVisible,
  isStepsCardVisible,
  parseQuickAddCollapsed,
  serializeQuickAddCollapsed,
} from "../../../../src/lib/nutrition/todayProgressiveDisclosure";
import { aiLoggingSourceLabel } from "../../../../src/lib/nutrition/aiLogging";
import { scaleCaffeineAlcohol } from "../../../../src/lib/nutrition/scaleCaffeineAlcoholForGrams";
import { updateStimulantsForDay } from "../../../../src/lib/nutrition/updateStimulantsForDay";
import { HydrationStimulantsCard } from "@/components/HydrationStimulantsCard";
import SaveMealSheet from "@/components/SaveMealSheet";
import QuickAddPanel from "@/components/QuickAddPanel";
import {
  createSavedMeal,
  incrementLogCount,
  listSavedMeals,
  type SavedMeal,
  type SavedMealItem,
} from "../../../../src/lib/nutrition/savedMeals";
import {
  buildMealEntriesFromSavedMeal,
} from "../../../../src/lib/nutrition/savedMealsLogic";
import {
  parseDismissedSlots,
  serializeDismissedSlots,
  shouldShowUsualMealHint,
  USUAL_MEAL_HINT_STORAGE_KEY,
} from "../../../../src/lib/nutrition/usualMealHint";
import {
  PENDING_USUAL_MEAL_SAVE_KEY,
  parsePendingUsualMealSave,
} from "../../../../src/lib/nutrition/pendingUsualMealSave";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TodayHero } from "@/components/today/TodayHero";
import { type TodayHeroVariant } from "@/components/today/TodayHeroVariantPicker";
import { TodayFastingPill } from "@/components/today/TodayFastingPill";
import { TodayEatAgainBanner } from "@/components/today/TodayEatAgainBanner";
import { TodayActivityCard } from "@/components/today/TodayActivityCard";
import { TodayWeekView } from "@/components/today/TodayWeekView";
import { TodayMealsSection } from "@/components/today/TodayMealsSection";
import { TodayActivityBonusCard } from "@/components/today/TodayActivityBonusCard";
import { TodayCompleteDayModal } from "@/components/today/TodayCompleteDayModal";
import { TodayFabSheet } from "@/components/today/TodayFabSheet";
import { TodayEditMealModal } from "@/components/today/TodayEditMealModal";
import { TodayNutrientsModal } from "@/components/today/TodayNutrientsModal";
import { TodayDateHeader } from "@/components/today/TodayDateHeader";
import { TodayDashboardMacroTiles } from "@/components/today/TodayDashboardMacroTiles";
import { TodayQuickLogStrip } from "@/components/today/TodayQuickLogStrip";
import { TodayDeficitInsight } from "@/components/today/TodayDeficitInsight";
import { TodayPlannedMealsCard } from "@/components/today/TodayPlannedMealsCard";
import { TodayAddFoodForm } from "@/components/today/TodayAddFoodForm";

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
  // Today hero variant preference — ring / bar / number (prototype port 2026-04-20).
  // Persisted under `suppr.hero.variant` so the user's choice survives reload.
  const HERO_VARIANT_STORAGE_KEY = "suppr.hero.variant";
  const [heroVariant, setHeroVariantState] = useState<TodayHeroVariant>("ring");
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(HERO_VARIANT_STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw === "ring" || raw === "bar" || raw === "number") {
          setHeroVariantState(raw);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const setHeroVariant = useCallback((next: TodayHeroVariant) => {
    setHeroVariantState(next);
    AsyncStorage.setItem(HERO_VARIANT_STORAGE_KEY, next).catch(() => {});
  }, []);
  const DEFAULT_TRACKED_MACROS = ["protein", "carbs", "fat"];
  const [trackedMacros, setTrackedMacros] = useState<string[]>(DEFAULT_TRACKED_MACROS);
  const [weekStartDay, setWeekStartDay] = useState<"monday" | "sunday">("monday");
  /**
   * Display-unit preference loaded from `profiles.measurement_system`.
   * Storage stays metric (ml / kg / cm) everywhere — this only affects
   * display (currently the hydration card's water row + chips). Defaults
   * to "metric" so users who haven't completed the onboarding unit step
   * never see a silent imperial flip.
   */
  const [measurementSystem, setMeasurementSystem] = useState<"metric" | "imperial">("metric");
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
  // Target fast length in hours, parsed from `profiles.fasting_window`
  // (stored as "16:8" style). Defaults to 16 until the profile loads.
  // Used by the widget snapshot so the iOS widget shows the correct ring.
  const [fastTargetHours, setFastTargetHours] = useState<number>(16);
  const [fabSheetOpen, setFabSheetOpen] = useState(false);
  // Batch 5.13 — Pro-gated Voice + AI photo logging state.
  const [voiceLogOpen, setVoiceLogOpen] = useState(false);
  const [photoLogOpen, setPhotoLogOpen] = useState(false);
  const [userTier, setUserTier] = useState<"free" | "base" | "pro">("free");
  // M2 (2026-04-18) — in-flow AI paywall sheet. Replaces the previous
  // `router.push("/paywall?from=...")` on free-tier Voice / Snap taps.
  // `/paywall` is still reachable via the sheet's primary CTA; tapping
  // it is the commercial-intent surface, while this sheet is the
  // light-touch in-flow gate that matches web `AiPaywallDialog`.
  const [aiPaywall, setAiPaywall] = useState<{
    open: boolean;
    feature: AiPaywallFeature;
  }>({ open: false, feature: "voice_log" });
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
  // P0-3 (2026-04-18) — mobile must apply pace-aware deficits to match web.
  const [profilePlanPace, setProfilePlanPace] = useState<string | null>(null);
  // Cached profile basics needed by the activity-bonus info popover so it
  // can show "BMR × multiplier" without a second profile fetch (TestFlight
  // `AAtW7dYcCBPyBdsMU6UqiQQ`, 2026-04-18).
  const [profileSex, setProfileSex] = useState<"male" | "female" | "unspecified" | null>(null);
  const [profileHeightCm, setProfileHeightCm] = useState<number | null>(null);
  const [profileAge, setProfileAge] = useState<number | null>(null);
  const [profileActivityLevel, setProfileActivityLevel] = useState<
    "sedentary" | "light" | "moderate" | "active" | "very_active" | null
  >(null);
  // Adaptive TDEE values — cached on Today so the Activity Bonus
  // Maintenance tile resolves via the shared `resolveMaintenance`
  // helper (F-3, 2026-04-19, TestFlight `ADFYpDgEEb0QH-j3BXshPTo`).
  // Today + Progress read the same inputs → can't drift.
  const [adaptiveTdee, setAdaptiveTdee] = useState<number | null>(null);
  const [adaptiveTdeeConfidence, setAdaptiveTdeeConfidence] = useState<string | null>(null);
  const [adaptiveTdeeUpdatedAt, setAdaptiveTdeeUpdatedAt] = useState<string | null>(null);
  const targetHitPrevByDayRef = useRef<Record<string, boolean>>({});
  /** Once we celebrate (or user was already at goal on first load), do not celebrate again that calendar day if they dip and re-hit. */
  const targetsCelebratedForDayRef = useRef<Record<string, boolean>>({});

  // Audit M4 (2026-04-18) — Today progressive disclosure.
  // ---------------------------------------------------------------
  // `quickAddCollapsed` persists across sessions via AsyncStorage under
  // `QUICK_ADD_COLLAPSED_STORAGE_KEY`. Default is `true` so first-run
  // users see a single "Quick add" CTA above Meals instead of the
  // 4-tab panel.
  // `hydrationManualExpanded` / `stepsManualExpanded` let a user
  // reveal the hydration or steps card even before state-based gating
  // would unhide it (e.g. tapping "Track hydration?"). Session-scoped
  // by design — once the underlying state exists the gate returns
  // `true` permanently and the manual flag is no longer needed.
  const [quickAddCollapsed, setQuickAddCollapsed] = useState(true);
  const [quickAddPrefLoaded, setQuickAddPrefLoaded] = useState(false);
  const [hydrationManualExpanded, setHydrationManualExpanded] = useState(false);
  const [stepsManualExpanded, setStepsManualExpanded] = useState(false);

  // Hydrate the Quick Add collapsed preference once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const raw = await AsyncStorage.getItem(QUICK_ADD_COLLAPSED_STORAGE_KEY);
        if (cancelled) return;
        setQuickAddCollapsed(parseQuickAddCollapsed(raw));
      } catch {
        // Ignore — default already collapsed.
      } finally {
        if (!cancelled) setQuickAddPrefLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleQuickAddCollapsed = useCallback(async () => {
    const next = !quickAddCollapsed;
    setQuickAddCollapsed(next);
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem(QUICK_ADD_COLLAPSED_STORAGE_KEY, serializeQuickAddCollapsed(next));
    } catch {
      // Preference persistence is best-effort — UI state already updated.
    }
  }, [quickAddCollapsed]);

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

  // Quick add panel — state/handlers live in `QuickAddPanel.tsx` (shared
  // render-only wrapper around the nutrition helpers). The host still owns
  // the SaveMealSheet and drives the refresh token after a new saved meal
  // is persisted.
  //
  // Ship M1 (2026-04-18) — the host also owns the full saved-meals list
  // so the meal-slot section can render the `Log usual` pill directly.
  const [saveMealSheetOpen, setSaveMealSheetOpen] = useState(false);
  const [saveMealSheetItems, setSaveMealSheetItems] = useState<Array<Omit<SavedMealItem, "id" | "position">>>([]);
  const [saveMealSheetDefaultSlot, setSaveMealSheetDefaultSlot] = useState<"Breakfast" | "Lunch" | "Dinner" | "Snacks" | undefined>(undefined);
  /** Bumped after a new saved meal is persisted so `QuickAddPanel` refetches
   *  its "Usual meals" tab and jumps to it (mirrors the web host). */
  const [savedMealsRefreshToken, setSavedMealsRefreshToken] = useState(0);

  /** Ship M1 — saved meals shared between `TodayMealsSection` (for the
   *  slot-header "Log usual" pill + full-width save row visibility) and
   *  `QuickAddPanel` (for the Usual meals tab). Host owns the list. */
  const [hostSavedMeals, setHostSavedMeals] = useState<SavedMeal[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setHostSavedMeals([]);
      return;
    }
    listSavedMeals(supabase, userId)
      .then((rows) => {
        if (!cancelled) setHostSavedMeals(rows);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("Today listSavedMeals failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, savedMealsRefreshToken]);

  /** Ship M1 — usual-meal first-run hint dismiss state. Persisted via
   *  AsyncStorage under a versioned key. Hydrated once on mount. */
  const [usualMealHintDismissed, setUsualMealHintDismissed] = useState<Set<string>>(
    () => new Set<string>(),
  );
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(USUAL_MEAL_HINT_STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setUsualMealHintDismissed(parseDismissedSlots(raw));
      })
      .catch(() => {
        /* ignore storage failures */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const savedMealSlots = useMemo(() => {
    const s = new Set<string>();
    for (const m of hostSavedMeals) {
      if (m.defaultMealSlot) s.add(m.defaultMealSlot);
    }
    return s;
  }, [hostSavedMeals]);

  const usualMealHintShownRef = useRef<Set<string>>(new Set());
  const hintVisibleForSlot = useCallback(
    (slot: string) => {
      if (!isMealSlot(slot)) return false;
      const currentDayKey = dateKeyFromDate(selectedDate);
      return shouldShowUsualMealHint({
        byDay,
        slot,
        todayKey: currentDayKey,
        dismissedSlots: usualMealHintDismissed,
        savedMealSlots,
      });
    },
    [byDay, selectedDate, usualMealHintDismissed, savedMealSlots],
  );
  useEffect(() => {
    for (const slot of ["Breakfast", "Lunch", "Dinner", "Snacks"] as const) {
      if (hintVisibleForSlot(slot) && !usualMealHintShownRef.current.has(slot)) {
        usualMealHintShownRef.current.add(slot);
        try {
          track(AnalyticsEvents.usual_meal_hint_shown, { slot });
        } catch {
          /* analytics fire-and-forget */
        }
      }
    }
  }, [hintVisibleForSlot]);

  const dismissUsualMealHint = useCallback(
    (slot: string) => {
      if (!isMealSlot(slot)) return;
      setUsualMealHintDismissed((prev) => {
        const next = new Set(prev);
        next.add(slot);
        void AsyncStorage.setItem(
          USUAL_MEAL_HINT_STORAGE_KEY,
          serializeDismissedSlots(next),
        ).catch(() => {
          /* ignore storage failures */
        });
        return next;
      });
      try {
        track(AnalyticsEvents.usual_meal_hint_dismissed, { slot });
      } catch {
        /* analytics fire-and-forget */
      }
    },
    [],
  );

  /** Open the save-meal sheet pre-filled with the items in `slotName` on
   * the active day. Gated on >=2 items so the UI never lets the user
   * save a single-item "usual meal". */
  const openSaveMealSheetForSlot = useCallback(
    (slotName: string) => {
      if (!userId) {
        Alert.alert("Sign in", "Sign in to save a usual meal.");
        return;
      }
      const normalised = normalizeJournalSlotName(slotName);
      const currentDayKey = dateKeyFromDate(selectedDate);
      const slotMeals = (byDay[currentDayKey] ?? []).filter(
        (m) => normalizeJournalSlotName(m.name ?? "") === normalised,
      );
      if (slotMeals.length < 2) {
        Alert.alert(
          "Save as a usual meal",
          "Log 2 or more items in this slot first, then save as a usual meal.",
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
      // Canonical slot via shared guard (audit L5, 2026-04-18).
      setSaveMealSheetItems(items);
      setSaveMealSheetDefaultSlot(isMealSlot(normalised) ? normalised : undefined);
      setSaveMealSheetOpen(true);
    },
    [userId, byDay, selectedDate],
  );

  /**
   * Post-ship #4 (2026-04-18) — open the save-meal sheet with a pre-
   * prepared seed (items + slot). Unlike `openSaveMealSheetForSlot`
   * which rebuilds the seed from today's journal, this opener accepts
   * the items verbatim — used by the weekly-recap deep-link so the
   * user's most-frequent historical items are pre-filled instead of
   * only today's items.
   */
  const openSaveMealSheetWithSeed = useCallback(
    (
      slot: "Breakfast" | "Lunch" | "Dinner" | "Snacks",
      items: Array<Omit<SavedMealItem, "id" | "position">>,
    ) => {
      if (!userId) {
        Alert.alert("Sign in", "Sign in to save a usual meal.");
        return;
      }
      if (!Array.isArray(items) || items.length < 2) {
        // Guard mirrors `openSaveMealSheetForSlot` — never show an
        // empty sheet to the user. The recap card shouldn't reach here
        // (the helper enforces ≥2 items) but the guard is cheap.
        return;
      }
      setSaveMealSheetItems(items);
      setSaveMealSheetDefaultSlot(isMealSlot(slot) ? slot : undefined);
      setSaveMealSheetOpen(true);
    },
    [userId],
  );

  /**
   * Post-ship #4 (2026-04-18) — consume the "save your usual" deep-link
   * the weekly-recap card stashed in AsyncStorage from the Progress
   * tab. Fires once per userId. Pops the stored payload, validates the
   * TTL inside `parsePendingUsualMealSave`, then opens the
   * `SaveMealSheet` pre-seeded with the slot and items chosen by the
   * shared helper on Progress.
   */
  const pendingUsualMealConsumedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    if (pendingUsualMealConsumedRef.current === userId) return;
    let cancelled = false;
    (async () => {
      let raw: string | null = null;
      try {
        raw = await AsyncStorage.getItem(PENDING_USUAL_MEAL_SAVE_KEY);
      } catch {
        return;
      }
      if (cancelled) return;
      pendingUsualMealConsumedRef.current = userId;
      if (!raw) return;
      try {
        await AsyncStorage.removeItem(PENDING_USUAL_MEAL_SAVE_KEY);
      } catch {
        /* ignore — worst case it's picked up again before TTL expiry. */
      }
      const pending = parsePendingUsualMealSave(raw);
      if (!pending) return;
      openSaveMealSheetWithSeed(pending.slot, pending.items);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, openSaveMealSheetWithSeed]);

  /** Persist a new saved meal from the lifted `SaveMealSheet`, then bump
   *  `savedMealsRefreshToken` so `QuickAddPanel` refetches its "Usual
   *  meals" tab and auto-switches to it. Mirrors the web host. */
  const handleCreateSavedMeal = useCallback(
    async (payload: {
      name: string;
      defaultMealSlot?: "Breakfast" | "Lunch" | "Dinner" | "Snacks";
      items: Array<Omit<SavedMealItem, "id" | "position">>;
    }) => {
      if (!userId) return;
      try {
        const created = await createSavedMeal(supabase, userId, payload);
        try {
          track(AnalyticsEvents.saved_meal_created, {
            itemCount: payload.items.length,
            defaultMealSlot: payload.defaultMealSlot,
            // L6 G3 (2026-04-18) — carry the new combo's id so the
            // create → later-logged funnel can join on a single key
            // instead of the (name, slot, items) tuple.
            savedMealId: created.id,
          });
        } catch { /* analytics is fire-and-forget */ }
        setSavedMealsRefreshToken((n) => n + 1);
      } catch (err) {
        Alert.alert("Could not save", "We couldn't save that meal. Try again.");
        // eslint-disable-next-line no-console
        console.warn("Saved-meal create failed", err);
      }
    },
    [userId],
  );

  /** Ship M1 — the first-run hint's "Save as usual" CTA. */
  const acceptUsualMealHint = useCallback(
    (slot: string) => {
      try {
        track(AnalyticsEvents.usual_meal_hint_accepted, { slot });
      } catch {
        /* analytics fire-and-forget */
      }
      openSaveMealSheetForSlot(slot);
    },
    [openSaveMealSheetForSlot],
  );

  /** Expand a saved meal into per-item journal entries and insert each
   *  via the same path as manual logs. Fires `saved_meal_logged` once
   *  per tap. Invoked by `QuickAddPanel` via `onLogSavedMeal`; the panel
   *  owns its own optimistic reorder of the "Usual meals" list. */
  const logSavedMealFromPanel = useCallback(
    (meal: SavedMeal, slot: string) => {
      if (!userId) return;
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
      // L6 G1 (2026-04-18) — mirror the web primitive: fire one
      // `food_logged { source: "saved_meal" }` per expanded item so
      // the funnel totals match web. `saved_meal_logged` is still
      // fired by the QuickAddPanel itself (one event per tap).
      try {
        for (const m of newMeals) {
          track(AnalyticsEvents.food_logged, {
            source: "saved_meal",
            calories: m.calories,
            slot,
          });
        }
      } catch { /* analytics fire-and-forget */ }
      // Fire-and-forget counter bump. Panel fires the analytics event.
      void incrementLogCount(supabase, userId, meal.id).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("Saved-meal log-count bump failed", err);
      });
      setShowPrevious(false);
    },
    [userId, selectedDate],
  );

  /** Ship M1 — slot-header "Log usual" pill handler. Logs the saved meal
   *  into `slot`, fires slot-header analytics + `saved_meal_logged`, and
   *  optimistically reorders the host's saved-meal list so the row
   *  surfaces at the top on next render. Mirrors the web host. */
  const logSavedMealFromSlotHeader = useCallback(
    (meal: SavedMeal, slot: string) => {
      if (!userId) return;
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
      try {
        track(AnalyticsEvents.usual_meal_log_tapped, {
          slot,
          itemCount: meal.items.length,
        });
      } catch { /* analytics fire-and-forget */ }
      try {
        track(AnalyticsEvents.saved_meal_logged, {
          itemCount: meal.items.length,
          slot,
          // L6 G3 (2026-04-18) — add savedMealId so F3 ("habit loop")
          // can follow the same combo across days without joining
          // on name alone.
          savedMealId: meal.id,
        });
      } catch { /* analytics fire-and-forget */ }
      // L6 G1 (2026-04-18) — mirror web primitive: one `food_logged`
      // per expanded item, tagged as a saved-meal log so the funnels
      // F1/F3 can slice quick-add-vs-usual-meal sources reliably.
      try {
        for (const m of newMeals) {
          track(AnalyticsEvents.food_logged, {
            source: "saved_meal",
            calories: m.calories,
            slot,
          });
        }
      } catch { /* analytics fire-and-forget */ }
      setHostSavedMeals((prev) => {
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
      void incrementLogCount(supabase, userId, meal.id).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("Today slot-header usual-meal log bump failed", err);
      });
      setSavedMealsRefreshToken((n) => n + 1);
    },
    [userId, selectedDate],
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
  // Eat-again dismiss (audit L4, 2026-04-18). v2 shape stores
  // `{ dateKey, dismissedAt }` so a device clock rollback can't
  // resurrect the banner on the same real-world day. Reads migrate
  // v1 on the fly; writes always use v2.
  const [eatAgainDismissState, setEatAgainDismissState] = useState<EatAgainDismissState | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const [v2, v1] = await Promise.all([
          AsyncStorage.getItem(EAT_AGAIN_STORAGE_KEY),
          AsyncStorage.getItem(EAT_AGAIN_LEGACY_KEY_V1),
        ]);
        if (cancelled) return;
        const state = readEatAgainDismiss(v2, v1, new Date());
        setEatAgainDismissState(state);
        // Opportunistic v1 -> v2 migration so the legacy key doesn't
        // drift forward forever. Only write when we actually have a
        // migrated state AND nothing already lives at v2.
        if (state && !v2) {
          try {
            await AsyncStorage.setItem(
              EAT_AGAIN_STORAGE_KEY,
              serialiseEatAgainDismiss(state),
            );
          } catch { /* noop */ }
        }
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const dismissEatAgain = useCallback(async () => {
    const state = recordEatAgainDismiss(new Date());
    setEatAgainDismissState(state);
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem(EAT_AGAIN_STORAGE_KEY, serialiseEatAgainDismiss(state));
    } catch { /* noop */ }
  }, []);
  const eatAgainDismissedForToday = !shouldShowEatAgain(eatAgainDismissState, new Date());


  const loadProfileTargets = useCallback(async () => {
    if (!userId) return;
    // Batch 2.5: include new `target_caffeine_mg` + `target_alcohol_g_weekly` +
    // the two per-day maps. If the migration hasn't landed yet on this env,
    // fall through to the legacy select so quick-add water keeps working.
    let resp = await supabase
      .from("profiles")
      .select(
        "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, target_caffeine_mg, target_alcohol_g_weekly, extra_water_by_day, extra_caffeine_by_day, extra_alcohol_g_by_day, steps_by_day, activity_burn_by_day, workouts_by_day, basal_burn_by_day, daily_steps_goal, prefer_activity_adjusted_calories, fasting_sessions, fasting_window, tracked_macros, week_start_day, measurement_system, weight_kg, height_cm, sex, activity_level, goal, goal_weight_kg, dob, age, notification_prefs, plan_pace, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history",
      )
      .eq("id", userId)
      .maybeSingle();
    if (resp.error) {
      resp = await supabase
        .from("profiles")
        .select(
          "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, extra_water_by_day, steps_by_day, activity_burn_by_day, workouts_by_day, basal_burn_by_day, daily_steps_goal, prefer_activity_adjusted_calories, fasting_sessions, fasting_window, tracked_macros, week_start_day, measurement_system, weight_kg, height_cm, sex, activity_level, goal, goal_weight_kg, dob, age, notification_prefs, plan_pace",
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
        plan_pace: d.plan_pace,
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
    // Parse `profiles.fasting_window` (stored as "16:8" style; fast hours
    // before the colon). Mirrors `parseFastingWindow` in `app/fasting.tsx`
    // so the widget snapshot reflects the user's configured window rather
    // than the 16h default. Invalid / unset values fall through to 16h.
    const fwRaw = (d as { fasting_window?: unknown }).fasting_window;
    if (typeof fwRaw === "string" && fwRaw.includes(":")) {
      const parts = fwRaw.split(":");
      const fast = parseInt(parts[0] ?? "", 10);
      if (Number.isFinite(fast) && fast >= 1 && fast <= 48) {
        setFastTargetHours(fast);
      }
    }
    if (Array.isArray(data.tracked_macros) && data.tracked_macros.length > 0) {
      setTrackedMacros(data.tracked_macros as string[]);
    }
    if (data.week_start_day === "sunday" || data.week_start_day === "monday") {
      setWeekStartDay(data.week_start_day);
    }
    // Display-unit preference — only `"imperial"` flips away from metric;
    // any other / missing value keeps the safe metric default.
    if ((d as any).measurement_system === "imperial") {
      setMeasurementSystem("imperial");
    } else if ((d as any).measurement_system === "metric") {
      setMeasurementSystem("metric");
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
    setProfilePlanPace(typeof d.plan_pace === "string" ? d.plan_pace : null);
    // Cached profile basics for the activity-bonus info popover (P1-1, 2026-04-18).
    const sxRaw = typeof d.sex === "string" ? d.sex.trim().toLowerCase() : "";
    setProfileSex(sxRaw === "male" || sxRaw === "female" || sxRaw === "unspecified" ? (sxRaw as any) : null);
    const hCm = d.height_cm != null ? Number(d.height_cm) : null;
    setProfileHeightCm(Number.isFinite(hCm) && hCm! > 0 ? hCm : null);
    const ageVal = d.age != null ? Number(d.age) : null;
    setProfileAge(Number.isFinite(ageVal) && ageVal! > 0 ? ageVal : null);
    const actRaw = typeof d.activity_level === "string" ? d.activity_level.trim().toLowerCase() : "";
    const ACT_OK = ["sedentary", "light", "moderate", "active", "very_active"] as const;
    setProfileActivityLevel((ACT_OK as readonly string[]).includes(actRaw) ? (actRaw as any) : null);
    // Adaptive TDEE fields — fall back to null when the profile lookup
    // used the narrow fallback select (see try/catch above) that omits
    // these columns. `resolveMaintenance` treats null as "use formula".
    const aTdeeRaw = (d as any).adaptive_tdee;
    setAdaptiveTdee(typeof aTdeeRaw === "number" && Number.isFinite(aTdeeRaw) ? aTdeeRaw : null);
    setAdaptiveTdeeConfidence(
      typeof (d as any).adaptive_tdee_confidence === "string" ? (d as any).adaptive_tdee_confidence : null,
    );
    setAdaptiveTdeeUpdatedAt(
      typeof (d as any).adaptive_tdee_updated_at === "string" ? (d as any).adaptive_tdee_updated_at : null,
    );
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
    () => maintenanceIntakeFromTargetCalories(targets.calories, profileGoal, profilePlanPace),
    [targets.calories, profileGoal, profilePlanPace],
  );

  // Maintenance tile + popover single source of truth. Resolves via
  // the shared `resolveMaintenance`: adaptive TDEE wins at medium/high
  // confidence AND not stale, otherwise the static Mifflin formula.
  // Progress reads from the same helper so "Maintenance 1,675" and
  // "Your TDEE 1,777" (TestFlight `ADFYpDgEEb0QH-j3BXshPTo`, build 10)
  // can no longer disagree.
  const resolvedMaintenance = useMemo(
    () =>
      resolveMaintenance({
        adaptive_tdee: adaptiveTdee,
        adaptive_tdee_confidence: adaptiveTdeeConfidence,
        adaptive_tdee_updated_at: adaptiveTdeeUpdatedAt,
        sex: profileSex as any,
        weight_kg: profileWeightKg,
        height_cm: profileHeightCm,
        age: profileAge,
        activity_level: profileActivityLevel as any,
      }),
    [
      adaptiveTdee,
      adaptiveTdeeConfidence,
      adaptiveTdeeUpdatedAt,
      profileSex,
      profileWeightKg,
      profileHeightCm,
      profileAge,
      profileActivityLevel,
    ],
  );
  const profileMaintenanceTdeeKcal = resolvedMaintenance?.kcal ?? null;
  const profileMaintenanceSource = resolvedMaintenance?.source ?? null;
  const profileMaintenanceConfidence = resolvedMaintenance?.confidence ?? null;

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
  //
  // L6 G7 (2026-04-18) — tag each successful write with the `trigger`
  // that caused it: macro totals/targets vs active fast state vs an
  // initial "scheduled" write after hydration. Product uses this to
  // triage why the iOS home-screen widget goes stale.
  const widgetSnapshotSignatureRef = useRef<{
    totalsKey: string;
    fastKey: string | null;
    wroteOnce: boolean;
  }>({ totalsKey: "", fastKey: null, wroteOnce: false });
  useEffect(() => {
    if (!hydrated || !isToday || viewMode !== "day") return;
    const currentTotalsKey = [
      totals.calories,
      totals.protein,
      totals.carbs,
      totals.fat,
      effectiveCalorieGoal,
      targets.protein,
      targets.carbs,
      targets.fat,
    ].join(":");
    const currentFastKey = activeFastStart ?? null;
    const prev = widgetSnapshotSignatureRef.current;
    let trigger: "totals_changed" | "fast_state_changed" | "scheduled_refresh";
    if (!prev.wroteOnce) {
      // First write after hydrate — classified as a scheduled refresh
      // so the initial liveness ping isn't misattributed to totals.
      trigger = "scheduled_refresh";
    } else if (prev.fastKey !== currentFastKey) {
      trigger = "fast_state_changed";
    } else {
      trigger = "totals_changed";
    }
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
          // Threaded from `profiles.fasting_window` (parsed in
          // `loadProfileTargets`). `buildWidgetSnapshot` clamps to 1..48h
          // and defaults to 16 if anything is off — safe to pass directly.
          fastTargetHours,
        });
        const result = await writeWidgetSnapshot(snapshot);
        if (result.ok) {
          widgetSnapshotSignatureRef.current = {
            totalsKey: currentTotalsKey,
            fastKey: currentFastKey,
            wroteOnce: true,
          };
          track(AnalyticsEvents.widget_snapshot_updated, { trigger });
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
    fastTargetHours,
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
  // 2026-04-18 audit H7 — DayStrip tiles for days where a freeze was
  // consumed render a ❄ glyph. Parent computes once so both DayStrips
  // (day + week view) render identically.
  //
  // L6 G8 (2026-04-18) — the memo also exposes `streakLength` so the
  // `streak_reset` effect below can detect >=1 → 0 transitions.
  const protectedStreakInfo = useMemo(() => {
    return computeProtectedStreak(byDay as never, freezeLedger, freezeBudgetMax);
  }, [byDay, freezeLedger, freezeBudgetMax]);
  const protectedDateKeys = useMemo(
    () => new Set(protectedStreakInfo.protectedDateKeys),
    [protectedStreakInfo],
  );
  const protectedStreakLength = protectedStreakInfo.streakLength;
  // L6 G8 (2026-04-18) — fire `streak_reset` exactly once when the
  // protected streak transitions from >=1 to 0. Ref starts at `null`
  // so a user with a zero streak on first render never fires.
  const priorProtectedStreakRef = useRef<number | null>(null);
  useEffect(() => {
    const prior = priorProtectedStreakRef.current;
    priorProtectedStreakRef.current = protectedStreakLength;
    if (didStreakReset(prior, protectedStreakLength)) {
      try {
        track(AnalyticsEvents.streak_reset, {
          priorStreak: prior ?? 0,
        });
      } catch { /* analytics fire-and-forget */ }
    }
  }, [protectedStreakLength]);
  // 2026-04-18 audit H7 — one-time "You earned a freeze" row under the
  // streak insight card. Newest `earnedAt` ISO from the ledger; the row
  // shows until the user taps "Got it", which writes that ISO to
  // AsyncStorage. No shame copy, no modal takeover.
  const newestFreezeEarnedAt = useMemo(() => {
    if (!Array.isArray(freezeLedger.earnedAt) || freezeLedger.earnedAt.length === 0) return null;
    let newest = "";
    for (const entry of freezeLedger.earnedAt) {
      if (typeof entry?.earnedAt === "string" && entry.earnedAt > newest) newest = entry.earnedAt;
    }
    return newest || null;
  }, [freezeLedger]);
  const [lastSeenFreezeEarnedAt, setLastSeenFreezeEarnedAt] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const v = await AsyncStorage.getItem("suppr-last-seen-freeze-earned-at");
        if (!cancelled) setLastSeenFreezeEarnedAt(v);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const hasUnseenFreezeEarned =
    freezesAvailableToday > 0 &&
    newestFreezeEarnedAt !== null &&
    (lastSeenFreezeEarnedAt === null || newestFreezeEarnedAt > lastSeenFreezeEarnedAt);
  const dismissFreezeEarned = useCallback(async () => {
    if (!newestFreezeEarnedAt) return;
    setLastSeenFreezeEarnedAt(newestFreezeEarnedAt);
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem("suppr-last-seen-freeze-earned-at", newestFreezeEarnedAt);
    } catch { /* noop */ }
    try {
      // Dual-emit during rename cycle 2026-04-18 → 2026-05-18. See plan doc §4.
      const seenPayload = { earnedAt: newestFreezeEarnedAt };
      track(AnalyticsEvents.streak_freeze_earned_seen, seenPayload);
      track(AnalyticsEvents.streak_freeze_earned_acknowledged, seenPayload);
    } catch { /* noop */ }
  }, [newestFreezeEarnedAt]);

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

  // Audit M4 (2026-04-18) — Today progressive disclosure gates.
  // Visibility is "sticky": once true for a returning user it stays true
  // because the underlying state (water target, Health sync) persists.
  // Manual expanders (`hydrationManualExpanded`, `stepsManualExpanded`)
  // let a first-run user open the card on demand without writing any
  // state they might not want.
  const hydrationCardGateOpen = useMemo(
    () =>
      isHydrationCardVisible({
        waterTargetMl: waterGoalMl,
        extraWaterByDay,
        waterFromMealsMl,
        extraCaffeineByDay,
        extraAlcoholGByDay,
      }),
    [waterGoalMl, extraWaterByDay, waterFromMealsMl, extraCaffeineByDay, extraAlcoholGByDay],
  );
  const stepsCardGateOpen = useMemo(
    () => isStepsCardVisible({ stepsByDay, activityBurnByDay }),
    [stepsByDay, activityBurnByDay],
  );
  const showHydrationCard = hydrationCardGateOpen || hydrationManualExpanded;
  const showStepsCard = stepsCardGateOpen || stepsManualExpanded;

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
        source: aiLoggingSourceLabel(item.source),
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
  // tiers see the in-flow `AiPaywallSheet` (M2, 2026-04-18); Pro opens
  // the respective sheet. The `voice_log_paywalled` /
  // `ai_photo_log_paywalled` events still fire so existing funnels keep
  // reporting; the new `ai_paywall_sheet_viewed` event fires from
  // inside the sheet on mount.
  const handleOpenVoiceLog = useCallback(() => {
    if (userTier !== "pro") {
      // Dual-emit during rename cycle 2026-04-18 → 2026-05-18. See plan doc §4.
      track(AnalyticsEvents.voice_log_paywalled);
      track(AnalyticsEvents.ai_voice_log_paywalled);
      setAiPaywall({ open: true, feature: "voice_log" });
      return;
    }
    setVoiceLogOpen(true);
  }, [userTier]);

  const handleOpenPhotoLog = useCallback(() => {
    if (userTier !== "pro") {
      track(AnalyticsEvents.ai_photo_log_paywalled);
      setAiPaywall({ open: true, feature: "photo_log" });
      return;
    }
    setPhotoLogOpen(true);
  }, [userTier]);

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
        // L6 G6 (2026-04-18) — dashboards key off amount_ml + via.
        // All current mobile water entry points are quick chips (the
        // HydrationStimulantsCard, the TodayAddMealDialog meal-row
        // path routes `waterMl` inside the meal entry → food_logged,
        // not here). If a manual `addWaterMl` is introduced, flag it.
        amount_ml: add,
        via: "quick_chip",
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
        // L6 G6 (2026-04-18) — explicit enum fields so the dashboards
        // don't have to reverse a (unit, type) combo.
        kind: "caffeine",
        amount_mg_or_g: add,
        via: preset ? "quick_chip" : "manual",
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
        // L6 G6 (2026-04-18) — explicit enum fields.
        kind: "alcohol",
        amount_mg_or_g: add,
        via: preset ? "quick_chip" : "manual",
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
      // L6 G6 (2026-04-18) — reset paths stay backwards-compatible
      // (amount: 0, preset: "reset") and add the explicit enum
      // fields. `via: "manual"` because reset is always a deliberate
      // menu action, never a quick chip.
      if (kind === "water") {
        track(AnalyticsEvents.hydration_logged, {
          type: "water",
          amount: 0,
          unit: "ml",
          preset: "reset",
          amount_ml: 0,
          via: "manual",
        });
      } else {
        track(AnalyticsEvents.stimulant_logged, {
          type: kind,
          amount: 0,
          unit: kind === "caffeine" ? "mg" : "g",
          preset: "reset",
          kind,
          amount_mg_or_g: 0,
          via: "manual",
        });
      }
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

    // M9 (2026-04-21) — `nutrition_entries` and the top-of-day
    // `meal_plan_days` lookup are independent (different tables,
    // different filters). Kick both off in parallel; the dependent
    // `meal_plan_meals` fetch below still waits on `dayRow` because
    // it uses the returned id. Sequential execution used to cost us
    // the round-trip difference on every tab focus.
    const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay();
    const [
      { data: rows, error },
      { data: dayRow },
    ] = await Promise.all([
      supabase
        .from("nutrition_entries")
        .select("id, date_key, name, recipe_title, time_label, calories, protein, carbs, fat, fiber_g, water_ml, portion_multiplier, source, created_at, nutrition_micros")
        .eq("user_id", userId)
        .order("date_key", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(20_000),
      supabase
        .from("meal_plan_days")
        .select("id")
        .eq("user_id", userId)
        .eq("day", todayDow)
        .eq("slot_id", "default")
        .maybeSingle(),
    ]);

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

    // Today's planned meals: the `meal_plan_days` row was fetched in
    // parallel above (M9). We now use `dayRow` to drive the dependent
    // `meal_plan_meals` fetch, or fall back to legacy JSON when the
    // relational day row is missing.
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

  // Token rotation (TestFlight build 7 fix —
  // `AOjQg5DGBZqS5qNJ1Rqu960`, `APdpODtJDL8q2JhtGup6DK0`). Expo push
  // tokens can change across reinstalls / restore-from-backup; the
  // helper short-circuits when nothing has changed so it is cheap to
  // call on every focus.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      void refreshExpoPushTokenIfChanged(userId);
    }, [userId]),
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
            else {
              void refreshAdaptiveTdeeForUser(supabase, userId);
              // F-2 (2026-04-19) — freeze today's target on first log of
              // the day. Past days stop moving when the user later edits
              // activity_level / plan_pace / goal. Fire-and-forget — the
              // insert has `on conflict do nothing` so repeat calls are
              // cheap no-ops.
              void snapshotDailyTargetIfMissing(supabase, userId);
            }
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
    // F-13 (2026-04-19) — capture the meal's caffeine/alcohol delta
    // BEFORE we drop it so the same values can be subtracted from
    // `profiles.extra_caffeine_by_day` / `extra_alcohol_g_by_day`.
    // `dayKey` is captured by scanning every day (edits from the
    // non-selected day are rare but possible).
    let doomedCaffeineMg = 0;
    let doomedAlcoholG = 0;
    let doomedDayKey: string | null = null;
    setByDay((prev) => {
      for (const [dk, meals] of Object.entries(prev)) {
        const hit = meals.find((m) => m.id === mealId);
        if (hit) {
          doomedDayKey = dk;
          doomedCaffeineMg = Number(hit.micros?.caffeineMg ?? 0) || 0;
          doomedAlcoholG = Number(hit.micros?.alcoholG ?? 0) || 0;
          break;
        }
      }
      return {
        ...prev,
        [dayKey]: (prev[dayKey] ?? []).filter((m) => m.id !== mealId),
      };
    });

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
            return;
          }
          // F-13 — decrement daily caffeine / alcohol totals by the
          // deleted meal's contribution. Clamped at 0 inside the
          // updater so a stale delete cannot push the total negative.
          if (
            doomedDayKey &&
            (doomedCaffeineMg > 0 || doomedAlcoholG > 0)
          ) {
            void updateStimulantsForDay(supabase, userId, doomedDayKey, {
              caffeineMg: -doomedCaffeineMg,
              alcoholG: -doomedAlcoholG,
            });
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
    async (targetDayKey: string, clones: Array<Omit<JournalMeal, "id">>): Promise<number> => {
      if (clones.length === 0) return 0;
      const withIds: JournalMeal[] = clones.map((c) => ({ ...c, id: newMealId() } as JournalMeal));
      setByDay((prev) => ({
        ...prev,
        [targetDayKey]: [...(prev[targetDayKey] ?? []), ...withIds],
      }));
      if (!userId) return withIds.length;
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
        return 0;
      }
      void refreshAdaptiveTdeeForUser(supabase, userId);
      // F-2 — snapshot today's target regardless of `targetDayKey`
      // (back-dating a snapshot would defeat the purpose).
      void snapshotDailyTargetIfMissing(supabase, userId);
      return withIds.length;
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
      let totalInserted = 0;
      for (const t of clean) {
        const cloned = cloneMealWithoutId(meal) as Omit<JournalMeal, "id">;
        totalInserted += await insertClonedRowsIntoDay(t, [cloned]);
      }
      try {
        track(AnalyticsEvents.meal_copied, { source: "copy_meal", batchSize: 1, targetDayCount: clean.length });
      } catch { /* noop */ }
      // Audit M3 (2026-04-18): fire ONE batched food_logged event for the
      // whole copy-range, not N events.
      if (totalInserted > 0) {
        try {
          track(AnalyticsEvents.food_logged, {
            count: totalInserted,
            batched: true,
            source: "copy_meal",
          });
        } catch { /* noop */ }
      }
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
      const inserted = await insertClonedRowsIntoDay(targetDayKey, clones);
      try {
        track(AnalyticsEvents.day_duplicated, { source: "duplicate_day", batchSize: src.length, targetDayCount: 1 });
      } catch { /* noop */ }
      // Audit M3 (2026-04-18): single batched food_logged per duplicate.
      if (inserted > 0) {
        try {
          track(AnalyticsEvents.food_logged, {
            count: inserted,
            batched: true,
            source: "duplicate_day",
          });
        } catch { /* noop */ }
      }
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
      let totalInserted = 0;
      for (const t of clean) {
        const clones = src.map((m) => cloneMealWithoutId(m) as Omit<JournalMeal, "id">);
        totalInserted += await insertClonedRowsIntoDay(t, clones);
      }
      try {
        track(AnalyticsEvents.day_duplicated, { source: "duplicate_day", batchSize: src.length, targetDayCount: clean.length });
      } catch { /* noop */ }
      // Audit M3 (2026-04-18): ONE batched food_logged for the 7-day range,
      // not N events per inserted row.
      if (totalInserted > 0) {
        try {
          track(AnalyticsEvents.food_logged, {
            count: totalInserted,
            batched: true,
            source: "duplicate_day",
          });
        } catch { /* noop */ }
      }
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
        // F-2 — snapshot today's target on first meal-plan log.
        void snapshotDailyTargetIfMissing(supabase, userId);
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
        <TodayDateHeader
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedDate={selectedDate}
          weekLabel={weekData.label}
          isToday={isToday}
          formatDateLabel={formatDateLabel}
          weekStartDay={weekStartDay}
          loggedDays={loggedDays}
          protectedDateKeys={protectedDateKeys}
          onSelectDate={(d) => setSelectedDate(clampJournalDate(d))}
          onOpenCalendar={() => setJournalCalendarOpen(true)}
          onNavigatePrev={() => (viewMode === "week" ? navigateWeek(-1) : navigateDay(-1))}
          onNavigateNext={() => (viewMode === "week" ? navigateWeek(1) : navigateDay(1))}
          onTapTitle={() => { setSelectedDate(new Date()); setViewMode("day"); }}
          avatarLetter={session?.user?.email?.[0]?.toUpperCase() ?? "U"}
          textColor={colors.text}
          textSecondaryColor={colors.textSecondary}
          textTertiaryColor={colors.textTertiary}
          cardColor={colors.card}
          cardBorderColor={colors.cardBorder}
        />

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
            protectedDateKeys={protectedDateKeys}
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
        {viewMode === "day" && activeFastStart && (
          <TodayFastingPill
            startedAt={activeFastStart}
            nowTick={fastingTick}
            onPress={() => router.push("/fasting")}
          />
        )}

        {viewMode === "week" ? (
          <TodayWeekView
            days={weekData.days}
            weekTotals={weekData.weekTotals}
            weekAvg={weekData.weekAvg}
            daysWithFood={weekData.daysWithFood}
            weekEffectiveCalorieBudget={weekEffectiveCalorieBudget}
            calorieTarget={targets.calories}
            proteinTarget={targets.protein}
            carbsTarget={targets.carbs}
            fatTarget={targets.fat}
            preferActivityAdjustedCalories={preferActivityAdjustedCalories}
            activityBonusCaloriesOnly={activityBonusCaloriesOnly}
            maintenanceKcal={maintenanceKcal}
            dayGoals={weekData.days.map((day) =>
              targets.calories +
              dayActivityBudgetAddon(
                preferActivityAdjustedCalories,
                activityBonusCaloriesOnly,
                activityBurnByDay,
                basalBurnByDay,
                maintenanceKcal,
                day.key,
              ),
            )}
            onSelectDay={(d) => { setSelectedDate(d); setViewMode("day"); }}
            styles={styles}
            textColor={colors.text}
            textSecondaryColor={colors.textSecondary}
            textTertiaryColor={colors.textTertiary}
            borderColor={colors.border}
          />
        ) : (
          <>
            {/* Today hero — ring / bar / number variant, user-pickable
                via the grid-icon affordance in the card's top-right.
                Prototype port (2026-04-20 Claude Design drop). */}
            <TodayHero
              variant={heroVariant}
              onVariantChange={setHeroVariant}
              consumed={totals.calories}
              goal={effectiveCalorieGoal}
              baseGoal={todayActivityBudgetAddon > 0 ? targets.calories : undefined}
              textColor={colors.text}
              textSecondaryColor={colors.textSecondary}
              textTertiaryColor={colors.textTertiary}
              cardBackgroundColor={colors.card}
              borderColor={colors.border}
              trackColor={colors.border}
              proteinPct={targets.protein > 0 ? Math.min(totals.protein / targets.protein, 1) : 0}
              carbsPct={targets.carbs > 0 ? Math.min(totals.carbs / targets.carbs, 1) : 0}
              fatPct={targets.fat > 0 ? Math.min(totals.fat / targets.fat, 1) : 0}
              expanded={ringExpanded}
              onToggleExpanded={() => setRingExpanded((e) => !e)}
              displayMode={calorieDisplayMode}
              onToggleDisplayMode={() => setCalorieDisplayMode((m) => m === "remaining" ? "consumed" : "remaining")}
            />

            {/* RemainingMacrosBar removed 2026-04-20 — the horizontal
                5-column kcal/P/C/F/Fi adherence strip duplicated the
                2x2 macro tile grid below and read as visual noise on
                Today. See feedback_no_duplicate_today_hero_content.md. */}

            {/* Dynamic Macro Cards — 2x2 grid, prototype treatment */}
            <TodayDashboardMacroTiles
              trackedMacros={trackedMacros}
              totals={totals}
              targets={targets}
              totalWaterMl={totalWaterMl}
              waterGoalMl={waterGoalMl}
              mealsToday={mealsToday}
              onPressMacro={(macro) => router.push({ pathname: "/macro-detail", params: { macro, date: dayKey } })}
              cardColor={colors.card}
              cardBorderColor={colors.cardBorder}
              borderColor={colors.border}
              textColor={colors.text}
              textSecondaryColor={colors.textSecondary}
              textTertiaryColor={colors.textTertiary}
              mutedColor={colors.border}
            />

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
            <TodayQuickLogStrip
              userTier={userTier}
              onOpenSearch={() => setSearchOpen(true)}
              onOpenVoice={handleOpenVoiceLog}
              onOpenPhoto={handleOpenPhotoLog}
              onOpenBarcode={() => setBarcodeOpen(true)}
              cardColor={colors.card}
              cardBorderColor={colors.cardBorder}
              textSecondaryColor={colors.textSecondary}
              textTertiaryColor={colors.textTertiary}
            />
          </>
        )}

        {/* TodayStreakInsightCard removed 2026-04-20 — Grace's call
            per Today alignment pass. Streak logic still runs (powers
            the freeze ledger + weekly recap analytics) but is no
            longer surfaced on Today. Re-add if streak signal becomes
            a retention lever later. */}

        {/* Deficit insight */}
        {viewMode === "day" && isToday && remaining > 0 && (
          <TodayDeficitInsight
            remaining={remaining}
            weekSummaryMode={weekSummaryMode}
            selectedDate={selectedDate}
            weekStartDay={weekStartDay}
            byDay={byDay}
            targetCalories={targets.calories}
            preferActivityAdjustedCalories={preferActivityAdjustedCalories}
            activityBonusCaloriesOnly={activityBonusCaloriesOnly}
            activityBurnByDay={activityBurnByDay}
            basalBurnByDay={basalBurnByDay}
            maintenanceKcal={maintenanceKcal}
            dayActivityBudgetAddon={dayActivityBudgetAddon}
            textSecondaryColor={colors.textSecondary}
          />
        )}

        {/* Meal sections (day view only) — prototype style: single card, IconBox per slot */}
        {/* Eat again — suggest re-logging the most recent meal in the
            slot matching the current clock time. Dismissible per day. */}
        {viewMode === "day" && isToday && eatAgainSuggestion && !eatAgainDismissedForToday && (
          <TodayEatAgainBanner
            suggestion={eatAgainSuggestion}
            slot={currentSlotFromTime}
            textColor={colors.text}
            textSecondaryColor={colors.textSecondary}
            onLog={() => logHistoryItemToSlot(eatAgainSuggestion, currentSlotFromTime)}
            onDismiss={dismissEatAgain}
          />
        )}

        {/* Audit M4 (2026-04-18) — Quick add CTA above Meals.
            Default collapsed on first run; user's last open/closed choice
            persists via AsyncStorage (`suppr-quick-add-collapsed-v1`).
            Keeps all 4 tabs reachable without drowning first-time users in
            chips. The FAB's "Previous" action still opens the full-screen
            overlay for power users. */}
        {viewMode === "day" && quickAddPrefLoaded && (
          <View style={{ marginBottom: Spacing.md }}>
            <Pressable
              onPress={() => void toggleQuickAddCollapsed()}
              accessibilityRole="button"
              accessibilityLabel={quickAddCollapsed ? "Show quick add" : "Hide quick add"}
              accessibilityState={{ expanded: !quickAddCollapsed }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 12,
                paddingHorizontal: Spacing.md,
                borderRadius: Radius.md,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                <Ionicons name="flash-outline" size={18} color={Accent.primary} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>Quick add</Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                  Usual meals, recent, frequent, favourites
                </Text>
              </View>
              <Ionicons
                name={quickAddCollapsed ? "chevron-down" : "chevron-up"}
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
            {!quickAddCollapsed && (
              <View style={{ marginTop: Spacing.sm }}>
                <QuickAddPanel
                  byDay={byDay}
                  activeSlot={activeMealSlot}
                  supabase={supabase}
                  userId={userId ?? ""}
                  onLog={(item) => logHistoryItemToSlot(item, activeMealSlot)}
                  onLogSavedMeal={(meal, slot) => logSavedMealFromPanel(meal, slot)}
                  onOpenSaveCombo={(slot) => {
                    if (slot) openSaveMealSheetForSlot(slot);
                  }}
                  savedMealsRefreshToken={savedMealsRefreshToken}
                />
              </View>
            )}
          </View>
        )}

        {viewMode === "day" && (
          <TodayMealsSection
            slots={MEAL_SLOTS}
            mealGroups={mealGroups}
            mealsTodayCount={mealsToday.length}
            collapsedSlots={collapsedSlots}
            onToggleSlotCollapse={toggleSlotCollapse}
            onOpenFabForSlot={(slot) => { setActiveMealSlot(slot); setFabSheetOpen(true); }}
            onOpenSaveUsualMealForSlot={openSaveMealSheetForSlot}
            onOpenDuplicateDay={() => setDuplicateDayOpen(true)}
            onPressMeal={(id) => router.push(`/meal-nutrition?id=${encodeURIComponent(id)}` as const)}
            onLongPressEdit={openEditMeal}
            onRequestCopyMeal={(id) => setCopyMealTargetId(id)}
            onDeleteMeal={deleteMeal}
            showMealTimestamps={showMealTimestamps}
            formatMealMacroDetail={formatMealMacroDetail}
            formatMealTimeDisplay={formatMealTimeDisplay}
            formatMealSourceLabelForRow={formatMealSourceLabelForRow}
            textColor={colors.text}
            textSecondaryColor={colors.textSecondary}
            textTertiaryColor={colors.textTertiary}
            cardColor={colors.card}
            cardBorderColor={colors.cardBorder}
            savedMeals={hostSavedMeals}
            onLogSavedMeal={logSavedMealFromSlotHeader}
            hintVisibleForSlot={hintVisibleForSlot}
            onDismissUsualMealHint={dismissUsualMealHint}
            onAcceptUsualMealHint={acceptUsualMealHint}
          />
        )}

        {/* Planned meals from the planner */}
        {viewMode === "day" && plannedMeals.length > 0 && (
          <TodayPlannedMealsCard
            plannedMeals={plannedMeals}
            onLogPlannedMealWithPortion={(pm, p) => void logPlannedMealWithPortion(pm, p)}
            styles={styles}
          />
        )}

        {/* Add food form */}
        {viewMode === "day" && addOpen && (
          <TodayAddFoodForm
            slots={MEAL_SLOTS}
            activeMealSlot={activeMealSlot}
            onActiveMealSlotChange={setActiveMealSlot}
            title={title}
            onTitleChange={setTitle}
            kcal={kcal}
            onKcalChange={setKcal}
            protein={protein}
            onProteinChange={setProtein}
            carbs={carbs}
            onCarbsChange={setCarbs}
            fat={fat}
            onFatChange={setFat}
            onSubmit={addMeal}
            onOpenSearch={() => { setAddOpen(false); setSearchOpen(true); }}
            styles={styles}
            borderColor={colors.border}
            textSecondaryColor={colors.textSecondary}
            textTertiaryColor={colors.textTertiary}
          />
        )}

        {/* Steps, active energy — per selected day (historic via header / DayStrip).
            Water + stimulants live in the `HydrationStimulantsCard` at the
            bottom of Today (post-TestFlight build 7 feedback, 2026-04-18).
            Audit M4 (2026-04-18): gated until Apple Health / Google Fit has
            synced at least once (steps map OR activity burn map non-empty).
            First-run fallback is a small "Connect health" link that opens
            the existing Health Sync screen. */}
        {viewMode === "day" && showStepsCard && (
          <TodayActivityCard
            dayLabel={isToday ? "Today" : formatDateLabel(selectedDate)}
            stepsCount={stepsCount}
            dailyStepsGoal={dailyStepsGoal}
            activityBurnKcal={activityBurnKcal}
            styles={styles}
            textColor={colors.text}
            textSecondaryColor={colors.textSecondary}
            textTertiaryColor={colors.textTertiary}
            borderColor={colors.border}
          />
        )}
        {viewMode === "day" && !showStepsCard && (
          <Pressable
            onPress={() => router.push("/health-sync" as any)}
            accessibilityRole="button"
            accessibilityLabel="Connect health"
            style={{ paddingVertical: 4, marginBottom: Spacing.sm }}
          >
            <Text style={{ fontSize: 12, color: Accent.primary, fontWeight: "600", textAlign: "center" }}>
              Connect health
            </Text>
          </Pressable>
        )}

        {/* Activity Bonus — show on Today even before Health fills burn maps, so prefs are discoverable */}
        {viewMode === "day" && userId && (hasBurnData || isToday) && (
          <TodayActivityBonusCard
            isToday={isToday}
            hasBurnData={hasBurnData}
            totalBurnKcal={totalBurnKcal}
            consumedCalories={totals.calories}
            effectiveCalorieGoal={effectiveCalorieGoal}
            basalBurnKcal={basalBurnKcal}
            activityBurnKcal={activityBurnKcal}
            todayActivityBudgetAddon={todayActivityBudgetAddon}
            dayWorkouts={dayWorkouts}
            trackerWeekSummaryKeys={trackerWeekSummaryKeys}
            activityBurnByDay={activityBurnByDay}
            basalBurnByDay={basalBurnByDay}
            byDay={byDay}
            weekSummaryMode={weekSummaryMode}
            onOpenBurnDetail={() => router.push({ pathname: "/burn-detail", params: { date: dayKey } } as any)}
            maintenanceTdeeKcal={profileMaintenanceTdeeKcal}
            profileSex={profileSex}
            profileWeightKg={profileWeightKg}
            profileHeightCm={profileHeightCm}
            profileAge={profileAge}
            profileActivityLevel={profileActivityLevel}
            maintenanceSource={profileMaintenanceSource}
            maintenanceConfidence={profileMaintenanceConfidence}
            styles={styles}
            textColor={colors.text}
            textSecondaryColor={colors.textSecondary}
            textTertiaryColor={colors.textTertiary}
            borderColor={colors.border}
            cardColor={colors.card}
            cardBorderColor={colors.cardBorder}
          />
        )}

        {/* Batch 2.5 — hydration & stimulants (water + caffeine + alcohol).
            Position (2026-04-18, post-TestFlight build 7 feedback): sits at
            the bottom of Today — primary water quick-add lives in the macro
            tile row up top; this card is detail + caffeine/alcohol quick-add.
            Gating: visible once water target > 0 OR any water/caffeine/
            alcohol logged. Caffeine + alcohol rows additionally self-hide
            when their individual target is 0. First-run fallback is a tiny
            "Track hydration?" link. */}
        {viewMode === "day" && showHydrationCard && (
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
            measurementSystem={measurementSystem}
            onAddWater={(ml) => void addWaterMl(ml)}
            onAddCaffeine={(mg, preset) => void addCaffeineMg(mg, preset ?? null)}
            onAddAlcohol={(g, preset) => void addAlcoholG(g, preset ?? null)}
            onReset={(kind) => void resetHydrationStimulantsForDay(kind)}
          />
        )}
        {viewMode === "day" && !showHydrationCard && (
          <Pressable
            onPress={() => setHydrationManualExpanded(true)}
            accessibilityRole="button"
            accessibilityLabel="Track hydration"
            style={{ paddingVertical: 4, marginBottom: Spacing.sm }}
          >
            <Text style={{ fontSize: 12, color: Accent.primary, fontWeight: "600", textAlign: "center" }}>
              Track hydration?
            </Text>
          </Pressable>
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
      <TodayCompleteDayModal
        visible={completeDayOpen}
        onClose={() => setCompleteDayOpen(false)}
        isToday={isToday}
        profileWeightKg={profileWeightKg}
        todayCalories={totals.calories}
        targetCalories={effectiveCalorieGoal}
        maintenanceTdeeKcal={profileMaintenanceTdeeKcal}
        profileGoal={profileGoal}
        onViewProgress={() => {
          setCompleteDayOpen(false);
          router.navigate("/(tabs)/progress" as any);
        }}
        cardColor={colors.card}
        textColor={colors.text}
        textSecondaryColor={colors.textSecondary}
        textTertiaryColor={colors.textTertiary}
      />

      {/* FAB + bottom sheet — always visible on day view. */}
      <TodayFabSheet
        fabVisible={viewMode === "day" && !addOpen && !showPrevious && !fabSheetOpen}
        sheetVisible={fabSheetOpen}
        onOpenSheet={() => setFabSheetOpen(true)}
        onCloseSheet={() => setFabSheetOpen(false)}
        onOpenPrevious={() => { setFabSheetOpen(false); setShowPrevious(true); }}
        onOpenSearch={() => { setFabSheetOpen(false); setSearchOpen(true); }}
        onOpenBarcode={() => { setFabSheetOpen(false); setBarcodeOpen(true); }}
        onOpenQuickAdd={() => { setFabSheetOpen(false); setAddOpen(true); }}
        onOpenPhotoLog={() => { setFabSheetOpen(false); handleOpenPhotoLog(); }}
        onOpenVoiceLog={() => { setFabSheetOpen(false); handleOpenVoiceLog(); }}
        cardColor={colors.card}
        inputBgColor={colors.inputBg}
        borderColor={colors.border}
        textColor={colors.text}
        textSecondaryColor={colors.textSecondary}
        textTertiaryColor={colors.textTertiary}
      />

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

      {/* Edit meal modal */}
      <TodayEditMealModal
        editingMeal={editingMeal}
        slots={MEAL_SLOTS}
        editSlot={editSlot}
        onEditSlotChange={setEditSlot}
        editPortion={editPortion}
        onEditPortionChange={setEditPortion}
        onApplyPortionMultiplier={applyEditPortionMultiplier}
        editTitle={editTitle}
        onEditTitleChange={setEditTitle}
        editKcal={editKcal}
        onEditKcalChange={setEditKcal}
        editProtein={editProtein}
        onEditProteinChange={setEditProtein}
        editCarbs={editCarbs}
        onEditCarbsChange={setEditCarbs}
        editFat={editFat}
        onEditFatChange={setEditFat}
        onSave={saveEditMeal}
        onDelete={() => {
          if (editingMeal) {
            deleteMeal(editingMeal.id);
            setEditingMeal(null);
          }
        }}
        onClose={() => setEditingMeal(null)}
        styles={styles}
        cardColor={colors.card}
        borderColor={colors.border}
        inputBgColor={colors.inputBg}
        textColor={colors.text}
        textSecondaryColor={colors.textSecondary}
        textTertiaryColor={colors.textTertiary}
      />

      {/* Food search modal for logging */}
      <FoodSearchModal
        visible={searchOpen}
        initialQuery=""
        supabase={supabase}
        userId={userId ?? null}
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
        onSelect={(result) => {
          const grams = result.chosenPortion.gramWeight * result.quantity;
          const f = grams / 100;
          // Resolve the attribution source per source type so the journal
          // shows "Custom · <food name>" rather than a misleading USDA tag.
          const source =
            result.source === "CUSTOM"
              ? "Custom food"
              : result.source === "OFF"
              ? "Open Food Facts"
              : result.source === "Edamam"
              ? "Edamam"
              : "USDA FoodData Central";
          // F-13 (2026-04-19) — auto-track caffeine + alcohol for this
          // portion. Stashed under `micros.caffeineMg` / `micros.alcoholG`
          // so a future delete can decrement by the same delta. Null
          // per-100 g -> 0 (never invent). Mirrors web's FoodSearch
          // onSelect commit path byte-for-byte.
          const { caffeineMg, alcoholG } = scaleCaffeineAlcohol({
            grams,
            caffeineMgPer100g: result.macrosPer100g.caffeineMgPer100g ?? null,
            alcoholGPer100g: result.macrosPer100g.alcoholGPer100g ?? null,
          });
          const micros: Record<string, number> = {};
          if (caffeineMg > 0) micros.caffeineMg = caffeineMg;
          if (alcoholG > 0) micros.alcoholG = alcoholG;
          const meal: JournalMeal = {
            id: newMealId(),
            name: activeMealSlot,
            recipeTitle: result.name,
            time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
            calories: Math.round(result.macrosPer100g.calories * f),
            protein: Math.round(result.macrosPer100g.protein * f * 10) / 10,
            carbs: Math.round(result.macrosPer100g.carbs * f * 10) / 10,
            fat: Math.round(result.macrosPer100g.fat * f * 10) / 10,
            source,
            ...(Object.keys(micros).length > 0 ? { micros } : {}),
          };
          setByDay((prev) => ({
            ...prev,
            [dayKey]: [...(prev[dayKey] ?? []), meal],
          }));
          // F-13 — bump `profiles.extra_caffeine_by_day` /
          // `extra_alcohol_g_by_day` for this day. Fire-and-forget; a
          // failure here never rolls back the local log. The debounced
          // sync effect will upsert the meal row + its micros shortly.
          if (userId && (caffeineMg > 0 || alcoholG > 0)) {
            void updateStimulantsForDay(supabase, userId, dayKey, {
              caffeineMg,
              alcoholG,
            });
          }
          // L6 G1 (2026-04-18) — the Today FoodSearchModal commit was
          // the only `food_logged` emit site on mobile without a
          // source. Fire the canonical event with `custom_food` when
          // the hit is from the user's custom food library, otherwise
          // `manual` (USDA / Open Food Facts). Recipe-verify flows
          // that also mount this modal do NOT emit `food_logged` —
          // this host is the logging surface.
          try {
            track(AnalyticsEvents.food_logged, {
              source: result.source === "CUSTOM" ? "custom_food" : "manual",
              calories: meal.calories,
              slot: activeMealSlot,
            });
          } catch { /* noop */ }
          setSearchOpen(false);
        }}
        onClose={() => setSearchOpen(false)}
      />

      {/* Barcode scanner */}
      <BarcodeScannerModal
        visible={barcodeOpen}
        onScan={(_code: string, product) => {
          setBarcodeOpen(false);
          // F-13 (2026-04-19) — auto-track caffeine + alcohol from the
          // scaled scanned product. `product.servingSizeG` already holds
          // the grams the scanner dialog used; fall back to 100 g only
          // if it is missing. Per-100 g caffeine/alcohol came straight
          // from OFF via `lookupBarcode`.
          const productGrams =
            typeof product.servingSizeG === "number" && product.servingSizeG > 0
              ? product.servingSizeG
              : 100;
          const { caffeineMg, alcoholG } = scaleCaffeineAlcohol({
            grams: productGrams,
            caffeineMgPer100g: product.caffeineMgPer100g ?? null,
            alcoholGPer100g: product.alcoholGPer100g ?? null,
          });
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
              ...(caffeineMg > 0 ? { caffeineMg } : {}),
              ...(alcoholG > 0 ? { alcoholG } : {}),
            },
          };
          setByDay((prev) => ({
            ...prev,
            [dayKey]: [...(prev[dayKey] ?? []), meal],
          }));
          // F-13 — bump daily caffeine / alcohol totals on profiles.
          if (userId && (caffeineMg > 0 || alcoholG > 0)) {
            void updateStimulantsForDay(supabase, userId, dayKey, {
              caffeineMg,
              alcoholG,
            });
          }
          track(AnalyticsEvents.food_logged, { source: "barcode", slot: activeMealSlot });
          Alert.alert("Logged", `${product.name} added to ${activeMealSlot}.`);
        }}
        onClose={() => setBarcodeOpen(false)}
      />

      {/* Quick add panel — Favourites / Frequent / Recent / My meals.
          All tab logic lives in the shared `QuickAddPanel` render-only
          component (audit H1, 2026-04-18) which consumes
          `src/lib/nutrition/{foodHistory,favoriteFoods,savedMeals,savedMealsLogic}`.
          The host owns the full-screen chrome, logging pipeline, and
          `SaveMealSheet`. */}
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
          <QuickAddPanel
            byDay={byDay}
            activeSlot={activeMealSlot}
            supabase={supabase}
            userId={userId ?? ""}
            onLog={(item) => {
              logHistoryItemToSlot(item, activeMealSlot);
              setShowPrevious(false);
            }}
            onLogSavedMeal={(meal, slot) => logSavedMealFromPanel(meal, slot)}
            onOpenSaveCombo={(slot) => {
              if (slot) openSaveMealSheetForSlot(slot);
            }}
            savedMealsRefreshToken={savedMealsRefreshToken}
          />
        </View>
      )}

      {/* Save-as-usual-meal sheet (Batch 2.6; Ship M1 copy rename). */}
      <SaveMealSheet
        visible={saveMealSheetOpen}
        onClose={() => setSaveMealSheetOpen(false)}
        initialItems={saveMealSheetItems}
        defaultSlot={saveMealSheetDefaultSlot}
        suggestedName={
          saveMealSheetDefaultSlot
            ? `My usual ${saveMealSheetDefaultSlot.toLowerCase()}`
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

      <TodayNutrientsModal
        visible={nutrientsModalOpen}
        onClose={() => setNutrientsModalOpen(false)}
        rows={dayNutrientDetailRowsWithoutMacroDupes}
        backgroundColor={colors.background}
        cardColor={colors.card}
        cardBorderColor={colors.cardBorder}
        textColor={colors.text}
        textSecondaryColor={colors.textSecondary}
        textTertiaryColor={colors.textTertiary}
      />

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

      {/* M2 (2026-04-18) — in-flow AI paywall. Mirrors web
          `AiPaywallDialog`. Primary CTA routes to `/paywall?from=...`
          so the full-route commercial surface stays reachable. */}
      <AiPaywallSheet
        visible={aiPaywall.open}
        feature={aiPaywall.feature}
        onClose={() => setAiPaywall((s) => ({ ...s, open: false }))}
        onSeePlans={(feature) => {
          setAiPaywall((s) => ({ ...s, open: false }));
          router.push(`/paywall?from=${feature}` as any);
        }}
        colors={{
          text: colors.text,
          textSecondary: colors.textSecondary,
          card: colors.card,
          border: colors.border,
          background: colors.background,
        }}
      />
    </View>
  );
}

