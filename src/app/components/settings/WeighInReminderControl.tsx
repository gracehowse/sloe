"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Switch } from "../ui/switch";
import { track } from "../../../lib/analytics/track.ts";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import {
  DEFAULT_WEIGH_IN_REMINDER_HOUR,
  DEFAULT_WEIGH_IN_REMINDER_WEEKDAY,
  parseWeighInReminderPref,
  type WeekdayIndex,
} from "../../../lib/push/weighInReminder.ts";

/**
 * ENG-955 — gentle, opt-in weigh-in reminder control (web parity of the
 * mobile `WeighInReminderRow`).
 *
 * Self-contained: owns its state + persistence so it can mount inside the
 * Settings Notifications card without growing that file's pinned screen
 * budget. Gated by `weigh_in_reminder_v1` (default-ON since 2026-06-30,
 * ENG-1279) — renders the control by default; the flag is the kill switch.
 *
 * Persists to the freeform `profiles.notification_prefs` JSONB under the
 * `weighInReminder` key (`{ enabled, weekday, hour }`); the eligibility +
 * anti-nag logic lives in the shared core consumed by the cron. Copy is warm
 * and trend-framed — never a streak/badge/threat.
 */

const WEEKDAY_LABELS: Record<WeekdayIndex, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

const HOUR_CHOICES = [7, 8, 9, 18] as const;

function formatHour(hour: number): string {
  const h = ((hour + 11) % 12) + 1;
  const suffix = hour < 12 ? "am" : "pm";
  return `${h}${suffix}`;
}

export function WeighInReminderControl() {
  const flagOn = isFeatureEnabled("weigh_in_reminder_v1");
  const [enabled, setEnabled] = useState(false);
  const [weekday, setWeekday] = useState<WeekdayIndex>(
    DEFAULT_WEIGH_IN_REMINDER_WEEKDAY,
  );
  const [hour, setHour] = useState<number>(DEFAULT_WEIGH_IN_REMINDER_HOUR);

  useEffect(() => {
    if (!flagOn) return;
    let cancelled = false;
    void (async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) return;
      const { data } = await supabase
        .from("profiles")
        .select("notification_prefs")
        .eq("id", uid)
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
  }, [flagOn]);

  if (!flagOn) return null;

  async function persist(next: {
    enabled: boolean;
    weekday: WeekdayIndex;
    hour: number;
  }): Promise<boolean> {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) {
      toast.error("Sign in to change this preference.");
      return false;
    }
    // Read-modify-write so sibling notification_prefs keys survive.
    const { data } = await supabase
      .from("profiles")
      .select("notification_prefs")
      .eq("id", uid)
      .maybeSingle();
    const existing =
      data &&
      typeof (data as { notification_prefs?: unknown }).notification_prefs === "object"
        ? ((data as { notification_prefs?: Record<string, unknown> }).notification_prefs ?? {})
        : {};
    const merged = {
      ...existing,
      weighInReminder: {
        enabled: next.enabled,
        weekday: next.weekday,
        hour: next.hour,
      },
    };
    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: merged })
      .eq("id", uid);
    if (error) {
      toast.error("Failed to save preference");
      return false;
    }
    return true;
  }

  function onToggle(next: boolean) {
    const previous = enabled;
    if (previous === next) return;
    setEnabled(next);
    void (async () => {
      const ok = await persist({ enabled: next, weekday, hour });
      if (!ok) {
        setEnabled(previous);
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
      if (enabled) {
        track(AnalyticsEvents.weigh_in_reminder_enabled_toggled, {
          enabled: true,
          weekday: nextWeekday,
          hour: nextHour,
        });
      }
    })();
  }

  return (
    <div data-testid="settings-weigh-in-reminder">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <label
            htmlFor="weigh-in-reminder-toggle"
            className="block text-foreground cursor-pointer"
          >
            Weigh-in reminder
          </label>
          <p className="text-xs text-muted-foreground mt-1">
            {enabled
              ? `${WEEKDAY_LABELS[weekday]} ${formatHour(hour)} · skipped if you've already weighed in this week`
              : "Off · a gentle weekly nudge, never a streak"}
          </p>
        </div>
        <Switch
          id="weigh-in-reminder-toggle"
          aria-label="Weigh-in reminder notifications"
          checked={enabled}
          onCheckedChange={onToggle}
        />
      </div>

      {/* Cadence — visible at reduced emphasis when off so it can be set
          before flipping on. */}
      <div
        className={`mt-3 ${enabled ? "" : "opacity-50 pointer-events-none"}`}
        aria-disabled={!enabled}
      >
        <p className="text-xs font-medium text-muted-foreground mb-1">Day</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(WEEKDAY_LABELS) as unknown as string[]).map((k) => {
            const wd = Number(k) as WeekdayIndex;
            const selected = wd === weekday;
            return (
              <button
                key={wd}
                type="button"
                aria-pressed={selected}
                aria-label={`Weigh in on ${WEEKDAY_LABELS[wd]}`}
                disabled={!enabled}
                onClick={() => onPickCadence(wd, hour)}
                className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${
                  selected
                    ? "border-accent text-accent font-semibold bg-accent/10"
                    : "border-border text-foreground hover:bg-muted/30"
                }`}
              >
                {WEEKDAY_LABELS[wd].slice(0, 3)}
              </button>
            );
          })}
        </div>

        <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">Time</p>
        <div className="flex gap-2">
          {HOUR_CHOICES.map((h) => {
            const selected = h === hour;
            return (
              <button
                key={h}
                type="button"
                aria-pressed={selected}
                aria-label={`Weigh in at ${formatHour(h)}`}
                disabled={!enabled}
                onClick={() => onPickCadence(weekday, h)}
                className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${
                  selected
                    ? "border-accent text-accent font-semibold bg-accent/10"
                    : "border-border text-foreground hover:bg-muted/30"
                }`}
              >
                {formatHour(h)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
