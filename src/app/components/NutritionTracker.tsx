import { useState } from "react";
import { Calendar, Plus, TrendingUp, Target, Award } from "lucide-react";

interface NutritionTrackerProps {
  userTier: "free" | "base" | "pro";
}

interface LoggedMeal {
  id: string;
  name: string;
  recipeTitle: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const mockMeals: LoggedMeal[] = [
  {
    id: "1",
    name: "Breakfast",
    recipeTitle: "Overnight Protein Oats",
    time: "8:30 AM",
    calories: 387,
    protein: 32,
    carbs: 48,
    fat: 8
  },
  {
    id: "2",
    name: "Lunch",
    recipeTitle: "High-Protein Chicken & Rice Bowl",
    time: "12:45 PM",
    calories: 542,
    protein: 48,
    carbs: 52,
    fat: 12
  }
];

export function NutritionTracker({ userTier }: NutritionTrackerProps) {
  const [selectedDate] = useState(new Date());
  const [loggedMeals] = useState<LoggedMeal[]>(mockMeals);

  const targets = {
    calories: 1400,
    protein: 120,
    carbs: 150,
    fat: 40
  };

  const totals = loggedMeals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const getProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressColor = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 90 && percentage <= 110) return "text-green-600 dark:text-green-400 bg-green-500";
    if (percentage > 110) return "text-orange-600 dark:text-orange-400 bg-orange-500";
    return "text-violet-600 dark:text-violet-400 bg-violet-500";
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <h3 className="text-slate-900 dark:text-white">
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h3>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-300 text-sm font-medium">
              ← Prev
            </button>
            <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-300 text-sm font-medium">
              Today
            </button>
            <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-300 text-sm font-medium">
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Daily Progress */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-green-50/80 to-emerald-50/80 dark:from-green-950/30 dark:to-emerald-950/30 border-2 border-green-200/50 dark:border-green-800/50 rounded-2xl p-8 mb-8 shadow-2xl">
        <div className="flex items-center gap-2 mb-6">
          <Award className="w-6 h-6 text-green-600 dark:text-green-400" />
          <h3 className="text-slate-900 dark:text-white">Today's Progress</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* Calories */}
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Calories</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-bold ${getProgressColor(totals.calories, targets.calories)}`}>
                {totals.calories}
              </span>
              <span className="text-lg text-slate-500 dark:text-slate-400">/ {targets.calories}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getProgressColor(totals.calories, targets.calories)} transition-all duration-500`}
                style={{ width: `${getProgress(totals.calories, targets.calories)}%` }}
              ></div>
            </div>
          </div>

          {/* Protein */}
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

          {/* Carbs */}
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

          {/* Fat */}
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
        </div>

        {/* Remaining */}
        <div className="mt-6 pt-6 border-t border-green-200 dark:border-green-800">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Remaining Calories</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {Math.max(targets.calories - totals.calories, 0)} kcal
          </p>
        </div>
      </div>

      {/* Logged Meals */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-slate-900 dark:text-white">Logged Meals</h3>
          <button className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-300 hover:scale-105 flex items-center gap-2 font-semibold">
            <Plus className="w-4 h-4" />
            Add Meal
          </button>
        </div>

        <div className="space-y-4">
          {loggedMeals.map((meal) => (
            <div key={meal.id} className="p-5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="inline-block px-3 py-1 bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 rounded-lg text-sm font-semibold mb-2">
                    {meal.name}
                  </span>
                  <h4 className="text-slate-900 dark:text-white">{meal.recipeTitle}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{meal.time}</p>
                </div>
                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <circle cx="10" cy="4" r="1.5" />
                    <circle cx="10" cy="10" r="1.5" />
                    <circle cx="10" cy="16" r="1.5" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4">
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
            </div>
          ))}

          {loggedMeals.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400 mb-4">No meals logged today</p>
              <button className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-300 hover:scale-105 inline-flex items-center gap-2 font-semibold">
                <Plus className="w-5 h-5" />
                Log Your First Meal
              </button>
            </div>
          )}
        </div>
      </div>

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
