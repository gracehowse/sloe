"use client";

import * as React from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useOnboardingV2 } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

/**
 * Permissions — step 12 (web). Notifications only.
 *
 * Apple Health is mobile-only (HealthKit doesn't exist on web). The
 * mobile mirror at apps/mobile/components/onboarding-v2/steps/
 * permissions.tsx still renders both cards. Hiding the card here
 * (rather than rendering it as a no-op) avoids dangling a permission
 * the user can never grant on this surface.
 *
 * Notifications today only records intent — wiring up the browser
 * Push API + service worker is a separate workstream (Grace
 * 2026-04-20).
 */

export function PermissionsStep() {
  const { state, set } = useOnboardingV2();
  const overline = useStepOverline();
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
        onAllow={() => set({ notifGranted: true })}
        onSkip={() => set({ notifGranted: false })}
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
  onAllow,
  onSkip,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  body: string;
  granted: boolean | null;
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
      ) : granted === false ? (
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">
            Skipped — you can allow later
          </div>
          <button
            type="button"
            onClick={onAllow}
            className="bg-transparent border-0 text-primary text-xs font-bold cursor-pointer p-0"
          >
            Undo
          </button>
        </div>
      ) : (
        <div className="flex gap-2.5">
          <Button size="default" onClick={onAllow}>
            Allow
          </Button>
          <Button variant="secondary" size="default" onClick={onSkip}>
            Not now
          </Button>
        </div>
      )}
    </div>
  );
}
