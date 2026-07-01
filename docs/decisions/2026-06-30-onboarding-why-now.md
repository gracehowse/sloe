# Onboarding "What's bringing you here?" intent capture (ENG-963)

**Date:** 2026-06-30
**Status:** Resolved (flag-gated rollout, default-OFF)
**Area:** Onboarding / retention + warm-coaching tone
**Owner:** Grace
**Authority:** Warm-coaching design direction
(`project_lifesum_aesthetic_direction.md`) + the Suppr positioning bet —
"love food AND have goals" (`project_suppr_positioning.md`): meet the user's
motivation, frame it kindly.

## Problem

Onboarding asks *what* the user wants (the Goal step) but never *why now*.
The "why" is the single richest signal for keeping the plan **encouraging**:
two users who both pick "lose weight" can be there to feel better day to day,
to get stronger, to build a habit, or because something's coming up — and the
calm-coach voice lands very differently for each. Capturing it lets the reveal
moment reflect the user's own reason back ("a plan built around feeling better
day to day") instead of a generic "here are your numbers".

## Decision

Add an **optional** "What's bringing you here?" step (`why-now`) immediately
after the Goal step — the earliest moment the user has framed *what* they
want, so we ask the gentler *why* while it's top of mind — on both web and
mobile.

### Behaviour

1. **Placement:** `why-now` sits right after `goal` in `STEP_IDS`
   (`… goal → why-now → sex → …`).
2. **Five body-neutral options**, shared web ↔ mobile via
   `src/lib/onboarding/whyNowOptions.ts` so the tiles + copy can never drift:
   - feel better day to day
   - get stronger
   - build a steady habit
   - something coming up
   - just curious

   Every option is a calm, supportive framing of *why now* — **no
   body-shaming, no weight-loss promises, no health claims** (trust posture:
   Suppr is a tool, not a clinician).
