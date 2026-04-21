import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { SlidersHorizontal, ShoppingCart, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { DailyRing } from "./suppr/daily-ring";
import { MacroCard } from "./suppr/macro-card";
import { PlanTemplatesDialog } from "./suppr/plan-templates-dialog";
import { Badge } from "./suppr/badge";
import { DestructiveConfirmDialog } from "./suppr/destructive-confirm-dialog";
import { TextPromptDialog } from "./suppr/text-prompt-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAppData } from "../../context/AppDataContext.tsx";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";
import {
  DEFAULT_PLANNER_BANDS,
  recipeFitsMealSlot,
  type PlannerMealSlot,
} from "../../lib/planning/generateMealPlan.ts";
import {
  PORTION_MULTIPLIER_CLAMP,
  clampPlannerMultiplier,
} from "../../lib/nutrition/mealPlanAlgo.ts";
import { computeSmartRecipeSuggestions } from "../../lib/planning/smartSuggestions.ts";
import { supabase } from "../../lib/supabase/browserClient.ts";
import {
  dayPlanTotalsFromMeals,
  effectivePortionMultiplier,
  isMealPlanPlaceholderLikeTitle,
  scaledMacro,
} from "../../lib/nutrition/portionMultiplier.ts";
import {
  buildDayTotalVsGoalLine,
  formatDayTotalCell,
  type DayTotalTone,
} from "../../lib/planning/dayTotalVsGoal.ts";
import {
  buildPlanWeekSummarySubtitle,
  computePlanWeekSummaryScore,
} from "../../lib/planning/planWeekSummary.ts";
import {
  buildTemplateFromWeek,
  applyTemplateToWeek,
  type PlanTemplate,
} from "../../lib/nutrition/planTemplates.ts";
import {
  createPlanTemplate,
  deletePlanTemplate,
  listPlanTemplates,
} from "../../lib/nutrition/planTemplatesClient.ts";
import {
  countLeftoversOfRecipe,
  distributeLeftovers,
  markLeftoversOnSwap,
  moveMealInPlan,
  type LeftoverAwareMeal,
} from "../../lib/nutrition/leftoversPlanner.ts";
import type { DayPlan } from "../../types/recipe.ts";

interface MealPlannerProps {
  userTier: "free" | "base" | "pro";
  onUpgrade?: () => void;
  onNavigate?: (view: "discover" | "library" | "shopping") => void;
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

  // Batch 3.10 — plan templates state.
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Batch 3.10 — drag-drop source pointer. `null` outside any drag.
  const [dragSource, setDragSource] = useState<{ day: number; slotIndex: number } | null>(null);

  // Audit M7 (2026-04-18) — themed dialogs replacing the prior
  // `window.prompt` / `window.confirm` call sites inside MealPlanner.
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [renamePlanOpen, setRenamePlanOpen] = useState(false);
  const [deletePlanOpen, setDeletePlanOpen] = useState(false);
  /** Pending template apply (non-destructive confirm — overwrites the current week). */
  const [applyTemplatePending, setApplyTemplatePending] = useState<PlanTemplate | null>(null);
  /** Pending swap that would remove `count` leftover children; confirm before swapping. */
  const [swapLeftoverConfirm, setSwapLeftoverConfirm] = useState<
    | { day: number; mealIndex: number; leftoverCount: number }
    | null
  >(null);
  /** Pending keyboard-accessible "Move" fallback. */
  const [movePrompt, setMovePrompt] = useState<
    | { day: number; slotIndex: number }
    | null
  >(null);
  const [moveDay, setMoveDay] = useState("");
  const [moveSlot, setMoveSlot] = useState("");

  const refreshPlanTemplates = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) return;
    setTemplatesLoading(true);
    try {
      const { templates, error } = await listPlanTemplates(supabase, uid);
      if (error) {
        toast.error(`Could not load templates: ${error}`);
        return;
      }
      setPlanTemplates(templates);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (templatesOpen) void refreshPlanTemplates();
  }, [templatesOpen, refreshPlanTemplates]);

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
        // Batch 3.10 — run a leftovers distribution pass over the freshly
        // generated plan. Only recipes with servings > 1 contribute; the
        // helper is a no-op when no yields qualify.
        const recipesByRef: Record<string, { servings: number }> = {};
        for (const r of savedRecipesForLibrary) {
          if (r.servings && r.servings > 1) recipesByRef[r.id] = { servings: r.servings };
        }
        if (Object.keys(recipesByRef).length > 0) {
          setMealPlan((prev) => {
            if (!prev) return prev;
            const { plan: withLeftovers, parentCount, leftoverCount } = distributeLeftovers(
              prev,
              recipesByRef,
            );
            if (leftoverCount > 0) {
              track(AnalyticsEvents.plan_leftovers_generated, { parentCount, leftoverCount });
            }
            return withLeftovers;
          });
        }
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
    // Plan + grocery list regenerate together — clearing the plan and then
    // calling handleGenerate produces a new plan AND a fresh shopping list
    // in a single tap. TestFlight build 7 `AEe5QKJqkPPxtFMbDpVW5yg`
    // (2026-04-18): tester noted the prior split flow felt clunky because
    // they had to click a separate "Generate grocery list" button after
    // every regenerate.
    setGeneratedPlan(null);
    handleGenerate();
  };

  // `handleSavePlan` was removed 2026-04-20 with the header restyle —
  // plans save automatically and the button was informational-only (a
  // single toast reminding users of that). No functional loss.

  // Batch 3.10 — move a meal between slots / days. Source & destination
  // may be on the same day (re-orders within day) or different days.
  const handleMoveMeal = useCallback(
    (from: { day: number; slotIndex: number }, to: { day: number; slotIndex: number }) => {
      if (from.day === to.day && from.slotIndex === to.slotIndex) return;
      setMealPlan((prev) => {
        if (!prev) return prev;
        const next = moveMealInPlan(prev, from, to);
        const fromDay = prev.find((d) => d.day === from.day);
        const toDay = prev.find((d) => d.day === to.day);
        const fromSlot = fromDay?.meals[from.slotIndex]?.name ?? "";
        const toSlot = toDay?.meals[to.slotIndex]?.name ?? "";
        track(AnalyticsEvents.meal_moved_in_plan, {
          fromSlot,
          toSlot,
          crossDay: from.day !== to.day,
        });
        toast.success("Moved meal");
        return next;
      });
    },
    [setMealPlan],
  );

  const handleSaveTemplate = useCallback(
    async (name: string, dayCount: number): Promise<{ ok: boolean; error?: string }> => {
      const source = generatedPlan ?? mealPlan;
      const draft = buildTemplateFromWeek(source, name, dayCount);
      if (!draft) {
        return { ok: false, error: "This plan has no meals to save." };
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) return { ok: false, error: "Sign in to save templates." };
      const { template, error } = await createPlanTemplate(supabase, uid, draft);
      if (error || !template) return { ok: false, error: error ?? "Could not save template." };
      track(AnalyticsEvents.plan_template_created, {
        dayCount: draft.dayCount,
        slotCount: draft.slots.length,
      });
      toast.success(`Saved "${template.name}"`);
      setPlanTemplates((prev) => [template, ...prev.filter((t) => t.id !== template.id)]);
      return { ok: true };
    },
    [generatedPlan, mealPlan],
  );

  // Audit M7 (2026-04-18) — Apply Template used to confirm via
  // `window.confirm`. It now opens a themed `DestructiveConfirmDialog`
  // (destructive variant because applying overwrites the current
  // week). The actual apply runs from `commitApplyTemplate` once the
  // user confirms.
  const handleApplyTemplate = useCallback(
    (templateId: string) => {
      const tmpl = planTemplates.find((t) => t.id === templateId);
      if (!tmpl) return;
      setApplyTemplatePending(tmpl);
    },
    [planTemplates],
  );

  const commitApplyTemplate = useCallback(
    (tmpl: PlanTemplate) => {
      const next = applyTemplateToWeek(tmpl);
      setMealPlan(next);
      track(AnalyticsEvents.plan_template_applied, { dayCount: tmpl.dayCount, slotCount: tmpl.slots.length });
      toast.success(`Applied "${tmpl.name}"`);
      setTemplatesOpen(false);
    },
    [setMealPlan],
  );

  const handleDeleteTemplate = useCallback(
    async (templateId: string): Promise<{ ok: boolean; error?: string }> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) return { ok: false, error: "Sign in required." };
      const { error } = await deletePlanTemplate(supabase, uid, templateId);
      if (error) return { ok: false, error };
      setPlanTemplates((prev) => prev.filter((t) => t.id !== templateId));
      toast.success("Template deleted");
      return { ok: true };
    },
    [],
  );

  const recalcTotals = (meals: DayPlan["meals"]): DayPlan["totals"] => dayPlanTotalsFromMeals(meals);

  const bumpMealPortion = (day: number, mealIndex: number, delta: number) => {
    setMealPlan((prev) => {
      if (!prev) return prev;
      return prev.map((dp) => {
        if (dp.day !== day) return dp;
        const meals = dp.meals.map((m, idx) => {
          if (idx !== mealIndex || isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder })) {
            return m;
          }
          // F-15 — shared planner clamp (0.2..2.5, 0.1 step). Adopted
          // from mobile for parity (was 0.5..8 at 0.5 step on web).
          const next = clampPlannerMultiplier(effectivePortionMultiplier(m.portionMultiplier) + delta);
          return { ...m, portionMultiplier: next };
        });
        return { ...dp, meals, totals: dayPlanTotalsFromMeals(meals) };
      });
    });
  };

  /** Actual swap logic. Safe to call after any leftover-confirmation
   * has already cleared. Split out (audit M7, 2026-04-18) so the
   * destructive-confirm dialog can defer back to it. */
  const performSwap = (day: number, mealIndex: number) => {
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

  /** Entry point: if swapping this meal would drop `N` downstream
   * leftover children, open a themed destructive-confirm dialog
   * before running the swap. Otherwise run immediately. Audit M7
   * (2026-04-18) — replaces the prior `window.confirm` blocking
   * call. */
  const swapMeal = (day: number, mealIndex: number) => {
    const dp = (generatedPlan ?? mealPlan)?.find((x) => x.day === day);
    const curMeal = dp?.meals[mealIndex];
    if (
      curMeal &&
      isMealPlanPlaceholderLikeTitle(curMeal.recipeTitle, { isPlaceholder: curMeal.isPlaceholder })
    ) {
      toast.error("Save recipes to enable swapping");
      return;
    }
    const prevPlan = generatedPlan ?? mealPlan;
    const curRecipeId = (curMeal as (typeof curMeal & { recipeId?: string }) | undefined)?.recipeId;
    if (prevPlan && curRecipeId) {
      const leftoverCount = countLeftoversOfRecipe(prevPlan, curRecipeId);
      if (leftoverCount > 0) {
        setSwapLeftoverConfirm({ day, mealIndex, leftoverCount });
        return;
      }
    }
    performSwap(day, mealIndex);
  };

  /** Commits a swap after the leftover-confirm dialog accepts. Clears
   * the downstream leftover children first so totals stay consistent,
   * then runs the normal swap logic. */
  const commitSwapWithLeftoverClear = (
    day: number,
    mealIndex: number,
  ) => {
    const dp = (generatedPlan ?? mealPlan)?.find((x) => x.day === day);
    const curMeal = dp?.meals[mealIndex];
    const curRecipeId = (curMeal as (typeof curMeal & { recipeId?: string }) | undefined)?.recipeId;
    if (curRecipeId) {
      setMealPlan((prev) => {
        if (!prev) return prev;
        const dayIdx = prev.findIndex((d) => d.day === day);
        const { plan: cleaned } = markLeftoversOnSwap(prev, {
          dayIndex: dayIdx,
          slot: curMeal?.name ?? "",
          previousRecipeId: curRecipeId,
        });
        return cleaned;
      });
    }
    performSwap(day, mealIndex);
  };

  const logPlannedMeal = (day: number, mealIndex: number) => {
    const dp = (generatedPlan ?? mealPlan)?.find((x) => x.day === day);
    const meal = dp?.meals[mealIndex];
    if (!meal || isMealPlanPlaceholderLikeTitle(meal.recipeTitle, { isPlaceholder: meal.isPlaceholder })) return;

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
        if (isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder })) continue;
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

  // Prototype port (2026-04-20, web parity with mobile commit 26a63bf):
  // uppercase "WEEK OF {Month Day}" overline + big "Meal plan" title +
  // round `sliders-horizontal` pill on the right (opens Templates
  // dialog, mirroring the mobile "Plan options" affordance). Shows the
  // first day of the active plan; when no plan is generated yet it
  // falls back to today so the overline isn't blank on the empty state.
  const weekOfLabel = useMemo(() => {
    const plan = generatedPlan;
    const first = new Date();
    if (plan && plan.length > 0 && typeof plan[0].day === "number") {
      first.setDate(first.getDate() + (plan[0].day - 1));
    }
    return `Week of ${first.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
  }, [generatedPlan]);

  // Prototype port (2026-04-20) — web parity for the mobile "This week"
  // summary card (`apps/mobile/app/(tabs)/planner.tsx` + `screens-mobile.jsx:464`).
  // Uses the shared `computePlanWeekSummaryScore` helper so both
  // platforms produce identical copy for the same plan/target input.
  const planSummaryScore = useMemo(
    () => computePlanWeekSummaryScore(generatedPlan ?? [], targetCalories),
    [generatedPlan, targetCalories],
  );
  // Day-name for the worst-short diagnostic. Matches mobile's
  // WEEKDAY_LONG indexing off the calendar date (plan[i].day − 1).
  const planSummaryWorstDayLabel = useMemo((): string | null => {
    if (!planSummaryScore?.worstShort || !generatedPlan) return null;
    const dp = generatedPlan[planSummaryScore.worstShort.dayIndex];
    if (!dp) return null;
    const d = new Date();
    d.setDate(d.getDate() + (dp.day - 1));
    return d.toLocaleDateString("en-US", { weekday: "long" });
  }, [planSummaryScore, generatedPlan]);

  return (
    <div className="max-w-4xl mx-auto px-pm-5 py-pm-5">
      {/* Header — prototype treatment (2026-04-20): overline + big
          title on the left, round "sliders-horizontal" pill on the
          right. Replaces the 4-button action row that used to live
          here; Regenerate + Shopping list now live in the "This week"
          summary card below, Templates lives behind the pill, and
          Save Plan was removed because plans save automatically (the
          prior button was informational-only and only produced a
          toast). Named-plan slots, swap modal, templates dialog,
          recipe picker, household sharing, and the shopping-list CTA
          card further down are all untouched. */}
      <div className="flex items-start justify-between mb-6 gap-pm-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {weekOfLabel}
          </p>
          <h1 className="text-[28px] font-bold text-foreground -tracking-[0.02em] mt-0.5">
            Meal plan
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setTemplatesOpen(true)}
          className="shrink-0 w-10 h-10 rounded-full border border-border bg-card text-foreground hover:bg-muted/60 transition-colors grid place-items-center"
          aria-label="Plan options"
        >
          <SlidersHorizontal className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </button>
      </div>

      <PlanTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        sourceMealCount={
          (generatedPlan ?? mealPlan ?? []).reduce(
            (n, d) =>
              n +
              d.meals.filter(
                (m) =>
                  !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }) &&
                  !(m as LeftoverAwareMeal).leftoverOf,
              ).length,
            0,
          )
        }
        maxDayCount={(generatedPlan ?? mealPlan ?? []).length || 1}
        templates={planTemplates}
        loading={templatesLoading}
        onSave={handleSaveTemplate}
        onApply={handleApplyTemplate}
        onDelete={handleDeleteTemplate}
      />

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
            onClick={() => setNewPlanOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition-pm"
          >
            <Icons.add className="w-4 h-4" />
            New
          </button>
          <button
            type="button"
            onClick={() => setRenamePlanOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted/80 transition-pm"
            aria-label="Rename plan"
          >
            <Icons.edit className="w-4 h-4" />
            Rename
          </button>
          <button
            type="button"
            disabled={mealPlanSlots.length <= 1}
            onClick={() => setDeletePlanOpen(true)}
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
          <div className="bg-card border border-border rounded-xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icons.trendUp className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Daily targets (optimizer)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Defaults come from your profile. The planner picks breakfast, lunch, snack, and dinner from your saved
              recipes—each recipe is matched to appropriate meal types when possible—then tunes totals within the bands
              below.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1.5 text-foreground font-medium">Calories</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetCalories}
                    onChange={(e) => setTargetCalories(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">kcal</span>
                </div>
              </div>
              <div>
                <label className="block mb-1.5 text-foreground font-medium">Protein</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetProtein}
                    onChange={(e) => setTargetProtein(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">g</span>
                </div>
              </div>
              <div>
                <label className="block mb-1.5 text-foreground font-medium">Carbs</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetCarbs}
                    onChange={(e) => setTargetCarbs(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">g</span>
                </div>
              </div>
              <div>
                <label className="block mb-1.5 text-foreground font-medium">Fat</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetFat}
                    onChange={(e) => setTargetFat(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">g</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-border/50">
              <div>
                <label className="block mb-1.5 text-foreground font-medium text-sm">
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
                <label className="block mb-1.5 text-foreground font-medium text-sm">
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
          <div className="bg-card border border-border rounded-xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icons.plan className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Plan Duration</h3>
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
                    "group relative px-5 py-4 border rounded-xl transition-colors",
                    planDays === days
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                  ].join(" ")}
                >
                  <div className="text-2xl font-bold mb-1">{days}</div>
                  <div className="text-sm opacity-80">{days === 1 ? "Day" : "Days"}</div>
                  <div
                    className={[
                      "absolute top-3 right-3 w-5 h-5 rounded-full border transition-all flex items-center justify-center",
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

          <div className="mt-6 p-4 rounded-xl border border-border bg-muted/30">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Save recipes that match breakfast, lunch, dinner, or snacks so each slot can pick a sensible fit. You can
              adjust targets and bands above before generating.
            </p>
          </div>
        </div>
      ) : generatedPlan ? (
        <div className="space-y-6">
          {/* Prototype port (2026-04-20) — "This week" summary card.
              Web parity for `apps/mobile/app/(tabs)/planner.tsx`'s
              summary card. Rendered only when there's a plan + a
              positive calorie target (see `planSummaryScore`). Hit
              band = ±10% of `targetCalories`. The duplicated "Meal
              plan" h2 + date-range line that used to sit here was
              removed — the `Week of …` overline + big title up in the
              header now carries that information once. */}
          {planSummaryScore ? (
            <div
              data-testid="plan-week-summary-card"
              className="rounded-2xl p-4 border"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in oklab, var(--primary) 12%, var(--card)) 0%, color-mix(in oklab, var(--macro-fat) 8%, var(--card)) 100%)",
                borderColor: "color-mix(in oklab, var(--primary) 22%, var(--border))",
              }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.1em] mb-1.5"
                style={{ color: "var(--primary-light, var(--primary))" }}
              >
                This week
              </p>
              <p className="text-[17px] font-bold text-foreground -tracking-[0.01em] mb-1">
                Hits your targets {planSummaryScore.hits} of {planSummaryScore.total}{" "}
                day{planSummaryScore.total === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-muted-foreground leading-[1.55] mb-3.5">
                {buildPlanWeekSummarySubtitle(planSummaryScore, planSummaryWorstDayLabel)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Regenerate the shopping list from the current plan
                    // (so the opened list reflects any in-session swaps)
                    // then navigate the user over. The inner await is a
                    // fire-and-forget; we still navigate even if the
                    // list regenerate fails because the list page has
                    // its own generate CTA as a fallback.
                    void generateShoppingListFromPlan();
                    onNavigate?.("shopping");
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all"
                >
                  <ShoppingCart className="w-3.5 h-3.5" strokeWidth={2} />
                  Shopping list
                </button>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card border border-border text-foreground text-[13px] font-semibold hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} strokeWidth={2} />
                  Regenerate
                </button>
              </div>
            </div>
          ) : null}

          {/* Plan summary — average daily macros vs targets across the
              whole plan. TestFlight build 7 `AH8csBqtZsBJJr0uHgXyEcE`
              (2026-04-18): tester wanted to see how close the plan as a
              whole sits to their macro targets without inspecting every
              day. Bands re-use the same calorie / carb-fat tolerances as
              the per-day cards. Pure rendering — no extra fetches. */}
          {generatedPlan.length > 0 && (() => {
            const totals = generatedPlan.reduce(
              (acc, d) => ({
                calories: acc.calories + (d.totals?.calories ?? 0),
                protein: acc.protein + (d.totals?.protein ?? 0),
                carbs: acc.carbs + (d.totals?.carbs ?? 0),
                fat: acc.fat + (d.totals?.fat ?? 0),
              }),
              { calories: 0, protein: 0, carbs: 0, fat: 0 },
            );
            const n = generatedPlan.length || 1;
            const avg = {
              calories: Math.round(totals.calories / n),
              protein: Math.round(totals.protein / n),
              carbs: Math.round(totals.carbs / n),
              fat: Math.round(totals.fat / n),
            };
            const pct = (val: number, target: number) =>
              target > 0 ? Math.abs((val - target) / target) * 100 : 0;
            const tone = (val: number, target: number, band: number): "ok" | "warn" | "off" => {
              if (target <= 0) return "ok";
              const dPct = pct(val, target);
              if (dPct <= band) return "ok";
              if (dPct <= band * 2) return "warn";
              return "off";
            };
            const toneClass = (t: "ok" | "warn" | "off") =>
              t === "ok" ? "text-success" : t === "warn" ? "text-warning" : "text-destructive";
            const rows: Array<{ label: string; avg: number; target: number; unit: string; band: number }> = [
              { label: "Calories", avg: avg.calories, target: targetCalories, unit: "kcal", band: calorieBandPct },
              { label: "Protein", avg: avg.protein, target: targetProtein, unit: "g", band: 15 },
              { label: "Carbs", avg: avg.carbs, target: targetCarbs, unit: "g", band: carbFatBandPct },
              { label: "Fat", avg: avg.fat, target: targetFat, unit: "g", band: carbFatBandPct },
            ];
            return (
              <div className="rounded-2xl bg-card border border-border p-4 mb-4">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan summary · daily average</p>
                  <p className="text-[11px] text-muted-foreground">Across {n} {n === 1 ? "day" : "days"}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {rows.map((row) => {
                    const t = tone(row.avg, row.target, row.band);
                    const delta = row.target > 0 ? row.avg - row.target : 0;
                    const deltaSign = delta >= 0 ? "+" : "";
                    return (
                      <div key={row.label} className="rounded-xl border border-border bg-background/60 px-3 py-2.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{row.label}</p>
                        <p className="text-sm font-semibold tabular-nums text-foreground mt-0.5">
                          {row.avg.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">/ {row.target.toLocaleString()} {row.unit}</span>
                        </p>
                        {row.target > 0 ? (
                          <p className={`text-[11px] font-semibold tabular-nums mt-0.5 ${toneClass(t)}`}>
                            {deltaSign}{delta.toLocaleString()} {row.unit} ({Math.round(pct(row.avg, row.target))}%)
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground mt-0.5">No target set</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

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
                      {(() => {
                        const titles = dp.meals
                          .filter(
                            (meal) =>
                              !isMealPlanPlaceholderLikeTitle(meal.recipeTitle, { isPlaceholder: meal.isPlaceholder }),
                          )
                          .map((meal) => meal.recipeTitle);
                        return titles.length > 0 ? (
                          titles.map((title, idx) => (
                            <div key={idx} className="truncate">
                              {title}
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-[10px] text-muted-foreground">Empty</div>
                        );
                      })()}
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

                    {/* Calorie label — prototype parity (2026-04-20):
                        thousands separator on the day total + explicit
                        "kcal" unit so glanceable totals read the same
                        as the mobile day strip. Target denominator is
                        kept tight for narrow cards. */}
                    <div className="text-[9px] text-muted-foreground text-center tabular-nums">
                      <span className="font-semibold text-foreground">
                        {Math.round(dp.totals.calories).toLocaleString()} kcal
                      </span>
                      <span className="mx-1">/</span>
                      {targetCalories.toLocaleString()}
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
                <div className="text-[13px] font-semibold text-muted-foreground mb-2">Today&apos;s plan</div>
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                  <div className="space-y-4">
                    {todayPlan.meals.length > 0 ? (
                      todayPlan.meals.map((meal, index) => {
                        // Prototype port (2026-04-20): empty / placeholder
                        // slots still render with the same visual weight
                        // as real meal rows — "Empty slot" title + em-dash
                        // macro line — instead of being filtered to
                        // nothing. This matches mobile
                        // (`apps/mobile/app/(tabs)/planner.tsx` ~L1640) and
                        // gives the user a clear "tap to fill" target
                        // where the slot sits.
                        const isEmpty = isMealPlanPlaceholderLikeTitle(
                          meal.recipeTitle,
                          { isPlaceholder: meal.isPlaceholder },
                        );
                        if (isEmpty) {
                          return (
                            <div key={index} className="flex items-start gap-3 opacity-70">
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                <Icons.recipe className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-[13px] font-semibold text-foreground">
                                  Empty slot
                                </h3>
                                <p className="text-[12px] text-muted-foreground mt-0.5 tabular-nums">
                                  — kcal &middot; P —g &middot; C —g &middot; F —g
                                </p>
                              </div>
                            </div>
                          );
                        }
                        const portion = effectivePortionMultiplier(meal.portionMultiplier);
                        const scaledCal = Math.round(scaledMacro(meal.calories, portion));
                        const scaledP = Math.round(scaledMacro(meal.protein, portion));
                        const scaledC = Math.round(scaledMacro(meal.carbs, portion));
                        const scaledF = Math.round(scaledMacro(meal.fat, portion));
                        return (
                          <div key={index} className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                              <Icons.recipe className="w-4 h-4 text-success" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-[13px] font-semibold text-foreground">
                                {meal.recipeTitle}
                              </h3>
                              {/* Prototype port (2026-04-20): macro
                                  line widened to match the empty-slot
                                  line so both render the same
                                  kcal · P · C · F pattern. */}
                              <p className="text-[12px] text-muted-foreground mt-0.5 tabular-nums">
                                {meal.name} &middot; {scaledCal.toLocaleString()} kcal &middot; P {scaledP}g &middot; C {scaledC}g &middot; F {scaledF}g
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
            onClick={() => onNavigate?.("shopping")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNavigate?.("shopping");
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Icons.shopping className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-[13px] font-semibold text-foreground">Shopping list</h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {(() => {
                    const n = generatedPlan
                      .flatMap((d) => d.meals)
                      .filter(
                        (m) => !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }),
                      ).length;
                    return n > 0
                      ? `${n} planned meal${n === 1 ? "" : "s"} · open list or generate ingredients`
                      : "Open your list or build it from this plan";
                  })()}
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

          {/* Compact day strip — mobile parity
              (`apps/mobile/app/(tabs)/planner.tsx` 815). One narrow
              card per day with weekday label, kcal progress bar, and
              total kcal. Multi-day plans only — single-day plans
              don't need a week overview. Click jumps to that day's
              detailed card below. */}
          {generatedPlan.length > 1 ? (
            <div className="grid gap-1.5 mb-4" style={{ gridTemplateColumns: `repeat(${generatedPlan.length}, minmax(0, 1fr))` }}>
              {generatedPlan.map((dp) => {
                const dayKcal = Math.round(dp.totals.calories);
                const pct = targetCalories > 0
                  ? Math.min((dayKcal / targetCalories) * 100, 100)
                  : 0;
                const tone =
                  targetCalories > 0 && dayKcal > targetCalories * 1.05
                    ? "var(--warning)"
                    : "var(--success)";
                return (
                  <a
                    key={`strip-${dp.day}`}
                    href={`#plan-day-${dp.day}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(`plan-day-${dp.day}`);
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="flex flex-col items-center gap-1 rounded-md border border-border bg-card px-2 py-2 hover:bg-muted/50 transition-colors text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Jump to day ${dp.day}: ${dayKcal} kcal`}
                  >
                    <span className="text-[11px] font-bold text-foreground">Day {dp.day}</span>
                    <span className="block w-full h-[3px] rounded-full bg-border overflow-hidden">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${pct}%`, background: tone }}
                      />
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {dayKcal.toLocaleString()}
                    </span>
                  </a>
                );
              })}
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
            // Build-12 H-5 (TestFlight `AH8csBqtZsBJJr0uHgXyEcE`,
            // 2026-04-19): "Plan doesn't tell me how close it is to my
            // macro targets." The shared helper builds an explicit
            // compact text line: "Day total · X / Y kcal · P / C / F"
            // with symmetric ±10% / ±20% tolerance bands. Sits above
            // the existing DailyRing + MacroCard grid so users can
            // scan without parsing the ring. `hasTargets=false` →
            // omit the whole line (new account, no goals set).
            const goalLine = buildDayTotalVsGoalLine(dp.meals, {
              calories: targetCalories,
              protein: targetProtein,
              carbs: targetCarbs,
              fat: targetFat,
            });
            const toneClassDayTotal = (tone: DayTotalTone): string =>
              tone === "neutral"
                ? "text-muted-foreground"
                : tone === "amber"
                  ? "text-warning"
                  : "text-destructive";
            return (
            <div key={dp.day} id={`plan-day-${dp.day}`}>
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
                {goalLine.hasTargets ? (
                  <p
                    className="text-[13px] tabular-nums mb-4 flex flex-wrap items-center gap-x-1"
                    data-testid={`day-total-vs-goal-${dp.day}`}
                    aria-label={`Day total ${Math.round(goalLine.totals.calories)} of ${targetCalories} kcal, protein ${Math.round(goalLine.totals.protein)} of ${targetProtein} grams, carbs ${Math.round(goalLine.totals.carbs)} of ${targetCarbs} grams, fat ${Math.round(goalLine.totals.fat)} of ${targetFat} grams`}
                  >
                    <span className="font-semibold text-foreground">Day total</span>
                    {goalLine.cells.map((cell) => (
                      <span key={cell.key} className={toneClassDayTotal(cell.tone)}>
                        {" · "}
                        {formatDayTotalCell(cell)}
                      </span>
                    ))}
                  </p>
                ) : null}
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
                {/* F-15 — residual protein gap hint. Only rendered when the
                    joint-fit scaler left the day more than 10g under the
                    protein target. Points at the lowest-protein slot so
                    the user can act: scale that slot up, or swap to a
                    higher-protein recipe via the existing stepper / Swap
                    button on the meal row below. */}
                {(() => {
                  const gap = dp.residualProteinGap;
                  if (gap == null || gap >= -10) return null;
                  const scorable = dp.meals.filter(
                    (m) => !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }),
                  );
                  if (scorable.length === 0) return null;
                  const lowest = scorable.reduce((low, m) => {
                    const pLow = scaledMacro(low.protein, effectivePortionMultiplier(low.portionMultiplier));
                    const pM = scaledMacro(m.protein, effectivePortionMultiplier(m.portionMultiplier));
                    return pM < pLow ? m : low;
                  }, scorable[0]!);
                  const under = Math.abs(gap);
                  return (
                    <p
                      className="mt-4 text-[13px] text-warning"
                      role="status"
                      data-testid="residual-protein-gap-hint"
                    >
                      Protein {under}g under target — try scaling {lowest.name} up or swap to a higher-protein recipe.
                    </p>
                  );
                })()}
              </div>

              <div className="space-y-5">
                {dp.meals.map((meal, index) => {
                  const slotKey = `${dp.day}-${index}`;
                  if (isMealPlanPlaceholderLikeTitle(meal.recipeTitle, { isPlaceholder: meal.isPlaceholder })) {
                    return null;
                  }
                  const portion = effectivePortionMultiplier(meal.portionMultiplier);
                  const recipeMeta =
                    savedRecipesForLibrary.find((r) => r.title === meal.recipeTitle);
                  const bestForLabel = recipeMeta?.mealSlots?.length
                    ? recipeMeta.mealSlots.join(", ")
                    : null;
                  const leftoverMeal = meal as unknown as LeftoverAwareMeal;
                  const isLeftover = Boolean(leftoverMeal.leftoverOf);
                  const isDragging =
                    dragSource?.day === dp.day && dragSource?.slotIndex === index;
                  return (
                    <div
                      key={slotKey}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        try {
                          e.dataTransfer.setData(
                            "application/x-suppr-meal",
                            JSON.stringify({ day: dp.day, slotIndex: index }),
                          );
                        } catch {
                          /* older browsers swallow setData; dragSource state still covers it */
                        }
                        setDragSource({ day: dp.day, slotIndex: index });
                      }}
                      onDragEnd={() => setDragSource(null)}
                      onDragOver={(e) => {
                        if (dragSource) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!dragSource) return;
                        handleMoveMeal(dragSource, { day: dp.day, slotIndex: index });
                        setDragSource(null);
                      }}
                      role="listitem"
                      aria-roledescription="Draggable planned meal"
                      aria-grabbed={isDragging}
                      tabIndex={0}
                      className={`group bg-card border ${
                        isDragging ? "border-primary/60 opacity-60" : "border-border"
                      } rounded-2xl p-6 hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 shadow-lg cursor-grab active:cursor-grabbing`}
                    >
                      {isLeftover ? (
                        <Badge
                          variant="leftover"
                          ariaLabel={`Leftover of ${meal.recipeTitle}`}
                          icon={<span aria-hidden>🍱</span>}
                          className="mb-3"
                        >
                          Leftover of {meal.recipeTitle}
                        </Badge>
                      ) : null}
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
                              onClick={() => bumpMealPortion(dp.day, index, -PORTION_MULTIPLIER_CLAMP.step)}
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
                              onClick={() => bumpMealPortion(dp.day, index, PORTION_MULTIPLIER_CLAMP.step)}
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
                          {/* Batch 3.10 — keyboard-accessible move fallback
                              for drag-drop. Audit M7 (2026-04-18): opens a
                              themed day/slot dialog instead of
                              `window.prompt`. */}
                          <button
                            type="button"
                            aria-label="Move meal to another slot or day"
                            onClick={() => {
                              setMovePrompt({ day: dp.day, slotIndex: index });
                              setMoveDay(String(dp.day));
                              setMoveSlot(String(index));
                            }}
                            className="px-4 py-2 bg-muted hover:bg-primary/10 text-foreground hover:text-primary rounded-xl transition-all font-medium border border-border hover:border-primary/30"
                          >
                            Move
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

      {/* Audit M7 (2026-04-18) — themed replacements for the prior
          `window.prompt` / `window.confirm` call sites on this page. */}
      <TextPromptDialog
        open={newPlanOpen}
        onOpenChange={setNewPlanOpen}
        title="New plan"
        description="Create a new named meal plan slot."
        inputLabel="Plan name"
        placeholder="e.g. Cut week"
        confirmLabel="Create"
        onConfirm={(name) => {
          createMealPlanSlot(name);
          toast.success("Created plan");
        }}
      />
      <TextPromptDialog
        open={renamePlanOpen}
        onOpenChange={setRenamePlanOpen}
        title="Rename plan"
        inputLabel="Plan name"
        placeholder="e.g. Cut week"
        currentValue={
          mealPlanSlots.find((s) => s.id === activeMealPlanSlotId)?.name ?? ""
        }
        confirmLabel="Save"
        onConfirm={(name) => {
          renameMealPlanSlot(activeMealPlanSlotId, name);
        }}
      />
      <DestructiveConfirmDialog
        open={deletePlanOpen}
        onOpenChange={setDeletePlanOpen}
        title="Delete this named plan?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          deleteMealPlanSlot(activeMealPlanSlotId);
          toast.message("Plan removed");
        }}
      />
      <DestructiveConfirmDialog
        open={applyTemplatePending != null}
        onOpenChange={(o) => {
          if (!o) setApplyTemplatePending(null);
        }}
        title={
          applyTemplatePending
            ? `Replace this week's plan with "${applyTemplatePending.name}"?`
            : "Replace this week's plan?"
        }
        description="The current week will be overwritten with the template."
        confirmLabel="Apply"
        onConfirm={async () => {
          if (applyTemplatePending) commitApplyTemplate(applyTemplatePending);
        }}
      />
      <DestructiveConfirmDialog
        open={swapLeftoverConfirm != null}
        onOpenChange={(o) => {
          if (!o) setSwapLeftoverConfirm(null);
        }}
        title={
          swapLeftoverConfirm
            ? `This will remove ${swapLeftoverConfirm.leftoverCount} leftover meal${
                swapLeftoverConfirm.leftoverCount === 1 ? "" : "s"
              }. Continue?`
            : "Continue?"
        }
        description="Downstream leftovers of this meal will be cleared."
        confirmLabel="Continue"
        onConfirm={async () => {
          if (swapLeftoverConfirm) {
            commitSwapWithLeftoverClear(
              swapLeftoverConfirm.day,
              swapLeftoverConfirm.mealIndex,
            );
          }
        }}
      />
      <Dialog
        open={movePrompt != null}
        onOpenChange={(o) => {
          if (!o) setMovePrompt(null);
        }}
      >
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Move meal</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {`Pick a day (1–${generatedPlan?.length ?? 1}) and a 0-based slot index.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-foreground">Day</span>
              <Input
                type="number"
                min={1}
                max={generatedPlan?.length ?? 1}
                value={moveDay}
                onChange={(e) => setMoveDay(e.target.value)}
                aria-label="Target day"
                inputMode="numeric"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-foreground">Slot index</span>
              <Input
                type="number"
                min={0}
                value={moveSlot}
                onChange={(e) => setMoveSlot(e.target.value)}
                aria-label="Target slot index"
                inputMode="numeric"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMovePrompt(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const d = Number(moveDay);
                const s = Number(moveSlot);
                if (!Number.isInteger(d) || !Number.isInteger(s)) {
                  toast.error("Invalid move target");
                  return;
                }
                if (movePrompt) {
                  handleMoveMeal(
                    { day: movePrompt.day, slotIndex: movePrompt.slotIndex },
                    { day: d, slotIndex: s },
                  );
                }
                setMovePrompt(null);
              }}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
