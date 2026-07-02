import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isFeatureEnabled, track } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";
import {
  DEFAULT_TRIAL_END_REMINDER_DAY,
  type TrialEndReminderDay,
} from "@/lib/push/trialEndReminder";
import { persistTrialEndReminderPref } from "@/lib/push/persistTrialEndReminderPref";

/**
 * ENG-968 — trial-end reminder picker state for the web upgrade dialog.
 * Extracted to keep `upgrade-paywall-dialog.tsx` under its screen budget.
 */
export function useTrialEndReminderUpgrade(isAnnual: boolean) {
  const trialReminderFlag = isFeatureEnabled("trial_end_reminder_v1");
  const [trialReminderDay, setTrialReminderDay] = useState<TrialEndReminderDay>(
    DEFAULT_TRIAL_END_REMINDER_DAY,
  );
  const trialReminderUiVisible = trialReminderFlag && isAnnual;

  const persistTrialEndReminderBeforeCheckout = useCallback(
    async (supabase: SupabaseClient, userId: string | null | undefined) => {
      if (!trialReminderUiVisible || !userId) return;
      void persistTrialEndReminderPref(supabase, userId, trialReminderDay);
      track(AnalyticsEvents.trial_end_reminder_day_selected, {
        day: trialReminderDay,
        surface: "upgrade_dialog",
      });
    },
    [trialReminderDay, trialReminderUiVisible],
  );

  return {
    trialReminderUiVisible,
    trialReminderDay,
    setTrialReminderDay,
    persistTrialEndReminderBeforeCheckout,
  };
}
