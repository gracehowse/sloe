"use client";

import * as React from "react";
import { ensureServiceWorkerRegistered } from "@/lib/push/webNotifications";

/**
 * Register the Web Push service worker on app mount.
 *
 * Mounted once at the root layout via `app/providers.tsx`. Registration
 * is idempotent — `navigator.serviceWorker.getRegistration` short-
 * circuits when the SW is already active, so subsequent page loads
 * don't re-register.
 *
 * Only registers in production-like environments — development with
 * `next dev --turbopack` caches aggressively and a stale SW can mask
 * code changes. Guard via `process.env.NODE_ENV === "production"` OR
 * `NEXT_PUBLIC_FORCE_SW=1` for local push testing.
 */

export function ServiceWorkerRegistration() {
  React.useEffect(() => {
    const shouldRegister =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_FORCE_SW === "1";
    if (!shouldRegister) return;
    void ensureServiceWorkerRegistered();
  }, []);
  return null;
}
