/**
 * Web notifications — client-side permission + push subscription.
 *
 * Phase 1 (shipped): real browser `Notification.requestPermission()`
 * from the v2 Permissions step's "Allow" button.
 *
 * Phase 2 (this file): PushManager subscription wired to VAPID +
 * persisted to Supabase `web_push_subscriptions` so server-side code
 * can fan out pushes from the existing weekly-recap cron.
 *
 * Graceful degradation:
 *   - Missing `NEXT_PUBLIC_VAPID_PUBLIC_KEY` → subscribe returns
 *     `{ ok: false, reason: "vapid_unset" }`. The Allow button still
 *     marks the permission grant; the user just doesn't receive
 *     server-sent pushes yet.
 *   - SSR / unsupported browser → `subscribeToWebPush` returns
 *     `{ ok: false, reason: "unsupported" }`.
 *   - Service worker registration failure → surfaced as
 *     `{ ok: false, reason: "sw_failed" }` with the underlying error
 *     string.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

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

/* ------------------------------------------------------------------ */
/* Push subscription                                                   */
/* ------------------------------------------------------------------ */

/** VAPID keys are base64url-encoded 65-byte P-256 public keys. The
 *  browser's PushManager wants a Uint8Array. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    buf[i] = raw.charCodeAt(i);
  }
  return buf;
}

export type SubscribeResult =
  | { ok: true; endpoint: string }
  | {
      ok: false;
      reason:
        | "unsupported"
        | "permission_denied"
        | "vapid_unset"
        | "sw_failed"
        | "subscribe_failed"
        | "persist_failed";
      error?: string;
    };

/** True when the browser exposes the APIs we need for Web Push. */
export function isWebPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  if (typeof Notification === "undefined") return false;
  return true;
}

/**
 * Register the service worker at `/sw.js`. Idempotent — if the SW is
 * already registered the returned registration is reused.
 */
export async function ensureServiceWorkerRegistered(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/**
 * Full subscribe flow — call after the user explicitly grants the
 * notification permission. Persists the subscription to the Supabase
 * `web_push_subscriptions` table so server-side cron jobs can fan out
 * pushes (the client doesn't keep a separate copy).
 *
 * Returns a typed result so the calling UI can distinguish "worked",
 * "worked locally but persistence failed", and each failure reason
 * for analytics.
 */
export async function subscribeToWebPush(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscribeResult> {
  if (!isWebPushSupported()) {
    return { ok: false, reason: "unsupported" };
  }
  if (getWebNotificationPermission() !== "granted") {
    return { ok: false, reason: "permission_denied" };
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!vapidPublicKey) {
    return { ok: false, reason: "vapid_unset" };
  }

  const registration = await ensureServiceWorkerRegistered();
  if (!registration) {
    return { ok: false, reason: "sw_failed" };
  }

  let subscription: PushSubscription;
  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      subscription = existing;
    } else {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // TS 5.6+ tightened the `applicationServerKey` type to
        // `BufferSource | string` without `Uint8Array<ArrayBufferLike>`
        // in the union. The runtime contract accepts Uint8Array just
        // fine (it's the Web standard for this slot), so cast to
        // `BufferSource` to keep both the spec and the compiler happy.
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as unknown as BufferSource,
      });
    }
  } catch (e) {
    return {
      ok: false,
      reason: "subscribe_failed",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const payload = subscription.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
    return { ok: false, reason: "subscribe_failed", error: "missing_fields" };
  }

  // T21 (2026-04-24): use the SECURITY DEFINER `claim_web_push_subscription`
  // RPC instead of an upsert on (endpoint). The previous upsert path
  // failed when the endpoint was already held by a *different* user
  // (RLS blocked the UPDATE) — leaving the row owned by the prior
  // user, so the cron sent that user's recap body to the new user's
  // browser. The RPC atomically deletes any prior row for the
  // endpoint and inserts a fresh one for the caller. The unused
  // `userId` parameter is preserved for caller signatures; the RPC
  // derives ownership from `auth.uid()` server-side.
  try {
    const { error } = await supabase.rpc("claim_web_push_subscription", {
      p_endpoint: payload.endpoint,
      p_p256dh: payload.keys.p256dh,
      p_auth: payload.keys.auth,
      p_user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent : null,
    } as never);
    if (error) {
      // Legacy fallback (env without the migration). Keeps the
      // pre-T21 upsert path so a partial deployment doesn't leave
      // users with no subscription at all. Remove once the migration
      // has rolled to all environments.
      if ((error as { code?: string }).code === "42883") {
        const { error: legacyErr } = await supabase
          .from("web_push_subscriptions")
          .upsert(
            {
              user_id: userId,
              endpoint: payload.endpoint,
              p256dh: payload.keys.p256dh,
              auth: payload.keys.auth,
              user_agent:
                typeof navigator !== "undefined" ? navigator.userAgent : null,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "endpoint" },
          );
        if (legacyErr) {
          return {
            ok: false,
            reason: "persist_failed",
            error: legacyErr.message,
          };
        }
      } else {
        return {
          ok: false,
          reason: "persist_failed",
          error: error.message,
        };
      }
    }
  } catch (e) {
    return {
      ok: false,
      reason: "persist_failed",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return { ok: true, endpoint: payload.endpoint };
}

/** Unsubscribe the current browser from push and delete the Supabase
 *  row. Safe to call when no subscription exists. */
export async function unsubscribeFromWebPush(
  supabase: SupabaseClient,
): Promise<void> {
  if (!isWebPushSupported()) return;
  const registration = await ensureServiceWorkerRegistered();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  try {
    await subscription.unsubscribe();
  } catch {
    /* swallow — deleting the Supabase row is the critical side */
  }
  try {
    await supabase
      .from("web_push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);
  } catch {
    /* server-side cleanup also runs on push failure; non-fatal */
  }
}
