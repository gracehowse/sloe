import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  TrendingUp,
  Target,
  Award,
  Trash2,
  Package,
  Droplets,
  Activity,
  Search,
  Camera,
  Mic,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { RECIPE_CATALOG } from "../../data/recipeCatalog.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { normalizeMacroTargets } from "../../types/profile.ts";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.tsx";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";
import { fetchProductByBarcode } from "../../lib/openFoodFacts/fetchProductByBarcode.ts";
import {
  computeCalorieGoalFitPercent,
  computeLoggingStreak,
  computeWeekFiberWaterHits,
  computeWeekLoggedDays,
} from "../../lib/nutrition/trackerStats.ts";
import { buildNutritionCsvForDay, downloadCsvFile } from "../../lib/nutrition/exportNutritionCsv.ts";
import NutritionSourceBadge from "../../components/NutritionSourceBadge.tsx";
import {
  clampPortionMultiplier,
  effectivePortionMultiplier,
  scaledMacro,
} from "../../lib/nutrition/portionMultiplier.ts";
import { formatWaterMl } from "../../lib/units/imperial.ts";
import { TrackerSummaryCard } from "./TrackerSummaryCard.tsx";
import { TodayAtAGlance } from "./TodayAtAGlance.tsx";
import { CalorieDeficitInsight } from "./CalorieDeficitInsight.tsx";
import { distributeMealBudget } from "../../lib/nutrition/mealBudget.ts";

const RECENT_BARCODE_KEY = "platemate-recent-foods-v1";

const MEAL_SECTION_ORDER = ["Breakfast", "Lunch", "Dinner", "Snack", "Planned"];

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

