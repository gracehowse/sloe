"use client";

import * as React from "react";
import Link from "next/link";
import { Icons } from "../ui/icons";

/**
 * TodayFastingPill — fasting state CTA on the Today surface.
 *
 * Three render modes (web parity with mobile `TodayFastingPill`):
 * - Active fast: prominent "Fasting — Xh Ym" pill linking to /fasting.
 * - Idle (opted in to IF, no active fast): "Start fast" pill linking
 *   to /fasting where Start Fast is.
 * - Not opted in: render nothing.
 *
 * F-109 (TestFlight `AFHtAQRAWad1w8bDvSgZkUg`, 2026-05-06): tester
 * complained "Can't see how to turn fasting on and off." The active-only
 * pill meant idle users had no entry point from Today. We now surface a
 * "Start fast" pill in idle mode, but only for users who opted in to IF
 * (Grace, 2026-05-07): "we only want to show that fast pill if they
 * said in onboarding/changed in settings that they want to do
 * intermittent fasting." Opt-in proxy is `profiles.fasting_window != null`.
 *
 * Replaces an always-on "Intermittent fasting timer" text link the
 * idle state used to render — that surface was visible to non-IF users
 * who'd never opted in, which is the inverse of the gate Grace asked for.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). Host
 * computes the elapsed label + opt-in flag; the pill only renders.
 */
export interface TodayFastingPillProps {
  activeFastElapsedLabel: string | null;
  /**
   * True when the user has opted in to intermittent fasting (i.e.
   * `profiles.fasting_window != null`). When false, neither the
   * idle pill nor the active pill renders — non-IF users see no
   * fasting affordance on Today at all.
   */
  fastingOptedIn: boolean;
}

export function TodayFastingPill({ activeFastElapsedLabel, fastingOptedIn }: TodayFastingPillProps) {
  if (!fastingOptedIn) return null;

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      {activeFastElapsedLabel ? (
        <Link
          href="/fasting"
          aria-label={`Fasting — ${activeFastElapsedLabel} elapsed`}
          data-testid="today-fasting-pill-active"
          className="inline-flex flex-row items-center justify-center gap-2 py-2 px-4 rounded-full font-[family-name:var(--font-label)] font-semibold text-sm text-primary-solid bg-primary/10 hover:bg-primary/15 transition-colors"
        >
          <Icons.timer className="w-4 h-4 shrink-0" aria-hidden />
          Fasting — {activeFastElapsedLabel}
        </Link>
      ) : (
        <Link
          href="/fasting"
          aria-label="Start fast"
          data-testid="today-fasting-pill-idle"
          className="inline-flex flex-row items-center justify-center gap-2 py-2 px-4 rounded-full font-[family-name:var(--font-label)] font-semibold text-sm text-muted-foreground bg-card border border-border hover:bg-muted/40 transition-colors"
        >
          <Icons.timer className="w-4 h-4 shrink-0" aria-hidden />
          Start fast
        </Link>
      )}
    </div>
  );
}
