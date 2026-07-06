import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WifiOff } from "lucide-react";

import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import { normalizeMacroTargets, DEFAULT_STEPS_GOAL } from "../../types/profile.ts";
import { resolveMaintenance } from "../../lib/nutrition/resolveMaintenance.ts";
import { MEASURED_TDEE_CHECK_IN_FLAG } from "../../lib/nutrition/measuredTdee.ts";
import { computeActivityBonusKcal } from "../../lib/nutrition/activityBonus.ts";
import { scaleMacroTargetsForCalorieBudget } from "../../lib/nutrition/scaleMacroTargetsForCalorieBudget.ts";
import {
  resolveEffectiveDayTargets,
  type WeekdayIndex,
} from "../../lib/nutrition/dayTargetSchedule.ts";
import { previousDayKey } from "../../lib/nutrition/copyYesterdayMeals.ts";
import {
  foodSelectionAnalyticsSource,
  foodSelectionSourceLabel,
  foodSelectionToMealMacros,
} from "../../lib/nutrition/foodSelectionToMeal.ts";
import { ACTIVITY_BUDGET_DISCOVERABILITY_KEY } from "../../lib/nutrition/activityBudgetDiscoverability.ts";
import { useAiMethodTooltip } from "../../lib/today/useAiMethodTooltip.ts";
// Weekly TDEE check-in ritual (PR claude/weekly-checkin-ritual-v2,
// 2026-05-02 — rebuild of #26). Web parity of the mobile modal.
import {
  buildWeeklyCheckinContent,
  shouldShowWeeklyCheckin,
  type WeeklyCheckinConfidence,
  type WeeklyCheckinContent,
} from "../../lib/nutrition/weeklyCheckin.ts";
import { WeeklyCheckinDialog } from "./suppr/weekly-checkin-dialog";
import { WhyThisNumberDialog } from "./suppr/why-this-number-dialog.tsx";
import { paceKgPerWeekFromPreset } from "../../lib/nutrition/whyThisNumber.ts";
import { WeeklyCheckinBanner } from "./suppr/weekly-checkin-banner";
import { weekKeyFor } from "../../lib/nutrition/weeklyRecap.ts";
import {
  isCheckinBannerDismissed,
  markCheckinBannerDismissed,
} from "../../lib/today/weeklyCheckinBannerDismissal.ts";
import type { LoggedMeal, RecipeCard, UserTier } from "../../types/recipe.ts";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { fetchPlannedMealMicros, type SupabaseLike } from "../../lib/planning/plannedMealMicros.ts";
import {
  todayDayName,
  todayShortDate,
  todayPastDayGreetingLines,
} from "../../lib/copy/today.ts";
import { useAuthSession } from "../../context/AuthSessionContext.tsx";
import { AnalyticsEvents, type FoodLoggedSource } from "../../lib/analytics/events.ts";
import { track, isFeatureEnabled } from "../../lib/analytics/track.ts";
import {
  compareMealsByChronology,
  defaultEatenAtForNewLog,
  eatenAtIsoFromLocalParts,
  localTimeInputValueFromIso,
  parseLocalTimeInput,
} from "../../lib/nutrition/mealEatenAt.ts";
import { type OffProductMacros } from "../../lib/openFoodFacts/fetchProductByBarcode.ts";
import { computeLoggingStreak } from "../../lib/nutrition/trackerStats.ts";
import {
  computeProtectedStreak,
  readFreezeLedger,
  type FreezeLedger,
} from "../../lib/nutrition/streakFreeze.ts";
import { didStreakReset } from "../../lib/nutrition/streakReset.ts";
import {
  normalizeWeekSummaryMode,
  weekSummaryDateKeys,
} from "../../lib/nutrition/weekSummaryWindow.ts";
import { scaleCaffeineAlcohol } from "../../lib/nutrition/scaleCaffeineAlcoholForGrams.ts";
import { scaleMicrosForGrams } from "../../lib/openFoodFacts/parseOffMicros.ts";
import { clampPortionMultiplier, scaledMacro } from "../../lib/nutrition/portionMultiplier.ts";
import { scaleMicrosPerServing } from "../../lib/nutrition/scaleMicrosPerServing";
import { formatWaterMl } from "../../lib/units/imperial.ts";
import {
  buildDayNutrientDetailRows,
  mealContributedFiberG,
  sumMicrosFromLoggedMeals,
} from "../../lib/nutrition/microNutrientDisplay.ts";
import { normalizeJournalSlotName } from "../../lib/nutrition/journalSlot.ts";
import { QuickAddPanel } from "./suppr/quick-add-panel";
import { SupprButton } from "./suppr/suppr-button";
import { CopyMealDialog } from "./suppr/copy-meal-dialog";
import { DuplicateDayDialog } from "./suppr/duplicate-day-dialog";
import { HydrationStimulantsCard } from "./suppr/hydration-stimulants-card";
import { useWeeklyRecap } from "./suppr/use-weekly-recap";
import { LogSheet } from "./suppr/log-sheet";
// Phase 4 / B3.Y — desktop modal mode for the LogSheet.
import { useIsDesktop } from "./ui/use-mobile";
import { NorthStarBlockHost } from "./suppr/north-star-block-host";
import { type NorthStarRecipe } from "../../lib/nutrition/northStarSuggestion";
import { buildPostLogSuggestion } from "../../lib/nutrition/postLogSuggestion";
import {
  dayActivityBudgetAddonWeb,
  loadRecentFoods,
  normalizeTrackedDashboardMacros,
  parseStepsDayMap,
  pushRecentFood,
} from "../../lib/nutrition/trackerLocalState.ts";
import { VoiceLogDialog } from "./suppr/voice-log-dialog";
import { PhotoLogDialog } from "./suppr/photo-log-dialog";
import { AiPaywallDialog, type AiPaywallFeature } from "./suppr/ai-paywall-dialog";
import { TodayLoadingSkeleton } from "./suppr/today-loading-skeleton.tsx";
import { TodayHeroStats } from "./suppr/today-hero-stats";
import { useWebWinMoment } from "../../lib/preferences/useWebWinMoment.ts";
import { useCommitPulse } from "../../lib/preferences/useCommitPulse.ts";
import { useLogConfirmCheck } from "../../lib/preferences/useLogConfirmCheck.ts";
import { WinMomentPlayer } from "./ui/win-moment-player.tsx";
import { TodayWeekSidebar } from "./suppr/today-week-sidebar";
import { TodayDesktopRightRail } from "./suppr/today-desktop-right-rail";
import { TodayPlannedMealsCard } from "./suppr/today-planned-meals-card";
import { TodayFastingPill } from "./suppr/today-fasting-pill";
import { TodayStepsCard } from "./suppr/today-steps-card";
import { TodayActivityBonusCard } from "./suppr/today-activity-bonus-card";
import { TodayScrollSectionHeader } from "./suppr/today-scroll-section-header";
import { TodayWeekView } from "./suppr/today-week-view";
import { TodayMacroSection } from "./suppr/today-macro-section";
import { useMacroDisplayStyle } from "../../lib/preferences/useMacroDisplayStyle";
import { FullNutrientPanelSheet } from "./suppr/full-nutrient-panel-sheet";
import { FULL_NUTRIENT_PANEL_ROW_COUNT } from "../../lib/nutrition/fullNutrientPanel";
import {
  MacroDetailPanel,
  isMacroDetailSupported,
  type MacroKey,
  type MacroMeal,
} from "./MacroDetailPanel";
import { TodaySnapShortcut } from "./suppr/today-snap-shortcut";
import { TodayMealsSection } from "./suppr/today-meals-section";
import { TodayRecentsRow } from "./suppr/today-recents-row";
import { MealNutritionDialog } from "./suppr/meal-nutrition-dialog";
import { ShareCommunityDialog } from "./suppr/ShareCommunityDialog";
import { BarcodeSavedAckDialog } from "./suppr/BarcodeSavedAckDialog";
import { COMPLETE_DAY_V3_COPY } from "../../lib/completeDayV3";
import {
  submitFoodCorrection,
  type FoodCorrectionInput,
} from "../../lib/foodCorrection/submitFoodCorrection";
import { EditMealDialog } from "./suppr/edit-meal-dialog";
import { TodayFirstMealEmptyState } from "./suppr/today-first-meal-empty-state";
import { TodayCompleteDayDialog } from "./suppr/today-complete-day-dialog";
import { TodayAddMealDialog } from "./suppr/today-add-meal-dialog";
import { FoodSearch, type FoodSearchSelection } from "./FoodSearch.tsx";
import { mealImageFields } from "../../lib/nutrition/foodHistory";
import { TodayBarcodeDialog, type TodayBarcodeConfirmPayload } from "./suppr/today-barcode-dialog";
import {
  CreateCustomFoodDialog,
  type CreateCustomFoodPayload,
} from "./suppr/create-custom-food-dialog";
import { createCustomFood } from "../../lib/nutrition/customFoodsClient";
import { TodayDateHeader } from "./suppr/today-date-header";
import { TodayDeficitInsight } from "./suppr/today-deficit-insight";
import { TodayWeeklyInsightMobileCard } from "./suppr/today-weekly-insight-mobile-card";
import { isBelowMealsPromptVisible } from "../../lib/today/belowMealsPromptSelection";
import { aiLoggingSourceLabel, type AiLoggedItem } from "../../lib/nutrition/aiLogging";
import { parseMealDescriptionTranscript } from "../../lib/nutrition/parseMealDescription.ts";
import {
  computeRecentMeals,
  foodHistoryKey,
  isAiSourcedFoodHistoryItem,
  type FoodHistoryItem,
} from "../../lib/nutrition/foodHistory";
import { computeSlotGoToFoods } from "../../lib/nutrition/slotGoToFoods";
import { normaliseMealSlot } from "../../lib/nutrition/mealSlots";
import { newId } from "../../context/appData/persistence";
import { isHealthImportFallbackTitle } from "../../lib/nutrition/healthImportLabels";
import { mapMealSourceToDot } from "../../lib/nutrition/sourceMap";
import { buildMealEntriesFromSavedMeal, selectUsualSavedMeal } from "../../lib/nutrition/savedMealsLogic";
import {
  toBreakdownIngredientRow,
  toBreakdownSnapshotRow,
  type BreakdownIngredientRow,
  type BreakdownSnapshotRow,
} from "../../lib/nutrition/macroIngredientBreakdown";
import {
  isSnapshotRowLowConfidence,
  persistEntryIngredientSnapshot,
  NUTRITION_ENTRY_INGREDIENTS_FLAG,
  NUTRITION_ENTRY_INGREDIENTS_TABLE,
  type NutritionEntryIngredientRow,
} from "../../lib/nutrition/nutritionEntryIngredients";
import {
  createSavedMeal,
  incrementLogCount,
  listSavedMeals,
  type SavedMeal,
  type SavedMealItem,
} from "../../lib/nutrition/savedMeals";
import {
  addFavorite,
  favoriteKey as favoriteFoodKey,
  listFavorites,
  removeFavorite,
  type FavoriteFood,
} from "../../lib/nutrition/favoriteFoods";
import { orderRecentWithFavoritesFirst } from "../../lib/nutrition/favoriteFoodsSearch";
import { isMealSlot, type MealSlot } from "../../lib/nutrition/mealSlots";
import {
  enabledMealSlotLabels,
  mealSectionSortOrder,
  parseUserMealSlotConfig,
  type UserMealSlotConfig,
} from "../../lib/nutrition/userMealSlotConfig";
import {
  journalSlotFromMealTypes,
  slotForHour,
} from "../../lib/nutrition/recipeJournalSlot";
import {
  parseDismissedSlots,
  serializeDismissedSlots,
  shouldShowUsualMealHint,
  USUAL_MEAL_HINT_STORAGE_KEY,
} from "../../lib/nutrition/usualMealHint";
import {
  PENDING_USUAL_MEAL_SAVE_KEY,
  parsePendingUsualMealSave,
} from "../../lib/nutrition/pendingUsualMealSave";
import { SaveMealDialog } from "./suppr/save-meal-dialog";
import {
  parseDateKey,
  shiftDateKey,
  todayKey,
  clampDateKey,
  formatDateLabel,
} from "../../lib/nutrition/trackerDate.ts";
import { countWeighInDaysInWindow } from "../../lib/nutrition/weighInDays.ts";
import { dateKeyFromDate, journalRangeBounds } from "../../lib/nutrition/journalNavigation.ts";
import {
  QUICK_ADD_COLLAPSED_STORAGE_KEY,
  isHydrationCardVisible,
  isStepsCardVisible,
  parseQuickAddCollapsed,
  serializeQuickAddCollapsed,
} from "../../lib/nutrition/todayProgressiveDisclosure.ts";
import {
  DEFAULT_TRACKING_EXTRAS,
  TRACKING_EXTRAS_STORAGE_KEY,
  parseTrackingExtras,
  type TrackingExtras,
} from "../../lib/nutrition/trackingExtras.ts";

export {
  parseDateKey,
  shiftDateKey,
  todayKey,
  formatDateLabel,
  clampDateKey,
} from "../../lib/nutrition/trackerDate.ts";

// 2026-05-08 build-47 fix — Grace TF: tapping "+ Breakfast" in
// the afternoon was logging picks as Snacks. Pick-handlers must use
// `mealSlot` (the user's choice), and the generic LogSheet-open paths
// must reset `mealSlot` to a fresh time-of-day default.
//
// ENG-773 (2026-05-30): `slotForHour` is now imported from the shared
// `recipeJournalSlot` lib (single source of truth) instead of a local
// copy. The old local copy used 10/14/17 cutoffs while the shared
// helper (and mobile) used 11/15/17, so the same clock time seeded a
// different default slot depending on platform — a 10–11am / 2–3pm
// open bucketed differently on web vs mobile. Both now agree via the
// shared ladder. Net behaviour change: a 10:30am open now seeds
// Breakfast (was Lunch); a 2:30pm open now seeds Lunch (was Snacks).

type FastingSessionRow = { start: string; end: string | null };

interface NutritionTrackerProps {
  userTier: UserTier;
  onOpenProgress?: () => void;
  onOpenSettings?: () => void;
}

