/**
 * useWinMoment — mobile win-moment orchestrator (ENG-798, Redesign — Design
 * Direction 2026).
 *
 * Owns the "fire exactly one reserved celebration at a landmark, at most once
 * per calendar day" contract for Today. The landmark MATH lives in the shared
 * `winMomentLandmark` module so web + mobile celebrate on identical
 * conditions; this hook adds the platform side-effects:
 *
 *   - **Once-per-day gate.** The last-fired calendar-day key is persisted to
 *     AsyncStorage (`win_moment_last_date`). A landmark crossed twice in one
 *     day (e.g. macro hit then calorie close) celebrates once; reopening Today
 *     never re-fires.
 *   - **Flag gate.** The whole reserved-celebration path is gated behind
 *     `redesign_winmoment`. Flag OFF → the hook is inert (returns no active
 *     celebration, fires no haptic), preserving today's static behaviour.
 *   - **Ordinary-log feedback.** A separate `confirmLog()` helper fires a
 *     quiet <100ms confirm haptic on EVERY ordinary log — distinct from the
 *     reserved win-moment. Gated behind `redesign_motion` so the confirm beat
 *     ramps with the motion vocabulary, not the win-moment.
 *
 * The caller (Today) feeds the current snapshot every render; the hook tracks
 * the previous snapshot itself and detects the rising edge. When a celebration
 * is active the caller mounts `<WinMomentPlayer celebration={...} />` and calls
 * `onCelebrationComplete()` when it finishes to unmount it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { track, isFeatureEnabled } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  detectWinMoment,
  type WinMomentCelebration,
  type WinMomentSnapshot,
} from "@suppr/shared/nutrition/winMomentLandmark";

const LAST_FIRED_KEY = "win_moment_last_date";

export interface UseWinMomentArgs {
  /** Live snapshot of today's calorie + macro + streak state. */
  snapshot: WinMomentSnapshot;
  /** `YYYY-MM-DD` key for the day currently shown on Today. The once-per-day
   *  gate keys off this so a landmark hit on a back-dated day doesn't consume
   *  today's celebration and vice-versa. */
  dayKey: string;
  /** Only run landmark detection while the user is viewing the live "today"
   *  surface — never celebrate scrubbing through history. */
  isToday: boolean;
  /** Gate the whole hook off until Today has hydrated, so the first snapshot
   *  (often a partial pre-load) is treated as the baseline, not a "log". */
  ready: boolean;
}

export interface UseWinMoment {
  /** The celebration to play right now, or `null` when nothing is firing. */
  activeCelebration: WinMomentCelebration | null;
  /** Streak milestone (3/7/30/100) when `activeCelebration === "streak"`. */
  activeMilestone: number | null;
  /** Call from the `WinMomentPlayer` `onComplete` to dismiss the overlay. */
  onCelebrationComplete: () => void;
  /** Fire the quiet confirm haptic for an ORDINARY log (not a win-moment).
   *  No-op when `redesign_motion` is off. Safe to call on every commit. */
  confirmLog: () => void;
}

export function useWinMoment({
  snapshot,
  dayKey,
  isToday,
  ready,
}: UseWinMomentArgs): UseWinMoment {
  const winEnabled = isFeatureEnabled("redesign_winmoment");
  const motionEnabled = isFeatureEnabled("redesign_motion");

  const [activeCelebration, setActiveCelebration] =
    useState<WinMomentCelebration | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);

  // Previous snapshot for rising-edge detection. Seeded on the first ready
  // render so the baseline state never counts as a "newly crossed" landmark.
  const prevRef = useRef<WinMomentSnapshot | null>(null);
  // Hydrated last-fired calendar-day key from AsyncStorage (null until read).
  const lastFiredDayRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  // Hydrate the once-per-day gate once.
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(LAST_FIRED_KEY).then((v) => {
      if (cancelled) return;
      lastFiredDayRef.current = v;
      hydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Inert unless the reserved-celebration flag is on AND we're on the live
    // today surface AND Today has hydrated AND the gate has been read.
    if (!winEnabled || !isToday || !ready || !hydratedRef.current) {
      // Keep the baseline fresh so flipping back to today doesn't fire on a
      // stale diff, but don't detect while inert.
      prevRef.current = snapshot;
      return;
    }

    const prev = prevRef.current;
    prevRef.current = snapshot;

    // First ready snapshot is the baseline, not a transition.
    if (prev === null) return;

    // Already celebrated today — respect the once-per-day reservation.
    if (lastFiredDayRef.current === dayKey) return;

    const result = detectWinMoment(prev, snapshot);
    if (!result) return;

    // Mark the day as celebrated BEFORE the async write so a rapid second
    // log in the same frame can't double-fire.
    lastFiredDayRef.current = dayKey;
    void AsyncStorage.setItem(LAST_FIRED_KEY, dayKey);

    setActiveCelebration(result.celebration);
    setActiveMilestone(result.milestone ?? null);
    // SPEC 1 (2026-06-09) sequenced win beat: Medium impact, then the
    // Success notification 80ms later — a tap-then-bloom that reads as a
    // deliberate celebration instead of a single buzz.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 80);

    try {
      track(AnalyticsEvents.day_target_hit_win_moment_shown, {
        kind: result.kind,
        ...(result.milestone != null ? { milestone: result.milestone } : {}),
        platform: "ios",
      });
    } catch {
      /* analytics fire-and-forget */
    }
  }, [winEnabled, isToday, ready, dayKey, snapshot]);

  const onCelebrationComplete = useCallback(() => {
    setActiveCelebration(null);
    setActiveMilestone(null);
  }, []);

  const confirmLog = useCallback(() => {
    if (!motionEnabled) return;
    // Quiet <100ms confirm — a Light impact, NOT the loud success
    // notification reserved for the win-moment.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [motionEnabled]);

  return { activeCelebration, activeMilestone, onCelebrationComplete, confirmLog };
}
