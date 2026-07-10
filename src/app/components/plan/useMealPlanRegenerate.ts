import { useCallback } from "react";
import { toast } from "sonner";

import {
  RESET_PLAN_SHEET_COPY,
  type ResetPlanMode,
} from "@/lib/planning/resetPlanSheet";
import { useResetPlanGate } from "./useResetPlanGate";

export interface UseMealPlanRegenerateArgs {
  isFree: boolean;
  planDays: number;
  enabledSlots: Set<string>;
  slots: readonly string[];
  slotTitle: (key: string) => string;
  /**
   * ENG-1177 — when the user runs a numbered meal-slot preset (four_meals /
   * six_meals), this is the full configured slot list ("Meal 1" … "Meal N").
   * It overrides the classic `enabledSlots` toggle so the extra slots get a
   * real calorie share instead of being starved to 0 kcal. `null` for the
   * classic preset (the per-slot toggle applies).
   */
  slotsOverride?: readonly string[] | null;
  mealLockEnabled: boolean;
  lockedMealCount: number;
  planSourceSelector: boolean;
  planSource: string;
  allowBatchLeftovers: boolean;
  planHasRealMeals: boolean;
  /** ENG-1491 — Today/Tomorrow/Next-week chip; anchors a full regeneration. */
  startOffset: number;
  generateMealPlan: (options?: Record<string, unknown>) => Promise<void>;
  generateShoppingListFromPlan: () => Promise<void>;
  setIsGenerating: (v: boolean) => void;
}

/** ENG-1261 — regenerate + reset-plan sheet gate for MealPlanner. */
export function useMealPlanRegenerate(args: UseMealPlanRegenerateArgs) {
  const resetPlan = useResetPlanGate(args.planHasRealMeals);

  const handleRegenerate = useCallback(
    async (mode?: ResetPlanMode) => {
      args.setIsGenerating(true);
      try {
        const days = args.isFree ? 1 : args.planDays;
        const slotsList: string[] = args.slots
          .filter((s) => args.enabledSlots.has(s))
          .map((s) => args.slotTitle(s));
        // ENG-1177 — a numbered preset always overrides; otherwise the classic
        // per-slot toggle drives a partial override.
        const slotsOverride =
          args.slotsOverride && args.slotsOverride.length > 0
            ? [...args.slotsOverride]
            : slotsList.length > 0 && slotsList.length < args.slots.length
              ? slotsList
              : null;
        const keepLocked =
          mode === "clear" ? false : args.mealLockEnabled && args.lockedMealCount > 0;
        await args.generateMealPlan({
          days,
          // ENG-1491 — a full regenerate re-anchors to the chip; a
          // keepLocked partial regen preserves the existing anchor
          // (generateMealPlan ignores startOffset on that branch).
          startOffset: args.startOffset,
          ...(slotsOverride ? { slots: slotsOverride } : {}),
          ...(args.planSourceSelector ? { source: args.planSource } : {}),
          ...(keepLocked ? { keepLocked: true } : {}),
          allowLeftovers: args.allowBatchLeftovers,
        });
        await args.generateShoppingListFromPlan();
        if (mode === "keep") {
          toast.success(RESET_PLAN_SHEET_COPY.toastKeep);
        } else if (mode === "clear") {
          toast.success(RESET_PLAN_SHEET_COPY.toastClear);
        } else if (!keepLocked) {
          toast.success("Plan regenerated");
        }
      } catch {
        toast.error("Could not regenerate plan. Save more recipes and try again.");
      } finally {
        args.setIsGenerating(false);
      }
    },
    [args],
  );

  return {
    resetPlan,
    handleRegenerate,
    requestRegenerate: () => resetPlan.requestRegenerate(handleRegenerate),
    handleResetPlanConfirm: (mode: ResetPlanMode) => resetPlan.confirm(mode, handleRegenerate),
  };
}
