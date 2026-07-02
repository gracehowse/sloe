import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import { isMealPlanPlaceholderLikeTitle } from "../../lib/nutrition/portionMultiplier.ts";
import {
  planCalendarDateForIndex,
  shortWeekdayLabel,
} from "../../lib/planning/planDayLabel.ts";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { DestructiveConfirmDialog } from "./suppr/destructive-confirm-dialog";
import {
  recipeFitsMealSlot,
  type PlannerMealSlot,
} from "../../lib/planning/generateMealPlan.ts";
import { isFeatureEnabled, track } from "../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { useAuthSession } from "../../context/AuthSessionContext.tsx";
import { useHouseholdBanner } from "../../hooks/useHouseholdBanner.ts";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { moveMealInPlan, markLeftoversOnSwap } from "../../lib/nutrition/leftoversPlanner.ts";
import {
  applyTemplateToWeek,
  buildTemplateFromWeek,
  type PlanTemplate,
} from "../../lib/nutrition/planTemplates.ts";
import {
  createPlanTemplate,
  deletePlanTemplate,
  listPlanTemplates,
} from "../../lib/nutrition/planTemplatesClient.ts";
import { PlanMoveMealDialog } from "./suppr/plan-move-meal-dialog.tsx";
import { PlanPortionDialog, planMealDisplayMultiplier } from "./suppr/plan-portion-dialog.tsx";
import { PlanTemplatesDialog } from "./suppr/plan-templates-dialog.tsx";
import { PlanV3Connected } from "./plan/PlanV3Connected.tsx";
import { BatchCookSheet } from "./plan/BatchCookSheet.tsx";
import { ResetPlanSheet } from "./plan/ResetPlanSheet.tsx";
import { useMealPlanRegenerate } from "./plan/useMealPlanRegenerate.ts";
import { useMealSlotConfig } from "./plan/useMealSlotConfig.ts";
import {
  batchShoppingMultiplier,
  defaultBatchCookToolSubtitle,
  isBatchCookCandidate,
  recipeTotalTimeMin,
  type BatchCookRecipeCandidate,
} from "../../lib/planning/batchCook.ts";
import { filterShoppingItemsByPantry } from "../../lib/planning/pantryStaples.ts";
import { generateShoppingListFromRecipeEntriesAsync } from "../../lib/planning/generateShoppingList.ts";
import { buildPlanSwapEdit } from "../../lib/planning/planShoppingSyncHost.ts";
import { upsertShoppingListJsonItems } from "../../lib/supabase/shoppingJsonFallback.ts";
import { AdjustConstraintsSheet } from "./plan/AdjustConstraintsSheet.tsx";
import {
  type PlanSourceMode,
  DEFAULT_PLAN_SOURCE_MODE,
} from "../../lib/planning/planSource.ts";
import {
  DEFAULT_PLAN_ADJUST_CONSTRAINTS,
  enabledSlotsForMealsPerDay,
  mealsPerDayFromEnabledSlots,
  type PlanAdjustConstraints,
} from "../../lib/planning/planAdjustConstraints.ts";
import {
  DEFAULT_PLANNER_BANDS,
  refitDayMealsToTargets,
  scaleMacros,
} from "../../lib/nutrition/mealPlanAlgo.ts";
import { baseMacrosFromRecipe } from "../../lib/nutrition/coerceRecipeMacrosForPlanning.ts";
import type { DayPlan } from "../../types/recipe.ts";

interface MealPlannerProps {
  userTier: "free" | "base" | "pro";
  onUpgrade?: () => void;
  onNavigate?: (view: "discover" | "library" | "shopping" | "plan-import") => void;
  /** Opens recipe detail. */
  onOpenRecipe?: (recipeId: string) => void;
  /** Opens recipe detail in cook mode directly. */
  onCookRecipe?: (recipeId: string, portionMultiplier?: number) => void;
}

/** F2-A (audit 2026-04-28) — slot iteration includes Snacks on web,
 *  matching the mobile canonical set (`apps/mobile/app/(tabs)/planner.tsx`
 *  `ALL_MEAL_SLOTS`). The web grid renders all four slots when the
 *  generated plan carries them. */
type SlotKey = "breakfast" | "lunch" | "dinner" | "snacks";
const SLOTS: readonly SlotKey[] = ["breakfast", "lunch", "dinner", "snacks"] as const;

/** F2-I (2026-04-28) — capitalised slot names for newly-inserted
 *  empty-slot meals (parity with mobile `ALL_MEAL_SLOTS`). The grid's
 *  bySlot lookup lowercases on read, so either case is safe to write
 *  — capitalised is the convention. */
const SLOT_TITLE: Record<SlotKey, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

// ENG-1278 — `slot` widened to string so a numbered-preset slot label
// ("Meal N") can drive a swap; classic slots still resolve their slot-fit pool.
type SwapTarget = { day: number; slot: string; mealIndex: number };