export const NutritionTracker = memo(function NutritionTracker({
  userTier,
  onOpenProgress,
  onOpenSettings,
}: NutritionTrackerProps) {
  // User-configurable macro display variant. Default `tiles` matches
  // historic UI; `bars` is the Cronometer/Lose It-style list (Settings
  // → Display → Macro display). Pref persists via localStorage.
  const [macroDisplayStyle] = useMacroDisplayStyle();
  // ENG-1252 — first-session AI-method discoverability tooltip gate.
  const aiMethodTooltipVisible = useAiMethodTooltip(userTier);
  const {
    nutritionTargets,
    setNutritionTargets,
    dayTargetSchedule,
    selectedDateKey,
    setSelectedDateKey,
    mealsForSelectedDate,
    addLoggedMeal,
    addLoggedMealForDate,
    removeLoggedMeal,
    updateLoggedMeal,
    copyMealToDate,
    copyMealToDateRange,
    duplicateDay,
    duplicateDayToDateRange,
    mealPlan,
    savedRecipesForLibrary,
    preferActivityAdjustedCalories,
    setPreferActivityAdjustedCalories,
    activityBurnForSelectedDay,
    activityBurnByDay,
    addWaterMlForSelectedDay,
    extraWaterMlForSelectedDay,
    addCaffeineMgForSelectedDay,
    extraCaffeineMgForSelectedDay,
    extraCaffeineByDay: _extraCaffeineByDay,
    addAlcoholGForSelectedDay,
    extraAlcoholGByDay,
    resetHydrationStimulantsForDay,
    targetCaffeineMg,
    targetAlcoholGWeekly,
    workoutsByDay,
    basalBurnByDay,
    profileMeasurementSystem,
    profileTimeZone,
    nutritionJournalHydrated,
    nutritionByDay,
    extraWaterByDay,
    notificationPrefs,
    profileDisplayName,
    authEmail,
    netCarbsLensEnabled,
    householdMemberCount,
  } = useAppData();
  void _extraCaffeineByDay; // unused — caffeine shown only via today's number

  // ENG-798 (Redesign — Design Direction 2026) — gate the Today win-moment
  // detection until after first paint so the initial snapshot is captured
  // as the baseline (the hook treats the first snapshot as `prev` and never
  // fires on it). Web's AppData context is already hydrated on mount, so a
  // simple post-mount flip is the analog of mobile's `hydrated` journal flag.
  const [winReady, setWinReady] = useState(false);
  useEffect(() => {
    setWinReady(true);
  }, []);

  const useImperialWater = profileMeasurementSystem === "imperial";
  const formatWaterLine = (ml: number) =>
    useImperialWater ? formatWaterMl(ml, true) : ml >= 1000 ? `${(ml / 1000).toFixed(1).replace(/\.0$/, "")}L` : `${ml}ml`;

  const streakDays = useMemo(() => computeLoggingStreak(nutritionByDay), [nutritionByDay]);
  const loggedDays = useMemo(() => {
    const s = new Set<string>();
    for (const [k, meals] of Object.entries(nutritionByDay)) {
      if (meals?.length) s.add(k);
    }
    return s;
  }, [nutritionByDay]);
  const [ringExpanded, setRingExpanded] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  /** Batch 1.4 — meal row context menu: target meal id for the Copy dialog. */
  const [copyMealTargetId, setCopyMealTargetId] = useState<string | null>(null);
  // P5 parity gap #15 — per-meal nutrition-detail dialog target. Holds the id
  // of the meal whose breakdown is open; the dialog resolves the full LoggedMeal
  // (with micros) from `mealsForSelectedDate`, mirroring the copy-meal pattern.
  const [mealNutritionTargetId, setMealNutritionTargetId] = useState<string | null>(null);
  // ENG-837 — slot-aggregate nutrition dialog target. Holds the slot NAME whose
  // combined breakdown is open; the dialog sums that slot's meals (resolved from
  // `mealsGrouped`) via the shared helpers. Mirrors the mobile `?slot=&date=`
  // screen mode.
  const [slotNutritionTarget, setSlotNutritionTarget] = useState<string | null>(null);
  const [macroDetailTarget, setMacroDetailTarget] = useState<MacroKey | null>(null);
  // ENG-1247 — community-contribution opt-in: set after a not-found barcode is
  // saved as a private custom food (when `barcode_community_contribution` is on)
  // to open the share dialog. null = closed.
  const [shareCommunityInput, setShareCommunityInput] = useState<FoodCorrectionInput | null>(null);
  const [barcodeSavedAckName, setBarcodeSavedAckName] = useState<string | null>(null);
  const [macroDetailIngredientRows, setMacroDetailIngredientRows] = useState<BreakdownIngredientRow[]>([]);
  // ENG-751 — persisted AI/photo/voice per-item snapshot rows for the open
  // day's entries. Gated by the display flag; flag-OFF leaves this empty so the
  // panel keeps today's single-line fallback (data backfills while dark).
  const [macroDetailSnapshotRows, setMacroDetailSnapshotRows] = useState<BreakdownSnapshotRow[]>([]);
  const [editMealTargetId, setEditMealTargetId] = useState<string | null>(null);
  /** Batch 1.4 — Duplicate day dialog visibility. */
  const [duplicateDayOpen, setDuplicateDayOpen] = useState(false);
  const [mealSlot, setMealSlot] = useState("Breakfast");
  const [userMealSlotConfig, setUserMealSlotConfig] = useState<UserMealSlotConfig | null>(
    null,
  );
  const enabledMealSlots = useMemo(
    () => enabledMealSlotLabels(userMealSlotConfig),
    [userMealSlotConfig],
  );
  const mealSectionOrder = useMemo(
    () => mealSectionSortOrder(userMealSlotConfig),
    [userMealSlotConfig],
  );
  const [recipeId, setRecipeId] = useState("");
  const [timeLabel, setTimeLabel] = useState("12:00 PM");

  const macroDetailFlagEnabled = isFeatureEnabled("web_macro_detail_panel");
  const openMacroDetail = useCallback((macro: string) => {
    if (!macroDetailFlagEnabled) return;
    // Shared affordance/handler source of truth (ENG-848): the same
    // `isMacroDetailSupported` set gates which tiles/bars render as buttons, so
    // a tappable tile can never resolve to a macro this handler ignores.
    if (isMacroDetailSupported(macro)) {
      setMacroDetailTarget(macro);
    }
  }, [macroDetailFlagEnabled]);

  // ENG-1247 — `.md-totalgrid` cell tap: close the dialog, open macro-detail.
  // Undefined when the panel is off → cells render static (no dead tap, ENG-848).
  const macroTapFromDialog = useCallback(
    (closeDialog: () => void) =>
      macroDetailFlagEnabled
        ? (macro: string) => {
            closeDialog();
            openMacroDetail(macro);
          }
        : undefined,
    [macroDetailFlagEnabled, openMacroDetail],
  );

  const macroDetailMeals = useMemo<MacroMeal[]>(
    () =>
      mealsForSelectedDate.map((meal) => ({
        id: meal.id,
        name: meal.name,
        recipeTitle: meal.recipeTitle,
        recipeId: meal.recipeId ?? null,
        portionMultiplier: meal.portionMultiplier ?? 1,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        fiberG: mealContributedFiberG(meal),
        // ENG-1213 web↔mobile water-breakdown parity: carry per-meal water so
        // the macro-detail panel's By-meal view can total water for macro="water"
        // (mirrors mobile useMacroDetail's `water_ml` → waterMl mapping). The
        // source value already flows DB → LoggedMeal via useNutritionJournalState
        // (`water_ml` → `waterMl`).
        waterMl: meal.waterMl ?? 0,
        micros: meal.micros ?? null,
      })),
    [mealsForSelectedDate],
  );

  useEffect(() => {
    if (!macroDetailFlagEnabled || macroDetailTarget == null) {
      setMacroDetailIngredientRows([]);
      return;
    }
    const recipeIds = Array.from(
      new Set(macroDetailMeals.map((meal) => meal.recipeId).filter((id): id is string => Boolean(id))),
    );
    if (recipeIds.length === 0) {
      setMacroDetailIngredientRows([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("recipe_ingredients")
      .select("recipe_id, name, calories, protein, carbs, fat, fiber_g")
      .in("recipe_id", recipeIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[macro-detail] recipe_ingredients fetch failed:", error.message);
          setMacroDetailIngredientRows([]);
          return;
        }
        setMacroDetailIngredientRows(
          (data ?? []).map((row: Record<string, unknown>) =>
            toBreakdownIngredientRow({
              recipeId: String(row.recipe_id ?? ""),
              name: String(row.name ?? "Item"),
              calories: Number(row.calories) || 0,
              protein: Number(row.protein) || 0,
              carbs: Number(row.carbs) || 0,
              fat: Number(row.fat) || 0,
              fiberG: Number(row.fiber_g) || 0,
            }),
          ),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [macroDetailFlagEnabled, macroDetailMeals, macroDetailTarget]);

  // ENG-751 — fetch persisted AI snapshot rows for the open day's entries,
  // gated by the display flag. Fully defensive: a missing table (pre-push) or a
  // failed query swallows + leaves the rows empty, so the panel degrades to the
  // recipe / single-line fallback path. Covers EVERY entry id (AI meals have no
  // recipe_id, so the recipe-id set above would miss them).
  useEffect(() => {
    if (
      !macroDetailFlagEnabled ||
      macroDetailTarget == null ||
      !isFeatureEnabled(NUTRITION_ENTRY_INGREDIENTS_FLAG)
    ) {
      setMacroDetailSnapshotRows([]);
      return;
    }
    const entryIds = Array.from(
      new Set(macroDetailMeals.map((meal) => meal.id).filter((id): id is string => Boolean(id))),
    );
    if (entryIds.length === 0) {
      setMacroDetailSnapshotRows([]);
      return;
    }
    let cancelled = false;
    supabase
      .from(NUTRITION_ENTRY_INGREDIENTS_TABLE)
      .select("entry_id, name, calories, protein, carbs, fat, fiber_g, confidence")
      .in("entry_id", entryIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn(
            "[macro-detail] nutrition_entry_ingredients fetch failed:",
            error.message,
          );
          setMacroDetailSnapshotRows([]);
          return;
        }
        setMacroDetailSnapshotRows(
          ((data ?? []) as NutritionEntryIngredientRow[]).map((row) =>
            toBreakdownSnapshotRow({
              entryId: row.entry_id,
              name: row.name,
              lowConfidence: isSnapshotRowLowConfidence(row),
              calories: row.calories,
              protein: row.protein,
              carbs: row.carbs,
              fat: row.fat,
              fiberG: row.fiber_g,
            }),
          ),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [macroDetailFlagEnabled, macroDetailMeals, macroDetailTarget]);

  useEffect(() => {
    if (!isFeatureEnabled("editable_eaten_at")) return;
    setTimeLabel(localTimeInputValueFromIso(defaultEatenAtForNewLog(selectedDateKey, profileTimeZone), profileTimeZone));
  }, [profileTimeZone, selectedDateKey]);

  const eatenAtForCurrentLog = useCallback((): Pick<LoggedMeal, "eatenAt"> => {
    if (!isFeatureEnabled("editable_eaten_at")) return {};
    const localTime = parseLocalTimeInput(timeLabel);
    const eatenAt = localTime
      ? eatenAtIsoFromLocalParts(selectedDateKey, localTime.hours, localTime.minutes, profileTimeZone)
      : defaultEatenAtForNewLog(selectedDateKey, profileTimeZone);
    return { eatenAt };
  }, [profileTimeZone, selectedDateKey, timeLabel]);

  const [addMode, setAddMode] = useState<"recipe" | "manual">("recipe");
  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState(0);
  const [manualProtein, setManualProtein] = useState(0);
  const [manualCarbs, setManualCarbs] = useState(0);
  const [manualFat, setManualFat] = useState(0);
  const [manualFiber, setManualFiber] = useState(0);
  const [manualWater, setManualWater] = useState(0);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  // Phase 3 / B2.1 (D-2026-04-27-15) — canonical LogSheet open state.
  // The web LogSheet wires its sub-tabs to existing flows (FoodSearch
  // dialog, barcode dialog, voice dialog, photo dialog) rather than
  // re-implementing them. Opening the sheet replaces the Phase 2
  // "Coming in Phase 3" alert path.
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [logSheetConfirmation, setLogSheetConfirmation] = useState<
    NonNullable<React.ComponentProps<typeof LogSheet>["confirmation"]> | null
  >(null);
  const [logBasket, setLogBasket] = useState<
    Array<{ basketId: string; selection: FoodSearchSelection }>
  >([]);
  useEffect(() => {
    if (!logSheetOpen) {
      setLogSheetConfirmation(null);
      setLogBasket([]);
    }
  }, [logSheetOpen]);
  // 2026-04-30 (web mobile-web parity with mobile commit `6633d2d`):
  // consume the `?openLog=1` URL param dispatched by the centered
  // raised Plus button in the App.tsx mobile-web `<nav>` (mirrors the
  // mobile `<SupprTabBar>` raised-button pattern). The button lives
  // globally across all tabs; tapping it from Recipes / Plan / You
  // routes to Today and stamps `openLog=1`. We open the canonical
  // `<LogSheet>` here (which owns the journal write path) and clear
  // the param so a back-nav doesn't re-open the sheet.
  const trackerRouter = useRouter();
  const trackerSearchParams = useSearchParams();
  const openLogParam = trackerSearchParams.get("openLog");
  // ENG-1450 — paired `openLogQuery` pre-fills LogSheet's search (web
  // parity with mobile). Absent → LogSheet opens with empty search.
  const [logSheetInitialQuery, setLogSheetInitialQuery] = useState<string | undefined>(undefined);
  const openLogQueryParam = trackerSearchParams.get("openLogQuery") ?? undefined;
  useEffect(() => {
    if (openLogParam !== "1") return;
    // 2026-05-08 build-47 fix — generic `?openLog=1` deep-link is
    // not slot-specific. Reset mealSlot to time-of-day so the LogSheet
    // header + the pick-handlers default to the right slot. The
    // slot-specific `+ Breakfast` path (onOpenAddForSlot) overrides this.
    setMealSlot(slotForHour(new Date().getHours()));
    setLogSheetInitialQuery(openLogQueryParam);
    setLogSheetOpen(true);
    const params = new URLSearchParams(trackerSearchParams.toString());
    params.delete("openLog");
    params.delete("openLogQuery");
    const q = params.toString();
    trackerRouter.replace(q ? `/home?${q}` : "/home", { scroll: false });
  }, [openLogParam, openLogQueryParam, trackerRouter, trackerSearchParams]);
  // Phase 4 / B3.Y — desktop (≥1024px) renders the LogSheet as a
  // centred 480×640 modal per spec §Surface B; below that, the
  // primitive falls back to the mobile bottom-sheet layout.
  const isDesktop = useIsDesktop();
  const [barcodeValue, setBarcodeValue] = useState("");
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [barcodePreview, setBarcodePreview] = useState<OffProductMacros | null>(null);
  /**
   * F-156 PR-2 (2026-05-10) — barcode-not-found → "Add as custom food"
   * handoff. Carries the scanned barcode forward to the
   * CreateCustomFoodDialog so the saved row's `barcode` column is
   * set; the next scan resolves successfully.
   */
  const [customFoodFromBarcode, setCustomFoodFromBarcode] = useState<string | null>(null);
  const [barcodeGramsStr, setBarcodeGramsStr] = useState("100");
  const barcodeGramsParsed = useMemo(() => {
    const n = Number.parseFloat(barcodeGramsStr.replace(",", ".").trim());
    if (!Number.isFinite(n) || n <= 0) return 100;
    return Math.min(10_000, Math.round(n * 10) / 10);
  }, [barcodeGramsStr]);
  const [barcodeTitleOverride, setBarcodeTitleOverride] = useState("");
  const [barcodeMacrosManual, setBarcodeMacrosManual] = useState(false);
  const [barcodeEditCal, setBarcodeEditCal] = useState("");
  const [barcodeEditPro, setBarcodeEditPro] = useState("");
  const [barcodeEditCarb, setBarcodeEditCarb] = useState("");
  const [barcodeEditFat, setBarcodeEditFat] = useState("");
  const [trackedDashboardMacros, setTrackedDashboardMacros] = useState<string[]>(["protein", "carbs", "fat"]);
  const [recentFoods, setRecentFoods] = useState<string[]>(() =>
    typeof window !== "undefined" ? loadRecentFoods() : [],
  );
  /**
   * Post-ship #5 (C1a, 2026-04-18) — shared `<FoodSearch>` host.
   * Replaces the former inline USDA-only search tab inside
   * `TodayAddMealDialog`. Opening this modal closes the Add-meal
   * dialog (if open) — parity with mobile's Add-meal → FoodSearchModal
   * hand-off. `<FoodSearch>` surfaces custom foods at the top, with
   * USDA + OFF results underneath.
   */
  const [foodSearchOpen, setFoodSearchOpen] = useState(false);
  /** Recipe log: scale catalog/saved recipe macros (1 = solo, 2 = shared dinner, etc.). */
  const [recipePortionMultiplier, setRecipePortionMultiplier] = useState(1);

  // Batch 5.13 — Pro-gated Voice + AI photo logging dialogs replace the
  // legacy free-tier inline text dialog and `<input type="file">` upload.
  const [voiceLogOpen, setVoiceLogOpen] = useState(false);
  const [photoLogOpen, setPhotoLogOpen] = useState(false);
  const [aiPaywallFeature, setAiPaywallFeature] = useState<AiPaywallFeature | null>(null);
  const [completeDayOpen, setCompleteDayOpen] = useState(false);
  const [whyThisNumberOpen, setWhyThisNumberOpen] = useState(false);
  /** Full-nutrient panel sheet (PR #47, re-wired 2026-05-02) — opened
   *  from the "View all N nutrients" pill inside
   *  `TodayDashboardMacroTiles` after the Today-canvas
   *  `TodayMicrosWidget` was removed (revert PR #30). */
  const [fullNutrientPanelOpen, setFullNutrientPanelOpen] = useState(false);
  const [profileWeightKg, setProfileWeightKg] = useState<number | null>(null);
  const [profileGoal, setProfileGoal] = useState<string | null>(null);
  /** `plan_pace` preset enum from `profiles.plan_pace` — used by the
   *  WhyThisNumberDialog to compute the user's weekly kg pace. Stored
   *  loosely as `string | null` to mirror the column's nullable nature. */
  const [profilePlanPace, setProfilePlanPace] = useState<string | null>(null);
  const [profileMaintenanceTdee, setProfileMaintenanceTdee] = useState<number | null>(null);
  const [profileWeightKgByDay, setProfileWeightKgByDay] = useState<Record<string, number>>({});
  // Weekly TDEE check-in ritual (PR claude/weekly-checkin-ritual-v2,
  // 2026-05-02 — rebuild of #26). Mirrors mobile state shape.
  // `weeklyCheckinHandledRef` suppresses re-fires within the session.
  const [weeklyCheckinShownAt, setWeeklyCheckinShownAt] = useState<string | null>(null);
  const [weeklyCheckinOpen, setWeeklyCheckinOpen] = useState(false);
  const [weeklyCheckinContent, setWeeklyCheckinContent] =
    useState<WeeklyCheckinContent | null>(null);
  const [profileFormulaTdee, setProfileFormulaTdee] = useState<number | null>(null);
  // Raw adaptive TDEE + confidence from the profile row. Distinct from
  // `profileMaintenanceTdee`, which is the resolver-collapsed value
  // (adaptive when confident, else formula). The weekly check-in gate
  // wants the adaptive value specifically.
  const [profileAdaptiveTdeeRaw, setProfileAdaptiveTdeeRaw] = useState<number | null>(null);
  const [profileAdaptiveTdeeConfidenceRaw, setProfileAdaptiveTdeeConfidenceRaw] =
    useState<WeeklyCheckinConfidence | null>(null);
  const weeklyCheckinHandledRef = useRef(false);
  // F-3 (2026-04-19) — track the source + confidence so the Activity
  // Bonus card's info popover can render the canonical copy shared
  // with Progress. `null` source means "popover will fall back to the
  // richer BMR × multiplier breakdown" (for users on the narrow
  // fallback profile select where adaptive columns aren't available).
  const [profileMaintenanceSource, setProfileMaintenanceSource] = useState<
    "measured" | "adaptive" | "formula" | null
  >(null);
  const [profileMaintenanceConfidence, setProfileMaintenanceConfidence] = useState<
    "low" | "medium" | "high" | null
  >(null);
  // Cached profile basics (sex / height / age / activity_level) needed
  // by the activity-bonus info popover so it can show "BMR × multiplier"
  // without a second profile fetch (TestFlight `AAtW7dYcCBPyBdsMU6UqiQQ`,
  // 2026-04-18).
  const [profileSex, setProfileSex] = useState<"male" | "female" | "unspecified" | null>(null);
  const [profileHeightCm, setProfileHeightCm] = useState<number | null>(null);
  const [profileAge, setProfileAge] = useState<number | null>(null);
  const [profileActivityLevel, setProfileActivityLevel] = useState<
    "sedentary" | "light" | "moderate" | "active" | "very_active" | null
  >(null);
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [weekStartDay, setWeekStartDay] = useState<"monday" | "sunday">("monday");
  const [activityBudgetDiscoverDismissed, setActivityBudgetDiscoverDismissed] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setActivityBudgetDiscoverDismissed(
        window.localStorage.getItem(ACTIVITY_BUDGET_DISCOVERABILITY_KEY) === "1",
      );
    } catch {
      setActivityBudgetDiscoverDismissed(false);
    }
  }, []);
  // Batch 4.11 — streak freeze state. Ledger is loaded from `profiles`
  // alongside `week_start_day`; budget defaults to 3.
  const [freezeLedger, setFreezeLedger] = useState<FreezeLedger>({
    earnedAt: [],
    usedHistory: [],
  });
  const [freezeBudgetMax, setFreezeBudgetMax] = useState<number>(3);
  // 2026-04-18 audit H7 — `DayStrip` renders a ❄ glyph on each tile whose
  // date was absorbed by a freeze. The parent computes the set once so
  // both DayStrip instances (day + week view) read the same value.
  //
  // L6 G8 (2026-04-18) — the memo also exposes `streakLength` so the
  // `streak_reset` effect below can detect >=1 → 0 transitions without
  // re-computing the whole thing.
  const protectedStreakInfo = useMemo(() => {
    // Cast mirrors `ProgressDashboard`'s consumption of the same shared
    // helper — `LoggedMeal` satisfies the pure `StreakMeal` union via
    // its `.calories` field; the cast just silences the structural
    // widening without changing the runtime contract.
    return computeProtectedStreak(nutritionByDay as never, freezeLedger, freezeBudgetMax);
  }, [nutritionByDay, freezeLedger, freezeBudgetMax]);
  const protectedDateKeys = useMemo(
    () => new Set(protectedStreakInfo.protectedDateKeys),
    [protectedStreakInfo],
  );
  const protectedStreakLength = protectedStreakInfo.streakLength;
  // L6 G8 (2026-04-18) — fire `streak_reset` exactly once when the
  // protected streak transitions from >=1 to 0. Seeded with `null` on
  // mount so a user who currently has a zero streak doesn't generate a
  // spurious event on first render.
  const priorProtectedStreakRef = useRef<number | null>(null);
  useEffect(() => {
    const prior = priorProtectedStreakRef.current;
    priorProtectedStreakRef.current = protectedStreakLength;
    if (didStreakReset(prior, protectedStreakLength)) {
      try {
        track(AnalyticsEvents.streak_reset, {
          priorStreak: prior ?? 0,
        });
      } catch {
        /* analytics is fire-and-forget */
      }
    }
  }, [protectedStreakLength]);
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [dailyStepsGoal, setDailyStepsGoal] = useState(DEFAULT_STEPS_GOAL);
  const [fastingSessions, setFastingSessions] = useState<FastingSessionRow[]>([]);
  const [fastingNowTick, setFastingNowTick] = useState(() => Date.now());
  // F-109 (TestFlight `AFHtAQRAWad1w8bDvSgZkUg`, 2026-05-06): web parity
  // for the IF opt-in gate. The "Start fast" idle pill on Today only
  // renders when `profiles.fasting_window != null` (Grace, 2026-05-07).
  const [fastingOptedIn, setFastingOptedIn] = useState<boolean>(false);
  const calendarInputRef = useRef<HTMLInputElement>(null);
  const { authedUserId, authUserCreatedAt } = useAuthSession();
  // ENG-805 — in-feed banner dismissal (web parity with mobile AsyncStorage gate).
  const [checkinBannerDismissed, setCheckinBannerDismissed] = useState<boolean | null>(
    null,
  );
  const checkinWeekKey = useMemo(
    () => weekKeyFor(new Date(), weekStartDay),
    [weekStartDay],
  );
  const isCheckinBannerDay = useMemo(() => {
    const dow = new Date().getDay();
    return weekStartDay === "sunday" ? dow === 0 : dow === 1;
  }, [weekStartDay]);
  useEffect(() => {
    if (!authedUserId) {
      setCheckinBannerDismissed(true);
      return;
    }
    setCheckinBannerDismissed(isCheckinBannerDismissed(authedUserId, checkinWeekKey));
  }, [authedUserId, checkinWeekKey]);

  // Audit M4 (2026-04-18) — Today progressive disclosure on web.
  // Matches mobile. Persists the Quick Add collapsed pref via localStorage
  // under `QUICK_ADD_COLLAPSED_STORAGE_KEY`. Manual expanders let a user
  // reveal the Hydration / Steps cards on first run without waiting for
  // gate conditions to unlock them.
  const [quickAddCollapsed, setQuickAddCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return parseQuickAddCollapsed(window.localStorage.getItem(QUICK_ADD_COLLAPSED_STORAGE_KEY));
    } catch {
      return true;
    }
  });
  const [hydrationManualExpanded, setHydrationManualExpanded] = useState(false);
  // Phase 2 / B1.4 (D-2026-04-27-08) — Tracking extras opt-in.
  // Caffeine + alcohol Today widgets gate on this pref. Default OFF.
  // localStorage-only; mirrors the mobile pref under the same key.
  // The Settings page is the writer; NutritionTracker is the reader.
  // We re-read on the `storage` event so cross-tab edits propagate
  // (important on mobile-web where Settings + Today can be split
  // tabs in some browsers).
  const [trackingExtras, setTrackingExtras] = useState<TrackingExtras>(() => {
    if (typeof window === "undefined") return { ...DEFAULT_TRACKING_EXTRAS };
    try {
      return parseTrackingExtras(window.localStorage.getItem(TRACKING_EXTRAS_STORAGE_KEY));
    } catch {
      return { ...DEFAULT_TRACKING_EXTRAS };
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: StorageEvent) => {
      if (event.key !== TRACKING_EXTRAS_STORAGE_KEY) return;
      setTrackingExtras(parseTrackingExtras(event.newValue));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  const toggleQuickAddCollapsed = useCallback(() => {
    setQuickAddCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(QUICK_ADD_COLLAPSED_STORAGE_KEY, serializeQuickAddCollapsed(next));
        } catch {
          /* best-effort */
        }
      }
      return next;
    });
  }, []);

  /**
   * 2026-05-01 (journey-architect P1) — first-meal empty-state state.
   * Two pieces:
   *  - `userCreatedAt`: pulled once from `supabase.auth.getSession`.
   *    Drives the "brand-new account" flag (< 24h) for the IG/TT tip line.
   *  - `firstMealTipDismissed`: localStorage-backed boolean so the tip
   *    line never reappears once dismissed.
   *
   * Mobile parity: same logic in `apps/mobile/app/(tabs)/index.tsx`
   * (AsyncStorage backed there, same versioned key).
   */
  const FIRST_MEAL_TIP_DISMISSED_KEY = "suppr.first-meal-tip-dismissed.v1";
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUserCreatedAt(data.session?.user?.created_at ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const isBrandNewUser = useMemo(() => {
    if (!userCreatedAt) return false;
    const t = Date.parse(userCreatedAt);
    if (!Number.isFinite(t)) return false;
    return Date.now() - t < 24 * 60 * 60 * 1000;
  }, [userCreatedAt]);
  const [firstMealTipDismissed, setFirstMealTipDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(FIRST_MEAL_TIP_DISMISSED_KEY) != null;
    } catch {
      return false;
    }
  });
  const dismissFirstMealTip = useCallback(() => {
    setFirstMealTipDismissed(true);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(FIRST_MEAL_TIP_DISMISSED_KEY, new Date().toISOString());
    } catch {
      /* storage denied — in-session state hides tip */
    }
  }, []);

  /** Log a history row (Favourite / Frequent / Recent) into the active
   * meal slot. Shared by the QuickAddPanel history rows so the event
   * shape is consistent. */
  const logHistoryItem = useCallback(
    (item: FoodHistoryItem, slot: string) => {
      // Audit L6 G1 (2026-04-18) — the canonical `food_logged` event
      // is now fired inside `addLoggedMeal` with the supplied source,
      // so we pass "quick_add" here instead of double-emitting. Drops
      // the prior secondary `track(food_logged, { source: "quick_add", slot })`
      // call that could desync from the primitive's payload.
      //
      // Tracking-extras autoupdate (2026-05-01) — re-attach caffeine /
      // alcohol micros so the journal-state insert path picks up the
      // F-13 daily bump. `computeRecentMeals` / `computeFrequentMeals`
      // average per-occurrence stimulant contribution into
      // `item.caffeineMg` / `item.alcoholG`. Missing → no key in
      // `micros` (and `addLoggedMeal` skips the bump).
      const micros: Record<string, number> = item.micros ? { ...item.micros } : {};
      if (item.caffeineMg != null && item.caffeineMg > 0) micros.caffeineMg = item.caffeineMg;
      if (item.alcoholG != null && item.alcoholG > 0) micros.alcoholG = item.alcoholG;
      addLoggedMeal(
        {
          name: slot,
          recipeTitle: item.recipeTitle,
          time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          ...(item.fiber != null ? { fiberG: item.fiber } : {}),
          ...(item.source ? { source: item.source } : {}),
          ...(Object.keys(micros).length > 0 ? { micros } : {}),
        },
        "quick_add",
      );
      toast.success(`Logged ${item.recipeTitle} to ${slot}.`);
    },
    [addLoggedMeal],
  );

  /** Expand a saved-meal combo into individual journal entries and
   * insert each one via the same primitive as manual logs. Batch 2.6. */
  const logSavedMeal = useCallback(
    (meal: SavedMeal, slot: string) => {
      const timeLabel = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      // Build entries — makeId is swallowed because addLoggedMealForDate
      // mints its own id. We pass `() => ""` here; the id field is
      // discarded before insert. Using `newId` is impossible (it is
      // file-local to persistence.ts) and unnecessary.
      const entries = buildMealEntriesFromSavedMeal(meal, slot, timeLabel, () => "");
      for (const entry of entries) {
        const {
          id: _discardedId,
          sourceId: _discardedSourceId,
          ...payload
        } = entry;
        void _discardedId;
        void _discardedSourceId;
        addLoggedMealForDate(selectedDateKey, payload, "saved_meal");
      }
      toast.success(`Logged ${meal.name} to ${slot}.`);
    },
    [addLoggedMealForDate, selectedDateKey],
  );

  // -- Save-usual-meal dialog (audit H4, 2026-04-18; Ship M1, 2026-04-18) --
  //
  // `SaveMealDialog` and its creation flow were lifted out of
  // `QuickAddPanel` so the host is the single owner of the dialog.
  // Replaces the prior save-combo CustomEvent bridge with a plain prop
  // callback (`onOpenSaveCombo`) + a refresh token the panel watches to
  // refetch `listSavedMeals`.
  //
  // Ship M1: the host also owns the full saved-meals list so the meal-slot
  // section can render the `Log usual: {name}` pill directly (no duplicate
  // fetch in `QuickAddPanel`).
  const [saveComboOpen, setSaveComboOpen] = useState(false);
  const [saveComboSeedItems, setSaveComboSeedItems] = useState<
    Array<Omit<SavedMealItem, "id" | "position">>
  >([]);
  const [saveComboDefaultSlot, setSaveComboDefaultSlot] = useState<
    "Breakfast" | "Lunch" | "Dinner" | "Snacks" | undefined
  >(undefined);
  const [saveComboSuggestedName, setSaveComboSuggestedName] = useState<string>("");
  const [savedMealsRefreshToken, setSavedMealsRefreshToken] = useState(0);

  // Ship M1 — saved meals shared between `TodayMealsSection` (for the
  // "Log usual" slot-header pill + full-width save row visibility) and
  // `QuickAddPanel` (for the Usual meals tab). Host is now the owner of
  // record so both surfaces read the same list.
  const [hostSavedMeals, setHostSavedMeals] = useState<SavedMeal[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!authedUserId) {
      setHostSavedMeals([]);
      return;
    }
    listSavedMeals(supabase, authedUserId)
      .then((rows) => {
        if (!cancelled) setHostSavedMeals(rows);
      })
      .catch((err) => {
         
        console.warn("NutritionTracker listSavedMeals failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [authedUserId, savedMealsRefreshToken]);

  /** Favourites-in-search (teardown #1, ENG-1041) — the user's starred foods,
   *  loaded once and threaded into the LogSheet's inline FoodSearchPanel so
   *  favourites surface IN search (a "Favourites" group above "Past logged"
   *  + favourites-first in the empty-query Recent strip + a per-row star
   *  toggle). The same `user_favorite_foods` model QuickAddPanel uses; the
   *  host owns the list here because the LogSheet is a host-owned surface.
   *  Mobile parity: `apps/mobile/app/(tabs)/index.tsx`. */
  const [hostFavorites, setHostFavorites] = useState<FavoriteFood[]>([]);
  const [favoritePendingKeys, setFavoritePendingKeys] = useState<Set<string>>(
    () => new Set(),
  );
  useEffect(() => {
    let cancelled = false;
    if (!authedUserId) {
      setHostFavorites([]);
      return;
    }
    listFavorites(supabase, authedUserId)
      .then((rows) => {
        if (!cancelled) setHostFavorites(rows);
      })
      .catch((err) => {
        console.warn("NutritionTracker listFavorites failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [authedUserId]);

  /** Optimistic star/unstar from a food-search row. Mirrors the mobile host
   *  + QuickAddPanel `toggleFavorite`: add/remove immediately, revert on
   *  Supabase failure, guard double-submit via `favoritePendingKeys`. */
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
      if (!authedUserId) return;
      const key = favoriteFoodKey(food.recipeTitle, food.calories);
      if (favoritePendingKeys.has(key)) return;
      setFavoritePendingKeys((s) => new Set(s).add(key));
      const snapshot = hostFavorites;
      const wasStarred = Boolean(food.favoriteId);
      try {
        if (wasStarred && food.favoriteId) {
          setHostFavorites((prev) => prev.filter((f) => f.id !== food.favoriteId));
          await removeFavorite(supabase, authedUserId, food.favoriteId);
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
          const saved = await addFavorite(supabase, authedUserId, {
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
        console.warn("NutritionTracker food favourite toggle failed", err);
      } finally {
        setFavoritePendingKeys((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
      }
    },
    [authedUserId, hostFavorites, favoritePendingKeys],
  );

  /** Favourite key set — drives favourites-first ordering of the empty-query
   *  Recent browse list (web's empty-query recent strip lives in the LogSheet
   *  `recent` browse tab, not the panel, so the ordering is applied here). */
  const favoriteKeySetForRecent = useMemo(
    () =>
      new Set(hostFavorites.map((f) => favoriteFoodKey(f.recipeTitle, f.calories))),
    [hostFavorites],
  );

  // Ship M1 — usual-meal first-run hint dismiss state. Persisted under a
  // versioned key; hydrated once on mount and rehydrated when a different
  // tab writes to localStorage.
  const [usualMealHintDismissed, setUsualMealHintDismissed] = useState<Set<string>>(
    () => new Set<string>(),
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(USUAL_MEAL_HINT_STORAGE_KEY);
      setUsualMealHintDismissed(parseDismissedSlots(raw));
    } catch {
      /* storage access can throw in private modes — ignore */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === USUAL_MEAL_HINT_STORAGE_KEY) {
        setUsualMealHintDismissed(parseDismissedSlots(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
      return shouldShowUsualMealHint({
        byDay: nutritionByDay,
        slot,
        todayKey: selectedDateKey,
        dismissedSlots: usualMealHintDismissed,
        savedMealSlots,
      });
    },
    [nutritionByDay, selectedDateKey, usualMealHintDismissed, savedMealSlots],
  );
  // Fire `usual_meal_hint_shown` once per (slot) per mount when it first
  // passes the gate. `useEffect` runs after render so the impression
  // matches what the user actually saw.
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
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              USUAL_MEAL_HINT_STORAGE_KEY,
              serializeDismissedSlots(next),
            );
          } catch {
            /* ignore storage failures */
          }
        }
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

  /** Open the save-combo dialog with pre-filled `seedItems` + optional
   * default `slot`. Wired to both the meal-slot header chip (directly)
   * and to the `QuickAddPanel` via the `onOpenSaveCombo` prop so the
   * panel can request the dialog without touching the global event bus. */
  const handleOpenSaveCombo = useCallback(
    (
      slot?: string,
      seedItems?: Array<Omit<SavedMealItem, "id" | "position">>,
    ) => {
      if (!authedUserId) {
        toast.info("Sign in to save a usual meal.");
        return;
      }
      const items = seedItems ?? [];
      if (items.length < 2) {
        toast.info("Log 2 or more items first, then save as a usual meal.");
        return;
      }
      setSaveComboSeedItems(items);
      // Canonical slot via shared guard (audit L5, 2026-04-18).
      const normalisedSlot: MealSlot | undefined = isMealSlot(slot) ? slot : undefined;
      setSaveComboDefaultSlot(normalisedSlot);
      setSaveComboSuggestedName(
        slot ? `My usual ${slot.toLowerCase()}` : `My usual ${mealSlot.toLowerCase()}`,
      );
      setSaveComboOpen(true);
    },
    [authedUserId, mealSlot],
  );

  /**
   * Post-ship #4 (2026-04-18) — consume the "save your usual" deep-link
   * the weekly-recap card stashed in sessionStorage. Fires once per
   * auth-session arrival on Today. Pops the stored payload, validates
   * the TTL inside `parsePendingUsualMealSave`, then opens
   * `SaveMealDialog` pre-seeded with the slot and items the helper
   * picked on Progress.
   *
   * The clear-unconditionally rule means a stale or malformed blob is
   * always cleared — we never want an old payload to re-fire on the
   * next mount.
   */
  const pendingUsualMealConsumedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!authedUserId) return;
    if (pendingUsualMealConsumedRef.current === authedUserId) return;
    if (typeof window === "undefined") return;
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(PENDING_USUAL_MEAL_SAVE_KEY);
    } catch {
      return;
    }
    pendingUsualMealConsumedRef.current = authedUserId;
    if (!raw) return;
    try {
      window.sessionStorage.removeItem(PENDING_USUAL_MEAL_SAVE_KEY);
    } catch {
      /* ignore — worst case the blob fires once then TTL-expires. */
    }
    const pending = parsePendingUsualMealSave(raw);
    if (!pending) return;
    handleOpenSaveCombo(pending.slot, pending.items);
  }, [authedUserId, handleOpenSaveCombo]);

  /** Gather the items in `slotName` from the active day and open the
   * save-as-usual-meal dialog. Called from the per-slot full-width save
   * row and from the first-run hint's "Save as usual" CTA (Ship M1). */
  const openSaveMealDialog = useCallback(
    (slotName: string) => {
      const slotMeals = mealsForSelectedDate.filter(
        (m) => normalizeJournalSlotName(m.name ?? "") === slotName,
      );
      if (slotMeals.length < 2) {
        toast.info("Log 2 or more items first, then save as a usual meal.");
        return;
      }
      const items: Array<Omit<SavedMealItem, "id" | "position">> = slotMeals.map((m) => {
        const pm = m.portionMultiplier ?? 1;
        const item: Omit<SavedMealItem, "id" | "position"> = {
          recipeTitle: m.recipeTitle,
          calories: scaledMacro(m.calories, pm),
          protein: scaledMacro(m.protein, pm),
          carbs: scaledMacro(m.carbs, pm),
          fat: scaledMacro(m.fat, pm),
          portionMultiplier: 1, // snapshot macros are already scaled
        };
        if (m.fiberG != null) item.fiber = m.fiberG;
        if (m.waterMl != null) item.waterMl = m.waterMl;
        if (m.source) item.source = m.source;
        if (m.micros && Object.keys(m.micros).length > 0) {
          const scaled = scaleMicrosPerServing(m.micros, pm);
          if (Object.keys(scaled).length > 0) item.nutritionMicros = scaled;
        }
        return item;
      });
      handleOpenSaveCombo(slotName, items);
    },
    [handleOpenSaveCombo, mealsForSelectedDate],
  );

  /** Ship M1 — the first-run hint's "Save as usual" CTA. Fires the
   * accepted-analytics event then opens the save-usual-meal dialog
   * pre-seeded with the current slot's items. */
  const acceptUsualMealHint = useCallback(
    (slot: string) => {
      try {
        track(AnalyticsEvents.usual_meal_hint_accepted, { slot });
      } catch {
        /* analytics fire-and-forget */
      }
      openSaveMealDialog(slot);
    },
    [openSaveMealDialog],
  );

  /** Ship M1 — slot-header "Log usual" pill handler. Logs the saved meal
   * into `slot` via the shared `logSavedMeal` helper, then optimistically
   * reorders `hostSavedMeals` so the re-logged one bubbles to the top
   * (matches the Quick Add panel's post-log ordering). */
  const logSavedMealFromSlotHeader = useCallback(
    (meal: SavedMeal, slot: string) => {
      logSavedMeal(meal, slot);
      try {
        track(AnalyticsEvents.usual_meal_log_tapped, {
          slot,
          itemCount: meal.items.length,
        });
      } catch {
        /* analytics fire-and-forget */
      }
      try {
        track(AnalyticsEvents.saved_meal_logged, {
          itemCount: meal.items.length,
          defaultMealSlot: meal.defaultMealSlot,
          // L6 G3 (2026-04-18) — join key for the create→logged funnel.
          savedMealId: meal.id,
        });
      } catch {
        /* analytics fire-and-forget */
      }
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
      if (authedUserId) {
        void incrementLogCount(supabase, authedUserId, meal.id).catch((err) => {
           
          console.warn("NutritionTracker slot-header usual-meal log bump failed", err);
        });
      }
      // Bump the refresh token so `QuickAddPanel` rereads its own list —
      // this keeps the Usual meals tab in sync after a slot-header log.
      setSavedMealsRefreshToken((n) => n + 1);
    },
    [authedUserId, logSavedMeal],
  );

  /** Persist a new saved-meal combo from the lifted `SaveMealDialog`,
   * then bump `savedMealsRefreshToken` so `QuickAddPanel` refetches its
   * "My meals" tab and jumps to it (preserves Batch 2.6 post-save UX). */
  const handleCreateSavedMeal = useCallback(
    async (payload: {
      name: string;
      defaultMealSlot?: "Breakfast" | "Lunch" | "Dinner" | "Snacks";
      items: Array<Omit<SavedMealItem, "id" | "position">>;
    }) => {
      if (!authedUserId) return;
      try {
        const created = await createSavedMeal(supabase, authedUserId, payload);
        try {
          track(AnalyticsEvents.saved_meal_created, {
            itemCount: payload.items.length,
            defaultMealSlot: payload.defaultMealSlot,
            // L6 G3 (2026-04-18) — carry the new combo's id so the
            // create → later-logged funnel (F3 habit loop) can join
            // on a single stable key.
            savedMealId: created.id,
          });
        } catch {
          /* analytics is fire-and-forget */
        }
        toast.success(`Saved "${payload.name}".`);
        setSavedMealsRefreshToken((n) => n + 1);
      } catch (err) {
        toast.error("Couldn't save that meal. Try again.");
         
        console.error("NutritionTracker saved-meal create failed", err);
      }
    },
    [authedUserId],
  );

  useEffect(() => {
    const id = setInterval(() => setFastingNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!authedUserId) return;
    supabase
      .from("profiles")
      .select(
        "weight_kg, weight_kg_by_day, goal, plan_pace, sex, age, height_cm, activity_level, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, measured_tdee, measured_tdee_confidence, measured_tdee_updated_at, meal_slot_config, week_start_day, steps_by_day, daily_steps_goal, fasting_sessions, fasting_window, tracked_macros, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history, last_weekly_checkin_shown_at",
      )
      .eq("id", authedUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const wsd = (data as { week_start_day?: string }).week_start_day;
        if (wsd === "sunday" || wsd === "monday") setWeekStartDay(wsd);

        // Batch 4.11 — freeze ledger loads alongside other profile bits.
        const rawEarned = (data as { streak_freezes_earned_at?: unknown })
          .streak_freezes_earned_at;
        const rawUsed = (data as { streak_freezes_used_history?: unknown })
          .streak_freezes_used_history;
        setFreezeLedger(
          readFreezeLedger({ earnedAt: rawEarned, usedHistory: rawUsed }),
        );
        const rawBudget = Number(
          (data as { streak_freeze_budget_max?: number }).streak_freeze_budget_max,
        );
        setFreezeBudgetMax(
          Number.isFinite(rawBudget) ? Math.max(0, Math.min(10, rawBudget)) : 3,
        );
        setTrackedDashboardMacros(
          normalizeTrackedDashboardMacros((data as { tracked_macros?: unknown }).tracked_macros),
        );
        setUserMealSlotConfig(
          parseUserMealSlotConfig((data as { meal_slot_config?: unknown }).meal_slot_config),
        );
        setStepsByDay(parseStepsDayMap((data as { steps_by_day?: unknown }).steps_by_day));
        const sg = (data as { daily_steps_goal?: number }).daily_steps_goal;
        const sgN = sg != null ? Number(sg) : DEFAULT_STEPS_GOAL;
        setDailyStepsGoal(Number.isFinite(sgN) && sgN > 0 ? Math.round(sgN) : DEFAULT_STEPS_GOAL);
        const fs = (data as { fasting_sessions?: unknown }).fasting_sessions;
        if (Array.isArray(fs)) {
          setFastingSessions(fs as FastingSessionRow[]);
        }
        // F-109: hydrate the IF opt-in flag from `profiles.fasting_window`.
        // Non-null = user picked a window (onboarding or /fasting preset
        // chip) → idle "Start fast" pill renders on Today.
        const fwRaw = (data as { fasting_window?: unknown }).fasting_window;
        setFastingOptedIn(typeof fwRaw === "string" && fwRaw.length > 0);
        const w = data.weight_kg != null ? Number(data.weight_kg) : null;
        setProfileWeightKg(Number.isFinite(w) ? w : null);
        setProfileGoal((data as any).goal ?? null);
        setProfilePlanPace(
          typeof (data as any).plan_pace === "string" ? (data as any).plan_pace : null,
        );
        // Cache basics for the activity-bonus info popover (TestFlight
        // `AAtW7dYcCBPyBdsMU6UqiQQ`, 2026-04-18).
        const sexRaw = (data.sex ?? null) as string | null;
        setProfileSex(
          sexRaw === "male" || sexRaw === "female" || sexRaw === "unspecified" ? sexRaw : null,
        );
        const hCmRaw = data.height_cm != null ? Number(data.height_cm) : null;
        setProfileHeightCm(Number.isFinite(hCmRaw) && hCmRaw && hCmRaw > 0 ? hCmRaw : null);
        const ageRaw = data.age != null ? Number(data.age) : null;
        setProfileAge(Number.isFinite(ageRaw) && ageRaw && ageRaw > 0 ? ageRaw : null);
        const actRaw = (data.activity_level ?? null) as string | null;
        if (
          actRaw === "sedentary" ||
          actRaw === "light" ||
          actRaw === "moderate" ||
          actRaw === "active" ||
          actRaw === "very_active"
        ) {
          setProfileActivityLevel(actRaw);
        } else {
          setProfileActivityLevel(null);
        }
        // F-3 (2026-04-19, TestFlight `ADFYpDgEEb0QH-j3BXshPTo`):
        // single source of truth for the Activity Bonus Maintenance
        // tile + the Progress "Maintenance" card. Previously Today
        // used raw adaptive with no confidence gate while Progress
        // used `getEffectiveTDEE`'s gate — two surfaces, two numbers.
        // `resolveMaintenance` is the shared gate: adaptive wins at
        // medium/high confidence AND not stale, else formula.
        const resolved = resolveMaintenance(
          {
            adaptive_tdee: (data as any).adaptive_tdee,
            adaptive_tdee_confidence: (data as any).adaptive_tdee_confidence,
            adaptive_tdee_updated_at: (data as any).adaptive_tdee_updated_at,
            measured_tdee: (data as any).measured_tdee,
            measured_tdee_confidence: (data as any).measured_tdee_confidence,
            measured_tdee_updated_at: (data as any).measured_tdee_updated_at,
            sex: (data.sex ?? "unspecified") as any,
            weight_kg: Number(data.weight_kg),
            height_cm: Number(data.height_cm),
            age: Number(data.age),
            activity_level: (data.activity_level ?? "sedentary") as any,
          },
          { enableMeasured: isFeatureEnabled(MEASURED_TDEE_CHECK_IN_FLAG) },
        );
        if (resolved) {
          setProfileMaintenanceTdee(resolved.kcal);
          setProfileMaintenanceSource(resolved.source);
          setProfileMaintenanceConfidence(resolved.confidence);
          // Capture the Mifflin formula baseline so the weekly check-in
          // ritual can compute the adaptive-vs-formula delta even when
          // the resolver landed on adaptive (in which case
          // `resolved.kcal` is the adaptive value and `formulaKcal` is
          // the prior baseline).
          setProfileFormulaTdee(resolved.formulaKcal ?? null);
        }
        // Raw adaptive TDEE + confidence — the weekly check-in gate
        // wants these specifically (resolver-collapsed maintenance
        // doesn't tell us whether adaptive_tdee itself is medium/high).
        const aTdeeRaw = (data as { adaptive_tdee?: unknown }).adaptive_tdee;
        const aTdeeNum =
          typeof aTdeeRaw === "number"
            ? aTdeeRaw
            : aTdeeRaw == null
              ? null
              : Number(aTdeeRaw);
        setProfileAdaptiveTdeeRaw(
          aTdeeNum != null && Number.isFinite(aTdeeNum) ? aTdeeNum : null,
        );
        const aConfRaw = (data as { adaptive_tdee_confidence?: unknown })
          .adaptive_tdee_confidence;
        setProfileAdaptiveTdeeConfidenceRaw(
          aConfRaw === "low" || aConfRaw === "medium" || aConfRaw === "high"
            ? aConfRaw
            : null,
        );
        // Weekly check-in shown-at hydration. Drives the 6-day cooldown.
        const lastCheckin = (data as { last_weekly_checkin_shown_at?: unknown })
          .last_weekly_checkin_shown_at;
        setWeeklyCheckinShownAt(typeof lastCheckin === "string" ? lastCheckin : null);
        const wkbdRaw = (data as { weight_kg_by_day?: unknown }).weight_kg_by_day;
        if (wkbdRaw && typeof wkbdRaw === "object" && !Array.isArray(wkbdRaw)) {
          const out: Record<string, number> = {};
          for (const [k, v] of Object.entries(wkbdRaw as Record<string, unknown>)) {
            const n = typeof v === "number" ? v : Number(v);
            if (Number.isFinite(n) && n > 0) out[k] = n;
          }
          setProfileWeightKgByDay(out);
        }
      });
  }, [authedUserId]);

  const refreshTrackedDashboardMacros = useCallback(async () => {
    if (!authedUserId) return;
    const { data } = await supabase.from("profiles").select("tracked_macros").eq("id", authedUserId).maybeSingle();
    if (data) {
      setTrackedDashboardMacros(normalizeTrackedDashboardMacros((data as { tracked_macros?: unknown }).tracked_macros));
    }
  }, [authedUserId]);

  useEffect(() => {
    const onVis = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      void refreshTrackedDashboardMacros();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshTrackedDashboardMacros]);

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    sync();
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  /**
   * ENG-977 — latest-value snapshot for the calm post-log "what to eat
   * next" micro-moment. `commitAiLoggedItems` is declared above the day
   * totals / targets / library consts (TDZ), so we read them through a
   * ref kept fresh by the effect below rather than threading them into
   * the callback's dep array. The ref always holds the most recent
   * pre-commit snapshot; the commit adds the new items on top to derive
   * remaining-after-log.
   */
  const postLogNudgeCtxRef = useRef<{
    library: NorthStarRecipe[];
    calorieTarget: number;
    macroTargets: { protein: number; carbs: number; fat: number };
    totals: { calories: number; protein: number; carbs: number; fat: number };
    userCreatedAt: string | null;
  } | null>(null);

  const commitAiLoggedItems = useCallback(
    (items: AiLoggedItem[]) => {
      if (items.length === 0) return;
      for (const item of items) {
        // Audit L6 G1 (2026-04-18) — `food_logged.source` mirrors the
        // AI origin (voice vs photo) so the funnel F2 / AI-Pro
        // dashboard slices correctly.
        const analyticsSource: FoodLoggedSource =
          item.source === "voice" ? "voice" : "photo";
        // F-74 / F-103 (2026-05-07): forward optional caffeine /
        // alcohol from the AI item to the meal's `micros` map.
        // Per-meal `micros` is the canonical SoT for food-derived
        // stimulants — `caffeineFromMealsMgToday` /
        // `alcoholByDayMerged` re-sum it at render. Project rule:
        // only forward what the pipeline actually provided.
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
        // ENG-751 — persist the AI per-item breakdown into the snapshot child
        // table. ADDITIVE + DEFENSIVE: `persistEntryIngredientSnapshot` never
        // throws (table-missing pre-push, RLS, network all swallow) and only
        // runs once `addLoggedMeal` reports the parent `nutrition_entries`
        // insert RESOLVED — so the FK target exists (no `setTimeout(0)` race)
        // and it can never break the meal log. Mirrors mobile's
        // `persistMealsImmediate().then(...)` ordering. Write path is always-on;
        // only the macro-detail DISPLAY is flag-gated.
        addLoggedMeal(
          {
            name: mealSlot,
            recipeTitle: item.name,
            time: mealSlot,
            calories: Math.round(item.calories),
            protein: Math.round(item.protein),
            carbs: Math.round(item.carbs),
            fat: Math.round(item.fat),
            source: aiLoggingSourceLabel(item.source),
            ...(Object.keys(micros).length > 0 ? { micros } : {}),
          },
          analyticsSource,
          (persisted, persistedEntryId) => {
            if (!persisted) return;
            void persistEntryIngredientSnapshot(
              supabase,
              persistedEntryId,
              [item],
              aiLoggingSourceLabel(item.source),
            );
          },
        );
      }
      const label = items[0]?.source === "voice" ? "voice" : "photo";

      // ENG-977 — calm post-log "what to eat next" micro-moment. The
      // commit just changed the remaining budget; bridge log → suggestion
      // (the coaching layer Cal AI lacks). When the moment fires it
      // replaces the plain count confirmation with one quiet line; when
      // there's no room left (at/over budget) it returns null and we keep
      // the count toast. Gated behind `post_log_what_next_v1`.
      const ctx = postLogNudgeCtxRef.current;
      if (isFeatureEnabled("post_log_what_next_v1") && ctx) {
        const added = items.reduce(
          (acc, it) => ({
            calories: acc.calories + Math.round(it.calories),
            protein: acc.protein + Math.round(it.protein),
            carbs: acc.carbs + Math.round(it.carbs),
            fat: acc.fat + Math.round(it.fat),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 },
        );
        const nudge = buildPostLogSuggestion({
          library: ctx.library,
          remaining: {
            calories: ctx.calorieTarget - (ctx.totals.calories + added.calories),
            protein: ctx.macroTargets.protein - (ctx.totals.protein + added.protein),
            carbs: ctx.macroTargets.carbs - (ctx.totals.carbs + added.carbs),
            fat: ctx.macroTargets.fat - (ctx.totals.fat + added.fat),
          },
          dailyCalorieTarget: ctx.calorieTarget,
          source: label,
          userCreatedAt: ctx.userCreatedAt,
        });
        if (nudge) {
          toast.success(nudge.line);
          try {
            track(AnalyticsEvents.post_log_suggestion_shown, {
              source: nudge.source,
              hasSuggestion: nudge.hasSuggestion,
              slot: nudge.slot ?? "none",
              platform: "web",
            });
          } catch {
            /* analytics noop */
          }
          return;
        }
      }

      toast.success(`Logged ${items.length} item${items.length === 1 ? "" : "s"} from ${label}`);
    },
    [addLoggedMeal, mealSlot],
  );

  /**
   * Canonical food-search selection commit. Used by both the
   * `<FoodSearch>` dialog and the inline `<FoodSearchPanel>` mounted
   * inside `<LogSheet>`. Both surfaces produce the exact same
   * `FoodSearchSelection` payload so the journal row, source label,
   * caffeine/alcohol auto-track, and OFF micro persistence stay
   * byte-for-byte identical regardless of entry point. Mirrors the
   * mobile Today FoodSearchModal commit flow byte-for-byte.
   */
  const commitFoodSearchSelection = useCallback(
    (selection: FoodSearchSelection): { id: string; title: string; kcal: number } => {
      const sourceLabel = foodSelectionSourceLabel(selection.source);

      // ENG-1046 — shared scaling core (instant-log + basket-add, mobile parity).
      const {
        calories: mealCalories,
        protein: mealProtein,
        carbs: mealCarbs,
        fat: mealFat,
        fiberG: mealFiberG,
        micros,
      } = foodSelectionToMealMacros(selection);

      const id = addLoggedMealForDate(
        selectedDateKey,
        {
          name: mealSlot,
          recipeTitle: selection.name,
          time: timeLabel,
          calories: mealCalories,
          protein: mealProtein,
          carbs: mealCarbs,
          fat: mealFat,
          source: sourceLabel,
          ...(mealFiberG > 0 ? { fiberG: mealFiberG } : {}),
          ...(Object.keys(micros).length > 0 ? { micros } : {}),
          ...mealImageFields(selection.imageUrl),
          ...(selection.eatenAt
            ? { eatenAt: selection.eatenAt }
            : eatenAtForCurrentLog()),
        },
        foodSelectionAnalyticsSource(selection.source),
      );
      return { id, title: selection.name, kcal: mealCalories };
    },
    [addLoggedMealForDate, mealSlot, timeLabel, eatenAtForCurrentLog, selectedDateKey],
  );

  const presentLogSheetConfirmation = useCallback(
    (payload: { title: string; kcal: number; mealIds: string[] }) => {
      setLogSheetConfirmation({
        title: payload.title,
        kcal: Math.round(payload.kcal),
        slot: mealSlot,
        onDone: () => {
          setLogSheetConfirmation(null);
          setLogSheetOpen(false);
        },
        onUndo: () => {
          for (const mealId of payload.mealIds) removeLoggedMeal(mealId);
          setLogSheetConfirmation(null);
        },
      });
    },
    [mealSlot, removeLoggedMeal],
  );

  const logHistoryItemFromSheet = useCallback(
    (item: FoodHistoryItem, slot: string) => {
      const micros: Record<string, number> = item.micros ? { ...item.micros } : {};
      if (item.caffeineMg != null && item.caffeineMg > 0) micros.caffeineMg = item.caffeineMg;
      if (item.alcoholG != null && item.alcoholG > 0) micros.alcoholG = item.alcoholG;
      const id = addLoggedMealForDate(
        selectedDateKey,
        {
          name: slot,
          recipeTitle: item.recipeTitle,
          time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          ...(item.fiber != null ? { fiberG: item.fiber } : {}),
          ...(item.source ? { source: item.source } : {}),
          ...(Object.keys(micros).length > 0 ? { micros } : {}),
        },
        "quick_add",
      );
      presentLogSheetConfirmation({
        title: item.recipeTitle,
        kcal: item.calories,
        mealIds: [id],
      });
    },
    [addLoggedMealForDate, presentLogSheetConfirmation, selectedDateKey],
  );

  const logSheetGoTos = useMemo(() => {
    const slot = normaliseMealSlot(mealSlot);
    if (!slot) return [];
    return computeSlotGoToFoods(nutritionByDay, slot).map((item) => ({
      id: foodHistoryKey(item.recipeTitle, item.calories),
      title: item.recipeTitle,
      kcal: Math.round(item.calories),
      source: mapMealSourceToDot(item.source),
      count: item.count,
    }));
  }, [nutritionByDay, mealSlot]);

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
      const result = commitFoodSearchSelection(selection);
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
  }, [logBasket, commitFoodSearchSelection, presentLogSheetConfirmation]);

  const recipeOptions = useMemo((): RecipeCard[] => {
    return savedRecipesForLibrary.map((r) => ({ ...r, isSaved: true }));
  }, [savedRecipesForLibrary]);

  useEffect(() => {
    if (!recipeOptions.length) return;
    if (!recipeId || !recipeOptions.some((r) => r.id === recipeId)) {
      setRecipeId(recipeOptions[0]!.id);
    }
  }, [recipeOptions, recipeId]);

  const selectedDate = useMemo(() => parseDateKey(selectedDateKey), [selectedDateKey]);

  const navigateDay = useCallback((offset: number) => {
    setSelectedDateKey((prev) => clampDateKey(shiftDateKey(prev, offset)));
  }, [setSelectedDateKey]);

  const navigateWeek = useCallback((offset: number) => {
    setSelectedDateKey((prev) => clampDateKey(shiftDateKey(prev, offset * 7)));
  }, [setSelectedDateKey]);

  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(new Set());
  const toggleSlot = (name: string) =>
    setCollapsedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const weekSummaryMode = normalizeWeekSummaryMode(notificationPrefs.weekSummaryMode);
  const trackerWeekSummaryKeys = useMemo(
    () => weekSummaryDateKeys(weekSummaryMode, selectedDate, weekStartDay),
    [weekSummaryMode, selectedDate, weekStartDay],
  );

  const totals = (() => {
    const raw = mealsForSelectedDate.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.protein,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fat,
        fiber: acc.fiber + mealContributedFiberG(meal),
        waterMl: acc.waterMl + (meal.waterMl ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, waterMl: 0 },
    );
    return {
      calories: Math.round(raw.calories),
      protein: Math.round(raw.protein),
      carbs: Math.round(raw.carbs),
      fat: Math.round(raw.fat),
      fiber: Math.round(raw.fiber),
      waterMl: Math.round(raw.waterMl),
    };
  })();

  /** Day-summed nutrition_micros — shared by the FullNutrientPanelSheet
   *  ("View all nutrients" link in TodayDashboardMacroTiles) and any
   *  legacy nutrient-row consumers. One source of truth so every
   *  surface agrees. */
  const dayMicroSum = useMemo(
    () => sumMicrosFromLoggedMeals(mealsForSelectedDate),
    [mealsForSelectedDate],
  );

  const dayNutrientDetailRows = useMemo(() => {
    const microSum = sumMicrosFromLoggedMeals(mealsForSelectedDate);
    return buildDayNutrientDetailRows(totals.fiber, microSum);
  }, [mealsForSelectedDate, totals.fiber]);

  const dayMicroSumForTracker = useMemo(() => {
    let sugarG = 0;
    let sodiumMg = 0;
    for (const m of mealsForSelectedDate) {
      const micros = m.micros;
      if (!micros) continue;
      const sg = micros.sugarG;
      const na = micros.sodiumMg;
      if (typeof sg === "number" && Number.isFinite(sg)) sugarG += sg;
      if (typeof na === "number" && Number.isFinite(na)) sodiumMg += na;
    }
    return { sugarG, sodiumMg };
  }, [mealsForSelectedDate]);

  const mealsGrouped = useMemo(() => {
    const map = new Map<string, typeof mealsForSelectedDate>();
    for (const m of mealsForSelectedDate) {
      const k = normalizeJournalSlotName(m.name?.trim() || "Other") || "Other";
      const arr = map.get(k);
      if (arr) arr.push(m);
      else map.set(k, [m]);
    }
    const keys = [...map.keys()].sort((a, b) => {
      const ia = mealSectionOrder.indexOf(a);
      const ib = mealSectionOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return keys.map((name) => ({
      name,
      meals: [...map.get(name)!].sort(compareMealsByChronology),
    }));
  }, [mealsForSelectedDate, mealSectionOrder]);

  // ENG-786 — "Log this/these again". Re-inserts the viewed day's
  // current entries for `slot` as fresh entries on the same day,
  // preserving each entry's baked macros (kcal/P/C/F + fibre + micros
  // + portionMultiplier) and data provenance (`source`). Uses the same
  // per-entry `addLoggedMealForDate` insert path as `logSavedMeal`, so
  // each re-logged row persists identically (and never re-scales) and
  // emits one `food_logged { source: "log_again" }`. Placed after the
  // `mealsGrouped` memo it reads (TDZ). Flag-gated at the section
  // invocation via `today_log_again`. Mirror of mobile `logAgainSlot`
  // in `apps/mobile/app/(tabs)/index.tsx`.
  const logAgainSlot = useCallback(
    (slot: string) => {
      const source = mealsGrouped.find((g) => g.name === slot)?.meals ?? [];
      if (source.length === 0) return;
      const timeLabel = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      for (const m of source) {
        const { id: _id, ...rest } = m;
        void _id;
        addLoggedMealForDate(selectedDateKey, { ...rest, time: timeLabel }, "log_again");
      }
      toast.success(
        source.length > 1 ? `Re-logged ${source.length} items to ${slot}.` : `Re-logged to ${slot}.`,
      );
    },
    [mealsGrouped, addLoggedMealForDate, selectedDateKey],
  );

  const targets = normalizeMacroTargets(nutritionTargets);
  // ENG-960 — apply the opt-in day-target schedule for the DISPLAYED weekday
  // (`selectedDate`, so navigating to a past/future day shows that day's target).
  // Weekly-neutral: the schedule never changes the 7-day total. When the user
  // hasn't opted in (`dayTargetSchedule === null`) this is a pure identity.
  const scheduledDayTargets = resolveEffectiveDayTargets(
    {
      calories: targets.calories,
      proteinG: targets.protein,
      carbsG: targets.carbs,
      fatG: targets.fat,
      fiberG: targets.fiber ?? null,
    },
    dayTargetSchedule,
    selectedDate.getDay() as WeekdayIndex,
  );
  const baseCalorieTarget = scheduledDayTargets.calories;

  const weekData = useMemo(() => {
    const d = new Date(selectedDate);
    const dow = d.getDay();
    const startOffset = weekStartDay === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
    const weekFirst = new Date(d);
    weekFirst.setDate(d.getDate() + startOffset);

    const dayLabels =
      weekStartDay === "monday"
        ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const days: {
      key: string;
      short: string;
      date: Date;
      totals: { calories: number; protein: number; carbs: number; fat: number };
      waterMl: number;
      steps: number | null;
    }[] = [];

    for (let i = 0; i < 7; i++) {
      const dd = new Date(weekFirst);
      dd.setDate(weekFirst.getDate() + i);
      const dk = dateKeyFromDate(dd);
      const meals = nutritionByDay[dk] ?? [];
      const totals = meals.reduce(
        (acc, m) => ({
          calories: acc.calories + Math.max(0, m.calories),
          protein: acc.protein + Math.max(0, m.protein),
          carbs: acc.carbs + Math.max(0, m.carbs),
          fat: acc.fat + Math.max(0, m.fat),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      const mealWater = meals.reduce((s, m) => s + Math.max(0, m.waterMl ?? 0), 0);
      const waterMl = Math.round(mealWater + (extraWaterByDay[dk] ?? 0));
      const stepsLogged = Object.prototype.hasOwnProperty.call(stepsByDay, dk);
      const steps = stepsLogged ? (stepsByDay[dk] ?? 0) : null;
      days.push({ key: dk, short: dayLabels[i]!, date: dd, totals, waterMl, steps });
    }

    const weekTotals = days.reduce(
      (acc, x) => ({
        calories: acc.calories + x.totals.calories,
        protein: acc.protein + x.totals.protein,
        carbs: acc.carbs + x.totals.carbs,
        fat: acc.fat + x.totals.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    const daysWithFood = Math.max(1, days.filter((x) => x.totals.calories > 0).length);
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

    const loggedDaysInWeek = days.filter((x) => x.totals.calories > 0).length;
    return {
      days,
      weekTotals,
      weekAvg,
      daysWithFood,
      loggedDaysInWeek,
      label: `${weekStartLabel} – ${weekEndLabel}`,
    };
  }, [selectedDate, nutritionByDay, weekStartDay, extraWaterByDay, stepsByDay]);

  // Weekly check-in ritual gate (PR claude/weekly-checkin-ritual-v2,
  // 2026-05-02 — rebuild of #26). Mirrors mobile gating + content build.
  // Runs once per Today first-load. `weeklyCheckinHandledRef` suppresses
  // re-fires within the session even if `weekData` recomputes.
  useEffect(() => {
    if (selectedDateKey !== todayKey()) return;
    if (weeklyCheckinHandledRef.current) return;
    if (!authedUserId) return;
    const eligible = shouldShowWeeklyCheckin({
      adaptiveTdeeConfidence: profileMaintenanceConfidence,
      adaptiveTdee: profileMaintenanceTdee,
      daysLoggedThisWeek: weekData.loggedDaysInWeek,
      lastShownAt: weeklyCheckinShownAt,
    });
    if (!eligible) return;
    if (!Number.isFinite(targets.calories) || targets.calories <= 0) return;
    weeklyCheckinHandledRef.current = true;

    const content = buildWeeklyCheckinContent({
      adaptiveTdee: profileMaintenanceTdee as number,
      // `formulaKcal` is the prior baseline. Honest null when the
      // user's profile is incomplete — content builder suppresses
      // the delta line.
      priorTdee: profileFormulaTdee,
      currentTargetKcal: targets.calories,
      avgCaloriesThisWeek: weekData.weekAvg.calories,
      // Weight trend is intentionally suppressed here: the check-in is
      // maintenance-target guidance, while weight narrative lives in Progress.
      weightDeltaKg: null,
      // ENG-1027 — sex-aware suggested-target floor (never suggest a man
      // below 1,500 / a woman below 1,200).
      sex: profileSex,
    });
    setWeeklyCheckinContent(content);
    // ENG-805 — never cold-open; the in-feed banner opens the dialog on tap.

    const nowIso = new Date().toISOString();
    setWeeklyCheckinShownAt(nowIso);
    void supabase
      .from("profiles")
      .update({ last_weekly_checkin_shown_at: nowIso } as never)
      .eq("id", authedUserId);

    try {
      track(AnalyticsEvents.weekly_checkin_shown, {
        confidence: profileAdaptiveTdeeConfidenceRaw,
        tdeeDeltaKcal: content.tdeeDeltaKcal,
        daysLoggedThisWeek: weekData.loggedDaysInWeek,
        platform: "web",
      });
    } catch {
      /* noop */
    }
  }, [
    selectedDateKey,
    authedUserId,
    profileAdaptiveTdeeRaw,
    profileAdaptiveTdeeConfidenceRaw,
    profileFormulaTdee,
    profileSex,
    weekData,
    targets.calories,
    weeklyCheckinShownAt,
  ]);

  const handleWeeklyCheckinAccept = useCallback(() => {
    if (!authedUserId || !weeklyCheckinContent) {
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
        platform: "web",
      });
    } catch {
      /* noop */
    }
    // Optimistic local update so the rings reflect the new target
    // without waiting for the round-trip.
    setNutritionTargets((prev) => ({ ...prev, calories: newTarget }));
    void supabase
      .from("profiles")
      .update({
        target_calories: newTarget,
        target_calories_set_at: new Date().toISOString(),
        // Same enum value the maintenance-recalibration suggestion
        // already uses — keeps the existing 21-day Rule 2 cooldown
        // working correctly.
        target_calories_source: "digest_recalibration",
        last_weekly_checkin_decision: "accepted",
      } as never)
      .eq("id", authedUserId);
  }, [authedUserId, weeklyCheckinContent, targets.calories, setNutritionTargets]);

  const handleWeeklyCheckinDismiss = useCallback(() => {
    setWeeklyCheckinOpen(false);
    try {
      track(AnalyticsEvents.weekly_checkin_dismissed, {
        reason: "kept_current",
        platform: "web",
      });
    } catch {
      /* noop */
    }
    if (!authedUserId) return;
    void supabase
      .from("profiles")
      .update({ last_weekly_checkin_decision: "kept_current" } as never)
      .eq("id", authedUserId);
  }, [authedUserId]);

  const openWeeklyCheckinFromBanner = useCallback(() => {
    try {
      track(AnalyticsEvents.weekly_checkin_banner_tapped, {
        weekKey: checkinWeekKey,
        platform: "web",
      });
    } catch {
      /* noop */
    }
    if (weeklyCheckinContent) {
      setWeeklyCheckinOpen(true);
      return;
    }
    if (!Number.isFinite(targets.calories) || targets.calories <= 0) return;
    if (
      profileMaintenanceConfidence !== "medium" &&
      profileMaintenanceConfidence !== "high"
    ) {
      return;
    }
    if (profileMaintenanceTdee == null || profileMaintenanceTdee <= 0) return;
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: profileMaintenanceTdee as number,
      priorTdee: profileFormulaTdee,
      currentTargetKcal: targets.calories,
      avgCaloriesThisWeek: weekData.weekAvg.calories,
      weightDeltaKg: null,
      sex: profileSex,
    });
    setWeeklyCheckinContent(content);
    setWeeklyCheckinOpen(true);
  }, [
    checkinWeekKey,
    weeklyCheckinContent,
    targets.calories,
    profileAdaptiveTdeeConfidenceRaw,
    profileAdaptiveTdeeRaw,
    profileFormulaTdee,
    profileSex,
    weekData.weekAvg.calories,
  ]);

  const dismissCheckinBannerWeb = useCallback(() => {
    if (!authedUserId) return;
    setCheckinBannerDismissed(true);
    try {
      track(AnalyticsEvents.weekly_checkin_banner_dismissed, {
        weekKey: checkinWeekKey,
        platform: "web",
      });
    } catch {
      /* noop */
    }
    markCheckinBannerDismissed(authedUserId, checkinWeekKey);
  }, [authedUserId, checkinWeekKey]);

  const maintenanceForWeek = profileMaintenanceTdee ?? baseCalorieTarget;

  const weekEffectiveCalorieBudget = useMemo(() => {
    if (!preferActivityAdjustedCalories) return targets.calories * 7;
    return weekData.days.reduce(
      (sum, d) =>
        sum +
        targets.calories +
        dayActivityBudgetAddonWeb(
          preferActivityAdjustedCalories,
          d.key,
          maintenanceForWeek,
          activityBurnByDay,
          basalBurnByDay,
          workoutsByDay,
          profileMaintenanceSource,
        ),
      0,
    );
  }, [
    preferActivityAdjustedCalories,
    weekData.days,
    targets.calories,
    activityBurnByDay,
    basalBurnByDay,
    workoutsByDay,
    maintenanceForWeek,
  ]);

  // ENG-1225 #20 — weekly recap opened by the Today StreakPip.
  const weeklyRecapMeals = useMemo(
    () =>
      weekData.days.flatMap((d) =>
        (nutritionByDay[d.key] ?? []).map((m) => ({
          recipeTitle: m.recipeTitle,
          name: m.name,
        })),
      ),
    [nutritionByDay, weekData.days],
  );
  const weeklyRecap = useWeeklyRecap(weekData.days, weekData.label, targets.calories, {
    weightStartKg: null,
    weightEndKg: null,
    weighInsInWindow: 0,
    streakDays: protectedStreakLength,
    meals: weeklyRecapMeals,
    avgProteinG: weekData.weekAvg.protein,
    daysLogged: weekData.loggedDaysInWeek,
  });
  // Burn data for the selected day
  const dayWorkouts = workoutsByDay[selectedDateKey] ?? [];
  const basalBurnKcal = basalBurnByDay[selectedDateKey] ?? 0;
  const totalBurnKcal = activityBurnForSelectedDay + basalBurnKcal;

  // Activity adjustment — surplus-only "Activity Bonus" using the
  // shared `computeActivityBonusKcal` helper. See
  // `docs/decisions/2026-05-13-activity-bonus-projected-eod-model.md`
  // and `src/lib/nutrition/activityBonus.ts`.
  const activityAdjustment = computeActivityBonusKcal({
    prefer: preferActivityAdjustedCalories,
    maintenanceSource: profileMaintenanceSource,
    dateKey: selectedDateKey,
    todayDateKey: todayKey(),
    restingKcal: basalBurnKcal,
    activeKcal: activityBurnForSelectedDay,
    maintenanceKcal: profileMaintenanceTdee ?? baseCalorieTarget,
    workoutKcal: dayWorkouts.reduce((sum, w) => sum + (w.calories ?? 0), 0),
  });
  const effectiveCalorieTarget = baseCalorieTarget + activityAdjustment;

  const effectiveMacroTargets = useMemo(
    () =>
      scaleMacroTargetsForCalorieBudget(
        {
          // ENG-960 — schedule-adjusted day macros (protein passes through;
          // carbs/fat absorb the calorie delta) so the macro rings match the ring.
          protein: scheduledDayTargets.proteinG ?? targets.protein,
          carbs: scheduledDayTargets.carbsG ?? targets.carbs,
          fat: scheduledDayTargets.fatG ?? targets.fat,
        },
        { baseCalories: baseCalorieTarget, effectiveCalories: effectiveCalorieTarget },
      ),
    [
      baseCalorieTarget,
      effectiveCalorieTarget,
      scheduledDayTargets.proteinG,
      scheduledDayTargets.carbsG,
      scheduledDayTargets.fatG,
      targets.protein,
      targets.carbs,
      targets.fat,
    ],
  );

  // ENG-798 (Redesign — Design Direction 2026) — reserved Today win-moment.
  // Mirror of mobile `apps/mobile/app/(tabs)/index.tsx` (snapshot 2965-2997,
  // overlay 5382-5389). The shared `detectWinMoment` landmark math, the
  // once-per-calendar-day reservation, and the `redesign_winmoment` flag gate
  // all live inside `useWebWinMoment` — Today just feeds it a live snapshot,
  // renders the returned `<WinMomentPlayer>` overlay, and threads the `pulse`
  // boolean into the calorie ring stroke (the web colour/motion analog of
  // mobile's success haptic). Everything is inert when the flag is off, so the
  // pre-redesign static behaviour is preserved with no extra branch. Note the
  // web var is `effectiveCalorieTarget` (mobile's is `effectiveCalorieGoal`).
  const winSnapshot = useMemo(
    () => ({
      consumed: totals.calories,
      goal: effectiveCalorieTarget,
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
      effectiveCalorieTarget,
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
    pulse: winPulse,
  } = useWebWinMoment({
    snapshot: winSnapshot,
    dayKey: selectedDateKey,
    isToday: selectedDateKey === todayKey(),
    ready: winReady,
  });

  // ENG-977 — keep the post-log nudge snapshot fresh so the commit
  // callback (declared above these consts) can read live totals,
  // targets, and library without a TDZ in its dep array.
  useEffect(() => {
    postLogNudgeCtxRef.current = {
      library: savedRecipesForLibrary as NorthStarRecipe[],
      calorieTarget: effectiveCalorieTarget,
      macroTargets: {
        protein: effectiveMacroTargets.protein,
        carbs: effectiveMacroTargets.carbs,
        fat: effectiveMacroTargets.fat,
      },
      totals: {
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
      },
      userCreatedAt: authUserCreatedAt ?? null,
    };
  }, [
    savedRecipesForLibrary,
    effectiveCalorieTarget,
    effectiveMacroTargets.protein,
    effectiveMacroTargets.carbs,
    effectiveMacroTargets.fat,
    totals.calories,
    totals.protein,
    totals.carbs,
    totals.fat,
    authUserCreatedAt,
  ]);

  // ENG-1016 ring pulse + ENG-722 log-confirm checkmark (visual half; haptic
  // shipped 2026-04-28). BOTH fire on the meal-count rising edge — the single
  // durable-commit signal every web log path flows through (no per-call-site
  // scatter); each self-gates its flag + reduced-motion in its hook.
  const { pulse: commitPulse, trigger: triggerCommitPulse } = useCommitPulse();
  const { visible: logConfirmVisible, trigger: triggerLogConfirm } = useLogConfirmCheck();
  const prevMealCountRef = useRef<{ key: string; count: number } | null>(null);
  useEffect(() => {
    const count = mealsForSelectedDate.length;
    const prev = prevMealCountRef.current;
    prevMealCountRef.current = { key: selectedDateKey, count };
    // Rising edge, SAME day only — not day-switch (key+count both change) / removal.
    if (!winReady) return;
    if (!prev || prev.key !== selectedDateKey) return;
    if (count > prev.count) {
      triggerCommitPulse();
      triggerLogConfirm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trigger fns stable
  }, [mealsForSelectedDate.length, selectedDateKey, winReady]);

  // ENG-935: "What to eat next" is a PERMANENT glanceable Today block —
  // it renders for today regardless of remaining calories, including the
  // over-budget / on-target case. The previous `> 0` gate hid the block
  // at exactly the moments the user still needs guidance. The over-budget
  // case is handled gracefully inside `NorthStarBlockHost` (it renders the
  // calm `over-budget` caption when remainingCalories <= 0). Mirror of the
  // mobile `showAboveMealsNorthStar` gate.
  const showAboveMealsNorthStarWeb = selectedDateKey === todayKey();

  const belowMealsPromptEligibleWeb = useMemo(
    () => ({
      checkin:
        selectedDateKey === todayKey() &&
        isCheckinBannerDay &&
        checkinBannerDismissed === false,
      snap: selectedDateKey === todayKey() && mealsForSelectedDate.length === 0,
    }),
    [
      selectedDateKey,
      isCheckinBannerDay,
      checkinBannerDismissed,
      mealsForSelectedDate.length,
    ],
  );
  const showBelowMealsCheckinWeb = isBelowMealsPromptVisible(
    "checkin",
    belowMealsPromptEligibleWeb,
  );
  const showBelowMealsSnapWeb = isBelowMealsPromptVisible(
    "snap",
    belowMealsPromptEligibleWeb,
  );

  const totalWaterMl = totals.waterMl + extraWaterMlForSelectedDay;

  // Audit M4 (2026-04-18) — Today progressive disclosure gates.
  // Same rules as mobile via shared `todayProgressiveDisclosure` helpers.
  // Sticky once open: a returning user who has ever set a water target or
  // synced Health will keep seeing these cards.
  // F-74 (TestFlight `AN3mTmZK5T2Nhj13aMFLk2E`, 2026-04-25, mobile +
  // web parity): Hydration & Stimulants card now derives caffeine and
  // alcohol from logged foods (`nutrition_micros.caffeineMg` /
  // `alcoholG`) plus the manual quick-add ledger. Pre-F-74 the card
  // only read the quick-add ledger, so logging a coffee/wine in food
  // search left the card at 0/400 mg / 0/14 g.
  const caffeineFromMealsMgToday = useMemo(() => {
    const meals = nutritionByDay[selectedDateKey] ?? [];
    let sum = 0;
    for (const m of meals) {
      const n = Number((m as { micros?: { caffeineMg?: number } }).micros?.caffeineMg ?? 0);
      if (Number.isFinite(n) && n > 0) sum += n;
    }
    return Math.round(sum);
  }, [nutritionByDay, selectedDateKey]);
  const alcoholByDayMerged = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = { ...extraAlcoholGByDay };
    for (const [k, meals] of Object.entries(nutritionByDay)) {
      let dayMeals = 0;
      for (const m of meals ?? []) {
        const n = Number((m as { micros?: { alcoholG?: number } }).micros?.alcoholG ?? 0);
        if (Number.isFinite(n) && n > 0) dayMeals += n;
      }
      if (dayMeals > 0) {
        out[k] = (out[k] ?? 0) + Math.round(dayMeals * 10) / 10;
      }
    }
    return out;
  }, [nutritionByDay, extraAlcoholGByDay]);
  const hydrationCardGateOpen = useMemo(
    () =>
      isHydrationCardVisible({
        waterTargetMl: targets.waterMl,
        extraWaterByDay,
        waterFromMealsMl: Math.max(0, totalWaterMl - extraWaterMlForSelectedDay),
        // Phase 2 / B1.4 — caffeine/alcohol logs only contribute to
        // the gate when their respective opt-in toggle is on. When
        // the user has opted out, historical data is preserved but
        // does not surface the card.
        extraCaffeineByDay: trackingExtras.trackCaffeine ? _extraCaffeineByDay : {},
        extraAlcoholGByDay: trackingExtras.trackAlcohol ? alcoholByDayMerged : {},
      }),
    [targets.waterMl, extraWaterByDay, totalWaterMl, extraWaterMlForSelectedDay, _extraCaffeineByDay, alcoholByDayMerged, trackingExtras.trackCaffeine, trackingExtras.trackAlcohol],
  );
  const stepsCardGateOpen = useMemo(
    () => isStepsCardVisible({ stepsByDay, activityBurnByDay }),
    [stepsByDay, activityBurnByDay],
  );
  const showHydrationCard = hydrationCardGateOpen || hydrationManualExpanded;
  // Steps card is purely read-only on web; without a manual-entry
  // path there's no point in surfacing a "Connect health" expander
  // that would just open an empty input. Show only when the gate
  // says there's actual data to display.
  const showStepsCard = stepsCardGateOpen;

  const activeFast = useMemo(() => fastingSessions.find((s) => s.end === null), [fastingSessions]);
  const fastingElapsedLabel = useMemo(() => {
    if (!activeFast) return null;
    const elapsedH = Math.max(0, (fastingNowTick - new Date(activeFast.start).getTime()) / 3600_000);
    const h = Math.floor(elapsedH);
    const m = Math.floor((elapsedH - h) * 60);
    return `${h}h ${m}m`;
  }, [activeFast, fastingNowTick]);

  // Steps + activity are read-only on web (mobile parity, 2026-04-18).
  // Web has no Health source — `profiles.steps_by_day` is populated by
  // the iOS app's HealthKit sync. The previous manual-entry input +
  // Save button were removed because they let web overwrite synced
  // values and confused users about where the data was coming from.
  const stepsForSelectedDay = Object.prototype.hasOwnProperty.call(stepsByDay, selectedDateKey)
    ? (stepsByDay[selectedDateKey] ?? 0)
    : null;
  const hasBurnData = activityBurnForSelectedDay > 0 || basalBurnKcal > 0 || dayWorkouts.length > 0;

  const handleCopyYesterday = useCallback(() => {
    const yesterdayKey = previousDayKey(selectedDateKey);
    const count = (nutritionByDay[yesterdayKey] ?? []).length;
    if (count === 0) return;
    const label = count === 1 ? "1 meal" : `${count} meals`;
    if (!window.confirm(`Copy ${label} from yesterday to today? You can delete any you don't want.`)) return;
    void duplicateDay(yesterdayKey, selectedDateKey);
  }, [selectedDateKey, nutritionByDay, duplicateDay]);

  const handleAddMeal = () => {
    if (addMode === "manual") {
      const name = manualName.trim();
      if (!name) {
        return;
      }
      addLoggedMeal(
        {
          name: mealSlot,
          recipeTitle: name,
          time: timeLabel,
          calories: Math.max(0, Math.round(manualCalories)),
          protein: Math.max(0, Math.round(manualProtein)),
          carbs: Math.max(0, Math.round(manualCarbs)),
          fat: Math.max(0, Math.round(manualFat)),
          source: "Manual",
          ...(manualFiber > 0 ? { fiberG: Math.max(0, Math.round(manualFiber)) } : {}),
          ...(manualWater > 0 ? { waterMl: Math.max(0, Math.round(manualWater)) } : {}),
          ...eatenAtForCurrentLog(),
        },
        "manual",
      );
      setAddOpen(false);
      setManualName("");
      setManualCalories(0);
      setManualProtein(0);
      setManualCarbs(0);
      setManualFat(0);
      setManualFiber(0);
      setManualWater(0);
      return;
    }
    if (!recipeOptions.length) {
      return;
    }
    const recipe = recipeOptions.find((r) => r.id === recipeId);
    if (!recipe) {
      return;
    }
    const p = clampPortionMultiplier(recipePortionMultiplier);
    const fiberFromRecipe =
      recipe.fiberG != null && recipe.fiberG > 0 ? scaledMacro(recipe.fiberG, p) : null;
    addLoggedMeal(
      {
        name: mealSlot,
        recipeTitle: recipe.title,
        time: timeLabel,
        calories: scaledMacro(recipe.calories, p),
        protein: scaledMacro(recipe.protein, p),
        carbs: scaledMacro(recipe.carbs, p),
        fat: scaledMacro(recipe.fat, p),
        source: "Recipe",
        ...(fiberFromRecipe != null && fiberFromRecipe > 0 ? { fiberG: fiberFromRecipe } : {}),
        ...(p !== 1 ? { portionMultiplier: p } : {}),
        ...eatenAtForCurrentLog(),
      },
      "recipe",
    );
    setAddOpen(false);
    setRecipePortionMultiplier(1);
  };

  const avatarLetter = (profileDisplayName?.trim()?.[0] ?? authEmail?.trim()?.[0] ?? "U").toUpperCase();

  // v3 serif date hero (ENG-1247, 2026-06-24): the hero is the DATE (day name +
  // short date), not a time-of-day greeting — so no name/hour derivation.
  const isTodayHero = selectedDateKey === todayKey();
  const sloceHeroGreeting = isTodayHero
    ? {
        headline: todayDayName(selectedDate),
        subline: todayShortDate(selectedDate),
      }
    : todayPastDayGreetingLines(selectedDate);

  if (!nutritionJournalHydrated) {
    return <TodayLoadingSkeleton />;
  }

  return (
    <div className="product-shell py-pm-5 space-y-4 relative">
      {/* ENG-798 win-moment overlay — mirrors mobile index.tsx:5382-5389.
          Plays its Lottie once full-bleed over the Today surface, then fires
          `onWinComplete` to unmount. `pointer-events: none` (set inside
          WinMomentPlayer) keeps it from blocking taps. The flag gate +
          once-per-day reservation live in `useWebWinMoment`; this is a pure
          render of its output (only mounts while a celebration is active). */}
      {winCelebration ? (
        <WinMomentPlayer
          celebration={winCelebration}
          milestone={winMilestone ?? undefined}
          onComplete={onWinComplete}
          fullBleed
          testID="today-win-moment"
        />
      ) : null}

      {!isOnline ? (
        // SLOE (2026-06-07): offline is a neutral SYNC state, not a
        // warning — so this reads in the calm clay nav-tint, parity with
        // the mobile Today offline pill (`Accent.primary` + `colors.card`).
        // Previously this used the amber `warning` family, which read as
        // "something is wrong". Clay-soft border + neutral ink matches the
        // mobile treatment and the Sloe trust posture (amber is reserved
        // for genuine over-budget / caution signals).
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-card border border-primary/20 bg-primary/[0.06] px-4 py-3"
        >
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-primary-solid" aria-hidden />
          <p className="text-sm font-semibold text-foreground">
            {"You're offline. Changes will sync when you reconnect."}
          </p>
        </div>
      ) : null}

      <input
        ref={calendarInputRef}
        type="date"
        className="sr-only"
        aria-label="Select journal date"
        min={dateKeyFromDate(journalRangeBounds().min)}
        max={dateKeyFromDate(journalRangeBounds().max)}
        value={selectedDateKey}
        onChange={(e) => {
          const v = e.target.value;
          if (v) setSelectedDateKey(clampDateKey(v));
        }}
      />

      {/* Phase 2 / B1.2 (D-2026-04-27-07) — streak as a calm pip
          alongside the date row. Replaces the demoted streak ribbon
          (already removed from this surface 2026-04-20). On
          mobile-web the pip is right-aligned above the date header to
          mirror the mobile composition. Suppressed on week-view to
          keep the week toggle uncrowded. */}
      {/* Streak pip — mobile-web only. On desktop (`lg+`) the streak
          lives in the right rail's hero card so a second pip up here
          would double-render the same fact. */}
      <div className="lg:flex lg:gap-8 lg:items-start">
        <div
          className={
            viewMode === "day"
              ? "flex-1 min-w-0 lg:max-w-[480px] space-y-6"
              : "flex-1 min-w-0 space-y-6"
          }
        >
      {viewMode === "day" ? (
        // v3 serif date hero (ENG-1247, prototype `.t-greet`): eyebrow rule +
        // Newsreader day name + date subline (parity with mobile). The "DAY N"
        // chip is omitted (mock, no honest source); the eyebrow hides on a past
        // day (the serif slot shows the date instead).
        <div className="mt-1">
          {isTodayHero ? (
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-solid">
                Today
              </span>
              <span className="flex-1 h-px bg-border" />
            </div>
          ) : null}
          <p
            data-testid="today-hero-greeting"
            className="font-[family-name:var(--font-headline)] text-[36px] font-medium leading-[1.1] tracking-tight text-foreground"
          >
            {sloceHeroGreeting.headline}
          </p>
          {sloceHeroGreeting.subline ? (
            <p
              data-testid="today-hero-greeting-subline"
              className="mt-1 text-[13px] text-foreground-tertiary"
            >
              {sloceHeroGreeting.subline}
            </p>
          ) : null}
        </div>
      ) : null}

      <TodayDateHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedDate={selectedDate}
        selectedDateKey={selectedDateKey}
        onSelectDateKey={setSelectedDateKey}
        weekLabel={weekData.label}
        weekStartDay={weekStartDay}
        loggedDays={loggedDays}
        protectedDateKeys={protectedDateKeys}
        avatarLetter={avatarLetter}
        onNavigatePrev={() => (viewMode === "week" ? navigateWeek(-1) : navigateDay(-1))}
        onNavigateNext={() => (viewMode === "week" ? navigateWeek(1) : navigateDay(1))}
        onOpenCalendar={() => calendarInputRef.current?.showPicker?.() ?? calendarInputRef.current?.click()}
        onOpenSettings={() => onOpenSettings?.()}
        hideViewModeToggle
        stripOnly={viewMode === "day"}
        streakDays={protectedStreakLength}
        freezeProtected={protectedDateKeys.has(todayKey())}
        onStreakPress={weeklyRecap.trigger}
      />
      {weeklyRecap.dialog}

      {viewMode === "week" && (
        <TodayWeekView
          days={weekData.days}
          weekTotals={weekData.weekTotals}
          weekAvg={weekData.weekAvg}
          loggedDaysInWeek={weekData.loggedDaysInWeek}
          weekEffectiveCalorieBudget={weekEffectiveCalorieBudget}
          calorieTarget={targets.calories}
          proteinTarget={targets.protein}
          carbsTarget={targets.carbs}
          fatTarget={targets.fat}
          waterMlTarget={targets.waterMl}
          dailyStepsGoal={dailyStepsGoal}
          preferActivityAdjustedCalories={preferActivityAdjustedCalories}
          maintenanceForWeek={maintenanceForWeek}
          dayGoals={weekData.days.map((day) =>
            targets.calories +
            dayActivityBudgetAddonWeb(
              preferActivityAdjustedCalories,
              day.key,
              maintenanceForWeek,
              activityBurnByDay,
              basalBurnByDay,
              workoutsByDay,
              profileMaintenanceSource,
            ),
          )}
          onSelectDayKey={(key) => {
            setSelectedDateKey(key);
            setViewMode("day");
          }}
        />
      )}

      {/* Phase 4 / Top-5 #2 (2026-04-28) — Fasting pill moved into the
          unified context block below the hero; no standalone render
          here. See `docs/ux/teardown-2026-04-28-daily-loop.md` Top-5
          #2 for the priority rule (fasting > deficit; eat-again retired
          ENG-984). Mobile parity in `apps/mobile/app/(tabs)/index.tsx`. */}

      {viewMode === "day" && (
      <>
      {/* Phase 4 / Top-5 #2 (2026-04-28) — Today's above-meals composition
          is capped at FOUR blocks (date header / hero / one context block /
          macro tiles). Pre-Phase-4 the hero / AI pill / north-star block /
          macro tiles / nutrients grid all stacked unconditionally; the cap
          rule moves the prompts into a mutually exclusive context-block
          dispatch below the hero. The AI-estimated count chip moved INSIDE
          the hero (TodayHeroStats's new `aiSourcedCount` prop). Reference:
          `docs/ux/teardown-2026-04-28-daily-loop.md` §F1 + Top-5 #2. */}

      {/* Daily ring + 4-tile hero stats (Logged / Target / Burned / Net).
          Desktop (>= 768px) renders stats beside the ring; mobile-web
          shows just the ring. Canonical copy + deficit/surplus detail
          comes from `src/lib/copy/today.ts`. AI-estimated-count chip
          surfaces inline as a caption inside the hero block via
          `aiSourcedCount` (Phase 4). */}
      {(() => {
        const remainingToday = Math.max(0, effectiveCalorieTarget - totals.calories);
        const coachScreenEnabled = isFeatureEnabled("coach_screen_v1");
        const coachLineEl =
          !activeFast &&
          viewMode === "day" &&
          selectedDateKey === todayKey() &&
          remainingToday > 0 ? (
            <TodayDeficitInsight
              remaining={remainingToday}
              selectedDate={selectedDate}
              byDay={nutritionByDay}
              onPress={coachScreenEnabled ? () => trackerRouter.push("/coach") : undefined}
            />
          ) : null;
        return (
      <TodayHeroStats
        loggedKcal={Math.round(totals.calories)}
        targetKcal={Math.round(effectiveCalorieTarget)}
        burnedKcal={Math.round(totalBurnKcal)}
        aiSourcedCount={mealsForSelectedDate.filter(isAiSourcedFoodHistoryItem).length}
        consumed={totals.calories}
        target={effectiveCalorieTarget}
        baseGoal={baseCalorieTarget}
        proteinPct={effectiveMacroTargets.protein > 0 ? Math.min(totals.protein / effectiveMacroTargets.protein, 1) : 0}
        carbsPct={effectiveMacroTargets.carbs > 0 ? Math.min(totals.carbs / effectiveMacroTargets.carbs, 1) : 0}
        fatPct={effectiveMacroTargets.fat > 0 ? Math.min(totals.fat / effectiveMacroTargets.fat, 1) : 0}
        expanded={ringExpanded}
        onToggleExpanded={() => setRingExpanded((v) => !v)}
        pulse={winPulse}
        commitPulse={commitPulse}
        logConfirmVisible={logConfirmVisible}
        isOnTrack={
          totals.calories > 100 &&
          effectiveCalorieTarget > 0 &&
          Math.abs(totals.calories - effectiveCalorieTarget) / effectiveCalorieTarget <= 0.1
        }
        // ENG-758: real weigh-in count (distinct weigh-in days in the last 7)
        // from the profile's weight_kg_by_day map, not the old confidence proxy.
        tdeeLearnDays={countWeighInDaysInWindow(profileWeightKgByDay, todayKey())}
        onPressStatusChip={() => setWhyThisNumberOpen(true)}
        // ENG-1293 — always-present Coach entry (sweep decision #3): renders
        // in every hero state on mobile-web (`< md`); desktop gets the sidebar
        // item. Same `coach_screen_v1` gate; the deficit-line deep-link stays.
        onPressCoach={coachScreenEnabled ? () => trackerRouter.push("/coach") : undefined}
        coachLine={coachLineEl}
      />
        );
      })()}

      {/* Single context block — active fast only (mobile parity, 2026-06-06).
          Eat-again removed from Today scroll (2026-05-22 v4) and fully
          retired (ENG-984, 2026-06-17); logging shortcuts live in the Log
          sheet. The deficit line (the other historical context block) now
          renders INSIDE the hero unconditionally — the flag that gated that
          move (ENG-889) was collapsed as always-on in ENG-1356. */}
      {activeFast ? (
        <TodayFastingPill
          activeFastElapsedLabel={fastingElapsedLabel}
          fastingOptedIn={fastingOptedIn}
        />
      ) : null}

      {/* RemainingMacrosBar removed 2026-04-20 — duplicated the macro tiles
          below (feedback_no_duplicate_today_hero_content.md; mobile parity). */}

      {/* 3. Dashboard macro tiles — profile `tracked_macros` (Settings),
          same keys as mobile. Phase 4 / Top-5 #2 (2026-04-28): the
          non-macro nutrient rows that previously rendered as a
          standalone block below now ship inline inside this component
          via the `nutrientRows` prop, so the above-meals composition
          stays at four blocks (date / hero / context / macro tiles). */}
      <TodayMacroSection
        macroDisplayStyle={macroDisplayStyle}
        trackedMacros={trackedDashboardMacros}
        proteinCurrent={totals.protein}
        proteinTarget={effectiveMacroTargets.protein}
        carbsCurrent={totals.carbs}
        carbsTarget={effectiveMacroTargets.carbs}
        fatCurrent={totals.fat}
        fatTarget={effectiveMacroTargets.fat}
        fiberCurrent={totals.fiber}
        fiberTarget={targets.fiber}
        sugarG={dayMicroSumForTracker.sugarG}
        sodiumMg={dayMicroSumForTracker.sodiumMg}
        waterCurrentMl={totalWaterMl}
        waterTargetMl={targets.waterMl}
        formatWaterLine={formatWaterLine}
        onAddWaterMl={addWaterMlForSelectedDay}
        netCarbsLensEnabled={netCarbsLensEnabled}
        nutrientRows={dayNutrientDetailRows}
        onPressViewAllNutrients={() => setFullNutrientPanelOpen(true)}
        viewAllNutrientsCount={FULL_NUTRIENT_PANEL_ROW_COUNT}
        onPressMacro={macroDetailFlagEnabled ? openMacroDetail : undefined}
      />

      {/* PR #47 full-nutrient panel — opened from the
          TodayDashboardMacroTiles "View all N nutrients" pill above.
          Re-wired 2026-05-02 (revert PR #30) so the panel keeps
          shipping after the TodayMicrosWidget that previously hosted
          the trigger CTA was removed from Today's canvas. */}
      <FullNutrientPanelSheet
        open={fullNutrientPanelOpen}
        onOpenChange={setFullNutrientPanelOpen}
        microSum={dayMicroSum}
        fiberG={totals.fiber}
        totalFatG={totals.fat}
        totalCarbsG={totals.carbs}
        proteinG={totals.protein}
        sugarG={dayMicroSumForTracker.sugarG}
      />

      {macroDetailFlagEnabled && macroDetailTarget != null ? (
        <MacroDetailPanel
          macro={macroDetailTarget}
          meals={macroDetailMeals}
          ingredientRows={macroDetailIngredientRows}
          snapshotRows={macroDetailSnapshotRows}
          open={macroDetailTarget != null}
          onClose={() => setMacroDetailTarget(null)}
        />
      ) : null}

      {/* TodayMicrosWidget removed 2026-05-02 (revert PR #30) —
          user feedback: 4-tile widget on Today canvas duplicated
          fibre and over-cluttered the screen. Micronutrient depth is
          preserved inside FullNutrientPanelSheet (PR #47), opened
          via the "Nutrients" link in TodayDashboardMacroTiles. See
          `docs/decisions/2026-05-02-revert-today-ui-changes.md`. */}

      {/* 4. Quick Log Strip: Search, Voice (Pro), Snap (Pro), Scan. Voice +
          Snap are gated; free-tier users see a lock icon and tapping
          opens the factual Pro paywall (Batch 5.13).
          B4 Phase 3c (2026-04-27): gated behind PostHog flag
          `today_phase_3_quickadd_v2`. When the flag is on, the strip
          is suppressed and the FAB becomes the sole primary entry
          point — matches the spec at
          docs/specs/2026-04-27-b4-today-screen-phase3.md and is
          revertable in 1 PostHog click without a deploy. */}
      {/* Quick add recents one-tap re-log chips (ENG-1247, v3 `.quickrow`) —
          after macros; re-log via logHistoryItem; flag-gated. Replaces the dead
          TodayQuickLogStrip (deleted — never rendered on Today; the method-
          launchers live in the LogSheet, reached via "All" + the raised Plus
          button). Web twin of mobile `TodayRecentsRow`. */}
      {isFeatureEnabled("today_quickadd_recents_v3") ? (
        <TodayRecentsRow
          recents={computeRecentMeals(nutritionByDay, 50)}
          onReLog={(item) => logHistoryItem(item, mealSlot)}
          onOpenAll={() => setLogSheetOpen(true)}
        />
      ) : null}

      {/* TodayStreakInsightCard removed 2026-04-20 (Grace's call per
          Today alignment pass). Mobile removed same commit. Streak
          logic still runs but is no longer surfaced on Today. */}

      {/* Deficit insight removed (2026-04-18, Pass 7): the standalone
          web `CalorieDeficitInsight` panel duplicated data already
          shown in the Activity Bonus card directly above (Activity
          adjustment kcal) and surfaced a separate "Recent pace" line
          that contradicted the day's Net tile. Mobile shows only a
          tiny banner via `TodayDeficitInsight`, not this full panel,
          so removing it brings web in line with mobile and removes
          the duplication. The deficit/surplus information is still
          present on Today via the Net tile (`TodayHeroStats`) and the
          Activity Bonus card. */}

      {/* Eat-again block retired (ENG-984, 2026-06-17); mobile parity. */}

      {/* Quick add panel — Usual meals / Recent / Frequent / Favourites
          tabs with one-tap log. Ship M1 (2026-04-18) reordered so Usual
          meals is the primary re-log surface and renames the "My meals"
          tab to "Usual meals". Batch 2.6 introduced saved meals; audit
          H4 (2026-04-18) lifted `SaveMealDialog` up to this host and
          wires opening via `onOpenSaveCombo` instead of the previous
          `window.dispatchEvent` bridge.
          Audit M4 (2026-04-18): collapsed behind a single "Quick add" CTA
          above Meals. Default collapsed on first run; user's last choice
          persists via localStorage (`suppr-quick-add-collapsed-v1`). */}

      {/* Figma `654:2` — What to eat next above Today's Meals. */}
      {showAboveMealsNorthStarWeb && (
        <NorthStarBlockHost
          viewMode={viewMode}
          savedRecipesForLibrary={savedRecipesForLibrary as Array<NorthStarRecipe>}
          remainingCalories={Math.max(0, effectiveCalorieTarget - totals.calories)}
          remainingProtein={Math.max(0, effectiveMacroTargets.protein - totals.protein)}
          remainingCarbs={Math.max(0, effectiveMacroTargets.carbs - totals.carbs)}
          remainingFat={Math.max(0, effectiveMacroTargets.fat - totals.fat)}
          dailyCalorieTarget={effectiveCalorieTarget}
          onPrimaryCta={(_recipeId) => {
            setMealSlot(slotForHour(new Date().getHours()));
            setLogSheetOpen(true);
          }}
          // ENG-1301 — compact secondary Log: reuses the existing quick-log
          // insert primitive (addLoggedMealForDate), attributed
          // `source: "north_star"`; toast = the standard success feedback.
          onLogSuggestion={({ meal, slotName, title }) => {
            addLoggedMealForDate(selectedDateKey, meal, "north_star");
            toast.success(`${title} logged to ${slotName}`);
          }}
          onBrowseLibrary={() => {
            setMealSlot(slotForHour(new Date().getHours()));
            setLogSheetOpen(true);
          }}
          selectedDateKey={selectedDateKey}
          userCreatedAt={authUserCreatedAt}
          hasEverLoggedAnyMeal={Object.values(nutritionByDay).some(
            (meals) => Array.isArray(meals) && meals.length > 0,
          )}
        />
      )}

      {/* 5. Meals Section — larger top break vs hero cluster (ENG-871). */}
      <div>
      <TodayMealsSection
        mealsGrouped={mealsGrouped}
        slotLabels={enabledMealSlots}
        mealsForSelectedDate={mealsForSelectedDate}
        effectiveCalorieTarget={effectiveCalorieTarget}
        fiberTarget={targets.fiber}
        collapsedSlots={collapsedSlots}
        onToggleSlot={toggleSlot}
        onOpenAddForSlot={(slot) => {
          setMealSlot(slot);
          setAddOpen(true);
        }}
        onOpenSaveUsualMeal={openSaveMealDialog}
        onOpenDuplicateDay={() => setDuplicateDayOpen(true)}
        onRequestCopyMeal={setCopyMealTargetId}
        onDeleteMeal={(mealId) => removeLoggedMeal(mealId)}
        // P5 parity gap #15 — "View nutrition" kebab item + per-meal dialog,
        // gated behind `web_meal_nutrition_detail`. Flag OFF → prop undefined →
        // no kebab item, meal row byte-identical to today. Mirror:
        // apps/mobile/app/meal-nutrition.tsx.
        onOpenMealNutrition={
          isFeatureEnabled("web_meal_nutrition_detail")
            ? setMealNutritionTargetId
            : undefined
        }
        // ENG-837 — "View slot nutrition" header affordance + slot-aggregate
        // dialog, gated behind the SAME `web_meal_nutrition_detail` flag. Flag
        // OFF → prop undefined → no slot affordance, header byte-identical.
        // Mirror: apps/mobile/app/meal-nutrition.tsx?slot=&date=.
        onOpenSlotNutrition={
          isFeatureEnabled("web_meal_nutrition_detail")
            ? setSlotNutritionTarget
            : undefined
        }
        onEditMeal={
          isFeatureEnabled("web_logged_meal_edit")
            ? setEditMealTargetId
            : undefined
        }
        // 2026-05-02 parity sweep — empty-state collage (Add custom /
        // Photo / Voice / "Log from today's plan" rows) replaced by a
        // single primary CTA that routes into the unified `<LogSheet>`.
        // Mobile equivalent: raised "+" + per-slot "Tap to add" + the
        // standalone `<TodayPlannedMealsCard>` rendered above. Planned
        // meals still render via `<TodayPlannedMealsCard>` directly
        // below (gated on `mealPlan` truthy with ≥1 non-placeholder).
        onOpenLogSheet={() => {
          // 2026-05-08 build-47 fix — see other generic-FAB
          // call-sites; reset mealSlot to time-of-day before opening.
          setMealSlot(slotForHour(new Date().getHours()));
          setLogSheetOpen(true);
        }}
        savedMeals={hostSavedMeals}
        onLogSavedMeal={logSavedMealFromSlotHeader}
        onLogAgain={isFeatureEnabled("today_log_again") ? logAgainSlot : undefined}
        hintVisibleForSlot={hintVisibleForSlot}
        onDismissUsualMealHint={dismissUsualMealHint}
        onAcceptUsualMealHint={acceptUsualMealHint}
        quickAddCollapsed={quickAddCollapsed}
        onToggleQuickAddCollapsed={toggleQuickAddCollapsed}
        quickAddPanel={
          <QuickAddPanel
            byDay={nutritionByDay}
            activeSlot={mealSlot}
            supabase={supabase}
            userId={authedUserId ?? ""}
            onLog={(item) => logHistoryItem(item, mealSlot)}
            onLogSavedMeal={(meal, slot) => logSavedMeal(meal, slot)}
            onOpenSaveCombo={handleOpenSaveCombo}
            savedMealsRefreshToken={savedMealsRefreshToken}
          />
        }
      />
      </div>
      <TodayWeeklyInsightMobileCard
        householdSize={householdMemberCount}
        loggedDaysInWeek={weekData.loggedDaysInWeek}
        weekAvgKcal={
          weekData.loggedDaysInWeek > 0 ? weekData.weekAvg.calories : null
        }
        weekDailyKcal={weekData.days.map((d) => d.totals.calories)}
        dailyKcalTarget={Math.round(effectiveCalorieTarget)}
      />

      {/* Below-meals prompts (Today premium sprint 2026-05-19). Max 2: ENG-585. */}
      {showBelowMealsCheckinWeb && (
        <WeeklyCheckinBanner
          onOpen={openWeeklyCheckinFromBanner}
          onDismiss={dismissCheckinBannerWeb}
        />
      )}
      {showBelowMealsSnapWeb && (
        <TodaySnapShortcut
          onPress={() => {
            track(AnalyticsEvents.today_snap_shortcut_tapped, {
              tier: userTier,
            });
            setPhotoLogOpen(true);
          }}
          locked={false}
        />
      )}
      {selectedDateKey === todayKey() &&
        mealsForSelectedDate.length === 0 &&
        loggedDays.size === 0 && (
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
              setMealSlot(slotForHour(new Date().getHours()));
              setLogSheetOpen(true);
            }}
          />
        )}
      {/* Planned meals — show meals from today's plan so the user can
          one-tap log them at a chosen portion (½× / 1× / 1½× / 2×).
          F-178/F-179 (ENG-1065): when `today_planned_empty_state` is ON the
          "Planned" card persists on empty days too — it renders an empty-state
          branch (same shell + header) instead of vanishing, so the Today scroll
          keeps its section grammar whether or not a plan exists. Flag OFF keeps
          the prior render-only-when-populated behaviour exactly. The card owns
          the empty/populated fork off `plannedMeals.length`. Mobile parity:
          `apps/mobile/app/(tabs)/index.tsx` planned section. */}
      {(mealPlan && mealPlan.length > 0 && (mealPlan[0]?.meals ?? []).length > 0) ||
      (viewMode === "day" && isFeatureEnabled("today_planned_empty_state")) ? (
        <TodayPlannedMealsCard
          plannedMeals={mealPlan?.[0]?.meals ?? []}
          onLogPlannedMealWithPortion={async (meal, portion) => {
            const mult = Math.max(0.125, Math.min(24, portion));
            // Pull fiber/sugar/sodium off the saved recipe so the
            // journal entry carries more than just kcal/P/C/F. Mobile
            // parity: `apps/mobile/app/(tabs)/index.tsx`
            // logPlannedMealWithPortion.
            const microsRes = await fetchPlannedMealMicros(
              supabase as unknown as SupabaseLike,
              meal.recipeId ?? null,
              mult,
            );
            // T4 (full-sweep 2026-04-24): refuse to log fabricated macros.
            if (microsRes.macrosAreCoerced) {
              if (typeof window !== "undefined") {
                window.alert(
                  "Verify this recipe first.\n\nThis recipe has calories but no ingredient macros yet. Logging now would save estimated values. Open the recipe and tap Verify to match ingredients for accurate nutrition.",
                );
              }
              return;
            }
            addLoggedMealForDate(
              selectedDateKey,
              {
                name: normalizeJournalSlotName(meal.name),
                recipeTitle: meal.recipeTitle,
                time: normalizeJournalSlotName(meal.name),
                calories: Math.round((meal.calories ?? 0) * mult),
                protein: Math.round((meal.protein ?? 0) * mult * 10) / 10,
                carbs: Math.round((meal.carbs ?? 0) * mult * 10) / 10,
                fat: Math.round((meal.fat ?? 0) * mult * 10) / 10,
                ...(microsRes.fiberG != null ? { fiberG: microsRes.fiberG } : {}),
                ...(Object.keys(microsRes.micros).length > 0 ? { micros: microsRes.micros } : {}),
                source: "Meal plan",
              },
              "planner",
            );
          }}
        />
      ) : null}

      {/* Figma TD1 — Activity & energy (mobile parity: section shell always on day view). */}
      {viewMode === "day" ? (
        <section className="flex flex-col gap-5" data-testid="today-td1-section">
          <TodayScrollSectionHeader
            title="Activity & energy"
            testID="today-td1-section-header"
          />
          {showStepsCard ? (
            <TodayStepsCard
              stepsForSelectedDay={stepsForSelectedDay}
              dailyStepsGoal={dailyStepsGoal}
              activityBurnKcal={
                activityBurnForSelectedDay > 0 ? Math.round(activityBurnForSelectedDay) : null
              }
              dayLabel={formatDateLabel(selectedDate)}
            />
          ) : null}
          {authedUserId && (hasBurnData || selectedDateKey === todayKey()) ? (
          <TodayActivityBonusCard
            hasBurnData={hasBurnData}
            totalBurnKcal={totalBurnKcal}
            effectiveCalorieTarget={effectiveCalorieTarget}
            consumedCalories={totals.calories}
            basalBurnKcal={basalBurnKcal}
            activityBurnForSelectedDay={activityBurnForSelectedDay}
            workouts={dayWorkouts}
            weekSummaryMode={weekSummaryMode}
            weekSummaryKeys={trackerWeekSummaryKeys}
            activityBurnByDay={activityBurnByDay}
            basalBurnByDay={basalBurnByDay}
            nutritionByDay={nutritionByDay}
            selectedDateKey={selectedDateKey}
            profileMeasurementSystem={profileMeasurementSystem}
            maintenanceTdeeKcal={profileMaintenanceTdee}
            profileSex={profileSex}
            profileWeightKg={profileWeightKg}
            profileHeightCm={profileHeightCm}
            profileAge={profileAge}
            profileActivityLevel={profileActivityLevel}
            maintenanceSource={profileMaintenanceSource}
            maintenanceConfidence={profileMaintenanceConfidence}
            activityBudgetAddonKcal={activityAdjustment}
            preferActivityAdjustedCalories={preferActivityAdjustedCalories}
            showActivityBudgetDiscoverBanner={!activityBudgetDiscoverDismissed}
            onEnableActivityBudget={() => {
              setPreferActivityAdjustedCalories(true);
              if (authedUserId) {
                void supabase
                  .from("profiles")
                  .update({ prefer_activity_adjusted_calories: true })
                  .eq("id", authedUserId);
              }
              try {
                window.localStorage.setItem(ACTIVITY_BUDGET_DISCOVERABILITY_KEY, "1");
              } catch {
                /* ignore */
              }
              setActivityBudgetDiscoverDismissed(true);
            }}
            onDismissActivityBudgetDiscover={() => {
              try {
                window.localStorage.setItem(ACTIVITY_BUDGET_DISCOVERABILITY_KEY, "1");
              } catch {
                /* ignore */
              }
              setActivityBudgetDiscoverDismissed(true);
            }}
          />
          ) : null}
        </section>
      ) : null}

      {/* Figma TD2 — Hydration & stimulants (mobile parity: header always on day view). */}
      {viewMode === "day" ? (
        <section className="flex flex-col gap-5" data-testid="today-td2-section">
          <TodayScrollSectionHeader
            title="Hydration & stimulants"
            testID="today-td2-section-header"
          />
          {showHydrationCard ? (
            <HydrationStimulantsCard
              selectedDateKey={selectedDateKey}
              weekStartDay={weekStartDay}
              targets={{
                waterMl: targets.waterMl,
                caffeineMg: trackingExtras.trackCaffeine ? targetCaffeineMg : 0,
                alcoholGWeekly: trackingExtras.trackAlcohol ? targetAlcoholGWeekly : 0,
              }}
              waterTotalMl={totalWaterMl}
              waterFromMealsMl={Math.max(0, totalWaterMl - extraWaterMlForSelectedDay)}
              caffeineTotalMg={extraCaffeineMgForSelectedDay + caffeineFromMealsMgToday}
              alcoholByDayG={alcoholByDayMerged}
              measurementSystem={profileMeasurementSystem}
              onAddWater={addWaterMlForSelectedDay}
              onAddCaffeine={addCaffeineMgForSelectedDay}
              onAddAlcohol={addAlcoholGForSelectedDay}
              onReset={(kind) => resetHydrationStimulantsForDay(selectedDateKey, kind)}
            />
          ) : (
            <div className="mb-3 text-center">
              <button
                type="button"
                onClick={() => setHydrationManualExpanded(true)}
                className="text-xs font-semibold text-primary-solid hover:underline focus:outline-none focus:underline"
                aria-expanded={false}
                aria-controls="today-hydration-card"
              >
                Track hydration?
              </button>
            </div>
          )}
        </section>
      ) : null}

      {/* Complete Day — button system (2026-06-12,
          `docs/decisions/2026-06-12-button-system-solid-primary.md`): this
          section's ONE primary action → `SupprButton` variant="primary"
          (solid aubergine fill, white label, pill, no shadow — the solid fill
          IS the affordance). Supersedes the old aubergine-OUTLINE treatment
          which read weak/floating on the flat cream ground. Mirror of mobile
          `<TodayCompleteDayButton>`.
          F-158 (ENG-1065): was `mt-4` (16px) — off the section rhythm where
          every Today section uses `mt-10` (40px) — so it read as a button
          floating in dead space. Snapped to `mt-10` so it lands as the day's
          terminal section on the same cadence as Activity / Hydration above,
          matching the mobile `<TodayCompleteDayButton>` section-break fix. */}
      {selectedDateKey === todayKey() && mealsForSelectedDate.length > 0 && (
        <SupprButton
          variant="primary"
          label="Complete Day"
          onClick={() => setCompleteDayOpen(true)}
          className="w-full"
        />
      )}

      </>
      )}
        </div>

        {viewMode === "day" ? (
          <TodayDesktopRightRail
            className="hidden lg:block sticky top-4 self-start"
            targetKcal={Math.round(effectiveCalorieTarget)}
            weekDailyKcal={weekData.days.map((d) => d.totals.calories)}
            weekDayLabels={weekData.days.map((d) => d.short)}
            weekLoggedDays={weekData.loggedDaysInWeek}
            weekAvgKcal={weekData.loggedDaysInWeek > 0 ? weekData.weekAvg.calories : null}
            streakDays={streakDays}
            activeDateKey={selectedDateKey}
            todayDateKey={todayKey()}
            byDay={nutritionByDay}
            onSelectDayKey={(k) => setSelectedDateKey(k)}
          />
        ) : null}
      </div>

      {/* Weekly TDEE check-in ritual (PR claude/weekly-checkin-ritual-v2,
          2026-05-02 — rebuild of #26). Mirror of the mobile modal — soft
          prompt that surfaces the adaptive-vs-formula TDEE delta + a
          suggested new daily target. */}
      <WeeklyCheckinDialog
        open={weeklyCheckinOpen}
        content={weeklyCheckinContent}
        currentTargetKcal={targets.calories}
        onAccept={handleWeeklyCheckinAccept}
        onDismiss={handleWeeklyCheckinDismiss}
      />

      {/* ENG-1184 — status chip on the hero opens the target explainer
          inline on Today (persona trust). Targets still owns the
          "How is this calculated?" row for users who land there first. */}
      <WhyThisNumberDialog
        open={whyThisNumberOpen}
        onOpenChange={setWhyThisNumberOpen}
        targetCalories={Math.round(effectiveCalorieTarget)}
        maintenanceTdee={profileMaintenanceTdee}
        confidence={profileMaintenanceConfidence}
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
        onAdjustTarget={() => {
          setWhyThisNumberOpen(false);
          trackerRouter.push("/home?view=targets");
        }}
      />

      <TodayCompleteDayDialog
        open={completeDayOpen}
        onOpenChange={setCompleteDayOpen}
        profileWeightKg={profileWeightKg}
        todayCalories={totals.calories}
        targetCalories={normalizeMacroTargets(nutritionTargets).calories}
        todayProteinG={totals.protein}
        proteinTargetG={normalizeMacroTargets(nutritionTargets).protein}
        maintenanceTdeeKcal={profileMaintenanceTdee}
        profileGoal={profileGoal}
        profileMeasurementSystem={profileMeasurementSystem}
        onViewProgress={() => {
          setCompleteDayOpen(false);
          onOpenProgress?.();
        }}
      />

      {/* Post-ship #5 (C1a, 2026-04-18) — shared FoodSearch dialog.
          As of 2026-04-30 (web parity with mobile commit `1968953`)
          the dialog is a thin wrapper over `<FoodSearchPanel>`. The
          same panel is also mounted INLINE inside `<LogSheet>` (see
          the LogSheet block below) — both surfaces share
          `commitFoodSearchSelection` so the food-logging flow is
          identical regardless of entry point. */}
      <FoodSearch
        open={foodSearchOpen}
        onClose={() => setFoodSearchOpen(false)}
        supabase={supabase}
        userId={authedUserId ?? null}
        logDateKey={selectedDateKey}
        macroTargets={{
          calories: effectiveCalorieTarget,
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
        // History-first search (ENG-1033): the user's logging history,
        // newest-first, so the typed-query "Past logged" group ranks
        // matching past logs above database results. HealthKit-import
        // fallback rows stripped (mobile parity).
        recentFoods={computeRecentMeals(nutritionByDay, 50)
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
          }))}
        onSelect={(selection: FoodSearchSelection) => {
          commitFoodSearchSelection(selection);
          setFoodSearchOpen(false);
        }}
      />

      <TodayAddMealDialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setAddMode("recipe");
            setRecipePortionMultiplier(1);
          }
        }}
        selectedDate={selectedDate}
        mealSlot={mealSlot}
        onMealSlotChange={setMealSlot}
        addMode={addMode}
        onAddModeChange={setAddMode}
        recipeId={recipeId}
        onRecipeIdChange={setRecipeId}
        recipeOptions={recipeOptions}
        savedRecipesEmpty={savedRecipesForLibrary.length === 0}
        recipePortionMultiplier={recipePortionMultiplier}
        onRecipePortionMultiplierChange={setRecipePortionMultiplier}
        manualName={manualName}
        onManualNameChange={setManualName}
        manualCalories={manualCalories}
        onManualCaloriesChange={setManualCalories}
        manualProtein={manualProtein}
        onManualProteinChange={setManualProtein}
        manualCarbs={manualCarbs}
        onManualCarbsChange={setManualCarbs}
        manualFat={manualFat}
        onManualFatChange={setManualFat}
        manualFiber={manualFiber}
        onManualFiberChange={setManualFiber}
        manualWater={manualWater}
        onManualWaterChange={setManualWater}
        timeLabel={timeLabel}
        onTimeLabelChange={setTimeLabel}
        onSubmit={handleAddMeal}
        onOpenSearch={() => {
          // Close Add-meal before opening Search so the two dialogs
          // don't stack. Mirrors mobile's Add-meal → FoodSearchModal
          // hand-off in `apps/mobile/app/(tabs)/index.tsx`.
          setAddOpen(false);
          setFoodSearchOpen(true);
        }}
      />

      <TodayBarcodeDialog
        open={barcodeOpen}
        onOpenChange={(open) => {
          setBarcodeOpen(open);
          if (!open) {
            setBarcodePreview(null);
            setBarcodeGramsStr("100");
            setBarcodeValue("");
            setBarcodeTitleOverride("");
            setBarcodeMacrosManual(false);
            setBarcodeEditCal("");
            setBarcodeEditPro("");
            setBarcodeEditCarb("");
            setBarcodeEditFat("");
          }
        }}
        barcodeValue={barcodeValue}
        onBarcodeValueChange={setBarcodeValue}
        barcodeBusy={barcodeBusy}
        onBarcodeBusyChange={setBarcodeBusy}
        barcodePreview={barcodePreview}
        onBarcodePreviewChange={setBarcodePreview}
        barcodeGramsStr={barcodeGramsStr}
        onBarcodeGramsStrChange={setBarcodeGramsStr}
        barcodeGramsParsed={barcodeGramsParsed}
        barcodeTitleOverride={barcodeTitleOverride}
        onBarcodeTitleOverrideChange={setBarcodeTitleOverride}
        barcodeMacrosManual={barcodeMacrosManual}
        onBarcodeMacrosManualChange={setBarcodeMacrosManual}
        barcodeEditCal={barcodeEditCal}
        onBarcodeEditCalChange={setBarcodeEditCal}
        barcodeEditPro={barcodeEditPro}
        onBarcodeEditProChange={setBarcodeEditPro}
        barcodeEditCarb={barcodeEditCarb}
        onBarcodeEditCarbChange={setBarcodeEditCarb}
        barcodeEditFat={barcodeEditFat}
        onBarcodeEditFatChange={setBarcodeEditFat}
        mealSlot={mealSlot}
        onMealSlotChange={setMealSlot}
        recentFoods={recentFoods}
        onPickRecentFood={(n) => {
          addLoggedMeal(
            {
              name: "Snacks",
              recipeTitle: n,
              time: timeLabel,
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              source: "Manual",
            },
            "manual",
          );
          setBarcodeOpen(false);
        }}
        onConfirm={(payload: TodayBarcodeConfirmPayload) => {
          pushRecentFood(payload.titleForLog);
          setRecentFoods(loadRecentFoods());
          // F-13 (2026-04-19) — auto-track caffeine + alcohol from the
          // scanned product. OFF surfaces `caffeine_100g` for colas /
          // energy drinks and `alcohol_100g` for beer / wine / cider.
          // `scaleCaffeineAlcohol` handles nulls by returning 0, so a
          // non-stimulant product adds no micros.
          const { caffeineMg, alcoholG } = scaleCaffeineAlcohol({
            grams: payload.grams,
            caffeineMgPer100g: payload.product.caffeineMgPer100g ?? null,
            alcoholGPer100g: payload.product.alcoholGPer100g ?? null,
          });
          // F-79 — full OFF micro set scaled for `grams`, merged with
          // caffeine/alcohol overrides. Mirrors mobile barcode commit.
          const explicitMicros: Record<string, number> = {};
          if (caffeineMg > 0) explicitMicros.caffeineMg = caffeineMg;
          if (alcoholG > 0) explicitMicros.alcoholG = alcoholG;
          const micros = scaleMicrosForGrams(
            (payload.product as { microsPer100g?: Record<string, number> }).microsPer100g ?? {},
            payload.grams,
            explicitMicros,
          );
          addLoggedMeal(
            {
              name: mealSlot,
              recipeTitle: `${payload.titleForLog} (${payload.portion})`,
              time: timeLabel,
              calories: payload.calories,
              protein: payload.protein,
              carbs: payload.carbs,
              fat: payload.fat,
              source: payload.adjusted ? "Open Food Facts (adjusted)" : "Open Food Facts",
              ...(payload.fiberG != null && payload.fiberG > 0 ? { fiberG: payload.fiberG } : {}),
              ...(Object.keys(micros).length > 0 ? { micros } : {}),
            },
            "barcode",
          );
          setBarcodeOpen(false);
          toast.success("Logged from barcode");
          track(AnalyticsEvents.barcode_lookup, { ok: true, adjusted: payload.adjusted });
        }}
        onPhotoFallback={() => {
          // Audit 2026-04-30 (Lose It "Closer" parity, Fix 2) — when
          // the barcode lookup fails we offer a soft handoff to the
          // AI photo log. 2026-05-02: open for any tier; the in-dialog
          // quota line + 403 paywall handoff handle gating now.
          setBarcodeOpen(false);
          setPhotoLogOpen(true);
        }}
        onAddAsCustomFood={(barcode) => {
          // F-156 PR-2 (2026-05-10) — barcode not found in OFF →
          // user opts to add it as a custom food. Close the barcode
          // dialog and open CreateCustomFoodDialog with the barcode
          // pre-filled so the saved row writes to user_custom_foods
          // with the correct code (next scan resolves successfully).
          setBarcodeOpen(false);
          setCustomFoodFromBarcode(barcode);
        }}
      />

      {/* F-156 PR-2 (2026-05-10) — CreateCustomFoodDialog host for the
          barcode-not-found path. Only mounts when the user arrived
          via the "Add as custom food" CTA. Saves to user_custom_foods;
          user can scan again to log. */}
      <CreateCustomFoodDialog
        open={customFoodFromBarcode != null}
        onOpenChange={(o) => {
          if (!o) setCustomFoodFromBarcode(null);
        }}
        initialBarcode={customFoodFromBarcode ?? undefined}
        onSave={async (payload: CreateCustomFoodPayload) => {
          if (!authedUserId) return;
          try {
            await createCustomFood(supabase, authedUserId, payload);
            try {
              track(AnalyticsEvents.custom_food_created, {
                hasBrand: Boolean(payload.brand),
                servingCount: payload.servings.length,
                fromBarcode: true,
              });
            } catch {
              /* analytics noop */
            }
            toast.success(
              isFeatureEnabled("eng1247_section_a_v1")
                ? COMPLETE_DAY_V3_COPY.savedTitle
                : "Custom food saved. Scan again to log it.",
            );
            // ENG-1247 — offer the community-contribution opt-in (flag-gated,
            // barcode only). The private custom food is already saved above; this
            // is the explicit, separate opt-in to ALSO share it to user_foods.
            if (isFeatureEnabled("barcode_community_contribution") && payload.barcode) {
              setShareCommunityInput({
                barcode: payload.barcode,
                name: payload.name,
                calories: payload.calories,
                protein: payload.protein,
                carbs: payload.carbs,
                fat: payload.fat,
                fiberG: payload.fiber,
                sugarG: payload.sugarG,
                sodiumMg: payload.sodiumMg,
                saturatedFatG: payload.saturatedFatG,
                servingSizeG: payload.baseGrams,
              });
            }
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "Couldn't save custom food",
            );
          }
        }}
      />

      {/* ENG-1247 — community-contribution opt-in, opened after a not-found
          barcode is saved as a custom food (flag-gated). Writes to user_foods
          via the web submitFoodCorrection with the authed client + RLS. */}
      <ShareCommunityDialog
        input={shareCommunityInput}
        onShare={(input) => submitFoodCorrection(supabase, authedUserId ?? "", input)}
        onClose={() => {
          if (isFeatureEnabled("eng1247_section_a_v1") && shareCommunityInput?.name) {
            setBarcodeSavedAckName(shareCommunityInput.name);
          }
          setShareCommunityInput(null);
        }}
      />

      {isFeatureEnabled("eng1247_section_a_v1") && barcodeSavedAckName ? (
        <BarcodeSavedAckDialog
          open
          productName={barcodeSavedAckName}
          onLogNow={() => setBarcodeSavedAckName(null)}
        />
      ) : null}

      {/* Batch 5.13 — Voice log (Pro). Shared review/edit flow. */}
      <VoiceLogDialog
        open={voiceLogOpen}
        onOpenChange={setVoiceLogOpen}
        activeSlot={mealSlot}
        onCommit={commitAiLoggedItems}
      />

      {/* Batch 5.13 — AI photo log. 2026-05-02: Free + Base get 5 photo
          logs per rolling 7 days via a server-enforced free-taster
          bucket; on exhaustion the dialog calls onUpgradeRequired and
          we open the AiPaywallDialog. */}
      <PhotoLogDialog
        open={photoLogOpen}
        onOpenChange={setPhotoLogOpen}
        activeSlot={mealSlot}
        onCommit={commitAiLoggedItems}
        userTier={userTier}
        onUpgradeRequired={() => {
          setPhotoLogOpen(false);
          setAiPaywallFeature("photo_log");
        }}
      />

      {/* Batch 5.13 — Factual Pro paywall for voice / photo logging. */}
      <AiPaywallDialog
        open={aiPaywallFeature !== null}
        onOpenChange={(next) => {
          if (!next) setAiPaywallFeature(null);
        }}
        feature={aiPaywallFeature ?? "voice_log"}
      />

      {/* Batch 1.4 — Copy meal to another day */}
      {copyMealTargetId && (() => {
        const meal = mealsForSelectedDate.find((m) => m.id === copyMealTargetId);
        if (!meal) return null;
        return (
          <CopyMealDialog
            open={true}
            onOpenChange={(open) => { if (!open) setCopyMealTargetId(null); }}
            sourceDayKey={selectedDateKey}
            mealLabel={meal.recipeTitle}
            onConfirm={(targetDayKeys, summary) => {
              if (targetDayKeys.length === 0) {
                toast(summary);
                return;
              }
              if (targetDayKeys.length === 1) {
                void copyMealToDate(selectedDateKey, meal.id, targetDayKeys[0]!);
              } else {
                void copyMealToDateRange(selectedDateKey, meal.id, targetDayKeys);
              }
              toast.success(summary);
            }}
          />
        );
      })()}

      {/* P5 parity gap #15 — per-meal nutrition-detail dialog (web mirror of
          apps/mobile/app/meal-nutrition.tsx). Gated behind
          `web_meal_nutrition_detail`; resolves the full LoggedMeal (with micros)
          from `mealsForSelectedDate` by id — no Supabase fetch. */}
      {isFeatureEnabled("web_meal_nutrition_detail") && (
        <MealNutritionDialog
          meal={
            mealNutritionTargetId
              ? mealsForSelectedDate.find((m) => m.id === mealNutritionTargetId) ?? null
              : null
          }
          open={mealNutritionTargetId != null}
          onClose={() => setMealNutritionTargetId(null)}
          onEdit={
            isFeatureEnabled("web_logged_meal_edit")
              ? (mealId) => {
                  setMealNutritionTargetId(null);
                  setEditMealTargetId(mealId);
                }
              : undefined
          }
          onMacroTap={macroTapFromDialog(() => setMealNutritionTargetId(null))}
        />
      )}

      {/* ENG-837 — slot-aggregate nutrition dialog (web mirror of
          apps/mobile/app/meal-nutrition.tsx?slot=&date=). Same flag as the
          per-meal dialog. Sums the targeted slot's meals (resolved from
          `mealsGrouped`, keyed identically by `normalizeJournalSlotName`) via
          the shared `sumMicrosFromLoggedMeals` / `sumDayFiberFromMeals` helpers
          inside the dialog — no Supabase fetch, no re-summing math here. */}
      {isFeatureEnabled("web_meal_nutrition_detail") && (
        <MealNutritionDialog
          meal={null}
          slotAggregate={
            slotNutritionTarget
              ? {
                  slotLabel: slotNutritionTarget,
                  meals:
                    mealsGrouped.find((g) => g.name === slotNutritionTarget)?.meals ?? [],
                }
              : null
          }
          open={slotNutritionTarget != null}
          onClose={() => setSlotNutritionTarget(null)}
          onMacroTap={macroTapFromDialog(() => setSlotNutritionTarget(null))}
        />
      )}

      {isFeatureEnabled("web_logged_meal_edit") && (
        <EditMealDialog
          meal={
            editMealTargetId
              ? mealsForSelectedDate.find((m) => m.id === editMealTargetId) ?? null
              : null
          }
          anchorDayKey={selectedDateKey}
          timeZone={profileTimeZone}
          open={editMealTargetId != null}
          slotLabels={enabledMealSlots}
          onClose={() => setEditMealTargetId(null)}
          onSave={async (updated) => {
            const ok = await updateLoggedMeal(selectedDateKey, updated);
            if (ok) toast.success("Meal updated");
          }}
        />
      )}

      {/* Batch 1.4 — Duplicate the whole day */}
      <DuplicateDayDialog
        open={duplicateDayOpen}
        onOpenChange={setDuplicateDayOpen}
        sourceDayKey={selectedDateKey}
        sourceMealCount={mealsForSelectedDate.length}
        onConfirm={(targetDayKeys, summary) => {
          if (targetDayKeys.length === 0) {
            toast(summary);
            return;
          }
          if (targetDayKeys.length === 1) {
            void duplicateDay(selectedDateKey, targetDayKeys[0]!);
          } else {
            void duplicateDayToDateRange(selectedDateKey, targetDayKeys);
          }
          toast.success(summary);
        }}
      />

      {/* Audit H4 (2026-04-18) — Save-combo dialog lifted out of
          QuickAddPanel so the host is the single owner. Opened via
          `handleOpenSaveCombo` (the meal-slot chip + the panel's
          `onOpenSaveCombo` prop both fire it). */}
      <SaveMealDialog
        open={saveComboOpen}
        onOpenChange={setSaveComboOpen}
        initialItems={saveComboSeedItems}
        defaultSlot={saveComboDefaultSlot}
        onSave={handleCreateSavedMeal}
        suggestedName={saveComboSuggestedName}
      />

      {/* 2026-04-30 (web mobile-web parity with mobile commit
          `6633d2d`): the side FAB (formerly a `LogFab` at right:18 /
          bottom:100, `md:hidden`) was removed. The canonical Log entry
          point on mobile-web is now the centered raised Plus button
          in the bottom `<nav>` (App.tsx), mirroring the mobile
          `<SupprTabBar>` raised-button slot. Desktop web (≥ md) has
          no FAB per D-2026-04-27-11 — desktop layout is unchanged.
          Tapping the raised button stamps `?openLog=1` on the URL;
          the `useEffect` above (search-param consumer) opens the
          `<LogSheet>` and clears the param. */}

      {/* Phase 3 / B2.1 (D-2026-04-27-15) — canonical LogSheet.
          The 6 sub-tabs are presentation-only; tabs that need full
          flows (search, barcode, voice, photo) close the sheet and
          delegate to the existing dialog state machines so the
          underlying logic stays canonical. The Search tab here is the
          "two-tap" entry per spec — picking it routes to the full
          `<FoodSearch>` modal (which handles custom foods, recents,
          etc.). */}
      {/* Search-first LogSheet (Next-10 #12, 2026-04-28). Phase-3
          6-tab strip removed; search is the always-visible primary
          input with right-edge icons (scan / voice / photo) routing
          to dedicated modals. Recent + Saved render inline via the
          2-pill toggle below. "Or add manually" footer routes to the
          quick-add path. */}
      <LogSheet
        open={logSheetOpen}
        onOpenChange={setLogSheetOpen}
        confirmation={logSheetConfirmation ?? undefined}
        initialQuery={logSheetInitialQuery}
        showBarcodeFreePromise
        // ENG-773 — log-time meal-slot selector (web parity with mobile
        // `apps/mobile/app/(tabs)/index.tsx`). Flag-gated visual element
        // (CLAUDE.md): the picker row is new structure so it ships behind
        // `log-sheet-slot-selector`. `mealSlot` is still threaded through
        // every commit path regardless of the flag — flag-off is
        // identical to pre-ENG-773 (slot stays a hidden clock guess).
        slot={
          isFeatureEnabled("log-sheet-slot-selector")
            ? {
                current: mealSlot,
                options: enabledMealSlots,
                onChange: setMealSlot,
              }
            : undefined
        }
        // Phase 4 / B3.Y — desktop modal mode kicks in at ≥1024px.
        desktop={isDesktop}
        search={{
          // 2026-04-30 (web parity with mobile commit `1968953`) —
          // INLINE-SEARCH MODE. Wiring `onSelect` flips `<LogSheet>`
          // from the legacy "tap a button to open the FoodSearch
          // dialog" pattern to a real `<Input>` that types directly
          // into a mounted `<FoodSearchPanel>`. The same panel the
          // dialog uses, just in `mode="compact"` for the LogSheet's
          // tighter vertical budget. Budget context + custom-foods
          // wiring are the same as the dialog so fit-this-in lights
          // up and Custom foods surface at the top.
          //
          // After a successful pick the panel emits the canonical
          // `FoodSearchSelection`; we commit it through the shared
          // `commitFoodSearchSelection` helper (same path the dialog
          // uses) and close the sheet.
          macroTargets: {
            calories: effectiveCalorieTarget,
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
          supabase,
          userId: authedUserId ?? null,
          logDateKey: selectedDateKey,
          // History-first search (ENG-1033, MFP grammar): the user's logging
          // history, newest-first, threaded into the inline panel so the
          // typed-query "Past logged" group ranks matching past logs above
          // database results. 50-row window + `count` for the recency-
          // weighted-frequency rank. HealthKit-import fallback rows stripped
          // (mobile parity).
          recentFoods: computeRecentMeals(nutritionByDay, 50)
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
          onSelect: (selection) => {
            const result = commitFoodSearchSelection(selection);
            presentLogSheetConfirmation({
              title: result.title,
              kcal: result.kcal,
              mealIds: [result.id],
            });
          },
          onAddToBasket: (selection) => {
            setLogBasket((prev) => [
              ...prev,
              { basketId: newId("basket"), selection },
            ]);
          },
        }}
        goTos={
          logSheetGoTos.length > 0
            ? {
                entries: logSheetGoTos,
                onPick: (entry) => {
                  const item = computeSlotGoToFoods(
                    nutritionByDay,
                    normaliseMealSlot(mealSlot) ?? "Snacks",
                  ).find((i) => foodHistoryKey(i.recipeTitle, i.calories) === entry.id);
                  if (!item) return;
                  logHistoryItemFromSheet(item, mealSlot);
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
          // Click the scan icon → close LogSheet, open the barcode
          // scanner. Web uses the existing BarcodeScannerDialog
          // pattern via the FoodSearch modal's barcode tab today;
          // until a dedicated dialog ships, route to FoodSearch
          // (which has the barcode + manual-entry path wired).
          onOpen: () => {
            setLogSheetOpen(false);
            setFoodSearchOpen(true);
          },
        }}
        recent={{
          // P0-2b (2026-04-28) — hydrate from food-history. Recent is
          // capped at 12 rows; bucket "today" / "week" splits by
          // last-logged date so the LogSheet renders two groups.
          entries: (() => {
            const todayKey = dateKeyFromDate(new Date());
            // Mobile parity: strip HealthKit-import fallback rows
            // (legacy "Food log (NNN kcal)" + new "<Source> entry · NNN kcal")
            // so Recents doesn't fill with identical-looking,
            // low-information entries. Source of truth:
            // `src/lib/nutrition/healthImportLabels.ts`. Inline regex
            // replaced 2026-05-03 (N1) — the predicate now matches both
            // legacy and new fallback shapes so existing TestFlight user
            // data + new builds both stay filtered.
            // Favourites-first (teardown #1, ENG-1041): on web the empty-query
            // recent strip lives in this LogSheet browse tab (not the panel),
            // so the favourites-first ordering is applied here via the shared
            // `orderRecentWithFavoritesFirst`. The RecentList partitions into
            // today/week buckets; this lifts starred rows ahead within each.
            return orderRecentWithFavoritesFirst(
              computeRecentMeals(nutritionByDay, 12).filter(
                (item) => !isHealthImportFallbackTitle(item.recipeTitle),
              ),
              favoriteKeySetForRecent,
            ).map((item) => ({
              id: foodHistoryKey(item.recipeTitle, item.calories),
              title: item.recipeTitle,
              kcal: Math.round(item.calories),
              source: mapMealSourceToDot(item.source),
              bucket: (item.lastLoggedAt ?? "").startsWith(todayKey)
                ? ("today" as const)
                : ("week" as const),
            }));
          })(),
          onPick: (picked) => {
            const recent = computeRecentMeals(nutritionByDay, 12);
            const found = recent.find(
              (i) => foodHistoryKey(i.recipeTitle, i.calories) === picked.id,
            );
            if (!found) return;
            logHistoryItemFromSheet(found, mealSlot);
          },
        }}
        saved={{
          // P0-2a (2026-04-28) — hydrate from the host's saved-meal
          // list. Each SavedMeal becomes a LogSheetSavedMeal preview
          // row; onPick closes the LogSheet and logs into the current
          // time-of-day slot via the shared logSavedMeal handler.
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
            setLogSheetOpen(false);
            const meal = hostSavedMeals.find((m) => m.id === picked.id);
            if (!meal) return;
            // 2026-05-08 build-47 fix — same reason as recents
            // above: respect the user's slot choice (mealSlot). The
            // saved-meal's defaultMealSlot was its preference at save
            // time; the user has now explicitly picked a slot to log into.
            logSavedMeal(meal, mealSlot);
          },
          // ENG-776 — SaveMealDialog entry from the Saved tab.
          onCreateSavedMeal: () => {
            setLogSheetOpen(false);
            openSaveMealDialog(mealSlot);
          },
        }}
        library={{
          // 2026-05-01 (TestFlight Build 40 feedback `AECfotBlQgwfgxYHr4dDaM8`
          // + "no way to add from library here") -- surface the user's
          // saved recipes inline in the LogSheet so a one-tap log no
          // longer requires routing through Recipes -> Library ->
          // Detail. Mobile parity:
          // `apps/mobile/app/(tabs)/index.tsx` `library={{...}}`.
          recipes: savedRecipesForLibrary.map((r) => ({
            id: r.id,
            title: r.title,
            kcalPerPortion: Math.round(r.calories ?? 0),
            thumbnail: r.image ?? null,
            mealTag: r.mealSlots
              ? (journalSlotFromMealTypes(r.mealSlots as string[]) as
                  | "Breakfast"
                  | "Lunch"
                  | "Dinner"
                  | "Snacks")
              : null,
          })),
          onPick: async (picked) => {
            const recipe = savedRecipesForLibrary.find((r) => r.id === picked.id);
            if (!recipe) return;
            setLogSheetOpen(false);
            // Route through the shared planned-meal-log path so the
            // macro-coercion guard (P0-3 / T4) fires identically to
            // Recipe -> Add to today and Planner row -> Log: a recipe
            // with kcal but no ingredient-resolved P/C/F is refused
            // with the Verify prompt.
            const microsRes = await fetchPlannedMealMicros(
              supabase as unknown as SupabaseLike,
              recipe.id,
              1,
            );
            if (microsRes.macrosAreCoerced) {
              if (typeof window !== "undefined") {
                window.alert(
                  "Verify this recipe first.\n\nThis recipe has calories but no ingredient macros yet. Logging now would save estimated values. Open the recipe and tap Verify to match ingredients for accurate nutrition.",
                );
              }
              return;
            }
            // 2026-05-08 build-47 fix — same reason as recents
            // and saved above: respect the user's slot choice (mealSlot).
            // The recipe's own meal_type was a soft tag; the user has
            // explicitly picked a slot.
            const slot = mealSlot as MealSlot;
            const timeLabel = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
            addLoggedMealForDate(
              selectedDateKey,
              {
                name: slot,
                recipeTitle: recipe.title,
                time: timeLabel,
                calories: Math.round(recipe.calories ?? 0),
                protein: Math.round((recipe.protein ?? 0) * 10) / 10,
                carbs: Math.round((recipe.carbs ?? 0) * 10) / 10,
                fat: Math.round((recipe.fat ?? 0) * 10) / 10,
                ...(microsRes.fiberG != null ? { fiberG: microsRes.fiberG } : {}),
                ...(Object.keys(microsRes.micros).length > 0 ? { micros: microsRes.micros } : {}),
                source: "Recipe",
              },
              "recipe",
            );
            try {
              toast.success(`Logged ${recipe.title} to ${slot}.`);
            } catch {
              /* toast availability is not a blocker for the journal write */
            }
          },
          onBrowseRecipes: () => {
            // Route to the in-app Recipes / Library page so the user
            // can save more recipes when their list is empty.
            setLogSheetOpen(false);
            trackerRouter.push("/recipes");
          },
        }}
        describe={
          isFeatureEnabled("log_sheet_nl_text_v1")
            ? {
                locked: userTier !== "pro",
                onPaywall: () => setAiPaywallFeature("voice_log"),
                onParse: (text) => parseMealDescriptionTranscript({ transcript: text }),
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
            // voice flow. Free + base tier users open the AI paywall
            // dialog; Pro users get the real voice flow.
            setLogSheetOpen(false);
            if (userTier === "pro") {
              setVoiceLogOpen(true);
            } else {
              setAiPaywallFeature("voice_log");
            }
          },
          // Pro-gated — surface the lock badge for free + base.
          locked: userTier !== "pro",
        }}
        photo={{
          onCapture: () => {
            // 2026-05-02 — photo-log opens for any tier; the dialog's free-taster
            // line + 403 handoff route to the AiPaywallDialog on quota exhaustion.
            setLogSheetOpen(false);
            setPhotoLogOpen(true);
          },
          locked: false,
        }}
        aiMethodTooltipVisible={aiMethodTooltipVisible}
        onAddManually={() => {
          // Footer "Or add manually" → close LogSheet, open the
          // TodayAddMealDialog (web's quick-add dialog). Mirrors the
          // mobile addOpen path.
          setLogSheetOpen(false);
          setAddOpen(true);
        }}
        copyYesterday={
          // ENG-1247: when the LogHub quick-action row is on, copy-yesterday
          // lives inside `quickActions` instead — suppress the standalone
          // row so the action never ships twice.
          isFeatureEnabled("loghub_quick_actions_v1")
            ? null
            : (() => {
                if (selectedDateKey !== todayKey() || mealsForSelectedDate.length > 0) return null;
                const count = (nutritionByDay[previousDayKey(selectedDateKey)] ?? []).length;
                if (count === 0) return null;
                return { count, onTap: handleCopyYesterday };
              })()
        }
        quickActions={
          // ENG-1247 — v3 LogHub quick-action row (Log usual / Copy
          // yesterday / Duplicate day). Each entry is omitted when its
          // action isn't resolvable, so the row renders no dead buttons.
          // Mirror of the mobile wiring in `(tabs)/_today/TodayScreen.tsx`.
          isFeatureEnabled("loghub_quick_actions_v1")
            ? (() => {
                const isToday = selectedDateKey === todayKey();
                // "Log usual" — top saved meal for the active slot
                // (slot-match → max logCount → latest lastLoggedAt →
                // overall fallback). Hidden when there are 0 saved meals.
                const usual = selectUsualSavedMeal(hostSavedMeals, mealSlot);
                const logUsual = usual
                  ? {
                      mealName: usual.name,
                      onTap: () => {
                        setLogSheetOpen(false);
                        const pick = selectUsualSavedMeal(hostSavedMeals, mealSlot) ?? usual;
                        logSavedMeal(pick, mealSlot);
                      },
                    }
                  : undefined;

                // "Copy yesterday" — same gate as the legacy row.
                const copyCount =
                  isToday && mealsForSelectedDate.length === 0
                    ? (nutritionByDay[previousDayKey(selectedDateKey)] ?? []).length
                    : 0;
                const copyYesterdayAction =
                  copyCount > 0
                    ? { count: copyCount, onTap: handleCopyYesterday }
                    : undefined;

                // "Duplicate day" — only when today has ≥1 logged meal.
                const duplicateDayAction =
                  mealsForSelectedDate.length > 0
                    ? {
                        onTap: () => {
                          setLogSheetOpen(false);
                          setDuplicateDayOpen(true);
                        },
                      }
                    : undefined;

                if (!logUsual && !copyYesterdayAction && !duplicateDayAction) {
                  return null;
                }
                return {
                  ...(logUsual ? { logUsual } : {}),
                  ...(copyYesterdayAction ? { copyYesterday: copyYesterdayAction } : {}),
                  ...(duplicateDayAction ? { duplicateDay: duplicateDayAction } : {}),
                };
              })()
            : null
        }
      />

    </div>
  );
});
