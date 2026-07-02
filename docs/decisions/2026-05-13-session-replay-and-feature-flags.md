# Decision — Session replay + feature flags as standing rules

**Date:** 2026-05-13
**Author:** Grace (in conversation with Claude)
**Status:** Resolved
**Area:** Analytics / release process

## What changed

Two PostHog capabilities flipped from "wired but unused" to "standing rules":

1. **Session replay** — recording of rendered UI, scrubbable in PostHog.
2. **Feature flags** — gated rollout for any visual or structural change.

## Why

The 2026-05-13 conversation surfaced a real gap: Claude had been
running `npm run ci` (typecheck + vitest + Maestro flow validation)
and treating green as enough to push UI changes. No before/after
screenshots, no sim validation. Five session-of-the-day commits
landed without a visual audit trail. That violated the standing
rules in `feedback_visual_validation_mandatory.md` and
`feedback_validate_in_sim_before_push.md`.

Grace asked whether Qase or PostHog would help. Qase is a process
tool (test case management) that doesn't capture pixels. PostHog
already had the capability — both session replay (mobile shipped
2026-05-11; web missing) and feature flags (helper functions
existed, never adopted as a rule) — and just needed the rule
flipped.

Session replay catches retroactively what screenshots catch
proactively. Feature flags are the actual *prevention* tool — they
let a risky visual or structural change ship behind a flag, roll to
a 10% slice, watch for regressions, then ramp.

## What this commit lands

### Web session replay enable

`src/app/components/AnalyticsProvider.tsx` now passes a
`session_recording` config to `posthog.init()` and explicitly sets
`enable_recording_console_log: false`. P0 security posture mirrors
the mobile commit shipped 2026-05-11:

- `maskAllInputs: true` — auth, payment, weight, body-stats inputs
  stay masked at capture.
- `maskTextSelector: ".ph-mask"` — surfaces can opt extra elements
  into masking by adding the `ph-mask` className.
- `enable_recording_console_log: false` — the web console emits
  Supabase RLS errors, vendor API error bodies, unredacted
  recipe / food-search payloads. Default capture would embed those
  strings in the replay segment. Belt-and-braces with the
  project-level `consoleLogRecordingEnabled` toggle.

Consent gating is unchanged — the existing
`opt_out_capturing_by_default` + `opt_in_capturing` flow already
covers replay (PostHog's session-recording layer honours the same
opt-out as event capture).

### Mobile session replay

Already shipped 2026-05-11 in `apps/mobile/lib/analytics.ts` with
the same P0 posture. No change needed.

> **Update 2026-07-01 (ENG-1286):** mobile capture + replay are now
> consent-gated like web — `getPostHogClient()` stays null until the
> stored choice in `apps/mobile/lib/analyticsConsent.ts` is
> "accepted". See `2026-07-01-mobile-analytics-consent-gate.md`.

### Privacy policy

`app/privacy/page.tsx` PostHog row updated:

> Product analytics + session replay (if not opted out) — Event
> names, device id, page views, replay of UI interactions with
> form inputs masked

The "if not opted out" language was already present and continues
to govern.

### Feature flags as a standing rule

`CLAUDE.md` adds a non-negotiable rule:

> **Visual or structural changes ship behind a feature flag.** Use
> `isFeatureEnabled("flag-name")` from `@/lib/analytics` (web) or
> the mobile equivalent. Gate the new path, leave the old path
> alive, ramp via PostHog dashboard.

Helper functions already exist (`src/lib/analytics/track.ts#isFeatureEnabled`,
`apps/mobile/lib/analytics.ts#isFeatureEnabled`). The rule is to
adopt them — not to add new infrastructure.

## Out of scope (separate workstreams)

- Maestro / Playwright screenshot capture pipeline (still on the
  audit backlog).
- Qase setup (deferred — overlapping value, more setup overhead).
- PostHog dashboard configuration of which flags exist and their
  default rollouts. Grace owns the dashboard.

## What's required of future PRs

Any PR that touches visual or structural code (not pure logic /
copy):

1. Wrap the new path in `isFeatureEnabled("scoped-flag-name")`.
2. Create the flag in PostHog dashboard with default OFF and a
   10% rollout cohort (or 100% to Grace's user id during pre-
   launch).
3. Leave the old path intact behind the flag's `else` branch.
4. Document the flag in the PR description: name, what it gates,
   ramp plan.
5. Once the flag has been at 100% for two weeks with no
   regression, the gate can be removed in a follow-up cleanup PR.

## What this does NOT replace

The visual-validation-mandatory rule still stands. Session replay
catches issues after they hit a user; the rule is to catch them
*before*. Replay is the safety net, not the gate.
