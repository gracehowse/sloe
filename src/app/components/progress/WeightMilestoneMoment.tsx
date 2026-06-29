"use client";

import { WinMomentPlayer } from "../ui/win-moment-player.tsx";

/**
 * ENG-952 — the QUIETER milestone celebration tier (web overlay). Inline (not
 * full-bleed), smaller player; the `streak` variant + milestone numeral reads
 * as a restrained "milestone reached" beat, never the loud goal-hit overlay
 * reserved for a new all-time low. Renders top-right so it doesn't cover the
 * weight figure. Renders nothing when `ordinal` is null.
 *
 * Extracted from `ProgressDashboard` to keep that screen under its line budget.
 * Parity: mobile fires the equivalent quiet tier from `progress.tsx`.
 */
export function WeightMilestoneMoment({
  ordinal,
  onComplete,
}: {
  ordinal: number | null;
  onComplete: () => void;
}) {
  if (ordinal == null) return null;
  return (
    <div className="pointer-events-none absolute right-2 top-2 z-10">
      <WinMomentPlayer
        celebration="streak"
        milestone={ordinal}
        size={88}
        onComplete={onComplete}
        testID="progress-weight-milestone-moment"
      />
    </div>
  );
}
