/**
 * Suppr service worker — Web Push handler.
 *
 * Scope: receive Web Push events, show a notification, and route the
 * click to the correct in-app URL. Not a PWA offline cache — that's
 * deliberately out of scope (Grace 2026-04-20) until we have a proper
 * offline-strategy plan.
 *
 * Registered by `src/app/components/ServiceWorkerRegistration.tsx`
 * once on mount. The file lives at `/sw.js` at the site root so its
 * scope covers every route.
 *
 * Payload contract (set by `src/lib/push/webPushSend.ts`):
 *   { title: string, body: string, url?: string, tag?: string }
 *
 * Backwards-compatible: if a push arrives with no JSON body (rare but
 * legal per spec) we still show a generic notification instead of
 * silently dropping it — some browsers will auto-show a "This site
 * has been updated in the background" notification if we don't.
 */

/* eslint-env serviceworker */

self.addEventListener("install", (event) => {
  // Activate immediately on new SW installs so subsequent pushes land
  // on the fresh handler.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : null;
    } catch {
      return null;
    }
  })();

  const title = payload?.title || "Suppr";
  const body =
    payload?.body ||
    "You have a new update from Suppr.";
  const url = payload?.url || "/home";
  const tag = payload?.tag || "suppr-generic";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url },
      // Replace any prior push with the same tag so stale nudges
      // don't pile up (e.g. three "weekly recap" notifications from
      // three weeks of unopened Sundays).
      renotify: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/home";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Focus an existing tab on the same origin if we have one;
      // avoids spawning a duplicate tab every time the user taps a
      // notification.
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          const origin = self.location.origin;
          if (clientUrl.origin === origin && "focus" in client) {
            await client.focus();
            if ("navigate" in client) {
              await client.navigate(targetUrl);
            }
            return;
          }
        } catch {
          /* Ignore malformed client URLs and fall through to openWindow. */
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
