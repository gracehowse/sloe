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
    // Dev-only suppression: Node's HTTP server emits an uncaught
    // `Error: aborted` from `node:_http_server` `abortIncoming` /
    // `socketOnClose` when a client socket closes mid-request. In
    // local dev this fires every time a Playwright browser context
    // tears down with in-flight Next requests (every E2E run, every
    // visual-regression sweep). The Sentry SDK catches it via
    // `auto.node.onuncaughtexception` and surfaces it as `fatal` even
    // though the process keeps running. Production users with flaky
    // connections can produce the same trace — we want to KEEP that
    // visibility, so the suppression is gated on
    // `NODE_ENV === "development"` only.
    //
    // Match criteria (must hit all three to drop):
    //  - exception value/message is exactly "aborted"
    //  - top stack frame's `filename` mentions `node:_http_server`
    //  - environment is development
    if (process.env.NODE_ENV === "development") {
      const exc = event.exception?.values?.[0];
      const message = exc?.value;
      const topFrame = exc?.stacktrace?.frames?.[exc.stacktrace.frames.length - 1];
      const fromHttpServer = topFrame?.filename?.includes("node:_http_server") ?? false;
      if (message === "aborted" && fromHttpServer) {
        return null;
      }
    }
    // Cast through `unknown` — the helper is structurally typed for
    // both @sentry/nextjs and @sentry/react-native; Sentry's
    // `ErrorEvent` has no index signature so it can't directly satisfy
    // `Record<string, unknown>`. The helper preserves the event shape.
    return redactPII(event as unknown as Record<string, unknown>) as unknown as typeof event;
  },
});
