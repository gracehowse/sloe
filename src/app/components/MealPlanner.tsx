import { useState } from "react";
import { Sparkles, Calendar, Lock, TrendingUp, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import type { DayPlan } from "../../types/recipe.ts";

interface MealPlannerProps {
  userTier: "free" | "base" | "pro";
}

const DEFAULT_GENERATED_PLAN: DayPlan[] = [
  {
    day: 1,
    meals: [
      {
        name: "Breakfast",
        recipeTitle: "Overnight Protein Oats",
        calories: 387,
        protein: 32,
        carbs: 48,
        fat: 8,
      },
      {
        name: "Lunch",
        recipeTitle: "High-Protein Chicken & Rice Bowl",
        calories: 542,
        protein: 48,
        carbs: 52,
        fat: 12,
      },
      {
        name: "Dinner",
        recipeTitle: "Grilled Salmon with Roasted Vegetables",
        calories: 468,
        protein: 42,
        carbs: 28,
        fat: 20,
      },
    ],
    totals: {
      calories: 1397,
      protein: 122,
      carbs: 128,
      fat: 40,
    },
  },
];

export function MealPlanner({ userTier }: MealPlannerProps) {
  const { mealPlan, setMealPlan } = useAppData();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<DayPlan[] | null>(() => mealPlan);
  const [targetCalories, setTargetCalories] = useState(1400);
  const [targetProtein, setTargetProtein] = useState(120);

  const isPaidUser = userTier === "base" || userTier === "pro";

  const dayPlan = generatedPlan?.[0];

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setGeneratedPlan(DEFAULT_GENERATED_PLAN);
      setMealPlan(DEFAULT_GENERATED_PLAN);
      setIsGenerating(false);
    }, 2000);
  };

  const handleRegenerate = () => {
    setGeneratedPlan(null);
    setMealPlan(null);
  };

  const handleSavePlan = () => {
    if (generatedPlan) {
      setMealPlan(generatedPlan);
      toast.success("Plan saved to this device");
    }
  };

  if (!isPaidUser) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl blur-2xl opacity-30 animate-pulse"></div>
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/50">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
        </div>
        <h1 className="mb-4 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">AI Meal Planner</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto text-lg">
          Generate personalized meal plans that hit your exact macro targets using recipes from your library. No guesswork, no
          math—just accurate, buildable plans.
        </p>

        <div className="backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-8 mb-10 text-left max-w-2xl mx-auto shadow-2xl">
          <h3 className="mb-6 text-slate-900 dark:text-white">Features</h3>
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Precision Targeting</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Hits calorie targets within ±5% and protein within ±10g</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Your Library Only</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Uses recipes you've saved—no hallucinated foods</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Fully Editable</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Swap meals, adjust servings, and save custom plans</p>
              </div>
            </div>
          </div>
        </div>

        <button type="button" className="px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-2xl hover:shadow-violet-500/30 transition-all duration-300 hover:scale-105 inline-flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="w-5 h-5" />
          Upgrade to Base or Pro
        </button>
      </div>
    );
  }

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
              onClick={handleSavePlan}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 hover:scale-105 font-semibold"
            >
              Save Plan
            </button>
          </div>
        )}
      </div>

      {!generatedPlan ? (
        <div className="max-w-3xl mx-auto">
          {/* Target Settings */}
          <div className="backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-8 mb-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-slate-900 dark:text-white">Daily Targets</h3>
            </div>
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
                  className="group relative px-6 py-5 border-2 border-violet-600 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 text-violet-700 dark:text-violet-300 rounded-xl hover:shadow-xl hover:shadow-violet-500/20 transition-all duration-300 hover:scale-105"
                >
                  <div className="text-2xl font-bold mb-1">{days}</div>
                  <div className="text-sm opacity-80">{days === 1 ? "Day" : "Days"}</div>
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full border-2 border-violet-600 group-hover:bg-violet-600 transition-all flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-600 group-hover:bg-white transition-all"></div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
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
      ) : dayPlan ? (
        <div>
          {/* Plan Overview */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-violet-50/80 to-indigo-50/80 dark:from-violet-950/30 dark:to-indigo-950/30 border-2 border-violet-200/50 dark:border-violet-800/50 rounded-2xl p-8 mb-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/50">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-slate-900 dark:text-white">Day 1 Plan</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="backdrop-blur-sm bg-white/70 dark:bg-slate-900/70 rounded-xl p-5 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Total Calories</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">{dayPlan.totals.calories}</p>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {Math.round(((dayPlan.totals.calories - targetCalories) / targetCalories) * 100)}%
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Target: {targetCalories} kcal</p>
              </div>
              <div className="backdrop-blur-sm bg-white/70 dark:bg-slate-900/70 rounded-xl p-5 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Protein</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">{dayPlan.totals.protein}g</p>
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Target: {targetProtein}g</p>
              </div>
              <div className="backdrop-blur-sm bg-white/70 dark:bg-slate-900/70 rounded-xl p-5 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Carbs</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{dayPlan.totals.carbs}g</p>
              </div>
              <div className="backdrop-blur-sm bg-white/70 dark:bg-slate-900/70 rounded-xl p-5 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Fat</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{dayPlan.totals.fat}g</p>
              </div>
            </div>
          </div>

          {/* Meals */}
          <div className="space-y-5">
            {dayPlan.meals.map((meal, index) => (
              <div key={index} className="group backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 shadow-lg">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <span className="inline-block px-3 py-1 bg-gradient-to-r from-violet-100 to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30 text-violet-700 dark:text-violet-300 rounded-lg text-sm font-semibold mb-2">{meal.name}</span>
                    <h3 className="text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{meal.recipeTitle}</h3>
                  </div>
                  <button type="button" className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/30 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 rounded-xl transition-all font-medium border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700">
                    Swap
                  </button>
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
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
