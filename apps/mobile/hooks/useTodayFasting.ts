import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { AccessibilityInfo } from "react-native";

import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";

type FastingSession = { start: string; end: string | null };

type UseTodayFastingParams = {
  userId: string | undefined;
};

export type UseTodayFastingResult = {
  activeFastStart: string | null;
  /** Target fast length in hours, parsed from `profiles.fasting_window`
   *  (stored as "16:8" style). Defaults to 16 until the profile loads.
   *  Used by the widget snapshot so the iOS widget shows the correct ring. */
  fastTargetHours: number;
  /** F-109 — gates the idle "Start fast" pill on the user having opted
   *  in to intermittent fasting. Proxy signal is
   *  `profiles.fasting_window != null`. Hydrated by `loadProfileTargets`
   *  via `setFastingOptedIn` below; not currently read by any render
   *  site in TodayScreen (see the hook doc comment). */
  fastingOptedIn: boolean;
  /** Minute-cadence re-render tick while a fast is active, so the
   *  elapsed-time label in `<TodayFastingPill>` keeps counting up. */
  fastingTick: number;
  /** Raw setters — `loadProfileTargets` (the single-round-trip profile
   *  loader that hydrates ~20 unrelated `profiles` fields in
   *  TodayScreen) hydrates these three directly, matching the
   *  `useTodayWeeklyCheckin` / `setWeeklyCheckinShownAt` precedent.
   *  Every other write goes through `startFastFromShortcut` below. */
  setActiveFastStart: Dispatch<SetStateAction<string | null>>;
  setFastTargetHours: Dispatch<SetStateAction<number>>;
  setFastingOptedIn: Dispatch<SetStateAction<boolean>>;
  /** Batch 5.12 — start a fast from a deep link (Siri / Shortcuts app).
   *  No-ops when a fast is already active; uses the existing
   *  `profiles.fasting_sessions` shape so the fasting screen agrees. */
  startFastFromShortcut: (hours: number) => Promise<void>;
};

/**
 * ENG-1626 (Today extract, slice 2) — fasting state cluster feeding
 * `<TodayFastingPill>`. Gating + content build for the weekly check-in
 * ritual live in a sibling hook (`useTodayWeeklyCheckin`, slice 1); this
 * one owns the analogous concern for the fasting pill: 4 pieces of state,
 * one self-contained ticking effect, and the one non-profile-load
 * mutation path (the Siri/Shortcuts deep-link starter).
 *
 * ## Why a hook
 *
 * Same shape as slice 1's rationale: a self-contained concern (4 useState
 * + 1 effect + 1 callback) consumed by exactly one render site
 * (`<TodayFastingPill>` in TodayScreen, plus a read-only gate on the hero
 * coach line and a pass-through into `useTodayWidgetSnapshot`).
 * Extracting it removes the state + the ticking effect + the shortcut
 * handler from the Today parent without touching any external input.
 *
 * ## What stays in TodayScreen
 *
 * `loadProfileTargets` still calls `setActiveFastStart` /
 * `setFastTargetHours` / `setFastingOptedIn` directly via the exposed
 * setters (pulling that loader apart is a separate, larger effort — same
 * call as slice 1). `useTodayWidgetSnapshot` still reads `activeFastStart`
 * / `fastTargetHours` as plain params passed through from this hook's
 * return value. The `<TodayFastingPill>` JSX itself also stays in
 * TodayScreen (this hook returns data + callbacks only, consistent with
 * every other extracted Today hook). The Siri/Shortcuts deep-link flush
 * effect (`_layout.tsx`-enqueued pending action) stays in TodayScreen too
 * — it also awaits `addWaterMl` from `useTodayHydrationStimulants` in the
 * same effect, so only `startFastFromShortcut` itself moved here; the
 * effect that calls it did not.
 *
 * ## Known pre-existing gap (not fixed here — zero-behavior-change mandate)
 *
 * `fastingOptedIn` is hydrated on every profile load but has no read
 * site anywhere in TodayScreen today (confirmed via repo-wide grep before
 * this extraction) — the F-109 "hide the pill entirely for non-IF users"
 * gate described in `todayFastingPillIdle.test.tsx`'s file comment is not
 * currently wired to it. Moved verbatim, unread, exactly as it was before
 * this extraction; flagging per the no-silent-deferral rule rather than
 * fixing inline, matching how slice 1 handled the analogous
 * `weeklyCheckinOpen` finding.
 *
 * ## Failure modes
 *
 * - `userId` not yet resolved when `startFastFromShortcut` fires → no-ops
 *   rather than writing an unscoped profile row (matches
 *   pre-extraction behaviour exactly).
 * - The minute-tick interval only runs while `activeFastStart` is set,
 *   and is torn down on unmount / when the fast clears — same cadence as
 *   before extraction.
 */
export function useTodayFasting({ userId }: UseTodayFastingParams): UseTodayFastingResult {
  const [activeFastStart, setActiveFastStart] = useState<string | null>(null);
  const [fastTargetHours, setFastTargetHours] = useState<number>(16);
  const [fastingOptedIn, setFastingOptedIn] = useState<boolean>(false);
  const [fastingTick, setFastingTick] = useState(Date.now());

  useEffect(() => {
    if (!activeFastStart) return;
    const id = setInterval(() => setFastingTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [activeFastStart]);

  const startFastFromShortcut = useCallback(
    async (hours: number) => {
      if (!userId) return;
      const { data } = await supabase
        .from("profiles")
        .select("fasting_sessions")
        .eq("id", userId)
        .maybeSingle();
      const existing: FastingSession[] = Array.isArray(data?.fasting_sessions)
        ? (data.fasting_sessions as FastingSession[])
        : [];
      if (existing.some((s) => s.end === null)) {
        // Already fasting — do not stack sessions. `_layout.tsx`'s Siri
        // deep-link handler can't know this ahead of time (it fires
        // before this DB check resolves), so the VoiceOver announcement
        // for the shortcut lives here, where the real outcome is known —
        // never the optimistic "Starting a fast" copy on a no-op
        // (ENG-1606).
        AccessibilityInfo.announceForAccessibility("You're already fasting");
        return;
      }
      const startIso = new Date().toISOString();
      const next = [...existing, { start: startIso, end: null }].slice(-90);
      await supabase.from("profiles").update({ fasting_sessions: next }).eq("id", userId);
      setActiveFastStart(startIso);
      AccessibilityInfo.announceForAccessibility(`Starting a ${hours} hour fast`);
      // `hours` currently only informs the widget snapshot — the fasting
      // screen reads the window from `profiles.fasting_window`. When
      // users invoke `suppr://fast/start?hours=N` with a non-default N we
      // log it so analytics reflects actual use.
      track(AnalyticsEvents.siri_action_invoked, { kind: "start_fast", hours });
    },
    [userId],
  );

  return {
    activeFastStart,
    fastTargetHours,
    fastingOptedIn,
    fastingTick,
    setActiveFastStart,
    setFastTargetHours,
    setFastingOptedIn,
    startFastFromShortcut,
  };
}
