import { WinMomentPlayer, type WinMomentCelebration } from "@/components/ui/WinMomentPlayer";

/**
 * ENG-824 / ENG-952 — the two weight-save celebration overlays (mobile),
 * extracted from `(tabs)/progress.tsx` to keep that screen under its line
 * budget. Pairs with `useWeightCelebration`, which owns the state these props
 * come from.
 *
 *   - The reserved LOUD new-all-time-low mounts a full-bleed `goal-hit` player.
 *   - The QUIETER milestone crossing mounts a smaller `streak` player with the
 *     milestone numeral.
 *
 * They never co-fire (the sheet resolves exactly one tier per save), so at most
 * one renders at a time. Web parity: `WinMomentPlayer` (new-low) +
 * `WeightMilestoneMoment` (milestone) in `ProgressDashboard`.
 */
export function WeightCelebrationOverlays({
  weightWinCelebration,
  onWeightWinComplete,
  milestoneWinOrdinal,
  onMilestoneComplete,
}: {
  weightWinCelebration: WinMomentCelebration | null;
  onWeightWinComplete: () => void;
  milestoneWinOrdinal: number | null;
  onMilestoneComplete: () => void;
}) {
  return (
    <>
      {/* Reserved new-all-time-low overlay — full-bleed, pointerEvents none so
          it never blocks the Progress UI; plays once then unmounts. */}
      {weightWinCelebration ? (
        <WinMomentPlayer
          celebration={weightWinCelebration}
          fullBleed
          onComplete={onWeightWinComplete}
          testID="progress-weight-win-moment"
        />
      ) : null}
      {/* QUIETER milestone tier — smaller, NON-full-bleed streak player; never
          competes with the reserved goal-hit moment above. */}
      {milestoneWinOrdinal != null ? (
        <WinMomentPlayer
          celebration="streak"
          milestone={milestoneWinOrdinal}
          size={120}
          onComplete={onMilestoneComplete}
          testID="progress-weight-milestone-moment"
        />
      ) : null}
    </>
  );
}
