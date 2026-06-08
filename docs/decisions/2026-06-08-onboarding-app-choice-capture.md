# Onboarding "Coming from another app?" capture (ENG-990)

**Date:** 2026-06-08
**Status:** Resolved (flag-gated rollout)
**Area:** Onboarding / MFP-refugee capture
**Owner:** Grace
**Authority:** Yazio teardown (`docs/research/2026-06-08-yazio-teardown.md` §7
"Borrow #2: competitor-switch capture") + the MFP-refugee capture
initiative (`project_competitor_set_and_mfp_exodus.md`).

## Problem

Suppr already has the *back end* of competitor-switch capture — a
pluggable CSV-import framework (`src/lib/imports/csv/`, ENG-37) with live
adapters for **MyFitnessPal, Lose It, Cronometer, MacroFactor**, an
auto-detecting route (`/api/imports/mfp-csv`), and an importer card in the
terminal data-bridges onboarding step. What was missing was the *front of
the funnel*: nothing asked the new user **which app they're leaving**, so
the importer sat at the very end of onboarding where a switcher who
already felt lost could miss it.

The Yazio teardown confirmed this is a converting pattern: their
onboarding quiz literally asks `calorie_counting.app_choice.{mfp, loseit,
lifesum, noom, ww, fatsecret, simple, …}` and tailors the next screen.
They are *engineering* MFP-refugee capture. We can go one better — an MFP
pick should route straight into our real CSV importer, not a generic
affirmation.

## Decision

Add a **"Coming from another app?"** step (`app-choice`) immediately after
Welcome — the earliest credible capture moment — on both web and mobile.

### Behaviour

1. **Placement:** `app-choice` is step 2 in `STEP_IDS`
   (`welcome → app-choice → signup → …`). Early, before the user invests
   in the body-stats steps, matching Yazio's funnel position.
2. **Options derived from the adapter registry.** The selectable apps come
   from `REGISTERED_ADAPTERS` via the shared `buildAppChoiceOptions()`
   helper (`src/lib/onboarding/appChoiceOptions.ts`). Only apps with a
   live adapter are shown with an "import your export" affordance — **no
   dead options.** Today that's MyFitnessPal (first — priority cohort),
   Lose It, Cronometer, MacroFactor, plus two always-present non-adapter
   tiles: "Another app" (`other`) and "I'm starting fresh" (`none`). When
   a new adapter lands, the picker follows automatically.
3. **Capture, don't gate.** Picking an app is optional — `canAdvance` is
   always true, mirroring Welcome / data-bridges. Recording the choice is
   the goal. The choice is stored in `state.appChoice` and emitted as
   `onboarding_app_choice` (`{ app, has_importer, platform }`).
4. **Hand-off to the importer.** When the user picked an *importable* app,
   the terminal data-bridges step floats the CSV importer card to the top
   of the stack and the card leads with their app's name ("Bring your
   MyFitnessPal history"). The display name comes from the adapter
   `displayName` (`appChoiceDisplayName()`) so it never drifts from the
   picker label. The actual upload still happens in data-bridges (already
   auth-gated, already built) — `app-choice` is the capture + routing
   layer, not a second importer.
5. **`onboarding_completed`** also carries `app_choice` so the funnel can
   slice activation by chosen-app cohort (chosen-app → completion →
   first log).

### Flag gate + auto-skip

The step is gated behind the PostHog flag **`onboarding-app-choice`**
(same name web + mobile, per the structural-change flag rule in
`CLAUDE.md`). When the flag is OFF (the live default until it ramps):

- both flow shells **auto-skip** the step — `resolveNextStep` jumps past
  it on forward + back navigation (same mechanism as the maintain/weight
  pace auto-skip), and a defensive effect in each shell advances past it
  if a persisted `step` lands on it;
- the shared `displayPosition` helper **drops it from the "Step N of M"
  total** so the progress bar can't desync from the flow.

`isFeatureEnabled` resolves `false` when PostHog is cold, which is exactly
the safe default (skip) — so a cold-start user just sees the unchanged
pre-ENG-990 flow.

### Why a real step (not a card in data-bridges)

