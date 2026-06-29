"use client";

import { useCallback, useState } from "react";

import { track } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import type { WeightSaveCelebrationResult } from "../../../lib/nutrition/weightWinMoment.ts";

/**
 * ENG-824 / ENG-952 — web weight-save celebration state + side-effects,
 * extracted from `ProgressDashboard` (composition-root pattern) to keep that
 * screen under its line budget.
 *
 * Web has no haptics, so the loud new-all-time-low landmark surfaces as the
 * reserved `WinMomentPlayer` (`weightWinActive`) plus a brief green colour pulse
 * on the latest-weight figure (`weightPulse`, ~200ms, suppressed under
 * prefers-reduced-motion). The quieter ENG-952 milestone tier mounts a smaller
 * inline player keyed by `milestoneWinOrdinal` (1–9) — no pulse, body-neutral.
 *
 * `fireCelebration` takes the already-resolved tier (see
 * `resolveWeightSaveCelebration`) and runs the matching side-effect + analytics.
 * Parity: mobile fires the equivalent tiers from its own callers.
 */
export function useWeightCelebration() {
  const [weightWinActive, setWeightWinActive] = useState(false);
  const [weightPulse, setWeightPulse] = useState(false);
  const [milestoneWinOrdinal, setMilestoneWinOrdinal] = useState<number | null>(null);

  const fireCelebration = useCallback((celebration: WeightSaveCelebrationResult) => {
    if (celebration.tier === "new-low") {
      setWeightWinActive(true);
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!prefersReducedMotion) {
        setWeightPulse(true);
        window.setTimeout(() => setWeightPulse(false), 200);
      }
      try {
        track(AnalyticsEvents.weight_new_low_win_moment_shown, { platform: "web" });
      } catch {
        /* analytics fire-and-forget */
      }
    } else if (celebration.tier === "milestone" && celebration.milestoneOrdinal != null) {
      setMilestoneWinOrdinal(celebration.milestoneOrdinal);
      try {
        track(AnalyticsEvents.weight_milestone_win_moment_shown, {
          platform: "web",
          milestone: celebration.milestoneOrdinal,
        });
      } catch {
        /* analytics fire-and-forget */
      }
    }
  }, []);

  return {
    weightWinActive,
    setWeightWinActive,
    weightPulse,
    milestoneWinOrdinal,
    setMilestoneWinOrdinal,
    fireCelebration,
  };
}