function parseDateKey(key: string): Date {
  const [y, m, day] = key.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function shiftDateKey(key: string, delta: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
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
    mealPlan,
    savedRecipesForLibrary,
    preferActivityAdjustedCalories,
    activityBurnForSelectedDay,
    setActivityBurnForSelectedDay,
    addWaterMlForSelectedDay,
    extraWaterMlForSelectedDay,
    profileMeasurementSystem,
    nutritionByDay,
    extraWaterByDay,
  } = useAppData();

  const useImperialWater = profileMeasurementSystem === "imperial";
  const formatWaterLine = (ml: number) =>
    useImperialWater ? formatWaterMl(ml, true) : ml >= 1000 ? `${(ml / 1000).toFixed(1).replace(/\.0$/, "")}L` : `${ml}ml`;

  const streakDays = useMemo(() => computeLoggingStreak(nutritionByDay), [nutritionByDay]);
  const weekLogged = useMemo(() => computeWeekLoggedDays(nutritionByDay), [nutritionByDay]);
  const goalFit = useMemo(
    () => computeCalorieGoalFitPercent(nutritionByDay, nutritionTargets.calories, 7),
    [nutritionByDay, nutritionTargets.calories],
  );

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

  const [addOpen, setAddOpen] = useState(false);
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
  const headerPhotoInputRef = useRef<HTMLInputElement>(null);
  /** Recipe log: scale catalog/saved recipe macros (1 = solo, 2 = shared dinner, etc.). */
  const [recipePortionMultiplier, setRecipePortionMultiplier] = useState(1);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [voiceText, setVoiceText] = useState("");

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const resp = await fetch("/api/nutrition/photo-log", {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();
      if (resp.status === 403 && data.error === "upgrade_required") {
        toast.error(data.message ?? "Photo meal logging requires a paid plan.");
        return;
      }
      if (!data.ok || !Array.isArray(data.items) || data.items.length === 0) {
        toast.error(data.message ?? "Could not identify food items. Try a clearer photo.");
        return;
      }
      for (const item of data.items) {
        addLoggedMeal({
          name: mealSlot,
          recipeTitle: item.name,
          time: mealSlot,
          calories: Math.round(item.calories),
          protein: Math.round(item.protein),
          carbs: Math.round(item.carbs),
          fat: Math.round(item.fat),
          source: "AI photo",
        });
      }
      toast.success(`Logged ${data.items.length} item${data.items.length > 1 ? "s" : ""} (${data.totalCalories} kcal)`);
    } catch {
      toast.error("Photo logging failed. Please try again.");
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  const submitVoiceTranscriptWeb = async (transcript: string) => {
    if (!transcript.trim()) return;
    try {
      const resp = await fetch("/api/nutrition/voice-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcript.trim() }),
      });
      const data = await resp.json();
      if (resp.status === 403 && data.error === "upgrade_required") {
        toast.error(data.message ?? "Voice meal logging requires a paid plan.");
        return;
      }
      if (!data.ok || !Array.isArray(data.items) || data.items.length === 0) {
        toast.error(data.message ?? "Could not parse your description. Try again.");
        return;
      }
      for (const item of data.items) {
        addLoggedMeal({
          name: mealSlot,
          recipeTitle: item.name,
          time: mealSlot,
          calories: Math.round(item.calories),
          protein: Math.round(item.protein),
          carbs: Math.round(item.carbs),
          fat: Math.round(item.fat),
          source: "AI voice",
        });
      }
      toast.success(`Logged ${data.items.length} item${data.items.length > 1 ? "s" : ""} (${data.totalCalories} kcal) from voice`);
    } catch {
      toast.error("Voice logging failed. Please try again.");
    }
  };

  const handleVoiceLog = async () => {
    const SpeechRecognition = typeof window !== "undefined"
      ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
      : null;

    if (SpeechRecognition) {
      try {
        const transcript = await new Promise<string>((resolve, reject) => {
          const recognition = new SpeechRecognition();
          recognition.lang = "en-US";
          recognition.interimResults = false;
          recognition.maxAlternatives = 1;
          recognition.onresult = (event: any) => {
            resolve(event.results[0][0].transcript);
          };
          recognition.onerror = (event: any) => reject(new Error(event.error));
          recognition.onend = () => resolve("");
          recognition.start();
          toast.info("Listening... Describe what you ate.");
        });
        if (transcript.trim()) {
          await submitVoiceTranscriptWeb(transcript);
        }
        return;
      } catch {
        // Speech recognition failed, fall through to text dialog
      }
    }

    setVoiceDialogOpen(true);
  };

  const recipeOptions = useMemo((): RecipeCard[] => {
    const byId = new Map<string, RecipeCard>();
    for (const r of RECIPE_CATALOG) {
      byId.set(r.id, r);
    }
    for (const r of savedRecipesForLibrary) {
      byId.set(r.id, { ...r, isSaved: true });
    }
    return Array.from(byId.values());
  }, [savedRecipesForLibrary]);

  useEffect(() => {
    if (!recipeOptions.length) return;
    if (!recipeId || !recipeOptions.some((r) => r.id === recipeId)) {
      setRecipeId(recipeOptions[0]!.id);
    }
  }, [recipeOptions, recipeId]);

  const selectedDate = useMemo(() => parseDateKey(selectedDateKey), [selectedDateKey]);

  const totals = (() => {
    const raw = mealsForSelectedDate.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.protein,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fat,
        fiber: acc.fiber + (meal.fiberG ?? 0),
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

  const mealsGrouped = useMemo(() => {
    const map = new Map<string, typeof mealsForSelectedDate>();
    for (const m of mealsForSelectedDate) {
      const k = m.name?.trim() || "Other";
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
  const activityAdjustment = preferActivityAdjustedCalories ? activityBurnForSelectedDay : 0;
  const effectiveCalorieTarget = baseCalorieTarget + activityAdjustment;
  const totalWaterMl = totals.waterMl + extraWaterMlForSelectedDay;

  const getProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressTextClass = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 90 && percentage <= 110) {
      return "text-green-600 dark:text-green-400";
    }
    if (percentage > 110) {
      return "text-orange-600 dark:text-orange-400";
    }
    return "text-violet-600 dark:text-violet-400";
  };

  const getProgressBarClass = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 90 && percentage <= 110) {
      return "bg-green-500";
    }
    if (percentage > 110) {
      return "bg-orange-500";
    }
    return "bg-violet-500";
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

  return (
    <div className="max-w-4xl mx-auto px-pm-6 py-pm-8">
      {/* Dense day header — date, nav, primary add */}
      <div className="sticky top-0 z-20 -mx-1 mb-6 border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-white/95 to-white/80 pb-3 backdrop-blur-md dark:from-slate-950/95 dark:to-slate-950/80 px-1 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="shrink-0 rounded-lg bg-gradient-to-br from-green-600 to-emerald-600 p-1.5">
              <Target className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 dark:text-white sm:text-lg">Nutrition</h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenProgress ? (
              <button
                type="button"
                onClick={onOpenProgress}
                className="rounded-lg border border-violet-200 dark:border-violet-800 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40"
              >
                Progress
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setSelectedDateKey((k) => shiftDateKey(k, -1))}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-pm hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setSelectedDateKey(todayKey())}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-pm hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => setSelectedDateKey((k) => shiftDateKey(k, 1))}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-pm hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-pm hover:shadow-md hover:shadow-violet-500/20"
            >
              <Plus className="h-4 w-4" />
              Add food
            </button>
            <input
              ref={headerPhotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              title="Photos are sent to our servers and may be processed with AI to estimate nutrition."
              onChange={handlePhotoUpload}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition-pm hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  aria-label="More actions: photo, voice, export"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[10rem]">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    headerPhotoInputRef.current?.click();
                  }}
                >
                  <Camera className="h-4 w-4" />
                  Photo (AI)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    handleVoiceLog();
                  }}
                >
                  <Mic className="h-4 w-4" />
                  Voice (AI)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    const csv = buildNutritionCsvForDay(
                      selectedDateKey,
                      mealsForSelectedDate,
                      extraWaterMlForSelectedDay,
                    );
                    downloadCsvFile(`platemate-${selectedDateKey}.csv`, csv);
                  }}
                >
                  Export CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Day-of-week strip */}
      {(() => {
        const d = parseDateKey(selectedDateKey);
        const dow = d.getDay();
        const monOff = dow === 0 ? -6 : 1 - dow;
        const mon = new Date(d);
        mon.setDate(d.getDate() + monOff);
        const today = todayKey();
        const labels = ["M","T","W","T","F","S","S"];
        return (
          <div className="flex gap-1.5 mb-6">
            {labels.map((l, i) => {
              const dd = new Date(mon);
              dd.setDate(mon.getDate() + i);
              const dk = shiftDateKey(
                `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`,
                0,
              );
              const isSel = dk === selectedDateKey;
              const isToday = dk === today;
              const hasLogs = (nutritionByDay[dk] ?? []).length > 0;
              return (
                <button
                  key={dk}
                  type="button"
                  onClick={() => setSelectedDateKey(dk)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                    isSel
                      ? "bg-violet-600 text-white"
                      : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className={`text-[10px] font-semibold ${isSel ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}>{l}</span>
                  <span className={`text-xs font-bold ${
                    isSel ? "text-white" : isToday ? "text-violet-600 dark:text-violet-400" : "text-slate-700 dark:text-slate-300"
                  }`}>
                    {dd.getDate()}
                  </span>
                  {hasLogs && !isSel && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  {hasLogs && isSel && <span className="w-1.5 h-1.5 rounded-full bg-white/70" />}
                  {!hasLogs && <span className="w-1.5 h-1.5" />}
                </button>
              );
            })}
          </div>
        );
      })()}

      <TodayAtAGlance
        dateLabel={selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        caloriesEaten={totals.calories}
        calorieGoalNet={effectiveCalorieTarget}
        proteinEaten={totals.protein}
        proteinGoal={targets.protein}
        carbsEaten={totals.carbs}
        carbsGoal={targets.carbs}
        fatEaten={totals.fat}
        fatGoal={targets.fat}
        fiberEaten={totals.fiber}
        fiberGoal={targets.fiber}
        waterEatenLabel={formatWaterLine(totalWaterMl)}
        waterGoalLabel={formatWaterLine(targets.waterMl)}
        preferActivityAdjusted={preferActivityAdjustedCalories}
        activityBurnKcal={activityBurnForSelectedDay}
        baseCalorieGoal={baseCalorieTarget}
        streakDays={streakDays}
      />

      <CalorieDeficitInsight
        nutritionByDay={nutritionByDay}
        selectedDateKey={selectedDateKey}
        caloriesEatenToday={totals.calories}
        netCalorieGoal={effectiveCalorieTarget}
        baseCalorieGoal={baseCalorieTarget}
        preferActivityAdjusted={preferActivityAdjustedCalories}
        activityBurnKcal={activityBurnForSelectedDay}
      />

      <TrackerSummaryCard
        dateLabel={selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        caloriesToday={totals.calories}
        calorieTarget={effectiveCalorieTarget}
        streakDays={streakDays}
        weekLogged={weekLogged}
        goalFitPercent={goalFit}
        weekFiberWater={weekFiberWater}
        totalDaysLogged={Object.keys(nutritionByDay).filter((k) => (nutritionByDay[k] ?? []).length > 0).length}
      />

      {/* Quick log — USDA search without opening Add Meal */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-violet-200/40 dark:border-violet-900/40 rounded-2xl p-4 sm:p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          <h3 className="text-slate-900 dark:text-white text-sm font-semibold">Quick log</h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
          <span className="font-medium text-slate-700 dark:text-slate-300">Estimated</span> nutrition — search foods and
          log portions for {selectedDate.toLocaleDateString()} (same flow as Add meal → Search).
        </p>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <label className="text-xs text-slate-600 dark:text-slate-400 sm:w-36 shrink-0 flex items-center gap-2">
            Meal
            <select
              value={quickMealSlot}
              onChange={(e) => setQuickMealSlot(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              {["Breakfast", "Lunch", "Dinner", "Snack"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="flex-1 flex gap-2 min-w-0">
            <input
              type="text"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="e.g. chicken breast, oats cooked"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={quickLoading}
              onClick={() => {
                const q = quickQuery.trim();
                if (!q) return;
                setQuickLoading(true);
                setQuickSelected(null);
                fetch(`/api/usda/search?q=${encodeURIComponent(q)}`)
                  .then((r) => r.json())
                  .then((data: { ok?: boolean; hits?: UsdaHit[]; message?: string }) => {
                    if (!data.ok || !data.hits) {
                      toast.error(data.message ?? "Food search failed");
                      return;
                    }
                    setQuickHits(data.hits.slice(0, 8));
                  })
                  .catch(() => toast.error("Food search failed"))
                  .finally(() => setQuickLoading(false));
              }}
            >
              {quickLoading ? "…" : "Search"}
            </Button>
          </div>
        </div>
        {quickHits?.length ? (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-800 mb-3">
            {quickHits.map((h) => (
              <button
                key={h.fdcId}
                type="button"
                className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-sm"
                onClick={() => {
                  setQuickLoading(true);
                  fetch(`/api/usda/food?fdcId=${h.fdcId}`)
                    .then((r) => r.json())
                    .then((data: { ok?: boolean; message?: string } & Partial<UsdaFoodDetails>) => {
                      if (!data.ok || !data.macrosPer100g || !data.description) {
                        toast.error(data.message ?? "Could not load food details");
                        return;
                      }
                      setQuickSelected({
                        fdcId: data.fdcId!,
                        description: data.description!,
                        macrosPer100g: data.macrosPer100g!,
                      });
                    })
                    .catch(() => toast.error("Could not load food details"))
                    .finally(() => setQuickLoading(false));
                }}
              >
                <div className="font-medium text-slate-900 dark:text-white truncate">{h.description}</div>
                <div className="text-xs text-slate-500 truncate">
                  {h.dataType ?? "Food"}
                  {h.brandName ? ` · ${h.brandName}` : ""}
                </div>
              </button>
            ))}
          </div>
        ) : null}
        {quickSelected ? (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{quickSelected.description}</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-400 w-14">Grams</span>
                <input
                  type="number"
                  min={1}
                  value={quickGrams}
                  onChange={(e) => setQuickGrams(Number(e.target.value))}
                  className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto shrink-0"
              onClick={() => {
                const g = Math.max(1, Math.round(quickGrams) || 1);
                const mult = g / 100;
                const m = quickSelected.macrosPer100g;
                addLoggedMeal({
                  name: quickMealSlot,
                  recipeTitle: `${quickSelected.description} (${g}g)`,
                  time: timeLabel,
                  calories: Math.max(0, Math.round(m.calories * mult)),
                  protein: Math.max(0, Math.round(m.protein * mult)),
                  carbs: Math.max(0, Math.round(m.carbs * mult)),
                  fat: Math.max(0, Math.round(m.fat * mult)),
                  source: "USDA FoodData Central",
                  ...(m.fiberG > 0 ? { fiberG: Math.max(0, Math.round(m.fiberG * mult)) } : {}),
                });
                pushRecentFood(quickSelected.description);
                setRecentFoods(loadRecentFoods());
                setQuickQuery("");
                setQuickHits(null);
                setQuickSelected(null);
                setQuickGrams(100);
                toast.success(selectedDateKey === todayKey() ? "Logged to today" : `Logged to ${selectedDateKey}`);
              }}
            >
              {selectedDateKey === todayKey() ? "Log to today" : "Log entry"}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Daily Progress — Calorie Ring + Macro Rings */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-green-50/80 to-emerald-50/80 dark:from-green-950/30 dark:to-emerald-950/30 border-2 border-green-200/50 dark:border-green-800/50 rounded-2xl p-8 mb-8 shadow-2xl">
        <div className="flex items-center gap-2 mb-6">
          <Award className="w-6 h-6 text-green-600 dark:text-green-400" />
          <h3 className="text-slate-900 dark:text-white">Daily Progress</h3>
        </div>

        {/* Calorie Ring */}
        {(() => {
          const calRemaining = effectiveCalorieTarget - totals.calories;
          const calIsOver = calRemaining < 0;
          const calPct = effectiveCalorieTarget > 0 ? Math.min(1, totals.calories / effectiveCalorieTarget) : 0;
          const ringSize = 160;
          const ringStroke = 12;
          const ringR = (ringSize - ringStroke) / 2;
          const ringCirc = 2 * Math.PI * ringR;
          return (
            <div className="flex flex-col items-center gap-4 mb-6">
              <svg width={ringSize} height={ringSize} className="block">
                <circle cx={ringSize/2} cy={ringSize/2} r={ringR} stroke="currentColor" strokeWidth={ringStroke} fill="none" className="text-slate-200 dark:text-slate-700" />
                <circle cx={ringSize/2} cy={ringSize/2} r={ringR}
                  stroke={calIsOver ? "#ef4444" : "#a855f7"} strokeWidth={ringStroke} fill="none"
                  strokeDasharray={ringCirc} strokeDashoffset={ringCirc * (1 - calPct)}
                  strokeLinecap="round" transform={`rotate(-90 ${ringSize/2} ${ringSize/2})`}
                  className="transition-all duration-700"
                />
                <text x={ringSize/2} y={ringSize/2 - 6} textAnchor="middle" className="fill-slate-900 dark:fill-white" style={{ fontSize: 32, fontWeight: 800 }}>
                  {calIsOver ? `+${Math.abs(calRemaining)}` : calRemaining}
                </text>
                <text x={ringSize/2} y={ringSize/2 + 14} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>
                  {calIsOver ? "OVER" : "LEFT"}
                </text>
              </svg>
              <div className="flex gap-8">
                <div className="text-center">
                  <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{totals.calories}</p>
                  <p className="text-xs text-slate-500">Eaten</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold tabular-nums text-violet-600">{effectiveCalorieTarget}</p>
                  <p className="text-xs text-slate-500">Budget</p>
                </div>
                <div className="text-center">
                  <p className={`text-xl font-bold tabular-nums ${calIsOver ? "text-red-500" : "text-emerald-500"}`}>
                    {calIsOver ? `+${Math.abs(calRemaining)}` : calRemaining}
                  </p>
                  <p className="text-xs text-slate-500">{calIsOver ? "Over" : "Remaining"}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Macro Rings */}
        <div className="flex justify-around">
          {([
            { label: "Protein", current: totals.protein, goal: targets.protein, color: "#ef4444" },
            { label: "Carbs", current: totals.carbs, goal: targets.carbs, color: "#3b82f6" },
            { label: "Fat", current: totals.fat, goal: targets.fat, color: "#eab308" },
            { label: "Fibre", current: totals.fiber, goal: targets.fiber, color: "#22c55e" },
            { label: "Water", current: totalWaterMl, goal: targets.waterMl, color: "#06b6d4", unit: "ml", format: (v: number) => formatWaterLine(v) },
          ] as const).map((m) => {
            const sz = 52;
            const sw = 5;
            const r = (sz - sw) / 2;
            const c = 2 * Math.PI * r;
            const pct = m.goal > 0 ? Math.min(1, m.current / m.goal) : 0;
            const display = "format" in m && m.format ? m.format(m.current) : `${m.current}g`;
            return (
              <div key={m.label} className="flex flex-col items-center gap-1">
                <svg width={sz} height={sz}>
                  <circle cx={sz/2} cy={sz/2} r={r} stroke="currentColor" strokeWidth={sw} fill="none" className="text-slate-200 dark:text-slate-700" />
                  <circle cx={sz/2} cy={sz/2} r={r} stroke={m.color} strokeWidth={sw} fill="none"
                    strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
                    transform={`rotate(-90 ${sz/2} ${sz/2})`} className="transition-all duration-700"
                  />
                  <text x={sz/2} y={sz/2 + 4} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: m.color }}>
                    {display}
                  </text>
                </svg>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{m.label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-green-200 dark:border-green-800 space-y-4">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Remaining calories (vs net goal)</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {Math.max(effectiveCalorieTarget - totals.calories, 0)} kcal
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {preferActivityAdjustedCalories && activityBurnForSelectedDay > 0
                ? `${baseCalorieTarget} base + ${activityBurnForSelectedDay} activity = ${effectiveCalorieTarget} net goal`
                : preferActivityAdjustedCalories
                  ? "Log activity below to increase your goal for this day"
                  : "Turn on activity adjustment in Profile to add workout burn to your goal"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Droplets className="w-4 h-4" />
              Quick water
            </span>
            {[250, 500].map((ml) => (
              <button
                key={ml}
                type="button"
                onClick={() => addWaterMlForSelectedDay(ml)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 hover:border-violet-400"
              >
                +{useImperialWater ? formatWaterMl(ml, true) : `${ml} ml`}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Activity adjustment</p>
            </div>
            {!preferActivityAdjustedCalories ? (
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                Turn on &quot;Adjust calories for activity&quot; in Profile to add your burn to your daily goal.
              </p>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Base goal</p>
                <p className="font-semibold text-slate-900 dark:text-white">{baseCalorieTarget} kcal</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Activity (+)</p>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min={0}
                    value={activityBurnForSelectedDay}
                    onChange={(e) =>
                      setActivityBurnForSelectedDay(Math.max(0, Math.round(Number(e.target.value) || 0)))
                    }
                    className="w-24 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <span className="text-slate-600 dark:text-slate-400">kcal</span>
                </div>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Net goal</p>
                <p className="font-semibold text-slate-900 dark:text-white">{effectiveCalorieTarget} kcal</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logged Meals — grouped by meal slot */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h3 className="text-slate-900 dark:text-white">Day log</h3>
          <button
            type="button"
            onClick={() => setBarcodeOpen(true)}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 transition-pm"
          >
            <Package className="w-4 h-4" />
            Barcode
          </button>
        </div>

        <div className="space-y-8">
          {mealsGrouped.map(({ name: sectionName, meals: sectionMeals }) => {
            const consumed: Record<string, number> = {};
            for (const gm of mealsGrouped) {
              const cals = gm.meals.reduce((a, m) => a + scaledMacro(m.calories, m.portionMultiplier ?? 1), 0);
              if (cals > 0) consumed[gm.name] = cals;
            }
            const budgets = distributeMealBudget(effectiveCalorieTarget, targets.fiber, consumed);
            const slotBudget = budgets.find((b) => b.slot === sectionName);
            return (
            <section key={sectionName} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 dark:border-slate-700/80">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {sectionName}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">({sectionMeals.length})</span>
                {sectionMeals.length === 0 && slotBudget && slotBudget.calories > 0 && (
                  <span className="text-xs italic text-slate-400 dark:text-slate-500 ml-auto">
                    {slotBudget.calories} cal suggested
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {sectionMeals.map((meal) => {
                  const loggedPortion = effectivePortionMultiplier(meal.portionMultiplier);
                  const portionLabel =
                    loggedPortion === Math.floor(loggedPortion) ? `${loggedPortion}×` : `${loggedPortion.toFixed(1)}×`;
                  return (
                    <div
                      key={meal.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50 transition-pm hover:border-violet-300/80 dark:hover:border-violet-700/80"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{meal.recipeTitle}</h4>
                          <NutritionSourceBadge source={meal.source} />
                          {loggedPortion !== 1 && (
                            <span className="shrink-0 rounded bg-slate-200/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              {portionLabel}
                            </span>
                          )}
                          <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{meal.time}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          P {Math.round(meal.protein)}g · C {Math.round(meal.carbs)}g · F {Math.round(meal.fat)}g
                          {meal.fiberG != null && meal.fiberG > 0 ? ` · Fb ${Math.round(meal.fiberG)}g` : ""}
                          {meal.waterMl != null && meal.waterMl > 0 ? ` · ${formatWaterLine(meal.waterMl)}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{Math.round(meal.calories)}</span>
                      <button
                        type="button"
                        onClick={() => removeLoggedMeal(meal.id)}
                        className="shrink-0 text-slate-400 transition-pm hover:text-red-500"
                        aria-label={`Remove ${meal.recipeTitle}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );})}

          {mealsForSelectedDate.length === 0 && (
            <div className="py-8">
              {/* Quick-log from plan if plan exists for day 1 */}
              {mealPlan && mealPlan.length > 0 && mealPlan[0]!.meals.filter((m) => !m.isPlaceholder).length > 0 ? (
                <div className="mb-6">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 text-center">Log from today&apos;s plan</p>
                  <div className="space-y-2">
                    {mealPlan[0]!.meals.filter((m) => !m.isPlaceholder).map((meal, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          addLoggedMealForDate(selectedDateKey, {
                            name: meal.name,
                            recipeTitle: meal.recipeTitle,
                            time: meal.name,
                            calories: meal.calories,
                            protein: meal.protein,
                            carbs: meal.carbs,
                            fat: meal.fat,
                            source: "Meal plan",
                          });
                          toast.success(`Logged ${meal.recipeTitle}`);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-violet-300 dark:hover:border-violet-700 transition-colors text-left"
                      >
                        <div>
                          <span className="text-xs font-medium text-violet-600 dark:text-violet-400">{meal.name}</span>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{meal.recipeTitle}</p>
                        </div>
                        <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">{Math.round(meal.calories)} kcal</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="text-center">
                <p className="mb-4 text-slate-500 dark:text-slate-400">
                  {mealPlan && mealPlan.length > 0 ? "Or add a custom meal" : "No meals logged on this day"}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 font-semibold text-white transition-pm hover:shadow-lg hover:shadow-violet-500/25"
                  >
                    <Plus className="h-5 w-5" />
                    {mealPlan && mealPlan.length > 0 ? "Add custom meal" : "Log your first meal"}
                  </button>
                  <label
                    aria-label="Upload a meal photo for AI nutrition estimate"
                    title="Photos are sent to our servers and may be processed with AI to estimate nutrition."
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-300 dark:border-violet-700 px-5 py-3 font-semibold text-violet-600 dark:text-violet-400 cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                  >
                    <Camera className="h-5 w-5" />
                    Photo log
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleVoiceLog}
                    title="Voice and typed descriptions may be processed with AI on our servers."
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-300 dark:border-violet-700 px-5 py-3 font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                  >
                    <Mic className="h-5 w-5" />
                    Voice log
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Log a meal</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Add macros for {selectedDate.toLocaleDateString()} from a saved recipe, the catalog, or enter food manually.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setAddMode("recipe")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  addMode === "recipe"
                    ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Recipe
              </button>
              <button
                type="button"
                onClick={() => setAddMode("manual")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  addMode === "manual"
                    ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Manual food
              </button>
              <button
                type="button"
                onClick={() => setAddMode("search")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  addMode === "search"
                    ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Search
              </button>
            </div>
            <label className="grid gap-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Meal</span>
              <select
                value={mealSlot}
                onChange={(e) => setMealSlot(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {["Breakfast", "Lunch", "Dinner", "Snack"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {addMode === "recipe" ? (
              <>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Recipe</span>
                  <select
                    value={recipeId}
                    onChange={(e) => setRecipeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    disabled={!recipeOptions.length}
                  >
                    {recipeOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                  {savedRecipesForLibrary.length === 0 && (
                    <span className="text-xs text-slate-500">Save recipes from Discover to see them here.</span>
                  )}
                </label>
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Portions</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 max-w-[14rem]">
                    1 = just you · 2 = shared (partner, family plate, double batch)
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      type="button"
                      aria-label="Fewer portions"
                      onClick={() => setRecipePortionMultiplier((m) => clampPortionMultiplier(m - 0.5))}
                      className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-600 text-lg font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700"
                    >
                      −
                    </button>
                    <span className="min-w-[3rem] text-center text-sm font-semibold text-slate-900 dark:text-white">
                      {recipePortionMultiplier === Math.floor(recipePortionMultiplier)
                        ? recipePortionMultiplier
                        : recipePortionMultiplier.toFixed(1)}
                      ×
                    </span>
                    <button
                      type="button"
                      aria-label="More portions"
                      onClick={() => setRecipePortionMultiplier((m) => clampPortionMultiplier(m + 0.5))}
                      className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-600 text-lg font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              </>
            ) : addMode === "search" ? (
              <div className="grid gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Food search</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={foodQuery}
                    onChange={(e) => setFoodQuery(e.target.value)}
                    placeholder="e.g. chicken breast, rice cooked"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={foodLoading}
                    onClick={() => {
                      const q = foodQuery.trim();
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
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-800">
                    {foodHits.map((h) => (
                      <button
                        key={h.fdcId}
                        type="button"
                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
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
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{h.description}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {h.dataType ?? "Food"}
                          {h.brandName ? ` · ${h.brandName}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}

                {foodSelected ? (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{foodSelected.description}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-slate-700 dark:text-slate-300 w-16">Grams</span>
                      <input
                        type="number"
                        min={1}
                        value={foodGrams}
                        onChange={(e) => setFoodGrams(Number(e.target.value))}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                      {(() => {
                        const g = Math.max(1, Math.round(foodGrams) || 1);
                        const mult = g / 100;
                        const m = foodSelected.macrosPer100g;
                        return `${Math.round(m.calories * mult)} kcal · ${Math.round(m.protein * mult)}P · ${Math.round(
                          m.carbs * mult,
                        )}C · ${Math.round(m.fat * mult)}F`;
                      })()}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Food name</span>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="e.g. Greek yogurt with berries"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Calories</span>
                    <input
                      type="number"
                      min={0}
                      value={manualCalories || ""}
                      onChange={(e) => setManualCalories(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Protein (g)</span>
                    <input
                      type="number"
                      min={0}
                      value={manualProtein || ""}
                      onChange={(e) => setManualProtein(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Carbs (g)</span>
                    <input
                      type="number"
                      min={0}
                      value={manualCarbs || ""}
                      onChange={(e) => setManualCarbs(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Fat (g)</span>
                    <input
                      type="number"
                      min={0}
                      value={manualFat || ""}
                      onChange={(e) => setManualFat(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Fiber (g)</span>
                    <input
                      type="number"
                      min={0}
                      value={manualFiber || ""}
                      onChange={(e) => setManualFiber(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Water (ml)</span>
                    <input
                      type="number"
                      min={0}
                      value={manualWater || ""}
                      onChange={(e) => setManualWater(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </label>
                </div>
              </>
            )}
            <label className="grid gap-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Time</span>
              <input
                type="text"
                value={timeLabel}
                onChange={(e) => setTimeLabel(e.target.value)}
                placeholder="e.g. 12:30 PM"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
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

      <Dialog open={barcodeOpen} onOpenChange={setBarcodeOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Barcode (Open Food Facts)</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Enter a packaged food barcode. We'll pull label-backed macros per 100 g — you can edit the serving size after logging.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <label className="grid gap-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Barcode</span>
              <input
                type="text"
                inputMode="numeric"
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value.replace(/\D/g, ""))}
                placeholder="8–13 digits"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </label>
            {recentFoods.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500 w-full">Recent:</span>
                {recentFoods.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                    onClick={() => {
                      addLoggedMeal({
                        name: "Snack",
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
                  pushRecentFood(p.name);
                  setRecentFoods(loadRecentFoods());
                  addLoggedMeal({
                    name: "Snack",
                    recipeTitle: `${p.name} (${p.servingLabel})`,
                    time: timeLabel,
                    calories: p.calories,
                    protein: p.protein,
                    carbs: p.carbs,
                    fat: p.fat,
                    source: "Open Food Facts",
                    ...(p.fiberG > 0 ? { fiberG: p.fiberG } : {}),
                  });
                  setBarcodeValue("");
                  setBarcodeOpen(false);
                  toast.success("Logged from barcode");
                  track(AnalyticsEvents.barcode_lookup, { ok: true });
                } finally {
                  setBarcodeBusy(false);
                }
              }}
            >
              {barcodeBusy ? "Looking up…" : "Log per 100g"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insights strip */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <TrendingUp className="w-5 h-5 shrink-0 text-green-600 dark:text-green-400" />
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
              {streakDays > 0 ? `${streakDays}d` : "—"}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">Streak</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <Target className="w-5 h-5 shrink-0 text-violet-600 dark:text-violet-400" />
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
              {goalFit != null ? `${goalFit}%` : "—"}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">7-day fit</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <Award className="w-5 h-5 shrink-0 text-orange-600 dark:text-orange-400" />
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
              {weekLogged.logged}/{weekLogged.total}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">This week</p>
          </div>
        </div>
      </div>

      {/* Voice log text dialog */}
      <Dialog open={voiceDialogOpen} onOpenChange={(open) => { setVoiceDialogOpen(open); if (!open) setVoiceText(""); }}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Voice Log</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400 space-y-2">
              <span className="block">
                Describe what you ate and we&apos;ll estimate the nutrition. Text is processed on our servers and may be
                sent to an AI provider (e.g. OpenAI). Browser speech recognition, if you use it elsewhere, may be
                handled by your device or browser before text reaches us.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <input
              type="text"
              value={voiceText}
              onChange={(e) => setVoiceText(e.target.value)}
              placeholder='e.g. "2 scrambled eggs and toast with butter"'
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && voiceText.trim()) {
                  setVoiceDialogOpen(false);
                  submitVoiceTranscriptWeb(voiceText.trim());
                  setVoiceText("");
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setVoiceDialogOpen(false); setVoiceText(""); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (voiceText.trim()) {
                  setVoiceDialogOpen(false);
                  submitVoiceTranscriptWeb(voiceText.trim());
                  setVoiceText("");
                }
              }}
              disabled={!voiceText.trim()}
            >
              Log Food
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
