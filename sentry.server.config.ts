import * as Sentry from "@sentry/nextjs";
import { redactPII } from "./src/lib/observability/sentryRedaction";

/**
 * Server-side Sentry has no cookie banner; a request that reached an
 * authenticated route has effectively consented to operational
 * telemetry. We still run every event through `redactPII` as defence
 * in depth — Suppr's API routes echo `Authorization` headers, set
 * cookies on auth responses, and accept JSON bodies with token-shaped
 * fields (Stripe webhook payloads, RevenueCat webhooks, recipe-import
 * tokens). Stripping at the SDK boundary means a future SDK upgrade or
 * a misconfigured `setContext` can't silently leak.
 *
 * See `docs/decisions/2026-05-14-sentry-pre-consent-capture.md`.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.08,
  enabled: Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  enableLogs: true,
  // `includeLocalVariables: true` (sentry-nextjs-sdk skill recommendation)
  // intentionally NOT enabled — our `redactPII` walks event keys but does
  // not yet recurse into stack-frame `vars`. Turning this on would attach
  // local-var snapshots (possibly containing email / token-shaped values
  // the redactor missed) to every prod error. Revisit once `redactPII` is
  // extended to walk frames; tracked as a follow-up to
  // docs/decisions/2026-05-14-sentry-pre-consent-capture.md.
  beforeSend(event) {
    // Cast through `unknown` — the helper is structurally typed for
    // both @sentry/nextjs and @sentry/react-native; Sentry's
    // `ErrorEvent` has no index signature so it can't directly satisfy
    // `Record<string, unknown>`. The helper preserves the event shape.
    return redactPII(event as unknown as Record<string, unknown>) as unknown as typeof event;
  },
});
