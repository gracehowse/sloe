import { useEffect, useMemo, useState } from "react";
import { Sparkles, Calendar, Lock, TrendingUp, CheckCircle2, AlertCircle, BookMarked, Home } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import { DEFAULT_PLANNER_BANDS } from "../../lib/planning/generateMealPlan.ts";
import type { DayPlan } from "../../types/recipe.ts";

interface MealPlannerProps {
  userTier: "free" | "base" | "pro";
  onUpgrade?: () => void;
  onNavigate?: (view: "discover" | "library") => void;
}

function formatVsTarget(
  actual: number,
  target: number,
  bandPct: number,
  unit: string,
): { tone: "ok" | "low" | "high"; text: string } {
  if (target <= 0) {
    return { tone: "ok", text: `— ${unit}` };
  }
  const lo = target * (1 - bandPct / 100);
  const hi = target * (1 + bandPct / 100);
  if (actual < lo) {
    const d = target - actual;
    return { tone: "low", text: `${Math.round(d)} ${unit} under band` };
  }
  if (actual > hi) {
    const d = actual - target;
    return { tone: "high", text: `${Math.round(d)} ${unit} over band` };
  }
  const pct = Math.round(((actual - target) / target) * 100);
  const sign = pct > 0 ? "+" : "";
  return { tone: "ok", text: `${sign}${pct}% vs goal` };
}

