"use client";

import { useEffect, useRef, useState } from "react";

import { AnalyticsEvents } from "../analytics/events.ts";
import { track } from "../analytics/track.ts";
import { didStreakReset } from "./streakReset.ts";

/**
 * useStreakResetCopy — fires `streak_reset` exactly once when the protected
 * streak transitions >=1 → 0 (L6 G8, seeded `null` so a zero-streak first
 * render never fires), and keeps the sticky "show the supportive reset-day
 * copy" flag (premium-bar audit DC8: "Every expert was once a beginner.
 * Start fresh today." under the day strip). The flag clears when the user
 * next renders a positive streak — at which point the streak pip surface
 * returns.
 *
 * Extracted from `NutritionTracker` (ENG-1504, mobile parity) — the mobile
 * twin of this logic lives in `useTodayStreakAndFreezes`.
 */
export function useStreakResetCopy(protectedStreakLength: number): boolean {
  const priorProtectedStreakRef = useRef<number | null>(null);
  const [streakJustReset, setStreakJustReset] = useState(false);
  useEffect(() => {
    const prior = priorProtectedStreakRef.current;
    priorProtectedStreakRef.current = protectedStreakLength;
    if (didStreakReset(prior, protectedStreakLength)) {
      try {
        track(AnalyticsEvents.streak_reset, {
          priorStreak: prior ?? 0,
        });
      } catch {
        /* analytics is fire-and-forget */
      }
      setStreakJustReset(true);
    } else if (protectedStreakLength > 0 && streakJustReset) {
      // Logged again and climbed off zero — clear the reset copy.
      setStreakJustReset(false);
    }
  }, [protectedStreakLength, streakJustReset]);
  return streakJustReset;
}
