/**
 * Per-week dismissal storage for the Today "Weekly Check-in available" banner
 * (web). Same fail-safe contract as mobile's `apps/mobile/lib/weeklyCheckinBannerDismissal.ts`
 * (ENG-1358 — was a byte-identical hand-mirrored copy, now sharing the key
 * builder from this canonical module): read errors surface as "not
 * dismissed" so the banner re-appears on a healed launch; write errors are
 * swallowed (worst case the banner shows twice, which is preferable to
 * silently hiding it forever).
 *
 * This module's public functions stay **synchronous** on purpose —
 * `window.localStorage` is sync, and `NutritionTracker.tsx` calls
 * `isCheckinBannerDismissed` / `markCheckinBannerDismissed` without `await`.
 * Making the public API async here would silently turn a `boolean` return
 * into an un-awaited `Promise<boolean>` at those call sites. Mobile's
 * AsyncStorage is inherently async, so its wrapper stays async and re-exports
 * the same key builder — see that file for the parallel contract.
 *
 * Spec: extended-competitor-audit task (2026-04-30, Step 3).
 */

const STORAGE_PREFIX = "weekly_checkin_banner_dismissed_v1";

/** Build the per-(user, week) storage key. Shared so both platforms key identically. */
export function buildCheckinBannerDismissalKey(userId: string, weekKey: string): string {
  return `${STORAGE_PREFIX}:${userId}:${weekKey}`;
}

export function isCheckinBannerDismissed(userId: string, weekKey: string): boolean {
  if (!userId || !weekKey || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(buildCheckinBannerDismissalKey(userId, weekKey)) === "1";
  } catch {
    return false;
  }
}

export function markCheckinBannerDismissed(userId: string, weekKey: string): void {
  if (!userId || !weekKey || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(buildCheckinBannerDismissalKey(userId, weekKey), "1");
  } catch {
    /* swallow */
  }
}
