"use client";

/**
 * ENG-963 (2026-06-30) — "What's bringing you here?" onboarding step (web).
 *
 * A single, calm, OPTIONAL intent capture placed right after the Goal step
 * (the earliest moment the user has framed *what* they want, so we ask the
 * gentler *why* while it's top of mind). The choice is recorded in
 * `state.whyNow`, emitted as `onboarding_why_now`, and reflected back on the
 * reveal step ("a plan built around feeling better day to day").
 *
 * Body-neutral by design — every option is a supportive framing of *why now*,
 * never a body-shaming or outcome-promising one (trust posture: Sloe is a
 * tool, not a clinician). Picking is never required: the footer Continue
 * always advances (`canAdvance("why-now", …)` returns true), and the option
 * copy comes from the shared `whyNowOptions.ts` so web + mobile can never
 * drift.
 *
 * Flag-gated behind the default-OFF `onboarding-why-now` flag: when OFF the
 * flow shell auto-skips this step entirely (same mechanism as the app-choice
 * auto-skip), so it's inert until the flag ramps. The gate + auto-skip live
 * in `context.tsx` (resolveNextStep) + `web-flow.tsx` (the defensive
 * already-on-step effect).
 */

import * as React from "react";
import { OptionCard } from "@/app/components/ui/option-card";
import {
  ONBOARDING_WHY_NOW_OPTIONS,
  ONBOARDING_WHY_NOW_QUESTION,
  ONBOARDING_WHY_NOW_SUBTITLE,
} from "@/lib/onboarding/whyNowOptions";
import { track } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";
import type { WhyNow } from "@/lib/onboarding/state";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

export function WhyNowStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();

  const choose = React.useCallback(
    (id: Exclude<WhyNow, null>) => {
      set({ whyNow: id });
      track(AnalyticsEvents.onboarding_why_now, {
        reason: id,
        platform: "web",
      });
    },
    [set],
  );

  const picked = state.whyNow;

  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title={ONBOARDING_WHY_NOW_QUESTION}
        subtitle={ONBOARDING_WHY_NOW_SUBTITLE}
      />

      <div className="flex flex-col gap-2.5">
        {ONBOARDING_WHY_NOW_OPTIONS.map((opt) => (
          <OptionCard
            key={opt.id}
            selected={picked === opt.id}
            onClick={() => choose(opt.id)}
            title={opt.title}
            subtitle={opt.subtitle}
          />
        ))}
      </div>
    </StepBody>
  );
}
