"use client";

/**
 * usePlanImport — composition-root hook for the web Plan-Import surface
 * (ENG-696). Holds all paste/parse/review/commit state + handlers so the
 * screen file (`PlanImport.tsx`) and the review child (`PlanImportReview.tsx`)
 * stay thin presentation shells (400-line screen-file rule, ENG-621).
 *
 * Reuses the SAME `/api/plan-import/parse` route and the SHARED
 * `commitPlanImport` pipeline the mobile flow calls — no fork.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { consumePendingImportText } from "../../../lib/recipe-import/pendingImportText.ts";
import { useAppData } from "../../../context/AppDataContext.tsx";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import { track } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import { commitPlanImport } from "../../../lib/planning/planImport/commitPlanImport.ts";
import { rebalanceImportedPlanDays } from "../../../lib/planning/planImport/rebalanceImportedPlan.ts";
import { DEFAULT_PLANNER_BANDS } from "../../../lib/nutrition/mealPlanAlgo.ts";
import { MEAL_PREP_WEEK1_PASTE } from "../../../lib/planning/planImport/fixtures/mealPrepWeek1.ts";
import type {
  PlanImportCompiledSlot,
  PlanImportNutritionMode,
  PlanImportParseResult,
  PlanImportVerifiedRecipe,
} from "../../../lib/planning/planImport/types.ts";

export type PlanImportStep = "paste" | "parsing" | "review";

type ParseApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  planName?: string;
  recipes?: PlanImportVerifiedRecipe[];
  slots?: PlanImportCompiledSlot[];
  stats?: PlanImportParseResult["stats"];
};

const DEFAULT_PLAN_NAME = "Meal prep — Week 1";

export function usePlanImport(onClose: () => void) {
  const { userId, nutritionTargets, setMealPlan, reanchorMealPlan } = useAppData();

  const [step, setStep] = useState<PlanImportStep>("paste");
  const [pasteText, setPasteText] = useState(MEAL_PREP_WEEK1_PASTE);
  // ENG-1245 #3 — when the unified Import sheet routes a pasted meal plan here,
  // consume the threaded text once on mount (replacing the sample) so the user
  // doesn't re-paste. consume() clears, so a normal open keeps the sample.
  useEffect(() => {
    const pending = consumePendingImportText();
    if (pending) setPasteText(pending);
  }, []);
  const [planName, setPlanName] = useState(DEFAULT_PLAN_NAME);
  const [parseResult, setParseResult] = useState<PlanImportParseResult | null>(null);
  const [slots, setSlots] = useState<PlanImportCompiledSlot[]>([]);
  const [recipes, setRecipes] = useState<PlanImportVerifiedRecipe[]>([]);
  const [nutritionMode, setNutritionMode] = useState<PlanImportNutritionMode>("match");
  const [importToLibrary, setImportToLibrary] = useState(true);
  const [autoRebalance, setAutoRebalance] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const targetKcal = nutritionTargets.calories;

  const runParse = useCallback(async () => {
    if (!userId) {
      toast.error("Sign in to import a meal plan.");
      return;
    }
    const text = pasteText.trim();
    if (!text) {
      setParseError("Paste your weekly plan and recipe sections first.");
      return;
    }
    setParseError(null);
    setStep("parsing");
    try {
      const res = await fetch("/api/plan-import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, planName }),
      });
      let json: ParseApiResponse;
      try {
        json = (await res.json()) as ParseApiResponse;
      } catch {
        setParseError(
          res.status === 503
            ? "Plan import is paused right now. Try again shortly."
            : "Something went wrong reading your plan. Try again in a moment.",
        );
        setStep("paste");
        return;
      }
      if (!res.ok || !json.ok || !json.planName || !json.recipes || !json.slots || !json.stats) {
        setParseError(
          json.error === "unauthorized"
            ? "Your session expired — sign in again to import."
            : (json.message ?? "Could not parse that plan. Include recipes with ingredients or per-meal kcal."),
        );
        setStep("paste");
        return;
      }
      const result: PlanImportParseResult = {
        planName: json.planName,
        recipes: json.recipes,
        slots: json.slots,
        stats: json.stats,
      };
      setParseResult(result);
      setPlanName(result.planName);
      setRecipes(result.recipes);
      setSlots(result.slots);
      setStep("review");
    } catch {
      setParseError("Check your connection and try again.");
      setStep("paste");
    }
  }, [userId, pasteText, planName]);

  // Match mode + opt-in → scale linked-slot portions toward the user's real
  // target before display + commit. Mirror mobile, but seed the joint fitter
  // from the user's actual macro targets rather than a placeholder.
  const displaySlots = useMemo(() => {
    if (!autoRebalance || nutritionMode !== "match") return slots;
    return rebalanceImportedPlanDays({
      slots,
      mode: nutritionMode,
      targets: {
        calories: targetKcal,
        protein: nutritionTargets.protein,
        carbs: nutritionTargets.carbs,
        fat: nutritionTargets.fat,
        fiber: nutritionTargets.fiber,
        calorieBandPct: DEFAULT_PLANNER_BANDS.calorieBandPct,
        carbFatBandPct: DEFAULT_PLANNER_BANDS.carbFatBandPct,
      },
    });
  }, [slots, autoRebalance, nutritionMode, targetKcal, nutritionTargets]);

  const avgKcal = useMemo(() => {
    const byDay = new Map<number, number>();
    for (const s of displaySlots) {
      const k =
        nutritionMode === "author" && s.authorNutrition?.calories
          ? s.authorNutrition.calories
          : s.supprNutrition.calories ?? 0;
      byDay.set(s.dayIndex, (byDay.get(s.dayIndex) ?? 0) + k);
    }
    const totals = [...byDay.values()];
    return totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
  }, [displaySlots, nutritionMode]);

  const finishCommit = useCallback(
    async (activate: boolean) => {
      if (!userId || !parseResult) return;
      setCommitting(true);
      const res = await commitPlanImport({
        supabase,
        userId,
        planName: planName.trim() || parseResult.planName,
        recipes,
        slots: displaySlots,
        nutritionMode,
        importToLibrary,
      });
      setCommitting(false);
      setActivateOpen(false);
      if (!res.ok) {
        toast.error("Could not save", { description: res.error });
        return;
      }
      track(AnalyticsEvents.plan_template_created, {
        dayCount: res.dayPlan.length,
        slotCount: displaySlots.length,
        source: "plan_import",
      });
      if (activate) {
        // ENG-1492 twin — an activated import replaces the whole plan:
        // re-anchor to today (mobile parity) instead of inheriting the
        // outgoing plan's start_date.
        reanchorMealPlan();
        setMealPlan(res.dayPlan);
        toast.success(`"${planName}" is now your active plan.`);
      } else {
        toast.success(`"${planName}" saved to templates — switch anytime from Plan.`);
      }
      onClose();
    },
    [
      userId,
      parseResult,
      planName,
      recipes,
      displaySlots,
      nutritionMode,
      importToLibrary,
      setMealPlan,
      reanchorMealPlan,
      onClose,
    ],
  );

  return {
    step,
    setStep,
    pasteText,
    setPasteText,
    planName,
    setPlanName,
    parseResult,
    nutritionMode,
    setNutritionMode,
    importToLibrary,
    setImportToLibrary,
    autoRebalance,
    setAutoRebalance,
    committing,
    activateOpen,
    setActivateOpen,
    parseError,
    targetKcal,
    displaySlots,
    avgKcal,
    runParse,
    finishCommit,
  };
}
