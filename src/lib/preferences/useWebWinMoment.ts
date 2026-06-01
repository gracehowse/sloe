"use client";

/**
 * useWebWinMoment — web mirror of mobile `use-win-moment` (ENG-798, Redesign —
 * Design Direction 2026).
 *
 * Same landmark contract as mobile (shared `winMomentLandmark` math), same
 * once-per-calendar-day reservation, same `redesign_winmoment` flag gate. The
 * web analog has NO haptics — it surfaces a `pulse` boolean the caller maps to
 * a green ring-stroke colour pulse, plus the active celebration the caller
 * mounts `<WinMomentPlayer />` for. Persistence uses `localStorage`
 * (`win_moment_last_date`) instead of AsyncStorage.
 *
 * Reduced-motion users get no pulse (the caller checks the same
 * `prefers-reduced-motion` query the odometer hook honours); the
 * `WinMomentPlayer` itself plays-once and is the loud beat.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { track, isFeatureEnabled } from "../analytics/track";
import { AnalyticsEvents } from "../analytics/events";
import {
  detectWinMoment,
  type WinMomentCelebration,
  type WinMomentSnapshot,
} from "../nutrition/winMomentLandmark";

const LAST_FIRED_KEY = "win_moment_last_date";
/** How long the green ring-stroke colour pulse lasts (ms). */
export const WEB_WIN_PULSE_MS = 200;

function readLastFired(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_FIRED_KEY);
  } catch {
    return null;
  }
}

function writeLastFired(dayKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_FIRED_KEY, dayKey);
  } catch {
    /* private mode / quota — gate degrades to fire-once-per-session */
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface UseWebWinMomentArgs {
  snapshot: WinMomentSnapshot;
  /** `YYYY-MM-DD` for the day shown on Today (the once-per-day gate key). */
  dayKey: string;
  /** Only detect while viewing the live today surface. */
  isToday: boolean;
  /** Gate off until Today has hydrated, so the baseline isn't a "log". */
  ready: boolean;
}

export interface UseWebWinMoment {
  /** Celebration to play now, or `null`. */
  activeCelebration: WinMomentCelebration | null;
  /** Call from `WinMomentPlayer` `onComplete` to dismiss the overlay. */
  onCelebrationComplete: () => void;
  /** `true` for ~200ms after a landmark fires — drives the ring colour pulse. */
  pulse: boolean;
}

export function useWebWinMoment({
  snapshot,
  dayKey,
  isToday,
  ready,
}: UseWebWinMomentArgs): UseWebWinMoment {
  const winEnabled = isFeatureEnabled("redesign_winmoment");

  const [activeCelebration, setActiveCelebration] =
    useState<WinMomentCelebration | null>(null);
  const [pulse, setPulse] = useState(false);

  const prevRef = useRef<WinMomentSnapshot | null>(null);
  const lastFiredDayRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  // Hydrate the once-per-day gate once on mount.
  useEffect(() => {
    lastFiredDayRef.current = readLastFired();
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!winEnabled || !isToday || !ready || !hydratedRef.current) {
      prevRef.current = snapshot;
      return;
    }

    const prev = prevRef.current;
    prevRef.current = snapshot;
    if (prev === null) return;
    if (lastFiredDayRef.current === dayKey) return;

    const result = detectWinMoment(prev, snapshot);
    if (!result) return;

    lastFiredDayRef.current = dayKey;
    writeLastFired(dayKey);

    setActiveCelebration(result.celebration);
    if (!prefersReducedMotion()) {
      setPulse(true);
      window.setTimeout(() => setPulse(false), WEB_WIN_PULSE_MS);
    }

    try {
      track(AnalyticsEvents.day_target_hit_win_moment_shown, {
        kind: result.kind,
        ...(result.milestone != null ? { milestone: result.milestone } : {}),
        platform: "web",
      });
    } catch {
      /* analytics fire-and-forget */
    }
  }, [winEnabled, isToday, ready, dayKey, snapshot]);

  const onCelebrationComplete = useCallback(() => {
    setActiveCelebration(null);
  }, []);

  return { activeCelebration, onCelebrationComplete, pulse };
}
