/**
 * Server-side Web Push sender.
 *
 * Mirrors the contract of `src/lib/push/expoPush.ts` (mobile) but
 * talks the Web Push Protocol via the `web-push` library. Used by
 * the weekly-recap cron to fan pushes out to browsers subscribed
 * via `src/lib/push/webNotifications.ts` → `web_push_subscriptions`.
 *
 * VAPID config comes from three env vars:
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY (client-visible)
 *   - VAPID_PRIVATE_KEY (server-only)
 *   - VAPID_SUBJECT (mailto: or https: URL identifying the sender)
 *
 * The module imports `web-push` lazily inside the function so it
 * doesn't force a load on routes that never push. If any of the three
 * env vars is missing, `sendWebPush` returns `{ ok: false, reason:
 * "vapid_unset" }` without throwing — the cron continues with mobile
 * pushes; web pushes just won't deliver until keys are configured.
 *
 * A `410 Gone` or `404 Not Found` response from the push service
 * means the subscription is dead (user uninstalled / cleared cookies /
 * revoked). We surface that as `{ ok: false, reason: "gone" }` so the
 * caller can delete the row.
 */

export interface WebPushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface WebPushPayload {
  title: string;
  body: string;
  /** App-relative URL the notification click should open. Default: /home */
  url?: string;
  /** Dedupe tag — pushes with the same tag replace each other in the
   *  OS notification tray (see `sw.js`). */
  tag?: string;
}

export type SendWebPushResult =
  | { ok: true }
  | {
      ok: false;
      reason: "vapid_unset" | "gone" | "network" | "unknown";
      status?: number;
      error?: string;
    };

/**
 * Send a Web Push to one subscription. Returns a typed result so the
 * caller can distinguish "delivered", "subscription dead (delete)",
 * and "temporary failure (retry next cron)".
 */
export async function sendWebPush(
  subscription: WebPushSubscriptionRow,
  payload: WebPushPayload,
): Promise<SendWebPushResult> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) {
    return { ok: false, reason: "vapid_unset" };
  }

  // Lazy import so web-push isn't bundled into client code paths.
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(subject, publicKey, privateKey);

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/home",
        tag: payload.tag ?? "suppr-generic",
      }),
    );
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      return { ok: false, reason: "gone", status, error: String(e) };
    }
    if (status && status >= 500) {
      return { ok: false, reason: "network", status, error: String(e) };
    }
    return { ok: false, reason: "unknown", status, error: String(e) };
  }
}

/** Fan-out helper — sends one payload to every subscription, returning
 *  the set of dead endpoints the caller should delete. Best-effort: a
 *  per-subscription network failure doesn't short-circuit the batch. */
export async function sendWebPushFanout(
  subscriptions: WebPushSubscriptionRow[],
  payload: WebPushPayload,
): Promise<{
  sent: number;
  dead: string[];
  failed: number;
  vapidUnset: boolean;
}> {
  const dead: string[] = [];
  let sent = 0;
  let failed = 0;
  let vapidUnset = false;

  for (const sub of subscriptions) {
    const result = await sendWebPush(sub, payload);
    if (result.ok) {
      sent += 1;
    } else if (result.reason === "gone") {
      dead.push(sub.endpoint);
    } else if (result.reason === "vapid_unset") {
      vapidUnset = true;
      break; // no point retrying every row with the same unset keys
    } else {
      failed += 1;
    }
  }

  return { sent, dead, failed, vapidUnset };
}
