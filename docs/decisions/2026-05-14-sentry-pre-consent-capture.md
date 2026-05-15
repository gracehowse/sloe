# Decision — Sentry redacted-core capture pre-consent

**Date:** 2026-05-14
**Author:** Grace (with Claude)
**Status:** Resolved
**Area:** Observability / privacy
**Linear / audit reference:** Blocker 4 of the 2026-05-14 production-readiness audit

## Context

Until today, `sentry.client.config.ts` returned `null` from
`beforeSend` whenever cookie consent had not been granted:

```ts
beforeSend(event) {
  return hasConsent() ? event : null;
}
```

That posture is legally correct under the UK ICO interpretation of
non-essential telemetry (Sentry transmits user-identifying data to a
US processor). It is also operationally blind in three specific failure
modes that matter for Phase 1 of the viral launch (TikTok + IG, 2026-07-01):

1. **Crash on the cookie-banner page itself.** Banner renders, banner
   throws, user closes the tab. No Sentry event. Zero signal that the
   banner is broken — which would simultaneously block all downstream
   capture.
2. **Cold-open bounces.** A paid-acquisition user lands from a TikTok
   link, the app crashes inside the first render of `/today` or
   `/onboarding`, they leave before tapping "Accept all". The most
   informative crashes — the ones from the highest-stakes traffic — are
   the ones we never see.
3. **Decline-then-crash.** A user taps "Essential only" (declined),
   then the app crashes. We have an explicit *no* on full capture, but
   we still want to know the app is broken.

Cold-open crashes from paid acquisition are the worst possible silent
failure during a viral launch.

## Decision

Pre-consent, send a **redacted core** event containing only:

- `event_id`, `level`, `release`, `environment`, `fingerprint`
- `exception.values[*].{type, value}` — `value` truncated to 200 chars
- `exception.values[*].stacktrace.frames[*]` — frame metadata kept (filename, lineno, function) **but `vars` dropped**
- Allow-listed tags: `route`, `feature`, `consent_state`
- Breadcrumbs filtered to `navigation` + `console.error` categories, **message-only**, with any breadcrumb whose message or data matches an email / JWT / Stripe-key pattern dropped

Post-consent, send the full event with PII keys still stripped as
defence in depth (`user`, `request.cookies`, `request.headers.authorization`,
any nested key matching `/token|secret|email|password|cookie|authorization|api[_-]?key|session/i`).

Server + edge + mobile do not have a consent gate — by hitting an
authenticated route (web server / edge) or installing the app (mobile),
the user has effectively consented to operational telemetry. Those
runtimes always send, always run through the same `redactPII` helper.

## Privacy posture — explicit drops

Every field dropped pre-consent is named:

| Field | Disposition | Why |
|---|---|---|
| `user` (id, email, ip_address) | Dropped wholesale | Direct PII |
| `request.cookies` | Dropped | Session identifier |
| `request.headers.authorization` | Dropped | Bearer token |
| `request.headers.cookie` | Dropped | Session identifier |
| `request.headers.x-api-key` | Dropped | Token-shaped |
| `request.data.*` matching `/token\|secret\|email\|password\|.../` | Dropped | Token-shaped fields |
| `breadcrumbs` (full) | Filtered to `navigation` + `console.error`, message-only | Crumb data is free-form, frequently embeds fetch URLs with query params, console arguments, etc. |
| `breadcrumbs` matching email / JWT / Stripe-key regex | Dropped | Captured PII pattern |
| `exception.values[*].stacktrace.frames[*].vars` | Dropped | Local var snapshots can echo back form input, auth tokens, recipe bodies |
| `exception.values[*].value` over 200 chars | Truncated with `…` | Long error messages can contain echoed user input |
| `contexts.*` (device, app, runtime, etc.) | Dropped pre-consent | Device serial numbers, IDFA-like identifiers |
| `extra.*` | Dropped pre-consent | Free-form `setExtra` payloads |
| `tags.*` not in `{route, feature, consent_state}` | Dropped pre-consent | Tags are user-supplied — could carry token-shaped values |

Every field **kept** is named explicitly in `stripToCore`. There is no
"keep by default" path: the function builds the output object key by
key. This makes the privacy posture greppable.

## Tradeoff considered — tunnel mode vs `beforeSend` redaction

Tunnel mode (proxying every Sentry event through a `/api/sentry-tunnel`
edge function and redacting server-side) was the alternative. It was
rejected:

| | Tunnel mode | `beforeSend` redaction |
|---|---|---|
| Edge function required | Yes | No |
| Latency on every Sentry event | +50–200ms | 0 |
| Failure mode if redactor is broken | Event still leaves browser then gets dropped | Event never leaves browser |
| Reversibility | Deploy required | Feature flag flip |
| Privacy posture | Equivalent | Equivalent |

`beforeSend` is simpler, faster, fails-closed (broken redactor →
broken capture, not leaked data), and is reversible via the
`sentry-pre-consent-capture` PostHog flag.

## Reversibility

The pre-consent path is gated behind PostHog feature flag
`sentry-pre-consent-capture`:

- **Flag OFF (default until rollout):** behaves as before today —
  `beforeSend` returns `null` pre-consent.
- **Flag ON:** redacted-core capture pre-consent.

If a privacy review later objects, flip the flag off in the PostHog
dashboard. No deploy needed. The flag must be **created** in the
PostHog dashboard before this change has any visible effect (default
behaviour absent a flag is still drop-on-pre-consent — see
`preConsentCaptureEnabled()` in `sentry.client.config.ts`).

Rollout plan:

1. Create flag in PostHog with default OFF.
2. Roll to Grace's user id (100%) for one week.
3. Confirm dashboards show pre-consent events with `consent_state = "pre_consent"`.
4. Confirm no PII appears in any pre-consent event (manual spot-check 10 events).
5. Ramp to 100% before TikTok+IG push starts (2026-07-01).

## What this commits

- `src/lib/observability/sentryRedaction.ts` — new shared helper
  exporting `redactPII` and `stripToCore`. Unit-tested in
  `tests/unit/observability/sentryRedaction.test.ts` (16 tests covering
  PII-key stripping, breadcrumb filtering, allow-listed tags, stacktrace
  var dropping, exception truncation, immutability).
- `sentry.client.config.ts` — rewritten to use the helpers with the
  flag-gated pre-consent path.
- `sentry.server.config.ts` + `sentry.edge.config.ts` — `beforeSend`
  hook added that calls `redactPII` unconditionally.
- `apps/mobile/lib/errorTracking.ts` — `beforeSend` hook added that
  calls `redactPII` for parity with server.

## Mobile parity

Mobile has no cookie consent and no `preConsentCaptureEnabled()` flag
read (no PostHog flag-read inside Sentry's `beforeSend` on RN — the
same defence-in-depth `redactPII` runs every time). This is an
intentional divergence: mobile consent posture is governed by the App
Store install + privacy policy, web consent posture is governed by the
banner. `sync-enforcer` should not flag this as drift.

## Follow-ups

- [ ] Create `sentry-pre-consent-capture` flag in PostHog dashboard
      (owner: Grace).
- [ ] After one week at 100%, spot-check 10 pre-consent events in the
      Sentry UI for any PII leak.
- [ ] After two weeks no-regression at 100%, file a cleanup PR to
      remove the flag gate (per CLAUDE.md feature-flag-removal rule).
