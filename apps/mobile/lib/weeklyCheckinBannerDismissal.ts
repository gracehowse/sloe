/**
 * Per-week dismissal storage for the Today Sunday "Weekly Check-in
 * available" banner. Same fail-safe contract as other AsyncStorage
 * gates in mobile (`whatsNew.ts`, `lastWeekTdee.ts`): read errors
 * surface as "not dismissed" so the banner re-appears on a healed
 * launch; write errors are swallowed (worst case the banner shows
 * twice, which is preferable to silently hiding it forever).
 *
 * Spec: extended-competitor-audit task (2026-04-30, Step 3).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "weekly_checkin_banner_dismissed_v1";

type StorageLike = Pick<typeof AsyncStorage, "getItem" | "setItem">;

function buildKey(userId: string, weekKey: string): string {
  return `${STORAGE_PREFIX}:${userId}:${weekKey}`;
}

export async function isCheckinBannerDismissed(
  userId: string,
  weekKey: string,
  storage: StorageLike = AsyncStorage,
): Promise<boolean> {
  if (!userId || !weekKey) return false;
  try {
    const raw = await storage.getItem(buildKey(userId, weekKey));
    return raw === "1";
  } catch {
    return false;
  }
}

export async function markCheckinBannerDismissed(
  userId: string,
  weekKey: string,
  storage: StorageLike = AsyncStorage,
): Promise<void> {
  if (!userId || !weekKey) return;
  try {
    await storage.setItem(buildKey(userId, weekKey), "1");
  } catch {
    /* swallow */
  }
}
