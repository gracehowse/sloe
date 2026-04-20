/**
 * Web notifications — client-side permission helper.
 *
 * Scope (Phase 1, Grace 2026-04-20): make the v2 Permissions step's
 * "Allow" button actually request `Notification.requestPermission()`
 * and surface the real grant. That unblocks the local-only
 * notification API (`new Notification(...)` triggered by our own
 * client code — useful for in-tab nudges) and captures the signal
 * we'll need later when server-initiated Web Push (VAPID + service
 * worker + cron fan-out) ships.
 *
 * NOT in scope here:
 *  - PushManager subscription (requires VAPID public key env var +
 *    service worker registration).
 *  - Server-side web-push send (requires `web-push` library + VAPID
 *    private key secret + wiring into existing weekly-recap cron).
 *  - Persistence of the grant to Supabase — we record analytics and
 *    let the onboarding state carry the flag; a future follow-up can
 *    add a `web_notif_granted_at` column on `profiles` if needed.
 */

export type WebNotificationPermission =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

/** Read the current permission without prompting. `"unsupported"` when
 *  the browser doesn't expose the Notification API at all (older
 *  Safari on iOS pre-16.4, server-side render, etc.). */
export function getWebNotificationPermission(): WebNotificationPermission {
  if (typeof window === "undefined") return "unsupported";
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as Exclude<
    WebNotificationPermission,
    "unsupported"
  >;
}

/** True if the browser supports the Notification API at all. */
export function isWebNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" && typeof Notification !== "undefined"
  );
}

/**
 * Prompt the user for notification permission. Returns the post-prompt
 * permission state. Safe to call from any React event handler.
 *
 * Behaviour by current state:
 *   - `unsupported` → returns `"unsupported"` without side effects.
 *   - `granted` → returns `"granted"` without re-prompting.
 *   - `denied`  → returns `"denied"` without re-prompting. Browsers
 *                 won't show the prompt again once denied; the user
 *                 has to flip it back via site settings. We surface
 *                 this state so the UI can show a "blocked in
 *                 browser settings" hint.
 *   - `default` → actually shows the OS prompt; resolves to the
 *                 user's choice.
 */
export async function requestWebNotificationPermission(): Promise<WebNotificationPermission> {
  if (!isWebNotificationSupported()) return "unsupported";
  const current = getWebNotificationPermission();
  if (current === "granted" || current === "denied") return current;
  try {
    const result = await Notification.requestPermission();
    return result as Exclude<WebNotificationPermission, "unsupported">;
  } catch {
    // Safari historically throws on some reload cycles — treat as denied
    // so the UI can recover rather than get stuck in "working…".
    return "denied";
  }
}
