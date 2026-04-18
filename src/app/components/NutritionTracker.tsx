import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Icons } from "./ui/icons";
import { IconBox } from "./ui/icon-box";
import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import { normalizeMacroTargets, DEFAULT_STEPS_GOAL } from "../../types/profile.ts";
import { calculateTDEE, kgToLb } from "../../lib/nutrition/tdee.ts";
import type { RecipeCard, UserTier } from "../../types/recipe.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog.tsx";
import { Button } from "./ui/button.tsx";
import { Checkbox } from "./ui/checkbox.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.tsx";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { useAuthSession } from "../../context/AuthSessionContext.tsx";
import { projectWeight } from "../../lib/weightProjection.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";
import {
  fetchProductByBarcode,
  type OffProductMacros,
} from "../../lib/openFoodFacts/fetchProductByBarcode.ts";
import { scaleFromPer100gGrams } from "../../lib/openFoodFacts/scaleFromPer100g.ts";
import {
  computeLoggingStreak,
  computeWeekFiberWaterHits,
} from "../../lib/nutrition/trackerStats.ts";
import {
  availableFreezes,
  readFreezeLedger,
  type FreezeLedger,
} from "../../lib/nutrition/streakFreeze.ts";
import { effectiveFoodSearchQuery } from "../../lib/nutrition/foodSearchQuery.ts";
import {
  normalizeWeekSummaryMode,
  weekSummaryDateKeys,
  weekSummaryHeading,
} from "../../lib/nutrition/weekSummaryWindow.ts";
import { buildNutritionCsvForDay, downloadCsvFile } from "../../lib/nutrition/exportNutritionCsv.ts";
import NutritionSourceBadge from "../../components/NutritionSourceBadge.tsx";
import {
  clampPortionMultiplier,
  effectivePortionMultiplier,
  isMealPlanPlaceholderLikeTitle,
  scaledMacro,
} from "../../lib/nutrition/portionMultiplier.ts";
import { formatWaterMl } from "../../lib/units/imperial.ts";
import { distributeMealBudget } from "../../lib/nutrition/mealBudget.ts";
import {
  buildDayNutrientDetailRows,
  mealContributedFiberG,
  sumMicrosFromLoggedMeals,
} from "../../lib/nutrition/microNutrientDisplay.ts";
import { normalizeJournalSlotName } from "../../lib/nutrition/journalSlot.ts";
import { DailyRing, type CalorieRingDisplayMode } from "./suppr/daily-ring";
import { MacroCard } from "./suppr/macro-card";
import { RemainingMacrosBar } from "./suppr/remaining-macros-bar";
import { QuickAddPanel } from "./suppr/quick-add-panel";
import { CopyMealDialog } from "./suppr/copy-meal-dialog";
import { DuplicateDayDialog } from "./suppr/duplicate-day-dialog";
import { HydrationStimulantsCard } from "./suppr/hydration-stimulants-card";
import { VoiceLogDialog } from "./suppr/voice-log-dialog";
import { PhotoLogDialog } from "./suppr/photo-log-dialog";
import { AiPaywallDialog, type AiPaywallFeature } from "./suppr/ai-paywall-dialog";
import type { AiLoggedItem } from "../../lib/nutrition/aiLogging";
import { computeEatAgainForSlot, type FoodHistoryItem } from "../../lib/nutrition/foodHistory";
import { buildMealEntriesFromSavedMeal } from "../../lib/nutrition/savedMealsLogic";
import type { SavedMeal, SavedMealItem } from "../../lib/nutrition/savedMeals";
import { DayStrip } from "./DayStrip.tsx";
import {
  parseDateKey,
  shiftDateKey,
  todayKey,
  formatDateLabel,
  clampDateKey,
} from "../../lib/nutrition/trackerDate.ts";
import { dateKeyFromDate, journalRangeBounds } from "../../lib/nutrition/journalNavigation.ts";

export {
  parseDateKey,
  shiftDateKey,
  todayKey,
  formatDateLabel,
  clampDateKey,
} from "../../lib/nutrition/trackerDate.ts";

const RECENT_BARCODE_KEY = "suppr-recent-foods-v1";

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

function dayActivityBudgetAddonWeb(
  prefer: boolean,
  dk: string,
  maintenance: number,
  activityByDay: Record<string, number>,
  basalByDay: Record<string, number>,
  workoutsByDay: Record<string, Array<{ calories?: number }>>,
): number {
  const active = Math.round(activityByDay[dk] ?? 0);
  if (!prefer || active <= 0) return 0;
  const basal = Math.round(basalByDay[dk] ?? 0);
  if (basal > 0 && maintenance > 0) {
    return Math.max(0, Math.round(basal + active - maintenance));
  }
  const workouts = workoutsByDay[dk] ?? [];
  return Math.max(0, workouts.reduce((s, w) => s + (w.calories ?? 0), 0));
}

function MacroBarRowWeb({
  label,
  current,
  goal,
  colorVar,
}: {
  label: string;
  current: number;
  goal: number;
  colorVar: string;
}) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-16 text-[10px] font-bold tracking-wide text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colorVar }} />
      </div>
      <span className="w-14 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
        {Math.round(current)} / {goal}
      </span>
    </div>
  );
}

type UsdaHit = { fdcId: number; description: string; dataType?: string; brandName?: string };
type UsdaFoodDetails = {
  fdcId: number;
  description: string;
  macrosPer100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
  };
};

interface NutritionTrackerProps {
  userTier: UserTier;
  onOpenProgress?: () => void;
}

function barcodePortionLabel(product: OffProductMacros, grams: number): string {
  const hit = product.servingOptions.find((o) => Math.abs(o.grams - grams) < 0.51);
  return hit?.label ?? `${Math.round(grams * 10) / 10} g`;
}

