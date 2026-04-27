# Decision log: mobile Sentry + PostHog parity (P1-13, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** P1 #13 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Audit said "mobile observability incomplete beyond DSN env wiring."

---

## Decision

The audit was largely wrong on this one too. Mobile already had:

- `@sentry/react-native@7.2.0` installed; `apps/mobile/lib/errorTracking.ts` with full helper API; `initErrorTracking()` called at app boot in `apps/mobile/app/_layout.tsx:38`.
- `posthog-react-native` installed; `apps/mobile/lib/analytics.ts` with `track`, `identify`, `reset`, `isFeatureEnabled`, `subscribeToFlags`. Track helper integrates the shared `AnalyticsEventName` type from `src/lib/analytics/events.ts`.
- `food_logged` fired from 10+ sites in tracker + barcode tabs.
- `meal_plan_generated` fired from `apps/mobile/app/(tabs)/planner.tsx:1202`.
- `paywall_viewed` + `paywall_dismissed` fired from `apps/mobile/app/paywall.tsx:285`, `:375`, `:475`.

What was actually missing — two real gaps:

1. **`onboarding_completed` event never fired on mobile.** The DB column `profiles.onboarding_completed` got set to `true` at the end of both onboarding paths (`skip` at line 401 and `saveAndFinish` at line 439), but no PostHog event fired. Web fired the event from `src/app/components/onboarding-v2/web-flow.tsx`. PostHog activation funnels were therefore broken for mobile users — the first event you'd see was `food_logged`, with no `onboarding_completed` upstream.
2. **Sentry + PostHog user context never set.** Crashes lacked a user id, making per-user triage impossible. PostHog funnels stayed on the anonymous device id until a `track` call manually identified — and when sign-out happened, the next user's events still showed as the previous user until the device id rotated.

P1-13 closes both:

- **Onboarding event:** `apps/mobile/app/onboarding.tsx` now fires `track(AnalyticsEvents.onboarding_completed, { path: "skip" })` after the skip-path upsert and `track(AnalyticsEvents.onboarding_completed, { path: "full", goal_type, plan_pace, nutrition_strategy })` after the full-completion upsert. The `path` discriminator lets us split skip vs full-completion in funnels — important because skip is a different user intent than completing the wizard.
- **User context:** new `apps/mobile/context/auth.tsx::syncObservabilityUser(session)` helper sets Sentry user + PostHog identity when a session is present, clears them on sign-out. Wired into the initial `getSession` callback, the `onAuthStateChange` listener (covers SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED), and the E2E auto-sign-in path. Try/catch wrappers ensure observability errors never break auth.
- **Docs:** new "Mobile (P1-13)" section in `docs/observability.md` documenting the parity, helper paths, and event coverage.

## Rationale

The two gaps mattered more than they sounded. Without a user id on Sentry, a TestFlight tester reporting a crash via Apple's feedback channel turns into "find the nearest issue in our Sentry that might be related" — high friction, low resolution rate. Without `onboarding_completed` on mobile, the most important conversion metric (signed up → completed onboarding → logged first meal) was un-measurable on the mobile platform — exactly when we need the data most.

The existing analytics surface was already there; both fixes are a few lines each. The cost-benefit is overwhelming.

## Alternatives considered

- **Wait for the persistent offline queue (P2-29) and ship a fully buffered analytics queue too.** Rejected. PostHog already buffers locally and replays on reconnect — that's a SDK feature. We don't need a custom queue.
- **Fire `onboarding_completed` from a Supabase database trigger that watches the column flip.** Rejected. Adds infrastructure for no benefit; the mobile client knows the moment it happens, fire from there.
- **Identify with email or a custom property instead of the Supabase UUID.** Rejected. The UUID is the canonical identity in Supabase; mixing identifiers across web ↔ mobile would split the same user into two PostHog profiles.

## Implementation

- `apps/mobile/app/onboarding.tsx`:
  - `skip` path: added `try { track(AnalyticsEvents.onboarding_completed, { path: "skip" }) } catch {}` after the upsert. Fire-and-forget so analytics SDK errors never block the navigation.
  - `saveAndFinish` path: same pattern, with `path: "full"` plus three onboarding-decision properties (`goal_type`, `plan_pace`, `nutrition_strategy`) for cohort analysis.
- `apps/mobile/context/auth.tsx`:
  - Imports `setUser`/`clearUser` from `@/lib/errorTracking` and `identify`/`reset` from `@/lib/analytics`.
  - Adds `syncObservabilityUser(session)` helper. Try/catch around each SDK call.
  - Calls it in three places: initial session resolution, `onAuthStateChange` listener, E2E auto-sign-in.
- `docs/observability.md`: new "Mobile (P1-13, 2026-04-25)" section.

Web + mobile `tsc --noEmit` clean.

## Platforms affected

- **Mobile:** Sentry crashes carry user id; PostHog funnels are user-scoped from sign-in. New `onboarding_completed` event fires with `{ path: "skip" | "full" }` discriminator.
- **Web:** unchanged. `web-flow.tsx` already fires `onboarding_completed`.
- **Supabase:** unchanged.

## Verification

- Mobile `tsc --noEmit` clean.
- Manual TestFlight check: sign in, crash a screen (e.g. force a `throw` in dev), confirm Sentry surfaces the user id. Sign out, confirm the next event is anonymous until a new sign-in.
- PostHog funnel check: sign-up cohort → onboarding_completed → food_logged. Should now have non-zero `onboarding_completed` count for mobile users (was 0% pre-fix).

## Related artefacts

- [Opus 4.7 codebase review §3.7](../audits/2026-04-25-opus47-codebase-review.md#37-mobile-observability-incomplete)
- Web equivalent: [`src/app/components/onboarding-v2/web-flow.tsx:108`](../../src/app/components/onboarding-v2/web-flow.tsx)
- Helper: [`apps/mobile/lib/errorTracking.ts`](../../apps/mobile/lib/errorTracking.ts)
- Helper: [`apps/mobile/lib/analytics.ts`](../../apps/mobile/lib/analytics.ts)
- Doc: [`docs/observability.md` § Mobile](../observability.md)

## Revisit when

- A new high-value event lands on web (e.g. `recipe_imported`, `streak_extended`). Confirm it fires on mobile too with the same property shape.
- Sentry adds React Native session replay (currently disabled for privacy). Re-evaluate; replay is high-value for crash triage but needs a separate consent surface.
- The auth provider gets refactored (P2-19 Tracker monolith mentions `apps/mobile/context/`). Make sure `syncObservabilityUser` survives the refactor — losing it would silently break user-scoped funnels.
