import { useCallback, useState } from "react";

import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import type { WinMomentCelebration } from "@/components/ui/WinMomentPlayer";

/**
 * ENG-824 / ENG-952 — mobile weight-save celebration state + the `onSaved`
 * handler, extracted from `(tabs)/progress.tsx` (composition-root pattern) to
 * keep that screen under its line budget.
 *
 * The `LogWeightSheet` resolves the tier (via the shared
 * `resolveWeightSaveCelebration`) and fires the platform haptic; this hook owns
 * the overlay state the screen renders:
 *   - `weightWinCelebration` mounts the reserved full-bleed goal-hit player for
 *     a new all-time low (loud tier).
 *   - `milestoneWinOrdinal` (1–9) mounts the quieter `streak` player for a
 *     milestone crossing.
 * They never co-fire — the sheet returns exactly one of `isNewLow` /
 * `milestoneCrossed`, so `handleSaved` sets one state per save.
 *
 * Parity: web `useWeightCelebration` owns the equivalent state + `fireCelebration`.
 */
export function useWeightCelebration() {
  const [weightWinCelebration, setWeightWinCelebration] =
    useState<WinMomentCelebration | null>(null);
  const [milestoneWinOrdinal, setMilestoneWinOrdinal] = useState<number | null>(null);

  const handleSaved = useCallback(
    ({
      isNewLow,
      milestoneCrossed,
    }: {
      isNewLow: boolean;
      milestoneCrossed: number | null;
    }) => {
      // A new all-time low is the single weight landmark worth the reserved
      // LOUD celebration (`redesign_winmoment` collapsed permanently-on,
      // ENG-1651 — the sheet already fired the success haptic). Mount the
      // full-bleed celebration + emit the shown event.
      if (isNewLow) {
        setWeightWinCelebration("goal-hit");
        try {
          track(AnalyticsEvents.weight_new_low_win_moment_shown, { platform: "ios" });
        } catch {
          /* analytics fire-and-forget */
        }
      } else if (milestoneCrossed != null) {
        // ENG-952 — the QUIETER second tier: a milestone crossing. The sheet
        // fired the soft Light haptic + returns the crossed ordinal only when
        // `progress_milestone_celebration_v1` is on, so this stays inert when
        // the flag is off. Mounts the smaller `streak` player.
        setMilestoneWinOrdinal(milestoneCrossed);
        try {
          track(AnalyticsEvents.weight_milestone_win_moment_shown, {
            platform: "ios",
            milestone: milestoneCrossed,
          });
        } catch {
          /* analytics fire-and-forget */
        }
      }
    },
    [],
  );

  const clearWeightWin = useCallback(() => setWeightWinCelebration(null), []);
  const clearMilestone = useCallback(() => setMilestoneWinOrdinal(null), []);

  return {
    weightWinCelebration,
    milestoneWinOrdinal,
    handleSaved,
    clearWeightWin,
    clearMilestone,
  };
}
