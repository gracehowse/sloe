# 2026-05-27 — Onboarding funnel instrumentation (ENG-1)

## Status
Implemented. Gate requires real user cohorts post-launch (2026-07-01).

## Target
Onboarding completion rate ≥60%.
Measured as: users who fire `onboarding_started` and then fire `onboarding_completed`
within a 1-day conversion window.

## What was missing

Before this change, mobile had `onboarding_completed` but no funnel entry event and
no per-step events. Web had `onboarding_step_completed` (in `handleContinue`) but also
no entry event. Neither platform fired `onboarding_started`, making it impossible to
compute a denominator for the completion rate.

## What changed

### `src/lib/analytics/events.ts`
Added two events:
- `onboarding_started` — fires once when a new user first sees the Welcome step.
  Excluded on the mobile refresh-plan flow (`isRefreshPlan === true`). This is the
  funnel entry / denominator event.
- `photo_log_api_completed` — ENG-6 server-side telemetry (added in same session).

### `src/app/components/onboarding/web-flow.tsx`
Added `onboarding_started` useEffect with a `startedFired` ref guard. Fires when
`isWelcome === true` on first render. Web has no refresh-plan flow so no exclusion
guard is needed.

### `src/app/components/onboarding/steps/welcome.tsx` (web)
Added `onboarding_step_completed` to the "Join the club" button onClick handler
(before `go(1)`). The Welcome step bypasses `handleContinue` on both platforms —
it calls `go(1)` directly — so step completion must fire from within the component.

### `apps/mobile/components/onboarding/mobile-flow.tsx`
- `onboarding_started` useEffect added (with ref guard and `isRefreshPlan === false`
  guard so it doesn't fire when a returning user refreshes their plan).
- `onboarding_step_completed` added at the top of `handleContinue` for all steps
  except Welcome (Welcome fires it from its own CTA).

### `apps/mobile/components/onboarding/steps/welcome.tsx` (mobile)
Added `onboarding_step_completed` to the CTA `onPress` (before `go(1)`).

## PostHog insight
`ENG-1 — Onboarding completion funnel (started → completed)` — short_id `KloZHpKy`.
Conversion window: 1 day. Filter test accounts: true.
URL: `/insights/KloZHpKy`

## Why no per-step `onboarding_step_completed` on mobile before this

Mobile's `handleContinue` only fired the pace safety-floor event. Web already fired
`onboarding_step_completed` from `handleContinue` (added in the ENG-672 batch) but
mobile had never been brought to parity. This change closes the gap.

## Why Welcome fires separately from handleContinue

Both platforms' Welcome components call `go(1)` directly from their CTA buttons rather
than routing through the flow shell's `handleContinue`. This is intentional — Welcome
uses a full-bleed hero layout with no shell footer. Rather than push analytics state
into the context or add a callback prop, firing the event inline in the button handler
is simpler and keeps the event close to the user action.

## Gate

The ≥60% target requires a real user cohort. Grace is the only TestFlight tester until
the 2026-07-01 launch push. Check PostHog insight `KloZHpKy` four weeks after the
first public cohort starts to validate.

## Files changed
- `src/lib/analytics/events.ts` — `onboarding_started` event added
- `src/app/components/onboarding/web-flow.tsx` — `onboarding_started` useEffect
- `src/app/components/onboarding/steps/welcome.tsx` — `onboarding_step_completed` on CTA
- `apps/mobile/components/onboarding/mobile-flow.tsx` — `onboarding_started` + `onboarding_step_completed` in handleContinue
- `apps/mobile/components/onboarding/steps/welcome.tsx` — `onboarding_step_completed` on CTA
