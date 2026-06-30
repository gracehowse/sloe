"use client";

import { toast } from "sonner";

import { Switch } from "../ui/switch";
import { track } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import { supabase } from "../../../lib/supabase/browserClient.ts";

/**
 * Weekly recap push toggle (Batch 4.11 / H6 audit) — extracted from
 * `Settings.tsx` (ENG-955) to keep that file under its pinned screen budget
 * when the new weigh-in reminder control landed. Behaviour + a11y label +
 * `weekly-recap-push-toggle` id unchanged: controls
 * `profiles.weekly_recap_push_enabled` and emits
 * `weekly_recap_push_enabled_toggled` on a committed change. The server cron
 * (`/api/push/weekly-recap`) owns delivery; this toggle only sets the opt-in
 * column, surfaced on web so the user can opt out from any device.
 */
export function WeeklyRecapToggle({
  enabled,
  setEnabled,
  weekStartDay,
}: {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  weekStartDay: "monday" | "sunday";
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <label
          htmlFor="weekly-recap-push-toggle"
          className="block text-foreground cursor-pointer"
        >
          Weekly recap
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          {weekStartDay === "monday"
            ? "Sunday 18:00 (respects your week start)."
            : "Saturday 18:00 (respects your week start)."}
        </p>
      </div>
      <Switch
        id="weekly-recap-push-toggle"
        aria-label="Weekly recap push notifications"
        checked={enabled}
        onCheckedChange={(next) => {
          const previous = enabled;
          if (previous === next) return;
          setEnabled(next);
          void (async () => {
            const { data: session } = await supabase.auth.getSession();
            const uid = session.session?.user.id;
            if (!uid) {
              // No session — revert and surface the problem.
              setEnabled(previous);
              toast.error("Sign in to change this preference.");
              return;
            }
            const { error } = await supabase
              .from("profiles")
              .update({ weekly_recap_push_enabled: next })
              .eq("id", uid);
            if (error) {
              setEnabled(previous);
              toast.error("Failed to save preference");
              return;
            }
            track(AnalyticsEvents.weekly_recap_push_enabled_toggled, {
              enabled: next,
            });
          })();
        }}
      />
    </div>
  );
}
