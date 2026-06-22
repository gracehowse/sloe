"use client";

import * as React from "react";
import { Scale } from "lucide-react";

/**
 * ProgressWeightEmptyState — new-user "No weigh-ins yet" state for the Progress
 * weight card (ENG-1225 gap #22), behind `web_progress_weight_empty`.
 *
 * Replaces the broken zero-data state (a "—" headline over an empty chart and a
 * "—/—/—/—" stat row) with a focused prompt. Faithful mirror of mobile's
 * `apps/mobile/components/progress/WeightSparseState.tsx` 0-point branch (Scale
 * glyph in tertiary ink, "No weigh-ins yet", "Log your first weight to start a
 * trend."). The card's existing Log-weight input + button stay below this, so
 * the CTA is in place. (The 1- and 2-weigh-in sparse states mobile also has are
 * a separate parity follow-up — web shows the chart only at ≥2 points.)
 */
export function ProgressWeightEmptyState({ className }: { className?: string }) {
  return (
    <div
      data-testid="progress-weight-empty"
      className={`flex flex-col items-center gap-2 py-6 text-center ${className ?? ""}`}
    >
      <Scale size={32} strokeWidth={1.5} className="text-muted-foreground" aria-hidden />
      <p className="text-[15px] font-semibold text-foreground">No weigh-ins yet</p>
      <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[260px]">
        Log your first weight to start a trend.
      </p>
    </div>
  );
}

export default ProgressWeightEmptyState;
