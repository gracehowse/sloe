import { useEffect, useMemo, useState } from "react";
import { Calendar, Plus, TrendingUp, Target, Award, Trash2, Package, Droplets, Activity } from "lucide-react";
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
import { fetchProductByBarcode } from "../../lib/openFoodFacts/fetchProductByBarcode.ts";

const RECENT_BARCODE_KEY = "platemate-recent-foods-v1";

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

export function NutritionTracker({ userTier }: NutritionTrackerProps) {
  void userTier;
  const {
    nutritionTargets,
    selectedDateKey,
    setSelectedDateKey,
    mealsForSelectedDate,
    addLoggedMeal,
    removeLoggedMeal,
    savedRecipesForLibrary,
    preferActivityAdjustedCalories,
    activityBurnKcal,
    setActivityBurnKcal,
    addWaterMlForSelectedDay,
    extraWaterMlForSelectedDay,
  } = useAppData();

  const [addOpen, setAddOpen] = useState(false);
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
  const [barcodeValue, setBarcodeValue] = useState("");
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [recentFoods, setRecentFoods] = useState<string[]>(() =>
    typeof window !== "undefined" ? loadRecentFoods() : [],
  );

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

  const targets = normalizeMacroTargets(nutritionTargets);
  const baseCalorieTarget = targets.calories;
  const activityAdjustment = preferActivityAdjustedCalories ? activityBurnKcal : 0;
  const effectiveCalorieTarget = baseCalorieTarget + activityAdjustment;
  const totalWaterMl = totals.waterMl + extraWaterMlForSelectedDay;

  const getProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressColor = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 90 && percentage <= 110) {
      return "text-green-600 dark:text-green-400 bg-green-500";
    }
    if (percentage > 110) {
      return "text-orange-600 dark:text-orange-400 bg-orange-500";
    }
    return "text-violet-600 dark:text-violet-400 bg-violet-500";
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
    if (!recipeOptions.length) {
      return;
    }
    const recipe = recipeOptions.find((r) => r.id === recipeId);
    if (!recipe) {
      return;
    }
    addLoggedMeal({
      name: mealSlot,
      recipeTitle: recipe.title,
      time: timeLabel,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
    });
    setAddOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl">
            <Target className="w-5 h-5 text-white" />
          </div>
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">Nutrition Tracker</h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">Track your daily nutrition and hit your targets</p>
      </div>

      {/* Date Selector */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <h3 className="text-slate-900 dark:text-white">
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h3>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedDateKey((k) => shiftDateKey(k, -1))}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-300 text-sm font-medium"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setSelectedDateKey(todayKey())}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-300 text-sm font-medium"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDateKey((k) => shiftDateKey(k, 1))}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-300 text-sm font-medium"
            >
              Next →
            </button>
          </div>
        </div>
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
              <span className={`text-3xl font-bold ${getProgressColor(totals.calories, effectiveCalorieTarget)}`}>
                {totals.calories}
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400">/ {effectiveCalorieTarget}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getProgressColor(totals.calories, effectiveCalorieTarget)} transition-all duration-500`}
                style={{ width: `${getProgress(totals.calories, effectiveCalorieTarget)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Protein</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-bold ${getProgressColor(totals.protein, targets.protein)}`}>
                {totals.protein}g
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400">/ {targets.protein}g</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getProgressColor(totals.protein, targets.protein)} transition-all duration-500`}
                style={{ width: `${getProgress(totals.protein, targets.protein)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Carbs</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-bold ${getProgressColor(totals.carbs, targets.carbs)}`}>
                {totals.carbs}g
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400">/ {targets.carbs}g</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getProgressColor(totals.carbs, targets.carbs)} transition-all duration-500`}
                style={{ width: `${getProgress(totals.carbs, targets.carbs)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Fat</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-bold ${getProgressColor(totals.fat, targets.fat)}`}>
                {totals.fat}g
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400">/ {targets.fat}g</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getProgressColor(totals.fat, targets.fat)} transition-all duration-500`}
                style={{ width: `${getProgress(totals.fat, targets.fat)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Fiber</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-bold ${getProgressColor(totals.fiber, targets.fiber)}`}>
                {totals.fiber}g
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400">/ {targets.fiber}g</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getProgressColor(totals.fiber, targets.fiber)} transition-all duration-500`}
                style={{ width: `${getProgress(totals.fiber, targets.fiber)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Water</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-bold ${getProgressColor(totalWaterMl, targets.waterMl)}`}>
                {totalWaterMl >= 1000
                  ? `${(totalWaterMl / 1000).toFixed(1).replace(/\.0$/, "")}L`
                  : `${totalWaterMl}ml`}
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400">
                /{" "}
                {targets.waterMl >= 1000
                  ? `${(targets.waterMl / 1000).toFixed(1).replace(/\.0$/, "")}L`
                  : `${targets.waterMl}ml`}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getProgressColor(totalWaterMl, targets.waterMl)} transition-all duration-500`}
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
              {preferActivityAdjustedCalories ? ` + activity adjustment (${activityBurnKcal} kcal)` : " (activity adjustment off in Profile)"}
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
                +{ml} ml
              </button>
            ))}
          </div>

          <div className="backdrop-blur-sm bg-white/50 dark:bg-slate-900/40 rounded-xl p-4 border border-green-200/50 dark:border-green-900/50">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Activity adjustment (MFP-style)</p>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              Toggle lives in Profile. Until Apple Health sync ships, set a manual burn to preview net calories. Avoid
              logging the same workout twice when integrations go live.
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
                    value={activityBurnKcal}
                    onChange={(e) => setActivityBurnKcal(Math.max(0, Math.round(Number(e.target.value) || 0)))}
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

      {/* Logged Meals */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h3 className="text-slate-900 dark:text-white">Logged Meals</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBarcodeOpen(true)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200"
            >
              <Package className="w-4 h-4" />
              Barcode
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-300 hover:scale-105 flex items-center gap-2 font-semibold"
            >
              <Plus className="w-4 h-4" />
              Add Meal
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {mealsForSelectedDate.map((meal) => (
            <div key={meal.id} className="p-5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="inline-block px-3 py-1 bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 rounded-lg text-sm font-semibold mb-2">
                    {meal.name}
                  </span>
                  <h4 className="text-slate-900 dark:text-white">{meal.recipeTitle}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{meal.time}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeLoggedMeal(meal.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  aria-label={`Remove ${meal.recipeTitle}`}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Calories</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{meal.calories}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Protein</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{meal.protein}g</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Carbs</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{meal.carbs}g</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Fat</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{meal.fat}g</p>
                </div>
              </div>
              {(meal.fiberG != null && meal.fiberG > 0) || (meal.waterMl != null && meal.waterMl > 0) ? (
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                  {meal.fiberG != null && meal.fiberG > 0 ? <span>Fiber: {meal.fiberG}g</span> : null}
                  {meal.waterMl != null && meal.waterMl > 0 ? <span>Water: {meal.waterMl} ml</span> : null}
                </div>
              ) : null}
            </div>
          ))}

          {mealsForSelectedDate.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400 mb-4">No meals logged on this day</p>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-300 hover:scale-105 inline-flex items-center gap-2 font-semibold"
              >
                <Plus className="w-5 h-5" />
                Log Your First Meal
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
                    fiberG: p.fiberG,
                  });
                  setBarcodeValue("");
                  setBarcodeOpen(false);
                  toast.success("Logged from barcode");
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

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400">7-Day Streak</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">7 days</p>
        </div>
        <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400">Avg. Accuracy</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">96%</p>
        </div>
        <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400">This Week</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">5/7 days</p>
        </div>
      </div>
    </div>
  );
}