3. **Capture, don't gate.** Picking is optional — `canAdvance("why-now", …)`
   is always true (the footer Continue always advances), mirroring Welcome /
   app-choice / data-bridges. The subtitle says so explicitly ("Optional …
   skip if you'd rather"). The choice is stored in `state.whyNow` and emitted
   as `onboarding_why_now` (`{ reason, platform }`).
4. **Reflected at the reveal.** When an intent was picked, the reveal step
   echoes it back in one calm serif-italic line, sourced from
   `ONBOARDING_REVEAL_WHY_NOW_REFLECTION` in `figmaCopy.ts` (e.g.
   "A plan built around feeling better day to day."). Renders nothing when no
   intent was picked (the common case while the flag is OFF).
5. **`onboarding_completed`** also carries `why_now` so the funnel can slice
   activation by motivation cohort (intent → completion → first log).

### Not a `profiles` column

`whyNow` is an analytics + onboarding-personalisation signal, **not** a DB
column — it round-trips through the existing `OnboardingState` localStorage /
AsyncStorage persistence (the same path every other answer uses), exactly like
`appChoice`. No migration; no silent dead-write to `profiles`.

### Flag gate + auto-skip

The step is gated behind the PostHog flag **`onboarding-why-now`**
(default-OFF, same name web + mobile, per the structural-change flag rule in
`CLAUDE.md`). When the flag is OFF (the live default until it ramps):

- both flow shells **auto-skip** the step — `resolveNextStep` jumps past it on
  forward + back navigation (the **exact same mechanism** as the
  `app-choice` flag-gated skip), and a single consolidated defensive effect in
  each shell advances past it if a persisted `step` lands on it;
- the shared `displayPosition` helper **drops it from the "Step N of M"
  total**, so the live step counter is **unchanged** and the bar can't desync.

`isFeatureEnabled` resolves `false` when PostHog is cold, which is exactly the
safe default (skip) — so a cold-start / headless run sees the unchanged flow.
That is what makes the change **mergeable headless**: flag-OFF is a zero-delta
no-op; only the new step's pixels need a sim + web glance before the flag ramps.

## Cross-platform parity

| Surface | Web | Mobile |
|---|---|---|
| Step component | `src/app/components/onboarding/steps/why-now.tsx` | `apps/mobile/components/onboarding/steps/why-now.tsx` |
| Tiles + order + copy | `whyNowOptions.ts` (shared) | same helper |
| Event | `onboarding_why_now` `{reason, platform:"web"}` | same name `{…, platform:"ios"}` |
| Reveal reflection | `RevealWhyNowReflection` (figmaCopy source) | identical, same source |
| Flag gate | `onboarding-why-now` (default-OFF) | same flag name |

No intentional divergence.

## Validation (headless, full)

- `tests/unit/onboardingWhyNowWiring.test.tsx` — flag-OFF auto-skips on
  forward + back AND keeps the displayed step count unchanged; flag-ON inserts
  `why-now` after `goal`; the field round-trips through the provider's
  localStorage persistence; `onboarding-why-now` registered default-OFF on
  both platforms.
- `tests/unit/onboardingWhyNowWeb.test.tsx` /
  `apps/mobile/tests/unit/onboardingWhyNow.test.tsx` — renders the shared
  body-neutral tiles, selection writes `state.whyNow` + emits the event with
  the right `reason`/`platform`, and the reveal reflects the chosen intent
  (and nothing when none).
- `tests/unit/onboardingState.test.ts` — 15-step order, `why-now`
  `canAdvance`, and the displayPosition/resolveNextStep app-choice assertions
  re-scoped to isolate each flag.
- `tests/unit/analyticsEvents.test.ts` — `onboarding_why_now` registered with
  the canonical value.
- `npm run typecheck && npm run test && npm run mobile:typecheck &&
  npm run mobile:test && npm run check:screen-budget` — all green.
- Visual: **deferred to the flag ramp** — flag-OFF moves zero pixels, so a sim
  + web glance at the new step is captured when Grace forces the flag ON
  before ramp (per `feedback_visual_validation_mandatory.md`).

## Files

- `src/lib/onboarding/state.ts` — `why-now` step id + label, `WhyNow` type,
  `whyNow` state field + default, `canAdvance` case, `whyNowEnabled` in
  `ResolveStepOptions` + flag-gated `resolveNextStep` skip, `displayPosition`
  visible-step counter.
- `src/lib/onboarding/whyNowOptions.ts` — shared body-neutral option set + copy.
- `src/lib/onboarding/figmaCopy.ts` — `ONBOARDING_REVEAL_WHY_NOW_REFLECTION`.
- `src/lib/analytics/events.ts` — `onboarding_why_now` event.
- `src/lib/analytics/track.ts` + `apps/mobile/lib/analytics.ts` —
  `onboarding-why-now` in `KNOWN_DEFAULT_OFF_FLAGS` (both platforms).
- `src/app/components/onboarding/steps/why-now.tsx` + `.../reveal-why-now.tsx`
  — web step + extracted reveal reflection.
- `apps/mobile/components/onboarding/steps/why-now.tsx` +
  `.../reveal-why-now.tsx` — mobile step + extracted reveal reflection.
- `src/app/components/onboarding/{context,web-flow,narrative,steps/reveal}.tsx`
  + `steps/index.ts` — wiring + flag gate + consolidated auto-skip (web).
- `apps/mobile/components/onboarding/{context,mobile-flow,steps/reveal}.tsx` +
  `steps/index.ts` — wiring + flag gate + consolidated auto-skip (mobile).
- Tests + this doc.

## Out of scope (follow-ups)

| Item | Why deferred |
|---|---|
| Tailoring the plan/coach copy by `whyNow` beyond the reveal line | This ships the capture + the reveal reflection; deeper per-intent coaching is a separate copy pass. |
| Ramping the flag | Standard: Grace forces it ON for a sim + web glance, then ramps in PostHog; once it holds 100% for two weeks with no regression, drop the gate in a cleanup PR (CLAUDE.md feature-flag rule). |
