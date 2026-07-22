import * as Sentry from "@sentry/nextjs";
import { redactPII, stripToCore } from "./src/lib/observability/sentryRedaction";
import { resolveSentryEnvironment } from "./src/lib/observability/sentryEnvironment";

/**
 * Consent posture (L2, 2026-04-21 + D-2026-05-14): Sentry is non-
 * essential telemetry from the UK/EU ICO perspective (transmits user-
 * identifying data to a US processor). We gate **full** event delivery
 * on the same opt-in cookie consent that governs PostHog.
 *
 * Until 2026-05-14 we dropped every event pre-consent. That was
 * privacy-correct but operationally blind: any crash on the cookie-
 * banner page itself, or any cold-open from a paid-acquisition cohort
 * that bounces before consenting, was invisible. For Phase 1
 * (TikTok+IG viral launch 2026-07-01) the cold-open crash is the
 * worst failure to silence.
 *
 * The fix (see `docs/decisions/2026-05-14-sentry-pre-consent-capture.md`):
 *
 *   • Post-consent → full event, run through `redactPII` as defence-in-
 *     depth (cookies, auth headers, token-shaped keys stripped even
 *     though the SDK shouldn't surface them).
 *   • Pre-consent → redacted core only (event_id, level, exception
 *     type+value truncated to 200 chars, fingerprint, release,
 *     environment, allow-listed tags `route` + `feature` +
 *     `consent_state`). Stacktrace frame vars are dropped. User /
 *     request / breadcrumbs-with-PII are dropped.
 *
 * This was originally gated behind the `sentry-pre-consent-capture`
 * PostHog kill switch; permanently ON in production with no
 * regression, so the flag collapsed out (ENG-1651) — pre-consent
 * capture is now unconditional.
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
  // ENG-1404 — environment tag from NEXT_PUBLIC_VERCEL_ENV so browser events
  // are bucketed by deploy env, not lumped under NODE_ENV (see
  // src/lib/observability/sentryEnvironment.ts).
  environment: resolveSentryEnvironment(),
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.08,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  enableLogs: true,
  // Crash-replay only. PostHog records every consented session
  // already (see docs/decisions/2026-05-13-session-replay-and-feature-
  // flags.md); Sentry replay's value is the 30s leading up to an
  // *exception* attached to the issue in Sentry. We deliberately
  // sample 0 random sessions to avoid recording overlap with PostHog.
  //
  // Privacy: every text node + input + media element masked at the
  // SDK level. Network bodies/headers not captured (default). This
  // means replays show structure + clicks but no user data, which
  // matches the redactPII posture for the parent event.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],
  beforeSend(event) {
    // Cast through `unknown` — the helpers are structurally typed for
    // both @sentry/nextjs and @sentry/react-native; Sentry's
    // `ErrorEvent` has no index signature so it can't directly satisfy
    // `Record<string, unknown>`. The helpers preserve event shape, so
    // the round-trip cast is safe.
    const eventRecord = event as unknown as Record<string, unknown>;
    if (hasConsent()) {
      const granted = redactPII(eventRecord);
      const existingTags = (granted.tags as Record<string, unknown> | undefined) ?? {};
      granted.tags = { ...existingTags, consent_state: "granted" };
      return granted as unknown as typeof event;
    }
    const core = stripToCore(eventRecord) as Record<string, unknown>;
    const existingCoreTags = (core.tags as Record<string, unknown> | undefined) ?? {};
    core.tags = { ...existingCoreTags, consent_state: "pre_consent" };
    return core as unknown as typeof event;
  },
  beforeSendTransaction(transaction) {
    // Transactions carry trace timing + URL data — keep gated on
    // full consent, no pre-consent path. Operational visibility for
    // cold-open crashes comes from error events, not transactions.
    return hasConsent() ? transaction : null;
  },
});

/**
 * App Router navigation transition hook. Without this export, client-
 * side navigations (`router.push`, `<Link>` clicks) don't create their
 * own transaction span and roll into whatever span is active — which
 * makes per-route latency unreadable in Sentry's Performance view.
 *
 * Required by Next.js 15+ App Router per the `sentry-nextjs-sdk` skill.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
