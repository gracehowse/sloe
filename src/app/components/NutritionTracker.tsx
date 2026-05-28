import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WifiOff } from "lucide-react";

import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import { normalizeMacroTargets, DEFAULT_STEPS_GOAL } from "../../types/profile.ts";
import { resolveMaintenance } from "../../lib/nutrition/resolveMaintenance.ts";
import { computeActivityBonusKcal } from "../../lib/nutrition/activityBonus.ts";
import { isPerServingPortion } from "../../lib/nutrition/foodSearchCore.ts";
import { ACTIVITY_BUDGET_DISCOVERABILITY_KEY } from "../../lib/nutrition/activityBudgetDiscoverability.ts";
// Weekly TDEE check-in ritual (PR claude/weekly-checkin-ritual-v2,
// 2026-05-02 — rebuild of #26). Web parity of the mobile modal.
import {
  buildWeeklyCheckinContent,
  shouldShowWeeklyCheckin,
  type WeeklyCheckinConfidence,
  type WeeklyCheckinContent,
} from "../../lib/nutrition/weeklyCheckin.ts";
import { WeeklyCheckinDialog } from "./suppr/weekly-checkin-dialog";
import type { RecipeCard, UserTier } from "../../types/recipe.ts";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { fetchPlannedMealMicros, type SupabaseLike } from "../../lib/planning/plannedMealMicros.ts";
import { useAuthSession } from "../../context/AuthSessionContext.tsx";
import { AnalyticsEvents, type FoodLoggedSource } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";
import { type OffProductMacros } from "../../lib/openFoodFacts/fetchProductByBarcode.ts";
import { computeLoggingStreak } from "../../lib/nutrition/trackerStats.ts";
import {
  computeProtectedStreak,
  readFreezeLedger,
  type FreezeLedger,
} from "../../lib/nutrition/streakFreeze.ts";
import { didStreakReset } from "../../lib/nutrition/streakReset.ts";
import {
  MISSED_YESTERDAY_COPY,
  shouldShowMissedYesterday,
} from "../../lib/nutrition/missedYesterday.ts";
import {
  normalizeWeekSummaryMode,
  weekSummaryDateKeys,
} from "../../lib/nutrition/weekSummaryWindow.ts";
import { scaleCaffeineAlcohol } from "../../lib/nutrition/scaleCaffeineAlcoholForGrams.ts";
import { scaleMicrosPerServing } from "../../lib/nutrition/scaleMicrosPerServing.ts";
import { scaleMicrosForGrams } from "../../lib/openFoodFacts/parseOffMicros.ts";
import { clampPortionMultiplier, scaledMacro } from "../../lib/nutrition/portionMultiplier.ts";
import { formatWaterMl } from "../../lib/units/imperial.ts";
import {
  buildDayNutrientDetailRows,
  mealContributedFiberG,
  sumMicrosFromLoggedMeals,
} from "../../lib/nutrition/microNutrientDisplay.ts";
import { normalizeJournalSlotName } from "../../lib/nutrition/journalSlot.ts";
import { type CalorieRingDisplayMode } from "./suppr/daily-ring";
import { QuickAddPanel } from "./suppr/quick-add-panel";
import { CopyMealDialog } from "./suppr/copy-meal-dialog";
import { DuplicateDayDialog } from "./suppr/duplicate-day-dialog";
import { HydrationStimulantsCard } from "./suppr/hydration-stimulants-card";
import { StreakPip } from "./suppr/streak-pip";
// `<LogFab>` (./suppr/log-fab) is no longer rendered on mobile-web.
// The canonical Log entry point is now the centered raised Plus
// button in the mobile-web `<nav>` (App.tsx), mirroring the mobile
// `<SupprTabBar>` + `<LogTabBarButton>` pattern from commit
// `6633d2d`. The component file is preserved for now (deferred
// deletion) so any external reference (tests, type imports) keeps
// resolving until a follow-up sweep.
import { LogSheet } from "./suppr/log-sheet";
// Phase 4 / B3.Y — desktop modal mode for the LogSheet.
import { useIsDesktop } from "./ui/use-mobile";
import { NorthStarBlock } from "./suppr/north-star-block";
import {
  pickNorthStarSuggestion,
  detectSlotForHour,
  ctaForSlot,
  bandLabel,
  whyLineForSuggestion,
  isLibraryEligibleForNorthStar,
  type NorthStarRecipe,
} from "../../lib/nutrition/northStarSuggestion";
import { VoiceLogDialog } from "./suppr/voice-log-dialog";
import { PhotoLogDialog } from "./suppr/photo-log-dialog";
import { AiPaywallDialog, type AiPaywallFeature } from "./suppr/ai-paywall-dialog";
import { TodayHeroStats } from "./suppr/today-hero-stats";
import { TodayWeekSidebar } from "./suppr/today-week-sidebar";
import { TodayDesktopRightRail } from "./suppr/today-desktop-right-rail";
import { TodayPlannedMealsCard } from "./suppr/today-planned-meals-card";
import { TodayEatAgainBanner } from "./suppr/today-eat-again-banner";
import { TodayFastingPill } from "./suppr/today-fasting-pill";
import { TodayStepsCard } from "./suppr/today-steps-card";
import { TodayActivityBonusCard } from "./suppr/today-activity-bonus-card";
import { TodayWeekView } from "./suppr/today-week-view";
import { TodayDashboardMacroTiles } from "./suppr/today-dashboard-macro-tiles";
import { TodayDashboardMacroBars } from "./suppr/today-dashboard-macro-bars";
import { useMacroDisplayStyle } from "../../lib/preferences/useMacroDisplayStyle";
import { FullNutrientPanelSheet } from "./suppr/full-nutrient-panel-sheet";
import { FULL_NUTRIENT_PANEL_ROW_COUNT } from "../../lib/nutrition/fullNutrientPanel";
import { TodaySnapShortcut } from "./suppr/today-snap-shortcut";
import { TodayMealsSection } from "./suppr/today-meals-section";
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
import { isBelowMealsPromptVisible } from "../../lib/today/belowMealsPromptSelection";
import { aiLoggingSourceLabel, type AiLoggedItem } from "../../lib/nutrition/aiLogging";
import {
  computeEatAgainForSlot,
  computeRecentMeals,
  foodHistoryKey,
  isAiSourcedFoodHistoryItem,
  type FoodHistoryItem,
} from "../../lib/nutrition/foodHistory";
import { isHealthImportFallbackTitle } from "../../lib/nutrition/healthImportLabels";
import { mapMealSourceToDot } from "../../lib/nutrition/sourceMap";
import { buildMealEntriesFromSavedMeal } from "../../lib/nutrition/savedMealsLogic";
import {
  createSavedMeal,
  incrementLogCount,
  listSavedMeals,
  type SavedMeal,
  type SavedMealItem,
} from "../../lib/nutrition/savedMeals";
import { isMealSlot, type MealSlot } from "../../lib/nutrition/mealSlots";
import { journalSlotFromMealTypes } from "../../lib/nutrition/recipeJournalSlot";
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
import {
  LEGACY_STORAGE_KEY_V1 as EAT_AGAIN_LEGACY_KEY_V1,
  STORAGE_KEY as EAT_AGAIN_STORAGE_KEY,
  readDismissState as readEatAgainDismiss,
  recordDismiss as recordEatAgainDismiss,
  serialiseDismissState as serialiseEatAgainDismiss,
  shouldShowEatAgain,
  type DismissState as EatAgainDismissState,
} from "../../lib/nutrition/eatAgainDismiss";
import { SaveMealDialog } from "./suppr/save-meal-dialog";
import { parseDateKey, shiftDateKey, todayKey, clampDateKey } from "../../lib/nutrition/trackerDate.ts";
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

