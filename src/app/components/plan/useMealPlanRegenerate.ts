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
  mealLockEnabled: boolean;
  lockedMealCount: number;
  planSourceSelector: boolean;
  planSource: string;
  allowBatchLeftovers: boolean;
  planHasRealMeals: boolean;
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
        const useSlotOverride =
          slotsList.length > 0 && slotsList.length < args.slots.length;
        const keepLocked =
          mode === "clear" ? false : args.mealLockEnabled && args.lockedMealCount > 0;
        await args.generateMealPlan({
          days,
          ...(useSlotOverride ? { slots: slotsList } : {}),
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
