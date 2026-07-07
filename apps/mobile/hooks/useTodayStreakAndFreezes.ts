import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { computeLoggingStreak } from "@/lib/trackerStats";
import { availableFreezes, computeProtectedStreak, type FreezeLedger } from "@/lib/streakFreeze";
import { didStreakReset } from "@suppr/nutrition-core/streakReset";
import type { ByDay } from "@/lib/nutritionJournal";

type UseTodayStreakAndFreezesParams = {
  byDay: ByDay;
  freezeLedger: FreezeLedger;
  freezeBudgetMax: number;
};

export type UseTodayStreakAndFreezesResult = {
  /** Raw (unprotected) logging streak — kept for parity with the
   *  pre-extraction computation; the day-strip/insight-card UI reads
   *  `protectedStreakLength` instead (freeze-aware). */
  streakDays: number;
  freezesAvailableToday: number;
  protectedStreakInfo: ReturnType<typeof computeProtectedStreak>;
  protectedDateKeys: Set<string>;
  protectedStreakLength: number;
  /** True right after the protected streak drops from >=1 to 0 this
   *  render cycle — drives the calm "reset" copy in the date header
   *  until the user logs again and climbs off zero. */
  streakJustReset: boolean;
  hasUnseenFreezeEarned: boolean;
  dismissFreezeEarned: () => Promise<void>;
};

/**
 * ENG-1361 — Today extract (round 2, real domain hook). Owns the
 * logging-streak + freeze-ledger derivations, the "streak just reset"
 * date-header copy state, and the one-time "you earned a freeze"
 * acknowledgment flow.
 *
 * ## Why a hook
 *
 * All five pieces (`protectedStreakInfo`, `streakJustReset`,
 * `newestFreezeEarnedAt`, `lastSeenFreezeEarnedAt`,
 * `dismissFreezeEarned`) exist purely to answer two questions the Today
 * UI asks — "what's the current protected streak, and did it just
 * reset?" / "is there an unseen freeze-earned row to show?" — and take
 * only `byDay` + the freeze ledger as external inputs. No other Today
 * state depends on their internals, only on the four values re-exported
 * here (`protectedStreakLength`, `protectedDateKeys`, `streakJustReset`,
 * `hasUnseenFreezeEarned` + its dismiss action).
 *
 * ## What stays in TodayScreen
 *
 * `freezeLedger` / `freezeBudgetMax` themselves stay owned by
 * `loadProfileTargets` (the single-round-trip profile loader) and are
 * passed in read-only — pulling that loader apart is out of scope for
 * this pass (ENG-1361 step 2: group state first).
 *
 * ## Failure modes
 *
 * - `freezeLedger.earnedAt` malformed/empty → `newestFreezeEarnedAt`
 *   stays `null`, `hasUnseenFreezeEarned` stays `false` (safe default,
 *   no row shown).
 * - AsyncStorage unavailable when reading/writing the "last seen" key →
 *   silently no-ops (matches the pre-extraction behaviour) rather than
 *   crashing the streak insight card.
 */
