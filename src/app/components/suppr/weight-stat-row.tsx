"use client";

import * as React from "react";

/**
 * WeightStatRow — the START / CURRENT / GOAL / RATE four-up under the Progress
 * weight chart. Extracted from `ProgressDashboard` (ENG-1225 #22) so adding the
 * new-user empty state doesn't grow that pinned host. Values are pre-formatted
 * by the caller ("—" when absent).
 */
export function WeightStatRow({
  start,
  current,
  goal,
  rate,
}: {
  start: string;
  current: string;
  goal: string;
  rate: string;
}) {
  return (
    <div className="mt-3 grid grid-cols-4 gap-1 border-t border-border pt-3">
      {(
        [
          ["Start", start],
          ["Current", current],
          ["Goal", goal],
          ["Rate", rate],
        ] as const
      ).map(([label, value]) => (
        <div key={label} className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums text-foreground ph-mask">{value}</p>
        </div>
      ))}
    </div>
  );
}

export default WeightStatRow;
