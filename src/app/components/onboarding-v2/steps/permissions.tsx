"use client";

import * as React from "react";
import { Bell, Check, HeartPulse } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useOnboardingV2 } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

/**
 * Permissions — step 12. Apple Health + Notifications.
 *
 * The actual prompt invocation belongs to mobile (Stage D); this
 * step records the user's intent and the route component triggers
 * the OS prompt at the right moment. On web both cards still render
 * so the flow stays parity-aligned for sign-in handoff.
 */

export function PermissionsStep() {
  const { state, set } = useOnboardingV2();
  const overline = useStepOverline();
  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="A couple of permissions"
        subtitle="Both are optional and you can change them later in Settings."
      />
      <PermissionCard
        icon={<HeartPulse className="size-5 text-macro-fat" />}
        iconBg="bg-macro-fat/10"
        title="Apple Health"
        body="Read your active energy and steps to refine your adaptive TDEE. Suppr does not write to Health."
        granted={state.healthGranted}
        onAllow={() => set({ healthGranted: true })}
        onSkip={() => set({ healthGranted: false })}
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
