# Decision — Session replay sample rate behind a PostHog flag

**Date:** 2026-05-16
**Author:** Grace (in conversation with Claude)
**Status:** Resolved
**Area:** Analytics / release process
**Linear:** ENG-516

## What changed

The session-replay sample rate is now driven by a PostHog feature
flag (`session-replay-sample-rate`) on both web and mobile. Default
payload is `1.0` (capture every session) — matches the pre-flag
posture set 2026-05-13. Grace can flip the payload to `0.1` (10%) or
lower in the PostHog dashboard pre-launch without a deploy.

The PostHog flag id is `679616` in the `Default project` (org Suppr).

## Why

The 2026-05-13 session-replay rollout pinned both web and mobile at
`sampleRate: 1.0` with a comment that said "drop to 0.1 post-launch
as traffic grows". That left an operational landmine: the only path
to drop the rate was a code change, which means a deploy, which
means waiting for Grace's window. The whole point of a feature flag
is to break that coupling — flip it from the dashboard in 30 seconds
when traffic spikes.

Wiring the flag plumbing NOW (with default `1.0` so behaviour is
unchanged) gives Grace a knob she can twist post-launch without a
code review cycle, and it costs us nothing today.

## How it works

**Pure logic** lives in
`src/lib/analytics/sessionReplaySampleRate.ts` — coercion + fallback
rules shared by both platforms. Any malformed or out-of-range value
falls back to `DEFAULT_SESSION_REPLAY_SAMPLE_RATE = 1.0`.

**Web** (`src/app/components/AnalyticsProvider.tsx`):
- On init, `readCachedSampleRate()` reads the prior session's value
  from `localStorage["suppr.posthog.session_replay_sample_rate"]`.
  Defaults to `1.0` if unset / malformed / storage denied.
- Value is passed to `session_recording.sampleRate` in `posthog.init`.
- A `loaded` callback reads `getFeatureFlagPayload("session-replay-
  sample-rate")` and persists it for the next session.

**Mobile** (`apps/mobile/lib/analytics.ts` +
`apps/mobile/context/AnalyticsProvider.tsx`):
- AnalyticsProvider awaits `primeSessionReplaySampleRate()`
  (AsyncStorage read) before creating the PostHog client, so the
  cached value is applied at `new PostHog(...)` time.
- `onFeatureFlags` callback persists the latest flag payload via
  `persistSessionReplaySampleRate(c)` for the next launch.
- Mobile glue is split into
  `apps/mobile/lib/sessionReplaySampleRateCache.ts` so it can be
  tested without instantiating the real PostHog client.

## Why one-session lag is acceptable

PostHog session-replay sampling is decided once per recording, at
recording-start time. The SDK doesn't expose a way to flip
`sampleRate` mid-session. So even if we fetched the flag value
synchronously during the current session, we couldn't apply it to
the in-flight recording — only to the next one.

In practice that means a dashboard flip on Day N takes effect on
each user's Day N+1 session (next app launch / page load). For a
slow-moving knob like sample rate that's fine. The flag isn't
appropriate for things that need to take effect immediately.

## Testing

- `tests/unit/sessionReplaySampleRate.test.ts` — 18 tests against
  the pure coercion logic (parseSampleRate, resolveSampleRate, the
  constant exports).
- `apps/mobile/tests/unit/sessionReplaySampleRateCache.test.ts` —
  12 tests against the mobile AsyncStorage glue, round-tripping
  cached values and exercising the payload-reader contract with a
  stub PostHog-shaped client.

## Operator playbook

Pre-launch (when first wave of real-user traffic lands and storage
costs start to matter):

1. Open the flag at
   https://us.posthog.com/project/389168/feature_flags/679616
2. Change the "true" variant's payload from `1.0` to `0.1` (or
   whatever rate is right for traffic).
3. Save. Existing users will pick up the new rate on their next
   session (typically within 24h for active users).

To temporarily kill replay entirely (e.g. a privacy incident):
- Set the payload to `0` — the SDK won't start any new recordings
  until the payload is restored.
- This is reversible without a deploy and takes effect on next
  session.

To kill replay PERMANENTLY (i.e. it's not coming back), don't use
this flag — disable session replay at the PostHog project level
instead, and rip out the `enableSessionReplay` config in code.

## Related

- 2026-05-13 — Session replay + feature flags as standing rules
  (`docs/decisions/2026-05-13-session-replay-and-feature-flags.md`)
