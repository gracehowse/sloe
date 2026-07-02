import {
  buildTrialEndReminderCopy,
  type TrialEndReminderDay,
} from "@suppr/shared/push/trialEndReminder";

import { captureException } from "./errorTracking";

export const TRIAL_END_REMINDER_NOTIFICATION_ID = "trial-end-reminder-v1";

export async function hasTrialReminderNotificationPermission(): Promise<boolean> {
  try {
    const Notifications = await import("expo-notifications");
    const settings = await Notifications.getPermissionsAsync();
    return (
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

export async function scheduleTrialEndReminder(fireDate: Date): Promise<boolean> {
  if (fireDate.getTime() <= Date.now()) return false;
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.cancelScheduledNotificationAsync(
      TRIAL_END_REMINDER_NOTIFICATION_ID,
    );
    const { title, body } = buildTrialEndReminderCopy();
    await Notifications.scheduleNotificationAsync({
      identifier: TRIAL_END_REMINDER_NOTIFICATION_ID,
      content: {
        title,
        body,
        data: {
          kind: "trial_end_reminder",
          deepLink: "/paywall?from=trial_end",
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });
    return true;
  } catch (err) {
    captureException(err);
    return false;
  }
}

export async function cancelTrialEndReminder(): Promise<void> {
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.cancelScheduledNotificationAsync(
      TRIAL_END_REMINDER_NOTIFICATION_ID,
    );
  } catch (err) {
    captureException(err);
  }
}

export type { TrialEndReminderDay };
