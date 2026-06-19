import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/auth";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useHealthSyncOnFocus } from "@/hooks/useHealthSyncOnFocus";
import { mergeJournalByDay } from "@suppr/nutrition-core/mergeJournalByDay";
import { subscribeJournalRefresh } from "@/lib/journalRefresh";
import { useEntranceAnimation } from "@/hooks/useEntranceAnimation";
import ReAnimated from "react-native-reanimated";
import { useNutritionEntriesSync } from "@/hooks/useNutritionEntriesSync";
import { useTrackingExtrasOnFocus } from "@/hooks/useTrackingExtrasOnFocus";
import { useLogSheetDeepLinks } from "@/hooks/useLogSheetDeepLinks";
import {
  dateKeyFromDate,
  newMealId,
  normalizeJournalSlotName,
  parseNutritionMicrosJson,
  type ByDay,
  type JournalMeal,
} from "@/lib/nutritionJournal";
import {
  buildNutritionEntryRow,
  buildNutritionEntryUpdatePayload,
} from "@/lib/nutritionEntryRow";
import {
  buildDayNutrientDetailRows,
  formatMealNutritionMultiline,
  mealContributedFiberG,
  sumMicrosFromLoggedMeals,
} from "@/lib/healthDietaryNutrients";
import { supabase } from "@/lib/supabase";
// ENG-73 (2026-05-13): Today moved off `@expo/vector-icons`
// (Ionicons) to lucide-react-native to bring the screen's supporting
// glyphs in line with the prototype carryover rule #2 (icons must be
// the exact lucide set, not approximations). The macro-tile glyphs
// (Beef / Wheat / Droplets / Leaf) already used lucide — these six
// were the leftover supporting icons on Today.
import {
  AlertCircle,
  CheckCircle2,
  CloudOff,
  X,
} from "lucide-react-native";
import { Accent, Spacing, Radius, Type } from "@/constants/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { Layout } from "@/constants/layout";
import FoodSearchModal, { type SelectedFood as FoodSearchSelectedFood } from "@/components/FoodSearchModal";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import { TodayLoadingSkeleton } from "@/components/today/TodayLoadingSkeleton";

import DayStrip from "@/components/charts/DayStrip";
import JournalDatePickerModal from "@/components/JournalDatePickerModal";
import CopyMealSheet from "@/components/CopyMealSheet";
import DuplicateDaySheet from "@/components/DuplicateDaySheet";
import VoiceLogSheet from "@/components/VoiceLogSheet";
import PhotoLogSheet from "@/components/PhotoLogSheet";
import AiPaywallSheet, { type AiPaywallFeature } from "@/components/AiPaywallSheet";
import { computeLoggingStreak } from "@/lib/trackerStats";
import {
  computeActivityBonusKcal,
  computeProjectedActivityBonusKcal,
} from "@suppr/nutrition-core/activityBonus";
import { countWeighInDaysInWindow } from "@suppr/nutrition-core/weighInDays";
import { scaleMacroTargetsForCalorieBudget } from "@suppr/nutrition-core/scaleMacroTargetsForCalorieBudget";
import {
  resolvePlannedMealLogTitles,
} from "@suppr/nutrition-core/resolveRecipeLogTitles";
import { fetchMobileCanonicalRecipeTitle } from "@/lib/recipeTitleLookup";
import { foodSelectionAnalyticsSource, foodSelectionToMealMacros } from "@suppr/nutrition-core/foodSelectionToMeal";
import { ACTIVITY_BUDGET_DISCOVERABILITY_KEY } from "@suppr/nutrition-core/activityBudgetDiscoverability";
import {
  availableFreezes,
  computeProtectedStreak,
  readFreezeLedger,
  type FreezeLedger,
} from "@/lib/streakFreeze";
import { didStreakReset } from "@suppr/nutrition-core/streakReset";
import {
  isBelowMealsPromptVisible,
} from "@suppr/shared/today/belowMealsPromptSelection";
import {
  todayGreeting,
  todayLongDateSubline,
  todayPastDayGreetingLines,
} from "@suppr/shared/copy/today";
import {
  normalizeWeekSummaryMode,
  weekSummaryDateKeys,
  type WeekSummaryMode,
} from "@suppr/nutrition-core/weekSummaryWindow";
import { getYesterdayMeals } from "@suppr/nutrition-core/copyYesterdayMeals";
import {
  MISSED_YESTERDAY_COPY,
  shouldShowMissedYesterday,
} from "@suppr/nutrition-core/missedYesterday";
import {
  enabledMealSlotLabels,
  parseUserMealSlotConfig,
  type UserMealSlotConfig,
} from "@suppr/nutrition-core/userMealSlotConfig";
import { parseMealDescriptionTranscript } from "@suppr/nutrition-core/parseMealDescription";
import { track, isFeatureEnabled } from "@/lib/analytics";
import {
  compareMealsByChronology,
  defaultEatenAtForNewLog,
  formatMealTimeFromChronology,
  localTimeInputValueFromIso,
  nutritionEntryDateKeyAndEatenAt,
  parseLocalTimeInput,
  reanchorMealEatenAt,
} from "@suppr/nutrition-core/mealEatenAt";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { findPlanDayIdForCalendarDate } from "@suppr/shared/mealPlan/planCalendarAnchor";
import { readActiveCloudMealPlanSlotId } from "@/lib/activeMealPlanSlot";
import { coerceMacrosWhenCaloriesButNoGrams } from "@suppr/nutrition-core/coerceRecipeMacrosForPlanning";
import { fetchPlannedMealMicros, type SupabaseLike } from "@suppr/shared/planning/plannedMealMicros";
import {
  refreshAdaptiveTdeeForUser,
  scheduleAdaptiveTdeeRefresh,
} from "@/lib/refreshAdaptiveTdee";
import { snapshotDailyTargetIfMissing } from "@suppr/nutrition-core/dailyTargetSnapshot";
import { refreshExpoPushTokenIfChanged , registerExpoPushTokenForUser } from "@/lib/expoPushToken";
import { subscribeOffline } from "@/lib/subscribeOffline";
import { flushJournalWriteQueue, reconcileQueueAfterFlush } from "@suppr/nutrition-core/flushJournalWriteQueue";
import { enqueueJournalUpserts } from "@suppr/nutrition-core/journalWriteQueue";
import {
  loadJournalWriteQueue,
  saveJournalWriteQueue,
} from "@/lib/journalWriteQueueStorage";
import { NUTRITION_DEFAULTS, type NutritionDefaults } from "@/constants/nutritionDefaults";
import { calculateTDEE, maintenanceIntakeFromTargetCalories, resolveTargets } from "@/lib/calcTargets";
import { resolveMaintenance } from "@suppr/nutrition-core/resolveMaintenance";
import { MEASURED_TDEE_CHECK_IN_FLAG } from "@suppr/nutrition-core/measuredTdee";
import { syncHealthDataThrottled } from "@/lib/healthSync";
import { primeWrittenMealIds, writeMealToHealthKitIfEnabled } from "@/lib/healthKitMealWriter";
import { clampJournalDate } from "@/lib/journalNavigation";
import {
  computeRecentMeals,
  foodHistoryKey,
  isAiSourcedFoodHistoryItem,
  type FoodHistoryItem,
} from "@suppr/nutrition-core/foodHistory";
import { computeSlotGoToFoods } from "@suppr/nutrition-core/slotGoToFoods";
import { normaliseMealSlot } from "@suppr/nutrition-core/mealSlots";
import { isHealthImportFallbackTitle } from "@suppr/nutrition-core/healthImportLabels";
import { mapMealSourceToDot } from "@suppr/nutrition-core/sourceMap";
import { isMealSlot } from "@suppr/nutrition-core/mealSlots";
import { journalSlotFromMealTypes, slotForHour } from "@suppr/nutrition-core/recipeJournalSlot";
import {
  cloneMealWithoutId,
  sanitizeCopyTargets,
} from "@suppr/nutrition-core/copyMeals";
import {
  parseDayNumberMap,
} from "@suppr/nutrition-core/hydrationStimulants";
import {
  QUICK_ADD_COLLAPSED_STORAGE_KEY,
  isHydrationCardVisible,
  isStepsCardVisible,
  parseQuickAddCollapsed,
  serializeQuickAddCollapsed,
} from "@suppr/nutrition-core/todayProgressiveDisclosure";
import { aiLoggingSourceLabel } from "@suppr/nutrition-core/aiLogging";
import { scaleCaffeineAlcohol } from "@suppr/nutrition-core/scaleCaffeineAlcoholForGrams";
import { scaleLoggedMealFiberAndMicros } from "@suppr/nutrition-core/scaleLoggedMealPortion";
import { scaleMicrosForGrams } from "@suppr/shared/openFoodFacts/parseOffMicros";
import { HydrationStimulantsCard } from "@/components/HydrationStimulantsCard";
import SaveMealSheet from "@/components/SaveMealSheet";
import QuickAddPanel from "@/components/QuickAddPanel";
import {
  createSavedMeal,
  incrementLogCount,
  listSavedMeals,
  type SavedMeal,
  type SavedMealItem,
} from "@suppr/nutrition-core/savedMeals";
import {
  buildMealEntriesFromSavedMeal,
} from "@suppr/nutrition-core/savedMealsLogic";
import {
  addFavorite,
  favoriteKey as favoriteFoodKey,
  listFavorites,
  removeFavorite,
  type FavoriteFood,
} from "@suppr/nutrition-core/favoriteFoods";
import {
  parseDismissedSlots,
  serializeDismissedSlots,
  shouldShowUsualMealHint,
  USUAL_MEAL_HINT_STORAGE_KEY,
} from "@suppr/nutrition-core/usualMealHint";
import {
  PENDING_USUAL_MEAL_SAVE_KEY,
  parsePendingUsualMealSave,
} from "@suppr/nutrition-core/pendingUsualMealSave";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PROFILE_TARGETS_DIRTY_KEY } from "@/lib/profileTargetsDirtyFlag";
import { useWinMoment } from "@/hooks/use-win-moment";
import { WinMomentPlayer } from "@/components/ui/WinMomentPlayer";
import { TodayHero } from "@/components/today/TodayHero";
import { WhyThisNumberSheet } from "@/components/today/WhyThisNumberSheet";
import { paceKgPerWeekFromPreset } from "@suppr/nutrition-core/whyThisNumber";
import { TodayFastingPill } from "@/components/today/TodayFastingPill";
// `LogFab` is retired on mobile (2026-04-30) — the centered raised
// Log button now lives inside the global `<SupprTabBar>` via
// `<LogTabBarButton>`. The component file is preserved (deferred
// deletion) for: (a) test history continuity in
// canonicalTodayPhase2.test.tsx, and (b) parity with the web
// `<LogFab>` import path while the web still ships its own FAB.
import { LogSheet } from "@/components/today/LogSheet";
import CreateCustomFoodSheet, { type CreateCustomFoodPayload } from "@/components/CreateCustomFoodSheet";
import { createCustomFood } from "@suppr/nutrition-core/customFoodsClient";
// TodayEatAgainBanner/Scroller retired (ENG-984, 2026-06-17). The Eat-again
// card was suppressed from Today on 2026-05-22 (v4) and never re-surfaced;
// the dead components + their dismiss/candidate plumbing are now removed.
import { WeeklyCheckinBanner } from "@/components/today/WeeklyCheckinBanner";
import {
  isCheckinBannerDismissed,
  markCheckinBannerDismissed,
} from "@/lib/weeklyCheckinBannerDismissal";
import { weekKeyFor as weekKeyForCheckin } from "@/lib/weeklyRecap";
import { TodayActivityCard } from "@/components/today/TodayActivityCard";
import { WhereThisComesFromSheet } from "@/components/today/WhereThisComesFromSheet";
import { loadHealthLastSyncedAt } from "@/lib/healthSyncMeta";
import { TodayWeekView } from "@/components/today/TodayWeekView";
import { TodayMealsSection } from "@/components/today/TodayMealsSection";
import { WeeklyInsightCard } from "@/components/today/WeeklyInsightCard";
import { TodayFirstMealEmptyState } from "@/components/today/TodayFirstMealEmptyState";
import { TodayActivityBonusCard } from "@/components/today/TodayActivityBonusCard";
import { TodayScrollSectionHeader } from "@/components/today/TodayScrollSectionHeader";
import { TodayCompleteDayModal } from "@/components/today/TodayCompleteDayModal";
// Weekly check-in ritual (PR claude/weekly-checkin-ritual-v2, 2026-05-02 —
// rebuild of #26). MacroFactor-style soft prompt that surfaces the
// adaptive-vs-formula TDEE delta + a suggested new daily target.
import { WeeklyCheckinModal } from "@/components/today/WeeklyCheckinModal";
import {
  buildWeeklyCheckinContent,
  shouldShowWeeklyCheckin,
  type WeeklyCheckinContent,
  type WeeklyCheckinConfidence,
} from "@/lib/weeklyCheckin";
// Phase 3 (B2.1, 2026-04-27) — TodayFabSheet replaced by LogSheet.
// The component file remains for any deep test references (sweep
// docs/journeys/log-sheet-2026-04-27.md for migration notes).
import { TodayEditMealModal } from "@/components/today/TodayEditMealModal";
import { SavedMealPortionSheet } from "@/components/today/SavedMealPortionSheet";
// TodayNutrientsModal replaced by FullNutrientPanelSheet on 2026-05-02
// (revert of PR #30). The Nutrients link in TodayDashboardMacroTiles
// now opens the richer Cronometer-parity panel from PR #47.
import { TodayDateHeader } from "@/components/today/TodayDateHeader";
import { GradientAvatar } from "@/components/GradientAvatar";
import { SloeHeaderWordmark } from "@/components/SloeHeaderWordmark";
import { TodayDashboardMacroTiles } from "@/components/today/TodayDashboardMacroTiles";
import { TodayDashboardMacroBars } from "@/components/today/TodayDashboardMacroBars";
import { useMacroDisplayStyle } from "@/lib/macroDisplayStyle";
import { FullNutrientPanelSheet } from "@/components/today/FullNutrientPanelSheet";
import { TodayQuickLogStrip } from "@/components/today/TodayQuickLogStrip";
import { TodaySnapShortcut } from "@/components/today/TodaySnapShortcut";
import { OnboardingNudgeBanner } from "@/components/today/onboarding-nudges";
// Activation hook (audit 2026-04-30) — first-log toast + push explainer.
import { FirstLogAcknowledgment } from "@/components/today/FirstLogAcknowledgment";
import { PostOnboardingPushExplainer } from "@/components/today/PostOnboardingPushExplainer";
// Phase 5 / B3.M (2026-04-27) — wire the NorthStarBlockHost on Today.
import { NorthStarBlockHost } from "@/components/today/NorthStarBlockHost";
import { useSavedLibraryRecipes } from "@/lib/recipes";
import { TodayDeficitInsight } from "@/components/today/TodayDeficitInsight";
import { TodayPlannedMealsCard } from "@/components/today/TodayPlannedMealsCard";
import { TodayCompleteDayButton } from "@/components/today/TodayCompleteDayButton";
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
 *   bonus = max(0, projected_EOD_burn − maintenance)   (today)
 *   bonus = max(0, (resting + active) − maintenance)    (closed days)
 * Avoids double-counting since the calorie target already includes an activity estimate.
 * Fallback when no resting energy: logged workout calories only.
 *
 * Math lives in `src/lib/nutrition/activityBonus.ts` so web + mobile share
 * one source of truth. See
 * `docs/decisions/2026-05-13-activity-bonus-projected-eod-model.md`.
 */
function dayActivityBudgetAddon(
  prefer: boolean,
  _bonusOnly: boolean,
  activityByDay: Record<string, number>,
  basalByDay: Record<string, number>,
  maintenanceKcal: number,
  dk: string,
  workoutsByDay?: Record<string, { type: string; minutes: number; calories: number; source: string }[]>,
  maintenanceSource?: "measured" | "adaptive" | "formula" | null,
): number {
  const workouts = workoutsByDay?.[dk] ?? [];
  return computeActivityBonusKcal({
    prefer,
    maintenanceSource,
    dateKey: dk,
    todayDateKey: dateKeyFromDate(new Date()),
    restingKcal: basalByDay[dk] ?? 0,
    activeKcal: activityByDay[dk] ?? 0,
    maintenanceKcal,
    workoutKcal: workouts.reduce((s, w) => s + (w.calories ?? 0), 0),
  });
}

function pruneByDay<V>(map: Record<string, V>): Record<string, V> {
  const keys = Object.keys(map).sort().reverse().slice(0, MAX_JSONB_DAYS);
  const pruned: Record<string, V> = {};
  for (const k of keys) pruned[k] = map[k];
  return pruned;
}

function formatMealTimeDisplay(
  _time: string | undefined,
  createdAt?: string | null,
  eatenAt?: string | null,
): string {
  return formatMealTimeFromChronology({ eatenAt, createdAt });
}

