import { useCallback, useState } from "react";

import {
  RESET_PLAN_CONFIRM_FLAG,
  type ResetPlanMode,
} from "@/lib/planning/resetPlanSheet";
import { isFeatureEnabled } from "@/lib/analytics/track";

/** ENG-1261 — gate regenerate behind keep/clear sheet when plan has real meals. */
export function useResetPlanGate(planHasRealMeals: boolean) {
  const enabled = isFeatureEnabled(RESET_PLAN_CONFIRM_FLAG);
  const [open, setOpen] = useState(false);

  const requestRegenerate = useCallback(
    (run: (mode?: ResetPlanMode) => void) => {
      if (enabled && planHasRealMeals) {
        setOpen(true);
        return;
      }
      void run();
    },
    [enabled, planHasRealMeals],
  );

  const confirm = useCallback((mode: ResetPlanMode, run: (mode?: ResetPlanMode) => void) => {
    setOpen(false);
    void run(mode);
  }, []);

  return { open, setOpen, requestRegenerate, confirm };
}
