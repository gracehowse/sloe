import { memo, useEffect, useMemo, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { Icons } from "./ui/icons";
import { IconBox } from "./ui/icon-box";
import { toast } from "sonner";
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
  computeLoggingStreak,
  computeWeekFiberWaterHits,
} from "../../lib/nutrition/trackerStats.ts";
import { buildNutritionCsvForDay, downloadCsvFile } from "../../lib/nutrition/exportNutritionCsv.ts";
import NutritionSourceBadge from "../../components/NutritionSourceBadge.tsx";
import {
  clampPortionMultiplier,
  effectivePortionMultiplier,
  scaledMacro,
} from "../../lib/nutrition/portionMultiplier.ts";
import { formatWaterMl } from "../../lib/units/imperial.ts";
import { distributeMealBudget } from "../../lib/nutrition/mealBudget.ts";
import { DailyRing } from "./platemate/daily-ring";
import { MacroCard } from "./platemate/macro-card";

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

  const [ringExpanded, setRingExpanded] = useState(false);
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
    return savedRecipesForLibrary.map((r) => ({ ...r, isSaved: true }));
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

  return (
    <div className="max-w-4xl mx-auto px-pm-6 py-pm-8">
      {!isOnline ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-card border border-warning/30 bg-warning-soft px-4 py-3"
        >
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <p className="text-sm font-semibold text-foreground">
            {"You're offline. Logging and sync will resume when the connection is back."}
          </p>
        </div>
      ) : null}

      {/* ===== PROTOTYPE: Today Screen ===== */}

      {/* 1. Greeting bar: Date (11px uppercase tracking-wide, muted) + "Today" (22px bold) + Avatar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
          <h1 className="text-2xl font-bold text-foreground">Today</h1>
        </div>
        <div className="w-9 h-9 rounded-[10px] bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
          {(useAppData as any).profileName?.[0]?.toUpperCase() || "U"}
        </div>
      </div>

      {/* 2. Daily Ring: Centered, animated calorie progress ring (160px) — tap to expand macro rings */}
      <div className="flex flex-col items-center mb-8">
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
        />
        <p className="text-xs text-muted-foreground mt-3">
          {ringExpanded ? "Showing macro breakdown" : "Tap for macro breakdown"}
        </p>
      </div>

      {/* 3. Macro Cards Row: Protein / Carbs / Fat */}
      <div className="flex gap-2 mb-8">
        <MacroCard macro="protein" value={totals.protein} target={targets.protein} />
        <MacroCard macro="carbs" value={totals.carbs} target={targets.carbs} />
        <MacroCard macro="fat" value={totals.fat} target={targets.fat} />
      </div>

      {/* 4. Quick Log Strip: 4 action chips in a row */}
      <div className="flex gap-2 mb-8">
        {/* Photo chip */}
        <button
          type="button"
          onClick={() => headerPhotoInputRef.current?.click()}
          className="flex-1 flex-col items-center gap-1.5 p-2.5 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors flex"
        >
          <IconBox size="sm" tone="primary">
            <Icons.camera />
          </IconBox>
          <span className="text-[10px] font-medium text-muted-foreground">Photo</span>
        </button>

        {/* Voice chip */}
        <button
          type="button"
          onClick={handleVoiceLog}
          className="flex-1 flex-col items-center gap-1.5 p-2.5 rounded-xl bg-card border border-border hover:border-success/40 transition-colors flex"
        >
          <IconBox size="sm" tone="success">
            <Icons.mic />
          </IconBox>
          <span className="text-[10px] font-medium text-muted-foreground">Voice</span>
        </button>

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

        {/* Scan chip */}
        <button
          type="button"
          onClick={() => setBarcodeOpen(true)}
          className="flex-1 flex-col items-center gap-1.5 p-2.5 rounded-xl bg-card border border-border hover:border-fat/40 transition-colors flex"
        >
          <IconBox size="sm" tone="fat">
            <Icons.food />
          </IconBox>
          <span className="text-[10px] font-medium text-muted-foreground">Scan</span>
        </button>
      </div>

      <input
        ref={headerPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        title="Photos are sent to our servers and may be processed with AI to estimate nutrition."
        onChange={handlePhotoUpload}
      />

      {/* 5. Meals Section */}
      <div className="mb-8">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Meals</h3>
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
              if (name === "Snack") return { icon: Icons.snack, tone: "fat" as const };
              return { icon: Icons.add, tone: "primary" as const };
            };

            const mealIconInfo = getMealIcon(sectionName);

            return (
              <div key={sectionName} className="border-b border-border last:border-b-0">
                {/* Meal header row */}
                <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border cursor-pointer">
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
                  <span className="text-[10px] text-muted-foreground">kcal</span>
                </div>

                {/* Expanded meal items */}
                {sectionMeals.length > 0 && (
                  <div>
                    {sectionMeals.map((meal) => (
                      <div key={meal.id} className="flex items-center justify-between px-4 py-2.5 border-b border-border/10" style={{ paddingLeft: 56 }}>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                          <span className="text-xs text-foreground truncate">{meal.recipeTitle}</span>
                          {meal.source && (
                            <span className="text-[10px] text-muted-foreground shrink-0">{meal.source}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs text-muted-foreground tabular-nums">{Math.round(meal.calories)}</span>
                          <button
                            type="button"
                            onClick={() => removeLoggedMeal(meal.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${meal.recipeTitle}`}
                          >
                            <Icons.delete className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty meal: dimmed slot with "Tap to add" matching mobile */}
                {sectionMeals.length === 0 && (
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
              {mealPlan && mealPlan.length > 0 && mealPlan[0]!.meals.filter((m) => !m.isPlaceholder).length > 0 ? (
                <div className="mb-6">
                  <p className="text-sm font-medium text-muted-foreground mb-3 text-center">Log from today&apos;s plan</p>
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
                  <label
                    aria-label="Upload a meal photo for AI nutrition estimate"
                    title="Photos are sent to our servers and may be processed with AI to estimate nutrition."
                    className="inline-flex items-center gap-2 rounded-xl border border-primary/30 px-5 py-3 font-semibold text-primary cursor-pointer hover:bg-primary/5 transition-colors"
                  >
                    <Icons.camera className="h-5 w-5" />
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
                    className="inline-flex items-center gap-2 rounded-xl border border-primary/30 px-5 py-3 font-semibold text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Icons.edit className="h-5 w-5" />
                    Voice log
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Streak Insight Card */}
      {streakDays > 0 && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border" style={{ background: "var(--success-soft, rgba(34,168,96,0.06))", borderColor: "rgba(34,168,96,0.13)" }}>
          <IconBox size="lg" tone="success">
            <Icons.streak />
          </IconBox>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-success">
              {streakDays}-day protein streak
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {streakDays === 1 ? "Great start! Keep the streak alive." : "Consistently on target. Keep it going."}
            </p>
          </div>
        </div>
      )}

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
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
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

      <Dialog open={barcodeOpen} onOpenChange={setBarcodeOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Barcode (Open Food Facts)</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter a packaged food barcode. We'll pull label-backed macros per 100 g — you can edit the serving size after logging.
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

      {/* Voice log text dialog */}
      <Dialog open={voiceDialogOpen} onOpenChange={(open) => { setVoiceDialogOpen(open); if (!open) setVoiceText(""); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Voice Log</DialogTitle>
            <DialogDescription className="text-muted-foreground space-y-2">
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
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
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