// 2026-05-08 build-47 follow-up — Grace TF: tapping "+ Breakfast" in
// the afternoon was logging picks as Snacks. Two reasons: (1) the
// pick-handlers used `currentSlotFromTime` instead of `activeMealSlot`,
// and (2) generic FAB-open paths (deep-link, empty-state) didn't reset
// `activeMealSlot` to a fresh time-of-day default.
//
// ENG-773 (2026-05-30): the time-of-day bucketing now comes from
// `slotForHour` in the shared `recipeJournalSlot` lib (imported above),
// not a local copy. The useMemo + the two reset call-sites all call
// that one helper, so web and mobile seed the same slot for the same
// clock time (was 10/14/17 locally vs 11/15/17 shared — now 11/15/17
// everywhere).
export default function TrackerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    date?: string;
    _t?: string;
    editMealId?: string;
    openLog?: string;
    /** Activation hook (audit 2026-04-30): set by `notifications-prompt`
     *  + onboarding completion → triggers first-run polish (push
     *  explainer, ring celebration). */
    firstRun?: string;
    /** Onboarding completion routes through here so Today can show
     *  post-onboarding nudges. Older code path. */
    onboarding_complete?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  // ENG-1076 — declared here (above persistMealsImmediate /
  // persistMealUpdateImmediate) so their useCallback dependency arrays don't
  // reference it in the temporal dead zone. Hydrated from profiles.tz_iana in
  // the profile-load effect below.
  const [profileTimeZone, setProfileTimeZone] = useState<string | null>(null);
  // SLOE redesign (2026-06-03): the Today hero greeting uses the user's
  // first name when a REAL one is available on the auth session's
  // `user_metadata` (already loaded — no extra `profiles` read, which
  // would touch the data-flow this re-skin must not change). We do NOT
  // guess a name from the email local-part: a raw local-part like
  // "gracemturner" reads worse than a clean, name-free "Good evening".
  // So: real metadata name → "Morning, {first}"; otherwise → "Good
  // morning" (handled by `todayGreeting` when name is undefined).
  const greetingName = useMemo(() => {
    const meta = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const raw =
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      (typeof meta.first_name === "string" && meta.first_name) ||
      (typeof meta.preferred_name === "string" && meta.preferred_name) ||
      "";
    const first = raw.trim().split(/\s+/)[0];
    return first || undefined;
  }, [session?.user?.user_metadata]);
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the Today CTAs:
  // the add-food submit, the offline pill (border + icon), Complete Day, and
  // the Quick-add "Logging to <slot>" caption. The plum Log FAB, meal-slot
  // tints, macro/status hues, and source/confidence dots keep their own
  // tokens. Threaded into the `styles` useMemo (deps include `accent`) so the
  // StyleSheet members that paint the accent flip with the flag.
  const accent = useAccent();
  // `styles.card` is the Today top-level resting-card style — it sits on the
  // page (scroll) ground, so it takes the soft lift (one-treatment, Grace
  // 2026-06-09). Nested/inset surfaces draw their own hairline, never this.
  const cardElevation = useCardElevation({ variant: "soft" });
  // User-configurable macro display variant (Settings → Display →
  // Macro display). `tiles` (default) keeps the 2×2 grid; `bars`
  // renders a vertical list of name + value/target + colored bar.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [macroDisplayStyle] = useMacroDisplayStyle();

  const [byDay, setByDay] = useState<ByDay>({});
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ENG-798 (Design Direction 2026) — the quiet daily-commit confirm haptic.
  // Provided by `useWinMoment` (defined far below in this component, after the
  // snapshot it needs is computed), so we reach it through a ref: every
  // log-meal entry point funnels through `persistMealsImmediate`, and firing
  // the haptic there gives ONE confirm beat per durable commit (no per-call-
  // site duplication, no double-buzz). The haptic itself is gated behind
  // `redesign_motion` inside the hook — flag-off keeps today's silent log.
  const confirmLogHapticRef = useRef<() => void>(() => {});

  /**
   * 2026-05-08 data-loss hotfix — fire-and-forget immediate persist of
   * one or more newly-logged meals to `nutrition_entries`. Pre-fix, all
   * the "log a meal" entry-points (addMeal / quickAddMeal / search /
   * saved-meal / barcode / AI commit) wrote ONLY to local `byDay`
   * state and relied on the 600ms debounced upsert further down to
   * drain to Supabase. That timer's cleanup cancels the sync any
   * time `byDay`/`selectedDate`/userId/hydrated change before it
   * fires — including app backgrounding, day navigation, or even a
   * follow-up state mutation. ~25 days of journal data was lost on
   * Grace's TestFlight reinstall because of this.
   *
   * Post-fix: every add-meal call site now calls this primitive
   * IMMEDIATELY after its `setByDay` (no debounce). On error we roll
   * back the optimistic UI and surface an Alert — same shape as the
   * existing `insertClonedRowsIntoDay` and `logPlannedMealWithPortion`
   * paths that already worked correctly.
   *
   * The 600ms debounced effect stays as a backstop (cheap re-upsert
   * of the current day on every render), but is no longer the only
   * path to durable storage.
   */
  const persistMealsImmediate = useCallback(
    async (targetDayKey: string, meals: JournalMeal[]): Promise<boolean> => {
      if (meals.length === 0) return true;
      if (!userId) {
        console.warn(
          "[tracker] persistMealsImmediate called without userId — meals not persisted",
        );
        return true;
      }
      // ENG (launch-audit P1-2) — single shared row-builder so this
      // immediate path and the 600ms backstop (`useNutritionEntriesSync`)
      // can never diverge on the `eaten_at` / `date_key` column set.
      const dbRows = meals.map((m) =>
        buildNutritionEntryRow(m, targetDayKey, userId, profileTimeZone),
      );
      // Upsert (not insert) so a race with the 600ms debounced journal sync
      // never throws duplicate-key and rolls back an optimistic log.
      const { error } = await supabase
        .from("nutrition_entries")
        .upsert(dbRows, { onConflict: "id" });
      if (error) {
        console.error("[tracker] persistMealsImmediate failed:", error.message);
        // ENG-1125 — queue for retry; keep optimistic rows visible.
        const queue = await loadJournalWriteQueue();
        await saveJournalWriteQueue(
          enqueueJournalUpserts(
            queue,
            targetDayKey,
            dbRows as ReadonlyArray<Record<string, unknown>>,
          ),
        );
        Alert.alert(
          "Saved on this device",
          "We'll sync this log when you're back online.",
        );
        return false;
      }
      // ENG-798 — the meal is durably saved: fire ONE quiet confirm haptic for
      // the commit (gated behind `redesign_motion` in the hook). The loud
      // SUCCESS notification stays reserved for the win-moment landmark, which
      // `useWinMoment` fires on its own beat when the calorie/macro goal is hit.
      confirmLogHapticRef.current();
      // Defer the heavy all-entries TDEE read so it cannot race food-search
      // network streams on the same commit beat (native dev-client crash).
      scheduleAdaptiveTdeeRefresh(supabase, userId);
      return true;
    },
    [profileTimeZone, userId],
  );

  const flushQueuedJournalWrites = useCallback(async () => {
    if (!userId) return;
    const queue = await loadJournalWriteQueue();
    if (queue.entries.length === 0) return;
    const result = await flushJournalWriteQueue(supabase, queue);
    // Re-load to capture any row enqueued during the flush round-trip, then
    // reconcile rather than blind-overwrite (ENG-1125 data-loss fix).
    const latest = await loadJournalWriteQueue();
    await saveJournalWriteQueue(reconcileQueueAfterFlush(queue, latest, result));
    if (result.flushedIds.length > 0) {
      scheduleAdaptiveTdeeRefresh(supabase, userId);
    }
  }, [userId]);

  /**
   * 2026-05-08 data-loss hotfix — sister primitive for `saveEditMeal`.
   * Pre-fix, edit-save mutated `byDay` only and relied on the same
   * fragile debounce. Post-fix: immediate UPDATE on the relational
   * row, scoped to (id, user_id) to satisfy RLS.
   */
  const persistMealUpdateImmediate = useCallback(
    async (mealId: string, updated: JournalMeal, dateKey: string): Promise<boolean> => {
      if (!userId) return true;
      // ENG (launch-audit P1-1) — shared builder mirrors persistMealsImmediate's
      // column set + `eaten_at` / `date_key` derivation. `updated.eatenAt` already
      // carries any time-edit the user made (saveEditMeal clamps it to the anchor
      // day via the same helper), so no `localTime` override is passed here.
      const { error } = await supabase
        .from("nutrition_entries")
        .update(buildNutritionEntryUpdatePayload(updated, dateKey, null, profileTimeZone))
        .eq("id", mealId)
        .eq("user_id", userId);
      if (error) {
        console.error(
          "[tracker] persistMealUpdateImmediate failed:",
          error.message,
        );
        const row = buildNutritionEntryRow(updated, dateKey, userId, profileTimeZone);
        const queue = await loadJournalWriteQueue();
        await saveJournalWriteQueue(
          enqueueJournalUpserts(
            queue,
            dateKey,
            [row] as ReadonlyArray<Record<string, unknown>>,
          ),
        );
        Alert.alert(
          "Saved on this device",
          "We'll sync this log when you're back online.",
        );
        return false;
      }
      return true;
    },
    [profileTimeZone, userId],
  );
  // Pattern #9 (`AN8GJ1Dr3M` + F-131 `AMmlpVOqMnaKKdV2dobjjjg`, 2026-05-08):
  // WhereThisComesFromSheet visibility + last-sync timestamp. One sheet
  // shared across the activity card + burn card; the context decides
  // headline + range copy. `null` = closed.
  const [provenanceContext, setProvenanceContext] = useState<"activity" | "burn" | null>(null);
  const [healthLastSyncedAtMs, setHealthLastSyncedAtMs] = useState<number | null>(null);
  // 2026-05-13 (TF feedback `AKmYHgZ7WA9uUUOSbjPtL2U`):
  // pull-to-refresh state for the Today ScrollView's RefreshControl.
  const [isPullToRefreshing, setIsPullToRefreshing] = useState(false);
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
  // Canonical 2026-05-22 C1: multi-ring removed entirely. Inner macro
  // SLOE redesign (2026-06-03): the canonical Sloe `01 · Today` hero is a
  // MULTI-ring — calories (outer plum) + protein/carbs/fat concentric
  // arcs. `ringExpanded` drives whether the inner macro arcs render, so
  // it now defaults to TRUE to match the frame (the macros are part of
  // the hero, not an opt-in reveal). The long-press still toggles it
  // (coupled with the display-mode flip) for users who want the calmer
  // calories-only view.
  // 2026-06-10 (Grace, round 2): the multi-ring WEIGHTS were right — the
  // single-ring collapse is reverted. The thing that read cheap was the
  // overage segment's colour discontinuity, fixed in the Skia layer's
  // continuous sweep gradient. Collapsed mode (via "Hide macro rings")
  // keeps the bold single-ring stroke.
  const [ringExpanded, setRingExpanded] = useState(true);
  // SLOE redesign (2026-06-04, Grace "ring sub-label → budget left"): the
  // ring opens in *remaining* mode so the centre reads the budget left
  // ("1,633 / of 2,040 kcal", REMAINING) like the Figma 01 frame, not the
  // backward-looking "379 LOGGED". The Remaining/Consumed toggle still lets
  // the user flip to consumed.
  // Phase 3 (2026-04-28, D-2026-04-27-03 finished): canonical Today is
  // the ring hero. The 3-variant picker (ring / bar / number) was
  // removed in this phase — TodayHero is now a thin wrapper around
  // TodayHeroRing and the TodayHeroBar / TodayHeroNumber /
  // TodayHeroVariantPicker components were deleted. See
  // `docs/ux/teardown-2026-04-28-daily-loop.md` Top-5 #1 for context.
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
  const [userMealSlotConfig, setUserMealSlotConfig] = useState<UserMealSlotConfig | null>(null);
  const MEAL_SLOTS = useMemo(
    () => enabledMealSlotLabels(userMealSlotConfig),
    [userMealSlotConfig],
  );
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  /**
   * F-156 PR-2 (2026-05-10) — barcode-not-found → "Add as custom food"
   * handoff state. Carries the scanned barcode forward to the
   * CreateCustomFoodSheet so the saved row's `barcode` column is set
   * and the next scan resolves successfully.
   */
  const [customFoodFromBarcode, setCustomFoodFromBarcode] = useState<string | null>(null);
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
  // Phase 2 / B1.4 (D-2026-04-27-08) — caffeine + alcohol opt-in.
  // Default OFF. Hydration stays as it's a near-universal target.
  // Prefs are AsyncStorage-only (no schema change for Phase 2);
  // Settings → "Tracking extras" surfaces the toggles. When false,
  // the corresponding row in HydrationStimulantsCard hides via the
  // existing `targets.caffeineMg === 0` / `targets.alcoholGWeekly
  // === 0` rule — we just force the target prop to 0 at the call
  // site. Existing data is preserved (no DB writes).
  // 2026-05-16 — extracted to `hooks/useTrackingExtrasOnFocus`
  // (Today split #4). Same re-read-on-focus contract that closed the
  // P0-3 (2026-04-28) stale-prefs regression. Setters live inside the
  // hook; parent reads the two booleans.
  const { trackCaffeine, trackAlcohol } = useTrackingExtrasOnFocus();
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [activityBurnByDay, setActivityBurnByDay] = useState<Record<string, number>>({});
  const [workoutsByDay, setWorkoutsByDay] = useState<Record<string, { type: string; minutes: number; calories: number; source: string }[]>>({});
  const [basalBurnByDay, setBasalBurnByDay] = useState<Record<string, number>>({});
  const [preferActivityAdjustedCalories, setPreferActivityAdjustedCalories] = useState(false);
  /** surplus-only: add only burn above maintenance TDEE (needs resting + active from Health). */
  const [activityBonusCaloriesOnly, setActivityBonusCaloriesOnly] = useState(false);
  // P3-30 (2026-04-25): net-carbs lens. Source of truth:
  // `profiles.net_carbs_lens_enabled`. Tracker macro tile swaps "Carbs"
  // → "Net carbs" via the shared netCarbs.ts helper.
  const [netCarbsLensEnabled, setNetCarbsLensEnabled] = useState(false);
  const [nutrientsModalOpen, setNutrientsModalOpen] = useState(false);
  const [dailyStepsGoal, setDailyStepsGoal] = useState(NUTRITION_DEFAULTS.steps);
  const [plannedMeals, setPlannedMeals] = useState<{name?: string; recipe_title?: string; calories?: number; protein?: number; carbs?: number; fat?: number; recipe_id?: string | null}[]>([]);
  const [activeFastStart, setActiveFastStart] = useState<string | null>(null);
  // Target fast length in hours, parsed from `profiles.fasting_window`
  // (stored as "16:8" style). Defaults to 16 until the profile loads.
  // Used by the widget snapshot so the iOS widget shows the correct ring.
  const [fastTargetHours, setFastTargetHours] = useState<number>(16);
  // F-109 (TestFlight `AFHtAQRAWad1w8bDvSgZkUg`, 2026-05-06): the
  // idle-state "Start fast" pill on Today is gated on the user having
  // opted in to intermittent fasting (Grace, 2026-05-07). The proxy
  // signal is `profiles.fasting_window != null` — the column is set
  // only after the user picks a window on /fasting or in settings.
  // Non-IF users see no pill at all.
  const [fastingOptedIn, setFastingOptedIn] = useState<boolean>(false);
  const [fabSheetOpen, setFabSheetOpen] = useState(false);
  const [logSheetConfirmation, setLogSheetConfirmation] = useState<
    NonNullable<React.ComponentProps<typeof LogSheet>["confirmation"]> | null
  >(null);
  const [logBasket, setLogBasket] = useState<
    Array<{ basketId: string; selection: FoodSearchSelectedFood }>
  >([]);
  useEffect(() => {
    if (!fabSheetOpen) {
      setLogSheetConfirmation(null);
      setLogBasket([]);
    }
  }, [fabSheetOpen]);
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
  const [editEatenAtTime, setEditEatenAtTime] = useState("12:00");
  // ENG-783 — saved-meal portion-confirm sheet (opened from QuickAdd ⋮
  // "Log with portion…"). Null meal = closed.
  const [portionMeal, setPortionMeal] = useState<SavedMeal | null>(null);
  const [portionSlot, setPortionSlot] = useState("Snacks");
  const waterActivityInitialLoadDone = useRef(false);
  const editCanonicalRef = useRef({ cal: 0, p: 0, cb: 0, f: 0 });
  // 2026-05-15 (ENG-543): dedup parallel `loadJournal` calls — see fn.
  const loadJournalInFlightRef = useRef(false);
  const [fastingTick, setFastingTick] = useState(Date.now());
  const [isOffline, setIsOffline] = useState(false);
  const [targetCelebration, setTargetCelebration] = useState(false);
  const [completeDayOpen, setCompleteDayOpen] = useState(false);
  const [whySheetOpen, setWhySheetOpen] = useState(false);
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
  const [measuredTdee, setMeasuredTdee] = useState<number | null>(null);
  const [measuredTdeeConfidence, setMeasuredTdeeConfidence] = useState<string | null>(null);
  const [measuredTdeeUpdatedAt, setMeasuredTdeeUpdatedAt] = useState<string | null>(null);
  // Weekly TDEE check-in ritual (PR claude/weekly-checkin-ritual-v2,
  // 2026-05-02 — rebuild of #26). The MacroFactor-style modal that
  // surfaces the adaptive-vs-formula TDEE delta once a week. Gating +
  // content build live in `src/lib/nutrition/weeklyCheckin.ts`. State
  // is hydrated alongside the other profile fields below; the show
  // effect runs once on first eligible Today first-load. Modal NEVER
  // blocks — every dismiss path persists the decision and clears the
  // open state.
  const [weeklyCheckinShownAt, setWeeklyCheckinShownAt] = useState<string | null>(null);
  const [weeklyCheckinOpen, setWeeklyCheckinOpen] = useState(false);
  const [weeklyCheckinContent, setWeeklyCheckinContent] =
    useState<WeeklyCheckinContent | null>(null);
  // ENG-805 (Redesign — Design Direction 2026): when `redesign_winmoment` is
  // ON the weekly check-in is NOT auto-opened as a cold-open blocking modal —
  // the in-feed `WeeklyCheckinBanner` (→ /weekly-recap) is the non-blocking
  // entry point. Flag-OFF preserves the auto-opening modal (both the gate at
  // the eligibility effect and the modal render below are guarded by this).
  const checkinAsCard = isFeatureEnabled("redesign_winmoment");
  // ENG-1099 M1 — unify the Today scroll rhythm to one 24 cadence (the
  // recipe-body grammar): the inter-block scroll gap becomes Spacing.xl and the
  // 32 section-break margins collapse to 0, so blocks breathe at one rhythm
  // instead of 8/32 stacking. Flag-off keeps the legacy 8 gap + 32 breaks.
  const tierV1 = isFeatureEnabled("today_tracker_tier_v1");
  const weeklyCheckinHandledRef = useRef(false);
  const [profileWeightKgByDay, setProfileWeightKgByDay] = useState<Record<string, number>>({});
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

  // Launch queue #8 / ENG-1061 / PR #391 — all three LogSheet deep-link /
  // dismissal behaviours (open on `?openLog=1` + clear, dismiss on in-tab
  // date/editMealId without openLog, dismiss on tab blur) live in the
  // extracted, unit-tested hook. The `?openLog=1` consumer resets
  // activeMealSlot to time-of-day (build-47) and clears the consumed
  // params after open so back-nav doesn't re-open the sheet.
  useLogSheetDeepLinks({
    params,
    setFabSheetOpen,
    setActiveMealSlot,
    clearOpenLogParams: useCallback(
      () =>
        router.setParams({ openLog: undefined, _t: undefined } as Record<
          string,
          undefined
        >),
      [router],
    ),
  });

  // 2026-05-12 round 4 (Grace TF) — the `?openWhy=1` deep-link is
  // gone. ENG-1184 re-hosts WhyThisNumber on Today via the status chip;
  // `/targets` still owns the "How is this calculated?" row.

  useEffect(() => {
    void flushQueuedJournalWrites();
    return subscribeOffline((offline) => {
      setIsOffline(offline);
      if (!offline) void flushQueuedJournalWrites();
    });
  }, [flushQueuedJournalWrites]);

  // P3-30 (2026-04-25): one-shot fetch of the net-carbs lens flag.
  // Re-fires when the user changes; stays in local state until next
  // mount or focus. Defaulting to false on any error preserves the
  // current "Carbs" display.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("net_carbs_lens_enabled")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      setNetCarbsLensEnabled(Boolean((data as { net_carbs_lens_enabled?: boolean } | null)?.net_carbs_lens_enabled));
    })().catch(() => { /* noop — preserve default */ });
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  // Quick add panel — state/handlers live in `QuickAddPanel.tsx` (shared
  // render-only wrapper around the nutrition helpers). The host still owns
  // the SaveMealSheet and drives the refresh token after a new saved meal
  // is persisted.
  //
  // Ship M1 (2026-04-18) — the host also owns the full saved-meals list
  // so the meal-slot section can render the `Log usual` pill directly.
  const [saveMealSheetOpen, setSaveMealSheetOpen] = useState(false);
  const [saveMealSheetItems, setSaveMealSheetItems] = useState<Omit<SavedMealItem, "id" | "position">[]>([]);
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
         
        console.warn("Today listSavedMeals failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, savedMealsRefreshToken]);

  /** Favourites-in-search (teardown #1, ENG-1041) — the user's starred foods,
   *  loaded once and threaded into the LogSheet's inline FoodSearchPanel so
   *  favourites surface IN search (a "Favourites" group + favourites-first in
   *  the Recent strip + a per-row star toggle). The same `user_favorite_foods`
   *  model QuickAddPanel uses; the host owns the list here because the LogSheet
   *  is a host-owned surface. */
  const [hostFavorites, setHostFavorites] = useState<FavoriteFood[]>([]);
  const [favoritePendingKeys, setFavoritePendingKeys] = useState<Set<string>>(
    () => new Set(),
  );
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setHostFavorites([]);
      return;
    }
    listFavorites(supabase, userId)
      .then((rows) => {
        if (!cancelled) setHostFavorites(rows);
      })
      .catch((err) => {
        console.warn("Today listFavorites failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Optimistic star/unstar from a food-search row. Mirrors QuickAddPanel's
   *  `toggleFavorite`: add/remove immediately, revert on Supabase failure,
   *  guard double-submit via `favoritePendingKeys`. */
  const toggleFoodFavorite = useCallback(
    async (food: {
      recipeTitle: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      source?: string;
      favoriteId?: string;
    }) => {
      if (!userId) {
        Alert.alert("Sign in", "Sign in to save favourites.");
        return;
      }
      const key = favoriteFoodKey(food.recipeTitle, food.calories);
      if (favoritePendingKeys.has(key)) return;
      setFavoritePendingKeys((s) => new Set(s).add(key));
      const snapshot = hostFavorites;
      const wasStarred = Boolean(food.favoriteId);
      try {
        if (wasStarred && food.favoriteId) {
          setHostFavorites((prev) => prev.filter((f) => f.id !== food.favoriteId));
          await removeFavorite(supabase, userId, food.favoriteId);
        } else {
          const tempId = `temp-${key}`;
          const optimistic: FavoriteFood = {
            id: tempId,
            recipeTitle: food.recipeTitle,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            ...(food.fiber != null ? { fiber: food.fiber } : {}),
            ...(food.source ? { source: food.source } : {}),
            count: 1,
            createdAt: new Date().toISOString(),
          };
          setHostFavorites((prev) => [optimistic, ...prev]);
          const saved = await addFavorite(supabase, userId, {
            recipeTitle: food.recipeTitle,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            fiber: food.fiber,
            source: food.source ?? null,
          });
          setHostFavorites((prev) => [saved, ...prev.filter((f) => f.id !== tempId)]);
        }
      } catch (err) {
        setHostFavorites(snapshot);
        Alert.alert(
          wasStarred ? "Could not remove favourite" : "Could not save favourite",
          "Please try again.",
        );
        console.warn("Today food favourite toggle failed", err);
      } finally {
        setFavoritePendingKeys((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
      }
    },
    [userId, hostFavorites, favoritePendingKeys, supabase],
  );

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

  /**
   * Phase 5 (2026-04-30) — AI-first-log tooltip gate. Replaces the
   * per-day "Includes N AI-estimated meals" sentinel that used to
   * render inside `TodayHero`. customer-lens flagged the daily
   * caption as a defensive disclaimer that contradicted the
   * 2026-04-27 strategic direction (macro-tracker-first, not AI-
   * first). The replacement: one tooltip below the user's first AI-
   * sourced meal row ever, then never again.
   *
   * Three states:
   *   - `null` (initial): AsyncStorage hasn't hydrated yet — render
   *     no tooltip. Avoids a flash when the storage key is set.
   *   - `false`: storage says we have NOT shown the tooltip yet —
   *     the first AI-sourced meal row will trigger it.
   *   - `true`: we have shown the tooltip already (or the user just
   *     dismissed it this session) — never show again.
   */
  const AI_TOOLTIP_STORAGE_KEY = "suppr.ai-explainer-shown.v1";
  const [aiTooltipShown, setAiTooltipShown] = useState<boolean | null>(null);
  const [activityBudgetDiscoverDismissed, setActivityBudgetDiscoverDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(AI_TOOLTIP_STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setAiTooltipShown(raw != null);
      })
      .catch(() => {
        if (!cancelled) setAiTooltipShown(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ACTIVITY_BUDGET_DISCOVERABILITY_KEY)
      .then((raw) => {
        if (!cancelled) setActivityBudgetDiscoverDismissed(raw != null);
      })
      .catch(() => {
        if (!cancelled) setActivityBudgetDiscoverDismissed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissActivityBudgetDiscover = useCallback(() => {
    setActivityBudgetDiscoverDismissed(true);
    void AsyncStorage.setItem(ACTIVITY_BUDGET_DISCOVERABILITY_KEY, "1").catch(() => {});
  }, []);

  const dismissAiFirstLogTooltip = useCallback(() => {
    setAiTooltipShown(true);
    void AsyncStorage.setItem(
      AI_TOOLTIP_STORAGE_KEY,
      new Date().toISOString(),
    ).catch(() => {
      /* storage denied — in-session state still hides the tooltip;
         worst case it shows again on next launch, never twice in
         the same session. */
    });
  }, []);

  // Activation hook (audit 2026-04-30 — leak fix #3): first-log toast.
  // ---------------------------------------------------------------
  // `firstLogAckShown`:
  //   - `null`: AsyncStorage read in flight.
  //   - `false`: storage says we have NOT acknowledged the first log.
  //     A 0→1 transition in `mealsToday.length` will trigger the toast.
  //   - `true`: already shown (or just dismissed this session).
  // The detection runs against a separate counter (`firstLogAckShown`)
  // rather than today's meal count alone — a returning user who already
  // saw the toast on day-1 must NOT re-trigger when their day-2 0→1
  // transition happens. The `false → true` transition is the one that
  // matters; once `true`, it stays `true` forever.
  const FIRST_LOG_ACK_STORAGE_KEY = "suppr.first-log-acknowledged.v1";
  const [firstLogAckShown, setFirstLogAckShown] = useState<boolean | null>(null);
  const [firstLogToastVisible, setFirstLogToastVisible] = useState(false);
  const firstLogPrevCountRef = useRef<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(FIRST_LOG_ACK_STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setFirstLogAckShown(raw != null);
      })
      .catch(() => {
        if (!cancelled) setFirstLogAckShown(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 2026-05-01 (journey-architect P1) — first-meal-empty-state IG/TT
   * tip dismissal. Persisted under a versioned AsyncStorage key. The
   * empty card itself is unconditional when zero today + zero history;
   * only the trailing IG/TT tip line is dismissable.
   */
  const FIRST_MEAL_TIP_DISMISSED_KEY = "suppr.first-meal-tip-dismissed.v1";
  const [firstMealTipDismissed, setFirstMealTipDismissed] = useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(FIRST_MEAL_TIP_DISMISSED_KEY)
      .then((raw) => {
        if (!cancelled) setFirstMealTipDismissed(raw != null);
      })
      .catch(() => {
        /* storage denied — keep tip visible, host re-renders correctly */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissFirstLogToast = useCallback(() => {
    setFirstLogToastVisible(false);
    setFirstLogAckShown(true);
    void AsyncStorage.setItem(
      FIRST_LOG_ACK_STORAGE_KEY,
      new Date().toISOString(),
    ).catch(() => {
      /* storage denied — session state hides; worst case it shows
         once more next launch, never twice this session. */
    });
  }, []);

  // Activation hook (audit 2026-04-30 — leak fix #4): post-onboarding
  // push-permission explainer. The MobilePermissionsStep was removed
  // from the linear onboarding flow in the 15→12 shrink; without
  // re-prompting elsewhere, push permission stays at the OS default
  // and no D1/D7/D30 retention nudge can deliver. We surface the
  // prompt as a single-screen explainer the first time Today renders
  // post-onboarding.
  //
  // Coordination with `OnboardingNudgeBanner` (commit c60af6d): this
  // explainer fires FIRST. The `permissions` nudge in that queue is
  // the recovery path for the case where the user dismissed THIS
  // prompt — same OS calls, lower priority on re-ask.
  const POST_ONB_PUSH_PROMPT_KEY = "suppr.post-onboarding-push-prompt.v1";
  const [postOnbPushVisible, setPostOnbPushVisible] = useState(false);
  const postOnbPushCheckedRef = useRef(false);
  useEffect(() => {
    if (postOnbPushCheckedRef.current) return;
    if (Platform.OS !== "ios") {
      // iOS-only by design — Android push prompts route through a
      // different OS path and aren't in scope for this fix. Mark the
      // check done so we don't re-evaluate.
      postOnbPushCheckedRef.current = true;
      return;
    }
    if (!userId) return;
    postOnbPushCheckedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const shown = await AsyncStorage.getItem(POST_ONB_PUSH_PROMPT_KEY);
        if (cancelled) return;
        if (shown === "shown") return;
        // Honour the user's onboarding-completed status. Tabs layout
        // already redirects users without onboarding completion to
        // /onboarding, so by the time we reach Today the user IS
        // post-onboarding. Belt-and-braces: read `profiles.onboarding_completed`
        // via the existing supabase client.
        const { data } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (data?.onboarding_completed !== true) return;

        // OS-permission gate — only ask if the user hasn't already
        // answered. `getPermissionsAsync` returns `undetermined` when
        // the OS prompt has never been shown.
        try {
          const Notifications = await import("expo-notifications");
          const existing = await Notifications.getPermissionsAsync();
          if (cancelled) return;
          if (existing.status === "undetermined") {
            setPostOnbPushVisible(true);
          } else {
            // Already answered — record so we don't keep checking.
            await AsyncStorage.setItem(POST_ONB_PUSH_PROMPT_KEY, "shown");
          }
        } catch {
          // expo-notifications not present (Expo Go / older builds) —
          // skip silently and let the existing nudge banner handle it.
        }
      } catch {
        /* network / storage hiccup — silent skip. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const dismissPostOnbPush = useCallback(async (granted: boolean) => {
    setPostOnbPushVisible(false);
    try {
      await AsyncStorage.setItem(POST_ONB_PUSH_PROMPT_KEY, "shown");
    } catch {
      /* best-effort persist — banner-queue path will recover next launch */
    }
    if (granted) {
      try {
        await registerExpoPushTokenForUser(userId ?? null);
      } catch {
        /* token-fetch failures are non-fatal — see expoPushToken.ts. */
      }
    }
  }, [userId]);

  const onPostOnbPushEnable = useCallback(() => {
    void (async () => {
      try {
        const Notifications = await import("expo-notifications");
        const existing = await Notifications.getPermissionsAsync();
        const next =
          existing.status === "granted"
            ? existing
            : await Notifications.requestPermissionsAsync();
        await dismissPostOnbPush(next.status === "granted");
      } catch {
        await dismissPostOnbPush(false);
      }
    })();
  }, [dismissPostOnbPush]);

  const onPostOnbPushSkip = useCallback(() => {
    void dismissPostOnbPush(false);
  }, [dismissPostOnbPush]);

  const dismissFirstMealTip = useCallback(() => {
    setFirstMealTipDismissed(true);
    void AsyncStorage.setItem(
      FIRST_MEAL_TIP_DISMISSED_KEY,
      new Date().toISOString(),
    ).catch(() => {
      /* storage denied — in-session state hides tip; may resurface next launch */
    });
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
      const items: Omit<SavedMealItem, "id" | "position">[] = slotMeals.map((m) => {
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
        if (m.micros && Object.keys(m.micros).length > 0) item.nutritionMicros = { ...m.micros };
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
      items: Omit<SavedMealItem, "id" | "position">[],
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
      items: Omit<SavedMealItem, "id" | "position">[];
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
    (meal: SavedMeal, slot: string, mealPortionMultiplier = 1) => {
      if (!userId) return;
      const timeLabel = new Date().toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      // ENG-783 — `mealPortionMultiplier` scales the whole combo (default
      // 1 keeps the instant one-tap log byte-identical). Macros are baked
      // into each entry so downstream never double-counts.
      const entries = buildMealEntriesFromSavedMeal(meal, slot, timeLabel, () => newMealId(), mealPortionMultiplier);
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
      // 2026-05-08 data-loss hotfix — immediate Supabase persist. The commit
      // confirm haptic (Medium, ENG-1016) fires once inside this funnel via
      // `confirmLogHapticRef` — no per-call-site duplicate buzz.
      void persistMealsImmediate(targetDayKey, newMeals);
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

        console.warn("Saved-meal log-count bump failed", err);
      });
      setShowPrevious(false);
    },
    [userId, selectedDate, persistMealsImmediate],
  );

  /** ENG-783 — open the saved-meal portion-confirm sheet. Seeds the slot
   *  from the caller's explicit choice first (the tapped slot-header pill,
   *  or the LogSheet's active FAB slot), then the meal's saved default,
   *  then the time-of-day active slot. The explicit slot must win so a
   *  user tapping "Log usual" on the Lunch header opens the editor on
   *  Lunch even when the meal was saved as a Breakfast default. */
  const openPortionConfirm = useCallback(
    (meal: SavedMeal, slot: string) => {
      setPortionSlot(slot || meal.defaultMealSlot || activeMealSlot);
      setPortionMeal(meal);
    },
    [activeMealSlot],
  );

  /** ENG-783 — commit the portion-confirm sheet. Reuses the same
   *  build/persist/analytics path as the instant tap, passing the chosen
   *  multiplier, then bumps the refresh token so the panel re-sorts. */
  const confirmPortionLog = useCallback(
    (mult: number) => {
      if (!portionMeal) return;
      logSavedMealFromPanel(portionMeal, portionSlot, mult);
      // ENG-783 — fire `saved_meal_logged` on the portion-editor commit so
      // this entry path stays countable in the F1/F3 funnels. The instant
      // slot-header path fires this itself; `logSavedMealFromPanel` only
      // emits per-item `food_logged`, so without this the portion-editor
      // logs would be invisible to saved-meal funnels. One event per
      // confirmed portion log; `portionMultiplier` surfaces adjust-rate.
      try {
        track(AnalyticsEvents.saved_meal_logged, {
          itemCount: portionMeal.items.length,
          slot: portionSlot,
          savedMealId: portionMeal.id,
          portionMultiplier: mult,
        });
      } catch { /* analytics fire-and-forget */ }
      setPortionMeal(null);
      setSavedMealsRefreshToken((n) => n + 1);
    },
    [portionMeal, portionSlot, logSavedMealFromPanel],
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
      // 2026-05-08 data-loss hotfix — immediate Supabase persist. Commit
      // confirm haptic fires once inside the funnel (ENG-1016).
      void persistMealsImmediate(targetDayKey, newMeals);
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

        console.warn("Today slot-header usual-meal log bump failed", err);
      });
      setSavedMealsRefreshToken((n) => n + 1);
    },
    [userId, selectedDate, persistMealsImmediate],
  );

  // Eat-again state retired (ENG-984, 2026-06-17). The candidate
  // pipeline + per-day dismiss store existed only to feed the Eat-again
  // card, which was suppressed from Today on 2026-05-22 (v4) and never
  // re-surfaced — so it is removed here. (The shared `eatAgainDismiss` /
  // food-history modules stay as independently-tested utilities; this is
  // not a deferral.)

  // ── Weekly Check-in banner (MacroFactor parity, 2026-04-30) ──
  // Visible only on the first day of a fresh week (Sun for Sunday-
  // start users, Mon for Monday-start) AND only when not dismissed
  // for the current week key. The banner routes to /weekly-recap.
  // The dismissal state hydrates lazily — it's `null` until the
  // AsyncStorage read returns. We treat `null` as "not yet known"
  // and DO NOT render the banner until we know — this avoids a flash
  // of the banner that immediately disappears once the read resolves.
  const [checkinBannerDismissed, setCheckinBannerDismissed] = useState<
    boolean | null
  >(null);
  const checkinWeekKey = useMemo(
    () => weekKeyForCheckin(new Date(), weekStartDay),
    [weekStartDay],
  );
  useEffect(() => {
    if (!userId) {
      setCheckinBannerDismissed(true);
      return;
    }
    let cancelled = false;
    void isCheckinBannerDismissed(userId, checkinWeekKey).then((dismissed) => {
      if (!cancelled) setCheckinBannerDismissed(dismissed);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, checkinWeekKey]);
  const isCheckinBannerDay = useMemo(() => {
    // First day of the user's week (so the banner reads "your week
    // just ended, here's the recap"). The strict definition mirrors
    // `weekKeyFor` — Sun for "sunday" users, Mon for "monday" users.
    const dow = new Date().getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    return weekStartDay === "sunday" ? dow === 0 : dow === 1;
  }, [weekStartDay]);
  const dismissCheckinBanner = useCallback(async () => {
    if (!userId) return;
    setCheckinBannerDismissed(true);
    try {
      track(AnalyticsEvents.weekly_checkin_banner_dismissed, {
        weekKey: checkinWeekKey,
      });
    } catch {
      /* fire-and-forget */
    }
    await markCheckinBannerDismissed(userId, checkinWeekKey);
  }, [userId, checkinWeekKey]);
  const openCheckin = useCallback(() => {
    try {
      track(AnalyticsEvents.weekly_checkin_banner_tapped, {
        weekKey: checkinWeekKey,
      });
    } catch {
      /* fire-and-forget */
    }
    router.push("/weekly-recap" as never);
  }, [router, checkinWeekKey]);


  const loadProfileTargets = useCallback(async () => {
    if (!userId) return;
    // Batch 2.5: include new `target_caffeine_mg` + `target_alcohol_g_weekly` +
    // the two per-day maps. If the migration hasn't landed yet on this env,
    // fall through to the legacy select so quick-add water keeps working.
    //
    // 2026-05-02: also fetch `net_carbs_lens_enabled` here so the
    // existing focus-effect that re-runs `loadProfileTargets` picks up
    // toggle changes from the Settings sheet without needing a
    // separate refetch path. Pre-fix the lens flag was loaded once on
    // userId mount and never refreshed, so toggling "Show net carbs"
    // in Settings did nothing visible until the app cold-started.
    let resp = await supabase
      .from("profiles")
      .select(
        "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, target_caffeine_mg, target_alcohol_g_weekly, extra_water_by_day, extra_caffeine_by_day, extra_alcohol_g_by_day, steps_by_day, activity_burn_by_day, workouts_by_day, basal_burn_by_day, daily_steps_goal, prefer_activity_adjusted_calories, fasting_sessions, fasting_window, tracked_macros, week_start_day, measurement_system, meal_slot_config, weight_kg, weight_kg_by_day, height_cm, sex, activity_level, goal, goal_weight_kg, dob, age, notification_prefs, plan_pace, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, measured_tdee, measured_tdee_confidence, measured_tdee_updated_at, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history, milestone_30_shown_at, last_weekly_checkin_shown_at, net_carbs_lens_enabled, tz_iana",
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
    if (!data) {
      setProfileTimeZone(null);
      return;
    }
    const d = data as any;
    setProfileTimeZone(typeof d.tz_iana === "string" ? d.tz_iana : null);
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
      setWorkoutsByDay(d.workouts_by_day as Record<string, { type: string; minutes: number; calories: number; source: string }[]>);
    }
    setBasalBurnByDay(parseByDayNumberMap(d.basal_burn_by_day));
    setPreferActivityAdjustedCalories(Boolean(d.prefer_activity_adjusted_calories));
    setUserMealSlotConfig(parseUserMealSlotConfig(d.meal_slot_config));
    const sg = data.daily_steps_goal != null ? Number(data.daily_steps_goal) : NUTRITION_DEFAULTS.steps;
    setDailyStepsGoal(Number.isFinite(sg) && sg > 0 ? Math.round(sg) : NUTRITION_DEFAULTS.steps);
    if (Array.isArray(data.fasting_sessions)) {
      const active = (data.fasting_sessions as {start: string; end: string | null}[]).find((s) => s.end === null);
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
    // F-109: gate the idle "Start fast" pill on the IF opt-in signal.
    // A non-null `fasting_window` means the user has set a window
    // (onboarding or /fasting preset chip) — only those users see the
    // idle pill on Today.
    setFastingOptedIn(typeof fwRaw === "string" && fwRaw.length > 0);
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
    const mTdeeRaw = (d as any).measured_tdee;
    setMeasuredTdee(typeof mTdeeRaw === "number" && Number.isFinite(mTdeeRaw) ? mTdeeRaw : null);
    setMeasuredTdeeConfidence(
      typeof (d as any).measured_tdee_confidence === "string"
        ? (d as any).measured_tdee_confidence
        : null,
    );
    setMeasuredTdeeUpdatedAt(
      typeof (d as any).measured_tdee_updated_at === "string"
        ? (d as any).measured_tdee_updated_at
        : null,
    );
    // Weekly check-in ritual — `last_weekly_checkin_shown_at` drives
    // the 6-day cooldown gate. Missing column ⇒ null ⇒ gate is open.
    setWeeklyCheckinShownAt(
      typeof (d as any).last_weekly_checkin_shown_at === "string"
        ? (d as any).last_weekly_checkin_shown_at
        : null,
    );
    const wkbdRaw = (d as any).weight_kg_by_day;
    if (wkbdRaw && typeof wkbdRaw === "object" && !Array.isArray(wkbdRaw)) {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(wkbdRaw as Record<string, unknown>)) {
        const n = typeof v === "number" ? v : Number(v);
        if (Number.isFinite(n) && n > 0) out[k] = n;
      }
      setProfileWeightKgByDay(out);
    }
    const np = d.notification_prefs as {
      showMealTimestamps?: boolean;
      weekSummaryMode?: string;
      activity_bonus_calories?: boolean;
    } | null | undefined;
    setShowMealTimestamps(Boolean(np?.showMealTimestamps));
    setWeekSummaryMode(normalizeWeekSummaryMode(np?.weekSummaryMode));
    setActivityBonusCaloriesOnly(Boolean(np?.activity_bonus_calories));
    // 2026-05-02 (net-carbs toggle fix) — pull the lens flag through
    // the focus-effect refresh path so toggling "Show net carbs" in
    // Settings flips the Today macro tile label + value within the
    // next focus event (return-to-Today, slot-edit, etc.) instead of
    // requiring a cold start. The standalone one-shot useEffect on
    // mount stays as a belt-and-braces fallback for the very first
    // load before `loadProfileTargets` has run.
    const lensRaw = (d as { net_carbs_lens_enabled?: unknown }).net_carbs_lens_enabled;
    if (typeof lensRaw === "boolean") {
      setNetCarbsLensEnabled(lensRaw);
    }
  }, [userId]);

  const dayKey = dateKeyFromDate(selectedDate);

  /** Log any FoodHistoryItem to the active slot. Used by the Quick add
   * panel (Usual meals / Recents / Frequent / Favourites) so the
   * persist/event shape stays aligned across logging shortcuts. */
  const logHistoryItemToSlot = useCallback(
    async (item: FoodHistoryItem, slot: string) => {
      let recipeTitle = item.recipeTitle;
      if (item.recipeId) {
        const fresh = await fetchMobileCanonicalRecipeTitle(item.recipeId);
        if (fresh) recipeTitle = fresh;
      }
      // Tracking-extras autoupdate (2026-05-01) — re-attach caffeine /
      // alcohol micros so re-logging a coffee / wine / beer from
      // Recents / Frequent still bumps the daily totals.
      // Mirrors web `logHistoryItem`. Missing → no `micros` key.
      const micros: Record<string, number> = item.micros ? { ...item.micros } : {};
      if (item.caffeineMg != null && item.caffeineMg > 0) micros.caffeineMg = item.caffeineMg;
      if (item.alcoholG != null && item.alcoholG > 0) micros.alcoholG = item.alcoholG;
      const meal: JournalMeal = {
        id: newMealId(),
        name: slot,
        recipeTitle,
        ...(item.recipeId ? { recipeId: item.recipeId } : {}),
        time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        ...(item.fiber != null ? { fiberG: item.fiber } : {}),
        ...(item.source ? { source: item.source } : {}),
        ...(Object.keys(micros).length > 0 ? { micros } : {}),
        ...(isFeatureEnabled("editable_eaten_at")
          ? { eatenAt: defaultEatenAtForNewLog(dayKey, profileTimeZone) }
          : {}),
      };
      setByDay((prev) => ({ ...prev, [dayKey]: [...(prev[dayKey] ?? []), meal] }));
      // 2026-05-08 data-loss hotfix — immediate Supabase persist. Commit
      // confirm haptic fires once inside the funnel (ENG-1016).
      void persistMealsImmediate(dayKey, [meal]);
      // F-74 / F-103 fix (2026-05-07): NO ledger bump on log paths.
      // Per-meal `micros.caffeineMg` / `alcoholG` is the canonical SoT
      // for food-derived stimulants — `caffeineFromMealsMg` /
      // `alcoholByDayMerged` sum these from `byDay` at render. The
      // earlier `bumpStimulantsForLoggedMeal` call here was duplicating
      // the value into `extra_caffeine_by_day`, then the read merged
      // both → 2× display. Quick-add (`addCaffeineMg`) keeps writing
      // to the ledger directly; that ledger now holds quick-add only.
      try { track(AnalyticsEvents.food_logged, { source: "quick_add", slot }); } catch { /* noop */ }
    },
    [dayKey, persistMealsImmediate, profileTimeZone, userId],
  );

  /**
   * Shared food-search commit path — fires when the user picks a
   * portion + quantity from either:
   *   - the inline `<FoodSearchPanel>` mounted inside `<LogSheet>`
   *     (2026-04-30, primary surface), or
   *   - the standalone `<FoodSearchModal>` (still mounted for the
   *     "search instead" path inside `<TodayAddFoodForm>`).
   *
   * Mirrors web's FoodSearch onSelect commit byte-for-byte. Hosts
   * the F-13 (caffeine + alcohol) + F-79 (full per-100g micros)
   * branches because both flows commit through the same journal
   * shape.
   */
  const handleFoodSearchSelect = useCallback(
    (result: FoodSearchSelectedFood) => {
      let scaled;
      try {
        scaled = foodSelectionToMealMacros(result);
      } catch (err) {
        console.error("[tracker] handleFoodSearchSelect failed:", err);
        Alert.alert(
          "Couldn't log this food",
          "Something went wrong saving this item. Try again or log it manually.",
        );
        return;
      }
      const {
        calories: mealCalories,
        protein: mealProtein,
        carbs: mealCarbs,
        fat: mealFat,
        fiberG: mealFiberG,
        micros,
      } = scaled;
      if (!Number.isFinite(mealCalories) || mealCalories <= 0) {
        Alert.alert(
          "Couldn't log this food",
          "Nutrition data for this item is missing or incomplete. Try another result or enter it manually.",
        );
        return;
      }
      const source =
        result.source === "CUSTOM"
          ? "custom_food"
          : result.source === "OFF"
          ? "Open Food Facts"
          : result.source === "Edamam"
          ? "Edamam"
          : result.source === "FatSecret"
          ? "FatSecret"
          : "USDA FoodData Central";
      const eatenAt =
        result.eatenAt ??
        (isFeatureEnabled("editable_eaten_at")
          ? defaultEatenAtForNewLog(dayKey, profileTimeZone)
          : undefined);
      const { dateKey: resolvedDateKey } = nutritionEntryDateKeyAndEatenAt(
        { eatenAt },
        dayKey,
        null,
        { timeZone: profileTimeZone },
      );
      const meal: JournalMeal = {
        id: newMealId(),
        name: activeMealSlot,
        recipeTitle: result.name,
        time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        calories: mealCalories,
        protein: mealProtein,
        carbs: mealCarbs,
        fat: mealFat,
        source,
        ...(mealFiberG > 0 ? { fiberG: mealFiberG } : {}),
        ...(Object.keys(micros).length > 0 ? { micros } : {}),
        ...(result.imageUrl
          ? { recipeImageUrl: String(result.imageUrl).trim() }
          : {}),
        ...(eatenAt ? { eatenAt } : {}),
      };
      // Non-urgent journal update — keep the LogSheet responsive while Today
      // recomputes totals behind a transition (avoids multi-second JS stalls
      // that read as a crash on device).
      startTransition(() => {
        setByDay((prev) => ({
          ...prev,
          [resolvedDateKey]: [...(prev[resolvedDateKey] ?? []), meal],
        }));
      });
      // Persist with the anchor dayKey; row builder derives date_key from eatenAt.
      void persistMealsImmediate(resolvedDateKey, [meal]);
      // F-74 / F-103 fix (2026-05-07): see `quickAddMeal` above —
      // per-meal micros is the canonical SoT for food-derived
      // stimulants. No `bumpStimulantsForLoggedMeal` here.
      setFabSheetOpen(false);
      try {
        track(AnalyticsEvents.food_logged, {
          source: foodSelectionAnalyticsSource(result.source),
          calories: meal.calories,
          slot: activeMealSlot,
        });
      } catch { /* noop */ }
    },
    [activeMealSlot, dayKey, persistMealsImmediate, profileTimeZone],
  );

  /** ENG-709 — Copy yesterday's meals to today. Called after the user
   *  confirms the Alert prompt. Copies all JournalMeal rows from
   *  yesterday's date key with fresh IDs so they don't collide. */
  const handleCopyYesterdayConfirmed = useCallback(async () => {
    const yesterdayMeals = getYesterdayMeals(byDay, dayKey);
    if (yesterdayMeals.length === 0) return;
    const newMeals: JournalMeal[] = await Promise.all(
      yesterdayMeals.map(async (m) => {
        // Re-anchor `eatenAt` onto today — the clone keeps yesterday's
        // instant, and the write path derives `date_key` from `eaten_at`,
        // so an un-re-anchored clone would persist back onto YESTERDAY
        // (launch-audit 2026-06-12 copy-path fix).
        const meal: JournalMeal = reanchorMealEatenAt(
          {
            ...cloneMealWithoutId(m),
            id: newMealId(),
          } as JournalMeal,
          dayKey,
          { timeZone: profileTimeZone },
        );
        if (meal.recipeId) {
          const fresh = await fetchMobileCanonicalRecipeTitle(meal.recipeId);
          if (fresh) meal.recipeTitle = fresh;
        }
        return meal;
      }),
    );
    setByDay((prev) => ({
      ...prev,
      [dayKey]: [...(prev[dayKey] ?? []), ...newMeals],
    }));
    void persistMealsImmediate(dayKey, newMeals);
    track(AnalyticsEvents.food_logged, {
      source: "copy_yesterday",
      count: newMeals.length,
    });
  }, [byDay, dayKey, persistMealsImmediate, profileTimeZone]);

  const handleCopyYesterday = useCallback(() => {
    const count = getYesterdayMeals(byDay, dayKey).length;
    if (count === 0) return;
    const label = count === 1 ? "1 meal" : `${count} meals`;
    Alert.alert(
      "Copy yesterday's meals?",
      `This will add ${label} from yesterday to today. You can delete any you don't want.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Copy", onPress: handleCopyYesterdayConfirmed },
      ],
    );
  }, [byDay, dayKey, handleCopyYesterdayConfirmed]);

  const trackerWeekSummaryKeys = useMemo(
    () => weekSummaryDateKeys(weekSummaryMode, selectedDate, weekStartDay),
    [weekSummaryMode, selectedDate, weekStartDay],
  );
  const mealsToday = byDay[dayKey] ?? [];

  const recentFoodsForSearch = useMemo(
    () =>
      computeRecentMeals(byDay, 50)
        .filter((item) => !isHealthImportFallbackTitle(item.recipeTitle))
        .map((item) => ({
          recipeTitle: item.recipeTitle,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiber: item.fiber,
          source: item.source,
          count: item.count,
        })),
    [byDay],
  );

  const recentMealsForPick = useMemo(
    () =>
      computeRecentMeals(byDay, 12).filter(
        (item) => !isHealthImportFallbackTitle(item.recipeTitle),
      ),
    [byDay],
  );

  const recentLogSheetEntries = useMemo(() => {
    const todayKey = dateKeyFromDate(new Date());
    return recentMealsForPick.map((item) => ({
      id: foodHistoryKey(item.recipeTitle, item.calories),
      title: item.recipeTitle,
      kcal: Math.round(item.calories),
      source: mapMealSourceToDot(item.source),
      bucket: (item.lastLoggedAt ?? "").startsWith(todayKey)
        ? ("today" as const)
        : ("week" as const),
    }));
  }, [recentMealsForPick]);

  /**
   * Phase 5 (2026-04-30) — id of the first AI-sourced meal row to
   * anchor the AI-first-log tooltip below. `null` until AsyncStorage
   * hydrates (`aiTooltipShown === null`), or when the user has
   * already seen the tooltip on a prior launch (`aiTooltipShown ===
   * true`), or when there is no AI-sourced meal on the active day.
   */
  const aiFirstLogTooltipMealId = useMemo<string | null>(() => {
    if (aiTooltipShown !== false) return null;
    for (const m of mealsToday) {
      if (isAiSourcedFoodHistoryItem({ source: m.source ?? null })) {
        return m.id;
      }
    }
    return null;
  }, [mealsToday, aiTooltipShown]);

  const targets = profileTargets;
  const isToday = dayKey === dateKeyFromDate(new Date());

  // Activation hook (audit 2026-04-30 — leak fix #3): detect the
  // 0→1 transition in today's meal count and fire the first-log
  // toast + haptic. The detection runs against the AsyncStorage flag
  // (`firstLogAckShown === false`) so a returning user who already
  // saw it on day-1 never re-triggers on day-2.
  //
  // We track the previous count via a ref to distinguish "fresh
  // log" from "rehydrate from storage" — the journal load also
  // moves `mealsToday.length` from 0 → N on cold start, but that
  // path doesn't represent a user-initiated log and shouldn't toast.
  // Solution: compare to `firstLogPrevCountRef.current`. On first
  // run after journal hydrate, `prev` is `null` → seed without
  // toasting. On subsequent updates, `0 → 1` triggers the toast.
  useEffect(() => {
    if (firstLogAckShown !== false) {
      // Either still hydrating (`null`) or already shown (`true`).
      // Keep ref synced so a later transition doesn't false-trigger.
      firstLogPrevCountRef.current = mealsToday.length;
      return;
    }
    if (!isToday) {
      // Only Today drives the first-log moment — viewing a prior day
      // shouldn't fire it.
      return;
    }
    const prev = firstLogPrevCountRef.current;
    const curr = mealsToday.length;
    if (prev === null) {
      // First observation post-hydrate. Seed without toasting.
      firstLogPrevCountRef.current = curr;
      return;
    }
    if (prev === 0 && curr === 1) {
      // The user just logged their first meal of the day — and the
      // storage flag confirms they've never seen the toast before.
      // Fire the haptic + reveal the toast. Component handles the
      // 2.5s auto-fade.
      try {
        if (Platform.OS === "ios") {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
        }
      } catch {
        /* haptics not available — toast still renders. */
      }
      setFirstLogToastVisible(true);
    }
    firstLogPrevCountRef.current = curr;
  }, [mealsToday.length, firstLogAckShown, isToday]);

  // Maintenance tile + popover + activity-bonus baseline. Resolves via
  // the shared `resolveMaintenance`: adaptive TDEE wins at medium/high
  // confidence AND not stale, otherwise the static Mifflin formula.
  // Progress reads from the same helper so "Maintenance 1,675" and
  // "Your TDEE 1,777" (TestFlight `ADFYpDgEEb0QH-j3BXshPTo`, build 10)
  // can no longer disagree. Burn detail (`/burn-detail`) uses the same
  // resolver so the "Maintenance" row matches Progress / Today tile.
  const resolvedMaintenance = useMemo(
    () =>
      resolveMaintenance(
        {
          adaptive_tdee: adaptiveTdee,
          adaptive_tdee_confidence: adaptiveTdeeConfidence,
          adaptive_tdee_updated_at: adaptiveTdeeUpdatedAt,
          measured_tdee: measuredTdee,
          measured_tdee_confidence: measuredTdeeConfidence,
          measured_tdee_updated_at: measuredTdeeUpdatedAt,
          sex: profileSex as any,
          weight_kg: profileWeightKg,
          height_cm: profileHeightCm,
          age: profileAge,
          activity_level: profileActivityLevel as any,
        },
        { enableMeasured: isFeatureEnabled(MEASURED_TDEE_CHECK_IN_FLAG) },
      ),
    [
      adaptiveTdee,
      adaptiveTdeeConfidence,
      adaptiveTdeeUpdatedAt,
      measuredTdee,
      measuredTdeeConfidence,
      measuredTdeeUpdatedAt,
      profileSex,
      profileWeightKg,
      profileHeightCm,
      profileAge,
      profileActivityLevel,
    ],
  );
  const profileMaintenanceTdeeKcal = resolvedMaintenance?.kcal ?? null;

  /** Same baseline as Burn detail + Progress: prefer `resolveMaintenance`, else implied from saved calorie target. */
  const maintenanceKcal = useMemo(() => {
    const k = resolvedMaintenance?.kcal;
    if (k != null && k > 0) return k;
    return maintenanceIntakeFromTargetCalories(targets.calories, profileGoal, profilePlanPace);
  }, [resolvedMaintenance, targets.calories, profileGoal, profilePlanPace]);
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

  // The deficit-window mode (rolling vs current calendar week) is still
  // hydrated from `notification_prefs.weekSummaryMode` at load (see
  // `setWeekSummaryMode(normalizeWeekSummaryMode(...))` above) and still
  // drives the Today summary window. The CONTROL that changes it now
  // lives in Settings (`SettingsBundleContent.tsx`, "Burn / deficit
  // summary" row) — mirroring web Settings — rather than an in-place
  // Today toggle, so Today no longer needs a persist path for it.

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
            workoutsByDay,
            profileMaintenanceSource,
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
      workoutsByDay,
    ],
  );

  // Scale macro gram targets proportionally when the activity bonus adds
  // extra calorie budget. The base targets (targets.protein/carbs/fat) are
  // set from the user's profile split — if those targets collectively sum to
  // `targets.calories` kcal, they should also sum to `effectiveCalorieGoal`
  // when a bonus is earned. Without this scaling the macro bars show 100%
  // consumed while the calorie ring still shows budget remaining, which is
  // confusing and incorrect.
  const effectiveMacroTargets = useMemo(
    () =>
      scaleMacroTargetsForCalorieBudget(
        { protein: targets.protein, carbs: targets.carbs, fat: targets.fat },
        { baseCalories: targets.calories, effectiveCalories: effectiveCalorieGoal },
      ),
    [targets.calories, targets.protein, targets.carbs, targets.fat, effectiveCalorieGoal],
  );

  /** Macro tiles/bars expect a full targets object; only P/C/F scale with bonus. */
  const dashboardMacroTargets = useMemo(
    () => ({
      ...targets,
      protein: effectiveMacroTargets.protein,
      carbs: effectiveMacroTargets.carbs,
      fat: effectiveMacroTargets.fat,
    }),
    [targets, effectiveMacroTargets],
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
        workoutsByDay,
        profileMaintenanceSource,
      ),
    [
      preferActivityAdjustedCalories,
      activityBonusCaloriesOnly,
      activityBurnByDay,
      basalBurnByDay,
      maintenanceKcal,
      dayKey,
      workoutsByDay,
      profileMaintenanceSource,
    ],
  );

  /** Earned bonus (burn-detail parity) — drives Today toggle + "+bonus" copy. */
  const potentialActivityBudgetAddon = useMemo(() => {
    const workouts = workoutsByDay[dayKey] ?? [];
    return computeProjectedActivityBonusKcal({
      dateKey: dayKey,
      todayDateKey: dateKeyFromDate(new Date()),
      restingKcal: basalBurnByDay[dayKey] ?? 0,
      activeKcal: activityBurnByDay[dayKey] ?? 0,
      maintenanceKcal,
      workoutKcal: workouts.reduce((s, w) => s + (w.calories ?? 0), 0),
    });
  }, [activityBurnByDay, basalBurnByDay, maintenanceKcal, dayKey, workoutsByDay]);

  const navigateDay = useCallback((offset: number) => {
    startTransition(() => {
      setSelectedDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + offset);
        return clampJournalDate(next);
      });
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
          workoutsByDay,
          profileMaintenanceSource,
        ),
      0,
    );
  }, [
    preferActivityAdjustedCalories,
    activityBonusCaloriesOnly,
    weekData.days,
    targets.calories,
    activityBurnByDay,
    workoutsByDay,
    basalBurnByDay,
    maintenanceKcal,
    profileMaintenanceSource,
  ]);

  // F-146 (2026-05-10): the week-view "Net deficit / Net surplus"
  // tile previously compared `weekConsumed > weekTarget` (consumed-
  // vs-goal), which mislabels a deficit as a surplus when consumed is
  // above goal but below total burn. The Activity Bonus card (one
  // section above) gets this right via `totalBurn − consumed`. This
  // sum of (basal + activity) per day across the visible week is the
  // same shape the Activity Bonus card already uses. Falls back to
  // `maintenanceKcal × 7` (a flat assumption) when the user hasn't
  // opted into activity-adjusted calories so the tile still answers
  // "deficit / surplus" with a defensible burn baseline.
  const weekBurnTotal = useMemo(() => {
    const fallbackPerDay = Math.max(0, maintenanceKcal);
    return weekData.days.reduce((sum, d) => {
      const basal = basalBurnByDay[d.key];
      const activity = activityBurnByDay[d.key];
      const dayBurn =
        (typeof basal === "number" && Number.isFinite(basal) ? basal : fallbackPerDay) +
        (typeof activity === "number" && Number.isFinite(activity) ? activity : 0);
      return sum + dayBurn;
    }, 0);
  }, [weekData.days, basalBurnByDay, activityBurnByDay, maintenanceKcal]);

  const navigateWeek = useCallback((offset: number) => {
    startTransition(() => {
      setSelectedDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + offset * 7);
        return clampJournalDate(next);
      });
    });
  }, []);

  // Weekly check-in ritual gate (PR claude/weekly-checkin-ritual-v2,
  // 2026-05-02 — rebuild of #26). Runs once per Today first-load —
  // `weeklyCheckinHandledRef` suppresses re-fires for the rest of the
  // session even if `weekData` recomputes. Honest weight delta: we pass
  // `null` for `weightDeltaKg` until a downstream change wires real
  // weigh-in data through (`profileWeightKgByDay` + a 7-day window
  // resolver). The modal suppresses the row rather than fabricate
  // "+0.0 kg" — see PR body "Risks / follow-ups" entry.
  useEffect(() => {
    if (!isToday) return;
    if (weeklyCheckinHandledRef.current) return;
    if (!userId) return;
    // build-45 bug fix (2026-05-08): when the user navigates to
    // /meal-nutrition then taps Edit, the host route returns with
    // `editMealId` and TodayEditMealModal opens. The weekly check-in
    // useEffect re-fires on the same focus event and opens its modal
    // ON TOP of the edit modal — both are presented at the same RN
    // Modal level and iOS blocks input on the back one → page freezes.
    //
    // build-47 follow-up (2026-05-08): the original guard returned
    // early WITHOUT setting `weeklyCheckinHandledRef.current = true`,
    // so the moment the edit modal closed the gate re-ran with the
    // guard cleared and the check-in popped immediately after every
    // edit ("This keeps popping up every time I edit an item"). Fix:
    // when we observe the edit flow, ALSO mark the check-in as
    // handled for the rest of this session. The check-in is once-per-
    // week server-side; deferring to the next app launch is fine.
    if (
      editingMeal != null ||
      (typeof params.editMealId === "string" && params.editMealId.length > 0)
    ) {
      weeklyCheckinHandledRef.current = true;
      return;
    }
    // Map adaptive confidence string into the gate's typed enum. Any
    // unrecognised value (legacy / null / future addition) routes to
    // null which the gate treats as "math hasn't resolved" → no fire.
    const conf: WeeklyCheckinConfidence | null =
      profileMaintenanceConfidence === "medium" || profileMaintenanceConfidence === "high"
        ? profileMaintenanceConfidence
        : profileMaintenanceConfidence === "low"
          ? "low"
          : null;
    const daysLoggedThisWeek = weekData.days.filter(
      (d) => d.totals.calories > 0,
    ).length;
    const eligible = shouldShowWeeklyCheckin({
      adaptiveTdeeConfidence: conf,
      adaptiveTdee: profileMaintenanceTdeeKcal,
      daysLoggedThisWeek,
      lastShownAt: weeklyCheckinShownAt,
    });
    if (!eligible) return;
    if (!Number.isFinite(targets.calories) || targets.calories <= 0) return;
    weeklyCheckinHandledRef.current = true;

    const content = buildWeeklyCheckinContent({
      adaptiveTdee: profileMaintenanceTdeeKcal as number,
      // Prefer the shared `formulaKcal` resolver output as the prior
      // baseline. When the user's profile is incomplete the resolver
      // returns null; the content builder honestly suppresses the
      // delta line.
      priorTdee: resolvedMaintenance?.formulaKcal ?? null,
      currentTargetKcal: targets.calories,
      avgCaloriesThisWeek: weekData.weekAvg.calories,
      // weightDeltaKg follow-up: see PR body. Honest null for now.
      weightDeltaKg: null,
      // ENG-1027 — sex-aware suggested-target floor (never suggest a man
      // below 1,500 / a woman below 1,200).
      sex: profileSex,
    });
    setWeeklyCheckinContent(content);
    // ENG-805 — never cold-open the blocking modal; the in-feed banner is
    // the only entry point (matches web + redesign_winmoment default-on).

    // Optimistically stamp the shown-at on the row so we don't re-fire
    // on a hot reload, even if the analytics emit fails. Server is
    // source of truth — refetch on next loadProfileTargets() will
    // overwrite with the canonical value.
    const nowIso = new Date().toISOString();
    setWeeklyCheckinShownAt(nowIso);
    void supabase
      .from("profiles")
      .update({ last_weekly_checkin_shown_at: nowIso } as never)
      .eq("id", userId);

    try {
      track(AnalyticsEvents.weekly_checkin_shown, {
        confidence: conf,
        tdeeDeltaKcal: content.tdeeDeltaKcal,
        daysLoggedThisWeek,
        platform: "ios",
      });
    } catch {
      /* noop */
    }
  }, [
    isToday,
    userId,
    profileMaintenanceTdeeKcal,
    profileMaintenanceConfidence,
    weekData,
    targets.calories,
    resolvedMaintenance,
    weeklyCheckinShownAt,
    editingMeal,
    params.editMealId,
  ]);

  const handleWeeklyCheckinAccept = useCallback(() => {
    if (!userId || !weeklyCheckinContent) {
      setWeeklyCheckinOpen(false);
      return;
    }
    const newTarget = weeklyCheckinContent.suggestedTargetKcal;
    const previous = targets.calories;
    setWeeklyCheckinOpen(false);
    try {
      track(AnalyticsEvents.weekly_checkin_accepted, {
        tdeeDeltaKcal: weeklyCheckinContent.tdeeDeltaKcal,
        previousTargetKcal: previous,
        suggestedTargetKcal: newTarget,
        platform: "ios",
      });
    } catch {
      /* noop */
    }
    // Optimistic local update so the rings reflect the new target
    // without waiting for the round-trip.
    setProfileTargets((prev) => ({ ...prev, calories: newTarget }));
    void supabase
      .from("profiles")
      .update({
        target_calories: newTarget,
        target_calories_set_at: new Date().toISOString(),
        // Same enum value the maintenance-recalibration suggestion
        // already uses, so the existing 21-day Rule 2 cooldown
        // works correctly.
        target_calories_source: "digest_recalibration",
        last_weekly_checkin_decision: "accepted",
      } as never)
      .eq("id", userId);
  }, [userId, weeklyCheckinContent, targets.calories]);

  const handleWeeklyCheckinDismiss = useCallback(() => {
    setWeeklyCheckinOpen(false);
    try {
      track(AnalyticsEvents.weekly_checkin_dismissed, {
        reason: "kept_current",
        platform: "ios",
      });
    } catch {
      /* noop */
    }
    if (!userId) return;
    void supabase
      .from("profiles")
      .update({ last_weekly_checkin_decision: "kept_current" } as never)
      .eq("id", userId);
  }, [userId]);

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

  /** Day-summed nutrition_micros — shared by the all-nutrients sheet
   *  (`FullNutrientPanelSheet`, opened from the Nutrients link in
   *  `TodayDashboardMacroTiles`) and the legacy nutrient-rows modal.
   *  Computed once so both surfaces agree. */
  const dayMicroSum = useMemo(() => sumMicrosFromLoggedMeals(mealsToday), [mealsToday]);

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

  // Phase 5 / B3.M (2026-04-27) — fetch the user's saved library so
  // `<NorthStarBlockHost>` can choose a "what to eat next" suggestion.
  // Same hook the Library tab uses so we stay on a single source of
  // truth for the saved set. Refresh handled by the hook's internal
  // useEffect on userId change.
  const { recipes: savedLibraryRecipes, refresh: refreshSavedLibraryRecipes } =
    useSavedLibraryRecipes(userId ?? null);
  const savedRecipesForLibrary = useMemo(
    () =>
      savedLibraryRecipes.map((r) => ({
        id: r.id,
        title: r.title,
        calories: r.calories ?? 0,
        protein: r.protein ?? 0,
        carbs: r.carbs ?? 0,
        fat: r.fat ?? 0,
        thumbnail: r.image,
        mealType: r.mealSlots,
        // Figma `654:2` hero meta — optional cook-time chip. Mirror of
        // web. Absent for recipes with no recorded time (chip degrades).
        cookTimeMin: r.cookTimeMin ?? undefined,
      })),
    [savedLibraryRecipes],
  );

  // Per-macro remaining values used by the NorthStar suggestion picker.
  // Calories are signed (already computed); macros clamp to 0 since
  // "negative remaining protein" isn't a meaningful selector — the
  // scorer treats over-target macros as neutral, not penalised.
  const remainingProtein = Math.max(0, effectiveMacroTargets.protein - totals.protein);
  const remainingCarbs = Math.max(0, effectiveMacroTargets.carbs - totals.carbs);
  const remainingFat = Math.max(0, effectiveMacroTargets.fat - totals.fat);

  // ENG-935: "What to eat next" is a PERMANENT glanceable Today block —
  // it renders whenever we're on today's day view, including when the
  // user is over-budget or exactly on target. The previous `remaining > 0`
  // gate made the block vanish at exactly the moments the user still
  // needs guidance (over by a bit / dead-on target). The over-budget
  // case is handled gracefully inside `NorthStarBlockHost` (it renders
  // the calm `over-budget` caption when remainingCalories <= 0), so the
  // host owns the state — the screen gate no longer second-guesses it.
  const showAboveMealsNorthStar = viewMode === "day" && isToday;

  const belowMealsPromptEligible = useMemo(
    () => ({
      checkin:
        viewMode === "day" &&
        isToday &&
        isCheckinBannerDay &&
        checkinBannerDismissed === false,
      snap: viewMode === "day" && isToday && mealsToday.length === 0,
      nudge: viewMode === "day" && isToday && mealsToday.length > 0,
    }),
    [
      viewMode,
      isToday,
      isCheckinBannerDay,
      checkinBannerDismissed,
      mealsToday.length,
    ],
  );

  const showBelowMealsCheckin = isBelowMealsPromptVisible(
    "checkin",
    belowMealsPromptEligible,
  );
  const showBelowMealsSnap = isBelowMealsPromptVisible("snap", belowMealsPromptEligible);
  const showBelowMealsNudge = isBelowMealsPromptVisible("nudge", belowMealsPromptEligible);

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
      effectiveMacroTargets.protein,
      effectiveMacroTargets.carbs,
      effectiveMacroTargets.fat,
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
          proteinTargetG: effectiveMacroTargets.protein,
          proteinConsumedG: totals.protein,
          carbsTargetG: effectiveMacroTargets.carbs,
          carbsConsumedG: totals.carbs,
          fatTargetG: effectiveMacroTargets.fat,
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
    effectiveMacroTargets.protein,
    effectiveMacroTargets.carbs,
    effectiveMacroTargets.fat,
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

  /**
   * 2026-05-01 (journey-architect P1) — brand-new-account check for
   * the Today empty-state IG/TT tip line. True iff `auth.users.created_at`
   * is < 24h ago. Returns false if the timestamp is missing or unparseable
   * (safe-default to "not brand new" → no tip shown).
   */
  const isBrandNewUser = useMemo(() => {
    const createdAtRaw = session?.user?.created_at;
    if (!createdAtRaw) return false;
    const t = Date.parse(createdAtRaw);
    if (!Number.isFinite(t)) return false;
    return Date.now() - t < 24 * 60 * 60 * 1000;
  }, [session?.user?.created_at]);

  /** 2026-05-01 — true iff the user has logged any meal on any day. */
  const hasAnyJournalHistory = useMemo(() => loggedDays.size > 0, [loggedDays]);

  /**
   * DC12 (2026-05-14, premium-bar audit) — Today "missed yesterday"
   * supportive banner visibility. Pure rule + copy live in the shared
   * `@suppr/nutrition-core/missedYesterday` helper (single regression
   * home, pinned by `tests/unit/missedYesterday.test.ts`; cross-platform
   * wiring pinned by `tests/unit/todayMissedYesterdayWiring.test.ts`).
   * Renders only when the user (a) is on today's view, (b) has prior
   * history, (c) logged nothing yesterday, and (d) it's not the first
   * day of a fresh week. Re-wired into the Sloe `01 · Today` layout
   * after the 2026-06-04 re-skin dropped it alongside the old date-nav
   * header — web (`NutritionTracker.tsx`) never dropped it, so this
   * keeps the two platforms in parity.
   */
  const missedYesterdayVisible = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = dateKeyFromDate(yesterday);
    const mealsYesterday = byDay[yKey] ?? [];
    return shouldShowMissedYesterday({
      isToday,
      hasAnyJournalHistory,
      mealsYesterdayCount: mealsYesterday.length,
      mealsTodayCount: mealsToday.length,
      todayDayOfWeek: new Date().getDay(),
      weekStartDay,
    });
  }, [isToday, hasAnyJournalHistory, byDay, weekStartDay, mealsToday.length]);

  /**
   * Feature 5 / Feature 9 (2026-05-14, premium-bar audit) — subtle
   * mount-time motion on Today. When the tab first receives focus
   * after mount, the hero card fades from 0.85 → 1.0 and the
   * section column slides up 4px with a fade 0.8 → 1.0. Both run
   * over 200ms on `Animated.timing` with the default native driver.
   *
   * Only fires on the first focus per mount, not every tab
   * re-select — `hasMountedFocusRef` is the latch. This keeps the
   * motion as a premium-arrival cue rather than a per-tap animation
   * that would feel busy on the third visit.
   *
   * Reduce-motion users are NOT explicitly opted out here because
   * the magnitudes (opacity 0.85→1.0 over 200ms, 4px translate) are
   * below the WCAG vestibular-motion threshold; the system-level
   * reduce-motion preference still attenuates the curve. If a tester
   * reports discomfort, a `useReducedMotion()` gate is a one-line
   * follow-up.
   */
  const heroEntrance = useEntranceAnimation({ delay: 0 });
  const contextEntrance = useEntranceAnimation({ delay: 80 });
  const macroTilesEntrance = useEntranceAnimation({ delay: 160 });
  const mealsEntrance = useEntranceAnimation({ delay: 240 });

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

  // ENG-798 (Redesign — Design Direction 2026) — reserved win-moment.
  // The shared landmark math + the once-per-day / flag gate live in
  // `useWinMoment`; Today just feeds it a live snapshot and renders the
  // returned `<WinMomentPlayer>` overlay (see below in the JSX). All
  // detection is inert when `redesign_winmoment` is off, so the
  // pre-redesign static behaviour is preserved. `confirmLog` is the quiet
  // <100ms confirm haptic for ordinary logs (gated behind
  // `redesign_motion`) — wired into the ordinary-log path.
  const winSnapshot = useMemo(
    () => ({
      consumed: totals.calories,
      goal: effectiveCalorieGoal,
      streak: protectedStreakLength,
      macros: {
        protein: { current: totals.protein, target: effectiveMacroTargets.protein },
        carbs: { current: totals.carbs, target: effectiveMacroTargets.carbs },
        fat: { current: totals.fat, target: effectiveMacroTargets.fat },
      },
    }),
    [
      totals.calories,
      totals.protein,
      totals.carbs,
      totals.fat,
      effectiveCalorieGoal,
      effectiveMacroTargets.protein,
      effectiveMacroTargets.carbs,
      effectiveMacroTargets.fat,
      protectedStreakLength,
    ],
  );
  const {
    activeCelebration: winCelebration,
    activeMilestone: winMilestone,
    onCelebrationComplete: onWinComplete,
    confirmLog: confirmLogHaptic,
  } = useWinMoment({
    snapshot: winSnapshot,
    dayKey,
    isToday,
    ready: hydrated,
  });
  // Keep the persist-path ref pointed at the latest `confirmLog` so the
  // commit haptic always reflects the current flag state (the hook returns a
  // stable callback, but the assignment is cheap + future-proofs a re-bind).
  confirmLogHapticRef.current = confirmLogHaptic;

  // L6 G8 (2026-04-18) — fire `streak_reset` exactly once when the
  // protected streak transitions from >=1 to 0. Ref starts at `null`
  // so a user with a zero streak on first render never fires.
  const priorProtectedStreakRef = useRef<number | null>(null);
  // Premium-bar audit DC8 polish (2026-05-14) — when the streak just
  // reset, show a calm supportive line in the date-header row
  // (Duolingo-style "Every expert was once a beginner"). Sticky
  // until the user next renders a positive streak — at which point
  // the StreakPip takes over again. Independent of analytics fire.
  const [streakJustReset, setStreakJustReset] = useState(false);
  useEffect(() => {
    const prior = priorProtectedStreakRef.current;
    priorProtectedStreakRef.current = protectedStreakLength;
    if (didStreakReset(prior, protectedStreakLength)) {
      try {
        track(AnalyticsEvents.streak_reset, {
          priorStreak: prior ?? 0,
        });
      } catch { /* analytics fire-and-forget */ }
      setStreakJustReset(true);
    } else if (protectedStreakLength > 0 && streakJustReset) {
      // User logged again and climbed off zero — clear the reset
      // copy so the pip surface returns.
      setStreakJustReset(false);
    }
  }, [protectedStreakLength, streakJustReset]);
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
  /** F-74 (TestFlight `AN3mTmZK5T2Nhj13aMFLk2E`, 2026-04-25): today's
   *  caffeine total in mg = manual quick-add (`extra_caffeine_by_day`)
   *  + per-meal caffeine summed from `nutrition_micros.caffeineMg`.
   *  Before F-74 the Hydration card only read the quick-add ledger,
   *  so logging a coffee in food search left the card at 0/400 mg.
   *  Same shape applies to alcohol below. */
  const caffeineFromMealsMg = useMemo(() => {
    let sum = 0;
    for (const m of mealsToday) {
      const n = Number(m.micros?.caffeineMg ?? 0);
      if (Number.isFinite(n) && n > 0) sum += n;
    }
    return Math.round(sum);
  }, [mealsToday]);
  const alcoholFromMealsG = useMemo(() => {
    let sum = 0;
    for (const m of mealsToday) {
      const n = Number(m.micros?.alcoholG ?? 0);
      if (Number.isFinite(n) && n > 0) sum += n;
    }
    return Math.round(sum * 10) / 10;
  }, [mealsToday]);
  const extraCaffeineToday = (extraCaffeineByDay[dayKey] ?? 0) + caffeineFromMealsMg;
  /** F-74 — alcohol-by-day merge: HydrationStimulantsCard expects a
   *  per-day map (week summary needs per-day to render the bar chart),
   *  so we fold per-meal alcohol from `nutrition_micros.alcoholG`
   *  into every day key currently loaded in `byDay`. The quick-add
   *  ledger remains the writable persistence; this merge is read-only. */
  const alcoholByDayMerged = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = { ...extraAlcoholGByDay };
    for (const [k, meals] of Object.entries(byDay)) {
      let dayMeals = 0;
      for (const m of meals) {
        const n = Number(m.micros?.alcoholG ?? 0);
        if (Number.isFinite(n) && n > 0) dayMeals += n;
      }
      if (dayMeals > 0) {
        out[k] = (out[k] ?? 0) + Math.round(dayMeals * 10) / 10;
      }
    }
    return out;
  }, [byDay, extraAlcoholGByDay]);
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
        // Phase 2 / B1.4 — caffeine/alcohol logs only contribute to
        // the gate when their respective opt-in toggle is on. When
        // the user has opted out, historical caffeine/alcohol data
        // is preserved but does not surface the card.
        extraCaffeineByDay: trackCaffeine ? extraCaffeineByDay : {},
        extraAlcoholGByDay: trackAlcohol ? extraAlcoholGByDay : {},
      }),
    [waterGoalMl, extraWaterByDay, waterFromMealsMl, extraCaffeineByDay, extraAlcoholGByDay, trackCaffeine, trackAlcohol],
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
    (aiItems: import("@suppr/nutrition-core/aiLogging").AiLoggedItem[]) => {
      if (!aiItems.length) return;
      const timeLabel = new Date().toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      const newMeals: JournalMeal[] = aiItems.map((item) => {
        // F-74 / F-103 (2026-05-07) — forward optional caffeine /
        // alcohol from the AI item to the journal meal's `micros`
        // map. Per-meal `micros` is the canonical SoT — the chip
        // totals read `m.micros.caffeineMg` / `alcoholG` off `byDay`
        // and re-sum at every render. Per project rule: only forward
        // values the AI pipeline actually provided — never invent.
        const micros: Record<string, number> = {};
        if (
          typeof item.caffeineMg === "number" &&
          Number.isFinite(item.caffeineMg) &&
          item.caffeineMg > 0
        ) {
          micros.caffeineMg = Math.round(item.caffeineMg);
        }
        if (
          typeof item.alcoholG === "number" &&
          Number.isFinite(item.alcoholG) &&
          item.alcoholG > 0
        ) {
          micros.alcoholG = Math.round(item.alcoholG * 10) / 10;
        }
        const meal: JournalMeal = {
          id: newMealId(),
          name: activeMealSlot,
          recipeTitle: item.name,
          time: timeLabel,
          calories: Math.round(item.calories),
          protein: Math.round(item.protein),
          carbs: Math.round(item.carbs),
          fat: Math.round(item.fat),
          source: aiLoggingSourceLabel(item.source),
          ...(Object.keys(micros).length > 0 ? { micros } : {}),
          ...(isFeatureEnabled("editable_eaten_at")
            ? { eatenAt: defaultEatenAtForNewLog(dayKey, profileTimeZone) }
            : {}),
        };
        return meal;
      });
      setByDay((prev) => ({
        ...prev,
        [dayKey]: [...(prev[dayKey] ?? []), ...newMeals],
      }));
      // 2026-05-08 data-loss hotfix — immediate Supabase persist. Commit
      // confirm haptic fires once inside the funnel (ENG-1016).
      void persistMealsImmediate(dayKey, newMeals);
      // F-74 / F-103 fix (2026-05-07): see `quickAddMeal` —
      // per-meal micros canonical, no ledger bump on AI commits.
      track(AnalyticsEvents.food_logged, {
        source: aiItems[0]?.source === "voice" ? "voice" : "photo",
        count: newMeals.length,
      });
    },
    [activeMealSlot, dayKey, persistMealsImmediate, profileTimeZone, userId],
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
    // 2026-05-02 — photo-log is no longer Pro-only. Free + Base get
    // FREE_PHOTO_LOG_WEEKLY_LIMIT (=5) free photo logs per rolling 7
    // days; the sheet opens for any tier. The gate is the SECOND
    // photo after exhaustion (server returns 403, sheet calls
    // `onUpgradeRequired` -> AiPaywallSheet). See
    // `docs/decisions/2026-05-02-photo-log-free-taster.md`.
    setPhotoLogOpen(true);
  }, []);

  const addWaterMl = useCallback(
    async (ml: number) => {
      if (!userId) return;
      const add = Math.max(0, Math.round(ml));
      if (add === 0) return;
      // Build 41 (2026-05-01) — same React 18 functional-updater
      // closure-capture trap as `addCaffeineMg` / `addAlcoholG`. The
      // previous `setExtraWaterByDay((prev) => { persisted = next;
      // return next; })` pattern left `persisted` as `null` when the
      // `if (persisted)` branch ran, so the supabase write was
      // silently skipped. Same root cause and same fix: compute
      // `next` from the closure-captured `prev` map before calling
      // setState, then persist with the directly-captured value.
      const prev = extraWaterByDay;
      const next = pruneByDay({ ...prev, [dayKey]: (prev[dayKey] ?? 0) + add });
      setExtraWaterByDay(next);
      // Debug audit 2026-05-04 (code-quality #2): caffeine + alcohol
      // already had persist-error rollback (round 3, 2026-04-26); water
      // was missed. Without rollback, an offline / RLS-denied write
      // left the UI ahead of the server, and the next focus refresh
      // re-read from DB and the bump appeared to "evaporate". Same
      // shape as the addCaffeineMg path now.
      const { error } = await supabase
        .from("profiles")
        .update({ extra_water_by_day: next })
        .eq("id", userId);
      if (error) {
        setExtraWaterByDay(prev);
        console.error("[addWaterMl] persist failed:", error.message, error);
        Alert.alert("Couldn't save water", error.message ?? "Try again.");
        return;
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
    [userId, dayKey, extraWaterByDay],
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
      const existing: { start: string; end: string | null }[] = Array.isArray(
        data?.fasting_sessions,
      )
        ? (data.fasting_sessions as { start: string; end: string | null }[])
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

  /** Batch 2.5 — caffeine quick-add for the selected day.
   *
   * 2026-04-26 polish (round 3): tester reported "adding a coffee still
   * doesn't impact the caffeine numbers". Local state DOES update
   * synchronously (the +chip flips the count to e.g. 95/400 mg
   * immediately), but the supabase persist was happening fire-and-forget
   * — any error (RLS denial, missing column, network failure) was
   * silently swallowed. On next app refresh the count reverted to 0
   * because nothing was actually saved server-side. Now: capture the
   * error, roll back local state, surface a toast so the user knows
   * the chip didn't take. Fixes the symptom of "added a coffee, came
   * back to the screen, count is back at 0".
   *
   * Build 41 (TestFlight `AEsaeOW2Qw-BQa29teBp-Ns`, 2026-05-01):
   * tester reported the same symptom is back ("Adding alcohol or
   * coffee still not impacting these numbers"). Root cause was the
   * round-3 fix relied on capturing `next` inside a `setState((prev)
   * => ...)` updater, then reading `persisted` on the next line —
   * but React 18 invokes functional updaters lazily during the next
   * commit, so `persisted` was still `null` when the persist branch
   * checked it. The supabase write therefore never fired, the
   * round-3 error path never ran, and the round-3 toast never
   * surfaced even though no save happened. On next focus / app
   * relaunch the local state hydrated from the (still-zero) server
   * row and the count appeared to "reset".
   *
   * Fix: compute `next` synchronously from the latest map captured
   * in the closure, persist with that value, and use a direct
   * (non-functional) setState call so the value is immediately
   * available outside the updater. The persist now fires, errors
   * surface, and the local state matches what's actually saved. */
  const addCaffeineMg = useCallback(
    async (mg: number, preset: string | null = null) => {
      if (!userId) return;
      const add = Math.max(0, Math.round(mg));
      if (add === 0) return;
      // Snapshot the previous map for rollback BEFORE we mutate state
      // so a network failure can't leave the UI ahead of the server.
      const prev = extraCaffeineByDay;
      const next = pruneByDay({ ...prev, [dayKey]: (prev[dayKey] ?? 0) + add });
      setExtraCaffeineByDay(next);
      const { error } = await supabase
        .from("profiles")
        .update({ extra_caffeine_by_day: next })
        .eq("id", userId);
      if (error) {
        // Roll back to the captured `prev` — direct restore, no
        // functional updater, so the rollback definitely uses the
        // pre-add value (not whatever the latest state was, which
        // could include other in-flight chip taps).
        setExtraCaffeineByDay(prev);
        console.error("[addCaffeineMg] persist failed:", error.message, error);
        Alert.alert("Couldn't save caffeine", error.message ?? "Try again.");
        return;
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
    [userId, dayKey, extraCaffeineByDay],
  );

  /** Batch 2.5 — alcohol quick-add (grams ethanol) for the selected day.
   *  Same persist-error rollback hardening as addCaffeineMg above
   *  (2026-04-26 round 3). Build 41 fix: same closure-capture
   *  workaround — see the long doc on `addCaffeineMg` for the
   *  React 18 functional-updater rationale. */
  const addAlcoholG = useCallback(
    async (grams: number, preset: string | null = null) => {
      if (!userId) return;
      const add = Math.max(0, Math.round(grams));
      if (add === 0) return;
      const prev = extraAlcoholGByDay;
      const next = pruneByDay({ ...prev, [dayKey]: (prev[dayKey] ?? 0) + add });
      setExtraAlcoholGByDay(next);
      const { error } = await supabase
        .from("profiles")
        .update({ extra_alcohol_g_by_day: next })
        .eq("id", userId);
      if (error) {
        setExtraAlcoholGByDay(prev);
        console.error("[addAlcoholG] persist failed:", error.message, error);
        Alert.alert("Couldn't save alcohol", error.message ?? "Try again.");
        return;
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
    [userId, dayKey, extraAlcoholGByDay],
  );

  /** Batch 2.5 — reset today's value for one of the three hydration rows.
   *
   * Build 41 (2026-05-01) — same React 18 functional-updater
   * closure-capture trap as `addCaffeineMg` / `addAlcoholG` /
   * `addWaterMl`. Compute `next` from the closure-captured map
   * before calling setState so the persist branch sees the value
   * directly. */
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
      let next: Record<string, number>;
      if (kind === "water") {
        next = apply(extraWaterByDay);
        if (next === extraWaterByDay) return; // no-op when day already empty
        setExtraWaterByDay(next);
      } else if (kind === "caffeine") {
        next = apply(extraCaffeineByDay);
        if (next === extraCaffeineByDay) return;
        setExtraCaffeineByDay(next);
      } else {
        next = apply(extraAlcoholGByDay);
        if (next === extraAlcoholGByDay) return;
        setExtraAlcoholGByDay(next);
      }
      await supabase.from("profiles").update({ [column]: next }).eq("id", userId);
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
    [userId, dayKey, extraWaterByDay, extraCaffeineByDay, extraAlcoholGByDay],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: {
          paddingHorizontal: Layout.todayScreenPaddingX,
          paddingBottom: Layout.screenPaddingBottom,
          gap: tierV1 ? Spacing.xl : Layout.todayScrollGap,
          paddingTop: Spacing.sm,
        },


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
        dateNavLabel: { color: colors.text, ...Type.headline },

        card: {
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderRadius: CARD_RADIUS,
          // Sloe: hairline (≈1 physical px), not 1pt (3px on @3x) — a 1pt
          // border read "boxed" vs the prototype's subtle `border border-line`
          // (1px-in-a-500px-frame). The Sloe `line` colour is already used.
          borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
          padding: Spacing.lg,
          gap: Spacing.md,
          ...(cardElevation.shadowStyle ?? {}),
        },
        // headers census 2026-06-10: card-header ink colors.text → navPrimary
        // (matches the canonical TodayActivityCard treatment). Currently unused
        // in this legacy file but converged so a revival inherits the grammar.
        cardTitle: { ...Type.headline, color: colors.navPrimary },

        macroBarBlock: { gap: Spacing.xs, paddingVertical: Spacing.sm },
        macroBarTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
        macroBarTitle: { ...Type.label },
        macroBarNums: { ...Type.caption, color: colors.textTertiary, fontVariant: ["tabular-nums"] },
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
        calorieMathNumber: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"], letterSpacing: -0.3 },
        calorieMathLabel: { ...Type.caption, color: colors.textSecondary, marginTop: 2 },
        calorieMathOp: { ...Type.headline, color: colors.textTertiary },

        // Meal sections
        mealSlotHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        mealSlotName: { ...Type.headline, color: colors.text },
        mealSlotCals: { ...Type.body, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
        mealSlotMacros: { ...Type.caption, color: colors.textSecondary },
        mealRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: Spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        mealName: { ...Type.body, color: colors.text },
        mealMeta: { ...Type.caption, color: colors.textTertiary, marginTop: 2 },
        mealCals: { ...Type.headline, color: colors.text, fontVariant: ["tabular-nums"] },

        addFoodBtn: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingVertical: Spacing.dense,
          alignItems: "center",
          backgroundColor: colors.backgroundSecondary,
        },
        addFoodBtnText: { color: colors.textSecondary, ...Type.caption, fontWeight: "600" },

        emptyText: { color: colors.textTertiary, textAlign: "center", ...Type.bodyMuted },

        // Add food form
        input: {
          backgroundColor: colors.inputBg,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          color: colors.text,
          ...Type.body,
        },
        inputRow: { flexDirection: "row", gap: Spacing.sm },
        // Sloe treatment system (2026-06-08): the quick-add submit is a
        // primary inline CTA → aubergine OUTLINE (transparent fill + 1.5px
        // primarySolid border + primarySolid label). Used only by
        // <TodayAddFoodForm>; the sibling "Search" button overrides to the
        // off-white secondary fill there.
        submitBtn: {
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderColor: accent.primarySolid,
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: "center",
        },
        submitBtnText: { color: accent.primarySolid, ...Type.headline },

        // Audit 2026-05-04 #34: previously a full-card offline banner
        // crowded the Today top and looked like a content row. Slim pill
        // (~36pt height) sits above the hero ring without stealing
        // vertical rhythm from the macro tiles below.
        offlineBanner: {
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.xs,
          backgroundColor: colors.card,
          borderRadius: 999,
          paddingVertical: Spacing.xs,
          paddingHorizontal: Spacing.md,
          borderWidth: 1,
          borderColor: accent.primary + "30",
          alignSelf: "flex-start",
        },
        offlineBannerText: { ...Type.caption, fontWeight: "600", color: colors.text },

      }),
    [colors, cardElevation, accent],
  );

  const loadJournal = useCallback(async () => {
    // Without a uid there is nothing to fetch — still flip `hydrated`
    // so we never strand the user on the skeleton if a focus/effect
    // ordering bug calls `loadJournal` before `session.user.id` exists.
    if (!userId) {
      setHydrated(true);
      return;
    }
    // 2026-05-15 (ENG-543): dedup parallel calls. Today previously
    // fired `loadJournal` from 3 paths per focus (reactive on
    // `selectedDate`, primary `useFocusEffect`, post-HealthKit-sync
    // `useFocusEffect`). Each call costs a Supabase round-trip. Skip
    // any caller that arrives while another fetch is still in flight.
    // The legitimate after-HealthKit-sync reload still runs because
    // it's awaited *after* the earlier fetch completes.
    if (loadJournalInFlightRef.current) return;
    loadJournalInFlightRef.current = true;

    // 2026-05-16: timing instrumentation so we can MEASURE whether the
    // ENG-542 window + ENG-543 dedup actually paid off. Reported on
    // every successful load (skipped path doesn't emit; would inflate
    // p50 with zero-time samples). PostHog flag-able via
    // `today_journal_loaded_ms`.
    const loadStartedAt = Date.now();

    // Defence (2026-05-03): wrap the whole load in try/finally so
    // `hydrated` ALWAYS flips true, even if a supabase call throws
    // (network failure, RLS denial). Without this guarantee Today
    // sits on a perpetual skeleton on the sad path. setLoadError is
    // only called inside the explicit error-object branch — not in
    // a thrown-rejection path — so the visible recovery used to be
    // "skeleton forever" rather than "Couldn't load + retry".
    try {

    const PLANNED_MEALS_TIMEOUT_MS = 18_000;
    const journalRaceTimeout = Symbol("journal_race_timeout");
    async function raceJournal<T>(
      label: string,
      ms: number,
      p: Promise<T>,
    ): Promise<T | typeof journalRaceTimeout> {
      const out = await Promise.race([
        p,
        new Promise<typeof journalRaceTimeout>((resolve) => {
          setTimeout(() => resolve(journalRaceTimeout), ms);
        }),
      ]);
      if (out === journalRaceTimeout) {
        console.warn(`[tracker] ${label} timed out (${ms}ms)`);
      }
      return out;
    }

    // M9 (2026-04-21) — `nutrition_entries` + `meal_plan_days` for the
    // journal; `meal_plan_meals` follows once `planDayId` is known.
    //
    // 2026-05-03 — a single `Promise.race` on `Promise.all([…])` meant
    // ANY hung query failed BOTH: e.g. a stuck `meal_plan_days` call
    // torched a healthy `nutrition_entries` result. Race each query
    // independently (still `Promise.all` so wall time is max of the two
    // caps, not the sum).
    const JOURNAL_ENTRIES_TIMEOUT_MS = 45_000;
    const MEAL_PLAN_DAYS_TIMEOUT_MS = 15_000;
    // 2026-05-15 (ENG-542): window to the last 35 days. Covers the
    // week-strip (7d) + trailing analytics (~28d). The .limit(20_000)
    // guard removed (ENG-705): the 35-day date filter is the correct
    // bound; the row cap was misleading and would silently truncate a
    // dense import user within the window.
    const WINDOW_DAYS = 35;
    const windowStart = new Date();
    windowStart.setUTCHours(0, 0, 0, 0);
    windowStart.setUTCDate(windowStart.getUTCDate() - WINDOW_DAYS);
    const windowStartKey = windowStart.toISOString().slice(0, 10);
    const activePlanSlotId = await readActiveCloudMealPlanSlotId();
    const entriesPromise = (async () =>
      await supabase
        .from("nutrition_entries")
        // Schema refactor Phase 2 (2026-05-11) — select recipe_id so
        // the loaded JournalMeal can carry the typed FK link. The
        // copy/duplicate path uses it to clone; future surfaces (e.g.
        // "open the recipe behind this log") rely on it being present.
        .select("id, date_key, name, recipe_title, time_label, calories, protein, carbs, fat, fiber_g, water_ml, portion_multiplier, source, created_at, eaten_at, nutrition_micros, recipe_id")
        .eq("user_id", userId)
        .gte("date_key", windowStartKey)
        .order("date_key", { ascending: true })
        .order("created_at", { ascending: true }))();
    const planDaysPromise = (async () =>
      await supabase
        .from("meal_plan_days")
        // T7 (2026-04-24): SELECT start_date so the resolver uses the
        // persisted anchor instead of iterating [0,1,7] offsets.
        .select("id, day, start_date")
        .eq("user_id", userId)
        .eq("slot_id", activePlanSlotId)
        .order("day", { ascending: true }))();

    const [entriesPack, planDaysPack] = await Promise.all([
      raceJournal("nutrition_entries", JOURNAL_ENTRIES_TIMEOUT_MS, entriesPromise),
      raceJournal("meal_plan_days", MEAL_PLAN_DAYS_TIMEOUT_MS, planDaysPromise),
    ]);

    const entriesTimedOut = entriesPack === journalRaceTimeout;
    const rows =
      entriesTimedOut ? [] : (entriesPack.data ?? []);
    const error = entriesTimedOut ? null : entriesPack.error;

    if (entriesTimedOut) {
      console.warn("[tracker] nutrition_entries timed out");
      setLoadError(
        "Your journal is taking too long to load. Check your network, then switch tabs and return to Today.",
      );
    }

    const planDayRows =
      planDaysPack === journalRaceTimeout
        ? null
        : ((planDaysPack.data ?? []) as { id: string; day: number; start_date?: string | null }[]);
    if (planDaysPack === journalRaceTimeout) {
      console.warn("[tracker] meal_plan_days timed out");
    }

    const planDayId =
      planDayRows && planDayRows.length > 0
        ? findPlanDayIdForCalendarDate(
            planDayRows as { id: string; day: number; start_date?: string | null }[],
            selectedDate,
          )
        : null;

    let loaded: ByDay = {};

    if (error) {
      // Schema refactor Phase 3 (2026-05-11) — the legacy
      // `nutrition_journals` JSONB fallback was deleted along with
      // its shim. The table was dropped 2026-04-21 so the fallback
      // always returned null in production anyway. `looksLikeMissingTableError`
      // can no longer fire (nutrition_entries is the only path), so
      // any error here is a real load failure that should surface to
      // the user.
      console.error("[tracker] load failed:", error.message ?? "");
      setLoadError("Could not load your journal.");
      setByDay({});
    } else {
      if (!entriesTimedOut) {
        setLoadError(null);
      }
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
          eatenAt: (r as { eaten_at?: string | null }).eaten_at ?? undefined,
          // Schema refactor Phase 2 (2026-05-11) — carry the typed FK
          // through into the in-memory JournalMeal so the copy /
          // duplicate path can clone with recipe_id intact.
          recipeId: (r as { recipe_id?: string | null }).recipe_id ?? undefined,
        });
      }
      // Schema refactor Phase 3 (2026-05-11) — legacy by_day JSONB
      // fallback removed. An empty `nutrition_entries` just means an
      // empty journal; we no longer try the deleted legacy table.
      setByDay((prev) => mergeJournalByDay(loaded, prev));
      // Audit/2026-04-30 — pre-populate the HealthKit-meal-write dedupe
      // set with every meal that already exists in the journal at load
      // time. This ensures the debounced sync effect only writes meals
      // the user logs AFTER this feature shipped — not historical rows
      // that pre-date Apple Health export.
      const existingIds = (rows ?? [])
        .map((r) => r.id as string)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      void primeWrittenMealIds(userId, existingIds);
    }

    // Planned meals for the journal `selectedDate`: `meal_plan_days.day`
    // is plan index 1..7 (same as Plan tab), not weekday — match via
    // calendar date + start offsets (today / tomorrow / next week).
    // 2026-05-03 — race each await: a setTimeout-only "timeout" does NOT
    // unblock the JS call stack — if PostgREST never settles, we never
    // reach the outer `finally` and `hydrated` stays false (skeleton).
    const plannedMealsRaceTimeout = Symbol("planned_meals_race_timeout");
    async function racePlannedMeals<T>(
      p: Promise<T>,
    ): Promise<T | typeof plannedMealsRaceTimeout> {
      return await Promise.race([
        p,
        new Promise<typeof plannedMealsRaceTimeout>((resolve) => {
          setTimeout(() => resolve(plannedMealsRaceTimeout), PLANNED_MEALS_TIMEOUT_MS);
        }),
      ]);
    }

    if (planDayId) {
      const mealRes = await racePlannedMeals(
        (async () =>
          await supabase
            .from("meal_plan_meals")
            .select("name, recipe_title, calories, protein, carbs, fat, recipe_id")
            .eq("plan_day_id", planDayId)
            .order("slot_index", { ascending: true }))(),
      );
      if (mealRes === plannedMealsRaceTimeout) {
        console.warn(`[tracker] meal_plan_meals timed out (${PLANNED_MEALS_TIMEOUT_MS}ms)`);
        setPlannedMeals([]);
      } else {
        const { data: mealRows } = mealRes;
        if (mealRows && mealRows.length > 0) {
          setPlannedMeals(
            mealRows.map((m) => {
              const coerced = coerceMacrosWhenCaloriesButNoGrams({
                calories: (m.calories as number) ?? 0,
                protein: (m.protein as number) ?? 0,
                carbs: (m.carbs as number) ?? 0,
                fat: (m.fat as number) ?? 0,
              });
              return {
                name: (m.name as string) ?? "",
                recipe_title: (m.recipe_title as string) ?? "",
                calories: coerced.calories,
                protein: coerced.protein,
                carbs: coerced.carbs,
                fat: coerced.fat,
                recipe_id: (m.recipe_id as string | null) ?? null,
              };
            }),
          );
        } else {
          setPlannedMeals([]);
        }
      }
    } else {
      // Schema refactor Phase 3 (2026-05-11) — legacy `meal_plans`
      // JSONB fallback removed (table was dropped 2026-04-21).
      // No plan_day_id resolves to no planned meals; the relational
      // path is the only one we trust now.
      setPlannedMeals([]);
    }

    } catch (err) {
      console.error("[loadJournal] threw:", err);
      setLoadError("Could not load your journal.");
    } finally {
      // Always flip hydrated true so the skeleton clears even on the
      // sad path. Falls through to either the loadError retry UI or
      // an empty Today shell rather than skeleton-forever.
      setHydrated(true);
      loadJournalInFlightRef.current = false;
      // 2026-05-16 (ENG-553): emit per-load timing so we can see if the
      // ENG-542 window + ENG-543 dedup paid off in production. Fire on
      // both success + error paths so a skewed slow-error distribution
      // is still visible. Truncated to int ms.
      try {
        track(AnalyticsEvents.today_journal_loaded_ms, {
          duration_ms: Date.now() - loadStartedAt,
        });
      } catch {
        /* analytics is best-effort */
      }
    }
  }, [userId, selectedDate]);

  // Re-resolve planned meals when the journal date changes (focus alone
  // does not re-run when the user stays on this tab and swipes dates).
  useEffect(() => {
    if (!userId) return;
    void loadJournal();
  }, [selectedDate, userId, loadJournal]);

  // ENG-879 — Health Sync → Sync Now can insert rows while Today stays mounted.
  useEffect(() => {
    if (!userId) return;
    return subscribeJournalRefresh(() => {
      void loadJournal();
    });
  }, [userId, loadJournal]);

  // Reload journal + targets every time this tab comes into focus.
  //
  // Parity spec 2026-04-27 (mobile target edits) §5.5 — also read +
  // clear the `suppr.profile.targets.dirty` AsyncStorage flag set by
  // `app/profile.tsx` on a successful target save. The current per-
  // focus `loadProfileTargets` already covers this, so the flag clear
  // is forward-defensive against future short-circuiting; it also
  // gives us a single source of truth for "the user just edited
  // targets". Read failures are non-fatal — `loadProfileTargets` runs
  // unconditionally regardless.
  useFocusEffect(
    useCallback(() => {
      void loadJournal();
      void loadProfileTargets();
      if (userId) void refreshSavedLibraryRecipes();
      AsyncStorage.removeItem(PROFILE_TARGETS_DIRTY_KEY).catch(() => {
        /* non-fatal — targets already re-read above */
      });
    }, [loadJournal, loadProfileTargets, userId, refreshSavedLibraryRecipes]),
  );

  // Log sheet Library tab uses `savedLibraryRecipes`; refresh when the
  // sheet opens so a title edited on Library / recipe detail is current.
  useEffect(() => {
    if (fabSheetOpen && userId) void refreshSavedLibraryRecipes();
  }, [fabSheetOpen, userId, refreshSavedLibraryRecipes]);

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

  // Pull steps / weight / active energy from HealthKit into `profiles`,
  // then refresh targets + journal. 2026-05-16: extracted to
  // `hooks/useHealthSyncOnFocus` — first sliver of the Today
  // God-component split. Behaviour unchanged.
  useHealthSyncOnFocus(userId, loadProfileTargets);

  // Sync journal to relational nutrition_entries table.
  // 2026-05-16 — extracted to `hooks/useNutritionEntriesSync` (Today
  // split #3). Same 600ms debounce, same downstream adaptive-TDEE +
  // target-snapshot + HealthKit-write side-effects.
  useNutritionEntriesSync({ userId, hydrated, byDay, selectedDate });

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
      source: "manual",
      ...(isFeatureEnabled("editable_eaten_at")
        ? { eatenAt: defaultEatenAtForNewLog(dayKey, profileTimeZone) }
        : {}),
    };
    setByDay((prev) => ({
      ...prev,
      [dayKey]: [...(prev[dayKey] ?? []), meal],
    }));
    // 2026-05-08 data-loss hotfix — immediate Supabase persist (was
    // relying on the fragile 600ms debounce that lost ~25 days of
    // Grace's data on TestFlight reinstall). Commit confirm haptic fires
    // once inside the funnel (ENG-1016).
    void persistMealsImmediate(dayKey, [meal]);
    setTitle("");
    setKcal("");
    setProtein("");
    setCarbs("");
    setFat("");
    setAddOpen(false);
  }, [dayKey, kcal, protein, carbs, fat, title, activeMealSlot, persistMealsImmediate, profileTimeZone]);

  const deleteMeal = useCallback((mealId: string) => {
    // F-74 / F-103 (2026-05-07) — delete is now stimulant-side
    // self-healing because per-meal `micros` is the canonical SoT.
    const removedMeal = (byDay[dayKey] ?? []).find((m) => m.id === mealId);
    setByDay((prev) => ({
      ...prev,
      [dayKey]: (prev[dayKey] ?? []).filter((m) => m.id !== mealId),
    }));

    // Persist deletion to Supabase (relational table).
    // Without this, the meal reappears on next app launch.
    if (userId) {
      // F-130 (2026-05-07) — for HK-imported rows, capture the
      // health_sample_id BEFORE delete so we can tombstone it.
      // Without the tombstone, the next HK sync re-imports the
      // sample and the user-perceived "duplicate" reappears.
      void supabase
        .from("nutrition_entries")
        .select("source, health_sample_id")
        .eq("id", mealId)
        .maybeSingle()
        .then(async ({ data }) => {
          const row = data as { source?: string | null; health_sample_id?: string | null } | null;
          if (row?.source === "apple_health" && row.health_sample_id) {
            const { markHealthSampleDeleted } = await import(
              "../../lib/deletedHealthSamples"
            );
            void markHealthSampleDeleted(row.health_sample_id);
          }
          const { error } = await supabase
            .from("nutrition_entries")
            .delete()
            .eq("id", mealId);
          if (error) {
            // ENG-1123 — mirror web `removeLoggedMeal`: restore the row and
            // surface a retry message instead of silently losing sync.
            if (removedMeal) {
              setByDay((prev) => {
                const day = prev[dayKey] ?? [];
                if (day.some((m) => m.id === mealId)) return prev;
                return { ...prev, [dayKey]: [...day, removedMeal] };
              });
            }
            const { syncFailedRetryMessage } = await import("@/lib/supabaseErrors");
            Alert.alert("Delete failed", syncFailedRetryMessage("nutrition log", error.message));
          }
        });
    }
  }, [byDay, dayKey, userId]);

  const presentLogSheetConfirmation = useCallback(
    (payload: { title: string; kcal: number; mealIds: string[] }) => {
      setLogSheetConfirmation({
        title: payload.title,
        kcal: Math.round(payload.kcal),
        slot: activeMealSlot,
        onDone: () => {
          setLogSheetConfirmation(null);
          setFabSheetOpen(false);
        },
        onUndo: () => {
          for (const mealId of payload.mealIds) deleteMeal(mealId);
          setLogSheetConfirmation(null);
        },
      });
    },
    [activeMealSlot, deleteMeal],
  );

  const commitLogSheetFoodSelection = useCallback(
    (result: FoodSearchSelectedFood): { id: string; title: string; kcal: number } => {
      const scaled = foodSelectionToMealMacros(result);
      const {
        calories: mealCalories,
        protein: mealProtein,
        carbs: mealCarbs,
        fat: mealFat,
        fiberG: mealFiberG,
        micros,
      } = scaled;
      const source =
        result.source === "CUSTOM"
          ? "custom_food"
          : result.source === "OFF"
            ? "Open Food Facts"
            : result.source === "Edamam"
              ? "Edamam"
              : result.source === "FatSecret"
                ? "FatSecret"
                : "USDA FoodData Central";
      const eatenAt =
        result.eatenAt ??
        (isFeatureEnabled("editable_eaten_at")
          ? defaultEatenAtForNewLog(dayKey, profileTimeZone)
          : undefined);
      const { dateKey: resolvedDateKey } = nutritionEntryDateKeyAndEatenAt(
        { eatenAt },
        dayKey,
        null,
        { timeZone: profileTimeZone },
      );
      const meal: JournalMeal = {
        id: newMealId(),
        name: activeMealSlot,
        recipeTitle: result.name,
        time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        calories: mealCalories,
        protein: mealProtein,
        carbs: mealCarbs,
        fat: mealFat,
        source,
        ...(mealFiberG > 0 ? { fiberG: mealFiberG } : {}),
        ...(Object.keys(micros).length > 0 ? { micros } : {}),
        ...(result.imageUrl ? { recipeImageUrl: String(result.imageUrl).trim() } : {}),
        ...(eatenAt ? { eatenAt } : {}),
      };
      startTransition(() => {
        setByDay((prev) => ({
          ...prev,
          [resolvedDateKey]: [...(prev[resolvedDateKey] ?? []), meal],
        }));
      });
      void persistMealsImmediate(dayKey, [meal]);
      try {
        track(AnalyticsEvents.food_logged, {
          source: foodSelectionAnalyticsSource(result.source),
          calories: meal.calories,
          slot: activeMealSlot,
        });
      } catch {
        // noop
      }
      return { id: meal.id, title: result.name, kcal: mealCalories };
    },
    [activeMealSlot, dayKey, persistMealsImmediate, profileTimeZone],
  );

  const logHistoryItemFromSheet = useCallback(
    (item: FoodHistoryItem) => {
      const micros: Record<string, number> = item.micros ? { ...item.micros } : {};
      if (item.caffeineMg != null && item.caffeineMg > 0) micros.caffeineMg = item.caffeineMg;
      if (item.alcoholG != null && item.alcoholG > 0) micros.alcoholG = item.alcoholG;
      const meal: JournalMeal = {
        id: newMealId(),
        name: activeMealSlot,
        recipeTitle: item.recipeTitle,
        ...(item.recipeId ? { recipeId: item.recipeId } : {}),
        time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        ...(item.fiber != null ? { fiberG: item.fiber } : {}),
        ...(item.source ? { source: item.source } : {}),
        ...(Object.keys(micros).length > 0 ? { micros } : {}),
        ...(isFeatureEnabled("editable_eaten_at")
          ? { eatenAt: defaultEatenAtForNewLog(dayKey, profileTimeZone) }
          : {}),
      };
      startTransition(() => {
        setByDay((prev) => ({
          ...prev,
          [dayKey]: [...(prev[dayKey] ?? []), meal],
        }));
      });
      // Commit confirm haptic fires once inside the funnel (ENG-1016).
      void persistMealsImmediate(dayKey, [meal]);
      try {
        track(AnalyticsEvents.food_logged, { source: "quick_add", slot: activeMealSlot });
      } catch {
        // noop
      }
      presentLogSheetConfirmation({
        title: item.recipeTitle,
        kcal: item.calories,
        mealIds: [meal.id],
      });
    },
    [activeMealSlot, dayKey, persistMealsImmediate, presentLogSheetConfirmation, profileTimeZone],
  );

  const logSheetGoTos = useMemo(() => {
    const slot = normaliseMealSlot(activeMealSlot);
    if (!slot) return [];
    return computeSlotGoToFoods(byDay, slot).map((item) => ({
      id: foodHistoryKey(item.recipeTitle, item.calories),
      title: item.recipeTitle,
      kcal: Math.round(item.calories),
      source: mapMealSourceToDot(item.source),
      count: item.count,
    }));
  }, [byDay, activeMealSlot]);

  const logBasketSummary = useMemo(() => {
    let totalKcal = 0;
    const items = logBasket.map(({ basketId, selection }) => {
      const kcal = foodSelectionToMealMacros(selection).calories;
      totalKcal += kcal;
      return { id: basketId, title: selection.name, kcal: Math.round(kcal) };
    });
    return { items, totalKcal };
  }, [logBasket]);

  const commitLogBasket = useCallback(() => {
    if (logBasket.length === 0) return;
    const mealIds: string[] = [];
    let totalKcal = 0;
    let firstTitle = "";
    for (const { selection } of logBasket) {
      const result = commitLogSheetFoodSelection(selection);
      mealIds.push(result.id);
      totalKcal += result.kcal;
      if (!firstTitle) firstTitle = result.title;
    }
    setLogBasket([]);
    presentLogSheetConfirmation({
      title: logBasket.length === 1 ? firstTitle : `${logBasket.length} items`,
      kcal: totalKcal,
      mealIds,
    });
  }, [logBasket, commitLogSheetFoodSelection, presentLogSheetConfirmation]);

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
    async (targetDayKey: string, clones: Omit<JournalMeal, "id">[]): Promise<number> => {
      if (clones.length === 0) return 0;
      // Re-anchor each clone's `eatenAt` onto the TARGET day (preserving
      // wall-clock time) before it ever reaches memory or the DB — clones
      // keep the source-day instant, and `buildNutritionEntryRow` derives
      // `date_key` from `eaten_at`, so skipping this would bucket the copy
      // back onto the source day (launch-audit 2026-06-12 copy-path fix).
      const withIds: JournalMeal[] = clones.map((c) =>
        reanchorMealEatenAt(
          { ...c, id: newMealId() } as JournalMeal,
          targetDayKey,
          { timeZone: profileTimeZone },
        ),
      );
      setByDay((prev) => ({
        ...prev,
        [targetDayKey]: [...(prev[targetDayKey] ?? []), ...withIds],
      }));
      // Copy / duplicate is a log commit — fire the canonical commit confirm
      // beat (Medium, ENG-1016) through the shared funnel ref rather than a
      // bespoke raw Light call. This path does its own insert (below) instead
      // of `persistMealsImmediate`, so the funnel haptic is invoked here.
      confirmLogHapticRef.current();
      if (!userId) return withIds.length;
      // Single shared row shape (launch-audit P1-2 consolidation) — the
      // builder guarantees `eaten_at` + the eaten-derived `date_key` are
      // present (re-anchored above, so date_key === targetDayKey) and keeps
      // the recipe_id FK propagation from Schema refactor Phase 2.
      const dbRows = withIds.map((m) =>
        buildNutritionEntryRow(m, targetDayKey, userId, profileTimeZone),
      );
      const { error } = await supabase.from("nutrition_entries").insert(dbRows);
      if (error) {
        console.error("[tracker] copy/duplicate insert failed:", error.message);
        // ENG-1125 — queue for retry; keep optimistic rows visible.
        const queue = await loadJournalWriteQueue();
        await saveJournalWriteQueue(
          enqueueJournalUpserts(
            queue,
            targetDayKey,
            dbRows as ReadonlyArray<Record<string, unknown>>,
          ),
        );
        Alert.alert(
          "Saved on this device",
          "We'll sync this log when you're back online.",
        );
        return withIds.length;
      }
      void refreshAdaptiveTdeeForUser(supabase, userId);
      // F-2 — snapshot today's target regardless of `targetDayKey`
      // (back-dating a snapshot would defeat the purpose).
      void snapshotDailyTargetIfMissing(supabase, userId);
      // Tracking-extras autoupdate (2026-05-02) — close the mobile
      // F-74 / F-103 fix (2026-05-07): per-meal micros canonical SoT —
      // duplicate-day clones carry `micros.caffeineMg` / `alcoholG`
      // forward via `cloneMealWithoutId`, so the target day's chip
      // totals re-sum from `byDay` at render. No ledger bump here.
      // Audit/2026-04-30 — per-meal HK write for the copied rows.
      // Cloned meals are minted with fresh ids so the dedupe set
      // doesn't suppress them; the user just logged a real meal on
      // `targetDayKey`. Same idempotency rules as the debounce path.
      for (const m of withIds) {
        void writeMealToHealthKitIfEnabled({
          mealId: m.id,
          userId,
          name: m.recipeTitle || m.name,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          fiberG: m.fiberG ?? null,
          date: new Date().toISOString(),
          source: m.source ?? null,
          origin: "duplicate",
        });
      }
      return withIds.length;
    },
    [profileTimeZone, userId],
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
    const chronIso =
      meal.eatenAt ??
      meal.createdAt ??
      defaultEatenAtForNewLog(dateKeyFromDate(selectedDate), profileTimeZone);
    setEditEatenAtTime(localTimeInputValueFromIso(chronIso, profileTimeZone));
  }, [profileTimeZone, selectedDate]);

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
    // The edit sheet only exposes kcal/P/C/F fields, so fibre + every micro
    // (sugar, sodium, vitamins…) must scale with the portion delta — the ratio
    // of the new portion to the portion the entry was opened at. Without this
    // they rode through the `...editingMeal` spread unchanged, so a 0.5× portion
    // edit halved the four macros but left fibre/sugar/sodium at the old amount.
    const p0 = editingMeal.portionMultiplier && editingMeal.portionMultiplier > 0 ? editingMeal.portionMultiplier : 1;
    const localTime = isFeatureEnabled("editable_eaten_at")
      ? parseLocalTimeInput(editEatenAtTime)
      : null;
    const { dateKey: resolvedDateKey, eatenAt } = nutritionEntryDateKeyAndEatenAt(
      editingMeal,
      dayKey,
      localTime,
      { timeZone: profileTimeZone },
    );
    const updated: JournalMeal = {
      ...editingMeal,
      recipeTitle: editTitle.trim() || editingMeal.recipeTitle,
      name: editSlot,
      calories: Math.round(Number(editKcal) || editingMeal.calories),
      protein: Math.round((Number(editProtein) || 0) * 10) / 10,
      carbs: Math.round((Number(editCarbs) || 0) * 10) / 10,
      fat: Math.round((Number(editFat) || 0) * 10) / 10,
      portionMultiplier: portionMul,
      ...(eatenAt ? { eatenAt } : {}),
      ...scaleLoggedMealFiberAndMicros({
        fiberG: editingMeal.fiberG,
        micros: editingMeal.micros,
        ratio: portionMul / p0,
      }),
    };
    setByDay((prev) => {
      const without = (prev[dayKey] ?? []).filter((m) => m.id !== editingMeal.id);
      if (resolvedDateKey === dayKey) {
        return { ...prev, [dayKey]: [...without, updated] };
      }
      return {
        ...prev,
        [dayKey]: without,
        [resolvedDateKey]: [...(prev[resolvedDateKey] ?? []), updated],
      };
    });
    // 2026-05-08 data-loss hotfix — immediate Supabase update.
    void persistMealUpdateImmediate(updated.id, updated, dayKey);
    setEditingMeal(null);
  }, [
    editingMeal,
    editTitle,
    editSlot,
    editKcal,
    editProtein,
    editCarbs,
    editFat,
    editPortion,
    editEatenAtTime,
    dayKey,
    persistMealUpdateImmediate,
    profileTimeZone,
  ]);

  const logPlannedMealWithPortion = useCallback(
    async (
      pm: { name?: string; recipe_title?: string; calories?: number; protein?: number; carbs?: number; fat?: number; recipe_id?: string | null },
      portion: number,
    ) => {
      if (!userId) return;
      const mult = Math.max(0.125, Math.min(24, portion));
      const entryId = newMealId();
      const dk = dateKeyFromDate(selectedDate);
      // Pull fiber/sugar/sodium off the saved recipe row so the journal
      // entry carries more than just kcal/P/C/F. `meal_plan_meals`
      // doesn't store these (migration 20260413100000), but `recipes`
      // does via the verify flow.
      const microsRes = await fetchPlannedMealMicros(
        supabase as unknown as SupabaseLike,
        pm.recipe_id ?? null,
        mult,
      );
      // T4 (full-sweep 2026-04-24): refuse to log when the underlying
      // recipe has kcal but no ingredient macros — the values in `pm`
      // are the neutral 28/42/30 split from `coerceMacrosWhenCaloriesByNoGrams`,
      // not real nutrition. Per the project rule "if nutrition is
      // uncertain, do not guess", route the user to Verify first.
      if (microsRes.macrosAreCoerced) {
        Alert.alert(
          "Verify this recipe first",
          "This recipe has calories but no ingredient macros yet. Logging now would save estimated values. Open the recipe and tap Verify to match ingredients for accurate nutrition.",
          [{ text: "OK", style: "default" }],
        );
        return;
      }

      const fetchedTitle = await fetchMobileCanonicalRecipeTitle(pm.recipe_id);
      const { name: logSlotName, recipeTitle: logRecipeTitle } = resolvePlannedMealLogTitles({
        slotName: pm.name,
        recipeTitle: pm.recipe_title,
        fetchedTitle,
      });

      // P1-12 (2026-04-25): optimistic insert into byDay so the journal
      // updates instantly. On server error, roll back the optimistic
      // entry and surface the error. Same shape as
      // `insertClonedRowsIntoDay` (the existing copy/duplicate path).
      const optimisticMeal: JournalMeal = {
        id: entryId,
        name: logSlotName,
        recipeTitle: logRecipeTitle,
        ...(pm.recipe_id ? { recipeId: pm.recipe_id } : {}),
        time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        calories: Math.round((pm.calories ?? 0) * mult),
        protein: Math.round((pm.protein ?? 0) * mult * 10) / 10,
        carbs: Math.round((pm.carbs ?? 0) * mult * 10) / 10,
        fat: Math.round((pm.fat ?? 0) * mult * 10) / 10,
        fiberG: microsRes.fiberG ?? undefined,
        waterMl: undefined,
        micros: Object.keys(microsRes.micros).length > 0 ? microsRes.micros : undefined,
        portionMultiplier: mult,
        source: "Recipe",
      } as JournalMeal;
      setByDay((prev) => ({
        ...prev,
        [dk]: [...(prev[dk] ?? []), optimisticMeal],
      }));

      // Single shared row shape (launch-audit P1-2 consolidation). Fresh
      // planner log → no `eatenAt` on the optimistic meal → `eaten_at: null`
      // with `date_key: dk`, byte-identical to the previous inline literal
      // ("Recipe" is already canonical, recipe_id FK propagates via the
      // builder — Schema refactor Phase 2 semantics preserved).
      const { error } = await supabase
        .from("nutrition_entries")
        .insert(buildNutritionEntryRow(optimisticMeal, dk, userId, profileTimeZone));
      if (error) {
        // Roll back the optimistic add and tell the user.
        setByDay((prev) => ({
          ...prev,
          [dk]: (prev[dk] ?? []).filter((m) => m.id !== entryId),
        }));
        Alert.alert("Log failed", error.message);
      } else {
        // Reconcile against the canonical row (covers any server-side
        // computed columns; safe no-op on success). Cheaper than the
        // pre-fix `loadJournal()` because byDay is already up to date.
        void loadJournal();
        // F-2 — snapshot today's target on first meal-plan log.
        void snapshotDailyTargetIfMissing(supabase, userId);
        // Audit/2026-04-30 — per-meal HK write for plan-tap log.
        void writeMealToHealthKitIfEnabled({
          mealId: entryId,
          userId,
          name: pm.recipe_title ?? pm.name ?? "Meal plan",
          calories: optimisticMeal.calories,
          protein: optimisticMeal.protein,
          carbs: optimisticMeal.carbs,
          fat: optimisticMeal.fat,
          fiberG: microsRes.fiberG ?? null,
          date: new Date().toISOString(),
          source: "Meal plan",
          origin: "plan",
        });
        // F-74 / F-103 fix (2026-05-07): per-meal micros canonical SoT.
        // The optimistic meal's `micros` map (populated above from
        // `fetchPlannedMealMicros`, scaled by `mult`) feeds
        // `caffeineFromMealsMg` / `alcoholByDayMerged` at render. No
        // ledger bump.
      }
    },
    [userId, selectedDate, loadJournal, profileTimeZone],
  );

  // Group meals by slot
  const mealGroups = useMemo(() => {
    const groups: Record<string, JournalMeal[]> = {};
    for (const m of mealsToday) {
      const slot = m.name || "Other";
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(m);
    }
    for (const slot of Object.keys(groups)) {
      groups[slot].sort(compareMealsByChronology);
    }
    return groups;
  }, [mealsToday]);

  /** ENG-786 — "Log again": re-insert a slot's current entries as fresh
   *  entries on the viewed day. Clones each `JournalMeal` with a new id +
   *  the current time, preserving the baked macros (kcal/P/C/F + fibre +
   *  micros + portionMultiplier), then appends + persists immediately.
   *  Source = `mealGroups[slot]`, so it re-logs exactly what the user sees
   *  in that slot. `createdAt` is dropped so the clone reads as a fresh
   *  log, not a copy of the original's timestamp. The new rows are
   *  individually swipe-removable (the v1 undo; ENG-786 P2 = a dedicated
   *  undo toast). Gated at the call site by `today_log_again`. */
  const logAgainSlot = useCallback(
    (slot: string) => {
      if (!userId) return;
      const source = mealGroups[slot] ?? [];
      if (source.length === 0) return;
      const timeLabel = new Date().toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      const clones: JournalMeal[] = source.map((m) => ({
        ...m,
        id: newMealId(),
        time: timeLabel,
        createdAt: undefined,
      }));
      setByDay((prev) => ({ ...prev, [dayKey]: [...(prev[dayKey] ?? []), ...clones] }));
      // Commit confirm haptic fires once inside the funnel (ENG-1016).
      void persistMealsImmediate(dayKey, clones);
      try {
        for (const m of clones) {
          track(AnalyticsEvents.food_logged, {
            source: "log_again",
            calories: m.calories,
            slot,
          });
        }
      } catch { /* analytics fire-and-forget */ }
    },
    [userId, mealGroups, dayKey, persistMealsImmediate],
  );

  const toggleSlotCollapse = useCallback((slot: string) => {
    setCollapsedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }, []);

  if (!hydrated && !loadError) {
    // Audit 2026-05-04 #7: previously the skeleton was static grey
    // blocks — visually indistinguishable from a crashed empty screen
    // (visual-qa called this out on the captured `state-03` shot). The
    // shared `<Shimmer>` primitive adds a 700ms opacity pulse that
    // unmistakably reads as "loading" rather than "broken". Reduce-
    // motion users get a static 0.6-opacity render automatically.
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.scroll}>
          <TodayLoadingSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View
      testID="screen-today"
      style={[styles.container, { paddingTop: insets.top, position: "relative" }]}
    >
      {/* Activation hooks (audit 2026-04-30) — mounted at the top of the
          container so the toast overlays the ScrollView and the modal
          renders above everything. The toast is absolute-positioned;
          the modal manages its own scrim. */}
      <FirstLogAcknowledgment
        visible={firstLogToastVisible}
        onDismiss={dismissFirstLogToast}
        topInset={insets.top + Spacing.sm}
      />
      <PostOnboardingPushExplainer
        visible={postOnbPushVisible}
        onSkip={onPostOnbPushSkip}
        onEnable={onPostOnbPushEnable}
      />
      {/* 2026-05-13 (TF feedback `AKmYHgZ7WA9uUUOSbjPtL2U` — "drag
          down to sync functionality"): pull-to-refresh on Today
          forces a HealthKit re-sync (steps + burn + weight) and
          re-pulls profile basics so the user can pull-down to
          force the data behind the ring to refresh on demand.
          Mirrors MFP / Cal AI / Lose It pattern. The
          `bypassThrottle: true` flag on `syncHealthDataThrottled`
          skips the 60s cool-down so the manual gesture always
          fires. */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isPullToRefreshing}
            onRefresh={async () => {
              setIsPullToRefreshing(true);
              if (process.env.EXPO_OS === "ios") {
                void Haptics.selectionAsync();
              }
              try {
                if (userId) {
                  await syncHealthDataThrottled(userId, { bypassThrottle: true });
                }
              } finally {
                setIsPullToRefreshing(false);
              }
            }}
          />
        }
      >
        {/* SLOE redesign (2026-06-03, `01 · Today` frame, Grace decision):
            the Today screen opens with a "Sloe" wordmark (left) + profile
            avatar (right) header — replacing the old "< Today >" date-nav
            row. The week strip below (rendered via the stripOnly date
            header) owns day-selection (taps); the calendar icon in the
            strip covers far dates. Order top→bottom is now: wordmark
            header → greeting → week strip → ring card. */}
        {/* Rhythm sweep ENG-1032 (2026-06-11): the wordmark row's
            `marginBottom: sm` double-stacked on the scroll container's
            `gap: todayScrollGap (8)` → a 16pt seam that matched neither the
            8pt header-cluster rhythm nor a deliberate break (measured
            seam, bd76ed95 method). Dropped — the scroll `gap` owns the seam
            to the greeting/strip below. `marginTop: xs` stays: it pairs with
            the scroll `paddingTop: sm` as the top inset against the screen
            edge, not a margin+gap stack against another element. */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: Spacing.xs,
          }}
        >
          <SloeHeaderWordmark testID="today-wordmark" />
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <GradientAvatar
              size={36}
              initial={session?.user?.email?.[0]?.toUpperCase() ?? "U"}
              fontSize={13}
              gradientIdSuffix="today-wordmark-header"
              // Figma `654:6` — damson fill + white initial (not the grey ink default).
              fill={Accent.purple}
              textColor={colors.primaryForeground}
            />
          </Pressable>
        </View>

        {/* SLOE redesign (2026-06-03, `01 · Today` frame): the hero opens
            with a centered Newsreader greeting + the long date, above the
            week strip + ring. On day view we greet by time-of-day + first
            name; on a historic day we show the day's date as the heading
            so the section still anchors which day is in view. The greeting
            revives the time-of-day opener the 2026-05-22 calm pass had
            dropped — reinstated as the warm-coaching hero per the Sloe
            direction. */}
        {viewMode === "day" ? (() => {
          const { headline, subline } = isToday
            ? {
                headline: todayGreeting(new Date().getHours(), greetingName),
                subline: todayLongDateSubline(selectedDate),
              }
            : todayPastDayGreetingLines(selectedDate);
          return (
          // Fresh-eyes §4 (2026-06-10): the centered two-line serif greeting
          // block spent ~25% of the viewport on header moments. Compacted to
          // ONE left-aligned sans context line (greeting · date) — the hero
          // number is the page's display moment now, not the greeting.
          // Rhythm sweep ENG-1032 (2026-06-11): self-margins dropped — the
          // greeting is a header-cluster member; the scroll `gap` (8) owns
          // both its seams (was margin+gap double-stacking, off-rhythm).
          <View>
            <Text testID="today-hero-greeting" numberOfLines={1}>
              <Text style={{ fontFamily: Type.body.fontFamily, fontSize: 14, fontWeight: "600", color: colors.text }}>
                {headline}
              </Text>
              {subline ? (
                <Text
                  testID="today-hero-greeting-subline"
                  style={{ fontFamily: Type.body.fontFamily, fontSize: 14, fontWeight: "400", color: colors.textSecondary }}
                >
                  {"  ·  " + subline}
                </Text>
              ) : null}
            </Text>
          </View>
          );
        })() : null}

        {/* Week strip (SLOE redesign 2026-06-03, `01 · Today` frame):
            the date header is now `stripOnly` — only the 7-day week
            strip renders here. The "< Today >" chevrons, the "Today"
            title, the avatar, and the day/week toggle have all moved
            out: app identity + Settings live in the Sloe wordmark
            header above, and day-selection lives in the strip (taps)
            + the strip's calendar icon (far dates). The nav callbacks
            (`onNavigatePrev`/`onNavigateNext`/`onTapTitle`) are still
            passed so the day/week helpers stay wired — they're now
            reachable only via the strip + calendar, which is intended.
            The header still owns the supportive streak-reset copy
            (rendered under the strip in `stripOnly` mode). */}
        {/* Sloe redesign (2026-06-08): airier rhythm to match Figma `654:2`
            (`mb-7` ≈ 28px between the week strip and the ring hero) — the
            strip→ring transition is the one deliberate break in the header.
            Rhythm sweep ENG-1032 (2026-06-11): was `marginBottom: lg (20)`
            which, on the scroll `gap (8)`, summed to a 28pt OFF-SCALE seam
            (measured, bd76ed95 method — snaps to neither 24 nor 32). Snapped
            onto the scale at `md (16)` so the break lands on a clean 24pt
            (16 + the 8pt gap) — the nearest on-scale value to the Figma 28px
            target, and the header's single intentional break vs the 8pt
            cluster rhythm above it. */}
        <View style={{ marginBottom: Spacing.md }}>
          <TodayDateHeader
          stripOnly
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedDate={selectedDate}
          weekLabel={weekData.label}
          isToday={isToday}
          formatDateLabel={formatDateLabel}
          weekStartDay={weekStartDay}
          loggedDays={loggedDays}
          protectedDateKeys={protectedDateKeys}
          onSelectDate={(d) => startTransition(() => setSelectedDate(clampJournalDate(d)))}
          onOpenCalendar={() => setJournalCalendarOpen(true)}
          onNavigatePrev={() => (viewMode === "week" ? navigateWeek(-1) : navigateDay(-1))}
          onNavigateNext={() => (viewMode === "week" ? navigateWeek(1) : navigateDay(1))}
          onTapTitle={() => { startTransition(() => setSelectedDate(new Date())); setViewMode("day"); }}
          avatarLetter={session?.user?.email?.[0]?.toUpperCase() ?? "U"}
          textColor={colors.text}
          textSecondaryColor={colors.textSecondary}
          textTertiaryColor={colors.textTertiary}
          cardColor={colors.card}
          cardBorderColor={colors.cardBorder}
          primaryForegroundColor={colors.primaryForeground}
          streakDays={protectedStreakLength}
          freezeProtected={protectedDateKeys.has(dateKeyFromDate(new Date()))}
          onStreakPress={() => router.push("/weekly-recap" as never)}
          streakResetCopyVisible={streakJustReset}
          // Canonical 2026-05-22: Day/Week toggle removed from Today.
          // Plan tab already shows the week; Today's job is the day.
          // Two surfaces, one job each. DayStrip (the 7-dot row) stays
          // because day-nav is the core Today affordance.
          hideViewModeToggle
          // Canonical 2026-05-22 C4: drop time-of-day greetings.
          // Premium calendar/data tools (Cron, Things 3, Notion) don't
          // greet — the page title alone is enough chrome. Greeting
          // was "Good morning / afternoon / evening" — now always
          // undefined so the date header skips the subtitle slot.
          dayGreeting={
            undefined
          }
        />
        </View>

        {isOffline && (
          <View style={styles.offlineBanner} accessibilityRole="alert">
            <CloudOff size={14} color={accent.primary} strokeWidth={1.75} />
            <Text style={styles.offlineBannerText}>{"Offline · syncing when you reconnect"}</Text>
          </View>
        )}

        {/* Error banner */}
        {loadError && (
          <Pressable
            onPress={() => { setLoadError(null); void loadJournal(); }}
            style={{ backgroundColor: Accent.destructive + "18", borderRadius: Radius.md, padding: Spacing.md, flexDirection: "row", alignItems: "center", gap: Spacing.sm }}
          >
            <AlertCircle size={18} color={Accent.destructive} strokeWidth={1.75} />
            <Text style={{ flex: 1, ...Type.caption, color: Accent.destructive, fontWeight: "600" }}>
              {loadError}
              {" Tap to retry."}
            </Text>
          </Pressable>
        )}

        {/* DC12 (2026-05-14, premium-bar audit) — Headspace-style
            supportive missed-day line. Renders only when the user
            (a) is on today's view, (b) has prior history, (c)
            logged nothing yesterday, and (d) it's not the first
            day of a fresh week (see `missedYesterdayVisible` memo
            for the full rule). No CTA, no destructive tone — the
            calm sub-line just reframes the gap and gets out of
            the way. Re-wired into the Sloe `01 · Today` layout
            (the 2026-06-04 re-skin dropped it with the old date-nav
            header); web keeps it, so this restores parity. */}
        {missedYesterdayVisible && (
          <Text
            testID="today-missed-yesterday-copy"
            style={{
              ...Type.caption,
              color: colors.textSecondary,
              textAlign: "center",
              paddingHorizontal: Spacing.md,
              marginTop: 2,
            }}
          >
            {MISSED_YESTERDAY_COPY}
          </Text>
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

        {/* Phase 4 / Top-5 #2 (2026-04-28) — Fasting pill moved into the
            unified context block below the hero; no standalone render
            here. See `docs/ux/teardown-2026-04-28-daily-loop.md` Top-5
            #2 for the priority rule (fasting > deficit; eat-again
            retired ENG-984, north-star below meals). */}

        {viewMode === "week" ? (
          <TodayWeekView
            days={weekData.days}
            weekTotals={weekData.weekTotals}
            weekAvg={weekData.weekAvg}
            daysWithFood={weekData.daysWithFood}
            weekEffectiveCalorieBudget={weekEffectiveCalorieBudget}
            weekBurnTotal={weekBurnTotal}
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
                workoutsByDay,
                profileMaintenanceSource,
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
            {/* Phase 4 / Top-5 #2 (2026-04-28) — Today's above-meals
                composition is capped at FOUR blocks (date header /
                hero / one context block / macro tiles). The previous
                layout stacked up to 13 blocks above the meals section
                with multiple aspirational prompts competing for the
                user's first 200 vertical pixels. Reference:
                `docs/ux/teardown-2026-04-28-daily-loop.md` §F1 + Top-5
                #2.

                Hero — single ring. Phase 5 (2026-04-30): the inline
                "Includes N AI-estimated meals" sentinel inside the
                hero card was removed — customer-lens flagged it as a
                defensive disclaimer that contradicted the 2026-04-27
                strategic direction (macro-tracker-first, not AI-
                first). The signal is now delivered once via
                `AiFirstLogTooltip` on the user's first AI meal row in
                `TodayMealsSection`, gated by AsyncStorage so it never
                fires twice.

                Feature 5 (2026-05-14, premium-bar audit) — wrapped in
                an Animated.View driven by `heroFadeAnim`. First focus
                after mount fades 0.85 → 1.0 over 200ms; subsequent
                focuses are no-ops (latched via `hasMountedFocusRef`). */}
            <ReAnimated.View style={heroEntrance.style}>
              {(() => {
                const coachInHero = isFeatureEnabled("today_coach_in_hero_v1");
                const heroCoachLine =
                  coachInHero && !activeFastStart && isToday && remaining > 0 ? (
                    <TodayDeficitInsight
                      remaining={remaining}
                      selectedDate={selectedDate}
                      byDay={byDay}
                    />
                  ) : null;
                return (
              <TodayHero
                consumed={totals.calories}
                goal={effectiveCalorieGoal}
                baseGoal={todayActivityBudgetAddon > 0 ? targets.calories : undefined}
                textColor={colors.text}
                textSecondaryColor={colors.textSecondary}
                textTertiaryColor={colors.textTertiary}
                cardBackgroundColor={colors.card}
                borderColor={colors.cardBorder}
                trackColor={colors.ringTrack}
                proteinPct={effectiveMacroTargets.protein > 0 ? Math.min(totals.protein / effectiveMacroTargets.protein, 1) : 0}
                carbsPct={effectiveMacroTargets.carbs > 0 ? Math.min(totals.carbs / effectiveMacroTargets.carbs, 1) : 0}
                fatPct={effectiveMacroTargets.fat > 0 ? Math.min(totals.fat / effectiveMacroTargets.fat, 1) : 0}
                expanded={ringExpanded}
                onToggleExpanded={() => setRingExpanded((e) => !e)}
                isOnTrack={
                  totals.calories > 100 &&
                  effectiveCalorieGoal > 0 &&
                  Math.abs(totals.calories - effectiveCalorieGoal) / effectiveCalorieGoal <= 0.1
                }
                // ENG-758: real weigh-in count from the profile's
                // weight_kg_by_day map (already loaded) — distinct weigh-in
                // days in the last 7, replacing the adaptiveTdeeConfidence proxy.
                tdeeLearnDays={countWeighInDaysInWindow(
                  profileWeightKgByDay,
                  dateKeyFromDate(new Date()),
                )}
                onPressStatusChip={() => setWhySheetOpen(true)}
                coachLine={heroCoachLine ?? undefined}
              />
                );
              })()}
            </ReAnimated.View>

            {/* Single context block — priority order: fasting >
                deficit. Mutually exclusive. Pre-Phase-4 these rendered
                as 4 separate stacked conditionals (sometimes multiple
                at once); the cap rule (teardown §2) is "never more than
                one prompt above the meals". */}
            <ReAnimated.View style={contextEntrance.style}>
            {(() => {
              if (isFeatureEnabled("today_coach_in_hero_v1")) {
                if (activeFastStart) {
                  return (
                    <TodayFastingPill
                      startedAt={activeFastStart}
                      nowTick={fastingTick}
                      onPress={() => router.push("/fasting")}
                    />
                  );
                }
                return null;
              }
              // 1. Active fast wins outright.
              if (activeFastStart) {
                return (
                  <TodayFastingPill
                    startedAt={activeFastStart}
                    nowTick={fastingTick}
                    onPress={() => router.push("/fasting")}
                  />
                );
              }
              // 1b. Idle "Start fast" removed (Today premium sprint 2026-05-19).
              // 2. Eat-again card removed from Today (2026-05-22 v4) and
              //    fully retired (ENG-984, 2026-06-17).
              // 3. North-star moved below meals (Today premium sprint 2026-05-19).
              // 4. Remaining budget today — the forward "Room for {meal}"
              //    coach line (Sloe 01 · Today). The component self-guards
              //    the ≥50 kcal honesty floor and picks the next unlogged
              //    slot from `byDay`; the backward energy-balance trend
              //    lives in the Energy balance section below, not here.
              if (isToday && remaining > 0) {
                return (
                  <TodayDeficitInsight
                    remaining={remaining}
                    selectedDate={selectedDate}
                    byDay={byDay}
                  />
                );
              }
              // No context block fits this state.
              return null;
            })()}
            </ReAnimated.View>

            {/* Macro tiles — 2x2 grid. The standalone all-nutrients
                link that previously floated as a centred row below
                the tiles now renders as a right-aligned "Nutrients"
                chevron in the tiles' section header
                (Phase 4 / Top-5 #2C, 2026-04-28).

                Feature 9 (2026-05-14, premium-bar audit) — wrapped
                with the shared section slide+fade animation. See
                `sectionSlideAnim` / `sectionFadeAnim` declarations
                above for the mount-time motion contract. */}
            <ReAnimated.View style={macroTilesEntrance.style}>
              {/* Canonical 2026-05-22 v4: the `macroDisplayStyle`
                  Settings preference is honoured again now that the
                  multi-ring has been restored. The C1 single-ring
                  experiment hardcoded MacroBars; the revival reverts
                  to the user-controllable toggle. Default still ships
                  bars (set in `macroDisplayStyle.ts`); tiles is the
                  opt-in alternate for the Cronometer-style grid look. */}
              {macroDisplayStyle === "tiles" ? (
                <TodayDashboardMacroTiles
                  trackedMacros={trackedMacros}
                  totals={totals}
                  targets={dashboardMacroTargets}
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
                  netCarbsLensEnabled={netCarbsLensEnabled}
                />
              ) : (
                <TodayDashboardMacroBars
                  trackedMacros={trackedMacros}
                  totals={totals}
                  targets={dashboardMacroTargets}
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
                  netCarbsLensEnabled={netCarbsLensEnabled}
                />
              )}
            </ReAnimated.View>
            {/* TodayMicrosWidget removed 2026-05-02 (revert PR #30) —
                user feedback: 4-tile widget on Today canvas duplicated
                fibre and over-cluttered the screen. Micronutrient depth
                is preserved inside the FullNutrientPanelSheet (PR #47),
                opened via the "Nutrients" link in
                TodayDashboardMacroTiles. See
                `docs/decisions/2026-05-02-revert-today-ui-changes.md`. */}
          </>
        )}

        {/* TodayStreakInsightCard removed 2026-04-20 — Grace's call
            per Today alignment pass. Streak logic still runs (powers
            the freeze ledger + weekly recap analytics) but is no
            longer surfaced on Today. Re-add if streak signal becomes
            a retention lever later. */}

        {/* Deficit insight moved into the unified context block
            inside the day-mode wrapper above (Phase 4 / Top-5 #2,
            2026-04-28). It renders only when no higher-priority
            context block (fasting) fits. */}

        {/* Meal sections (day view only) — prototype style: single card, IconBox per slot */}
        {/* Eat-again card retired (ENG-984, 2026-06-17) — suppressed from
            Today on 2026-05-22 (v4) and never re-surfaced; component +
            plumbing removed. Web parity: NutritionTracker.tsx. */}

        {/* Figma `654:2` — What to eat next sits above Today's Meals. */}
        {showAboveMealsNorthStar && (
          <NorthStarBlockHost
            viewMode={viewMode}
            savedRecipesForLibrary={savedRecipesForLibrary}
            remainingCalories={Math.max(0, remaining)}
            remainingProtein={remainingProtein}
            remainingCarbs={remainingCarbs}
            remainingFat={remainingFat}
            dailyCalorieTarget={effectiveCalorieGoal}
            onPrimaryCta={(recipeId) => {
              router.push(`/recipe/${recipeId}` as any);
            }}
            onBrowseLibrary={() => {
              router.push("/(tabs)/library" as any);
            }}
            selectedDateKey={dayKey}
            userCreatedAt={session?.user?.created_at ?? null}
            hasEverLoggedAnyMeal={hasAnyJournalHistory}
          />
        )}

        {viewMode === "day" && (
          <ReAnimated.View
            style={[mealsEntrance.style, { marginTop: tierV1 ? 0 : Layout.todaySectionBreak }]}
          >
          <TodayMealsSection
            slots={MEAL_SLOTS}
            mealGroups={mealGroups}
            mealsTodayCount={mealsToday.length}
            // ENG-1092 — activity-adjusted day target (mobile's effectiveCalorieGoal
            // ↔ web's effectiveCalorieTarget) so empty slots can show "Aim ~X kcal".
            effectiveCalorieTarget={effectiveCalorieGoal}
            collapsedSlots={collapsedSlots}
            onToggleSlotCollapse={toggleSlotCollapse}
            onOpenFabForSlot={(slot) => { setActiveMealSlot(slot); setFabSheetOpen(true); }}
            onOpenSaveUsualMealForSlot={openSaveMealSheetForSlot}
            onOpenDuplicateDay={() => setDuplicateDayOpen(true)}
            onPressMeal={(id) => router.push(`/meal-nutrition?id=${encodeURIComponent(id)}` as const)}
            onPressSlotSummary={(slot) =>
              router.push(
                `/meal-nutrition?slot=${encodeURIComponent(slot)}&date=${encodeURIComponent(dayKey)}` as const,
              )
            }
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
            onRequestPortion={
              isFeatureEnabled("today-edit-entry-v2") ? openPortionConfirm : undefined
            }
            onLogAgain={
              isFeatureEnabled("today_log_again") ? logAgainSlot : undefined
            }
            hintVisibleForSlot={hintVisibleForSlot}
            onDismissUsualMealHint={dismissUsualMealHint}
            onAcceptUsualMealHint={acceptUsualMealHint}
            aiFirstLogTooltipMealId={aiFirstLogTooltipMealId}
            onDismissAiFirstLogTooltip={dismissAiFirstLogTooltip}
            quickAddCollapsed={quickAddCollapsed}
            onToggleQuickAddCollapsed={() => void toggleQuickAddCollapsed()}
            quickAddPanel={
              quickAddPrefLoaded ? (
                <QuickAddPanel
                  byDay={byDay}
                  activeSlot={activeMealSlot}
                  supabase={supabase}
                  userId={userId ?? ""}
                  onLog={(item) => void logHistoryItemToSlot(item, activeMealSlot)}
                  onLogSavedMeal={(meal, slot) => logSavedMealFromPanel(meal, slot)}
                  onRequestPortion={
                    isFeatureEnabled("today-edit-entry-v2") ? openPortionConfirm : undefined
                  }
                  onOpenSaveCombo={(slot) => {
                    if (slot) openSaveMealSheetForSlot(slot);
                  }}
                  savedMealsRefreshToken={savedMealsRefreshToken}
                />
              ) : null
            }
          />
          </ReAnimated.View>
        )}

        {/* ENG-754 — weekly insight card (mobile port of web's
            `TodayWeeklyInsightCard`). Flag-gated; renders below the
            meals list on Today (day view). `householdSize={1}` is the
            honest minimum (the user themselves) — the Today screen does
            not load household membership, so we show the calm "Planning
            for you this week" line rather than fabricate a count.
            ENG-758 tracks wiring a real household size when the Today
            data layer exposes it. Every other figure is derived from
            `weekData` (already on screen). */}
        {viewMode === "day" && (
          <View style={{ marginTop: tierV1 ? 0 : Layout.todaySectionBreak }}>
          <WeeklyInsightCard
            householdSize={1}
            loggedDaysInWeek={weekData.days.filter((d) => d.totals.calories > 0).length}
            weekAvgKcal={
              weekData.days.some((d) => d.totals.calories > 0)
                ? weekData.weekAvg.calories
                : null
            }
            weekDailyKcal={weekData.days.map((d) => d.totals.calories)}
            dailyKcalTarget={targets.calories}
            textColor={colors.text}
            textSecondaryColor={colors.textSecondary}
            cardBackgroundColor={colors.card}
            borderColor={colors.cardBorder}
          />
          </View>
        )}

        {showBelowMealsCheckin && (
            <WeeklyCheckinBanner
              textColor={colors.text}
              textSecondaryColor={colors.textSecondary}
              onOpen={openCheckin}
              onDismiss={() => {
                void dismissCheckinBanner();
              }}
            />
          )}
        {showBelowMealsNudge && (
          <OnboardingNudgeBanner
            mealsTodayCount={mealsToday.length}
            libraryCount={savedLibraryRecipes.length}
          />
        )}
        {/* 2026-05-23 — TodaySnapShortcut removed from Today's main
            scroll (Grace: "this can also be kept to the logging
            section to keep things clean"). The camera icon already
            lives in LogSheet's search row as a peer entry method
            alongside barcode + voice, so discoverability isn't lost —
            it just stops competing with the meal slots on Today. */}
        {viewMode === "day" &&
          isToday &&
          hydrated &&
          mealsToday.length === 0 &&
          !hasAnyJournalHistory && (
            <TodayFirstMealEmptyState
              isBrandNew={isBrandNewUser}
              tipDismissed={firstMealTipDismissed}
              onDismissTip={dismissFirstMealTip}
              onLogMeal={() => {
                try {
                  track(AnalyticsEvents.empty_state_cta_clicked, {
                    surface: "today",
                  });
                } catch {
                  /* analytics fire-and-forget */
                }
                setActiveMealSlot(slotForHour(new Date().getHours()));
                setFabSheetOpen(true);
              }}
              textColor={colors.text}
              textSecondaryColor={colors.textSecondary}
              cardColor={colors.card}
              cardBorderColor={colors.cardBorder}
            />
          )}
        {/* Planned meals from the planner.
            F-178/F-179 (ENG-1065): when `today_planned_empty_state` is ON the
            "Planned" section persists on empty days too — the card renders an
            empty-state branch (same shell + header) instead of vanishing, so the
            Today scroll keeps its section grammar whether or not a plan exists.
            Flag OFF keeps the old hide-when-empty behaviour exactly. The card
            itself owns the empty/populated render fork off `plannedMeals.length`.
            Section break is the standard `Layout.todaySectionBreak` (F-159) so it
            sits on the same 32pt rhythm as Meals / Activity / Hydration. */}
        {viewMode === "day" &&
          (plannedMeals.length > 0 || isFeatureEnabled("today_planned_empty_state")) && (
            <View style={{ marginTop: tierV1 ? 0 : Layout.todaySectionBreak }}>
              <TodayPlannedMealsCard
                plannedMeals={plannedMeals}
                onLogPlannedMealWithPortion={(pm, p) => void logPlannedMealWithPortion(pm, p)}
                styles={styles}
              />
            </View>
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

        {/* Figma TD1 — Activity & energy: plum section header + flat sibling cards. */}
        {viewMode === "day" && (
          <View
            testID="today-activity-section"
            style={{ marginTop: tierV1 ? 0 : Layout.todaySectionBreak, gap: Layout.todaySectionCardGap }}
          >
            <TodayScrollSectionHeader
              title="Activity & energy"
              testID="today-activity-section-header"
            />
            {showStepsCard ? (
              <TodayActivityCard
                dayLabel={isToday ? "Today" : formatDateLabel(selectedDate)}
                stepsCount={stepsCount}
                dailyStepsGoal={dailyStepsGoal}
                activityBurnKcal={activityBurnKcal}
                onShowProvenance={() => {
                  void loadHealthLastSyncedAt().then(setHealthLastSyncedAtMs);
                  setProvenanceContext("activity");
                }}
                styles={styles}
                textColor={colors.text}
                textSecondaryColor={colors.textSecondary}
                textTertiaryColor={colors.textTertiary}
                borderColor={colors.border}
              />
            ) : (
              <Pressable
                onPress={() => router.push("/health-sync" as any)}
                accessibilityRole="button"
                accessibilityLabel="Connect health"
                style={{ paddingVertical: 4 }}
              >
                <Text style={{ ...Type.caption, color: colors.textSecondary, fontWeight: "600", textAlign: "center" }}>
                  Connect health
                </Text>
              </Pressable>
            )}
            {userId && (hasBurnData || isToday) ? (
              <TodayActivityBonusCard
            isToday={isToday}
            hasBurnData={hasBurnData}
            totalBurnKcal={totalBurnKcal}
            consumedCalories={totals.calories}
            effectiveCalorieGoal={effectiveCalorieGoal}
            basalBurnKcal={basalBurnKcal}
            activityBurnKcal={activityBurnKcal}
            todayActivityBudgetAddon={todayActivityBudgetAddon}
            potentialActivityBudgetAddon={potentialActivityBudgetAddon}
            dayWorkouts={dayWorkouts}
            trackerWeekSummaryKeys={trackerWeekSummaryKeys}
            activityBurnByDay={activityBurnByDay}
            basalBurnByDay={basalBurnByDay}
            byDay={byDay}
            weekSummaryMode={weekSummaryMode}
            onOpenBurnDetail={() => router.push({ pathname: "/burn-detail", params: { date: dayKey } } as any)}
            onShowBurnProvenance={() => {
              // F-131 (2026-05-08): same WhereThisComesFromSheet, burn
              // context — headline switches to burn breakdown, range
              // is the same Today-window string the activity sheet
              // uses.
              void loadHealthLastSyncedAt().then(setHealthLastSyncedAtMs);
              setProvenanceContext("burn");
            }}
            maintenanceTdeeKcal={profileMaintenanceTdeeKcal}
            profileSex={profileSex}
            profileWeightKg={profileWeightKg}
            profileHeightCm={profileHeightCm}
            profileAge={profileAge}
            profileActivityLevel={profileActivityLevel}
            maintenanceSource={profileMaintenanceSource}
            maintenanceConfidence={profileMaintenanceConfidence}
            preferActivityAdjustedCalories={preferActivityAdjustedCalories}
            showActivityBudgetDiscoverBanner={activityBudgetDiscoverDismissed === false}
            onEnableActivityBudget={() => {
              void persistPreferActivityAdjustedCalories(true);
              dismissActivityBudgetDiscover();
            }}
            onDismissActivityBudgetDiscover={dismissActivityBudgetDiscover}
            styles={styles}
            textColor={colors.text}
            textSecondaryColor={colors.textSecondary}
            textTertiaryColor={colors.textTertiary}
            borderColor={colors.border}
            cardColor={colors.card}
            cardBorderColor={colors.cardBorder}
              />
            ) : null}
          </View>
        )}

        {/* Figma TD2 — Hydration & stimulants: section header + sibling flat cards. */}
        {viewMode === "day" && (
          <View
            testID="today-hydration-section"
            style={{ marginTop: tierV1 ? 0 : Layout.todaySectionBreak, gap: Layout.todaySectionCardGap }}
          >
            <TodayScrollSectionHeader
              title="Hydration & stimulants"
              testID="today-hydration-section-header"
            />
            {showHydrationCard ? (
              <HydrationStimulantsCard
            selectedDateKey={dayKey}
            weekStartDay={weekStartDay}
            targets={{
              waterMl: waterGoalMl,
              // Phase 2 / B1.4 (D-2026-04-27-08): caffeine + alcohol
              // are gated by Settings opt-in. When the user hasn't
              // opted in, force the target to 0 so the row hides via
              // the existing HydrationStimulantsCard rule
              // (`targets.caffeineMg === 0` / `targets.alcoholGWeekly
              // === 0`). The underlying data (`extra_caffeine_by_day`
              // / `extra_alcohol_g_by_day`) is preserved untouched.
              caffeineMg: trackCaffeine ? targetCaffeineMg : 0,
              alcoholGWeekly: trackAlcohol ? targetAlcoholGWeekly : 0,
            }}
            waterTotalMl={totalWaterMl}
            waterFromMealsMl={waterFromMealsMl}
            caffeineTotalMg={extraCaffeineToday}
            alcoholByDayG={alcoholByDayMerged}
            measurementSystem={measurementSystem}
            onAddWater={(ml) => void addWaterMl(ml)}
            onAddCaffeine={(mg, preset) => void addCaffeineMg(mg, preset ?? null)}
            onAddAlcohol={(g, preset) => void addAlcoholG(g, preset ?? null)}
            onReset={(kind) => void resetHydrationStimulantsForDay(kind)}
              />
            ) : (
              <Pressable
                onPress={() => setHydrationManualExpanded(true)}
                accessibilityRole="button"
                accessibilityLabel="Track hydration"
                style={{ paddingVertical: 4 }}
              >
                <Text style={{ ...Type.caption, color: colors.textSecondary, fontWeight: "600", textAlign: "center" }}>
                  Track hydration?
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Complete Day — only when viewing today with logged meals. Extracted
            to <TodayCompleteDayButton> (ENG-1065 / F-158): it now sits in a
            section wrapper on the standard `todaySectionBreak` (32) cadence as
            the day's terminal section, fixing the "out of place / floating in
            dead space" report (was an off-rhythm `marginTop: 20`, no wrapper).
            Outline tier + HealthKit auto-export behaviour preserved inside the
            component. Mirror of web NutritionTracker. */}
        {viewMode === "day" && isToday && mealsToday.length > 0 && !addOpen && (
          <TodayCompleteDayButton
            userId={userId ?? null}
            selectedDate={selectedDate}
            onComplete={() => setCompleteDayOpen(true)}
          />
        )}

      </ScrollView>

      {/* ENG-798 — reserved landmark win-moment overlay. Mounts only
          while `useWinMoment` reports an active celebration (calorie
          ring closed at/under target, macro hit, or streak milestone),
          plays the code-driven gold celebration once full-bleed (gold
          ring sweep + colour-pulse + odometer + confetti, ~700ms — no
          Lottie asset; that's ENG-798's content pass), then fires
          `onWinComplete` to unmount. `pointerEvents: none` (set inside
          WinMomentPlayer) keeps it from blocking taps. Gating +
          once-per-day logic + the success haptic live in the hook —
          this is a pure render of its output. */}
      {winCelebration ? (
        <WinMomentPlayer
          celebration={winCelebration}
          milestone={winMilestone ?? undefined}
          onComplete={onWinComplete}
          fullBleed
          testID="today-win-moment"
        />
      ) : null}

      {/* Weekly TDEE check-in ritual (PR claude/weekly-checkin-ritual-v2,
          2026-05-02 — rebuild of #26). MacroFactor-style soft prompt
          that surfaces the adaptive-vs-formula TDEE delta + a suggested
          new daily target. Soft prompt — every dismiss path persists
          the decision.

          ENG-805 (Redesign — Design Direction 2026): when
          `redesign_winmoment` is ON the check-in is demoted from this
          cold-open blocking MODAL to a dismissible inline CARD rendered
          in the Today feed (below the hero, above meals — see
          `<WeeklyCheckinCard>` in the scroll content). The modal stays
          alive here as the flag-OFF path so the old behaviour is fully
          preserved. The card and the modal share the exact same
          `weeklyCheckinOpen` state + accept/dismiss handlers, so the
          weekly cadence and persistence are unchanged — only the
          presentation differs. */}
      {!checkinAsCard ? (
        <WeeklyCheckinModal
          visible={weeklyCheckinOpen}
          content={weeklyCheckinContent}
          currentTargetKcal={targets.calories}
          onAccept={handleWeeklyCheckinAccept}
          onDismiss={handleWeeklyCheckinDismiss}
          cardColor={colors.card}
          textColor={colors.text}
          textSecondaryColor={colors.textSecondary}
          borderColor={colors.border}
        />
      ) : null}

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

      {/* Phase 3 / B2.1 (D-2026-04-27-15) — canonical Log button +
          unified LogSheet. 2026-04-30: the side `<LogFab>` (right: 18,
          bottom: 100) was retired; the Log button now lives as a
          centered raised Plus inside the global `<SupprTabBar>` (see
          `apps/mobile/components/tabs/LogTabBarButton.tsx`). The tab
          bar button navigates Today with `?openLog=1`, which the
          effect above consumes to open this LogSheet. Meal-slot taps
          and other in-screen call sites still call
          `setFabSheetOpen(true)` directly, so no other wiring
          changed.

          The legacy `fabSheetOpen` state name is intentionally kept
          (rather than renamed to `logSheetOpen`) so existing meal-slot
          tap call sites and the source-pin tests continue to work
          without 30+ call-site edits. */}

      {/* Search-first LogSheet (Next-10 #12, 2026-04-28). The 6-tab
          strip is gone; search is the always-visible primary input
          with right-edge icons (scan / voice / photo) routing to the
          dedicated modals on tap. Recent + Saved render inline as
          the default browse content via a 2-pill toggle below the
          search row. The "Or add manually" footer routes to the
          existing TodayAddFoodForm. */}
      <LogSheet
        visible={fabSheetOpen}
        onClose={() => setFabSheetOpen(false)}
        confirmation={logSheetConfirmation ?? undefined}
        showBarcodeFreePromise
        // ENG-773 — log-time meal-slot selector (web parity with
        // `src/app/components/NutritionTracker.tsx`). Flag-gated visual
        // element (CLAUDE.md): the picker row is new structure so it
        // ships behind `log-sheet-slot-selector`. `activeMealSlot` is
        // still threaded through every commit path regardless of the
        // flag — flag-off is identical to pre-ENG-773 (slot stays a
        // hidden clock guess, seeded from time-of-day via slotForHour).
        slot={
          isFeatureEnabled("log-sheet-slot-selector")
            ? {
                current: activeMealSlot,
                options: MEAL_SLOTS,
                onChange: setActiveMealSlot,
              }
            : undefined
        }
        search={{
          // INLINE-SEARCH MODE (2026-04-30): the search row is a real
          // `<TextInput>` with autoFocus, and results render INSIDE the
          // LogSheet via `<FoodSearchPanel>`. No nested-modal hop. The
          // legacy `onOpen` route stays in the LogSheet API as a
          // fallback for hosts that haven't migrated yet — Today uses
          // the inline path.
          onSelect: (result) => {
            let scaled;
            try {
              scaled = foodSelectionToMealMacros(result);
            } catch (err) {
              console.error("[tracker] logSheet food select failed:", err);
              Alert.alert(
                "Couldn't log this food",
                "Something went wrong saving this item. Try again or log it manually.",
              );
              return;
            }
            if (!Number.isFinite(scaled.calories) || scaled.calories <= 0) {
              Alert.alert(
                "Couldn't log this food",
                "Nutrition data for this item is missing or incomplete. Try another result or enter it manually.",
              );
              return;
            }
            const committed = commitLogSheetFoodSelection(result);
            presentLogSheetConfirmation({
              title: committed.title,
              kcal: committed.kcal,
              mealIds: [committed.id],
            });
          },
          onAddToBasket: (selection) => {
            setLogBasket((prev) => [...prev, { basketId: newMealId(), selection }]);
          },
          macroTargets: {
            calories: effectiveCalorieGoal,
            protein: effectiveMacroTargets.protein,
            carbs: effectiveMacroTargets.carbs,
            fat: effectiveMacroTargets.fat,
            fiber: targets.fiber,
          },
          macroConsumed: {
            calories: totals.calories,
            protein: totals.protein,
            carbs: totals.carbs,
            fat: totals.fat,
            fiber: totals.fiber,
          },
          supabase: supabase as unknown as { from: (table: string) => unknown },
          userId: userId ?? null,
          logDateKey: dayKey,
          // History-first search (ENG-1033, MFP grammar): the user's logging
          // history, newest-first, threaded into the inline panel. Powers the
          // empty-query "Recent" strip AND the typed-query "Past logged"
          // group that ranks matching past logs above database results. A
          // 50-row window gives the matcher enough history to match a typed
          // query against while staying cheap to compute.
          recentFoods: recentFoodsForSearch,
          // Favourites-in-search (teardown #1, ENG-1041) — the user's starred
          // foods + the optimistic toggle, threaded into the inline panel.
          favoriteFoods: hostFavorites.map((f) => ({
            id: f.id,
            recipeTitle: f.recipeTitle,
            calories: f.calories,
            protein: f.protein,
            carbs: f.carbs,
            fat: f.fat,
            fiber: f.fiber,
            source: f.source,
          })),
          onToggleFavorite: toggleFoodFavorite,
          favoritePendingKeys,
        }}
        goTos={
          logSheetGoTos.length > 0
            ? {
                entries: logSheetGoTos,
                onPick: (entry) => {
                  const slot = normaliseMealSlot(activeMealSlot);
                  if (!slot) return;
                  const item = computeSlotGoToFoods(byDay, slot).find(
                    (i) => foodHistoryKey(i.recipeTitle, i.calories) === entry.id,
                  );
                  if (!item) return;
                  logHistoryItemFromSheet(item);
                },
              }
            : undefined
        }
        basket={
          logBasketSummary.items.length > 0
            ? {
                items: logBasketSummary.items,
                totalKcal: logBasketSummary.totalKcal,
                onRemove: (id) =>
                  setLogBasket((prev) => prev.filter((row) => row.basketId !== id)),
                onCommit: commitLogBasket,
                onClear: () => setLogBasket([]),
              }
            : undefined
        }
        barcode={{
          // Tap the scan icon → close LogSheet, open BarcodeScannerModal.
          // The "0 kcal manual entry" inline path activates when
          // `manualEntry` is set — host passes it after a barcode
          // lookup returns no nutrition (replaces the LogSheet's
          // default content with the manual-entry form).
          onOpen: () => {
            setFabSheetOpen(false);
            setBarcodeOpen(true);
          },
        }}
        recent={{
          // P0-2b (2026-04-28) — hydrate from food-history. Recent is
          // capped at 12 rows; bucket "today" / "week" splits by
          // last-logged date so the LogSheet can render two groups.
          //
          // 2026-04-30 audit visual-qa: filter out HealthKit-imported
          // entries that resolved to the `Food log (X kcal)` fallback
          // because their source app (MFP, etc.) didn't expose a food
          // name through the HealthKit metadata. These rows have no
          // useful identity for re-logging — they're just calorie
          // totals — so showing 9+ identical-looking entries in Recents
          // is noise. Fallback string lives in
          // `apps/mobile/lib/healthSync.ts` (`resolveFoodLabelFromHealthMetadata`).
          // 2026-05-03 (N1): inline regex replaced by the shared
          // `isHealthImportFallbackTitle` predicate which matches BOTH
          // the legacy "Food log (NNN kcal)" form and the new
          // "<Source> entry · NNN kcal" form, so existing TestFlight
          // user data + new builds both stay filtered.
          entries: recentLogSheetEntries,
          onPick: (picked) => {
            const found = recentMealsForPick.find(
              (i) => foodHistoryKey(i.recipeTitle, i.calories) === picked.id,
            );
            if (!found) return;
            logHistoryItemFromSheet(found);
          },
        }}
        saved={{
          // P0-2a (2026-04-28) — hydrate from the host's saved-meal
          // list. Each SavedMeal becomes a LogSheetSavedMeal preview
          // row; onPick closes the LogSheet and logs the meal into the
          // current time-of-day slot via the shared
          // logSavedMealFromPanel handler.
          meals: hostSavedMeals.map((m) => ({
            id: m.id,
            title: m.name,
            kcal: Math.round(
              m.items.reduce(
                (sum, item) => sum + item.calories * (item.portionMultiplier ?? 1),
                0,
              ),
            ),
            source: "manual" as const,
          })),
          onPick: (picked) => {
            setFabSheetOpen(false);
            const meal = hostSavedMeals.find((m) => m.id === picked.id);
            if (!meal) return;
            // 2026-05-08 build-47 follow-up — same reason as `recents`
            // above: respect the user's slot choice (activeMealSlot).
            // The saved-meal's defaultMealSlot was its preference at save
            // time; the user has now explicitly picked a slot to log into.
            logSavedMealFromPanel(meal, activeMealSlot);
          },
          // ENG-783 — when the edit-entry-v2 flag is on, tapping a saved
          // meal opens the portion editor (seeded to the active FAB slot)
          // instead of logging 1× instantly. Flag off → onPick (instant
          // one-tap log preserved). LogSheetSavedMeal is a light row shape,
          // so resolve back to the full SavedMeal before opening the sheet.
          onRequestPortion: isFeatureEnabled("today-edit-entry-v2")
            ? (picked) => {
                setFabSheetOpen(false);
                const meal = hostSavedMeals.find((m) => m.id === picked.id);
                if (!meal) return;
                openPortionConfirm(meal, activeMealSlot);
              }
            : undefined,
          // ENG-776 — advertised empty-state CTA; opens SaveMealSheet for
          // the slot the user picked in the LogSheet selector.
          onCreateSavedMeal: () => {
            setFabSheetOpen(false);
            openSaveMealSheetForSlot(activeMealSlot);
          },
        }}
        library={{
          // 2026-05-01 (TestFlight Build 40 feedback `AECfotBlQgwfgxYHr4dDaM8`
          // + "no way to add from library here") -- surface the user's
          // saved recipes inline in the LogSheet so a one-tap log no
          // longer requires routing through Recipes -> Library ->
          // Detail. Source: shared `useSavedLibraryRecipes` hook
          // (already wired further up for the NorthStar suggestion
          // picker, so we get the same set Library shows for free --
          // no second fetch).
          recipes: savedLibraryRecipes.map((r) => ({
            id: r.id,
            title: r.title,
            kcalPerPortion: Math.round(r.calories ?? 0),
            thumbnail: r.image ?? null,
            // mealSlots is `recipes.meal_type` mapped into RecipeCard
            // shape. Re-resolve through the shared helper so the pill
            // tag, the slot we route to on tap, and the recipe-detail
            // "Add to today" all use the same rule.
            mealTag: r.mealSlots
              ? (journalSlotFromMealTypes(r.mealSlots as string[]) as
                  | "Breakfast"
                  | "Lunch"
                  | "Dinner"
                  | "Snacks")
              : null,
          })),
          onPick: (picked) => {
            setFabSheetOpen(false);
            const recipe = savedLibraryRecipes.find((r) => r.id === picked.id);
            if (!recipe) return;
            // Route through `logPlannedMealWithPortion` so the macro-
            // coercion guard (P0-3 / T4) fires identically to the
            // Recipe -> Add to today path: a recipe with kcal but no
            // ingredient-resolved P/C/F is refused with the Verify
            // prompt. Project rule: "if nutrition is uncertain, do
            // not guess".
            void logPlannedMealWithPortion(
              {
                // 2026-05-08 build-47 follow-up — same reason as `recents`
                // and `saved` above: respect the user's slot choice
                // (activeMealSlot). The recipe's own meal_type was a
                // soft tag; the user has explicitly picked a slot.
                name: activeMealSlot,
                recipe_title: recipe.title,
                calories: recipe.calories ?? 0,
                protein: recipe.protein ?? 0,
                carbs: recipe.carbs ?? 0,
                fat: recipe.fat ?? 0,
                recipe_id: recipe.id,
              },
              1,
            );
          },
          onBrowseRecipes: () => {
            // Route to the in-app Library tab (mobile equivalent of
            // /recipes on web) so the user can save more recipes when
            // their list is empty.
            setFabSheetOpen(false);
            router.push("/(tabs)/library" as any);
          },
        }}
        describe={
          isFeatureEnabled("log_sheet_nl_text_v1")
            ? {
                locked: userTier !== "pro",
                slotLabel: activeMealSlot,
                onPaywall: () => setAiPaywall({ open: true, feature: "voice_log" }),
                onParse: (text) =>
                  parseMealDescriptionTranscript({
                    transcript: text,
                    apiBase,
                    accessToken: session?.access_token ?? null,
                  }),
                onCommit: (items) => {
                  commitAiLoggedItems(items);
                  const totalKcal = items.reduce((sum, item) => sum + item.calories, 0);
                  presentLogSheetConfirmation({
                    title:
                      items.length === 1
                        ? items[0]?.name ?? "Logged item"
                        : `${items.length} items logged`,
                    kcal: Math.round(totalKcal),
                    mealIds: [],
                  });
                },
              }
            : undefined
        }
        voice={{
          onStart: () => {
            // Close the unified LogSheet and route to the dedicated
            // voice flow. Free + base tier users see the AI paywall
            // sheet via the AiPaywallSheet wired below; this onStart
            // fires regardless and the host decides which sheet to
            // open.
            setFabSheetOpen(false);
            if (userTier === "pro") {
              setVoiceLogOpen(true);
            } else {
              setAiPaywall({ open: true, feature: "voice_log" });
            }
          },
          // Pro-gated — surface the lock badge for free + base tiers
          // so the user sees the gate before tapping.
          locked: userTier !== "pro",
        }}
        photo={{
          onCapture: () => {
            // 2026-05-02 — photo-log opens for any tier. The sheet's
            // own free-taster line + 403 handoff route to the
            // AiPaywallSheet when the user exhausts their weekly
            // quota.
            setFabSheetOpen(false);
            setPhotoLogOpen(true);
          },
          // Lock badge removed (2026-05-02).
          locked: false,
        }}
        onAddManually={() => {
          // Footer "Or add manually" link → escape hatch into the
          // manual quick-add form (TodayAddFoodForm). Host owns the
          // form's open state; we just flip the flags.
          setFabSheetOpen(false);
          setAddOpen(true);
        }}
        copyYesterday={(() => {
          // ENG-709: only show when viewing today and today has no
          // meals yet (so the copy is actually useful, not additive
          // noise on a day already started).
          if (!isToday || mealsToday.length > 0) return null;
          const count = getYesterdayMeals(byDay, dayKey).length;
          if (count === 0) return null;
          return {
            count,
            onTap: handleCopyYesterday,
          };
        })()}
      />

      {targetCelebration && (
        // F-139 (`ACyWRLx2M-_D9t2jdcNjmaU`, 2026-05-08): Grace flagged
        // the previous solid-purple banner as "looks cheap" — the
        // 88%-opacity Accent.primary block fully obscured the calorie
        // ring it was meant to celebrate. Redesigned as a polished
        // toast: white card + subtle green accent border + inline
        // checkmark icon + soft shadow. Sits at the top of the screen
        // (under the safe-area inset) instead of dead-center over the
        // ring, so the user can still see what they hit.
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: insets.top + Spacing.lg,
            left: 0,
            right: 0,
            alignItems: "center",
            zIndex: 50,
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: Accent.success + "60",
              paddingHorizontal: Spacing.lg,
              paddingVertical: Spacing.md,
              borderRadius: Radius.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.sm,
              maxWidth: "88%",
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}
          >
            <CheckCircle2
              size={22}
              color={Accent.success}
              strokeWidth={1.75}
            />
            <View style={{ flexShrink: 1 }}>
              <Text
                style={{
                  ...Type.body,
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                Goals hit
              </Text>
              <Text
                style={{
                  ...Type.caption,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                Calories and protein on target
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Edit meal modal */}
      <TodayEditMealModal
        enabled={isFeatureEnabled("today-edit-entry-v2")}
        editEatenAtEnabled={isFeatureEnabled("editable_eaten_at")}
        editEatenAtTime={editEatenAtTime}
        onEditEatenAtTimeChange={setEditEatenAtTime}
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

      {/* ENG-783 — saved-meal portion-confirm sheet (flag-gated). */}
      {isFeatureEnabled("today-edit-entry-v2") ? (
        <SavedMealPortionSheet
          meal={portionMeal}
          slot={portionSlot}
          slots={MEAL_SLOTS}
          onChangeSlot={setPortionSlot}
          onConfirm={confirmPortionLog}
          onClose={() => setPortionMeal(null)}
        />
      ) : null}

      {/* Food search modal for logging */}
      <FoodSearchModal
        visible={searchOpen}
        initialQuery=""
        supabase={supabase}
        userId={userId ?? null}
        macroTargets={{
          calories: effectiveCalorieGoal,
          protein: effectiveMacroTargets.protein,
          carbs: effectiveMacroTargets.carbs,
          fat: effectiveMacroTargets.fat,
          fiber: targets.fiber,
        }}
        macroConsumed={{
          calories: totals.calories,
          protein: totals.protein,
          carbs: totals.carbs,
          fat: totals.fat,
          fiber: totals.fiber,
        }}
        // 2026-05-12 round 5 (premium-bar audit #12 MFP borrow):
        // recents on mount. Compute the user's meals from byDay (the same
        // source the QuickAddPanel reads) and pass through so the search
        // modal's empty-query state shows tap-to-log recents — the pattern
        // MFP / Lose It / Cronometer all ship.
        // ENG-1033: widened from 5 → 50 + carry `count` so the typed-query
        // history-first "Past logged" group has enough history to match
        // against and rank by recency-weighted frequency. The empty-query
        // strip still shows only the first 5 (panel-side slice).
        recentFoods={recentFoodsForSearch}
        // Shared commit path — same logic the inline `<FoodSearchPanel>`
        // inside `<LogSheet>` runs (handleFoodSearchSelect). F-13 +
        // F-79 + L6 G1 all live in the shared callback.
        // F-38 (2026-04-21): keep modal open so the user can add
        // multiple items to the same meal without tapping back through
        // the FAB. The X button still dismisses.
        logDateKey={dayKey}
        onSelect={handleFoodSearchSelect}
        onClose={() => setSearchOpen(false)}
      />

      {/* Barcode scanner */}
      <BarcodeScannerModal
        visible={barcodeOpen}
        slotOptions={MEAL_SLOTS}
        initialMealSlot={activeMealSlot}
        onScan={(_code: string, product, mealSlot) => {
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
            name: mealSlot,
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
          // 2026-05-08 data-loss hotfix — immediate Supabase persist.
          void persistMealsImmediate(dayKey, [meal]);
          // F-74 / F-103 fix (2026-05-07): per-meal micros canonical
          // SoT. The barcode commit above wrote `micros.caffeineMg` /
          // `alcoholG` onto the meal row; `caffeineFromMealsMg` /
          // `alcoholByDayMerged` will sum it at render. No ledger bump.
          track(AnalyticsEvents.food_logged, { source: "barcode", slot: mealSlot });
          // DC12 (2026-05-14, premium-bar audit) — specific log
          // confirmation. Mobile parity sweep.
          Alert.alert(`${product.name} logged`, `Added to ${mealSlot}.`);
        }}
        onClose={() => setBarcodeOpen(false)}
        onPhotoFallback={() => {
          // Audit 2026-04-30 (Lose It "Closer" parity, Fix 2) — when
          // the barcode lookup fails we offer a soft handoff to the
          // AI photo log. 2026-05-02: open for any tier; the in-sheet
          // quota line + 403 paywall handoff handle gating now.
          setBarcodeOpen(false);
          setPhotoLogOpen(true);
        }}
        onAddAsCustomFood={(barcode) => {
          // F-156 PR-2 (2026-05-10) — barcode scanned, not found in
          // any DB → user opts to add it as a custom food. Close the
          // scanner and open CreateCustomFoodSheet pre-filled with
          // the barcode so the saved row writes to user_foods with
          // the correct code (next scan resolves successfully).
          setBarcodeOpen(false);
          setCustomFoodFromBarcode(barcode);
        }}
      />

      {/* F-156 PR-2 (2026-05-10) — CreateCustomFoodSheet host for the
          barcode-not-found path. Only mounted when the user has
          arrived here via the "Add as custom food" CTA. Saves the new
          food to user_custom_foods; the user can then scan again to
          log it. */}
      <CreateCustomFoodSheet
        visible={customFoodFromBarcode != null}
        initialBarcode={customFoodFromBarcode ?? undefined}
        colors={{
          text: colors.text,
          textSecondary: colors.textSecondary,
          textTertiary: colors.textTertiary,
          card: colors.card,
          cardBorder: colors.cardBorder,
          background: colors.background,
        }}
        onClose={() => setCustomFoodFromBarcode(null)}
        onSave={async (payload: CreateCustomFoodPayload) => {
          if (!userId) return;
          try {
            await createCustomFood(supabase as Parameters<typeof createCustomFood>[0], userId, payload);
            try {
              track(AnalyticsEvents.custom_food_created, {
                hasBrand: Boolean(payload.brand),
                servingCount: payload.servings.length,
                fromBarcode: true,
              });
            } catch {
              /* analytics noop */
            }
            // DC12 (2026-05-14, premium-bar audit) — specific
            // confirmation; title carries the noun ("Custom food")
            // instead of the bare verb ("Saved").
            Alert.alert(
              "Custom food saved",
              "Scan the barcode again to log it.",
            );
          } catch (err) {
            Alert.alert(
              "Couldn't save",
              err instanceof Error ? err.message : "Try again in a moment.",
            );
          }
        }}
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
              <Text style={{ ...Type.headline, color: colors.text }}>Quick add</Text>
              <Text style={{ ...Type.caption, color: accent.primary, fontWeight: "600", marginTop: 2 }}>
                Logging to {activeMealSlot}
              </Text>
            </View>
            <Pressable onPress={() => setShowPrevious(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close quick add">
              <X size={24} color={colors.text} strokeWidth={2} />
            </Pressable>
          </View>
          <QuickAddPanel
            byDay={byDay}
            activeSlot={activeMealSlot}
            supabase={supabase}
            userId={userId ?? ""}
            onLog={(item) => {
              void logHistoryItemToSlot(item, activeMealSlot);
              setShowPrevious(false);
            }}
            onLogSavedMeal={(meal, slot) => logSavedMealFromPanel(meal, slot)}
            onRequestPortion={
              isFeatureEnabled("today-edit-entry-v2") ? openPortionConfirm : undefined
            }
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
          primaryForeground: colors.primaryForeground,
        }}
      />

      {/* Full-nutrient panel sheet — opened from the Nutrients link
          inside TodayDashboardMacroTiles. Replaced the legacy
          TodayNutrientsModal on 2026-05-02 (revert of PR #30) so the
          richer Cronometer-parity panel from PR #47 keeps shipping
          even after the Today-canvas micros widget was removed. */}
      <FullNutrientPanelSheet
        visible={nutrientsModalOpen}
        onClose={() => setNutrientsModalOpen(false)}
        microSum={dayMicroSum}
        fiberG={totals.fiber}
        totalFatG={totals.fat}
        totalCarbsG={totals.carbs}
        proteinG={totals.protein}
        colors={{
          background: colors.background,
          card: colors.card,
          cardBorder: colors.cardBorder,
          text: colors.text,
          textSecondary: colors.textSecondary,
          textTertiary: colors.textTertiary,
        }}
      />

      {/* ENG-1184 — status chip opens target explainer inline on Today. */}
      <WhyThisNumberSheet
        visible={whySheetOpen}
        onClose={() => setWhySheetOpen(false)}
        targetCalories={Math.round(effectiveCalorieGoal)}
        maintenanceTdee={adaptiveTdee ?? profileMaintenanceTdeeKcal}
        confidence={
          adaptiveTdeeConfidence === "low" ||
          adaptiveTdeeConfidence === "medium" ||
          adaptiveTdeeConfidence === "high"
            ? adaptiveTdeeConfidence
            : null
        }
        loggingDays={null}
        goal={
          profileGoal === "gain" || profileGoal === "bulk" || profileGoal === "strength"
            ? "gain"
            : profileGoal === "maintain" || profileGoal === "health"
              ? "maintain"
              : "lose"
        }
        paceKgPerWeek={paceKgPerWeekFromPreset(
          profilePlanPace,
          profileGoal === "gain" || profileGoal === "bulk" || profileGoal === "strength"
            ? "gain"
            : profileGoal === "maintain" || profileGoal === "health"
              ? "maintain"
              : "lose",
        )}
        mealLogDays={null}
        weightLogCount={Object.keys(profileWeightKgByDay).length}
        hasWearable={Object.keys(basalBurnByDay).length > 0}
        onPressAdjustTarget={() => {
          setWhySheetOpen(false);
          router.push("/targets");
        }}
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
          primaryForeground: colors.primaryForeground,
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
              primaryForeground: colors.primaryForeground,
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
          primaryForeground: colors.primaryForeground,
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
          primaryForeground: colors.primaryForeground,
        }}
      />

      {/* AI photo log sheet. 2026-05-02: Free + Base get 5 photo logs
          per rolling 7 days via a server-enforced free-taster bucket;
          on exhaustion the sheet calls onUpgradeRequired and we open
          the AiPaywallSheet. */}
      <PhotoLogSheet
        visible={photoLogOpen}
        onClose={() => setPhotoLogOpen(false)}
        activeSlot={activeMealSlot}
        accessToken={session?.access_token ?? null}
        apiBase={apiBase}
        onCommit={commitAiLoggedItems}
        userTier={userTier}
        onUpgradeRequired={() => {
          setPhotoLogOpen(false);
          setAiPaywall({ open: true, feature: "photo_log" });
        }}
        colors={{
          text: colors.text,
          textSecondary: colors.textSecondary,
          textTertiary: colors.textTertiary,
          card: colors.card,
          cardBorder: colors.cardBorder,
          background: colors.background,
          inputBg: colors.inputBg,
          border: colors.border,
          primaryForeground: colors.primaryForeground,
        }}
      />

      {/* Pattern #9 (`AN8GJ1Dr3M` + F-131 `AMmlpVOqMnaKKdV2dobjjjg`,
          2026-05-08): "Where this comes from" provenance sheet —
          shared between the Today activity card (steps + active
          energy) and the Today burn-summary card. Headline + footer
          copy derive from `provenanceContext`. */}
      <WhereThisComesFromSheet
        visible={provenanceContext != null}
        onClose={() => setProvenanceContext(null)}
        headline={(() => {
          if (provenanceContext === "burn") {
            const total = (basalBurnKcal + (activityBurnKcal ?? 0)).toLocaleString();
            const active = (activityBurnKcal ?? 0).toLocaleString();
            const resting = basalBurnKcal.toLocaleString();
            return `${total} kcal · Active ${active} · Resting ${resting}`;
          }
          const stepsStr = stepsCount != null ? stepsCount.toLocaleString() : "—";
          const burnStr = activityBurnKcal != null ? `${activityBurnKcal.toLocaleString()} kcal active` : "—";
          return `${stepsStr} steps · ${burnStr}`;
        })()}
        source={
          provenanceContext === "burn"
            ? "Apple Health (active) + estimate (resting)"
            : "Apple Health"
        }
        range={isToday ? `Today, 00:00 – ${new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : `${formatDateLabel(selectedDate)}, full day`}
        lastSyncedAtMs={healthLastSyncedAtMs}
        footerExplainer={
          provenanceContext === "burn"
            ? "Active energy comes from Apple Watch / iPhone motion. Resting is your baseline burn — Apple Health when published, otherwise an estimate from your profile (Mifflin-St Jeor)."
            : "Numbers update when Apple Health does. Pull to refresh on Today, or tap Sync now to force a fresh read."
        }
        primaryCta={
          userId
            ? {
                label: "Sync now",
                onPress: () => {
                  setProvenanceContext(null);
                  void syncHealthDataThrottled(userId, { bypassThrottle: true }).then(() => {
                    void loadHealthLastSyncedAt().then(setHealthLastSyncedAtMs);
                  });
                },
              }
            : undefined
        }
        backgroundColor={colors.background}
        cardColor={colors.card}
        cardBorderColor={colors.border}
        textColor={colors.text}
        textSecondaryColor={colors.textSecondary}
        textTertiaryColor={colors.textTertiary}
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
          primaryForeground: colors.primaryForeground,
        }}
      />
    </View>
  );
}
