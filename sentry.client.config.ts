import * as Sentry from "@sentry/nextjs";

/**
 * Consent posture (L2, 2026-04-21): Sentry is non-essential telemetry
 * from the UK/EU ICO perspective (transmits user-identifying data to a
 * US processor). We gate event delivery on the same opt-in cookie
 * consent that governs PostHog. Until the user accepts cookies, the
 * SDK stays initialised but drops every event in `beforeSend`, so we
 * can still flip to live delivery the moment consent arrives (the
 * `suppr-consent` event is dispatched by `CookieConsent`).
 */
const CONSENT_KEY = "suppr_cookie_consent";

function hasConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.08,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  // Drop every event until the user has explicitly opted in. We keep
  // `enabled: true` so the transport stays ready — switching the drop
  // flag is cheaper than re-initialising the SDK on consent change.
  beforeSend(event) {
    return hasConsent() ? event : null;
  },
  beforeSendTransaction(transaction) {
    return hasConsent() ? transaction : null;
  },
});
