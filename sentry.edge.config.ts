import * as Sentry from "@sentry/nextjs";
import { redactPII } from "./src/lib/observability/sentryRedaction";

/**
 * Edge runtime mirror of `sentry.server.config.ts` — middleware +
 * edge-route handlers run here. Same defence-in-depth PII redaction
 * applies; see `docs/decisions/2026-05-14-sentry-pre-consent-capture.md`.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.05,
  enabled: Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  beforeSend(event) {
    // See comment in `sentry.server.config.ts` for the cast rationale.
    return redactPII(event as unknown as Record<string, unknown>) as unknown as typeof event;
  },
});