Burying the question at the very end (after the user has already built
their plan) defeats Yazio's insight: the capture should be *early* and
*tailor* the experience. A real step also gets the flow shell's
back/forward, persistence, parity machinery, and analytics for free, and
keeps the data-bridges importer as the single upload surface.

## Cross-platform parity

| Surface | Web | Mobile |
|---|---|---|
| Step component | `src/app/components/onboarding/steps/app-choice.tsx` | `apps/mobile/components/onboarding/steps/app-choice.tsx` |
| Tiles + order | `buildAppChoiceOptions()` (shared) | same helper |
| Event | `onboarding_app_choice` `{app, has_importer, platform:"web"}` | same name `{…, platform:"ios"}` |
| Importer pre-highlight | data-bridges leads with chosen app | identical |
| Flag gate | `onboarding-app-choice` | same flag name |

No intentional divergence. (The data-bridges step itself keeps its
documented iOS-only Apple Health card carve-out, unrelated to this work.)

## Validation

- `tests/unit/appChoiceOptions.test.ts` — the option set stays derived
  from the adapter registry (MFP first, two non-adapter tiles last, no
  dead importable tiles); `appChoiceHasImporter` / `appChoiceDisplayName`
  contracts.
- `tests/unit/onboardingAppChoiceWeb.test.tsx` — renders the registry
  tiles, selection writes `state.appChoice` + emits the event with the
  right `has_importer`, reassurance copy branches, and the data-bridges
  pre-highlight.
- `apps/mobile/tests/unit/onboardingAppChoice.test.tsx` — the same
  contract on iOS (`platform:"ios"`).
- `tests/unit/onboardingState.test.ts` — 14-step order, app-choice
  `canAdvance`, `resolveNextStep` flag-gated skip (forward + back), and
  `displayPosition` counting only visible steps.
- `tests/unit/analyticsEvents.test.ts` — `onboarding_app_choice`
  registered with the canonical value.
- Visual: web desktop + mobile-web (`screenshots/web-drive/eng990/`) and
  iOS sim (`apps/mobile/screenshots/agent/eng990-mobile-app-choice*.png`),
  idle + MyFitnessPal-selected, both flag-forced ON.

## Files

- `src/lib/onboarding/state.ts` — `app-choice` step id + label,
  `AppChoice` type, `appChoice` state field + default, `canAdvance` case,
  `ResolveStepOptions` + flag-gated `resolveNextStep` skip,
  `displayPosition` visible-step counter.
- `src/lib/onboarding/appChoiceOptions.ts` — shared registry-derived
  option builder + helpers.
- `src/lib/analytics/events.ts` — `onboarding_app_choice` event.
- `src/app/components/onboarding/steps/app-choice.tsx` — web step.
- `apps/mobile/components/onboarding/steps/app-choice.tsx` — mobile step.
- `src/app/components/onboarding/{context,web-flow,narrative}.tsx` +
  `steps/index.ts` — wiring + flag gate + auto-skip (web).
- `apps/mobile/components/onboarding/{context,mobile-flow}.tsx` +
  `steps/index.ts` — wiring + flag gate + auto-skip (mobile).
- `src/app/components/onboarding/steps/data-bridges.tsx` +
  `apps/mobile/.../data-bridges.tsx` — importer pre-highlight hand-off.
- `src/app/components/imports/MfpCsvImportCard.tsx` +
  `apps/mobile/components/imports/MfpCsvImportCard.tsx` — `highlightApp`
  prop.
- Tests + this doc.

## Out of scope (follow-ups)

| Item | Why deferred |
|---|---|
| GLP-1 goal branch | Separate Yazio borrow (`§7 #3`); its own ticket. |
| Adapters for Lifesum / Noom / WW / FatSecret | The picker surfaces them automatically the moment an adapter lands; until then those switchers pick "Another app". |
| Removing the flag gate | Standard: once the flag holds 100% for two weeks with no regression, drop the gate in a cleanup PR (CLAUDE.md feature-flag rule). |

## Notion mirror

Add a row to the Decisions log DB linking back to this file. The
MFP-refugee capture roadmap item should reference ENG-990 as the
front-of-funnel capture for the existing CSV import.
