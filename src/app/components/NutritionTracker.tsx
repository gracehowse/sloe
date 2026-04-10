import { memo, useEffect, useMemo, useState } from "react";
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
import {
  clampPortionMultiplier,
  effectivePortionMultiplier,
  scaledMacro,
} from "../../lib/nutrition/portionMultiplier.ts";
import { formatWaterMl } from "../../lib/units/imperial.ts";
import { TrackerSummaryCard } from "./TrackerSummaryCard.tsx";
import { TodayAtAGlance } from "./TodayAtAGlance.tsx";

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

export const NutritionTracker = memo(function NutritionTracker({ userTier: _userTier }: NutritionTrackerProps) {
  const {
    nutritionTargets,
    selectedDateKey,
    setSelectedDateKey,
    mealsForSelectedDate,
    addLoggedMeal,
    removeLoggedMeal,
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
  /** Recipe log: scale catalog/saved recipe macros (1 = solo, 2 = shared dinner, etc.). */
  const [recipePortionMultiplier, setRecipePortionMultiplier] = useState(1);

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

  const totals = mealsForSelectedDate.reduce(
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
            <button
              type="button"
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
              onClick={() => setSelectedDateKey((k) => shiftDateKey(k, 1))}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-pm hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => {
                const csv = buildNutritionCsvForDay(
                  selectedDateKey,
                  mealsForSelectedDate,
                  extraWaterMlForSelectedDay,
                );
                downloadCsvFile(`platemate-${selectedDateKey}.csv`, csv);
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-pm hover:shadow-md hover:shadow-violet-500/20"
            >
              <Plus className="h-4 w-4" />
              Add food
            </button>
          </div>
        </div>
      </div>

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
      />

      <TrackerSummaryCard
        dateLabel={selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        caloriesToday={totals.calories}
        calorieTarget={effectiveCalorieTarget}
        streakDays={streakDays}
        weekLogged={weekLogged}
        goalFitPercent={goalFit}
        weekFiberWater={weekFiberWater}
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
                  ...(m.fiberG > 0 ? { fiberG: Math.max(0, Math.round(m.fiberG * mult)) } : {}),
                });
                pushRecentFood(quickSelected.description);
                setRecentFoods(loadRecentFoods());
                setQuickQuery("");
                setQuickHits(null);
                setQuickSelected(null);
                setQuickGrams(100);
                toast.success("Logged to today");
              }}
            >
              Log to today
            </Button>
          </div>
        ) : null}
      </div>

      {/* Daily Progress */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-green-50/80 to-emerald-50/80 dark:from-green-950/30 dark:to-emerald-950/30 border-2 border-green-200/50 dark:border-green-800/50 rounded-2xl p-8 mb-8 shadow-2xl">
        <div className="flex items-center gap-2 mb-6">
          <Award className="w-6 h-6 text-green-600 dark:text-green-400" />
          <h3 className="text-slate-900 dark:text-white">Daily Progress</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Calories (net goal)</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-bold ${getProgressTextClass(totals.calories, effectiveCalorieTarget)}`}>
                {totals.calories}
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400">/ {effectiveCalorieTarget}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getProgressBarClass(totals.calories, effectiveCalorieTarget)} transition-all duration-500`}
                style={{ width: `${getProgress(totals.calories, effectiveCalorieTarget)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Protein</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-bold ${getProgressTextClass(totals.protein, targets.protein)}`}>
                {totals.protein}g
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400">/ {targets.protein}g</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getProgressBarClass(totals.protein, targets.protein)} transition-all duration-500`}
                style={{ width: `${getProgress(totals.protein, targets.protein)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Carbs</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-bold ${getProgressTextClass(totals.carbs, targets.carbs)}`}>
                {totals.carbs}g
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400">/ {targets.carbs}g</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getProgressBarClass(totals.carbs, targets.carbs)} transition-all duration-500`}
                style={{ width: `${getProgress(totals.carbs, targets.carbs)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Fat</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-bold ${getProgressTextClass(totals.fat, targets.fat)}`}>
                {totals.fat}g
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400">/ {targets.fat}g</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getProgressBarClass(totals.fat, targets.fat)} transition-all duration-500`}
                style={{ width: `${getProgress(totals.fat, targets.fat)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Fiber</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-bold ${getProgressTextClass(totals.fiber, targets.fiber)}`}>
                {totals.fiber}g
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400">/ {targets.fiber}g</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getProgressBarClass(totals.fiber, targets.fiber)} transition-all duration-500`}
                style={{ width: `${getProgress(totals.fiber, targets.fiber)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Water</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-bold ${getProgressTextClass(totalWaterMl, targets.waterMl)}`}>
                {formatWaterLine(totalWaterMl)}
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400">
                / {formatWaterLine(targets.waterMl)}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getProgressBarClass(totalWaterMl, targets.waterMl)} transition-all duration-500`}
                style={{ width: `${getProgress(totalWaterMl, targets.waterMl)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-green-200 dark:border-green-800 space-y-4">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Remaining calories (vs net goal)</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {Math.max(effectiveCalorieTarget - totals.calories, 0)} kcal
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Net goal = base goal
              {preferActivityAdjustedCalories
                ? ` + activity (${activityBurnForSelectedDay} kcal this day)`
                : " (activity adjustment off in Profile)"}
              .
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

          <div className="backdrop-blur-sm bg-white/50 dark:bg-slate-900/40 rounded-xl p-4 border border-green-200/50 dark:border-green-900/50">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Activity adjustment</p>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              Toggle lives in Profile. Formula: <span className="font-medium text-slate-700 dark:text-slate-300">net goal = base + activity burn</span> for
              the selected day (web-first; Apple Health can replace manual burn later). Avoid double-counting workouts when
              sync ships.
            </p>
            {!preferActivityAdjustedCalories ? (
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                Turn on “Activity-adjusted calories” in Profile to add the burn below to your daily calorie goal.
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
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
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
          {mealsGrouped.map(({ name: sectionName, meals: sectionMeals }) => (
            <section key={sectionName} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 dark:border-slate-700/80">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {sectionName}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">({sectionMeals.length})</span>
              </div>
              <div className="space-y-3">
                {sectionMeals.map((meal) => {
                  const loggedPortion = effectivePortionMultiplier(meal.portionMultiplier);
                  const portionLabel =
                    loggedPortion === Math.floor(loggedPortion) ? `${loggedPortion}×` : `${loggedPortion.toFixed(1)}×`;
                  return (
                    <div
                      key={meal.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50 transition-pm hover:border-violet-300/80 dark:hover:border-violet-700/80"
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            {loggedPortion !== 1 ? (
                              <span className="inline-block rounded-md bg-slate-200/90 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                {portionLabel} portions
                              </span>
                            ) : null}
                            <span className="text-xs text-slate-500 dark:text-slate-400">{meal.time}</span>
                          </div>
                          <h4 className="text-slate-900 dark:text-white">{meal.recipeTitle}</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLoggedMeal(meal.id)}
                          className="shrink-0 text-slate-400 transition-pm hover:text-red-500"
                          aria-label={`Remove ${meal.recipeTitle}`}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <div>
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Cal
                          </p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{meal.calories}</p>
                        </div>
                        <div>
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            P
                          </p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{meal.protein}g</p>
                        </div>
                        <div>
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            C
                          </p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{meal.carbs}g</p>
                        </div>
                        <div>
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            F
                          </p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{meal.fat}g</p>
                        </div>
                        <div>
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Fiber
                          </p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">
                            {meal.fiberG != null && meal.fiberG > 0 ? `${meal.fiberG}g` : "—"}
                          </p>
                        </div>
                      </div>
                      {(meal.fiberG != null && meal.fiberG > 0) || (meal.waterMl != null && meal.waterMl > 0) ? (
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
                          {meal.fiberG != null && meal.fiberG > 0 ? <span>Fiber: {meal.fiberG}g</span> : null}
                          {meal.waterMl != null && meal.waterMl > 0 ? (
                            <span>Water: {formatWaterLine(meal.waterMl)}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {mealsForSelectedDate.length === 0 && (
            <div className="py-12 text-center">
              <p className="mb-4 text-slate-500 dark:text-slate-400">No meals logged on this day</p>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 font-semibold text-white transition-pm hover:shadow-lg hover:shadow-violet-500/25"
              >
                <Plus className="h-5 w-5" />
                Log your first meal
              </button>
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
              Enter a packaged food barcode. We pull label-backed macros per 100g — adjust portions in your head or log
              a manual entry to scale.
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

      {/* Insights (from your log — same calorie target as Profile for fit %) */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400">Logging streak</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {streakDays > 0 ? `${streakDays} ${streakDays === 1 ? "day" : "days"}` : "—"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Consecutive days (today or yesterday through past) with at least one meal logged.
          </p>
        </div>
        <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400">7-day calorie fit</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {goalFit != null ? `${goalFit}%` : "—"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Average closeness to your calorie target ({nutritionTargets.calories} kcal) on days you logged food. Activity
            adjustments are not applied per day here yet.
          </p>
        </div>
        <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400">This week (Mon–Sun)</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {weekLogged.logged}/{weekLogged.total} days
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Days in the current calendar week with at least one meal logged.
          </p>
        </div>
      </div>
    </div>
  );
});