const RECENT_BARCODE_KEY = "suppr-recent-foods-v1";

// 2026-05-08 build-47 follow-up — Grace TF: tapping "+ Breakfast" in
// the afternoon was logging picks as Snacks. Pick-handlers must use
// `mealSlot` (the user's choice), and the generic LogSheet-open paths
// must reset `mealSlot` to a fresh time-of-day default. Mobile parity:
// `apps/mobile/app/(tabs)/index.tsx` slotForHour.
function slotForHour(h: number): "Breakfast" | "Lunch" | "Snacks" | "Dinner" {
  if (h < 10) return "Breakfast";
  if (h < 14) return "Lunch";
  if (h < 17) return "Snacks";
  return "Dinner";
}

const MEAL_SECTION_ORDER = ["Breakfast", "Lunch", "Dinner", "Snacks", "Planned"];

/** Must match Settings “Dashboard widgets” keys (`WIDGET_MACRO_OPTIONS`). */
const TRACKED_DASHBOARD_MACRO_KEYS = new Set([
  "protein",
  "carbs",
  "fat",
  "fiber",
  "sugar",
  "sodium",
  "water",
]);

function normalizeTrackedDashboardMacros(raw: unknown): string[] {
  const fallback = ["protein", "carbs", "fat"];
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  const next = (raw as unknown[]).filter(
    (x): x is string => typeof x === "string" && TRACKED_DASHBOARD_MACRO_KEYS.has(x),
  );
  return next.length > 0 ? next : fallback;
}

type FastingSessionRow = { start: string; end: string | null };

function parseStepsDayMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n >= 0) out[k] = Math.round(n);
  }
  return out;
}

/**
 * Web call-site wrapper around `computeActivityBonusKcal`. See
 * `docs/decisions/2026-05-13-activity-bonus-projected-eod-model.md`
 * for rationale and `src/lib/nutrition/activityBonus.ts` for the
 * single-source-of-truth math.
 */
function dayActivityBudgetAddonWeb(
  prefer: boolean,
  dk: string,
  maintenance: number,
  activityByDay: Record<string, number>,
  basalByDay: Record<string, number>,
  workoutsByDay: Record<string, Array<{ calories?: number }>>,
): number {
  const workouts = workoutsByDay[dk] ?? [];
  return computeActivityBonusKcal({
    prefer,
    dateKey: dk,
    todayDateKey: todayKey(),
    restingKcal: basalByDay[dk] ?? 0,
    activeKcal: activityByDay[dk] ?? 0,
    maintenanceKcal: maintenance,
    workoutKcal: workouts.reduce((s, w) => s + (w.calories ?? 0), 0),
  });
}

interface NutritionTrackerProps {
  userTier: UserTier;
  onOpenProgress?: () => void;
  onOpenSettings?: () => void;
}

function loadRecentFoods(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_BARCODE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function pushRecentFood(name: string) {
  const prev = loadRecentFoods().filter((x) => x !== name);
  const next = [name, ...prev].slice(0, 8);
  localStorage.setItem(RECENT_BARCODE_KEY, JSON.stringify(next));
}

/**
 * NorthStarBlockHost — small wrapper that runs the suggestion picker
 * and selects which `<NorthStarBlock>` kind to render based on the
 * library size, remaining macros, and time-of-day slot.
 *
 * Authority: D-2026-04-27-04. Spec §A-northstar.
 * Lives in this file (rather than its own module) because it's a
 * thin glue layer with no logic worth testing in isolation —
 * everything testable is in `northStarSuggestion.ts` and the
 * presentational `<NorthStarBlock>`.
 */
/**
 * Phase 4 / B3.Y (2026-04-27) — per-day skipped-recipe set.
 *
 * Backed by localStorage so a swipe-to-skip survives a page reload.
 * Scoped by `selectedDateKey` so the set resets daily — yesterday's
 * skips don't shadow today's library.
 */
const NORTH_STAR_SKIP_KEY_PREFIX = "suppr.northstar.skipped.";

function readNorthStarSkippedSet(dateKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(NORTH_STAR_SKIP_KEY_PREFIX + dateKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s): s is string => typeof s === "string"));
  } catch {
    return new Set();
  }
}