export function useTodayStreakAndFreezes({
  byDay,
  freezeLedger,
  freezeBudgetMax,
}: UseTodayStreakAndFreezesParams): UseTodayStreakAndFreezesResult {
  const streakDays = useMemo(
    () => computeLoggingStreak(byDay as any),
    [byDay],
  );
  // Batch 4.11 — freeze sub-label on the streak insight card.
  const freezesAvailableToday = useMemo(
    () => availableFreezes(freezeLedger, freezeBudgetMax),
    [freezeLedger, freezeBudgetMax],
  );
  // 2026-04-18 audit H7 — DayStrip tiles for days where a freeze was
  // consumed render a ❄ glyph. Parent computes once so both DayStrips
  // (day + week view) render identically.
  //
  // L6 G8 (2026-04-18) — the memo also exposes `streakLength` so the
  // `streak_reset` effect below can detect >=1 → 0 transitions.
  const protectedStreakInfo = useMemo(() => {
    return computeProtectedStreak(byDay as never, freezeLedger, freezeBudgetMax);
  }, [byDay, freezeLedger, freezeBudgetMax]);
  const protectedDateKeys = useMemo(
    () => new Set(protectedStreakInfo.protectedDateKeys),
    [protectedStreakInfo],
  );
  const protectedStreakLength = protectedStreakInfo.streakLength;

  // L6 G8 (2026-04-18) — fire `streak_reset` once when the protected streak
  // goes >=1 → 0. Ref starts `null` so a zero-streak first render never fires.
  const priorProtectedStreakRef = useRef<number | null>(null);
  // Premium-bar audit DC8 polish (2026-05-14) — when the streak just
  // reset, show a calm supportive line in the date-header row
  // (Duolingo-style "Every expert was once a beginner"). Sticky
  // until the user next renders a positive streak — at which point
  // the StreakPip takes over again. Independent of analytics fire.
  const [streakJustReset, setStreakJustReset] = useState(false);
  useEffect(() => {
    const prior = priorProtectedStreakRef.current;
    priorProtectedStreakRef.current = protectedStreakLength;
    if (didStreakReset(prior, protectedStreakLength)) {
      try {
        track(AnalyticsEvents.streak_reset, {
          priorStreak: prior ?? 0,
        });
      } catch { /* analytics fire-and-forget */ }
      setStreakJustReset(true);
    } else if (protectedStreakLength > 0 && streakJustReset) {
      // User logged again and climbed off zero — clear the reset
      // copy so the pip surface returns.
      setStreakJustReset(false);
    }
  }, [protectedStreakLength, streakJustReset]);

  // 2026-04-18 audit H7 — one-time "You earned a freeze" row under the
  // streak insight card. Newest `earnedAt` ISO from the ledger; the row
  // shows until the user taps "Got it", which writes that ISO to
  // AsyncStorage. No shame copy, no modal takeover.
  const newestFreezeEarnedAt = useMemo(() => {
    if (!Array.isArray(freezeLedger.earnedAt) || freezeLedger.earnedAt.length === 0) return null;
    let newest = "";
    for (const entry of freezeLedger.earnedAt) {
      if (typeof entry?.earnedAt === "string" && entry.earnedAt > newest) newest = entry.earnedAt;
    }
    return newest || null;
  }, [freezeLedger]);
  const [lastSeenFreezeEarnedAt, setLastSeenFreezeEarnedAt] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const v = await AsyncStorage.getItem("suppr-last-seen-freeze-earned-at");
        if (!cancelled) setLastSeenFreezeEarnedAt(v);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const hasUnseenFreezeEarned =
    freezesAvailableToday > 0 &&
    newestFreezeEarnedAt !== null &&
    (lastSeenFreezeEarnedAt === null || newestFreezeEarnedAt > lastSeenFreezeEarnedAt);
  const dismissFreezeEarned = useCallback(async () => {
    if (!newestFreezeEarnedAt) return;
    setLastSeenFreezeEarnedAt(newestFreezeEarnedAt);
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem("suppr-last-seen-freeze-earned-at", newestFreezeEarnedAt);
    } catch { /* noop */ }
    try {
      // Dual-emit during rename cycle 2026-04-18 → 2026-05-18. See plan doc §4.
      const seenPayload = { earnedAt: newestFreezeEarnedAt };
      track(AnalyticsEvents.streak_freeze_earned_seen, seenPayload);
      track(AnalyticsEvents.streak_freeze_earned_acknowledged, seenPayload);
    } catch { /* noop */ }
  }, [newestFreezeEarnedAt]);

  return {
    streakDays,
    freezesAvailableToday,
    protectedStreakInfo,
    protectedDateKeys,
    protectedStreakLength,
    streakJustReset,
    hasUnseenFreezeEarned,
    dismissFreezeEarned,
  };
}
