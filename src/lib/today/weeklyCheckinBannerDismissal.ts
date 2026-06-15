/**
 * Per-week dismissal storage for the Today weekly check-in banner (web).
 * Mirror of `apps/mobile/lib/weeklyCheckinBannerDismissal.ts`.
 */

const STORAGE_PREFIX = "weekly_checkin_banner_dismissed_v1";

function buildKey(userId: string, weekKey: string): string {
  return `${STORAGE_PREFIX}:${userId}:${weekKey}`;
}

export function isCheckinBannerDismissed(userId: string, weekKey: string): boolean {
  if (!userId || !weekKey || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(buildKey(userId, weekKey)) === "1";
  } catch {
    return false;
  }
}

export function markCheckinBannerDismissed(userId: string, weekKey: string): void {
  if (!userId || !weekKey || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(buildKey(userId, weekKey), "1");
  } catch {
    /* swallow */
  }
}