/**
 * Web Meal Planner — the Sloe v3 Plan HOST (ENG-1225 → ENG-1303).
 *
 * Since ENG-1303 the v3 surface ships UNGATED: this file is the data/handler
 * host only — the pixels live in `./plan/` (`PlanV3Connected` picks the
 * phone-width `PlanV3Surface` below `lg` and the desktop two-column
 * `PlanV3WebDashboard`, the prototype `WebPlan`, at `lg+`). Canonical design:
 * `docs/ux/redesign/v3/Sloe-App.html` `WebPlan` (~L7581-7708), per ENG-1247.
 *
 * The host retains and wires:
 *  - `mealPlan` / `setMealPlan` — live plan; persists on swap/move/portion/lock
 *  - `useMealPlanRegenerate` — Generate week + keep-vs-clear reset sheet
 *  - the swap picker Dialog, AdjustConstraintsSheet, PlanTemplatesDialog,
 *    PlanMoveMealDialog, PlanPortionDialog, BatchCookSheet, ResetPlanSheet
 *  - the ENG-1238 per-meal action sheet deps (`usePlanV3MealActions`)
 *  - shopping-list generation + the ENG-957 swap→list re-sync
 *
 * `onUpgrade` fell out of use with the legacy day-count picker (free-tier
 * day gating is enforced inside `useMealPlanRegenerate`).
 */
