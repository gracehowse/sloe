import { forwardRef, useImperativeHandle } from "react";

import { TrialEndReminderDayPicker } from "@/components/paywall/TrialEndReminderDayPicker";
import { useTrialEndReminderPaywall } from "@/hooks/useTrialEndReminderPaywall";

export type TrialEndReminderPaywallBlockHandle = {
  commitOnTrialStart: () => Promise<void>;
};

type TrialEndReminderPaywallBlockProps = {
  userId: string | null | undefined;
  trialApplies: boolean;
  hasProPackage: boolean;
};

/**
 * ENG-968 — trial-end reminder picker + commit handle for the mobile paywall.
 */
export const TrialEndReminderPaywallBlock = forwardRef<
  TrialEndReminderPaywallBlockHandle,
  TrialEndReminderPaywallBlockProps
>(function TrialEndReminderPaywallBlock(
  { userId, trialApplies, hasProPackage },
  ref,
) {
  const {
    trialReminderUiVisible,
    trialReminderDay,
    setTrialReminderDay,
    commitTrialEndReminderOnTrialStart,
  } = useTrialEndReminderPaywall({ userId, trialApplies, hasProPackage });

  useImperativeHandle(
    ref,
    () => ({ commitOnTrialStart: commitTrialEndReminderOnTrialStart }),
    [commitTrialEndReminderOnTrialStart],
  );

  return (
    <TrialEndReminderDayPicker
      visible={trialReminderUiVisible}
      value={trialReminderDay}
      onChange={setTrialReminderDay}
    />
  );
});
