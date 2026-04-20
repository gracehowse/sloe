"use client";

import * as React from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useAuthSessionOptional } from "@/context/AuthSessionContext";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import {
  getWebNotificationPermission,
  isWebNotificationSupported,
  requestWebNotificationPermission,
  subscribeToWebPush,
} from "@/lib/push/webNotifications";
import { supabase } from "@/lib/supabase/browserClient";
import { useOnboardingV2 } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

/**
 * Permissions — step 13 (web). Notifications only.
 *
 * Apple Health is mobile-only (HealthKit doesn't exist on web). The
 * mobile mirror at apps/mobile/components/onboarding-v2/steps/
 * permissions.tsx still renders both cards.
 *
 * Notifications: Allow now actually prompts the browser (Grace
 * 2026-04-20). A granted permission lets us surface in-tab nudges
 * immediately via `new Notification(...)`; server-initiated Web Push
 * (VAPID + service worker + cron fan-out) is a separate follow-up
 * that will reuse this grant signal.
 */

export function PermissionsStep() {
  const { state, set } = useOnboardingV2();
  const { authedUserId } = useAuthSessionOptional();
  const overline = useStepOverline();

  // Reflect a pre-existing browser grant / denial on mount so users
  // who already chose earlier see the correct state here.
  React.useEffect(() => {
    if (!isWebNotificationSupported()) return;
    if (state.notifGranted !== null) return;
    const current = getWebNotificationPermission();
    if (current === "granted") set({ notifGranted: true });
    else if (current === "denied") set({ notifGranted: false });
  }, [state.notifGranted, set]);

  const [blocked, setBlocked] = React.useState(false);
  const [prompting, setPrompting] = React.useState(false);

  const handleAllow = React.useCallback(async () => {
    setPrompting(true);
    try {
      const result = await requestWebNotificationPermission();
      track(AnalyticsEvents.onboarding_step_completed, {
        step_id: "permissions",
        detail: "notifications_permission_result",
        result,
        surface: "web",
      });
      if (result === "granted") {
        set({ notifGranted: true });
        setBlocked(false);
        // Kick off the push subscription in the background. If the
        // user isn't authed yet (they advanced through onboarding
        // without completing signup, edge case), persistence is
        // skipped; the browser permission is still granted so local
        // `new Notification(...)` calls work. The terminal step's
        // persistence layer can re-trigger subscribe after auth.
        if (authedUserId) {
          const subResult = await subscribeToWebPush(supabase, authedUserId);
          track(AnalyticsEvents.onboarding_step_completed, {
            step_id: "permissions",
            detail: "web_push_subscribe_result",
            result: subResult.ok ? "ok" : subResult.reason,
            surface: "web",
          });
        }
      } else if (result === "denied") {
        // Browser won't re-prompt once denied — surface a hint so
        // the user knows the box won't flip without a settings trip.
        set({ notifGranted: false });
        setBlocked(true);
      } else {
        // "unsupported" or "default" (user dismissed the prompt
        // without choosing) — treat as skipped so the flow advances.
        set({ notifGranted: false });
        setBlocked(false);
      }
    } finally {
      setPrompting(false);
    }
  }, [authedUserId, set]);

  const handleSkip = React.useCallback(() => {
    set({ notifGranted: false });
  }, [set]);

  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="One quick permission"
        subtitle="Optional — you can change it later in Settings."
      />
      <PermissionCard
        icon={<Bell className="size-5 text-warning" />}
        iconBg="bg-warning/12"
        title="Notifications"
        body="Gentle reminders only — an optional evening nudge if you're below your protein target. Off by default on weekends."
        granted={state.notifGranted}
        blocked={blocked}
        working={prompting}
        onAllow={handleAllow}
        onSkip={handleSkip}
      />
    </StepBody>
  );
}

function PermissionCard({
  icon,
  iconBg,
  title,
  body,
  granted,
  blocked = false,
  working = false,
  onAllow,
  onSkip,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  body: string;
  granted: boolean | null;
  /** True when the permission was explicitly denied at the browser
   *  level — the OS prompt won't show again until the user flips it
   *  in site settings. Surfacing this prevents a dead "Undo" loop. */
  blocked?: boolean;
  /** True while the OS permission prompt is open. Disables the
   *  buttons so rapid taps don't queue multiple prompts. */
  working?: boolean;
  onAllow: () => void;
  onSkip: () => void;
}) {
  return (
    <div
      className={`bg-card rounded-xl p-4 mb-3 transition-pm border ${
        granted === true ? "border-success/40" : "border-border"
      }`}
    >
      <div className="flex gap-3 items-start mb-3">
        <div
          className={`size-10 rounded-xl grid place-items-center shrink-0 ${iconBg}`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-foreground tracking-tight">
            {title}
          </div>
          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {body}
          </div>
        </div>
      </div>
      {granted === true ? (
        <div className="flex items-center gap-2 text-xs font-bold text-success">
          <Check className="size-3.5" strokeWidth={2.5} />
          Allowed
        </div>
      ) : blocked ? (
        <div className="text-xs text-muted-foreground leading-relaxed">
          Blocked in your browser settings. To enable, click the lock
          icon in your address bar and set Notifications to Allow —
          then come back.
        </div>
      ) : granted === false ? (
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">
            Skipped — you can allow later
          </div>
          <button
            type="button"
            onClick={onAllow}
            disabled={working}
            className="bg-transparent border-0 text-primary text-xs font-bold cursor-pointer p-0 disabled:opacity-60"
          >
            Undo
          </button>
        </div>
      ) : (
        <div className="flex gap-2.5">
          <Button size="default" onClick={onAllow} disabled={working}>
            {working ? "Opening…" : "Allow"}
          </Button>
          <Button
            variant="secondary"
            size="default"
            onClick={onSkip}
            disabled={working}
          >
            Not now
          </Button>
        </div>
      )}
    </div>
  );
}
