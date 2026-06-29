"use client";

import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import type { PlateauInsight } from "../../../lib/progress/weightTrend.ts";

/**
 * ENG-954 — calm, de-shaming plateau insight (web). When the recent stretch is
 * flat but the longer trend is still toward goal, reframe the stall as normal
 * physiology instead of leaving the terse trend verdict to read as "no
 * progress". Body-neutral, no health-claim. Gated behind
 * `progress_plateau_insight_v1`; renders nothing when off or when there is no
 * plateau read. Parity: mobile `progress.tsx` renders the identical line.
 *
 * Extracted from `ProgressDashboard` to keep that screen under its line budget.
 */
export function WeightPlateauInsight({
  plateauInsight,
}: {
  plateauInsight: PlateauInsight | null;
}) {
  if (!isFeatureEnabled("progress_plateau_insight_v1") || !plateauInsight) {
    return null;
  }
  return (
    <p
      data-testid="progress-plateau-insight"
      className="mt-2.5 rounded-lg bg-muted/50 px-3 py-2 text-[13px] leading-snug text-muted-foreground"
    >
      {plateauInsight.line}
    </p>
  );
}
