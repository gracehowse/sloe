import { useCallback, useState } from "react";

import { isFeatureEnabled } from "@/lib/analytics";
import {
  RESET_PLAN_CONFIRM_FLAG,
  type ResetPlanMode,
} from "@suppr/shared/planning/resetPlanSheet";

/** ENG-1261 — gate library regenerate behind keep/clear sheet. */
export function useResetPlanGate(
  planHasRealMeals: boolean,
  generatePlan: (options?: { resetMode?: ResetPlanMode }) => void,
) {
  const enabled = isFeatureEnabled(RESET_PLAN_CONFIRM_FLAG);
  const [open, setOpen] = useState(false);

  const requestLibraryGenerate = useCallback(() => {
    if (enabled && planHasRealMeals) {
      setOpen(true);
      return;
    }
    void generatePlan();
  }, [enabled, planHasRealMeals, generatePlan]);

  const handleResetPlanConfirm = useCallback(
    (mode: ResetPlanMode) => {
      setOpen(false);
      void generatePlan({ resetMode: mode });
    },
    [generatePlan],
  );

  return { open, setOpen, requestLibraryGenerate, handleResetPlanConfirm };
}