function parseNonnegNumber(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
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

export const NutritionTracker = memo(function NutritionTracker({ userTier, onOpenProgress }: NutritionTrackerProps) {
  const {
    nutritionTargets,
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
    activityBurnKcal,
    activityBurnForSelectedDay,
    activityBurnByDay,
    setActivityBurnForSelectedDay,
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
  const weekFiberWater = useMemo(
    () =>
      computeWeekFiberWaterHits(
        nutritionByDay,
        extraWaterByDay,
        normalizeMacroTargets(nutritionTargets).fiber,
        normalizeMacroTargets(nutritionTargets).waterMl,
      ),
    [nutritionByDay, extraWaterByDay, nutritionTargets],
  );

  const [ringExpanded, setRingExpanded] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  /** Batch 1.4 — meal row context menu: target meal id for the Copy dialog. */
  const [copyMealTargetId, setCopyMealTargetId] = useState<string | null>(null);
  /** Batch 1.4 — Duplicate day dialog visibility. */
  const [duplicateDayOpen, setDuplicateDayOpen] = useState(false);
  const [mealSlot, setMealSlot] = useState("Breakfast");
  const [recipeId, setRecipeId] = useState("");
  const [timeLabel, setTimeLabel] = useState("12:00 PM");
  const [addMode, setAddMode] = useState<"recipe" | "manual" | "search">("recipe");
  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState(0);
  const [manualProtein, setManualProtein] = useState(0);
  const [manualCarbs, setManualCarbs] = useState(0);
  const [manualFat, setManualFat] = useState(0);
  const [manualFiber, setManualFiber] = useState(0);
  const [manualWater, setManualWater] = useState(0);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [barcodePreview, setBarcodePreview] = useState<OffProductMacros | null>(null);
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
  const [foodQuery, setFoodQuery] = useState("");
  const [foodHits, setFoodHits] = useState<UsdaHit[] | null>(null);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodSelected, setFoodSelected] = useState<UsdaFoodDetails | null>(null);
  const [foodGrams, setFoodGrams] = useState(100);
  const [recentFoods, setRecentFoods] = useState<string[]>(() =>
    typeof window !== "undefined" ? loadRecentFoods() : [],
  );

  const [quickQuery, setQuickQuery] = useState("");
  const [quickHits, setQuickHits] = useState<UsdaHit[] | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickSelected, setQuickSelected] = useState<UsdaFoodDetails | null>(null);
  const [quickGrams, setQuickGrams] = useState(100);
  const [quickMealSlot, setQuickMealSlot] = useState("Lunch");
  /** Recipe log: scale catalog/saved recipe macros (1 = solo, 2 = shared dinner, etc.). */
  const [recipePortionMultiplier, setRecipePortionMultiplier] = useState(1);

  // Batch 5.13 — Pro-gated Voice + AI photo logging dialogs replace the
  // legacy free-tier inline text dialog and `<input type="file">` upload.
  const [voiceLogOpen, setVoiceLogOpen] = useState(false);
  const [photoLogOpen, setPhotoLogOpen] = useState(false);
  const [aiPaywallFeature, setAiPaywallFeature] = useState<AiPaywallFeature | null>(null);
  const [completeDayOpen, setCompleteDayOpen] = useState(false);
  const [profileWeightKg, setProfileWeightKg] = useState<number | null>(null);
  const [profileGoal, setProfileGoal] = useState<string | null>(null);
  const [profileMaintenanceTdee, setProfileMaintenanceTdee] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [weekStartDay, setWeekStartDay] = useState<"monday" | "sunday">("monday");
  // Batch 4.11 — streak freeze state. Ledger is loaded from `profiles`
  // alongside `week_start_day`; budget defaults to 3.
  const [freezeLedger, setFreezeLedger] = useState<FreezeLedger>({
    earnedAt: [],
    usedHistory: [],
  });
  const [freezeBudgetMax, setFreezeBudgetMax] = useState<number>(3);
  // Batch 4.11 — freeze sub-label on Today streak card. Safe to default
  // to 0 when the ledger hasn't loaded; the sub-label is hidden then.
  const freezesAvailableToday = useMemo(
    () => availableFreezes(freezeLedger, freezeBudgetMax),
    [freezeLedger, freezeBudgetMax],
  );
  const [ringDisplayMode, setRingDisplayMode] = useState<CalorieRingDisplayMode>("remaining");
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [dailyStepsGoal, setDailyStepsGoal] = useState(DEFAULT_STEPS_GOAL);
  const [stepsDayInput, setStepsDayInput] = useState("");
  const [fastingSessions, setFastingSessions] = useState<FastingSessionRow[]>([]);
  const [fastingNowTick, setFastingNowTick] = useState(() => Date.now());
  const calendarInputRef = useRef<HTMLInputElement>(null);
  const { authedUserId } = useAuthSession();

  /** Infer the default meal slot from local clock time for Eat-again /
   * Quick Add defaults. Mirrors the mobile rule of thumb in
   * `apps/mobile/app/(tabs)/index.tsx`. */
  const currentSlotFromTime = useMemo(() => {
    const h = new Date().getHours();
    if (h < 10) return "Breakfast";
    if (h < 14) return "Lunch";
    if (h < 17) return "Snacks";
    return "Dinner";
  }, []);
  const [eatAgainDismissedKey, setEatAgainDismissedKey] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem("suppr-eat-again-dismissed");
    } catch {
      return null;
    }
  });

  /** Suggestion for the "Eat again" card — previous-day meal in the
   * slot matching the current clock time. `null` disables the card. */
  const eatAgainSuggestion = useMemo(() => {
    return computeEatAgainForSlot(nutritionByDay, currentSlotFromTime, new Date());
  }, [nutritionByDay, currentSlotFromTime]);

  /** Log a history row (Favourite / Frequent / Recent / Eat again) into
   * the active meal slot. Shared by QuickAddPanel + Eat-again card so
   * the event shape is consistent. */
  const logHistoryItem = useCallback(
    (item: FoodHistoryItem, slot: string) => {
      addLoggedMeal({
        name: slot,
        recipeTitle: item.recipeTitle,
        time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        ...(item.fiber != null ? { fiberG: item.fiber } : {}),
        ...(item.source ? { source: item.source } : {}),
      });
      try {
        track(AnalyticsEvents.food_logged, { source: "quick_add", slot });
      } catch {
        /* analytics is fire-and-forget */
      }
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
        addLoggedMealForDate(selectedDateKey, payload);
      }
      toast.success(`Logged ${meal.name} to ${slot}.`);
    },
    [addLoggedMealForDate, selectedDateKey],
  );

  /** "Save these as a meal" — gather the items in the active slot and
   * dispatch a CustomEvent the QuickAddPanel listens for. Keeps the
   * panel's prop API unchanged. Batch 2.6. */
  const openSaveMealDialog = useCallback(
    (slotName: string) => {
      if (typeof window === "undefined") return;
      const slotMeals = mealsForSelectedDate.filter(
        (m) => normalizeJournalSlotName(m.name ?? "") === slotName,
      );
      if (slotMeals.length < 2) {
        toast.info("Log 2 or more items first, then save the combo.");
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
      window.dispatchEvent(
        new CustomEvent("suppr:open-save-meal-dialog", { detail: { items } }),
      );
    },
    [mealsForSelectedDate],
  );

  const dismissEatAgain = useCallback(() => {
    const key = todayKey();
    setEatAgainDismissedKey(key);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("suppr-eat-again-dismissed", key);
      } catch {
        /* noop */
      }
    }
  }, []);
  const eatAgainDismissedForToday = eatAgainDismissedKey === todayKey();

  useEffect(() => {
    const id = setInterval(() => setFastingNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!authedUserId) return;
    supabase
      .from("profiles")
      .select(
        "weight_kg, goal, sex, age, height_cm, activity_level, adaptive_tdee, week_start_day, steps_by_day, daily_steps_goal, fasting_sessions, tracked_macros, streak_freeze_budget_max, streak_freezes_earned_at, streak_freezes_used_history",
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
        const w = data.weight_kg != null ? Number(data.weight_kg) : null;
        setProfileWeightKg(Number.isFinite(w) ? w : null);
        setProfileGoal((data as any).goal ?? null);
        // Compute maintenance TDEE for surplus-only activity adjustment.
        // Prefer adaptive TDEE if available (more accurate), else compute from profile.
        const adaptive = Number(data.adaptive_tdee);
        if (Number.isFinite(adaptive) && adaptive > 0) {
          setProfileMaintenanceTdee(Math.round(adaptive));
        } else {
          const sex = data.sex ?? "female";
          const age = Number(data.age);
          const hCm = Number(data.height_cm);
          const wKg = Number(data.weight_kg);
          const act = data.activity_level ?? "moderate";
          if (Number.isFinite(age) && Number.isFinite(hCm) && Number.isFinite(wKg) && age > 0 && hCm > 0 && wKg > 0) {
            setProfileMaintenanceTdee(calculateTDEE(sex, wKg, hCm, age, act));
          }
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

  const handleVoiceLog = () => {
    // Batch 5.13 — Pro gate. Free users see the paywall dialog; Base users
    // currently have voice via the server's existing Base+ check, but the
    // product spec gates on Pro specifically.
    if (userTier !== "pro") {
      track(AnalyticsEvents.voice_log_paywalled);
      setAiPaywallFeature("voice_log");
      return;
    }
    setVoiceLogOpen(true);
  };

  const handlePhotoLogClick = () => {
    // Batch 5.13 — Pro gate for AI photo logging.
    if (userTier !== "pro") {
      track(AnalyticsEvents.ai_photo_log_paywalled);
      setAiPaywallFeature("photo_log");
      return;
    }
    setPhotoLogOpen(true);
  };

  const commitAiLoggedItems = useCallback(
    (items: AiLoggedItem[]) => {
      if (items.length === 0) return;
      for (const item of items) {
        addLoggedMeal({
          name: mealSlot,
          recipeTitle: item.name,
          time: mealSlot,
          calories: Math.round(item.calories),
          protein: Math.round(item.protein),
          carbs: Math.round(item.carbs),
          fat: Math.round(item.fat),
          source: item.source === "voice" ? "AI voice" : "AI photo",
        });
      }
      const label = items[0]?.source === "voice" ? "voice" : "photo";
      toast.success(`Logged ${items.length} item${items.length === 1 ? "" : "s"} from ${label}`);
    },
    [addLoggedMeal, mealSlot],
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

  const REF_SUGAR_G = 50;
  const REF_SODIUM_MG = 2300;

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

  // Activity adjustment — surplus-only "Activity Bonus":
  //
  // Only add bonus calories when actual total burn exceeds estimated maintenance.
  //   bonus = max(0, (resting + active) − maintenance_TDEE)
  //
  // This avoids double-counting: the user's baseCalorieTarget already includes an
  // estimated activity level (e.g. "moderate" = BMR × 1.55), so adding raw active
  // burn would overcount. The bonus only rewards burn ABOVE what was expected.
  //
  // Fallback when resting energy isn't available from Health: use active energy
  // from logged workouts only (intentional exercise, not incidental movement).
  const activityAdjustment = (() => {
    if (!preferActivityAdjustedCalories || activityBurnForSelectedDay === 0) return 0;
    const maintenance = profileMaintenanceTdee ?? baseCalorieTarget;
    if (basalBurnKcal > 0) {
      // Best case: we have resting + active from Health.
      // Bonus = how much actual burn exceeds estimated maintenance.
      return Math.max(0, Math.round(totalBurnKcal - maintenance));
    }
    // No resting data from Health: use logged workout calories only.
    // This is conservative but safe — avoids adding incidental movement.
    const workoutBurn = dayWorkouts.reduce((sum, w) => sum + (w.calories ?? 0), 0);
    return Math.max(0, Math.round(workoutBurn));
  })();
  const effectiveCalorieTarget = baseCalorieTarget + activityAdjustment;
  const totalWaterMl = totals.waterMl + extraWaterMlForSelectedDay;

  const activeFast = useMemo(() => fastingSessions.find((s) => s.end === null), [fastingSessions]);
  const fastingElapsedLabel = useMemo(() => {
    if (!activeFast) return null;
    const elapsedH = Math.max(0, (fastingNowTick - new Date(activeFast.start).getTime()) / 3600_000);
    const h = Math.floor(elapsedH);
    const m = Math.floor((elapsedH - h) * 60);
    return `${h}h ${m}m`;
  }, [activeFast, fastingNowTick]);

  const saveStepsForSelectedDay = useCallback(async () => {
    const v = Math.round(Number.parseFloat(stepsDayInput.replace(",", ".")));
    if (!Number.isFinite(v) || v < 0 || !authedUserId) return;
    const next = { ...stepsByDay, [selectedDateKey]: v };
    setStepsByDay(next);
    setStepsDayInput("");
    const { error } = await supabase.from("profiles").update({ steps_by_day: next }).eq("id", authedUserId);
    if (error) toast.error("Could not save steps.");
  }, [stepsDayInput, stepsByDay, selectedDateKey, authedUserId]);

  useEffect(() => {
    setStepsDayInput("");
  }, [selectedDateKey]);

  const stepsForSelectedDay = Object.prototype.hasOwnProperty.call(stepsByDay, selectedDateKey)
    ? (stepsByDay[selectedDateKey] ?? 0)
    : null;
  const hasBurnData = activityBurnForSelectedDay > 0 || basalBurnKcal > 0 || dayWorkouts.length > 0;

  const getProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressTextClass = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 90 && percentage <= 110) {
      return "text-success";
    }
    if (percentage > 110) {
      return "text-warning";
    }
    return "text-primary";
  };

  const getProgressBarClass = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 90 && percentage <= 110) {
      return "bg-success";
    }
    if (percentage > 110) {
      return "bg-warning";
    }
    return "bg-primary";
  };

  const handleAddMeal = () => {
    if (addMode === "manual") {
      const name = manualName.trim();
      if (!name) {
        return;
      }
      addLoggedMeal({
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
      });
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
    if (addMode === "search") {
      if (!foodSelected) {
        toast.error("Select a food first.");
        return;
      }
      const g = Math.max(1, Math.round(foodGrams) || 1);
      const mult = g / 100;
      const m = foodSelected.macrosPer100g;
      addLoggedMeal({
        name: mealSlot,
        recipeTitle: `${foodSelected.description} (${g}g)`,
        time: timeLabel,
        calories: Math.max(0, Math.round(m.calories * mult)),
        protein: Math.max(0, Math.round(m.protein * mult)),
        carbs: Math.max(0, Math.round(m.carbs * mult)),
        fat: Math.max(0, Math.round(m.fat * mult)),
        source: "USDA FoodData Central",
        ...(m.fiberG > 0 ? { fiberG: Math.max(0, Math.round(m.fiberG * mult)) } : {}),
      });
      setAddOpen(false);
      setFoodQuery("");
      setFoodHits(null);
      setFoodSelected(null);
      setFoodGrams(100);
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
    addLoggedMeal({
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
    });
    setAddOpen(false);
    setRecipePortionMultiplier(1);
  };

  const avatarLetter = (profileDisplayName?.trim()?.[0] ?? authEmail?.trim()?.[0] ?? "U").toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-pm-5 py-pm-5">
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

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              aria-label={viewMode === "week" ? "Previous week" : "Previous day"}
              onClick={() => (viewMode === "week" ? navigateWeek(-1) : navigateDay(-1))}
              className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border bg-card"
            >
              <Icons.back className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="text-center min-w-0 flex-1"
              onClick={() => {
                setSelectedDateKey(todayKey());
                setViewMode("day");
              }}
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium truncate">
                {viewMode === "week"
                  ? weekData.label
                  : `${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${selectedDate.toLocaleDateString("en-US", { weekday: "long" })}`}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                {viewMode === "week" ? "This week" : formatDateLabel(selectedDate)}
              </h1>
            </button>
            <button
              type="button"
              aria-label={viewMode === "week" ? "Next week" : "Next day"}
              onClick={() => (viewMode === "week" ? navigateWeek(1) : navigateDay(1))}
              disabled={viewMode === "day" && selectedDateKey === todayKey()}
              className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border bg-card disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Icons.forward className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                  viewMode === "day" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                  viewMode === "week" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Week
              </button>
            </div>
            <div className="w-9 h-9 rounded-[10px] bg-primary/10 flex items-center justify-center text-sm font-bold text-primary" aria-hidden>
              {avatarLetter}
            </div>
          </div>
        </div>

        {viewMode === "day" ? (
          <DayStrip
            selectedDateKey={selectedDateKey}
            weekStartDay={weekStartDay}
            loggedDays={loggedDays}
            onSelectDateKey={setSelectedDateKey}
            onOpenCalendar={() => calendarInputRef.current?.showPicker?.() ?? calendarInputRef.current?.click()}
          />
        ) : (
          <DayStrip
            selectedDateKey={selectedDateKey}
            weekStartDay={weekStartDay}
            loggedDays={loggedDays}
            onSelectDateKey={(k) => {
              setSelectedDateKey(k);
              setViewMode("day");
            }}
            onOpenCalendar={() => calendarInputRef.current?.showPicker?.() ?? calendarInputRef.current?.click()}
          />
        )}
      </div>

      {viewMode === "week" && (
        <div className="flex flex-col gap-4 mb-4">
          <div className="rounded-xl bg-card border border-border p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Weekly calories</p>
            <div className="flex justify-between items-end gap-1 h-36">
              {weekData.days.map((day) => {
                const dayGoal =
                  targets.calories +
                  dayActivityBudgetAddonWeb(
                    preferActivityAdjustedCalories,
                    day.key,
                    maintenanceForWeek,
                    activityBurnByDay,
                    basalBurnByDay,
                    workoutsByDay,
                  );
                const maxCal = Math.max(
                  1,
                  ...weekData.days.map((d) =>
                    Math.max(
                      d.totals.calories,
                      targets.calories +
                        dayActivityBudgetAddonWeb(
                          preferActivityAdjustedCalories,
                          d.key,
                          maintenanceForWeek,
                          activityBurnByDay,
                          basalBurnByDay,
                          workoutsByDay,
                        ),
                    ),
                  ),
                );
                const barH = maxCal > 0 ? Math.max(4, (day.totals.calories / maxCal) * 110) : 4;
                const over = day.totals.calories > dayGoal;
                const isCurrentDay = day.key === todayKey();
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => {
                      setSelectedDateKey(day.key);
                      setViewMode("day");
                    }}
                    className="flex flex-col items-center flex-1 gap-1 min-w-0"
                  >
                    <span className="text-[10px] text-muted-foreground tabular-nums h-4">
                      {day.totals.calories > 0 ? Math.round(day.totals.calories) : ""}
                    </span>
                    <div
                      className="w-full max-w-[28px] rounded-md transition-colors mx-auto"
                      style={{
                        height: barH,
                        backgroundColor: over ? "var(--destructive)" : day.totals.calories > 0 ? "var(--primary)" : "var(--muted)",
                      }}
                    />
                    <span
                      className={`text-[11px] font-semibold ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {day.short}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground text-right mt-1">
              {preferActivityAdjustedCalories
                ? `Goal: ${targets.calories} kcal base + activity bonus when over maintenance (~${maintenanceForWeek} kcal)`
                : `Daily goal: ${targets.calories} kcal`}
            </p>
          </div>

          <div className="rounded-xl bg-card border border-border p-4">
            <p className="text-sm font-semibold text-foreground mb-2">Steps & water</p>
            <p className="text-[10px] text-muted-foreground mb-3">Each column: steps vs goal (top), water vs goal (bottom). Tap a day to open it.</p>
            <div className="flex gap-1 items-end">
              {weekData.days.map((day) => {
                const stepPct =
                  day.steps != null && dailyStepsGoal > 0 ? Math.min(100, (day.steps / dailyStepsGoal) * 100) : 0;
                const waterPct =
                  targets.waterMl > 0 ? Math.min(100, (day.waterMl / targets.waterMl) * 100) : 0;
                const isCurrentDay = day.key === todayKey();
                return (
                  <button
                    key={`sw-${day.key}`}
                    type="button"
                    onClick={() => {
                      setSelectedDateKey(day.key);
                      setViewMode("day");
                    }}
                    className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
                  >
                    <div className="w-full max-w-[28px] flex flex-col justify-end gap-1 h-[52px] mx-auto">
                      <div className="relative h-[22px] w-full rounded bg-muted overflow-hidden">
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded transition-all"
                          style={{
                            height: `${stepPct}%`,
                            minHeight: day.steps != null && day.steps > 0 ? 3 : 0,
                            backgroundColor:
                              day.steps != null && day.steps >= dailyStepsGoal ? "var(--success)" : "var(--primary)",
                          }}
                        />
                      </div>
                      <div className="relative h-[22px] w-full rounded bg-muted overflow-hidden">
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded bg-macro-water transition-all"
                          style={{
                            height: `${waterPct}%`,
                            minHeight: day.waterMl > 0 ? 3 : 0,
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-semibold ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {day.short}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-card border border-border p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Weekly summary</p>
            <div className="flex justify-around text-center">
              <div>
                <p className="text-2xl font-extrabold text-foreground tabular-nums">
                  {Math.round(weekData.weekTotals.calories)}
                </p>
                <p className="text-[11px] text-muted-foreground">Total kcal</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-primary tabular-nums">
                  {Math.round(weekData.weekAvg.calories)}
                </p>
                <p className="text-[11px] text-muted-foreground">Daily avg</p>
              </div>
              <div>
                {(() => {
                  const under = weekEffectiveCalorieBudget > weekData.weekTotals.calories;
                  const diff = Math.round(Math.abs(weekEffectiveCalorieBudget - weekData.weekTotals.calories));
                  return (
                    <>
                      <p className={`text-2xl font-extrabold tabular-nums ${under ? "text-success" : "text-destructive"}`}>
                        {diff}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{under ? "Under budget" : "Over budget"}</p>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card border border-border p-4">
            <p className="text-sm font-semibold text-foreground mb-1">Daily averages</p>
            <p className="text-[11px] text-muted-foreground mb-3">
              Based on {weekData.loggedDaysInWeek} day{weekData.loggedDaysInWeek !== 1 ? "s" : ""} with logged food
            </p>
            <MacroBarRowWeb label="PROTEIN" current={weekData.weekAvg.protein} goal={targets.protein} colorVar="var(--macro-protein)" />
            <MacroBarRowWeb label="CARBS" current={weekData.weekAvg.carbs} goal={targets.carbs} colorVar="var(--macro-carbs)" />
            <MacroBarRowWeb label="FATS" current={weekData.weekAvg.fat} goal={targets.fat} colorVar="var(--macro-fat)" />
          </div>

          <div className="rounded-xl bg-card border border-border p-4">
            <p className="text-sm font-semibold text-foreground mb-2">Macro breakdown</p>
            <div className="flex flex-col gap-2 mt-2">
              {weekData.days.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => {
                    setSelectedDateKey(day.key);
                    setViewMode("day");
                  }}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <span className="w-8 text-[11px] font-semibold text-muted-foreground">{day.short}</span>
                  <div className="flex-1 flex h-3.5 rounded overflow-hidden bg-muted">
                    {day.totals.calories > 0 && (() => {
                      const total = day.totals.protein + day.totals.carbs + day.totals.fat || 1;
                      return (
                        <>
                          <div style={{ width: `${(day.totals.protein / total) * 100}%`, background: "var(--macro-protein)" }} />
                          <div style={{ width: `${(day.totals.carbs / total) * 100}%`, background: "var(--macro-carbs)" }} />
                          <div style={{ width: `${(day.totals.fat / total) * 100}%`, background: "var(--macro-fat)" }} />
                        </>
                      );
                    })()}
                  </div>
                  <span className="w-11 text-right text-[11px] text-muted-foreground tabular-nums">
                    {day.totals.calories > 0 ? Math.round(day.totals.calories) : "—"}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--macro-protein)]" /> Protein
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--macro-carbs)]" /> Carbs
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--macro-fat)]" /> Fat
              </span>
            </div>
          </div>
        </div>
      )}

      {viewMode === "day" && (
      <>
      {/* Eat again — one-tap re-log of the most recent meal in the slot
          matching the current clock time. Dismissible per day. */}
      {eatAgainSuggestion && !eatAgainDismissedForToday && selectedDateKey === todayKey() && (
        <div className="mb-3 rounded-card border border-primary/30 bg-primary/5 px-3.5 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Eat again</p>
            <p className="text-[13px] font-semibold text-foreground truncate">{eatAgainSuggestion.recipeTitle}</p>
            <p className="text-[11px] text-muted-foreground">
              {Math.round(eatAgainSuggestion.calories)} kcal · P {Math.round(eatAgainSuggestion.protein)}g · C {Math.round(eatAgainSuggestion.carbs)}g · F {Math.round(eatAgainSuggestion.fat)}g · into {currentSlotFromTime}
            </p>
          </div>
          <button
            type="button"
            onClick={() => logHistoryItem(eatAgainSuggestion, currentSlotFromTime)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-primary text-primary-foreground hover:opacity-90"
            aria-label={`Log ${eatAgainSuggestion.recipeTitle} to ${currentSlotFromTime}`}
          >
            Log
          </button>
          <button
            type="button"
            onClick={dismissEatAgain}
            className="size-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Dismiss Eat again suggestion"
            title="Dismiss"
          >
            <span aria-hidden>×</span>
          </button>
        </div>
      )}

      {/* Daily ring — tap to expand macro rings */}
      <div className="flex flex-col items-center mb-4">
        <DailyRing
          consumed={totals.calories}
          target={effectiveCalorieTarget}
          size={160}
          strokeWidth={10}
          proteinPct={targets.protein > 0 ? Math.min(totals.protein / targets.protein, 1) : 0}
          carbsPct={targets.carbs > 0 ? Math.min(totals.carbs / targets.carbs, 1) : 0}
          fatPct={targets.fat > 0 ? Math.min(totals.fat / targets.fat, 1) : 0}
          expanded={ringExpanded}
          onToggle={() => setRingExpanded((v) => !v)}
          displayMode={ringDisplayMode}
        />
        <p className="text-xs text-muted-foreground mt-3">
          {ringExpanded ? "Click the ring to hide macros" : "Click the ring to show macros"}
        </p>
        <div className="flex justify-center gap-1 mt-2" role="group" aria-label="Calorie ring display">
          {(["remaining", "consumed"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setRingDisplayMode(mode)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors ${
                ringDisplayMode === mode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "remaining" ? "Remaining" : "Consumed"}
            </button>
          ))}
        </div>
      </div>

      {/* Remaining macros — kcal / P / C / F (and fiber when tracked) left today. */}
      <RemainingMacrosBar
        className="mb-4"
        targets={{
          calories: effectiveCalorieTarget,
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

      {/* 3. Dashboard macro tiles — profile `tracked_macros` (Settings), same keys as mobile */}
      <div className="flex flex-wrap gap-2 mb-4">
        {trackedDashboardMacros.map((macroKey) => {
          if (macroKey === "protein") {
            return (
              <MacroCard
                key="protein"
                className="min-w-[92px] flex-1"
                macro="protein"
                value={totals.protein}
                target={targets.protein}
              />
            );
          }
          if (macroKey === "carbs") {
            return (
              <MacroCard key="carbs" className="min-w-[92px] flex-1" macro="carbs" value={totals.carbs} target={targets.carbs} />
            );
          }
          if (macroKey === "fat") {
            return (
              <MacroCard key="fat" className="min-w-[92px] flex-1" macro="fat" value={totals.fat} target={targets.fat} />
            );
          }
          if (macroKey === "fiber") {
            const cur = totals.fiber;
            const tgt = targets.fiber;
            const pct = tgt > 0 ? Math.min((cur / tgt) * 100, 100) : 0;
            return (
              <div key="fiber" className="flex-1 min-w-[92px] flex flex-col rounded-xl bg-card p-2.5 border border-border">
                <div className="flex items-center gap-1 mb-1">
                  <div className="h-2 w-2 rounded-sm bg-[var(--success)]" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fiber</span>
                </div>
                <div className="text-base font-bold tabular-nums text-foreground">{Math.round(cur * 10) / 10}g</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">of {tgt}g</span>
              </div>
            );
          }
          if (macroKey === "sugar") {
            const cur = dayMicroSumForTracker.sugarG;
            const tgt = REF_SUGAR_G;
            const pct = tgt > 0 ? Math.min((cur / tgt) * 100, 100) : 0;
            return (
              <div key="sugar" className="flex-1 min-w-[92px] flex flex-col rounded-xl bg-card p-2.5 border border-border">
                <div className="flex items-center gap-1 mb-1">
                  <div className="h-2 w-2 rounded-sm bg-[var(--warning)]" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sugar</span>
                </div>
                <div className="text-base font-bold tabular-nums text-foreground">{Math.round(cur * 10) / 10}g</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--warning)]" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">ref {tgt}g</span>
              </div>
            );
          }
          if (macroKey === "sodium") {
            const cur = dayMicroSumForTracker.sodiumMg;
            const tgt = REF_SODIUM_MG;
            const pct = tgt > 0 ? Math.min((cur / tgt) * 100, 100) : 0;
            return (
              <div key="sodium" className="flex-1 min-w-[92px] flex flex-col rounded-xl bg-card p-2.5 border border-border">
                <div className="flex items-center gap-1 mb-1">
                  <div className="h-2 w-2 rounded-sm bg-[var(--destructive)]" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sodium</span>
                </div>
                <div className="text-base font-bold tabular-nums text-foreground">{Math.round(cur)}mg</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--destructive)]" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">ref {tgt}mg</span>
              </div>
            );
          }
          if (macroKey === "water") {
            const cur = totalWaterMl;
            const tgt = targets.waterMl;
            const pct = tgt > 0 ? Math.min((cur / tgt) * 100, 100) : 0;
            return (
              <div key="water" className="flex-1 min-w-[92px] flex flex-col rounded-xl bg-card p-2.5 border border-border">
                <div className="flex items-center gap-1 mb-1">
                  <Icons.water className="h-3 w-3 shrink-0 text-macro-water" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Water</span>
                </div>
                <div className="text-sm font-bold tabular-nums text-foreground leading-tight">{formatWaterLine(cur)}</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-macro-water" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5">of {formatWaterLine(tgt)}</span>
                <div className="flex gap-1 mt-2">
                  {([250, 500] as const).map((ml) => (
                    <button
                      key={ml}
                      type="button"
                      onClick={() => addWaterMlForSelectedDay(ml)}
                      className="flex-1 px-1 py-1 rounded-md text-[9px] font-semibold bg-macro-water-soft text-macro-water border border-macro-water/30 hover:bg-macro-water/20 transition-colors"
                    >
                      +{ml}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Hydration & stimulants card (Batch 2.5).
          Replaces the old water-only tile. Always renders so caffeine +
          alcohol are reachable even when "water" is already a dashboard
          widget (the widget shows daily water; this card adds quick-add
          chips + stimulant rows). */}
      <HydrationStimulantsCard
        selectedDateKey={selectedDateKey}
        weekStartDay={weekStartDay}
        targets={{
          waterMl: targets.waterMl,
          caffeineMg: targetCaffeineMg,
          alcoholGWeekly: targetAlcoholGWeekly,
        }}
        waterTotalMl={totalWaterMl}
        waterFromMealsMl={Math.max(0, totalWaterMl - extraWaterMlForSelectedDay)}
        caffeineTotalMg={extraCaffeineMgForSelectedDay}
        alcoholByDayG={extraAlcoholGByDay}
        measurementSystem={profileMeasurementSystem}
        onAddWater={addWaterMlForSelectedDay}
        onAddCaffeine={addCaffeineMgForSelectedDay}
        onAddAlcohol={addAlcoholGForSelectedDay}
        onReset={(kind) => resetHydrationStimulantsForDay(selectedDateKey, kind)}
      />
      {/* End hydration & stimulants card */}

      {/* Steps & activity (manual steps; water total above) */}
      <div className="rounded-xl bg-card border border-border p-3 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <IconBox size="sm" tone="primary">
              <Icons.activity />
            </IconBox>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground">Steps & activity</span>
              <span className="text-[11px] tabular-nums text-muted-foreground truncate">
                {stepsForSelectedDay != null
                  ? `${stepsForSelectedDay.toLocaleString()} / ${dailyStepsGoal.toLocaleString()} steps`
                  : "No steps logged for this day"}
              </span>
            </div>
          </div>
        </div>
        {stepsForSelectedDay != null && dailyStepsGoal > 0 && (
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all bg-primary"
              style={{ width: `${Math.min((stepsForSelectedDay / dailyStepsGoal) * 100, 100)}%` }}
            />
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Steps"
            inputMode="numeric"
            value={stepsDayInput}
            onChange={(e) => setStepsDayInput(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void saveStepsForSelectedDay()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shrink-0"
          >
            Save
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Daily step goal ({dailyStepsGoal.toLocaleString()}) is stored on your profile. You can also log steps from Progress.
        </p>
      </div>

      {dayNutrientDetailRows.length > 0 ? (
        <div className="mb-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Nutrients</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {dayNutrientDetailRows.map((row) => (
              <div
                key={row.key}
                className="rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <p className="text-[10px] text-muted-foreground">{row.label}</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 4. Quick Log Strip: 5 action chips — Search, Voice (Pro), Snap (Pro),
          Scan, Photo (legacy free). Voice + Snap are gated; free-tier users
          see a lock icon and tapping opens the factual Pro paywall
          (Batch 5.13). */}
      <div className="flex gap-2 mb-5">
        {/* Search chip */}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex-1 flex-col items-center gap-1.5 p-2.5 rounded-xl bg-card border border-border hover:border-warning/40 transition-colors flex"
        >
          <IconBox size="sm" tone="warning">
            <Icons.search />
          </IconBox>
          <span className="text-[10px] font-medium text-muted-foreground">Search</span>
        </button>

        {/* Voice chip (Pro) */}
        <button
          type="button"
          onClick={handleVoiceLog}
          aria-label={userTier === "pro" ? "Open voice log" : "Voice log — Pro feature"}
          className="flex-1 flex-col items-center gap-1.5 p-2.5 rounded-xl bg-card border border-border hover:border-success/40 transition-colors flex relative"
        >
          <IconBox size="sm" tone="success">
            <Icons.mic />
          </IconBox>
          <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
            Voice
            {userTier !== "pro" && (
              <Icons.lock className="size-2.5" aria-hidden />
            )}
          </span>
        </button>

        {/* Snap chip (Pro — AI photo logging) */}
        <button
          type="button"
          onClick={handlePhotoLogClick}
          aria-label={userTier === "pro" ? "Open AI photo log" : "AI photo log — Pro feature"}
          className="flex-1 flex-col items-center gap-1.5 p-2.5 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors flex relative"
        >
          <IconBox size="sm" tone="primary">
            <Icons.camera />
          </IconBox>
          <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
            Snap
            {userTier !== "pro" && (
              <Icons.lock className="size-2.5" aria-hidden />
            )}
          </span>
        </button>

        {/* Scan chip */}
        <button
          type="button"
          onClick={() => setBarcodeOpen(true)}
          className="flex-1 flex-col items-center gap-1.5 p-2.5 rounded-xl bg-card border border-border hover:border-fat/40 transition-colors flex"
        >
          <IconBox size="sm" tone="fat">
            <Icons.scan />
          </IconBox>
          <span className="text-[10px] font-medium text-muted-foreground">Scan</span>
        </button>
      </div>


      {/* Quick add panel — Favourites / Frequent / Recent / My meals tabs
          with one-tap log. Batch 2.6 adds "My meals" for saved combos. */}
      <QuickAddPanel
        className="mb-4"
        byDay={nutritionByDay}
        activeSlot={mealSlot}
        supabase={supabase}
        userId={authedUserId ?? ""}
        onLog={(item) => logHistoryItem(item, mealSlot)}
        onLogSavedMeal={(meal, slot) => logSavedMeal(meal, slot)}
      />

      {/* 5. Meals Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Meals</h3>
          {mealsForSelectedDate.length > 0 && (
            <button
              type="button"
              onClick={() => setDuplicateDayOpen(true)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-md border border-border bg-card"
              aria-label="Duplicate this day to another day"
            >
              <Icons.copyPlus className="w-3.5 h-3.5" />
              Duplicate day…
            </button>
          )}
        </div>
        <div className="rounded-card bg-card border border-border overflow-hidden">
          {mealsGrouped.map(({ name: sectionName, meals: sectionMeals }) => {
            const consumed: Record<string, number> = {};
            for (const gm of mealsGrouped) {
              const cals = gm.meals.reduce((a, m) => a + scaledMacro(m.calories, m.portionMultiplier ?? 1), 0);
              if (cals > 0) consumed[gm.name] = cals;
            }
            const budgets = distributeMealBudget(effectiveCalorieTarget, targets.fiber, consumed);
            const slotBudget = budgets.find((b) => b.slot === sectionName);

            // Meal icon selection — matches mobile prototype
            const getMealIcon = (name: string) => {
              if (name === "Breakfast") return { icon: Icons.breakfast, tone: "warning" as const };
              if (name === "Lunch") return { icon: Icons.lunch, tone: "success" as const };
              if (name === "Dinner") return { icon: Icons.dinner, tone: "primary" as const };
              if (name === "Snacks") return { icon: Icons.snack, tone: "fat" as const };
              return { icon: Icons.add, tone: "primary" as const };
            };

            const mealIconInfo = getMealIcon(sectionName);

            return (
              <div key={sectionName} className="border-b border-border last:border-b-0">
                {/* Meal header row */}
                <div
                  className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border cursor-pointer select-none"
                  onClick={() => toggleSlot(sectionName)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSlot(sectionName); } }}
                  aria-expanded={!collapsedSlots.has(sectionName)}
                >
                  <IconBox size="sm" tone={mealIconInfo.tone}>
                    <mealIconInfo.icon />
                  </IconBox>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{sectionName}</p>
                    <p className="text-[11px] text-muted-foreground">{sectionMeals.length} item{sectionMeals.length !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="text-sm font-bold text-foreground tabular-nums">
                    {Math.round(sectionMeals.reduce((sum, m) => sum + scaledMacro(m.calories, m.portionMultiplier ?? 1), 0))}
                  </span>
                  <span className="text-[10px] text-muted-foreground mr-1">kcal</span>
                  {/* Batch 2.6 — "Save these as a meal" when the slot has 2+ items. */}
                  {sectionMeals.length >= 2 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openSaveMealDialog(sectionName); }}
                      className="mr-1 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40"
                      aria-label={`Save ${sectionName} items as a meal combo`}
                      title="Save these as a meal"
                    >
                      Save combo
                    </button>
                  )}
                  <Icons.down className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${collapsedSlots.has(sectionName) ? "-rotate-90" : ""}`} />
                </div>

                {/* Expanded meal items */}
                {!collapsedSlots.has(sectionName) && sectionMeals.length > 0 && (
                  <div>
                    {sectionMeals.map((meal) => (
                      <div key={meal.id} className="flex items-center justify-between px-4 py-2.5 border-b border-border/10" style={{ paddingLeft: 56 }}>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                          <span className="text-xs text-foreground truncate">{meal.recipeTitle}</span>
                          {meal.source && (
                            <NutritionSourceBadge source={meal.source} />
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs text-muted-foreground tabular-nums">{Math.round(meal.calories)}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground px-1"
                                aria-label={`More actions for ${meal.recipeTitle}`}
                              >
                                <Icons.more className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => setCopyMealTargetId(meal.id)}
                              >
                                Copy to another day…
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => { if (window.confirm(`Remove "${meal.recipeTitle}"?`)) removeLoggedMeal(meal.id); }}
                                className="text-destructive focus:text-destructive"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty meal: dimmed slot with "Tap to add" matching mobile */}
                {!collapsedSlots.has(sectionName) && sectionMeals.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMealSlot(sectionName);
                      setAddOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-3 opacity-45 hover:opacity-70 transition-opacity"
                  >
                    <span className="size-7 rounded-lg bg-muted flex items-center justify-center">
                      <Icons.add className="size-3.5 text-muted-foreground" />
                    </span>
                    <span className="text-xs text-muted-foreground">Tap to add</span>
                  </button>
                )}
              </div>
            );
          })}

          {mealsForSelectedDate.length === 0 && (
            <div className="py-8">
              {/* Quick-log from plan if plan exists for day 1 */}
              {mealPlan &&
              mealPlan.length > 0 &&
              mealPlan[0]!.meals.filter(
                (m) => !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }),
              ).length > 0 ? (
                <div className="mb-6">
                  <p className="text-sm font-medium text-muted-foreground mb-3 text-center">Log from today&apos;s plan</p>
                  <div className="space-y-2">
                    {mealPlan[0]!.meals
                      .filter(
                        (m) => !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }),
                      )
                      .map((meal, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          addLoggedMealForDate(selectedDateKey, {
                            name: normalizeJournalSlotName(meal.name),
                            recipeTitle: meal.recipeTitle,
                            time: normalizeJournalSlotName(meal.name),
                            calories: meal.calories,
                            protein: meal.protein,
                            carbs: meal.carbs,
                            fat: meal.fat,
                            source: "Meal plan",
                          });
                          toast.success(`Logged ${meal.recipeTitle}`);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors text-left"
                      >
                        <div>
                          <span className="text-xs font-medium text-primary">{meal.name}</span>
                          <p className="text-sm font-medium text-foreground">{meal.recipeTitle}</p>
                        </div>
                        <span className="text-xs font-mono tabular-nums text-muted-foreground">{Math.round(meal.calories)} kcal</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="text-center">
                <p className="mb-4 text-muted-foreground">
                  {mealPlan && mealPlan.length > 0 ? "Or add a custom meal" : "No meals logged on this day"}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-pm hover:bg-primary/90"
                  >
                    <Icons.add className="h-5 w-5" />
                    {mealPlan && mealPlan.length > 0 ? "Add custom meal" : "Log your first meal"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePhotoLogClick}
                    aria-label={
                      userTier === "pro"
                        ? "AI photo log — snap a meal for nutrition estimates"
                        : "AI photo log — Pro feature"
                    }
                    title="Photos are sent to our servers and processed with AI to estimate nutrition. Pro only."
                    className="inline-flex items-center gap-2 rounded-xl border border-primary/30 px-5 py-3 font-semibold text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Icons.camera className="h-5 w-5" />
                    Photo log
                    {userTier !== "pro" && (
                      <Icons.lock className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleVoiceLog}
                    aria-label={
                      userTier === "pro" ? "Record voice log" : "Voice log — Pro feature"
                    }
                    title="Voice and typed descriptions are processed with AI on our servers. Pro only."
                    className="inline-flex items-center gap-2 rounded-xl border border-primary/30 px-5 py-3 font-semibold text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Icons.mic className="h-5 w-5" />
                    Voice log
                    {userTier !== "pro" && (
                      <Icons.lock className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Streak Insight Card */}
      {streakDays > 0 && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-success/20 bg-success-soft">
          <IconBox size="lg" tone="success">
            <Icons.streak />
          </IconBox>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-success">
              {streakDays}-day logging streak
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              You&apos;ve logged meals {streakDays} day{streakDays !== 1 ? "s" : ""} in a row.
            </p>
            {freezesAvailableToday > 0 ? (
              <p
                className="text-[11px] text-primary mt-0.5 inline-flex items-center gap-1"
                aria-label={`${freezesAvailableToday} streak freeze${freezesAvailableToday === 1 ? "" : "s"} available`}
              >
                <Icons.streakFreeze className="h-3 w-3" aria-hidden />
                {freezesAvailableToday} freeze{freezesAvailableToday === 1 ? "" : "s"} available
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Activity Bonus */}
      {hasBurnData && (
        <div className="rounded-xl border border-border bg-card p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Icons.calories className="h-5 w-5 text-warning" />
            <h3 className="text-sm font-bold text-foreground">Activity Bonus</h3>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div>
              <p className="text-lg font-extrabold text-foreground tabular-nums">{totalBurnKcal.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Total burn</p>
            </div>
            <div className="border-x border-border">
              <p className="text-lg font-extrabold text-foreground tabular-nums">{effectiveCalorieTarget > 0 ? effectiveCalorieTarget.toLocaleString() : "—"}</p>
              <p className="text-[10px] text-muted-foreground">Target intake</p>
            </div>
            <div>
              {(() => {
                const deficit = totalBurnKcal - totals.calories;
                const isDeficit = deficit >= 0;
                return (
                  <>
                    <p className={`text-lg font-extrabold tabular-nums ${isDeficit ? "text-success" : "text-destructive"}`}>{Math.abs(deficit).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{isDeficit ? "Under" : "Over"}</p>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Burn breakdown */}
          <div className="space-y-1 mb-3 text-xs">
            {basalBurnKcal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Resting energy</span>
                <span className="font-semibold text-foreground tabular-nums">{basalBurnKcal.toLocaleString()} kcal</span>
              </div>
            )}
            {activityBurnForSelectedDay > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active energy</span>
                <span className="font-semibold text-foreground tabular-nums">{activityBurnForSelectedDay.toLocaleString()} kcal</span>
              </div>
            )}
          </div>

          {/* Workouts */}
          {dayWorkouts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">Workouts</p>
              {dayWorkouts.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                  <Icons.dumbbell className="h-4 w-4 text-primary" />
                  <span className="flex-1 text-foreground">{w.type}</span>
                  {w.minutes > 0 && <span className="text-muted-foreground tabular-nums">{w.minutes} min</span>}
                  {w.calories > 0 && <span className="font-semibold text-warning tabular-nums">{w.calories} kcal</span>}
                </div>
              ))}
            </div>
          )}

          {/* Weekly deficit summary */}
          {(() => {
            let weekBurn = 0;
            let weekConsumed = 0;
            for (const dk of trackerWeekSummaryKeys) {
              const activeKcal =
                activityBurnByDay[dk] ?? (dk === selectedDateKey ? activityBurnKcal : 0);
              weekBurn += activeKcal + (basalBurnByDay[dk] ?? 0);
              const dayMeals = nutritionByDay[dk] ?? [];
              weekConsumed += dayMeals.reduce((s, m) => s + Math.max(0, m.calories ?? 0), 0);
            }
            if (weekBurn === 0) return null;
            const weekDeficit = weekBurn - weekConsumed;
            const dailyAvgDeficit = Math.round(weekDeficit / 7);
            const weeklyKgRate = (Math.abs(weekDeficit) / 3500) * 0.4536;
            const weeklyMassLabel =
              profileMeasurementSystem === "imperial"
                ? `${(Math.round(kgToLb(weeklyKgRate) * 10) / 10).toFixed(1)} lb`
                : `${weeklyKgRate.toFixed(2)} kg`;
            const isDeficit = weekDeficit >= 0;
            return (
              <div className="mt-3 pt-3 border-t border-border space-y-1 text-xs">
                <p className="font-semibold text-foreground mb-1.5">{weekSummaryHeading(weekSummaryMode)}</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg daily {isDeficit ? "deficit" : "surplus"}</span>
                  <span className={`font-semibold tabular-nums ${isDeficit ? "text-success" : "text-destructive"}`}>{Math.abs(dailyAvgDeficit).toLocaleString()} kcal</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weekly {isDeficit ? "deficit" : "surplus"}</span>
                  <span className={`font-semibold tabular-nums ${isDeficit ? "text-success" : "text-destructive"}`}>{Math.abs(weekDeficit).toLocaleString()} kcal</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Projected weekly {isDeficit ? "loss" : "gain"}</span>
                  <span className={`font-semibold tabular-nums ${isDeficit ? "text-success" : "text-destructive"}`}>{weeklyMassLabel}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Complete Day */}
      {selectedDateKey === todayKey() && mealsForSelectedDate.length > 0 && (
        <button
          onClick={() => setCompleteDayOpen(true)}
          className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity mt-4"
        >
          Complete Day
        </button>
      )}

      {/* Fasting — full timer on /fasting */}
      <div className="mt-4 flex flex-col items-center gap-2">
        {activeFast && fastingElapsedLabel ? (
          <Link
            href="/fasting"
            className="inline-flex flex-row items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold text-sm text-primary bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
          >
            <Icons.timer className="w-4 h-4 shrink-0" aria-hidden />
            Fasting — {fastingElapsedLabel}
          </Link>
        ) : (
          <Link href="/fasting" className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
            Intermittent fasting timer
          </Link>
        )}
      </div>
      </>
      )}

      {/* Complete Day Dialog */}
      <Dialog open={completeDayOpen} onOpenChange={setCompleteDayOpen}>
        <DialogContent className="bg-card border-border text-center max-w-sm">
          <div className="flex flex-col items-center py-4">
            <DialogHeader className="sr-only">
              <DialogTitle>Day logged!</DialogTitle>
              <DialogDescription>Weight projection based on today's intake</DialogDescription>
            </DialogHeader>
            <p className="text-lg font-bold text-foreground mb-6">Day logged!</p>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: "var(--primary-soft, rgba(76,108,224,0.12))" }}>
              <Icons.check className="w-10 h-10 text-primary" />
            </div>
            {profileWeightKg != null && totals.calories > 0 ? (() => {
              const prediction = projectWeight({
                currentWeightKg: profileWeightKg,
                todayCalories: totals.calories,
                targetCalories: normalizeMacroTargets(nutritionTargets).calories,
                goal: profileGoal,
              });
              const projectedLabel =
                profileMeasurementSystem === "imperial"
                  ? `${Math.round(kgToLb(prediction.projectedWeightKg) * 10) / 10} lb`
                  : `${prediction.projectedWeightKg} kg`;
              return (
                <>
                  <p className="text-lg font-bold text-foreground leading-relaxed mb-2 px-4">
                    {"At today's pace, your projected weight in "}
                    {prediction.projectionWeeks} weeks is{" "}
                    <span className="text-primary">{projectedLabel}</span>.
                  </p>
                  <p className="text-xs text-muted-foreground mb-6 px-4">
                    This is a rough estimate based on net calories for this day. Actual results may vary.
                  </p>
                </>
              );
            })() : (
              <p className="text-sm text-muted-foreground mb-6 px-4">
                Great work logging today! Set your weight in your profile to see weight projections here.
              </p>
            )}
            <button
              onClick={() => {
                setCompleteDayOpen(false);
                onOpenProgress?.();
              }}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity"
            >
              View my progress
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setAddMode("recipe");
            setFoodQuery("");
            setFoodHits(null);
            setFoodSelected(null);
            setFoodGrams(100);
            setRecipePortionMultiplier(1);
          }
        }}
      >
        <DialogContent className="bg-card border-border max-h-[90vh] min-h-[28rem] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Log a meal</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add macros for {selectedDate.toLocaleDateString()} from a saved recipe, the catalog, or enter food manually.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex rounded-lg border border-border p-1 bg-muted/50">
              <button
                type="button"
                onClick={() => setAddMode("recipe")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  addMode === "recipe"
                    ? "bg-card shadow text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Recipe
              </button>
              <button
                type="button"
                onClick={() => setAddMode("manual")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  addMode === "manual"
                    ? "bg-card shadow text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Manual food
              </button>
              <button
                type="button"
                onClick={() => setAddMode("search")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  addMode === "search"
                    ? "bg-card shadow text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Search
              </button>
            </div>
            <label className="grid gap-1">
              <span className="text-sm font-medium text-foreground">Meal</span>
              <select
                value={mealSlot}
                onChange={(e) => setMealSlot(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
              >
                {["Breakfast", "Lunch", "Dinner", "Snacks"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {addMode === "recipe" ? (
              <>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-foreground">Recipe</span>
                  <select
                    value={recipeId}
                    onChange={(e) => setRecipeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                    disabled={!recipeOptions.length}
                  >
                    {recipeOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                  {savedRecipesForLibrary.length === 0 && (
                    <span className="text-xs text-muted-foreground">Save recipes from Discover to see them here.</span>
                  )}
                </label>
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2 bg-muted/40">
                  <span className="text-sm font-medium text-foreground">Portions</span>
                  <span className="text-xs text-muted-foreground max-w-[14rem]">
                    1 = just you · 2 = shared (partner, family plate, double batch)
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      type="button"
                      aria-label="Fewer portions"
                      onClick={() => setRecipePortionMultiplier((m) => clampPortionMultiplier(m - 0.5))}
                      className="w-9 h-9 rounded-lg border border-border text-lg font-semibold text-foreground hover:bg-muted/60"
                    >
                      −
                    </button>
                    <span className="min-w-[3rem] text-center text-sm font-semibold text-foreground">
                      {recipePortionMultiplier === Math.floor(recipePortionMultiplier)
                        ? recipePortionMultiplier
                        : recipePortionMultiplier.toFixed(1)}
                      ×
                    </span>
                    <button
                      type="button"
                      aria-label="More portions"
                      onClick={() => setRecipePortionMultiplier((m) => clampPortionMultiplier(m + 0.5))}
                      className="w-9 h-9 rounded-lg border border-border text-lg font-semibold text-foreground hover:bg-muted/60"
                    >
                      +
                    </button>
                  </div>
                </div>
              </>
            ) : addMode === "search" ? (
              <div className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Food search</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={foodQuery}
                    onChange={(e) => setFoodQuery(e.target.value)}
                    placeholder="e.g. chicken breast, rice cooked"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={foodLoading}
                    onClick={() => {
                      const q = effectiveFoodSearchQuery(foodQuery.trim());
                      if (!q) return;
                      setFoodLoading(true);
                      setFoodSelected(null);
                      fetch(`/api/usda/search?q=${encodeURIComponent(q)}`)
                        .then((r) => r.json())
                        .then((data: { ok?: boolean; hits?: UsdaHit[]; message?: string }) => {
                          if (!data.ok || !data.hits) {
                            toast.error(data.message ?? "Food search failed");
                            return;
                          }
                          setFoodHits(data.hits.slice(0, 10));
                        })
                        .catch(() => toast.error("Food search failed"))
                        .finally(() => setFoodLoading(false));
                    }}
                  >
                    {foodLoading ? "…" : "Go"}
                  </Button>
                </div>

                {foodHits?.length ? (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {foodHits.map((h) => (
                      <button
                        key={h.fdcId}
                        type="button"
                        className="w-full text-left p-3 hover:bg-muted/60/40"
                        onClick={() => {
                          setFoodLoading(true);
                          fetch(`/api/usda/food?fdcId=${h.fdcId}`)
                            .then((r) => r.json())
                            .then((data: { ok?: boolean; message?: string } & Partial<UsdaFoodDetails>) => {
                              if (!data.ok || !data.macrosPer100g || !data.description) {
                                toast.error(data.message ?? "Could not load food details");
                                return;
                              }
                              setFoodSelected({
                                fdcId: data.fdcId!,
                                description: data.description!,
                                macrosPer100g: data.macrosPer100g!,
                              });
                            })
                            .catch(() => toast.error("Could not load food details"))
                            .finally(() => setFoodLoading(false));
                        }}
                      >
                        <div className="text-sm font-medium text-foreground truncate">{h.description}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {h.dataType ?? "Food"}
                          {h.brandName ? ` · ${h.brandName}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}

                {foodSelected ? (
                  <div className="rounded-lg border border-border p-3 bg-muted/40">
                    <div className="text-sm font-semibold text-foreground truncate">{foodSelected.description}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-foreground w-16">Grams</span>
                      <input
                        type="number"
                        min={1}
                        value={foodGrams}
                        onChange={(e) => setFoodGrams(Number(e.target.value))}
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                      />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {(() => {
                        const g = Math.max(1, Math.round(foodGrams) || 1);
                        const mult = g / 100;
                        const m = foodSelected.macrosPer100g;
                        return `${Math.round(m.calories * mult)} kcal · ${Math.round(m.protein * mult)}P · ${Math.round(
                          m.carbs * mult,
                        )}C · ${Math.round(m.fat * mult)}F`;
                      })()}
                    </div>
                    {/* Fit-this-in preview — parity with mobile FoodSearchModal. */}
                    <RemainingMacrosBar
                      className="mt-2"
                      targets={{
                        calories: effectiveCalorieTarget,
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
                      candidate={(() => {
                        const g = Math.max(1, Math.round(foodGrams) || 1);
                        const mult = g / 100;
                        const m = foodSelected.macrosPer100g;
                        return {
                          calories: m.calories * mult,
                          protein: m.protein * mult,
                          carbs: m.carbs * mult,
                          fat: m.fat * mult,
                          fiber: (m.fiberG ?? 0) * mult,
                        };
                      })()}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-foreground">Food name</span>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="e.g. Greek yogurt with berries"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-foreground">Calories</span>
                    <input
                      type="number"
                      min={0}
                      value={manualCalories || ""}
                      onChange={(e) => setManualCalories(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-foreground">Protein (g)</span>
                    <input
                      type="number"
                      min={0}
                      value={manualProtein || ""}
                      onChange={(e) => setManualProtein(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-foreground">Carbs (g)</span>
                    <input
                      type="number"
                      min={0}
                      value={manualCarbs || ""}
                      onChange={(e) => setManualCarbs(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-foreground">Fat (g)</span>
                    <input
                      type="number"
                      min={0}
                      value={manualFat || ""}
                      onChange={(e) => setManualFat(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-foreground">Fiber (g)</span>
                    <input
                      type="number"
                      min={0}
                      value={manualFiber || ""}
                      onChange={(e) => setManualFiber(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-foreground">Water (ml)</span>
                    <input
                      type="number"
                      min={0}
                      value={manualWater || ""}
                      onChange={(e) => setManualWater(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                    />
                  </label>
                </div>
              </>
            )}
            <label className="grid gap-1">
              <span className="text-sm font-medium text-foreground">Time</span>
              <input
                type="text"
                value={timeLabel}
                onChange={(e) => setTimeLabel(e.target.value)}
                placeholder="e.g. 12:30 PM"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddMeal}>
              Add meal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
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
      >
        <DialogContent className="bg-card border-border">
          {!barcodePreview ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">Barcode (Open Food Facts)</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Enter a barcode. On the next screen you can fix the product name, meal, portion, or override calories and
                  macros if the match is wrong.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-foreground">Barcode</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={barcodeValue}
                    onChange={(e) => setBarcodeValue(e.target.value.replace(/\D/g, ""))}
                    placeholder="8–13 digits"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card"
                  />
                </label>
                {recentFoods.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground w-full">Recent:</span>
                    {recentFoods.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/70"
                        onClick={() => {
                          addLoggedMeal({
                            name: "Snacks",
                            recipeTitle: n,
                            time: timeLabel,
                            calories: 0,
                            protein: 0,
                            carbs: 0,
                            fat: 0,
                            source: "Manual",
                          });
                          setBarcodeOpen(false);
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setBarcodeOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={barcodeBusy}
                  onClick={async () => {
                    setBarcodeBusy(true);
                    try {
                      const result = await fetchProductByBarcode(barcodeValue);
                      if (!result.ok) {
                        toast.error(
                          result.error === "not_found"
                            ? "Product not found"
                            : result.error === "invalid"
                              ? "Enter a valid barcode"
                              : "Could not reach Open Food Facts",
                        );
                        return;
                      }
                      const p = result.product;
                      setBarcodePreview(p);
                      setBarcodeTitleOverride(p.name);
                      setBarcodeMacrosManual(false);
                      setBarcodeEditCal("");
                      setBarcodeEditPro("");
                      setBarcodeEditCarb("");
                      setBarcodeEditFat("");
                      setBarcodeGramsStr(
                        typeof p.servingSizeG === "number" && p.servingSizeG > 0
                          ? String(Math.round(p.servingSizeG * 10) / 10)
                          : "100",
                      );
                    } finally {
                      setBarcodeBusy(false);
                    }
                  }}
                >
                  {barcodeBusy ? "Looking up…" : "Look up"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            barcodePreview && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground">Review & log</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Open Food Facts can mismatch your package or have wrong macros. Fix the name or values here, or try
                    another barcode.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto pr-0.5">
                  {(() => {
                    const p = barcodePreview;
                    const scaled = scaleFromPer100gGrams(p, barcodeGramsParsed);
                    const portion = barcodePortionLabel(p, barcodeGramsParsed);
                    const titleForLog = barcodeTitleOverride.trim() || p.name;
                    return (
                      <>
                        <label className="grid gap-1">
                          <span className="text-sm font-medium text-foreground">Food name</span>
                          <input
                            type="text"
                            value={barcodeTitleOverride}
                            onChange={(e) => setBarcodeTitleOverride(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                            placeholder={p.name}
                          />
                          <span className="text-[11px] text-muted-foreground">
                            Shown on your diary; does not change the database.
                          </span>
                        </label>
                        <label className="grid gap-1">
                          <span className="text-sm font-medium text-foreground">Meal</span>
                          <select
                            value={mealSlot}
                            onChange={(e) => setMealSlot(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                          >
                            {["Breakfast", "Lunch", "Dinner", "Snacks"].map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
                          <Checkbox
                            id="barcode-macros-manual"
                            checked={barcodeMacrosManual}
                            className="mt-0.5"
                            onCheckedChange={(c) => {
                              const on = c === true;
                              setBarcodeMacrosManual(on);
                              if (on) {
                                const s = scaleFromPer100gGrams(p, barcodeGramsParsed);
                                setBarcodeEditCal(String(s.calories));
                                setBarcodeEditPro(String(s.protein));
                                setBarcodeEditCarb(String(s.carbs));
                                setBarcodeEditFat(String(s.fat));
                              }
                            }}
                          />
                          <label htmlFor="barcode-macros-manual" className="text-sm leading-snug cursor-pointer">
                            <span className="font-medium text-foreground">Edit calories & macros</span>
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              Overrides label math for this entry only. Turn on if the pack values do not match what
                              you scanned.
                            </span>
                          </label>
                        </div>

                        {!barcodeMacrosManual ? (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{scaled.calories}</span> kcal · P{" "}
                            {scaled.protein}g · C {scaled.carbs}g · F {scaled.fat}g
                            {scaled.fiberG > 0 ? ` · Fiber ${scaled.fiberG}g` : ""}
                            <span className="block text-[11px] mt-1">From label per 100 g × grams below.</span>
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="grid gap-1 col-span-2 sm:col-span-1">
                              <span className="text-xs font-medium text-foreground">Calories (kcal)</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={barcodeEditCal}
                                onChange={(e) => setBarcodeEditCal(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                              />
                            </label>
                            <label className="grid gap-1 col-span-2 sm:col-span-1">
                              <span className="text-xs font-medium text-foreground">Protein (g)</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={barcodeEditPro}
                                onChange={(e) => setBarcodeEditPro(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                              />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-xs font-medium text-foreground">Carbs (g)</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={barcodeEditCarb}
                                onChange={(e) => setBarcodeEditCarb(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                              />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-xs font-medium text-foreground">Fat (g)</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={barcodeEditFat}
                                onChange={(e) => setBarcodeEditFat(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                              />
                            </label>
                          </div>
                        )}

                        <label className="grid gap-1">
                          <span className="text-sm font-medium text-foreground">Portion (grams)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={barcodeGramsStr}
                            onChange={(e) => setBarcodeGramsStr(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                          />
                          <span className="text-[11px] text-muted-foreground">
                            Used for the serving note in your diary
                            {!barcodeMacrosManual ? " and to scale macros from the label" : ""}.
                          </span>
                        </label>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Quick picks</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {p.servingOptions.map((o) => {
                              const selected = Math.abs(o.grams - barcodeGramsParsed) < 0.51;
                              return (
                                <button
                                  key={`${o.label}-${o.grams}`}
                                  type="button"
                                  onClick={() => setBarcodeGramsStr(String(o.grams))}
                                  className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                                    selected
                                      ? "border-primary bg-primary/15 text-foreground"
                                      : "border-border bg-muted/40 hover:bg-muted"
                                  }`}
                                >
                                  {o.label}
                                </button>
                              );
                            })}
                            {[50, 150, 200]
                              .filter((g) => !p.servingOptions.some((o) => Math.abs(o.grams - g) < 0.51))
                              .map((g) => {
                                const selected = Math.abs(g - barcodeGramsParsed) < 0.51;
                                return (
                                  <button
                                    key={`g-${g}`}
                                    type="button"
                                    onClick={() => setBarcodeGramsStr(String(g))}
                                    className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                                      selected
                                        ? "border-primary bg-primary/15 text-foreground"
                                        : "border-border bg-muted/40 hover:bg-muted"
                                    }`}
                                  >
                                    {g} g
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Diary line: <span className="font-medium text-foreground">{titleForLog}</span> ({portion})
                        </p>
                      </>
                    );
                  })()}
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setBarcodePreview(null);
                      setBarcodeMacrosManual(false);
                      setBarcodeEditCal("");
                      setBarcodeEditPro("");
                      setBarcodeEditCarb("");
                      setBarcodeEditFat("");
                    }}
                  >
                    Try another barcode
                  </Button>
                  <div className="flex w-full sm:w-auto gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setBarcodeOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        const p = barcodePreview;
                        if (!p) return;
                        const portion = barcodePortionLabel(p, barcodeGramsParsed);
                        const titleForLog = barcodeTitleOverride.trim() || p.name;
                        const scaled = scaleFromPer100gGrams(p, barcodeGramsParsed);
                        let calories: number;
                        let protein: number;
                        let carbs: number;
                        let fat: number;
                        let fiberG: number | undefined;
                        if (barcodeMacrosManual) {
                          const c = Number.parseInt(barcodeEditCal.replace(/\s/g, ""), 10);
                          const pr = parseNonnegNumber(barcodeEditPro);
                          const cb = parseNonnegNumber(barcodeEditCarb);
                          const ft = parseNonnegNumber(barcodeEditFat);
                          if (!Number.isFinite(c) || c < 0 || c > 50_000) {
                            toast.error("Enter a valid calorie amount (0–50000).");
                            return;
                          }
                          if (pr == null || cb == null || ft == null) {
                            toast.error("Enter protein, carbs, and fat (numbers ≥ 0).");
                            return;
                          }
                          calories = c;
                          protein = Math.round(pr * 10) / 10;
                          carbs = Math.round(cb * 10) / 10;
                          fat = Math.round(ft * 10) / 10;
                          fiberG = undefined;
                        } else {
                          calories = scaled.calories;
                          protein = scaled.protein;
                          carbs = scaled.carbs;
                          fat = scaled.fat;
                          fiberG = scaled.fiberG > 0 ? scaled.fiberG : undefined;
                        }
                        const adjusted =
                          barcodeMacrosManual ||
                          titleForLog.trim() !== p.name.trim();
                        pushRecentFood(titleForLog);
                        setRecentFoods(loadRecentFoods());
                        addLoggedMeal({
                          name: mealSlot,
                          recipeTitle: `${titleForLog} (${portion})`,
                          time: timeLabel,
                          calories,
                          protein,
                          carbs,
                          fat,
                          source: adjusted ? "Open Food Facts (adjusted)" : "Open Food Facts",
                          ...(fiberG != null && fiberG > 0 ? { fiberG } : {}),
                        });
                        setBarcodeOpen(false);
                        toast.success("Logged from barcode");
                        track(AnalyticsEvents.barcode_lookup, { ok: true, adjusted });
                      }}
                    >
                      Add to diary
                    </Button>
                  </div>
                </DialogFooter>
              </>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Batch 5.13 — Voice log (Pro). Shared review/edit flow. */}
      <VoiceLogDialog
        open={voiceLogOpen}
        onOpenChange={setVoiceLogOpen}
        activeSlot={mealSlot}
        onCommit={commitAiLoggedItems}
      />

      {/* Batch 5.13 — AI photo log (Pro). */}
      <PhotoLogDialog
        open={photoLogOpen}
        onOpenChange={setPhotoLogOpen}
        activeSlot={mealSlot}
        onCommit={commitAiLoggedItems}
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
    </div>
  );
});
