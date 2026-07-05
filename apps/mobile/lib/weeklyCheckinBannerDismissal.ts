/**
 * Per-week dismissal storage for the Today Sunday "Weekly Check-in
 * available" banner. Same fail-safe contract as other AsyncStorage
 * gates in mobile (`whatsNew.ts`, `lastWeekTdee.ts`): read errors
 * surface as "not dismissed" so the banner re-appears on a healed
 * launch; write errors are swallowed (worst case the banner shows
 * twice, which is preferable to silently hiding it forever).
 *
 * Key builder is shared with the web wrapper
 * (`src/lib/today/weeklyCheckinBannerDismissal.ts`, ENG-1358) so both
 * platforms key identically; the async/StorageLike public API here stays
 * mobile-only because AsyncStorage is inherently async (web's
 * `localStorage` is sync and its call sites don't await — see that file's
 * header comment for why the two public APIs can't be merged).
 *
 * Spec: extended-competitor-audit task (2026-04-30, Step 3).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildCheckinBannerDismissalKey } from "@suppr/shared/today/weeklyCheckinBannerDismissal";

type StorageLike = Pick<typeof AsyncStorage, "getItem" | "setItem">;

export async function isCheckinBannerDismissed(
  userId: string,
  weekKey: string,
  storage: StorageLike = AsyncStorage,
): Promise<boolean> {
  if (!userId || !weekKey) return false;
  try {
    const raw = await storage.getItem(buildCheckinBannerDismissalKey(userId, weekKey));
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
    await storage.setItem(buildCheckinBannerDismissalKey(userId, weekKey), "1");
  } catch {
    /* swallow */
  }
}
