# Decision log: onboarding v2 mobile architecture (D1–D4, retroactive 2026-04-25)

**Date:** 2026-04-24 (architecture decided); 2026-04-25 (doc backfilled per P1-17)
**Status:** Resolved (shipped); rollout flag at "Stage E — review before sign-off" per `apps/mobile/app/onboarding-v2.tsx` header
**Trigger:** D1–D4 of the [2026-04-24 full-sweep audit](../audits/2026-04-24-full-sweep.md). The original `onboarding_v2` flag was 100% rolled-out against a non-functional stub on mobile — Signup didn't create accounts, Permissions didn't prompt iOS, Import was a `setTimeout(2200)` with hardcoded data. Every iOS install since 2026-04-20 reached Today without a profile row. Phase 1 of the verdict mandated a flag-revert to 0% AND a real rebuild before flag-on.

---

## Decision

**Real auth in Signup, real HealthKit + push register in Permissions, real or clearly-demo-labelled Import, terminal step calls `persistOnboardingV2` + `router.replace("/paywall")`, and `onboarding_completed` PostHog event fires.** Rollout flag stays at 0% until QA + product sign-off; Stage E review precedes Stage F (flag → 100%).

The mobile flow lives at `apps/mobile/app/onboarding-v2.tsx`. The shared persistence helper (`persistOnboardingV2`) and the wizard step contract (`apps/mobile/components/onboarding-v2/`) mirror the web flow at `src/app/components/onboarding-v2/`.

## Rationale

The mobile rebuild followed the **single-flow-with-step-contract** architecture rather than the alternative **per-step screens with separate routes**:

- The web flow at `src/app/components/onboarding-v2/web-flow.tsx` is a single component that mounts the wizard and dispatches step transitions; persistence is one upsert at the terminal step.
- Mobile mirrors this shape so the two implementations share the same step contract (each step is `{ name, render, validate, persist }`), the same `persistOnboardingV2` helper, the same `onboarding_completed` PostHog event, and the same paywall-redirect.

Why this shape over per-step routes:
1. **Auth races.** A multi-route flow has session state spread across the route tree; an interrupted flow leaves the user in an ambiguous state. Single-flow + terminal-only persist means "completed = persisted; anything else = not started". One auth race instead of N.
2. **Web parity.** The audit's CLAUDE.md non-negotiable is web ↔ mobile sync. A shared step contract makes adding/removing a step a single-file change in both places.
3. **The original stub's failure mode** (button taps doing nothing, no real account creation) was specifically because the per-step shape with isolated routes had nothing to anchor side-effects against. Single-flow keeps the side-effect surface in one component.

## Alternatives considered

- **Per-step screens + per-step persistence.** Rejected per above. Multiple auth races, harder to keep platforms in sync, and was the architecture of the failed v1.
- **Server-rendered wizard with form posts.** Rejected — doesn't fit the React Native model and removes the need-and-want for instant validation between steps.
- **Defer v2 entirely; ship v1 with TestFlight.** Rejected by the 04-24 verdict because v1 had its own UX problems that v2 was specifically designed to fix.

## Implementation

- Mobile entry: [`apps/mobile/app/onboarding-v2.tsx`](../../apps/mobile/app/onboarding-v2.tsx).
- Shared persistence: `apps/mobile/lib/persistOnboardingV2.ts` (mirror of `src/app/components/onboarding-v2/persist.ts`).
- Step components: `apps/mobile/components/onboarding-v2/steps/`.
- Web equivalent: [`src/app/components/onboarding-v2/web-flow.tsx`](../../src/app/components/onboarding-v2/web-flow.tsx).
- Event wiring: `track(AnalyticsEvents.onboarding_completed, { path: "full" | "skip" })` from both completion paths (P1-13 closed the mobile event-fire gap that this decision had nominally resolved but never actually wired — see [P1-13 decision](./2026-04-25-mobile-observability.md)).
- Flag: `onboarding_v2` PostHog flag, gated at the redirect from `apps/mobile/app/onboarding.tsx` so the legacy onboarding stays the canonical path until Stage F.

## Platforms affected

- **Web:** unchanged at the architecture level (web-flow.tsx already shipped before this rebuild).
- **Mobile:** real Apple Sign-In integration via `usesAppleSignIn` in `app.json`; real HealthKit prompt at the Permissions step; real or clearly-demo-labelled Import step (no more `setTimeout` deception); terminal step persists via `persistOnboardingV2` and routes to `/paywall`.
- **Supabase:** writes to `profiles` (sex, dob, height, weight, goal, dietary, plan_pace, nutrition_strategy, calorie_schedule, fasting_*, target_*, `onboarding_completed: true`).

## Revisit when

- Stage E review surfaces a UX or correctness regression vs the legacy flow → block Stage F rollout, address, re-review.
- A new onboarding step needs to land (e.g. a region picker for VAT-inclusive pricing). Add to both `web-flow.tsx` and `onboarding-v2.tsx` in lockstep; the step contract makes it a one-day change.
- The flag flips to 100% (Stage F). Update this doc's status from "Stage E — review before sign-off" to "Resolved — rolled out".
- Telemetry shows step-completion drop-off > 30% on a single step. That step is the friction; redesign or remove.