export const MealPlanner = memo(function MealPlanner({
  userTier,
  onUpgrade: _onUpgrade,
  onNavigate,
  onOpenRecipe,
  onCookRecipe: _onCookRecipe,
}: MealPlannerProps) {
  const {
    mealPlan,
    setMealPlan,
    generateMealPlan,
    generateShoppingListFromPlan,
    syncShoppingListForPlanEdit,
    savedRecipesForLibrary,
    discoverRecipes,
    nutritionTargets,
    addLoggedMeal,
    setShoppingItems,
    pantryStaples,
    nutritionByDay,
  } = useAppData();

  const [isGenerating, setIsGenerating] = useState(false);
  // ENG-790 (2026-05-31) — "Plan from" source selector. When the flag is
  // on, the user chooses whether a generated plan draws from their saved
  // library, library + Suppr's discover pool (default), or discovery only;
  // the choice threads into `generateMealPlan({ source })`. Off → the legacy
  // saved-only path with the hard 0-saved gate. Mobile twin:
  // `apps/mobile/app/(tabs)/planner.tsx`.
  const planSourceSelector = isFeatureEnabled("plan_source_selector");
  // ENG-1225 → ENG-1303 — the v3 Plan surface (header verdict + week strip +
  // day detail + meal filter/cards + shopping tool) is UNGATED on web: the
  // `sloe_v3_plan` read was removed with the legacy body (see the render-site
  // note). Mobile still carries the flag in its REDESIGN_DEFAULT_ON set.
  // ENG-1131 — web Plan parity: move-meal, templates, portion stepper (mobile
  // already ships these; web catches up behind one flag). Default-on; off → swap-
  // only slot affordance and no templates entry point.
  const planWebParity = isFeatureEnabled("plan_web_parity_v1");
  // ENG-956 — per-meal lock ("keep this meal", Refresh the rest). Default-OFF.
  // On → each meal row gets a quiet Lock glyph + a "Keep this meal" action, and
  // Regenerate keeps locked meals while re-rolling only the unlocked ones
  // (label becomes "Refresh the rest" when ≥1 meal is locked). Off → the legacy
  // all-or-nothing Regenerate; no lock affordance.
  const mealLockEnabled = isFeatureEnabled("plan_meal_lock_v1");
  const { authedUserId } = useAuthSession();
  const householdBanner = useHouseholdBanner(authedUserId); // ENG-1247 — v3 Plan "Cooking for N" banner
  const [planSource, setPlanSource] = useState<PlanSourceMode>(
    DEFAULT_PLAN_SOURCE_MODE,
  );
  const [swapFor, setSwapFor] = useState<SwapTarget | null>(null);
  // ENG-1303 — the legacy 1/3/7 day-count picker left with the pre-v3 body;
  // v3 plans a full week (the v3-flag-ON behaviour since ENG-1225). Free-tier
  // day gating stays enforced inside `useMealPlanRegenerate` (isFree → 1 day).
  const planDays = 7;
  const isFree = userTier === "free";
  // ENG-1303 — the legacy start-date picker left with the pre-v3 body; the
  // plan anchors on Today (offset 0), the v3-flag-ON behaviour since ENG-1225.
  const startOffset = 0;
  // F2-H (audit 2026-04-28) — which canonical slots to include in
  // the next regenerate. Mobile parity at
  // `apps/mobile/app/(tabs)/planner.tsx:1775-1793`. Defaults to all
  // four; toggling Snacks off (the most common case) regenerates
  // without snack rows.
  const [enabledSlots, setEnabledSlots] = useState<Set<SlotKey>>(
    () => new Set<SlotKey>(SLOTS),
  );
  // ENG-1177 — numbered meal-slot presets (4–6 "Meal N") drive plan generation
  // directly; classic returns null and keeps the `enabledSlots` toggle. See hook.
  const { numberedPresetSlots } = useMealSlotConfig(authedUserId);
  const [allowBatchLeftovers, setAllowBatchLeftovers] = useState(true);
  const [planCalorieFloor, setPlanCalorieFloor] = useState(
    DEFAULT_PLAN_ADJUST_CONSTRAINTS.calorieFloor,
  );
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [batchCookOpen, setBatchCookOpen] = useState(false);
  const [batchCookSaving, setBatchCookSaving] = useState(false);
  const [moveFrom, setMoveFrom] = useState<{ day: number; slotIndex: number } | null>(
    null,
  );
  const [portionTarget, setPortionTarget] = useState<{
    day: number;
    mealIndex: number;
  } | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [applyTemplateTarget, setApplyTemplateTarget] = useState<PlanTemplate | null>(
    null,
  );

  const targetCalories = nutritionTargets.calories;

  // ENG-790 — discover-pool size for the "Plan from" count badge, de-duped
  // against the saved library so the combined total can't double-count a
  // recipe that's both saved and discoverable (mirrors `selectPlanPool`).
  const discoverCount = useMemo(() => {
    const savedIds = new Set(savedRecipesForLibrary.map((r) => r.id));
    return discoverRecipes.filter((r) => !savedIds.has(r.id)).length;
  }, [discoverRecipes, savedRecipesForLibrary]);

  // e2e walk 2026-06-10 (mirror of mobile planner): a freshly-created plan
  // is all placeholder slots — don't score the empty week or advise on
  // meals that don't exist; invite the user to Generate instead.
  const planHasRealMeals = useMemo(
    () => (mealPlan ?? []).some((dp) => dp.meals.some((m) => !m.isPlaceholder && !!m.recipeTitle)),
    [mealPlan],
  );
  const lockedMealCount = useMemo(
    () =>
      mealLockEnabled
        ? (mealPlan ?? []).reduce(
            (a, dp) => a + dp.meals.filter((m) => m.isLocked).length,
            0,
          )
        : 0,
    [mealLockEnabled, mealPlan],
  );
  const {
    resetPlan,
    requestRegenerate,
    handleResetPlanConfirm,
  } = useMealPlanRegenerate({
    isFree,
    planDays,
    enabledSlots,
    slots: SLOTS,
    slotTitle: (key) => SLOT_TITLE[key as SlotKey],
    slotsOverride: numberedPresetSlots,
    mealLockEnabled,
    lockedMealCount,
    planSourceSelector,
    planSource,
    allowBatchLeftovers,
    planHasRealMeals,
    generateMealPlan,
    generateShoppingListFromPlan,
    setIsGenerating,
  });
  /** F2-M (2026-04-28) — log a planned meal to today's tracker.
   *  Mirrors the mobile flow at
   *  `apps/mobile/app/(tabs)/planner.tsx:2406-2447`. The macros on
   *  the planner row are already post-portion (per the F30 fix), so
   *  we pass `portionMultiplier: undefined` to avoid double-applying
   *  the scale — `LoggedMeal.portionMultiplier` is display-only and
   *  must reflect already-scaled macros. */
  const handleLogToday = (meal: DayPlan["meals"][number]) => {
    if (isMealPlanPlaceholderLikeTitle(meal.recipeTitle, { isPlaceholder: meal.isPlaceholder })) {
      return;
    }
    const slotName = String(meal.name ?? "").trim() || "Meal";
    const cal = Math.max(0, Math.round(Number(meal.calories) || 0));
    const protein = Math.max(0, Math.round(Number(meal.protein) || 0));
    const carbs = Math.max(0, Math.round(Number(meal.carbs) || 0));
    const fat = Math.max(0, Math.round(Number(meal.fat) || 0));
    // Tracking-extras autoupdate (2026-05-01) — forward caffeine /
    // alcohol micros if the planner row carries them so the F-13 daily
    // bump fires inside `addLoggedMeal`. Mirrors the mobile planner
    // tap-to-log wiring at `apps/mobile/app/(tabs)/index.tsx`. The
    // planner row carries `micros` only when the underlying recipe was
    // verified with ingredient-level caffeine / alcohol; fallback is
    // no-op.
    const plannerMicros = (meal as { micros?: Record<string, number> | null }).micros;
    const micros: Record<string, number> = {};
    const caff = plannerMicros && typeof plannerMicros === "object" ? Number(plannerMicros.caffeineMg ?? 0) : 0;
    const alc = plannerMicros && typeof plannerMicros === "object" ? Number(plannerMicros.alcoholG ?? 0) : 0;
    if (Number.isFinite(caff) && caff > 0) micros.caffeineMg = caff;
    if (Number.isFinite(alc) && alc > 0) micros.alcoholG = alc;
    addLoggedMeal({
      name: slotName,
      recipeTitle: meal.recipeTitle,
      time: slotName,
      calories: cal,
      protein,
      carbs,
      fat,
      ...(typeof (meal as { fiberG?: number }).fiberG === "number"
        ? { fiberG: (meal as { fiberG?: number }).fiberG }
        : {}),
      ...(Object.keys(micros).length > 0 ? { micros } : {}),
    });
    toast.success(`Logged ${slotName} to today`);
  };

  const handleShoppingList = () => {
    void generateShoppingListFromPlan();
    onNavigate?.("shopping");
  };

  useEffect(() => {
    if (!planWebParity || !templatesOpen || !authedUserId) return;
    let cancelled = false;
    setTemplatesLoading(true);
    void listPlanTemplates(supabase, authedUserId).then(({ templates, error }) => {
      if (cancelled) return;
      if (error) {
        toast.error("Could not load templates", { description: error });
      } else {
        setPlanTemplates(templates);
      }
      setTemplatesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [planWebParity, templatesOpen, authedUserId]);

  const handleMoveMeal = useCallback(
    (from: { day: number; slotIndex: number }, to: { day: number; slotIndex: number }) => {
      if (from.day === to.day && from.slotIndex === to.slotIndex) return;
      setMealPlan((prev) => {
        if (!prev) return prev;
        const fromDp = prev.find((d) => d.day === from.day);
        const toDp = prev.find((d) => d.day === to.day);
        const fromSlot = fromDp?.meals[from.slotIndex]?.name ?? "";
        const toSlot = toDp?.meals[to.slotIndex]?.name ?? "";
        const next = moveMealInPlan(prev, from, to);
        track(AnalyticsEvents.meal_moved_in_plan, {
          fromSlot,
          toSlot,
          crossDay: from.day !== to.day,
        });
        return next;
      });
      toast.success("Meal moved");
    },
    [setMealPlan],
  );

  // ENG-956 — toggle the per-meal lock ("keep this meal"). Pure local plan
  // mutation; persists through the same slot-plan store as swap/move/portion.
  const toggleMealLock = useCallback(
    (day: number, mealIndex: number, slotName: string) => {
      let nextLocked = false;
      let lockedCount = 0;
      setMealPlan((prev) => {
        if (!prev) return prev;
        const next = prev.map((dp) => {
          if (dp.day !== day) return dp;
          return {
            ...dp,
            meals: dp.meals.map((m, mi) =>
              mi === mealIndex ? { ...m, isLocked: !m.isLocked } : m,
            ),
          };
        });
        const target = next
          .find((dp) => dp.day === day)
          ?.meals[mealIndex];
        nextLocked = Boolean(target?.isLocked);
        lockedCount = next.reduce(
          (a, dp) => a + dp.meals.filter((m) => m.isLocked).length,
          0,
        );
        return next;
      });
      track(AnalyticsEvents.plan_meal_lock_toggled, {
        locked: nextLocked,
        slot: slotName,
        lockedCount,
        platform: "web",
      });
    },
    [setMealPlan],
  );

  const handlePortionSelect = useCallback(
    (multiplier: number) => {
      if (!portionTarget) return;
      const recipePool = [...discoverRecipes, ...savedRecipesForLibrary].map((r) => ({
        id: r.id,
        title: r.title,
        calories: r.calories,
      }));
      setMealPlan((prev) => {
        if (!prev) return prev;
        return prev.map((dp) => {
          if (dp.day !== portionTarget.day) return dp;
          const newMeals = dp.meals.map((m, mi) => {
            if (mi !== portionTarget.mealIndex) return m;
            const cur = planMealDisplayMultiplier(m, recipePool);
            const baseCals = m.calories / cur;
            const basePro = m.protein / cur;
            const baseCarbs = m.carbs / cur;
            const baseFat = m.fat / cur;
            const baseFiber = ((m as { fiberG?: number }).fiberG ?? 0) / cur;
            return {
              ...m,
              portionMultiplier: multiplier,
              calories: Math.round(baseCals * multiplier),
              protein: Math.round(basePro * multiplier),
              carbs: Math.round(baseCarbs * multiplier),
              fat: Math.round(baseFat * multiplier),
              fiberG: Math.round(baseFiber * multiplier * 10) / 10,
            };
          });
          const totals = newMeals.reduce(
            (acc, m) => ({
              calories: acc.calories + (Number(m.calories) || 0),
              protein: acc.protein + (Number(m.protein) || 0),
              carbs: acc.carbs + (Number(m.carbs) || 0),
              fat: acc.fat + (Number(m.fat) || 0),
              fiberG:
                acc.fiberG + (Number((m as { fiberG?: number }).fiberG) || 0),
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0 },
          );
          return { ...dp, meals: newMeals, totals };
        });
      });
      toast.success("Portion updated");
    },
    [portionTarget, discoverRecipes, savedRecipesForLibrary, setMealPlan],
  );

  const templateSourceMealCount = useMemo(() => {
    if (!planWebParity) return 0;
    return (mealPlan ?? []).reduce(
      (n, d) =>
        n +
        d.meals.filter(
          (m) =>
            !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }) &&
            !(m as { leftoverOf?: string }).leftoverOf,
        ).length,
      0,
    );
  }, [planWebParity, mealPlan]);

  const moveDayLabels = useMemo(
    () =>
      (mealPlan ?? []).map((_, idx) =>
        shortWeekdayLabel(planCalendarDateForIndex(idx, startOffset)),
      ),
    [mealPlan, startOffset],
  );

  const portionRecipePool = useMemo(
    () =>
      [...discoverRecipes, ...savedRecipesForLibrary].map((r) => ({
        id: r.id,
        title: r.title,
        calories: r.calories,
      })),
    [discoverRecipes, savedRecipesForLibrary],
  );

  const openSwap = (day: number, slot: SwapTarget["slot"], mealIndex: number) => {
    setSwapFor({ day, slot, mealIndex });
  };

  const pickSwap = (recipeId: string) => {
    if (!swapFor) return;
    const pool = [...discoverRecipes, ...savedRecipesForLibrary];
    const next = pool.find((r) => r.id === recipeId);
    if (!next) {
      setSwapFor(null);
      return;
    }
    // ENG-957 — outgoing meal captured BEFORE the swap for the shopping re-sync.
    const outgoing = mealPlan?.find((d) => d.day === swapFor.day)?.meals[swapFor.mealIndex];
    const plannerTargets = {
      calories: nutritionTargets.calories,
      protein: nutritionTargets.protein,
      carbs: nutritionTargets.carbs,
      fat: nutritionTargets.fat,
      fiber: nutritionTargets.fiber ?? 28,
      ...DEFAULT_PLANNER_BANDS,
    };
    setMealPlan((prev) => {
      if (!prev) return prev;
      const prevRid = (
        prev.find((d) => d.day === swapFor.day)?.meals[swapFor.mealIndex] as { recipeId?: string } | undefined
      )?.recipeId;
      const swapped = prev.map((dp) => {
        if (dp.day !== swapFor.day) return dp;
        const baseRecipes = dp.meals.map((m, mi) => {
          if (mi === swapFor.mealIndex) return baseMacrosFromRecipe(next);
          const ref = pool.find((r) => r.id === m.recipeId);
          if (ref) return baseMacrosFromRecipe(ref);
          return {
            calories: m.calories,
            protein: m.protein,
            carbs: m.carbs,
            fat: m.fat,
            fiberG: (m as { fiberG?: number }).fiberG ?? 0,
          };
        });
        const fit = refitDayMealsToTargets({ recipes: baseRecipes, targets: plannerTargets });
        const newMeals = dp.meals.map((m, mi) => {
          const scaled = scaleMacros(baseRecipes[mi]!, fit.multipliers[mi] ?? 1);
          return {
            ...m,
            ...(mi === swapFor.mealIndex
              ? {
                  recipeTitle: next.title,
                  recipeId: next.id,
                }
              : {}),
            calories: scaled.calories,
            protein: scaled.protein,
            carbs: scaled.carbs,
            fat: scaled.fat,
            // ENG-1150 — write the scaled new-recipe fibre onto the row (parity
            // with the mobile swap handler) so the row and the day total carry
            // the swapped meal's fibre, not the previous recipe's stale value.
            fiberG: scaled.fiberG ?? (m as { fiberG?: number }).fiberG,
            portionMultiplier: undefined,
          };
        });
        const totals = newMeals.reduce(
          (acc, m) => {
            acc.calories += Math.max(0, Math.round(Number(m.calories) || 0));
            acc.protein += Math.max(0, Math.round(Number(m.protein) || 0));
            acc.carbs += Math.max(0, Math.round(Number(m.carbs) || 0));
            acc.fat += Math.max(0, Math.round(Number(m.fat) || 0));
            // ENG-1150 — carry fiber through a swap so the day-total fiber
            // cell doesn't drop to 0 after swapping a meal.
            acc.fiberG += Math.max(
              0,
              Math.round((Number((m as { fiberG?: number }).fiberG) || 0) * 10) / 10,
            );
            return acc;
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0 },
        );
        return {
          ...dp,
          meals: newMeals,
          totals,
          ...(fit.residualProteinGap < 0 ? { residualProteinGap: fit.residualProteinGap } : {}),
        };
      });
      // ENG-958 — clear the swapped-out recipe's downstream leftovers so they
      // don't orphan (wrong shopping list + day totals). Web↔mobile parity: the
      // mobile planner already runs markLeftoversOnSwap on swap.
      const di = swapped.findIndex((d) => d.day === swapFor.day);
      return markLeftoversOnSwap(swapped, {
        dayIndex: di,
        slot: swapFor.slot,
        previousRecipeId: prevRid,
      }).plan;
    });
    toast.success("Swapped meal");
    // ENG-957 — re-sync the list to the swap (flag-gated, fire-and-forget).
    const swapEdit = buildPlanSwapEdit(
      { ...outgoing, servings: pool.find((r) => r.id === outgoing?.recipeId)?.servings },
      { id: next.id, title: next.title, servings: next.servings },
    );
    if (swapEdit) void syncShoppingListForPlanEdit(swapEdit);
    setSwapFor(null);
  };

  // Build the swap-picker pool — filter to recipes that fit the target
  // slot when possible, falling back to the full pool if nothing
  // matches (parity with the prior swap flow).
  // F2-A (2026-04-28): the lookup-key is capitalised ("Breakfast")
  // because `PlannerMealSlot` is the capitalised enum from
  // `src/types/recipe.ts`. The pre-fix cast was incorrectly using
  // the lowercase web key directly, which made the slot filter a
  // no-op (no recipe ever matched), and the pool always fell
  // through to the un-filtered everything-list branch.
  const swapPool = useMemo(() => {
    if (!swapFor) return [];
    const pool = [...discoverRecipes, ...savedRecipesForLibrary];
    const slotMap: Record<SlotKey, PlannerMealSlot> = {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
      snacks: "Snacks",
    };
    // ENG-1278 — numbered slots ("Meal N") have no classic slot-fit → full pool.
    const slot = slotMap[swapFor.slot.toLowerCase() as SlotKey];
    if (!slot) return pool;
    const fits = pool.filter((r) => recipeFitsMealSlot(r, slot));
    return fits.length > 0 ? fits : pool;
  }, [swapFor, discoverRecipes, savedRecipesForLibrary]);

  const batchCookCandidates = useMemo<BatchCookRecipeCandidate[]>(() => {
    return savedRecipesForLibrary
      .filter((r) =>
        isBatchCookCandidate({
          prepTimeMin: r.prepTimeMin ?? null,
          cookTimeMin: r.cookTimeMin ?? null,
        }),
      )
      .slice(0, 12)
      .map((r) => ({
        id: r.id,
        title: r.title,
        calories: r.calories ?? 0,
        protein: r.protein ?? 0,
        timeMin: recipeTotalTimeMin(r.prepTimeMin, r.cookTimeMin),
        servings: r.servings ?? 1,
        imageUrl: r.image ?? null,
      }));
  }, [savedRecipesForLibrary]);

  const scaleBatchCookToShopping = useCallback(
    async (recipe: BatchCookRecipeCandidate, portions: number) => {
      if (!authedUserId) {
        toast.error("Sign in to update your shopping list.");
        return false;
      }
      const { data: ingredients, error } = await supabase
        .from("recipe_ingredients")
        .select("name, amount, unit, recipe_id")
        .eq("recipe_id", recipe.id);
      if (error || !ingredients?.length) {
        toast.error("This recipe has no ingredient lines to scale yet.");
        return false;
      }
      const multiplier = batchShoppingMultiplier(portions, recipe.servings);
      const titleToId = (title: string) => (title === recipe.title ? recipe.id : null);
      const ingredientsByRecipeId = new Map<
        string,
        Array<{ name: string; amount: string; unit: string }>
      >([
        [
          recipe.id,
          ingredients.map((ing) => ({
            name: String(ing.name ?? ""),
            amount: ing.amount != null ? String(ing.amount) : "",
            unit: String(ing.unit ?? ""),
          })),
        ],
      ]);
      const generated = await generateShoppingListFromRecipeEntriesAsync({
        entries: [{ title: recipe.title, multiplier }],
        recipeTitleToId: titleToId,
        fetchDbIngredients: async (recipeId) => ingredientsByRecipeId.get(recipeId) ?? [],
        fetchDbIngredientsBatch: async () => ingredientsByRecipeId,
      });
      const filtered = filterShoppingItemsByPantry(generated, pantryStaples);
      setShoppingItems(filtered);
      const items = filtered.map((it) => ({
        name: it.name,
        amount: it.amount,
        unit: it.unit,
        category: it.category,
        checked: false,
      }));
      const { error: upErr } = await upsertShoppingListJsonItems(supabase, authedUserId, items);
      if (upErr) {
        toast.error(upErr.message);
        return false;
      }
      return true;
    },
    [authedUserId, pantryStaples, setShoppingItems],
  );

  const plan = mealPlan ?? [];
  const adjustInitial = useMemo<PlanAdjustConstraints>(
    () => ({
      source: planSource,
      calorieFloor: planCalorieFloor,
      mealsPerDay: mealsPerDayFromEnabledSlots(enabledSlots),
      allowBatchLeftovers,
    }),
    [planSource, planCalorieFloor, enabledSlots, allowBatchLeftovers],
  );

  const handleAdjustSave = useCallback(
    async (next: PlanAdjustConstraints) => {
      setPlanSource(next.source);
      setEnabledSlots(
        enabledSlotsForMealsPerDay(next.mealsPerDay) as Set<SlotKey>,
      );
      setAllowBatchLeftovers(next.allowBatchLeftovers);
      setPlanCalorieFloor(next.calorieFloor);
      setAdjustOpen(false);
      setIsGenerating(true);
      try {
        const days = isFree ? 1 : planDays;
        const slotsList: string[] = SLOTS.filter((s) =>
          enabledSlotsForMealsPerDay(next.mealsPerDay).has(s),
        ).map((s) => SLOT_TITLE[s]);
        // ENG-1177 — numbered preset overrides; else classic per-slot toggle.
        const slotsOverride =
          numberedPresetSlots ??
          (slotsList.length > 0 && slotsList.length < SLOTS.length ? slotsList : null);
        await generateMealPlan({
          days,
          ...(slotsOverride ? { slots: slotsOverride } : {}),
          ...(planSourceSelector ? { source: next.source } : {}),
          allowLeftovers: next.allowBatchLeftovers,
          calorieFloorMin: next.calorieFloor,
        });
        await generateShoppingListFromPlan();
        toast.success("Constraints saved — plan regenerated");
      } catch {
        toast.error("Could not regenerate plan. Save more recipes and try again.");
      } finally {
        setIsGenerating(false);
      }
    },
    [
      generateMealPlan,
      generateShoppingListFromPlan,
      isFree,
      planDays,
      planSourceSelector,
      numberedPresetSlots,
    ],
  );

  return (
    <div className="product-shell py-pm-6 space-y-5">
      {/* ENG-1303 (2026-07-02) — the v3 Plan ships UNGATED on web. The
          `sloe_v3_plan` gate + the legacy pre-v3 body (serif "Meal plan" H1,
          week-summary card, config chip rows, 7-col day grid, bottom CTA row)
          were deleted: v3 is ratified as canonical under ENG-1247 (the
          prototype `docs/ux/redesign/v3/Sloe-App.html` `WebPlan` supersedes
          them), and the 2026-07-01 sweep confirmed the flag-off path was the
          only thing users saw. The swap/adjust/templates/batch/reset dialogs
          below stay live — they back the v3 taps. */}
        <PlanV3Connected
          plan={plan}
          targetCalories={targetCalories}
          startOffset={startOffset}
          household={householdBanner}
          onGenerate={requestRegenerate}
          onAdjust={() => setAdjustOpen(true)}
          onTemplates={() => setTemplatesOpen(true)}
          onOpenHousehold={() => {
            window.location.assign("/home?view=household-settings");
          }}
          onOpenShopping={handleShoppingList}
          onOpenBatchCook={() => setBatchCookOpen(true)}
          batchCookSubtitle={defaultBatchCookToolSubtitle()}
          nutritionByDay={nutritionByDay}
          onSwapSlot={(day, slotIndex) => openSwap(day, SLOTS[slotIndex] ?? "snacks", slotIndex)}
          mealActionDeps={{ slots: SLOTS, mealLockEnabled, onOpenRecipe, openSwap, handleLogToday, setPortionTarget, setMoveFrom, setMealPlan, toggleMealLock }}
        />

      {/* Modal-dismissibility audit (2026-04-30) — Radix Dialog so the swap
          picker dismisses via Escape, the Radix close X, AND backdrop click
          (incl. iOS Safari touch). DialogContent ships its own X (no double-X). */}
      <Dialog
        open={swapFor !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSwapFor(null);
        }}
      >
        <DialogContent className="max-w-[440px] w-[calc(100vw-2rem)] p-5 gap-0 max-h-[80vh] overflow-y-auto bg-card">
          <div style={{ marginBottom: 14 }}>
            <p
              className="text-muted-foreground uppercase"
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.1em",
              }}
            >
              Swap
            </p>
            <DialogTitle
              className="font-[family-name:var(--font-headline)] font-medium text-foreground-brand capitalize"
              style={{ margin: "4px 0 0", fontSize: 18 }}
            >
              {swapFor
                ? `${shortWeekdayLabel(
                    planCalendarDateForIndex(
                      Math.max(
                        0,
                        plan.findIndex((d) => d.day === swapFor.day),
                      ),
                    ),
                  )} · ${swapFor.slot}`
                : "Swap meal"}
            </DialogTitle>
          </div>
          <div className="flex flex-col" style={{ gap: 6 }}>
            {swapPool.length === 0 ? (
              <p className="text-muted-foreground" style={{ fontSize: 13 }}>
                No recipes available to swap in.
              </p>
            ) : (
              swapPool.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => pickSwap(r.id)}
                  className="grid bg-muted text-foreground text-left"
                  style={{
                    gridTemplateColumns: "1fr auto",
                    gap: 10,
                    padding: "12px 14px",
                    border: 0,
                    borderRadius: 10,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</p>
                    <p
                      className="text-muted-foreground"
                      style={{ fontSize: 11, marginTop: 2 }}
                    >
                      {`${r.servings ?? 1} serving${(r.servings ?? 1) === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <div
                    className="tabular-nums text-right"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 700 }}>
                      {Math.round(r.calories)}
                    </p>
                    <p
                      className="text-muted-foreground"
                      style={{ fontSize: 10 }}
                    >
                      {Math.round(r.protein)} P · {Math.round(r.carbs)} C
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ENG-1303 — the named-plans rename/new/delete dialogs left with the
          legacy F2-G slot switcher (their only openers). AppDataContext keeps
          the multi-plan API for other surfaces. */}

      {planWebParity ? (
        <>
          <PlanMoveMealDialog
            open={moveFrom !== null}
            onOpenChange={(open) => {
              if (!open) setMoveFrom(null);
            }}
            plan={plan}
            from={moveFrom}
            dayLabels={moveDayLabels}
            onMove={(to) => {
              if (!moveFrom) return;
              handleMoveMeal(moveFrom, to);
              setMoveFrom(null);
            }}
          />
          <PlanPortionDialog
            open={portionTarget !== null}
            onOpenChange={(open) => {
              if (!open) setPortionTarget(null);
            }}
            plan={plan}
            target={portionTarget}
            recipePool={portionRecipePool}
            onSelect={handlePortionSelect}
          />
          <PlanTemplatesDialog
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            sourceMealCount={templateSourceMealCount}
            maxDayCount={plan.length || 1}
            templates={planTemplates}
            loading={templatesLoading}
            onSave={async (name, dayCount) => {
              if (!authedUserId) {
                return { ok: false, error: "Sign in to save templates." };
              }
              const draft = buildTemplateFromWeek(mealPlan, name, dayCount);
              if (!draft) {
                return { ok: false, error: "This plan has no meals to save." };
              }
              const { template, error } = await createPlanTemplate(
                supabase,
                authedUserId,
                draft,
              );
              if (error || !template) {
                return { ok: false, error: error ?? "Could not save template." };
              }
              track(AnalyticsEvents.plan_template_created, {
                dayCount: draft.dayCount,
                slotCount: draft.slots.length,
              });
              setPlanTemplates((prev) => [
                template,
                ...prev.filter((t) => t.id !== template.id),
              ]);
              return { ok: true };
            }}
            onApply={(templateId) => {
              const tmpl = planTemplates.find((t) => t.id === templateId);
              if (tmpl) setApplyTemplateTarget(tmpl);
            }}
            onDelete={async (templateId) => {
              if (!authedUserId) return { ok: false, error: "Sign in required." };
              const { error } = await deletePlanTemplate(supabase, authedUserId, templateId);
              if (error) return { ok: false, error };
              setPlanTemplates((prev) => prev.filter((t) => t.id !== templateId));
              return { ok: true };
            }}
          />
          <DestructiveConfirmDialog
            open={applyTemplateTarget !== null}
            onOpenChange={(open) => {
              if (!open) setApplyTemplateTarget(null);
            }}
            title={
              applyTemplateTarget
                ? `Apply "${applyTemplateTarget.name}"?`
                : "Apply template?"
            }
            description="Replace this week's plan with the template meals. This can't be undone."
            confirmLabel="Apply"
            onConfirm={() => {
              if (!applyTemplateTarget) return;
              const next = applyTemplateToWeek(applyTemplateTarget);
              setMealPlan(next);
              track(AnalyticsEvents.plan_template_applied, {
                dayCount: applyTemplateTarget.dayCount,
                slotCount: applyTemplateTarget.slots.length,
              });
              setTemplatesOpen(false);
              setApplyTemplateTarget(null);
              toast.success("Template applied");
            }}
          />
        </>
      ) : null}
      <AdjustConstraintsSheet
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        initial={adjustInitial}
        libraryCount={savedRecipesForLibrary.length}
        discoverCount={discoverCount}
        saving={isGenerating}
        onSave={(next) => void handleAdjustSave(next)}
      />
      <BatchCookSheet
        open={batchCookOpen}
        onOpenChange={setBatchCookOpen}
        recipes={batchCookCandidates}
        saving={batchCookSaving}
        onSave={async (recipe, portions) => {
          setBatchCookSaving(true);
          try {
            const ok = await scaleBatchCookToShopping(recipe, portions);
            if (ok) {
              toast.success("Shopping list scaled to your batch.");
              setBatchCookOpen(false);
              handleShoppingList();
            }
          } finally {
            setBatchCookSaving(false);
          }
        }}
        onCook={async (recipe, portions) => {
          setBatchCookSaving(true);
          try {
            await scaleBatchCookToShopping(recipe, portions);
          } finally {
            setBatchCookSaving(false);
          }
          setBatchCookOpen(false);
          onOpenRecipe?.(recipe.id);
        }}
      />
      <ResetPlanSheet
        open={resetPlan.open}
        onOpenChange={resetPlan.setOpen}
        loading={isGenerating}
        onConfirm={handleResetPlanConfirm}
      />
    </div>
  );
});
