import { forwardRef, useImperativeHandle } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { TrialEndReminderDayPicker } from "./TrialEndReminderDayPicker.tsx";
import { useTrialEndReminderUpgrade } from "./useTrialEndReminderUpgrade.ts";

export type TrialEndReminderUpgradeBlockHandle = {
  persistBeforeCheckout: (
    supabase: SupabaseClient,
    userId: string | null | undefined,
  ) => Promise<void>;
};

type TrialEndReminderUpgradeBlockProps = {
  isAnnual: boolean;
};

/**
 * ENG-968 — trial-end reminder picker + checkout persist handle for web upgrade.
 */
export const TrialEndReminderUpgradeBlock = forwardRef<
  TrialEndReminderUpgradeBlockHandle,
  TrialEndReminderUpgradeBlockProps
>(function TrialEndReminderUpgradeBlock({ isAnnual }, ref) {
  const {
    trialReminderUiVisible,
    trialReminderDay,
    setTrialReminderDay,
    persistTrialEndReminderBeforeCheckout,
  } = useTrialEndReminderUpgrade(isAnnual);

  useImperativeHandle(
    ref,
    () => ({ persistBeforeCheckout: persistTrialEndReminderBeforeCheckout }),
    [persistTrialEndReminderBeforeCheckout],
  );

  return (
    <TrialEndReminderDayPicker
      visible={trialReminderUiVisible}
      value={trialReminderDay}
      onChange={setTrialReminderDay}
    />
  );
});
