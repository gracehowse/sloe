/**
 * weeklyRecapEmptyCopy — history-aware copy for the weekly-recap empty
 * state + the TDEE check-in cold-start line.
 *
 * Authority: ENG-1019 "hasHistory disease" pattern (third instance —
 * ENG-1020 item 2). The weekly-recap surface counts the CURRENT WEEK,
 * but its empty + first-week copy was written as if the account were
 * brand new: "Your streak starts here … come back after your first
 * meal" and "Your check-in starts after 7 days of data." For a
 * returning user whose journal already holds weeks of data — but who
 * hasn't logged in THIS recap week yet — that copy reads as the screen
 * contradicting itself (same failure mode `progressStoryGate.ts`'s
 * `hasHistory` branch fixed on the Progress story card).
 *
 * This module owns the copy matrix so web (`<Digest>`) and mobile
 * (`weekly-recap.tsx`) render identical strings — pure, no React, no
 * I/O. The host derives `hasHistory` from data it already loaded (the
 * 90-day journal window) and passes it in; this module never fetches.
 *
 * The honesty rule:
 *   - True cold start (journal empty everywhere) → "starts here"
 *     copy that promises the FIRST insight.
 *   - Returning user, nothing logged THIS week → week-scoped copy
 *     that says this week's recap builds as they log, never implying
 *     they are starting from nothing.
 *
 * Mobile re-exports from `apps/mobile/lib/weeklyRecapEmptyCopy.ts`.
 */

export interface WeeklyRecapEmptyCopyOpts {
  /**
   * Whether the account has ANY logged history outside the current
   * recap week (derived from the journal window the screen already
   * loaded). The recap counts the CURRENT WEEK; a user with weeks of
   * data must not be greeted with cold-start copy.
   */
  hasHistory?: boolean;
}

export interface WeeklyRecapEmptyCopy {
  /** Headline above the empty-state icon. */
  headline: string;
  /** Supporting body line. */
  body: string;
}

/**
 * Resolve the empty-state headline + body for the weekly-recap screen.
 *
 * - `hasHistory: false` (default) → true cold-start copy.
 * - `hasHistory: true` → week-scoped copy for a returning user whose
 *   current week is still empty.
 */
export function buildWeeklyRecapEmptyCopy(
  opts?: WeeklyRecapEmptyCopyOpts,
): WeeklyRecapEmptyCopy {
  const hasHistory = opts?.hasHistory === true;
  if (hasHistory) {
    return {
      headline: "Nothing logged this week yet",
      body: "This week's recap builds as you log. A streak counts every day with at least one meal — log today to keep yours going.",
    };
  }
  return {
    headline: "Your streak starts here.",
    body: "A streak begins when you log on two different days in the same week. There's nothing to recap yet — come back after your first meal.",
  };
}

/**
 * The shared cold-start headline for the weekly TDEE check-in. Lives
 * here (not inline in `buildWeeklyCheckin`) so both surfaces resolve
 * the same string and the history-aware override can be applied
 * consistently.
 *
 * `buildWeeklyCheckin` returns `kind: "first_week"` whenever the
 * previous-week TDEE snapshot is missing — which also happens on a
 * returning user's FIRST visit this week (no AsyncStorage snapshot for
 * last week yet), even against a month of confident data. That copy
 * must not claim a cold start when the account clearly has history.
 */
export const CHECKIN_FIRST_WEEK_COLD_START =
  "Your check-in starts after 7 days of data.";

/**
 * History-aware headline for the check-in `first_week` state. When the
 * account has history but THIS week's delta isn't computable yet
 * (no prior-week snapshot), say so in week-scoped terms instead of
 * claiming a 7-day cold start.
 *
 * Returns `null` when no override is needed (true cold start) — the
 * caller keeps the engine's `first_week` headline as-is.
 */
export function resolveCheckinFirstWeekHeadline(
  opts?: WeeklyRecapEmptyCopyOpts,
): string | null {
  const hasHistory = opts?.hasHistory === true;
  if (hasHistory) {
    return "Your check-in updates as you log this week.";
  }
  return null;
}
