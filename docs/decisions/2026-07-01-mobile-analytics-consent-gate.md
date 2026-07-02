# Decision — Mobile analytics + session replay are consent-gated (ENG-1286)

**Date:** 2026-07-01
**Status:** Resolved (launch blocker)
**Area:** Analytics / privacy / mobile

## Problem

`apps/mobile/lib/analytics.ts#getPostHogClient` initialised PostHog
unconditionally with `enableSessionReplay: true` on first use. Web has
gated capture behind cookie consent since the banner shipped
(`opt_out_capturing_by_default: consent !== "accepted"` in
`src/app/components/AnalyticsProvider.tsx`), and the privacy policy
(`app/privacy/page.tsx`) promises analytics are optional ("if you do
not opt out" / "disable optional analytics"). Mobile had **no consent
surface at all** — every install captured events and replay from first
launch. Policy said opt-out; the iOS app offered none.

## Decision

Mirror the web consent semantics on mobile — same three states, same
fail-closed posture — with one deliberate strengthening:

- **State:** `suppr_analytics_consent` in AsyncStorage, values
  `"accepted" | "declined"` (unset = never asked). Web's equivalent is
  localStorage `suppr_cookie_consent` (same value space; renamed on
  mobile because there are no cookies — the consent governs PostHog
  usage analytics + masked session replay). Module:
  `apps/mobile/lib/analyticsConsent.ts` (pure — storage + pub/sub, no
  SDK import).
- **Gate:** `getPostHogClient()` returns `null` until stored consent is
  `"accepted"` — the SDK is **never constructed** pre-consent. This is
  stronger than web's init-opted-out because `enableSessionReplay` is
  an init-time option on posthog-react-native: the native replay
  recorder starts with the client, so opt-out-after-init is not a
  reliable replay gate on RN. No consent → no events, no replay, no
  SDK storage writes. Every call site already tolerates a null client.
- **Flips apply live** (no restart): accept → construct + `optIn()`
  (always — the SDK persists its own opt-out flag, so decline→re-accept
  would otherwise stay dark); decline → `optOut()` on the live client
  (stops events + replay per the SDK opt-out contract; instance kept,
  matching web). Next launch after a decline never re-inits the SDK.
- **Ask moment:** `AnalyticsConsentPrompt` — a non-modal bottom card in
  the tabs shell (`apps/mobile/app/(tabs)/_layout.tsx`), i.e. the first
  authenticated app open post-onboarding, persisting across tabs until
  answered — the closest mobile mirror of the web banner. Non-modal on
  purpose: the post-onboarding push explainer already owns the modal
  moment on first Today render. Accept ("Allow") and decline
  ("No thanks") are side-by-side, equal size — the UK/EU
  equal-prominence posture the web banner documents.
- **Settings home:** "Usage analytics & replay" toggle
  (`AnalyticsConsentRow`) in the Account card of
  `SettingsBundleContent`, reflecting + writing the same stored state
  live. Session replay rides the same consent — deliberately no
  separate replay toggle (one promise, one switch, matching the privacy
  policy's single opt-out).

## Costs accepted

- **Pre-consent flags:** PostHog-resolved flags read `false` and
  `isFeatureDisabled` kill switches are inert for un-consented users
  (same shape as a cold client); `REDESIGN_DEFAULT_ON` is unaffected.
- **Pre-consent funnel:** onboarding/login events on a fresh install
  are not captured until the user accepts on first tabs entry. Web
  loses the same events for banner-unanswered visitors — parity, not a
  regression.
- **No decline analytics:** the consent surfaces fire no events by
  design (capturing a decline would be capture-before-consent); accepts
  are visible via the `posthog_health_check` sentinel.

## Known follow-up (web parity gap — needs a ticket)

Web has **no post-banner consent surface**: once the CookieConsent
banner is answered it never re-renders, and web Settings has no
"Usage analytics" toggle — while the privacy policy says consent can be
withdrawn and the new mobile copy says "change this anytime in
Settings". Mobile now exceeds web. File a web Settings-toggle issue and
link it here.

## Tests

`apps/mobile/tests/unit/analyticsConsentGate.test.ts` (gate + flip
semantics + storage round-trip),
`apps/mobile/tests/unit/analyticsConsentSurfaces.test.tsx` (prompt +
Settings row), plus consent seeding added to the pre-existing analytics
self-tests (`isFeatureDisabled`, `forcedFlagsRuntimeOverride`,
`redesignFlagsUngated`, `isFeatureEnabledNoUnhandledRejection`).

## Not verifiable in unit tests

That posthog-react-native's `optOut()` halts an in-flight replay
recording mid-session on a real device — the SDK contract says capture
stops, but the recorder behaviour needs a real consented session in
PostHog to confirm. Next-launch behaviour is airtight regardless (gate
returns null before construction).
