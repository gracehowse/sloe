import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_TRIAL_END_REMINDER_DAY,
  type TrialEndReminderDay,
} from "./trialEndReminder";

export async function persistTrialEndReminderPref(
  supabase: SupabaseClient,
  userId: string,
  reminderDay: TrialEndReminderDay,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("notification_prefs")
    .eq("id", userId)
    .maybeSingle();
  const existing =
    data && typeof (data as { notification_prefs?: unknown }).notification_prefs === "object"
      ? ((data as { notification_prefs?: Record<string, unknown> }).notification_prefs ?? {})
      : {};
  const merged = {
    ...existing,
    trialEndReminder: { enabled: true, reminderDay },
  };
  const { error } = await supabase
    .from("profiles")
    .update({ notification_prefs: merged })
    .eq("id", userId);
  return !error;
}

export { DEFAULT_TRIAL_END_REMINDER_DAY };