export function MealPlanner({ userTier, onUpgrade, onNavigate }: MealPlannerProps) {
  const {
    mealPlan,
    setMealPlan,
    generateMealPlan,
    generateShoppingListFromPlan,
    savedRecipesForLibrary,
    addLoggedMealForDate,
    setSelectedDateKey,
    nutritionTargets,
  } = useAppData();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<DayPlan[] | null>(() => mealPlan);
  const [targetCalories, setTargetCalories] = useState(nutritionTargets.calories);
  const [targetProtein, setTargetProtein] = useState(nutritionTargets.protein);
  const [targetCarbs, setTargetCarbs] = useState(nutritionTargets.carbs);
  const [targetFat, setTargetFat] = useState(nutritionTargets.fat);
  const [calorieBandPct, setCalorieBandPct] = useState<number>(DEFAULT_PLANNER_BANDS.calorieBandPct);
  const [carbFatBandPct, setCarbFatBandPct] = useState<number>(DEFAULT_PLANNER_BANDS.carbFatBandPct);
  const [planDays, setPlanDays] = useState<1 | 3 | 7>(1);

  const hasLibraryRecipes = savedRecipesForLibrary.length > 0;

  const isPaidUser = userTier === "base" || userTier === "pro";

  useEffect(() => {
    if (!isPaidUser) {
      setPlanDays(1);
    }
  }, [isPaidUser]);

  const handleGenerate = () => {
    if (!hasLibraryRecipes) {
      toast.error("Save at least one recipe first.");
      return;
    }
    setIsGenerating(true);
    setTimeout(async () => {
      await generateMealPlan({
        targetsOverride: {
          calories: targetCalories,
          protein: targetProtein,
          carbs: targetCarbs,
          fat: targetFat,
          calorieBandPct,
          carbFatBandPct,
        },
        days: planDays,
      });
      await generateShoppingListFromPlan();
      setIsGenerating(false);
    }, 400);
  };

  const handleRegenerate = () => {
    setGeneratedPlan(null);
  };

  const handleSavePlan = () => {
    toast.message("Plan saves automatically", {
      description: "Your meal plan is persisted as you generate or swap meals.",
    });
  };

  const recalcTotals = (meals: DayPlan["meals"]): DayPlan["totals"] => {
    return meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  };

  const swapMeal = (day: number, mealIndex: number) => {
    const dp = (generatedPlan ?? mealPlan)?.find((x) => x.day === day);
    if (dp?.meals[mealIndex]?.isPlaceholder) {
      toast.error("Save recipes to enable swapping");
      return;
    }
    const pool = savedRecipesForLibrary.map((r) => r.title);
    setMealPlan((prev) => {
      if (!prev) return prev;
      const dp = prev.find((x) => x.day === day);
      if (!dp) return prev;
      const current = dp.meals[mealIndex];
      if (!current) return prev;

      const used = new Set(dp.meals.map((m) => m.recipeTitle));
      const candidates = pool.filter((t) => t !== current.recipeTitle && !used.has(t));
      const nextTitle = (candidates[0] ?? pool.find((t) => t !== current.recipeTitle)) ?? null;
      if (!nextTitle) {
        toast.error("Save more recipes to enable swapping");
        return prev;
      }
      const nextRecipe = savedRecipesForLibrary.find((r) => r.title === nextTitle);
      if (!nextRecipe) return prev;

      const nextMeals = dp.meals.map((m, idx) =>
        idx === mealIndex
          ? {
              ...m,
              recipeTitle: nextRecipe.title,
              calories: nextRecipe.calories,
              protein: nextRecipe.protein,
              carbs: nextRecipe.carbs,
              fat: nextRecipe.fat,
            }
          : m,
      );

      const nextDp: DayPlan = { ...dp, meals: nextMeals, totals: recalcTotals(nextMeals) };
      toast.success("Swapped meal");
      return prev.map((x) => (x.day === day ? nextDp : x));
    });
  };

  const logPlannedMeal = (day: number, mealIndex: number) => {
    const dp = (generatedPlan ?? mealPlan)?.find((x) => x.day === day);
    const meal = dp?.meals[mealIndex];
    if (!meal || meal.isPlaceholder) return;

    const d = new Date();
    d.setDate(d.getDate() + (day - 1));
    const key = d.toISOString().slice(0, 10);
    setSelectedDateKey(key);
    addLoggedMealForDate(key, {
      name: meal.name,
      recipeTitle: meal.recipeTitle,
      time: "Planned",
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
    });
    toast.success(`Logged to Nutrition Tracker (Day ${day})`);
  };

  useEffect(() => {
    setGeneratedPlan(mealPlan);
  }, [mealPlan]);

  useEffect(() => {
    setTargetCalories(nutritionTargets.calories);
    setTargetProtein(nutritionTargets.protein);
    setTargetCarbs(nutritionTargets.carbs);
    setTargetFat(nutritionTargets.fat);
  }, [
    nutritionTargets.calories,
    nutritionTargets.protein,
    nutritionTargets.carbs,
    nutritionTargets.fat,
  ]);

  const daySummaries = useMemo(() => {
    const plan = generatedPlan ?? mealPlan;
    if (!plan) return [];
    return plan.map((dp) => {
      const cal = formatVsTarget(dp.totals.calories, targetCalories, calorieBandPct, "kcal");
      const pro = formatVsTarget(dp.totals.protein, targetProtein, 10, "g");
      const carb = formatVsTarget(dp.totals.carbs, targetCarbs, carbFatBandPct, "g");
      const fat = formatVsTarget(dp.totals.fat, targetFat, carbFatBandPct, "g");
      return { day: dp.day, cal, pro, carb, fat };
    });
  }, [generatedPlan, mealPlan, targetCalories, targetProtein, targetCarbs, targetFat, calorieBandPct, carbFatBandPct]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">AI Meal Planner</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">Generate meal plans from your saved recipes</p>
        </div>
        {generatedPlan && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRegenerate}
              className="px-5 py-2.5 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
            >
              Regenerate
            </button>
            <button
              type="button"
              onClick={() => void generateShoppingListFromPlan()}
              className="px-5 py-2.5 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
            >
              Generate Shopping List
            </button>
            <button
              type="button"
              onClick={handleSavePlan}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 hover:scale-105 font-semibold"
            >
              Save Plan
            </button>
          </div>
        )}
      </div>

      {!isPaidUser && (
        <div className="mb-8 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 dark:text-white">Free tier: 1-day planner</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                You can generate a 1-day plan + shopping list. Upgrade unlocks multi-day planning.
              </p>
            </div>
            <button
              type="button"
              onClick={onUpgrade}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 font-semibold inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade
            </button>
          </div>
        </div>
      )}

      {!hasLibraryRecipes && (
        <div className="max-w-3xl mx-auto mb-8 backdrop-blur-xl bg-amber-50/90 dark:bg-amber-950/25 border-2 border-amber-200/80 dark:border-amber-800/50 rounded-2xl p-6 shadow-lg">
          <div className="flex gap-4">
            <div className="shrink-0 w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white">Save recipes to unlock planning</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                The planner builds each day from your Library so totals can match your calorie and macro targets. Save at
                least one recipe (from Discover or URL import on Pro), then generate. Empty slots surface swaps once your
                library has options.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => onNavigate?.("discover")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium hover:opacity-90"
                >
                  <Home className="w-4 h-4" />
                  Discover
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.("library")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80"
                >
                  <BookMarked className="w-4 h-4" />
                  Library
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!generatedPlan ? (
        <div className="max-w-3xl mx-auto">
          {/* Target Settings */}
          <div className="backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-8 mb-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-slate-900 dark:text-white">Daily targets (optimizer)</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Defaults come from your profile. We search breakfast + lunch + snack + dinner combinations from your saved
              recipes to land near these totals within the bands below.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block mb-3 text-slate-700 dark:text-slate-300 font-medium">Calories</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetCalories}
                    onChange={(e) => setTargetCalories(Number(e.target.value))}
                    className="w-full px-5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-sm"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-medium">kcal</span>
                </div>
              </div>
              <div>
                <label className="block mb-3 text-slate-700 dark:text-slate-300 font-medium">Protein</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetProtein}
                    onChange={(e) => setTargetProtein(Number(e.target.value))}
                    className="w-full px-5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-sm"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-medium">g</span>
                </div>
              </div>
              <div>
                <label className="block mb-3 text-slate-700 dark:text-slate-300 font-medium">Carbs</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetCarbs}
                    onChange={(e) => setTargetCarbs(Number(e.target.value))}
                    className="w-full px-5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-sm"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-medium">g</span>
                </div>
              </div>
              <div>
                <label className="block mb-3 text-slate-700 dark:text-slate-300 font-medium">Fat</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetFat}
                    onChange={(e) => setTargetFat(Number(e.target.value))}
                    className="w-full px-5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-sm"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-medium">g</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-200/70 dark:border-slate-800/70">
              <div>
                <label className="block mb-3 text-slate-700 dark:text-slate-300 font-medium text-sm">
                  Calorie band (±%)
                </label>
                <input
                  type="number"
                  min={5}
                  max={35}
                  value={calorieBandPct}
                  onChange={(e) => setCalorieBandPct(Math.max(5, Math.min(35, Number(e.target.value) || 12)))}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">Allowed spread around calorie goal</p>
              </div>
              <div>
                <label className="block mb-3 text-slate-700 dark:text-slate-300 font-medium text-sm">
                  Carb / fat band (±%)
                </label>
                <input
                  type="number"
                  min={5}
                  max={40}
                  value={carbFatBandPct}
                  onChange={(e) => setCarbFatBandPct(Math.max(5, Math.min(40, Number(e.target.value) || 18)))}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">How tightly to match carb &amp; fat day totals</p>
              </div>
            </div>
          </div>

          {/* Plan Duration */}
          <div className="backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-8 mb-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-slate-900 dark:text-white">Plan Duration</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 3, 7].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    if (!isPaidUser && days !== 1) {
                      toast.error("Upgrade to plan multiple days");
                      return;
                    }
                    setPlanDays(days as 1 | 3 | 7);
                  }}
                  disabled={!isPaidUser && days !== 1}
                  className={[
                    "group relative px-6 py-5 border-2 rounded-xl transition-all duration-300 hover:scale-105",
                    planDays === days
                      ? "border-violet-600 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 text-violet-700 dark:text-violet-300 hover:shadow-xl hover:shadow-violet-500/20"
                      : "border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 hover:shadow-lg",
                    !isPaidUser && days !== 1 ? "opacity-60 cursor-not-allowed hover:scale-100" : "",
                  ].join(" ")}
                >
                  <div className="text-2xl font-bold mb-1">{days}</div>
                  <div className="text-sm opacity-80">{days === 1 ? "Day" : "Days"}</div>
                  <div
                    className={[
                      "absolute top-3 right-3 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center",
                      planDays === days
                        ? "border-violet-600 bg-violet-600"
                        : "border-slate-300 dark:border-slate-600 bg-transparent",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "w-2.5 h-2.5 rounded-full transition-all",
                        planDays === days ? "bg-white" : "bg-slate-300 dark:bg-slate-600",
                      ].join(" ")}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !hasLibraryRecipes}
            className="w-full py-5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-2xl hover:shadow-violet-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg font-semibold hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-3">
              {isGenerating ? (
                <>
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating your plan...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  Generate Meal Plan
                </>
              )}
            </div>
          </button>

          {/* Info */}
          <div className="mt-6 p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-900 dark:text-white">💡 Pro tip:</span> Plans are generated using verified recipes from your library. Save more recipes from Discover to get better variety and accuracy.
            </p>
          </div>
        </div>
      ) : generatedPlan ? (
        <div className="space-y-10">
          {generatedPlan.map((dp) => {
            const summary = daySummaries.find((s) => s.day === dp.day);
            const toneClass = (tone: "ok" | "low" | "high") =>
              tone === "ok"
                ? "text-emerald-600 dark:text-emerald-400"
                : tone === "low"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-orange-600 dark:text-orange-400";
            return (
            <div key={dp.day}>
              <div className="backdrop-blur-xl bg-gradient-to-br from-violet-50/80 to-indigo-50/80 dark:from-violet-950/30 dark:to-indigo-950/30 border-2 border-violet-200/50 dark:border-violet-800/50 rounded-2xl p-8 mb-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/50">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 dark:text-white">Day {dp.day}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      vs targets · ±{calorieBandPct}% calories · ±{carbFatBandPct}% carbs/fat
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="backdrop-blur-sm bg-white/70 dark:bg-slate-900/70 rounded-xl p-5 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Calories</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                      {dp.totals.calories}{" "}
                      <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">/ {targetCalories}</span>
                    </p>
                    <p className={`text-xs font-medium mt-2 ${summary ? toneClass(summary.cal.tone) : ""}`}>
                      {summary?.cal.text ?? "—"}
                    </p>
                  </div>
                  <div className="backdrop-blur-sm bg-white/70 dark:bg-slate-900/70 rounded-xl p-5 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Protein</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                      {dp.totals.protein}g{" "}
                      <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">/ {targetProtein}g</span>
                    </p>
                    <p className={`text-xs font-medium mt-2 flex items-center gap-1 ${summary ? toneClass(summary.pro.tone) : ""}`}>
                      {summary?.pro.tone === "ok" && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                      {summary?.pro.text ?? "—"}
                    </p>
                  </div>
                  <div className="backdrop-blur-sm bg-white/70 dark:bg-slate-900/70 rounded-xl p-5 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Carbs</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">
                      {dp.totals.carbs}g{" "}
                      <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">/ {targetCarbs}g</span>
                    </p>
                    <p className={`text-xs font-medium mt-2 ${summary ? toneClass(summary.carb.tone) : ""}`}>
                      {summary?.carb.text ?? "—"}
                    </p>
                  </div>
                  <div className="backdrop-blur-sm bg-white/70 dark:bg-slate-900/70 rounded-xl p-5 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Fat</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">
                      {dp.totals.fat}g <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">/ {targetFat}g</span>
                    </p>
                    <p className={`text-xs font-medium mt-2 ${summary ? toneClass(summary.fat.tone) : ""}`}>
                      {summary?.fat.text ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {dp.meals.map((meal, index) => {
                  const slotKey = `${dp.day}-${index}`;
                  if (meal.isPlaceholder) {
                    return (
                      <div
                        key={slotKey}
                        className="backdrop-blur-xl bg-slate-50/80 dark:bg-slate-900/50 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-6"
                      >
                        <span className="inline-block px-3 py-1 bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold mb-2">
                          {meal.name}
                        </span>
                        <p className="text-slate-700 dark:text-slate-300 mb-4">{meal.recipeTitle}</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onNavigate?.("discover")}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium"
                          >
                            <Home className="w-4 h-4" />
                            Discover
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate?.("library")}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-medium"
                          >
                            <BookMarked className="w-4 h-4" />
                            Library
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={slotKey}
                      className="group backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 shadow-lg"
                    >
                      <div className="flex items-start justify-between mb-5">
                        <div>
                          <span className="inline-block px-3 py-1 bg-gradient-to-r from-violet-100 to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30 text-violet-700 dark:text-violet-300 rounded-lg text-sm font-semibold mb-2">
                            {meal.name}
                          </span>
                          <h3 className="text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                            {meal.recipeTitle}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => swapMeal(dp.day, index)}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/30 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 rounded-xl transition-all font-medium border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
                          >
                            Swap
                          </button>
                          <button
                            type="button"
                            onClick={() => logPlannedMeal(dp.day, index)}
                            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 font-semibold"
                          >
                            Log
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Calories</p>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">{meal.calories}</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Protein</p>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">{meal.protein}g</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Carbs</p>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">{meal.carbs}g</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Fat</p>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">{meal.fat}g</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
          })}
        </div>
      ) : null}
    </div>
  );
}
