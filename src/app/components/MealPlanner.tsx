import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { toast } from "sonner";
import { DailyRing } from "./platemate/daily-ring";
import { MacroCard } from "./platemate/macro-card";
import { useAppData } from "../../context/AppDataContext.tsx";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";
import {
  DEFAULT_PLANNER_BANDS,
  recipeFitsMealSlot,
  type PlannerMealSlot,
} from "../../lib/planning/generateMealPlan.ts";
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
  /** Opens recipe detail in cook mode directly. Optionally pass portion multiplier. */
  onCookRecipe?: (recipeId: string, portionMultiplier?: number) => void;
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

export const MealPlanner = memo(function MealPlanner({ userTier, onUpgrade, onNavigate, onOpenRecipe, onCookRecipe }: MealPlannerProps) {
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
  const [loggedMealKeys, setLoggedMealKeys] = useState<Set<string>>(new Set());
  const [targetCalories, setTargetCalories] = useState(nutritionTargets.calories);
  const [targetProtein, setTargetProtein] = useState(nutritionTargets.protein);
  const [targetCarbs, setTargetCarbs] = useState(nutritionTargets.carbs);
  const [targetFat, setTargetFat] = useState(nutritionTargets.fat);
  const [calorieBandPct, setCalorieBandPct] = useState<number>(DEFAULT_PLANNER_BANDS.calorieBandPct);
  const [carbFatBandPct, setCarbFatBandPct] = useState<number>(DEFAULT_PLANNER_BANDS.carbFatBandPct);
  const [planDays, setPlanDays] = useState<1 | 3 | 7>(1);

  const hasLibraryRecipes = savedRecipesForLibrary.length > 0;

  const isFree = userTier === "free";

  const handleGenerate = () => {
    if (!hasLibraryRecipes) {
      toast.error("Save at least one recipe first.");
      return;
    }
    setIsGenerating(true);
    setLoggedMealKeys(new Set()); // Reset logged tracking for new plan
    setTimeout(async () => {
      try {
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
        toast.success(`${planDays}-day plan ready! Shopping list updated.`);
        // Scroll to top so user sees the generated plan
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        toast.error("Could not generate plan. Try saving more recipes or adjusting your targets.");
      } finally {
        setIsGenerating(false);
      }
    }, 50);
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

    const mealKey = `${day}-${mealIndex}`;
    if (loggedMealKeys.has(mealKey)) {
      toast.message("Already logged this meal today.");
      return;
    }
    setLoggedMealKeys((prev) => new Set(prev).add(mealKey));

    const d = new Date();
    d.setDate(d.getDate() + (day - 1));
    const key = d.toISOString().slice(0, 10);
    setSelectedDateKey(key);
    const p = effectivePortionMultiplier(meal.portionMultiplier);
    const savedMatch = savedRecipesForLibrary.find((r) => r.title === meal.recipeTitle);
    const fiberBase = savedMatch?.fiberG;
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
    if (rid) {
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
        if (id) ids.add(id);
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
    () => savedRecipesForLibrary,
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
            <div className="p-2 bg-primary rounded-xl">
              <Icons.sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">AI Meal Planner</h1>
          </div>
          <p className="text-muted-foreground">Generate meal plans from your saved recipes</p>
        </div>
        {generatedPlan && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRegenerate}
              className="px-5 py-2.5 bg-card border border-border rounded-xl hover:bg-muted transition-all shadow-sm"
            >
              Regenerate
            </button>
            <button
              type="button"
              onClick={() => void generateShoppingListFromPlan()}
              className="px-5 py-2.5 bg-card border border-border rounded-xl hover:bg-muted transition-all shadow-sm"
            >
              Generate Shopping List
            </button>
            <button
              type="button"
              onClick={handleSavePlan}
              className="px-5 py-2.5 bg-primary text-white rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105 font-semibold"
            >
              Save Plan
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card/70 backdrop-blur-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Icons.adjust className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Named plans</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Switch between weekly setups (e.g. &quot;Cut week&quot; vs &quot;Family dinners&quot;). The cloud still syncs the
          active plan only—other slots stay on this device until you switch.
        </p>
        <div className="flex flex-wrap items-stretch gap-2">
          <select
            value={activeMealPlanSlotId}
            onChange={(e) => switchMealPlanSlot(e.target.value)}
            className="flex-1 min-w-[10rem] rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground transition-pm"
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition-pm"
          >
            <Icons.add className="w-4 h-4" />
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted/80 transition-pm"
            aria-label="Rename plan"
          >
            <Icons.edit className="w-4 h-4" />
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-sm font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 disabled:opacity-40 disabled:pointer-events-none transition-pm"
            aria-label="Delete plan"
          >
            <Icons.delete className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {!hasLibraryRecipes && (
        <div className="max-w-3xl mx-auto mb-8 backdrop-blur-xl bg-warning/10 border-2 border-warning/30 rounded-2xl p-6 shadow-lg">
          <div className="flex gap-4">
            <div className="shrink-0 w-11 h-11 rounded-xl bg-warning/20 flex items-center justify-center">
              <Icons.alert className="w-6 h-6 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Save recipes to unlock planning</p>
              <p className="text-sm text-muted-foreground mt-1">
                The planner builds each day from your Library so totals can match your calorie and macro targets. Save at
                least one recipe (from Discover or URL import on Pro), then generate. Empty slots surface swaps once your
                library has options.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => onNavigate?.("discover")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-card text-sm font-medium hover:opacity-90"
                >
                  <Icons.home className="w-4 h-4" />
                  Discover
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.("library")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-border text-foreground text-sm font-medium hover:bg-muted/80"
                >
                  <Icons.save className="w-4 h-4" />
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
          <div className="bg-card border border-border rounded-2xl p-8 mb-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icons.trendUp className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-foreground">Daily targets (optimizer)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Defaults come from your profile. The planner picks breakfast, lunch, snack, and dinner from your saved
              recipes—each recipe is matched to appropriate meal types when possible—then tunes totals within the bands
              below.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block mb-3 text-foreground font-medium">Calories</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetCalories}
                    onChange={(e) => setTargetCalories(Number(e.target.value))}
                    className="w-full px-5 py-3 bg-card border-2 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">kcal</span>
                </div>
              </div>
              <div>
                <label className="block mb-3 text-foreground font-medium">Protein</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetProtein}
                    onChange={(e) => setTargetProtein(Number(e.target.value))}
                    className="w-full px-5 py-3 bg-card border-2 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">g</span>
                </div>
              </div>
              <div>
                <label className="block mb-3 text-foreground font-medium">Carbs</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetCarbs}
                    onChange={(e) => setTargetCarbs(Number(e.target.value))}
                    className="w-full px-5 py-3 bg-card border-2 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">g</span>
                </div>
              </div>
              <div>
                <label className="block mb-3 text-foreground font-medium">Fat</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetFat}
                    onChange={(e) => setTargetFat(Number(e.target.value))}
                    className="w-full px-5 py-3 bg-card border-2 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">g</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-border/50">
              <div>
                <label className="block mb-3 text-foreground font-medium text-sm">
                  Calorie band (±%)
                </label>
                <input
                  type="number"
                  min={5}
                  max={35}
                  value={calorieBandPct}
                  onChange={(e) => setCalorieBandPct(Math.max(5, Math.min(35, Number(e.target.value) || 12)))}
                  className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">Allowed spread around calorie goal</p>
              </div>
              <div>
                <label className="block mb-3 text-foreground font-medium text-sm">
                  Carb / fat band (±%)
                </label>
                <input
                  type="number"
                  min={5}
                  max={40}
                  value={carbFatBandPct}
                  onChange={(e) => setCarbFatBandPct(Math.max(5, Math.min(40, Number(e.target.value) || 18)))}
                  className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">How tightly to match carb &amp; fat day totals</p>
              </div>
            </div>
          </div>

          {/* Plan Duration */}
          <div className="bg-card border border-border rounded-2xl p-8 mb-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icons.plan className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-foreground">Plan Duration</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 3, 7].map((days) => {
                const locked = isFree && days > 1;
                return (
                <button
                  key={days}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (locked) {
                      onUpgrade?.();
                      return;
                    }
                    setPlanDays(days as 1 | 3 | 7);
                  }}
                  className={[
                    "group relative px-6 py-5 border-2 rounded-xl transition-all duration-300 hover:scale-105",
                    planDays === days
                      ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 text-primary hover:shadow-xl hover:shadow-primary/20"
                      : "border-border bg-card/70 text-muted-foreground hover:shadow-lg",
                  ].join(" ")}
                >
                  <div className="text-2xl font-bold mb-1">{days}</div>
                  <div className="text-sm opacity-80">{days === 1 ? "Day" : "Days"}</div>
                  <div
                    className={[
                      "absolute top-3 right-3 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center",
                      planDays === days
                        ? "border-primary bg-primary"
                        : "border-border bg-transparent",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "w-2.5 h-2.5 rounded-full transition-all",
                        planDays === days ? "bg-card" : "bg-muted",
                      ].join(" ")}
                    />
                  </div>
                  {locked && <div className="absolute inset-0 flex items-center justify-center bg-foreground/10 rounded-xl"><span className="text-xs font-semibold text-primary">Base</span></div>}
                </button>
                );
              })}
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !hasLibraryRecipes}
            className="w-full py-5 bg-primary text-white rounded-xl hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg font-semibold hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-3">
              {isGenerating ? (
                <>
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating your plan...
                </>
              ) : (
                <>
                  <Icons.sparkles className="w-6 h-6" />
                  Generate Meal Plan
                </>
              )}
            </div>
          </button>

          {/* Info */}
          <div className="mt-6 p-5 bg-gradient-to-br from-muted to-muted/50 rounded-2xl border border-border/50">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">💡 Pro tip:</span> Plans are generated using verified recipes from your library. Save more recipes from Discover to get better variety and accuracy.
            </p>
          </div>
        </div>
      ) : generatedPlan ? (
        <div className="space-y-6">
          {/* Header: "Meal Plan" + date range on left, "AI Auto-fill" button on right */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[22px] font-bold text-foreground">Meal Plan</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {generatedPlan.length > 0
                  ? (() => {
                      const firstDay = new Date();
                      firstDay.setDate(firstDay.getDate() + (generatedPlan[0].day - 1));
                      const lastDay = new Date();
                      lastDay.setDate(lastDay.getDate() + (generatedPlan[generatedPlan.length - 1].day - 1));
                      const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      return `${fmt(firstDay)} – ${fmt(lastDay)}`;
                    })()
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRegenerate}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              AI Auto-fill
            </button>
          </div>

          {/* Horizontal scrollable day cards */}
          <div className="overflow-x-auto -mx-pm-6 px-pm-6 pb-2">
            <div className="flex gap-3 min-w-min">
              {generatedPlan.map((dp) => {
                const isToday = dp.day === 1;
                const dayDate = new Date();
                dayDate.setDate(dayDate.getDate() + (dp.day - 1));
                const dayName = dayDate.toLocaleDateString("en-US", { weekday: "short" });
                const summary = daySummaries.find((s) => s.day === dp.day);
                const caloriePercent = targetCalories > 0 ? (dp.totals.calories / targetCalories) * 100 : 0;

                return (
                  <div
                    key={dp.day}
                    className={`min-w-[96px] rounded-xl p-2.5 border flex flex-col ${
                      isToday
                        ? "bg-primary/10 border-primary/30"
                        : "bg-card border-border"
                    }`}
                  >
                    {/* Day name */}
                    <div className={`text-[11px] font-semibold text-center mb-2 ${
                      isToday ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {dayName}
                    </div>

                    {/* Meal names */}
                    <div className="flex-1 flex flex-col gap-1 text-[10px] text-muted-foreground mb-2">
                      {dp.meals.length > 0 ? (
                        dp.meals.map((meal, idx) => (
                          <div key={idx} className="truncate">
                            {meal.recipeTitle}
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-[10px] text-muted-foreground">Empty</div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mb-1">
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            caloriePercent > 90
                              ? "bg-success"
                              : caloriePercent > 50
                                ? "bg-amber-500"
                                : "bg-muted"
                          }`}
                          style={{ width: `${Math.min(caloriePercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Calorie label */}
                    <div className="text-[9px] text-muted-foreground text-center tabular-nums">
                      {Math.round(dp.totals.calories)} / {targetCalories}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today's plan detail section */}
          {generatedPlan.length > 0 && (() => {
            const todayPlan = generatedPlan[0];
            return (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  TODAY'S PLAN
                </div>
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                  <div className="space-y-4">
                    {todayPlan.meals.length > 0 ? (
                      todayPlan.meals.map((meal, index) => {
                        if (meal.isPlaceholder) return null;
                        const portion = effectivePortionMultiplier(meal.portionMultiplier);
                        return (
                          <div key={index} className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                              <Icons.recipe className="w-4 h-4 text-success" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-[13px] font-semibold text-foreground">
                                {meal.recipeTitle}
                              </h3>
                              <p className="text-[12px] text-muted-foreground mt-0.5">
                                {meal.name} · {Math.round(scaledMacro(meal.calories, portion))} kcal
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-[12px] text-muted-foreground">No meals planned</p>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigate?.("discover")}
                      className="text-[12px] font-medium text-primary hover:text-primary/80 transition-colors mt-2"
                    >
                      + Add meal
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Shopping list link */}
          <div
            className="bg-card border border-border rounded-2xl p-6 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigate?.("library")}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Icons.shopping className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-[13px] font-semibold text-foreground">Shopping List</h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {generatedPlan.flatMap((d) => d.meals).filter((m) => !m.isPlaceholder).length} items from this week
                </p>
              </div>
              <Icons.forward className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            </div>
          </div>

          {/* Rest of the plan details (kept from original) */}
          <div className="backdrop-blur-xl bg-muted/80 border border-border/50 rounded-2xl p-5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Logging your day</p>
            <p>
              Tap <span className="text-foreground">Log</span> to add a planned meal to your
              Nutrition Tracker. You don&apos;t have to log every slot—open the tracker to scan a barcode, search foods,
              or log ingredients instead of a planned meal whenever you like.
            </p>
          </div>

          {smartSuggestions.length > 0 ? (
            <div className="backdrop-blur-xl bg-card/70 border border-border/50 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icons.trendUp className="w-5 h-5 text-primary" />
                <h3 className="text-foreground">Smart suggestions</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Curated picks and saved community recipes that share ingredients with your plan—save them to cook with
                less waste.
              </p>
              <ul className="space-y-3">
                {smartSuggestions.map(({ recipe, sharedIngredients }) => {
                  const saved = isRecipeSaved(recipe.id);
                  return (
                    <li
                      key={recipe.id}
                      className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-border/50 bg-muted/50"
                    >
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="w-16 h-16 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-[12rem]">
                        <p className="font-medium text-foreground">{recipe.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
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
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-card text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/25"
                      >
                        {saved ? (
                          <>
                            <Icons.check className="w-4 h-4" />
                            Saved
                          </>
                        ) : (
                          <>
                            <Icons.add className="w-4 h-4" />
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

          {/* Detailed day breakdowns (original structure) */}
          {generatedPlan.map((dp) => {
            const summary = daySummaries.find((s) => s.day === dp.day);
            const toneClass = (tone: "ok" | "low" | "high") =>
              tone === "ok"
                ? "text-success"
                : tone === "low"
                  ? "text-warning"
                  : "text-warning";
            return (
            <div key={dp.day}>
              <div className="backdrop-blur-xl bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/30 rounded-2xl p-8 mb-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/50">
                    <Icons.plan className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-foreground">Day {dp.day}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      vs targets · ±{calorieBandPct}% calories · ±{carbFatBandPct}% carbs/fat
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
                  <div className="flex justify-center md:col-span-1">
                    <DailyRing consumed={dp.totals.calories} target={targetCalories} size={120} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:col-span-4">
                    <MacroCard macro="calories" value={dp.totals.calories} target={targetCalories} unit="kcal" />
                    <MacroCard macro="protein" value={dp.totals.protein} target={targetProtein} unit="g" />
                    <MacroCard macro="carbs" value={dp.totals.carbs} target={targetCarbs} unit="g" />
                    <MacroCard macro="fat" value={dp.totals.fat} target={targetFat} unit="g" />
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
                        className="backdrop-blur-xl bg-muted/50 border-2 border-dashed border-border rounded-2xl p-6"
                      >
                        <span className="inline-block px-3 py-1 bg-muted text-foreground rounded-lg text-sm font-semibold mb-2">
                          {meal.name}
                        </span>
                        <p className="text-foreground mb-4">{meal.recipeTitle}</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onNavigate?.("discover")}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-card text-sm font-medium"
                          >
                            <Icons.home className="w-4 h-4" />
                            Discover
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate?.("library")}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium"
                          >
                            <Icons.save className="w-4 h-4" />
                            Library
                          </button>
                        </div>
                      </div>
                    );
                  }
                  const portion = effectivePortionMultiplier(meal.portionMultiplier);
                  const recipeMeta =
                    savedRecipesForLibrary.find((r) => r.title === meal.recipeTitle);
                  const bestForLabel = recipeMeta?.mealSlots?.length
                    ? recipeMeta.mealSlots.join(", ")
                    : null;
                  return (
                    <div
                      key={slotKey}
                      className="group bg-card border border-border rounded-2xl p-6 hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 shadow-lg"
                    >
                      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                        <div>
                          <span className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-lg text-sm font-semibold mb-2">
                            {meal.name}
                          </span>
                          <h3 className="text-foreground group-hover:text-primary transition-colors">
                            {meal.recipeTitle}
                          </h3>
                          {bestForLabel ? (
                            <p className="text-xs text-primary mt-1 font-medium">
                              Best for: {bestForLabel}
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground mt-1">
                            Portions scale day totals, tracker entries, and shopping amounts.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/80 px-1 py-1">
                            <button
                              type="button"
                              aria-label="Decrease portions"
                              onClick={() => bumpMealPortion(dp.day, index, -0.5)}
                              className="w-9 h-9 rounded-lg text-lg font-semibold text-foreground hover:bg-muted"
                            >
                              −
                            </button>
                            <span className="min-w-[2.5rem] text-center text-sm font-semibold text-foreground">
                              {portion === Math.floor(portion) ? portion : portion.toFixed(1)}×
                            </span>
                            <button
                              type="button"
                              aria-label="Increase portions"
                              onClick={() => bumpMealPortion(dp.day, index, 0.5)}
                              className="w-9 h-9 rounded-lg text-lg font-semibold text-foreground hover:bg-muted"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => swapMeal(dp.day, index)}
                            className="px-4 py-2 bg-muted hover:bg-primary/10 text-foreground hover:text-primary rounded-xl transition-all font-medium border border-border hover:border-primary/30"
                          >
                            Swap
                          </button>
                          {onCookRecipe ? (
                            <button
                              type="button"
                              onClick={() => {
                                const id = resolveRecipeId(meal.recipeTitle);
                                if (id) onCookRecipe(id, portion);
                                else toast.error("Open this recipe from Library or Discover after saving.");
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/30 text-success rounded-xl hover:bg-success/20 font-medium"
                            >
                              <Icons.cook className="w-4 h-4" />
                              Cook
                            </button>
                          ) : null}
                          {onOpenRecipe ? (
                            <button
                              type="button"
                              onClick={() => {
                                const id = resolveRecipeId(meal.recipeTitle);
                                if (id) onOpenRecipe(id);
                                else toast.error("Open this recipe from Library or Discover after saving.");
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-xl hover:bg-muted font-medium"
                            >
                              <Icons.recipe className="w-4 h-4" />
                              Recipe
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => logPlannedMeal(dp.day, index)}
                            className="px-4 py-2 bg-primary text-white rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 font-semibold"
                          >
                            Log
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-muted/50 rounded-xl border border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">Calories</p>
                          <p className="text-xl font-bold font-mono tabular-nums text-foreground">
                            {scaledMacro(meal.calories, portion)}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-xl border border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">Protein</p>
                          <p className="text-xl font-bold font-mono tabular-nums text-foreground">
                            {scaledMacro(meal.protein, portion)}g
                          </p>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-xl border border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">Carbs</p>
                          <p className="text-xl font-bold font-mono tabular-nums text-foreground">
                            {scaledMacro(meal.carbs, portion)}g
                          </p>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-xl border border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">Fat</p>
                          <p className="text-xl font-bold font-mono tabular-nums text-foreground">
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
});
