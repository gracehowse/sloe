import { useCallback, useEffect, useState } from "react";

import { isFeatureEnabled, track } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  DEFAULT_TRIAL_END_REMINDER_DAY,
  computeTrialEndReminderFireDate,
  type TrialEndReminderDay,
} from "@suppr/shared/push/trialEndReminder";

/**
 * ENG-968 — trial-end reminder day picker state + local push scheduling for
 * the mobile paywall. Extracted to keep `paywall.tsx` under its screen budget.
 */
export function useTrialEndReminderPaywall({
  userId,
  trialApplies,
  hasProPackage,
}: {
  userId: string | null | undefined;
  trialApplies: boolean;
  hasProPackage: boolean;
}) {
  const trialReminderFlag = isFeatureEnabled("trial_end_reminder_v1");
  const [trialReminderDay, setTrialReminderDay] = useState<TrialEndReminderDay>(
    DEFAULT_TRIAL_END_REMINDER_DAY,
  );
  const [trialReminderPermitted, setTrialReminderPermitted] = useState(false);

  useEffect(() => {
    if (!trialReminderFlag) return;
    let cancelled = false;
    void (async () => {
      const { hasTrialReminderNotificationPermission } = await import(
        "@/lib/trialEndReminderPush"
      );
      const ok = await hasTrialReminderNotificationPermission();
      if (!cancelled) setTrialReminderPermitted(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, [trialReminderFlag]);

  const trialReminderUiVisible =
    trialReminderFlag && trialReminderPermitted && trialApplies && hasProPackage;

  const commitTrialEndReminderOnTrialStart = useCallback(async () => {
    if (!trialReminderUiVisible) return;
    const fireDate = computeTrialEndReminderFireDate(new Date(), trialReminderDay);
    const { scheduleTrialEndReminder } = await import("@/lib/trialEndReminderPush");
    void scheduleTrialEndReminder(fireDate);
    if (userId) {
      const { persistTrialEndReminderPref } = await import(
        "@suppr/shared/push/persistTrialEndReminderPref"
      );
      void persistTrialEndReminderPref(supabase, userId, trialReminderDay);
    }
    track(AnalyticsEvents.trial_end_reminder_day_selected, {
      day: trialReminderDay,
      surface: "mobile_paywall",
    });
  }, [trialReminderDay, trialReminderUiVisible, userId]);

  return {
    trialReminderUiVisible,
    trialReminderDay,
    setTrialReminderDay,
    commitTrialEndReminderOnTrialStart,
  };
}
