import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WifiOff } from "lucide-react";

import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import { normalizeMacroTargets } from "../../types/profile.ts";
import { useNutritionTrackerProfile } from "../../lib/nutrition/useNutritionTrackerProfile.ts";
import { computeActivityBonusKcal } from "../../lib/nutrition/activityBonus.ts";
import { scaleMacroTargetsForCalorieBudget } from "../../lib/nutrition/scaleMacroTargetsForCalorieBudget.ts";
import {
  resolveEffectiveDayTargets,
  type WeekdayIndex,
} from "../../lib/nutrition/dayTargetSchedule.ts";
import { previousDayKey } from "../../lib/nutrition/copyYesterdayMeals.ts";
import { useLogSheetFoodCommits } from "../../lib/nutrition/useLogSheetFoodCommits.ts";
import { ACTIVITY_BUDGET_DISCOVERABILITY_KEY } from "../../lib/nutrition/activityBudgetDiscoverability.ts";
import { useAiMethodTooltip } from "../../lib/today/useAiMethodTooltip.ts";
// Weekly TDEE check-in ritual (PR claude/weekly-checkin-ritual-v2,
// 2026-05-02 — rebuild of #26). Web parity of the mobile modal.
import {
  buildWeeklyCheckinContent,
  shouldShowWeeklyCheckin,
  type WeeklyCheckinContent,
} from "../../lib/nutrition/weeklyCheckin.ts";
import { WeeklyCheckinDialog } from "./suppr/weekly-checkin-dialog";
import { WhyThisNumberDialog } from "./suppr/why-this-number-dialog.tsx";
import { paceKgPerWeekFromPreset, whyThisNumberGoalFromDb } from "../../lib/nutrition/whyThisNumber.ts";
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
import { computeLoggingStreak } from "../../lib/nutrition/trackerStats.ts";
import { computeProtectedStreak } from "../../lib/nutrition/streakFreeze.ts";
import { useStreakResetCopy } from "../../lib/nutrition/useStreakResetCopy.ts";
import {
  normalizeWeekSummaryMode,
  weekSummaryDateKeys,
} from "../../lib/nutrition/weekSummaryWindow.ts";
import { clampPortionMultiplier, scaledMacro } from "../../lib/nutrition/portionMultiplier.ts";
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
import { useBarcodeLogging } from "./suppr/use-barcode-logging";
import { LogSheet } from "./suppr/log-sheet";
// Phase 4 / B3.Y — desktop modal mode for the LogSheet.
import { useIsDesktop } from "./ui/use-mobile";
import { NorthStarBlockHost } from "./suppr/north-star-block-host";
import { type NorthStarRecipe } from "../../lib/nutrition/northStarSuggestion";
import { buildPostLogSuggestion } from "../../lib/nutrition/postLogSuggestion";
import { dayActivityBudgetAddonWeb } from "../../lib/nutrition/trackerLocalState.ts";
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
import { MacroDetailPanel, isMacroDetailSupported } from "./MacroDetailPanel";
import { TodaySnapShortcut } from "./suppr/today-snap-shortcut";
import { TodayMealsSection } from "./suppr/today-meals-section";
import { TodayRecentsRow } from "./suppr/today-recents-row";
import { MealNutritionDialog } from "./suppr/meal-nutrition-dialog";
import { EditMealDialog } from "./suppr/edit-meal-dialog";
import { TodayFirstMealEmptyState } from "./suppr/today-first-meal-empty-state";
import { TodayCompleteDayDialog } from "./suppr/today-complete-day-dialog";
import { TodayAddMealDialog } from "./suppr/today-add-meal-dialog";
import { FoodSearch, type FoodSearchSelection } from "./FoodSearch.tsx";
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
} from "../../lib/nutrition/foodHistory";
import { computeSlotGoToFoods } from "../../lib/nutrition/slotGoToFoods";
import { normaliseMealSlot } from "../../lib/nutrition/mealSlots";
import { newId } from "../../context/appData/persistence";
import { isHealthImportFallbackTitle } from "../../lib/nutrition/healthImportLabels";
import { mapMealSourceToDot } from "../../lib/nutrition/sourceMap";
import { selectUsualSavedMeal } from "../../lib/nutrition/savedMealsLogic";
import { persistEntryIngredientSnapshot } from "../../lib/nutrition/nutritionEntryIngredients";
import { useMacroDetailPanelData } from "../../lib/nutrition/useMacroDetailPanelData.ts";
import { useTrackerWeekData } from "../../lib/nutrition/useTrackerWeekData.ts";
import { orderRecentWithFavoritesFirst } from "../../lib/nutrition/favoriteFoodsSearch";
import { type MealSlot } from "../../lib/nutrition/mealSlots";
import {
  enabledMealSlotLabels,
  mealSectionSortOrder,
} from "../../lib/nutrition/userMealSlotConfig";
import {
  journalSlotFromMealTypes,
  slotForHour,
} from "../../lib/nutrition/recipeJournalSlot";
import { useSavedMealsAndFavorites } from "./suppr/use-saved-meals-and-favorites";
import {
  parseDateKey,
  shiftDateKey,
  todayKey,
  clampDateKey,
  formatDateLabel,
  mealsSectionTitle,
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
// must reset `mealSlot` to a fresh time-of-day default. `slotForHour`
// comes from the shared `recipeJournalSlot` ladder — web and mobile
// must bucket the same clock time into the same slot.

interface NutritionTrackerProps {
  userTier: UserTier;
  onOpenProgress?: () => void;
  onOpenSettings?: () => void;
  /** ENG-1495 — extra desktop-rail card(s) the TodayDesktopFrame appends
   *  into `TodayDesktopRightRail` (the tracker's OWN single rail). */
  railExtra?: ReactNode;
}

export const NutritionTracker = memo(function NutritionTracker({
  userTier,
  onOpenProgress,
  onOpenSettings,
  railExtra,
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

  const { authedUserId, authUserCreatedAt } = useAuthSession();
  // ENG-1360 (first extraction pass) — the profiles-row fetch (weight,
  // goal, TDEE/maintenance, activity basics, meal-slot config, steps,
  // fasting, streak-freeze ledger, tracked macros, weekly check-in
  // shown-at) moved to `useNutritionTrackerProfile`. Same query, same
  // parsing, same setters — just relocated so this component's local
  // state list shrinks. `useAuthSession()` moved up alongside it
  // (previously declared much further down the component) so
  // `authedUserId` is available before this call and before the several
  // early memos (`enabledMealSlots`, `protectedStreakInfo`, etc.) that
  // read this hook's outputs.
  const {
    weekStartDay,
    freezeLedger,
    freezeBudgetMax,
    trackedDashboardMacros,
    userMealSlotConfig,
    stepsByDay,
    dailyStepsGoal,
    fastingSessions,
    fastingOptedIn,
    profileWeightKg,
    profileGoal,
    profilePlanPace,
    profileMaintenanceTdee,
    profileWeightKgByDay,
    weeklyCheckinShownAt,
    setWeeklyCheckinShownAt,
    profileFormulaTdee,
    profileAdaptiveTdeeRaw,
    profileAdaptiveTdeeConfidenceRaw,
    profileMaintenanceSource,
    profileMaintenanceConfidence,
    profileSex,
    profileHeightCm,
    profileAge,
    profileActivityLevel,
  } = useNutritionTrackerProfile(authedUserId);

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
  const [editMealTargetId, setEditMealTargetId] = useState<string | null>(null);
  /** Batch 1.4 — Duplicate day dialog visibility. */
  const [duplicateDayOpen, setDuplicateDayOpen] = useState(false);
  const [mealSlot, setMealSlot] = useState("Breakfast");
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

  // ENG-1360 (second extraction pass) — the macro-detail panel state,
  // meal-projection memo, and the two Supabase fetch effects (recipe
  // ingredients + persisted AI snapshot rows) moved to
  // `useMacroDetailPanelData`. Same queries, same parsing, same setters —
  // just relocated so this component's local state list shrinks.
  const {
    macroDetailFlagEnabled,
    macroDetailTarget,
    setMacroDetailTarget,
    macroDetailMeals,
    macroDetailIngredientRows,
    macroDetailSnapshotRows,
    openMacroDetail,
    macroTapFromDialog,
  } = useMacroDetailPanelData(mealsForSelectedDate, isMacroDetailSupported);

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
  // Phase 3 / B2.1 (D-2026-04-27-15) — canonical LogSheet open state.
  // The web LogSheet wires its sub-tabs to existing flows (FoodSearch
  // dialog, barcode dialog, voice dialog, photo dialog) rather than
  // re-implementing them. Opening the sheet replaces the Phase 2
  // "Coming in Phase 3" alert path.
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [logSheetConfirmation, setLogSheetConfirmation] = useState<
    NonNullable<React.ComponentProps<typeof LogSheet>["confirmation"]> | null
  >(null);
  useEffect(() => {
    if (!logSheetOpen) {
      setLogSheetConfirmation(null);
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
  // ENG-1360 — the barcode-scan → custom-food-save fallback →
  // community-share opt-in → saved-ack dialog cluster (all local state +
  // the four dialogs) moved to `useBarcodeLogging` below, near where
  // `mealSlot`/`timeLabel`/`addLoggedMeal` are available.
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
  // ENG-1360 (first extraction pass) — barcode-scan → custom-food-save
  // fallback → community-share opt-in → saved-ack dialog cluster. Same
  // four dialogs, same state, same handlers as before — just relocated.
  const { dialogs: barcodeDialogs } = useBarcodeLogging({
    authedUserId,
    mealSlot,
    onMealSlotChange: setMealSlot,
    timeLabel,
    addLoggedMeal,
    onOpenPhotoFallback: () => setPhotoLogOpen(true),
  });
  const [aiPaywallFeature, setAiPaywallFeature] = useState<AiPaywallFeature | null>(null);
  const [completeDayOpen, setCompleteDayOpen] = useState(false);
  const [whyThisNumberOpen, setWhyThisNumberOpen] = useState(false);
  /** Full-nutrient panel sheet (PR #47, re-wired 2026-05-02) — opened
   *  from the "View all N nutrients" pill inside
   *  `TodayDashboardMacroTiles` after the Today-canvas
   *  `TodayMicrosWidget` was removed (revert PR #30). */
  const [fullNutrientPanelOpen, setFullNutrientPanelOpen] = useState(false);
  // Weekly TDEE check-in ritual (PR claude/weekly-checkin-ritual-v2,
  // 2026-05-02 — rebuild of #26). Mirrors mobile state shape.
  // `weeklyCheckinHandledRef` suppresses re-fires within the session.
  const [weeklyCheckinOpen, setWeeklyCheckinOpen] = useState(false);
  const [weeklyCheckinContent, setWeeklyCheckinContent] =
    useState<WeeklyCheckinContent | null>(null);
  const weeklyCheckinHandledRef = useRef(false);
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
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
  // Batch 4.11 — streak freeze state (`freezeLedger` / `freezeBudgetMax`
  // now come from `useNutritionTrackerProfile` above — loaded from
  // `profiles` alongside `week_start_day`; budget defaults to 3).
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
  // L6 G8 + ENG-1504 (mobile parity, DC8) — `streak_reset` fire-once
  // analytics + the sticky supportive-copy flag ("Every expert was once a
  // beginner…" under the day strip). Extracted hook mirrors mobile
  // `useTodayStreakAndFreezes`.
  const streakJustReset = useStreakResetCopy(protectedStreakLength);
  // `stepsByDay` / `dailyStepsGoal` / `fastingSessions` / `fastingOptedIn`
  // now come from `useNutritionTrackerProfile` above.
  const [fastingNowTick, setFastingNowTick] = useState(() => Date.now());
  const calendarInputRef = useRef<HTMLInputElement>(null);
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

  // ENG-1360 (second extraction pass) — the saved-meals / favourites /
  // usual-meal-hint cluster (logHistoryItem, logSavedMeal, the save-combo
  // dialog + its state, hostSavedMeals/hostFavorites + optimistic favourite
  // toggle, the usual-meal-hint dismiss/shown tracking, and the pending-
  // usual-meal-save deep-link consumer) moved to `useSavedMealsAndFavorites`.
  // Same handlers, same analytics, same dependency arrays — just relocated
  // so this component's local state list and JSX both shrink.
  const {
    dialog: saveMealDialog,
    logHistoryItem,
    logSavedMeal,
    hostSavedMeals,
    hostFavorites,
    favoritePendingKeys,
    toggleFoodFavorite,
    favoriteKeySetForRecent,
    savedMealsRefreshToken,
    handleOpenSaveCombo,
    openSaveMealDialog,
    acceptUsualMealHint,
    logSavedMealFromSlotHeader,
    hintVisibleForSlot,
    dismissUsualMealHint,
  } = useSavedMealsAndFavorites({
    authedUserId,
    mealSlot,
    selectedDateKey,
    nutritionByDay,
    mealsForSelectedDate,
    addLoggedMeal,
    addLoggedMealForDate,
  });

  useEffect(() => {
    const id = setInterval(() => setFastingNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ENG-1360 — the profiles-row fetch + `refreshTrackedDashboardMacros`
  // visibility-change refetch that used to live here both moved to
  // `useNutritionTrackerProfile` (called near the top of this component).

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

  const presentLogSheetConfirmation = useCallback(
    (payload: {
      title: string;
      kcal: number;
      mealIds: string[];
      /** ENG-1502 — per-item trust bit; absent = honest `~` (ENG-1417). */
      kcalIsVerified?: boolean;
    }) => {
      setLogSheetConfirmation({
        title: payload.title,
        kcal: Math.round(payload.kcal),
        ...(payload.kcalIsVerified !== undefined
          ? { kcalIsVerified: payload.kcalIsVerified }
          : {}),
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

  // ENG-1502 (extraction pass, screen-budget ratchet) — the canonical
  // food-search commit + the history re-log moved to
  // `useLogSheetFoodCommits`. The search commit threads the per-item
  // `kcalIsVerified` trust bit into the S13 confirmation; the history
  // path always presents the honest `~` (journal rows don't persist the
  // ENG-1417 trust bit). Mobile mirror stays inline in `TodayScreen.tsx`.
  const { commitFoodSearchSelection, logHistoryItemFromSheet } =
    useLogSheetFoodCommits({
      selectedDateKey,
      mealSlot,
      timeLabel,
      addLoggedMealForDate,
      eatenAtForCurrentLog,
      presentLogSheetConfirmation,
    });

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

  // ENG-1360 (second extraction pass) — the week-strip/week-view data memo
  // (7-day bucketing + totals/averages/label) moved to `useTrackerWeekData`.
  // Same math, same dependency array — just relocated so this component's
  // local computation list shrinks.
  const weekData = useTrackerWeekData(
    selectedDate,
    nutritionByDay,
    weekStartDay,
    extraWaterByDay,
    stepsByDay,
  );

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

      {/* Streak pip (Phase 2 / B1.2, D-2026-04-27-07) — mobile-web only,
          right-aligned above the date header; suppressed on week-view.
          On desktop (`lg+`) the streak lives in the right rail's hero
          card, so a second pip here would double-render the same fact. */}
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
        streakResetCopyVisible={streakJustReset}
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
        // ENG-1372 — fresh-day pill: TODAY with zero entries only (a past
        // empty day is a gap, not a fresh start); reuses the openLog slot reset.
        isFreshDay={selectedDateKey === todayKey() && mealsForSelectedDate.length === 0}
        onLogFreshDaySlot={() => {
          setMealSlot(slotForHour(new Date().getHours()));
          setLogSheetOpen(true);
        }}
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

      {/* TodayStreakInsightCard removed (ENG-1596, 2026-07-19) — the
          component itself is deleted (both platforms). Streak logic
          still runs but is no longer surfaced on Today. */}

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
      {/* Quick add panel — Usual meals / Recent / Frequent / Favourites tabs
          with one-tap log; `SaveMealDialog` is hosted here. Collapsed behind a
          single "Quick add" CTA above Meals (default collapsed first run; the
          user's last choice persists via `suppr-quick-add-collapsed-v1`). */}

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
          consumedCalories={totals.calories} localHour={new Date().getHours()} /* ENG-1454 */
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
        title={mealsSectionTitle(selectedDateKey, todayKey())}
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
        loggedDays.size === 0 &&
        !isFeatureEnabled("empty_state_grammar_v1") && (
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
            weekAvgKcal={(isFeatureEnabled("empty_state_grammar_v1") ? weekData.loggedDaysInWeek >= 3 : weekData.loggedDaysInWeek > 0) ? weekData.weekAvg.calories : null}
            streakDays={streakDays}
            activeDateKey={selectedDateKey}
            todayDateKey={todayKey()}
            byDay={nutritionByDay}
            onSelectDayKey={(k) => setSelectedDateKey(k)}
            railExtra={railExtra}
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
        source={isFeatureEnabled("energy_numbers_v1") ? profileMaintenanceSource : null /* ENG-1506 review round — flag-ON provenance: formula never renders "learned from your logging"; OFF null = legacy wording */}
        loggingDays={null}
        goal={whyThisNumberGoalFromDb(profileGoal)} // ENG-1507 — shared normaliser; unknown goal → "Goal not set", never "lose"
        paceKgPerWeek={paceKgPerWeekFromPreset(profilePlanPace, whyThisNumberGoalFromDb(profileGoal))}
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

      {/* ENG-1360 — barcode-scan → custom-food-save fallback →
          community-share opt-in → saved-ack dialog cluster, extracted to
          `useBarcodeLogging`. Same four dialogs, same behavior. */}
      {barcodeDialogs}

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
          `onOpenSaveCombo` prop both fire it). Rendered by
          `useSavedMealsAndFavorites` (ENG-1360 second extraction pass). */}
      {saveMealDialog}

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
              // ENG-1502 — verified DB hits drop the `~`; everything else keeps it.
              kcalIsVerified: result.kcalIsVerified,
            });
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
                    // ENG-1502 — AI-parsed description = an estimate by
                    // construction; never claims the verified grammar.
                    kcalIsVerified: false,
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
