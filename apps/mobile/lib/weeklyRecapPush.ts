/**
 * Weekly recap push — mobile surface (reduced scope as of 2026-04-20).
 *
 * Historically this module scheduled a local `WEEKLY` notification at
 * the user's end-of-week 18:00 device-local time with a generic body.
 * That local-scheduled path was killed 2026-04-20 per the product-lead
 * decision at docs/decisions/2026-04-20-weekly-recap-mobile-local-killed.md —
 * we ship one good weekly push (server-cron content-specific body) or
 * nothing, never a generic placeholder. Installs without a synced
 * Expo push token receive no weekly push; token registration IS wired
 * (`registerExpoPushTokenForUser` / `refreshExpoPushTokenIfChanged` in
 * `apps/mobile/lib/expoPushToken.ts`, called from the Today tab, write
 * `profiles.expo_push_token`), so synced installs do receive it.
 *
 * What remains in this module:
 *   1. `cancelWeeklyRecapPush` — OS-level cancellation of any stale
 *      `weekly-recap-v1` schedule persisted from pre-kill installs.
 *      Called on app boot (`_layout.tsx`) for one-pass cleanup and on
 *      Settings-toggle-off for responsiveness.
 *   2. `handleWeeklyRecapNotificationResponse` — pure decision function
 *      used by the tap listener in `_layout.tsx` to decide whether a
 *      delivered notification is a weekly recap (server cron pushes
 *      carry `data.kind === "weekly_recap"`) and what `weekKey` to
 *      attribute the open to for analytics.
 */

import * as Notifications from "expo-notifications";

import { captureException } from "./errorTracking";

/** Identifier used by the pre-kill scheduler. Kept for cleanup only. */
const WEEKLY_RECAP_ID = "weekly-recap-v1";

/**
 * Cancel any previously-scheduled recap push. Safe to call when
 * nothing was ever scheduled — the native call no-ops. This is the
 * only OS-mutating call that remains; it exists so installs that had
 * the pre-kill local schedule queued do not keep firing a stale
 * generic notification after the kill ships.
 */
export async function cancelWeeklyRecapPush(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(WEEKLY_RECAP_ID);
  } catch (err) {
    captureException(err);
  }
}

/**
 * Sunday push rewrite — T5 (2026-04-19) — pure handler that decides
 * whether a `Notifications.NotificationResponse` corresponds to the
 * weekly-recap push and, if so, what `weekKey` to attribute the open
 * event to.
 *
 * Used by `apps/mobile/app/_layout.tsx` via the `HandleWeeklyRecapPushOpen`
 * component. The notifications it classifies are now exclusively the
 * server-cron pushes (mobile-local scheduling was removed 2026-04-20).
 *
 * Contract:
 *   - `shouldTrack` is `true` iff the response was delivered for a
 *     weekly-recap push (`data.kind === "weekly_recap"`).
 *   - `weekKey` is the recap's stable key when it was supplied in the
 *     data payload, otherwise `null`. Older devices that received
 *     pushes without the field fall through with `null`; analytics
 *     treats that as a legacy bucket rather than dropping the event.
 *
 * Tolerance:
 *   - Returns `{ shouldTrack: false, weekKey: null }` for any
 *     malformed input (missing `notification`, missing `request`,
 *     non-object `data`, etc.) instead of throwing — the listener must
 *     never crash a launch.
 */
export type WeeklyRecapResponseDecision = {
  shouldTrack: boolean;
  weekKey: string | null;
};

export function handleWeeklyRecapNotificationResponse(
  response: unknown,
): WeeklyRecapResponseDecision {
  const notification = (response as { notification?: unknown } | null | undefined)?.notification;
  const request = (notification as { request?: unknown } | null | undefined)?.request;
  const content = (request as { content?: unknown } | null | undefined)?.content;
  const data = (content as { data?: unknown } | null | undefined)?.data;
  if (!data || typeof data !== "object") {
    return { shouldTrack: false, weekKey: null };
  }
  const kind = (data as { kind?: unknown }).kind;
  if (kind !== "weekly_recap") {
    return { shouldTrack: false, weekKey: null };
  }
  const wk = (data as { weekKey?: unknown }).weekKey;
  const weekKey = typeof wk === "string" && wk.length > 0 ? wk : null;
  return { shouldTrack: true, weekKey };
}
