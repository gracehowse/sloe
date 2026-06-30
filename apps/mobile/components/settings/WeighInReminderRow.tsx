import * as React from "react";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Scale } from "lucide-react-native";

import { SettingsRow } from "@/components/settings/SettingsRow";
import {
  WeighInReminderPicker,
  WEEKDAY_LABELS,
  formatHour,
} from "@/components/settings/WeighInReminderPicker";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track, isFeatureEnabled } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_WEIGH_IN_REMINDER_HOUR,
  DEFAULT_WEIGH_IN_REMINDER_WEEKDAY,
  parseWeighInReminderPref,
  type WeekdayIndex,
} from "@suppr/shared/push/weighInReminder";

/**
 * ENG-955 — gentle, opt-in weigh-in reminder Settings row.
 *
 * Self-contained surface (owns state + persistence) so it can mount in the
 * Reminders card of `SettingsBundleContent` without growing that legacy file's
 * pinned screen budget; the modal layout lives in `WeighInReminderPicker`.
 * Gated by `weigh_in_reminder_v1` (default-ON since 2026-06-30, ENG-1279) —
 * renders the row by default; the flag is the kill switch (on-device confirm
 * pending per the ENG-955 report).
 *
 * Persists to the freeform `profiles.notification_prefs` JSONB under the
 * `weighInReminder` key (`{ enabled, weekday, hour }`) — no schema column for
 * the pref itself. The eligibility + anti-nag logic lives in the shared core
 * (`@suppr/shared/push/weighInReminder`) consumed by the cron; this surface
 * only writes the user's choice. Copy is warm and trend-framed — never a
 * streak/badge/threat (matches the push body the cron sends).
 */
export function WeighInReminderRow({
  userId,
  testID = "settings-bundle-weigh-in-reminder-row",
}: {
  userId: string | null;
  testID?: string;
}) {
  const enabledFlag = isFeatureEnabled("weigh_in_reminder_v1");
  const colors = useThemeColors();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [weekday, setWeekday] = useState<WeekdayIndex>(
    DEFAULT_WEIGH_IN_REMINDER_WEEKDAY,
  );
  const [hour, setHour] = useState<number>(DEFAULT_WEIGH_IN_REMINDER_HOUR);

  // Hydrate from notification_prefs.weighInReminder. Only when the flag is on
  // (no point reading for a surface that won't render).
  useEffect(() => {
    if (!enabledFlag || !userId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("notification_prefs")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || !data) return;
      const np = (data as { notification_prefs?: unknown }).notification_prefs;
      const pref = parseWeighInReminderPref(
        np && typeof np === "object"
          ? (np as Record<string, unknown>).weighInReminder
          : null,
      );
      if (pref) {
        setEnabled(true);
        setWeekday(pref.weekday);
        setHour(pref.hour);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabledFlag, userId]);

  if (!enabledFlag) return null;

  /** Persist the current pref to notification_prefs (read-modify-write so we
   *  don't stomp sibling keys like weekSummaryMode). Returns true on success. */
  async function persist(next: {
    enabled: boolean;
    weekday: WeekdayIndex;
    hour: number;
  }): Promise<boolean> {
    if (!userId) {
      Alert.alert("Sign in required", "Sign in to change this preference.");
      return false;
    }
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
      weighInReminder: { enabled: next.enabled, weekday: next.weekday, hour: next.hour },
    };
    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: merged })
      .eq("id", userId);
    if (error) {
      Alert.alert(
        "Could not save",
        "We couldn't save your preference. Please try again.",
      );
      return false;
    }
    return true;
  }

  function onToggle(next: boolean) {
    const previousEnabled = enabled;
    if (previousEnabled === next) return;
    setEnabled(next);
    void (async () => {
      const ok = await persist({ enabled: next, weekday, hour });
      if (!ok) {
        setEnabled(previousEnabled);
        return;
      }
      track(AnalyticsEvents.weigh_in_reminder_enabled_toggled, {
        enabled: next,
        weekday,
        hour,
      });
    })();
  }

  function onPickCadence(nextWeekday: WeekdayIndex, nextHour: number) {
    const prevWeekday = weekday;
    const prevHour = hour;
    setWeekday(nextWeekday);
    setHour(nextHour);
    void (async () => {
      const ok = await persist({ enabled, weekday: nextWeekday, hour: nextHour });
      if (!ok) {
        setWeekday(prevWeekday);
        setHour(prevHour);
        return;
      }
      // Only emit the toggled event when the reminder is actually ON — a
      // cadence tweak while OFF isn't a meaningful opt-in signal.
      if (enabled) {
        track(AnalyticsEvents.weigh_in_reminder_enabled_toggled, {
          enabled: true,
          weekday: nextWeekday,
          hour: nextHour,
        });
      }
    })();
  }

  const sub = enabled
    ? `${WEEKDAY_LABELS[weekday]} ${formatHour(hour)} · skipped if you've already weighed in`
    : "Off · a gentle weekly nudge, never a streak";

  return (
    <>
      <SettingsRow
        testID={testID}
        icon={Scale}
        iconColor={colors.text}
        label="Weigh-in reminder"
        sub={sub}
        onPress={() => setPickerOpen(true)}
      />
      <WeighInReminderPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        enabled={enabled}
        weekday={weekday}
        hour={hour}
        onToggle={onToggle}
        onPickCadence={onPickCadence}
      />
    </>
  );
}
