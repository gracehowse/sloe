import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  BookMarked,
  Home,
  Plus,
  BookOpen,
  Layers,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import { RECIPE_CATALOG } from "../../data/recipeCatalog.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";
import {
  DEFAULT_PLANNER_BANDS,
  recipeFitsMealSlot,
  type PlannerMealSlot,
} from "../../lib/planning/generateMealPlan.ts";
import { isCatalogRecipeId } from "../../lib/planning/generateShoppingList.ts";
import { computeSmartRecipeSuggestions } from "../../lib/planning/smartSuggestions.ts";
import { supabase } from "../../lib/supabase/browserClient.ts";
import {
  clampPortionMultiplier,
  dayPlanTotalsFromMeals,
  effectivePortionMultiplier,
  scaledMacro,
} from "../../lib/nutrition/portionMultiplier.ts";
import type { DayPlan } from "../../types/recipe.ts";

interface MealPlannerProps {
  userTier: "free" | "base" | "pro";
  onUpgrade?: () => void;
  onNavigate?: (view: "discover" | "library") => void;
  /** Opens recipe detail (e.g. Discover + `?recipe=`). */
  onOpenRecipe?: (recipeId: string) => void;
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

export function MealPlanner({ userTier, onUpgrade, onNavigate, onOpenRecipe }: MealPlannerProps) {
  const {
    mealPlan,
    setMealPlan,
    generateMealPlan,
    generateShoppingListFromPlan,
    savedRecipesForLibrary,
    addLoggedMealForDate,
    setSelectedDateKey,
    nutritionTargets,
    toggleSaveRecipe,
    isRecipeSaved,
    mealPlanSlots,
    activeMealPlanSlotId,
    switchMealPlanSlot,
    createMealPlanSlot,
    renameMealPlanSlot,
    deleteMealPlanSlot,
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

  void userTier;
  void onUpgrade;

  // Temporarily: all features unlocked (no tier-based caps).

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

  const recalcTotals = (meals: DayPlan["meals"]): DayPlan["totals"] => dayPlanTotalsFromMeals(meals);

  const bumpMealPortion = (day: number, mealIndex: number, delta: number) => {
    setMealPlan((prev) => {
      if (!prev) return prev;
      return prev.map((dp) => {
        if (dp.day !== day) return dp;
        const meals = dp.meals.map((m, idx) => {
          if (idx !== mealIndex || m.isPlaceholder) return m;
          const next = clampPortionMultiplier(effectivePortionMultiplier(m.portionMultiplier) + delta);
          return { ...m, portionMultiplier: next };
        });
        return { ...dp, meals, totals: dayPlanTotalsFromMeals(meals) };
      });
    });
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
      const slot = current.name as PlannerMealSlot;
      const fitsSlot = (title: string) => {
        const r = savedRecipesForLibrary.find((x) => x.title === title);
        return r ? recipeFitsMealSlot(r, slot) : false;
      };
      const candidates = pool.filter(
        (t) => t !== current.recipeTitle && !used.has(t) && fitsSlot(t),
      );
      const nextTitle =
        candidates[0] ??
        pool.find((t) => t !== current.recipeTitle && !used.has(t)) ??
        null;
      if (!nextTitle) {
        toast.error("Save more recipes to enable swapping");
        return prev;
      }
      if (candidates.length === 0) {
        toast.message("No other recipe matched this meal type in your library—showing a broader pick.");
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
              portionMultiplier: 1,
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
    const p = effectivePortionMultiplier(meal.portionMultiplier);
    const catalogRecipe = RECIPE_CATALOG.find((r) => r.title === meal.recipeTitle);
    const savedMatch = savedRecipesForLibrary.find((r) => r.title === meal.recipeTitle);
    const fiberBase = savedMatch?.fiberG ?? catalogRecipe?.fiberG;
    const fiberScaled =
      fiberBase != null && fiberBase > 0 ? scaledMacro(fiberBase, p) : null;
    addLoggedMealForDate(key, {
      name: meal.name,
      recipeTitle: meal.recipeTitle,
      time: "Planned",
      calories: scaledMacro(meal.calories, p),
      protein: scaledMacro(meal.protein, p),
      carbs: scaledMacro(meal.carbs, p),
      fat: scaledMacro(meal.fat, p),
      ...(fiberScaled != null && fiberScaled > 0 ? { fiberG: fiberScaled } : {}),
      ...(p !== 1 ? { portionMultiplier: p } : {}),
    });
    toast.success(`Logged to Nutrition Tracker (Day ${day})`);

    const rid = resolveRecipeId(meal.recipeTitle);
    if (rid && !isCatalogRecipeId(rid)) {
      void (async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user.id;
        if (!uid) return;
        const { error } = await supabase.from("recipe_plan_add_events").insert({
          user_id: uid,
          recipe_id: rid,
        });
        if (error && process.env.NODE_ENV === "development") {
          console.warn("recipe_plan_add_events:", error.message);
        }
      })();
    }
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

  const titleToId = useCallback(
    (title: string) => {
      const catalog = RECIPE_CATALOG.find((r) => r.title === title);
      if (catalog) return catalog.id;
      const uploaded = savedRecipesForLibrary.find((r) => r.title === title);
      return uploaded?.id ?? null;
    },
    [savedRecipesForLibrary],
  );

  const [dbIngByRecipe, setDbIngByRecipe] = useState<Map<string, string[]>>(() => new Map());

  useEffect(() => {
    const plan = generatedPlan ?? mealPlan;
    if (!plan?.length) {
      setDbIngByRecipe(new Map());
      return;
    }
    const ids = new Set<string>();
    for (const day of plan) {
      for (const m of day.meals) {
        if (m.isPlaceholder) continue;
        const id = titleToId(m.recipeTitle);
        if (id && !isCatalogRecipeId(id)) ids.add(id);
      }
    }
    if (ids.size === 0) {
      setDbIngByRecipe(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const map = new Map<string, string[]>();
      await Promise.all(
        [...ids].map(async (rid) => {
          const { data, error } = await supabase
            .from("recipe_ingredients")
            .select("name")
            .eq("recipe_id", rid)
            .order("created_at", { ascending: true });
          if (cancelled || error || !data?.length) return;
          map.set(
            rid,
            data.map((row: { name: string }) => String(row.name ?? "").trim()).filter(Boolean),
          );
        }),
      );
      if (!cancelled) setDbIngByRecipe(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [generatedPlan, mealPlan, titleToId]);

  const communitySuggestionPool = useMemo(
    () => savedRecipesForLibrary.filter((r) => !isCatalogRecipeId(r.id)),
    [savedRecipesForLibrary],
  );

  const smartSuggestions = useMemo(() => {
    const plan = generatedPlan ?? mealPlan;
    return computeSmartRecipeSuggestions({
      mealPlan: plan,
      titleToId,
      dbIngredientsByRecipeId: dbIngByRecipe,
      extraRecipePool: communitySuggestionPool,
    });
  }, [generatedPlan, mealPlan, titleToId, dbIngByRecipe, communitySuggestionPool]);

  const resolveRecipeId = useCallback(
    (recipeTitle: string) => {
      const catalog = RECIPE_CATALOG.find((r) => r.title === recipeTitle);
      if (catalog) return catalog.id;
      const uploaded = savedRecipesForLibrary.find((r) => r.title === recipeTitle);
      return uploaded?.id ?? null;
    },
    [savedRecipesForLibrary],
  );

  return (
    <div className="max-w-6xl mx-auto px-pm-6 py-pm-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-pm-4 flex-wrap">
        <div>
          <div className="flex items-center gap-pm-3 mb-2">
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

      <div className="mb-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Named plans</p>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
          Switch between weekly setups (e.g. &quot;Cut week&quot; vs &quot;Family dinners&quot;). The cloud still syncs the
          active plan only—other slots stay on this device until you switch.
        </p>
        <div className="flex flex-wrap items-stretch gap-2">
          <select
            value={activeMealPlanSlotId}
            onChange={(e) => switchMealPlanSlot(e.target.value)}
            className="flex-1 min-w-[10rem] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white transition-pm"
          >
            {mealPlanSlots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const name = window.prompt("New plan name (e.g. Week of Apr 8)", "");
              if (name === null) return;
              createMealPlanSlot(name);
              toast.success("Created plan");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-sm font-medium hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-pm"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
          <button
            type="button"
            onClick={() => {
              const cur = mealPlanSlots.find((s) => s.id === activeMealPlanSlotId);
              const name = window.prompt("Rename this plan", cur?.name ?? "");
              if (name === null || !name.trim()) return;
              renameMealPlanSlot(activeMealPlanSlotId, name.trim());
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-pm"
            aria-label="Rename plan"
          >
            <Pencil className="w-4 h-4" />
            Rename
          </button>
          <button
            type="button"
            disabled={mealPlanSlots.length <= 1}
            onClick={() => {
              if (!window.confirm("Delete this named plan? This cannot be undone.")) return;
              deleteMealPlanSlot(activeMealPlanSlotId);
              toast.message("Plan removed");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900 disabled:opacity-40 disabled:pointer-events-none transition-pm"
            aria-label="Delete plan"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

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
              Defaults come from your profile. The planner picks breakfast, lunch, snack, and dinner from your saved
              recipes—each recipe is matched to appropriate meal types when possible—then tunes totals within the bands
              below.
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
                    setPlanDays(days as 1 | 3 | 7);
                  }}
                  className={[
                    "group relative px-6 py-5 border-2 rounded-xl transition-all duration-300 hover:scale-105",
                    planDays === days
                      ? "border-violet-600 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 text-violet-700 dark:text-violet-300 hover:shadow-xl hover:shadow-violet-500/20"
                      : "border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 hover:shadow-lg",
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
          <div className="backdrop-blur-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-5 text-sm text-slate-600 dark:text-slate-400">
            <p className="font-medium text-slate-900 dark:text-white mb-1">Logging your day</p>
            <p>
              Tap <span className="text-slate-800 dark:text-slate-200">Log</span> to add a planned meal to your
              Nutrition Tracker. You don&apos;t have to log every slot—open the tracker to scan a barcode, search foods,
              or log ingredients instead of a planned meal whenever you like.
            </p>
          </div>
          {smartSuggestions.length > 0 ? (
            <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                <h3 className="text-slate-900 dark:text-white">Smart suggestions</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Curated picks and saved community recipes that share ingredients with your plan—save them to cook with
                less waste.
              </p>
              <ul className="space-y-3">
                {smartSuggestions.map(({ recipe, sharedIngredients }) => {
                  const saved = isRecipeSaved(recipe.id);
                  return (
                    <li
                      key={recipe.id}
                      className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/40"
                    >
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="w-16 h-16 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-[12rem]">
                        <p className="font-medium text-slate-900 dark:text-white">{recipe.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Also uses: {sharedIngredients.slice(0, 5).join(", ")}
                          {sharedIngredients.length > 5 ? "…" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={saved}
                        onClick={() => {
                          const started = toggleSaveRecipe(recipe.id, userTier);
                          if (started) {
                            track(AnalyticsEvents.smart_suggestion_saved, { recipeId: recipe.id });
                          }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-violet-500/25"
                      >
                        {saved ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Saved
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Add to library
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
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
                  const portion = effectivePortionMultiplier(meal.portionMultiplier);
                  const recipeMeta =
                    savedRecipesForLibrary.find((r) => r.title === meal.recipeTitle) ??
                    RECIPE_CATALOG.find((r) => r.title === meal.recipeTitle);
                  const bestForLabel = recipeMeta?.mealSlots?.length
                    ? recipeMeta.mealSlots.join(", ")
                    : null;
                  return (
                    <div
                      key={slotKey}
                      className="group backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 shadow-lg"
                    >
                      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                        <div>
                          <span className="inline-block px-3 py-1 bg-gradient-to-r from-violet-100 to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30 text-violet-700 dark:text-violet-300 rounded-lg text-sm font-semibold mb-2">
                            {meal.name}
                          </span>
                          <h3 className="text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                            {meal.recipeTitle}
                          </h3>
                          {bestForLabel ? (
                            <p className="text-xs text-violet-600 dark:text-violet-400 mt-1 font-medium">
                              Best for: {bestForLabel}
                            </p>
                          ) : null}
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Portions scale day totals, tracker entries, and shopping amounts.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-1 py-1">
                            <button
                              type="button"
                              aria-label="Decrease portions"
                              onClick={() => bumpMealPortion(dp.day, index, -0.5)}
                              className="w-9 h-9 rounded-lg text-lg font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700"
                            >
                              −
                            </button>
                            <span className="min-w-[2.5rem] text-center text-sm font-semibold text-slate-900 dark:text-white">
                              {portion === Math.floor(portion) ? portion : portion.toFixed(1)}×
                            </span>
                            <button
                              type="button"
                              aria-label="Increase portions"
                              onClick={() => bumpMealPortion(dp.day, index, 0.5)}
                              className="w-9 h-9 rounded-lg text-lg font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => swapMeal(dp.day, index)}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/30 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 rounded-xl transition-all font-medium border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
                          >
                            Swap
                          </button>
                          {onOpenRecipe ? (
                            <button
                              type="button"
                              onClick={() => {
                                const id = resolveRecipeId(meal.recipeTitle);
                                if (id) onOpenRecipe(id);
                                else toast.error("Open this recipe from Library or Discover after saving.");
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                            >
                              <BookOpen className="w-4 h-4" />
                              Recipe
                            </button>
                          ) : null}
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
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {scaledMacro(meal.calories, portion)}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Protein</p>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {scaledMacro(meal.protein, portion)}g
                          </p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Carbs</p>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {scaledMacro(meal.carbs, portion)}g
                          </p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Fat</p>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {scaledMacro(meal.fat, portion)}g
                          </p>
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