function writeNorthStarSkippedSet(dateKey: string, set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      NORTH_STAR_SKIP_KEY_PREFIX + dateKey,
      JSON.stringify(Array.from(set)),
    );
  } catch {
    // Quota / disabled storage — silent failure is fine; the skip
    // simply doesn't persist past the in-memory state.
  }
}

function NorthStarBlockHost({
  viewMode,
  savedRecipesForLibrary,
  remainingCalories,
  remainingProtein,
  remainingCarbs,
  remainingFat,
  onPrimaryCta,
  onBrowseLibrary,
  selectedDateKey,
  userCreatedAt,
  hasEverLoggedAnyMeal,
}: {
  viewMode: string;
  savedRecipesForLibrary: NorthStarRecipe[];
  remainingCalories: number;
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
  /** Called when the user taps the primary CTA on the suggestion card.
   *  Receives the suggestion's recipe id so the parent can route
   *  directly (mobile) or open the log sheet (web — arg ignored). */
  onPrimaryCta: (recipeId: string) => void;
  onBrowseLibrary: () => void;
  /** Date scope for the skip ledger (Phase 4 / B3.Y). */
  selectedDateKey: string;
  /** ISO `created_at` for the auth user. Drives the activation-window
   *  threshold relax (audit 2026-04-30 round-2 leak fix #5). When the
   *  account is < 30 days old the library threshold drops from ≥5 to
   *  ≥2 so a new user with 2-3 saved recipes still sees a real
   *  suggestion, not the empty-state. */
  userCreatedAt?: string | null;
  /** ENG-94 (2026-05-13): true when the user has logged at least one
   *  meal across their entire history. When false, the host renders
   *  the `new-user` kind (calm "Log your first meal" card) instead
   *  of the algorithmic suggestion. Mirror of the mobile prop. */
  hasEverLoggedAnyMeal?: boolean;
}) {
  // Phase 4 / B3.Y — per-day skip ledger keyed by selected date.
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() =>
    readNorthStarSkippedSet(selectedDateKey),
  );

  // Reset the in-memory set when the day changes (and rehydrate from
  // localStorage so skips persist across reloads on the same day).
  useEffect(() => {
    setSkippedIds(readNorthStarSkippedSet(selectedDateKey));
  }, [selectedDateKey]);

  const handleSkip = useCallback(
    (recipeId: string) => {
      setSkippedIds((prev) => {
        const next = new Set(prev);
        next.add(recipeId);
        writeNorthStarSkippedSet(selectedDateKey, next);
        return next;
      });
    },
    [selectedDateKey],
  );

  if (viewMode !== "day") return null;

  // Over-budget — hide block, show calm caption.
  if (remainingCalories <= 0) {
    return <NorthStarBlock kind="over-budget" />;
  }

  // ENG-94 (2026-05-13): true day-1 user — no log history yet.
  // Render the calmer `new-user` card instead of an algorithmic
  // suggestion the algorithm has nothing to base on.
  if (hasEverLoggedAnyMeal === false) {
    return <NorthStarBlock kind="new-user" />;
  }

  // Library too small — invite the user to seed it.
  // Audit 2026-04-30 leak fix #5: threshold relaxes to ≥2 inside the
  // 30-day activation window (drops back to ≥5 once the account
  // matures). `userCreatedAt` is sourced from the auth session.
  if (
    !isLibraryEligibleForNorthStar(
      savedRecipesForLibrary.length,
      userCreatedAt,
    )
  ) {
    return <NorthStarBlock kind="library-empty" onOpenLibrary={onBrowseLibrary} />;
  }

  const now = new Date();
  const slot = detectSlotForHour(now.getHours() * 60 + now.getMinutes());
  const remaining = {
    calories: remainingCalories,
    protein: remainingProtein,
    carbs: remainingCarbs,
    fat: remainingFat,
  };

  const suggestion = pickNorthStarSuggestion(savedRecipesForLibrary, remaining, {
    slot: slot ?? undefined,
    excludeIds: skippedIds,
  });

  if (!suggestion) {
    return <NorthStarBlock kind="no-fit" onBrowse={onBrowseLibrary} />;
  }

  return (
    <NorthStarBlock
      kind="default"
      ctaLabel={ctaForSlot(slot)}
      suggestion={{
        recipeId: suggestion.recipe.id,
        title: suggestion.recipe.title,
        thumbnail: suggestion.recipe.thumbnail,
        predictedCalories: suggestion.predictedCalories,
        predictedProtein: suggestion.predictedProtein,
        predictedCarbs: suggestion.predictedCarbs,
        predictedFat: suggestion.predictedFat,
        bandLabel: bandLabel(suggestion.band),
        bandTight: suggestion.band === "tight",
        // Activation hook (audit 2026-04-30 — leak fix #5): expose
        // the strongest WHY (which macro the suggestion fits) so the
        // card stops reading as black-box. Mirror of mobile
        // NorthStarBlockHost. See `whyLineForSuggestion`.
        whyLine: whyLineForSuggestion(suggestion, remaining),
      }}
      onPrimaryCta={() => onPrimaryCta(suggestion.recipe.id)}
      onSkip={() => handleSkip(suggestion.recipe.id)}
    />
  );
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
  const {
    nutritionTargets,
    setNutritionTargets,
    selectedDateKey,
    setSelectedDateKey,
    mealsForSelectedDate,
    addLoggedMeal,
    addLoggedMealForDate,
    removeLoggedMeal,
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
    nutritionByDay,
    extraWaterByDay,
    notificationPrefs,
    profileDisplayName,
    authEmail,
    netCarbsLensEnabled,
  } = useAppData();
  // Suppress unused warning for caffeine-by-day (currently shown only via
  // today's number; weekly caffeine view is a separate roadmap item).
  void _extraCaffeineByDay;

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
  const [ringExpanded, setRingExpanded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  /** Batch 1.4 — meal row context menu: target meal id for the Copy dialog. */
  const [copyMealTargetId, setCopyMealTargetId] = useState<string | null>(null);
  /** Batch 1.4 — Duplicate day dialog visibility. */
  const [duplicateDayOpen, setDuplicateDayOpen] = useState(false);
  const [mealSlot, setMealSlot] = useState("Breakfast");
  const [recipeId, setRecipeId] = useState("");
  const [timeLabel, setTimeLabel] = useState("12:00 PM");
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
  useEffect(() => {
    if (openLogParam !== "1") return;
    // 2026-05-08 build-47 follow-up — generic `?openLog=1` deep-link is
    // not slot-specific. Reset mealSlot to time-of-day so the LogSheet
    // header + the pick-handlers default to the right slot. The
    // slot-specific `+ Breakfast` path (onOpenAddForSlot) overrides this.
    setMealSlot(slotForHour(new Date().getHours()));
    setLogSheetOpen(true);
    const params = new URLSearchParams(trackerSearchParams.toString());
    params.delete("openLog");
    const q = params.toString();
    trackerRouter.replace(q ? `/home?${q}` : "/home", { scroll: false });
  }, [openLogParam, trackerRouter, trackerSearchParams]);
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
  const [_profilePlanPace, setProfilePlanPace] = useState<string | null>(null);
  const [profileMaintenanceTdee, setProfileMaintenanceTdee] = useState<number | null>(null);
  const [_profileWeightKgByDay, setProfileWeightKgByDay] = useState<Record<string, number>>({});
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
    "adaptive" | "formula" | null
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
  /**
   * DC12 (2026-05-14, premium-bar audit) — web parity for the
   * mobile "missed-day" supportive banner. Renders only when the
   * user is on today's view, has prior history, logged nothing
   * yesterday, and it's not the first day of a fresh week (the
   * weekly-checkin nudge already covers Mon/Sun). Same voice rule
   * as mobile (no CTA, calm sub-line, no destructive tone).
   * Mobile companion lives in `apps/mobile/app/(tabs)/index.tsx`.
   */
  const missedYesterdayVisible = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = dateKeyFromDate(yesterday);
    const mealsYesterday = nutritionByDay[yKey] ?? [];
    return shouldShowMissedYesterday({
      isToday: selectedDateKey === todayKey(),
      hasAnyJournalHistory: loggedDays.size > 0,
      mealsYesterdayCount: mealsYesterday.length,
      todayDayOfWeek: new Date().getDay(),
      weekStartDay,
    });
  }, [selectedDateKey, loggedDays, nutritionByDay, weekStartDay]);
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
  const [ringDisplayMode, setRingDisplayMode] = useState<CalorieRingDisplayMode>("remaining");
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

  /** Infer the default meal slot from local clock time for Eat-again /
   * Quick Add defaults. Mirrors the mobile rule of thumb in
   * `apps/mobile/app/(tabs)/index.tsx` (shared `slotForHour`). */
  const currentSlotFromTime = useMemo(
    () => slotForHour(new Date().getHours()),
    [],
  );
  // Eat-again dismiss (audit L4, 2026-04-18). v2 shape stores
  // `{ dateKey, dismissedAt }` so a device clock rollback can't
  // resurrect the banner on the same real-world day. Reads migrate
  // v1 on the fly; writes always use v2.
  const [eatAgainDismissState, setEatAgainDismissState] = useState<EatAgainDismissState | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return readEatAgainDismiss(
        window.localStorage.getItem(EAT_AGAIN_STORAGE_KEY),
        window.localStorage.getItem(EAT_AGAIN_LEGACY_KEY_V1),
        new Date(),
      );
    } catch {
      return null;
    }
  });

  /** Suggestion for the "Eat again" card — previous-day meal in the
   * slot matching the current clock time. `null` disables the card. */
  const eatAgainSuggestion = useMemo(() => {
    return computeEatAgainForSlot(nutritionByDay, currentSlotFromTime, new Date());
  }, [nutritionByDay, currentSlotFromTime]);

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

  /** Log a history row (Favourite / Frequent / Recent / Eat again) into
   * the active meal slot. Shared by QuickAddPanel + Eat-again card so
   * the event shape is consistent. */
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
      // F-13 daily bump. `computeRecentMeals` / `computeFrequentMeals` /
      // `computeEatAgainForSlot` average per-occurrence stimulant
      // contribution into `item.caffeineMg` / `item.alcoholG`. Missing
      // → no key in `micros` (and `addLoggedMeal` skips the bump).
      const micros: Record<string, number> = {};
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

  const dismissEatAgain = useCallback(() => {
    const state = recordEatAgainDismiss(new Date());
    setEatAgainDismissState(state);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(EAT_AGAIN_STORAGE_KEY, serialiseEatAgainDismiss(state));
      } catch {
        /* noop */
      }
    }
  }, []);
  const eatAgainDismissedForToday = !shouldShowEatAgain(eatAgainDismissState, new Date());

  useEffect(() => {
    const id = setInterval(() => setFastingNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!authedUserId) return;
    supabase
      .from("profiles")
      .select(
        "weight_kg, weight_kg_by_day, goal, plan_pace, sex, age, height_cm, activity_level, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, week_start_day, steps_by_day, daily_steps_goal, fasting_sessions, fasting_window, tracked_macros, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history, last_weekly_checkin_shown_at",
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
        const resolved = resolveMaintenance({
          adaptive_tdee: (data as any).adaptive_tdee,
          adaptive_tdee_confidence: (data as any).adaptive_tdee_confidence,
          adaptive_tdee_updated_at: (data as any).adaptive_tdee_updated_at,
          sex: (data.sex ?? "unspecified") as any,
          weight_kg: Number(data.weight_kg),
          height_cm: Number(data.height_cm),
          age: Number(data.age),
          // Default to "sedentary" (1.2) when missing — "moderate" (1.55)
          // silently over-inflated TDEE by ~14% for users who never picked a
          // level (TestFlight `AIIm60nKi_sTu3-4YjR-WR4`, 2026-04-18).
          activity_level: (data.activity_level ?? "sedentary") as any,
        });
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
        );
      }
      const label = items[0]?.source === "voice" ? "voice" : "photo";
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
    (selection: FoodSearchSelection) => {
      const grams = selection.chosenPortion.gramWeight * selection.quantity;
      const f = grams / 100;
      // Mirror mobile's attribution — USDA / Open Food Facts / Custom
      // foods all show a human-readable `source` in the journal row so
      // the user can tell where the numbers came from after the fact.
      const sourceLabel =
        selection.source === "CUSTOM"
          ? "Custom food"
          : selection.source === "OFF"
          ? "Open Food Facts"
          : selection.source === "Edamam"
          ? "Edamam"
          : selection.source === "FatSecret"
          ? "FatSecret"
          : "USDA FoodData Central";

      // Per-serving path (FatSecret no-metric / count servings like
      // "1 large tomato"). Use `macrosPerServing × quantity` directly.
      //
      // ENG-745 (2026-05-26): must match the preview's condition
      // (`macrosPerServing && gramWeight === 0`, regardless of
      // `macrosPer100g`). The old guard required `macrosPer100g === null`,
      // but FatSecret no-metric foods carry a non-null *zero* per-100g
      // panel — so the guard was false, the commit scaled by `grams = 0`
      // and persisted 0 kcal while the preview showed the real value.
      // Mirrors mobile `handleFoodSearchSelect`.
      const isPerServingOnly = isPerServingPortion({
        gramWeight: selection.chosenPortion.gramWeight,
        hasMacrosPerServing: Boolean(selection.macrosPerServing),
      });

      let mealCalories: number;
      let mealProtein: number;
      let mealCarbs: number;
      let mealFat: number;
      let mealFiberG = 0;
      let micros: Record<string, number> = {};

      if (isPerServingOnly) {
        const ps = selection.macrosPerServing!;
        // servingFraction scales a derived "1 piece" portion to 1/N of
        // the per-serving payload (parity with preview + mobile).
        const fraction = selection.chosenPortion.servingFraction ?? 1;
        const q = selection.quantity * fraction;
        mealCalories = Math.max(0, Math.round(ps.calories * q));
        mealProtein = Math.max(0, Math.round(ps.protein * q * 10) / 10);
        mealCarbs = Math.max(0, Math.round(ps.carbs * q * 10) / 10);
        mealFat = Math.max(0, Math.round(ps.fat * q * 10) / 10);
        // Per-serving micros × quantity via shared helper (audit
        // E2 — pinned in `tests/unit/scaleMicrosPerServing.test.ts`).
        // No caffeine/alcohol here — FatSecret doesn't ship those,
        // and we have no per-100g basis to scale them anyway.
        const ms = (selection as { microsPerServing?: Record<string, number> }).microsPerServing;
        micros = scaleMicrosPerServing(ms, q);
        const fiberFromMicros = micros.fiberG;
        if (typeof fiberFromMicros === "number") mealFiberG = fiberFromMicros;
      } else {
        const m = selection.macrosPer100g!;
        mealCalories = Math.max(0, Math.round(m.calories * f));
        mealProtein = Math.max(0, Math.round(m.protein * f * 10) / 10);
        mealCarbs = Math.max(0, Math.round(m.carbs * f * 10) / 10);
        mealFat = Math.max(0, Math.round(m.fat * f * 10) / 10);
        mealFiberG = Math.round(m.fiberG * f * 10) / 10;
        // F-13 (2026-04-19) — auto-track caffeine + alcohol. Stash
        // scaled values on the meal's `micros` map so the insert
        // path in `useNutritionJournalState` can bump
        // `profiles.extra_caffeine_by_day` /
        // `extra_alcohol_g_by_day` and the delete path can
        // decrement by the same delta. Null per-100g → 0
        // (never invented).
        const { caffeineMg, alcoholG } = scaleCaffeineAlcohol({
          grams,
          caffeineMgPer100g: m.caffeineMgPer100g ?? null,
          alcoholGPer100g: m.alcoholGPer100g ?? null,
        });
        const explicitMicros: Record<string, number> = {};
        if (caffeineMg > 0) explicitMicros.caffeineMg = caffeineMg;
        if (alcoholG > 0) explicitMicros.alcoholG = alcoholG;
        // F-79 (2026-04-25) — full micro set scaled for `grams`,
        // merged with caffeine/alcohol overrides.
        micros = scaleMicrosForGrams(
          (selection as { microsPer100g?: Record<string, number> }).microsPer100g ?? {},
          grams,
          explicitMicros,
        );
      }

      addLoggedMeal(
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
        },
        // Mirror mobile's `food_logged.source` mapping: custom food
        // logs fire with `"custom_food"`, USDA/OFF/Edamam/FatSecret
        // with `"manual"` (the canonical shared-food source).
        selection.source === "CUSTOM" ? "custom_food" : "manual",
      );
    },
    [addLoggedMeal, mealSlot, timeLabel],
  );

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
      const ia = MEAL_SECTION_ORDER.indexOf(a);
      const ib = MEAL_SECTION_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return keys.map((name) => ({ name, meals: map.get(name)! }));
  }, [mealsForSelectedDate]);

  const targets = normalizeMacroTargets(nutritionTargets);
  const baseCalorieTarget = targets.calories;

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
      adaptiveTdeeConfidence: profileAdaptiveTdeeConfidenceRaw,
      adaptiveTdee: profileAdaptiveTdeeRaw,
      daysLoggedThisWeek: weekData.loggedDaysInWeek,
      lastShownAt: weeklyCheckinShownAt,
    });
    if (!eligible) return;
    if (!Number.isFinite(targets.calories) || targets.calories <= 0) return;
    weeklyCheckinHandledRef.current = true;

    const content = buildWeeklyCheckinContent({
      adaptiveTdee: profileAdaptiveTdeeRaw as number,
      // `formulaKcal` is the prior baseline. Honest null when the
      // user's profile is incomplete — content builder suppresses
      // the delta line.
      priorTdee: profileFormulaTdee,
      currentTargetKcal: targets.calories,
      avgCaloriesThisWeek: weekData.weekAvg.calories,
      // weightDeltaKg follow-up: see PR body. Honest null for now.
      weightDeltaKg: null,
    });
    setWeeklyCheckinContent(content);
    setWeeklyCheckinOpen(true);

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
    dateKey: selectedDateKey,
    todayDateKey: todayKey(),
    restingKcal: basalBurnKcal,
    activeKcal: activityBurnForSelectedDay,
    maintenanceKcal: profileMaintenanceTdee ?? baseCalorieTarget,
    workoutKcal: dayWorkouts.reduce((sum, w) => sum + (w.calories ?? 0), 0),
  });
  const effectiveCalorieTarget = baseCalorieTarget + activityAdjustment;

  const belowMealsPromptEligibleWeb = useMemo(
    () => ({
      northStar:
        selectedDateKey === todayKey() &&
        Math.max(0, effectiveCalorieTarget - totals.calories) > 0 &&
        mealsForSelectedDate.length === 0,
      snap: selectedDateKey === todayKey() && mealsForSelectedDate.length === 0,
    }),
    [
      selectedDateKey,
      effectiveCalorieTarget,
      totals.calories,
      mealsForSelectedDate.length,
    ],
  );
  const showBelowMealsNorthStarWeb = isBelowMealsPromptVisible(
    "northStar",
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
      },
      "recipe",
    );
    setAddOpen(false);
    setRecipePortionMultiplier(1);
  };

  const avatarLetter = (profileDisplayName?.trim()?.[0] ?? authEmail?.trim()?.[0] ?? "U").toUpperCase();

  const firstName = profileDisplayName?.trim()?.split(/\s/)[0] ?? null;
  const greetingName = firstName || null;
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="product-shell py-pm-5 space-y-4">
      {!isOnline ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-card border border-warning/30 bg-warning-soft px-4 py-3"
        >
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <p className="text-sm font-semibold text-foreground">
            {"You're offline. Changes will sync when you reconnect."}
          </p>
        </div>
      ) : null}

      <input
        ref={calendarInputRef}
        type="date"
        className="sr-only"
        aria-hidden
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
              ? "flex-1 min-w-0 space-y-4 lg:max-w-[480px]"
              : "flex-1 min-w-0 space-y-4"
          }
        >
      <div className="space-y-1 lg:space-y-0">
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
        hideDayStrip
        dayGreeting={
          selectedDateKey === todayKey() && viewMode === "day"
            ? greetingName
              ? `${timeGreeting}, ${greetingName}`
              : timeGreeting
            : undefined
        }
        streakDays={protectedStreakLength}
        freezeProtected={protectedDateKeys.has(todayKey())}
      />
      </div>

      {missedYesterdayVisible && (
        <p
          data-testid="today-missed-yesterday-copy"
          className="mt-0.5 px-3 text-center text-xs text-muted-foreground"
        >
          {MISSED_YESTERDAY_COPY}
        </p>
      )}

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
          #2 for the priority rule (fasting > eat-again > north-star).
          Mobile parity in `apps/mobile/app/(tabs)/index.tsx`. */}

      {viewMode === "day" && (
      <>
      {/* Phase 4 / Top-5 #2 (2026-04-28) — Today's above-meals composition
          is capped at FOUR blocks (date header / hero / one context block /
          macro tiles). Pre-Phase-4 the eat-again banner / hero / AI pill /
          north-star block / macro tiles / nutrients grid all stacked
          unconditionally; the cap rule moves the eat-again banner into a
          mutually exclusive context-block dispatch below the hero. The
          AI-estimated count chip moved INSIDE the hero (TodayHeroStats's
          new `aiSourcedCount` prop). Reference:
          `docs/ux/teardown-2026-04-28-daily-loop.md` §F1 + Top-5 #2. */}

      {/* Daily ring + 4-tile hero stats (Logged / Target / Burned / Net).
          Desktop (>= 768px) renders stats beside the ring; mobile-web
          shows just the ring. Canonical copy + deficit/surplus detail
          comes from `src/lib/copy/today.ts`. AI-estimated-count chip
          surfaces inline as a caption inside the hero block via
          `aiSourcedCount` (Phase 4). */}
      <TodayHeroStats
        loggedKcal={Math.round(totals.calories)}
        targetKcal={Math.round(effectiveCalorieTarget)}
        burnedKcal={Math.round(totalBurnKcal)}
        aiSourcedCount={mealsForSelectedDate.filter(isAiSourcedFoodHistoryItem).length}
        consumed={totals.calories}
        target={effectiveCalorieTarget}
        proteinPct={targets.protein > 0 ? Math.min(totals.protein / targets.protein, 1) : 0}
        carbsPct={targets.carbs > 0 ? Math.min(totals.carbs / targets.carbs, 1) : 0}
        fatPct={targets.fat > 0 ? Math.min(totals.fat / targets.fat, 1) : 0}
        expanded={ringExpanded}
        onToggleExpanded={() => setRingExpanded((v) => !v)}
        displayMode={ringDisplayMode}
        onDisplayModeChange={setRingDisplayMode}
      />

      {/* Single context block — priority order: fasting > eat-again >
          north-star. Mutually exclusive. Pre-Phase-4 these rendered as
          three separate stacked conditionals (sometimes multiple at
          once); the cap rule (teardown §2) is "never more than one
          prompt above the meals". Web has no `TodayDeficitInsight`
          equivalent (removed 2026-04-18, Pass 7) — when remaining > 0
          but the user has already logged, the slot stays empty rather
          than fall through to the north-star. The Net tile inside
          `TodayHeroStats` already conveys the deficit on web. */}
      {(() => {
        // 1. Active fast wins outright.
        if (activeFast) {
          return (
            <TodayFastingPill
              activeFastElapsedLabel={fastingElapsedLabel}
              fastingOptedIn={fastingOptedIn}
            />
          );
        }
        // 1b. Idle "Start fast" removed (Today premium sprint 2026-05-19).
        // 2. Budget met or exceeded, with a re-log suggestion that
        //    hasn't been dismissed today.
        if (
          eatAgainSuggestion &&
          !eatAgainDismissedForToday &&
          selectedDateKey === todayKey()
        ) {
          return (
            <TodayEatAgainBanner
              suggestion={eatAgainSuggestion}
              slot={currentSlotFromTime}
              onLog={() => logHistoryItem(eatAgainSuggestion, currentSlotFromTime)}
              onDismiss={dismissEatAgain}
            />
          );
        }
        // 3. North-star moved below meals (Today premium sprint 2026-05-19).
        return null;
      })()}

      {/* RemainingMacrosBar removed 2026-04-20 — duplicated the 2x2
          TodayDashboardMacroTiles grid below. Mobile parity: removed
          same day in apps/mobile/app/(tabs)/index.tsx. See
          feedback_no_duplicate_today_hero_content.md. */}

      {/* 3. Dashboard macro tiles — profile `tracked_macros` (Settings),
          same keys as mobile. Phase 4 / Top-5 #2 (2026-04-28): the
          non-macro nutrient rows that previously rendered as a
          standalone block below now ship inline inside this component
          via the `nutrientRows` prop, so the above-meals composition
          stays at four blocks (date / hero / context / macro tiles). */}
      {macroDisplayStyle === "bars" ? (
        <TodayDashboardMacroBars
          trackedMacros={trackedDashboardMacros}
          proteinCurrent={totals.protein}
          proteinTarget={targets.protein}
          carbsCurrent={totals.carbs}
          carbsTarget={targets.carbs}
          fatCurrent={totals.fat}
          fatTarget={targets.fat}
          fiberCurrent={totals.fiber}
          fiberTarget={targets.fiber}
          sugarG={dayMicroSumForTracker.sugarG}
          sodiumMg={dayMicroSumForTracker.sodiumMg}
          waterCurrentMl={totalWaterMl}
          waterTargetMl={targets.waterMl}
          netCarbsLensEnabled={netCarbsLensEnabled}
        />
      ) : (
        <TodayDashboardMacroTiles
          trackedMacros={trackedDashboardMacros}
          proteinCurrent={totals.protein}
          proteinTarget={targets.protein}
          carbsCurrent={totals.carbs}
          carbsTarget={targets.carbs}
          fatCurrent={totals.fat}
          fatTarget={targets.fat}
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
        />
      )}

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
      {/* Phase 2 / B1.2 (D-2026-04-27-15) — TodayQuickLogStrip
          removed from Today's composition root. The canonical
          logging-entry affordance is now the centered raised Plus
          button in the mobile-web `<nav>` (App.tsx), which opens the
          unified `<LogSheet>` via the `?openLog=1` URL param consumer
          above (mirrors mobile `<SupprTabBar>` + `<LogTabBarButton>`,
          commit `6633d2d`). The strip component file stays in the
          tree for reference and tests but no production caller
          renders it on Today. */}

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

      {/* B4 Phase 3a (2026-04-27): eat-again block moved to top-of-feed,
          above the hero. The previous position (right above Quick add)
          dates from a 2026-04-18 audit M4 where it was matched to mobile.
          Mobile reposition ships in the same change set. */}

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

      {/* 5. Meals Section */}
      <TodayMealsSection
        mealsGrouped={mealsGrouped}
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
        // 2026-05-02 parity sweep — empty-state collage (Add custom /
        // Photo / Voice / "Log from today's plan" rows) replaced by a
        // single primary CTA that routes into the unified `<LogSheet>`.
        // Mobile equivalent: raised "+" + per-slot "Tap to add" + the
        // standalone `<TodayPlannedMealsCard>` rendered above. Planned
        // meals still render via `<TodayPlannedMealsCard>` directly
        // below (gated on `mealPlan` truthy with ≥1 non-placeholder).
        onOpenLogSheet={() => {
          // 2026-05-08 build-47 follow-up — see other generic-FAB
          // call-sites; reset mealSlot to time-of-day before opening.
          setMealSlot(slotForHour(new Date().getHours()));
          setLogSheetOpen(true);
        }}
        savedMeals={hostSavedMeals}
        onLogSavedMeal={logSavedMealFromSlotHeader}
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

      {/* Below-meals prompts (Today premium sprint 2026-05-19). Max 2: ENG-585. */}
      {showBelowMealsNorthStarWeb && (
          <NorthStarBlockHost
            viewMode={viewMode}
            savedRecipesForLibrary={savedRecipesForLibrary as Array<NorthStarRecipe>}
            remainingCalories={Math.max(0, effectiveCalorieTarget - totals.calories)}
            remainingProtein={Math.max(0, targets.protein - totals.protein)}
            remainingCarbs={Math.max(0, targets.carbs - totals.carbs)}
            remainingFat={Math.max(0, targets.fat - totals.fat)}
            onPrimaryCta={(_recipeId) => {
              setMealSlot(slotForHour(new Date().getHours()));
              setLogSheetOpen(true);
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
          Renders only when there's a plan with at least one meal for
          today (mobile parity:
          `apps/mobile/app/(tabs)/index.tsx` 2920). */}
      {mealPlan && mealPlan.length > 0 && (mealPlan[0]?.meals ?? []).length > 0 ? (
        <TodayPlannedMealsCard
          plannedMeals={mealPlan[0]!.meals}
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

      {/* Steps & activity card — moved here (was between macro tiles
          and the quick-log strip) to match mobile order
          (`apps/mobile/app/(tabs)/index.tsx` 2960): meals → steps →
          activity bonus. Read-only on web (mobile parity, 2026-04-18) —
          steps + active energy come from the iOS app's HealthKit
          sync. No card renders when no Health data has synced yet
          because there's no manual-entry path on web. */}
      {showStepsCard ? (
        <TodayStepsCard
          stepsForSelectedDay={stepsForSelectedDay}
          dailyStepsGoal={dailyStepsGoal}
          activityBurnKcal={activityBurnForSelectedDay > 0 ? Math.round(activityBurnForSelectedDay) : null}
        />
      ) : null}

      {/* Activity Bonus */}
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
        // The deficit window (rolling 7-day vs calendar week) is changed
        // from Settings ("Burn / deficit summary"), not in-place on Today.
        // The mode still drives this card's summary; it hydrates from
        // `notification_prefs.weekSummaryMode` via NotificationContext.
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

      {/* Hydration & stimulants card (Batch 2.5).
          Position (2026-04-18, post-TestFlight build 7 feedback): sits at the
          bottom of Today — primary hydration quick-add lives in the macro
          tiles up top; this card is detail + caffeine/alcohol quick-add.
          Gating: visible once water target > 0 OR any water/caffeine/alcohol
          logged. Caffeine + alcohol rows additionally self-hide when their
          individual target is 0. First-run fallback is a tiny
          "Track hydration?" link. */}
      {showHydrationCard ? (
        <HydrationStimulantsCard
          selectedDateKey={selectedDateKey}
          weekStartDay={weekStartDay}
          targets={{
            waterMl: targets.waterMl,
            // Phase 2 / B1.4 (D-2026-04-27-08): caffeine + alcohol
            // are gated by Settings opt-in. When the user hasn't
            // opted in, force the target to 0 so the row hides via
            // the existing HydrationStimulantsCard rule. The
            // underlying data is preserved untouched.
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
            className="text-xs font-semibold text-primary hover:underline focus:outline-none focus:underline"
            aria-expanded={false}
            aria-controls="today-hydration-card"
          >
            Track hydration?
          </button>
        </div>
      )}

      {/* Complete Day */}
      {selectedDateKey === todayKey() && mealsForSelectedDate.length > 0 && (
        <button
          onClick={() => setCompleteDayOpen(true)}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity mt-4"
        >
          Complete Day
        </button>
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

      {/* 2026-05-12 round 4 (Grace TF, web parity with mobile): the
          WhyThisNumberDialog moved to /home?view=targets — pill on
          Today's hero was called out as signalling low confidence in
          the number. Web Today no longer hosts the dialog; the
          Targets surface owns it inline. */}

      <TodayCompleteDayDialog
        open={completeDayOpen}
        onOpenChange={setCompleteDayOpen}
        profileWeightKg={profileWeightKg}
        todayCalories={totals.calories}
        targetCalories={normalizeMacroTargets(nutritionTargets).calories}
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
        macroTargets={{
          calories: effectiveCalorieTarget,
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
            toast.success("Custom food saved. Scan again to log it.");
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "Couldn't save custom food",
            );
          }
        }}
      />

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
          `6633d2d`): the side `<LogFab>` (right:18 / bottom:100,
          `md:hidden`) is no longer rendered. The canonical Log entry
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
            protein: targets.protein,
            carbs: targets.carbs,
            fat: targets.fat,
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
          onSelect: (selection) => {
            commitFoodSearchSelection(selection);
            setLogSheetOpen(false);
          },
        }}
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
            return computeRecentMeals(nutritionByDay, 12)
              .filter((item) => !isHealthImportFallbackTitle(item.recipeTitle))
              .map((item) => ({
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
            setLogSheetOpen(false);
            const recent = computeRecentMeals(nutritionByDay, 12);
            const found = recent.find(
              (i) => foodHistoryKey(i.recipeTitle, i.calories) === picked.id,
            );
            if (!found) return;
            // 2026-05-08 build-47 follow-up — Grace TF: tapping "+ Breakfast"
            // in the afternoon was logging picks as Snacks because this
            // path used currentSlotFromTime instead of the user's choice
            // (mealSlot). Mobile parity: apps/mobile/app/(tabs)/index.tsx
            // recents.onPick. Generic LogSheet-open paths reset mealSlot
            // to time-of-day so the default is fresh.
            logHistoryItem(found, mealSlot);
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
            // 2026-05-08 build-47 follow-up — same reason as recents
            // above: respect the user's slot choice (mealSlot). The
            // saved-meal's defaultMealSlot was its preference at save
            // time; the user has now explicitly picked a slot to log into.
            logSavedMeal(meal, mealSlot);
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
            // 2026-05-08 build-47 follow-up — same reason as recents
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
            // 2026-05-02 — photo-log opens for any tier. The dialog's
            // own free-taster line + 403 handoff route to the
            // AiPaywallDialog when the user exhausts their weekly
            // quota.
            setLogSheetOpen(false);
            setPhotoLogOpen(true);
          },
          // Lock badge removed (2026-05-02) — photo-log is no longer
          // Pro-only at the entry point.
          locked: false,
        }}
        onAddManually={() => {
          // Footer "Or add manually" → close LogSheet, open the
          // TodayAddMealDialog (web's quick-add dialog). Mirrors the
          // mobile addOpen path.
          setLogSheetOpen(false);
          setAddOpen(true);
        }}
      />

    </div>
  );
});
