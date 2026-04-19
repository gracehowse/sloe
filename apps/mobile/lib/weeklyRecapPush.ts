/**
 * Weekly recap push scheduler (Batch 4.11).
 *
 * Schedules a local notification at the user's end-of-week (Sunday 18:00
 * for Monday-start users; Saturday 18:00 for Sunday-start users) so the
 * user is reliably nudged back to the app to open the recap card.
 *
 * Non-negotiables:
 *   - Respects `profiles.weekly_recap_push_enabled`. If opted-out, any
 *     previously-scheduled notification is cancelled.
 *   - Uses a stable identifier (`WEEKLY_RECAP_ID`) so we never stack
 *     duplicate pushes across app launches.
 *   - Recurs weekly via `DateTriggerInput` with `repeats: true`.
 *   - No network writes in this module — side-effects are limited to
 *     the OS notification store. Analytics is fired by the caller so we
 *     only log it once per successful (re-)schedule.
 *
 * Failure handling: all calls are guarded by try/catch so a permission
 * denial, missing native module, or OS scheduling quirk never crashes
 * the Progress screen. Errors are reported via `errorTracking.ts`.
 */

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { captureException } from "./errorTracking";
import { LAST_PUSH_TOKEN_CACHE_KEY } from "./expoPushToken";
import { nextRecapFireDate } from "./weeklyRecap";

/** Identifier reused on every reschedule so we only ever hold one entry. */
const WEEKLY_RECAP_ID = "weekly-recap-v1";

export type WeeklyRecapPushParams = {
  enabled: boolean;
  weekStartDay: "monday" | "sunday";
  now?: Date;
};

/**
 * Cancel any previously-scheduled recap push. Safe to call when nothing
 * was ever scheduled — the native call no-ops.
 */
export async function cancelWeeklyRecapPush(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(WEEKLY_RECAP_ID);
  } catch (err) {
    captureException(err);
  }
}

/**
 * Compute the next Sunday-18:00 (or Saturday-18:00 for Monday-start
 * users) in the device's local timezone. Thin wrapper over the shared
 * `nextRecapFireDate` helper — exposed for backwards compatibility and
 * for local testing.
 */
export function nextRecapDate(
  weekStartDay: "monday" | "sunday",
  now: Date = new Date(),
): Date {
  return nextRecapFireDate(weekStartDay, now);
}

/**
 * Re-schedule (or cancel) the weekly recap push based on the latest
 * user preference. Idempotent: calling this on every app launch is
 * fine — we always cancel the existing entry first.
 *
 * Returns the scheduled `Date` on success, or `null` when skipped
 * (opt-out, web, or native module unavailable). Callers use the
 * non-null return to fire the `weekly_recap_push_sent` analytics event.
 */
export async function scheduleWeeklyRecapPush(
  params: WeeklyRecapPushParams,
): Promise<Date | null> {
  if (Platform.OS === "web") return null;
  const { enabled, weekStartDay, now = new Date() } = params;

  // Always cancel the old entry first so a toggled-off user doesn't
  // keep receiving pushes from a stale schedule.
  await cancelWeeklyRecapPush();

  if (!enabled) return null;

  // Server delivery wins when present. If a synced Expo push token is
  // cached locally (written by `registerExpoPushTokenForUser`), the
  // server cron at `/api/push/weekly-recap` owns weekly-recap delivery
  // — scheduling a local notification here would produce two pings per
  // week on the same device. Skip the local path in that case. Users
  // without a token (permission denied, simulator, pre-upgrade installs)
  // continue to get the local fallback so we don't regress a working
  // flow while server delivery rolls out.
  try {
    const cachedToken = await AsyncStorage.getItem(LAST_PUSH_TOKEN_CACHE_KEY);
    if (typeof cachedToken === "string" && cachedToken.length > 0) {
      return null;
    }
  } catch {
    // AsyncStorage read failed — fall through and schedule the local
    // push. Worst case: temporary double-delivery until the next
    // successful storage read.
  }

  try {
    // Require permission. If not granted we simply skip — the user can
    // re-enable via OS settings later and the next app launch will
    // re-schedule.
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && !perm.canAskAgain) return null;
    if (!perm.granted) {
      const req = await Notifications.requestPermissionsAsync();
      if (!req.granted) return null;
    }

    const fireAt = nextRecapFireDate(weekStartDay, now);
    // Prefer `WEEKLY` so the notification self-heals across timezone
    // shifts and DST changes. weekday is 1=Sunday..7=Saturday per
    // expo-notifications; for Monday-start users we fire on Sunday (1),
    // for Sunday-start users on Saturday (7).
    const weekday = weekStartDay === "monday" ? 1 : 7;
    await Notifications.scheduleNotificationAsync({
      identifier: WEEKLY_RECAP_ID,
      content: {
        title: "Your week in Suppr",
        body: "Tap to see your weekly recap — avg calories, protein, streak, and weight trend.",
        // Deep-link handled by the notification-tap listener in the app
        // shell (opens `/progress`).
        data: { deepLink: "/progress", kind: "weekly_recap" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour: 18,
        minute: 0,
      },
    });
    return fireAt;
  } catch (err) {
    captureException(err);
    return null;
  }
}
