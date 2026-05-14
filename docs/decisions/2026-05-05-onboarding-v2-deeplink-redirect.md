# /onboarding-v2 deep-link redirect (2026-05-05)

**Status:** Resolved.
**Authority:** 2026-05-05 full-sweep audit (finding A3, P0).
**Owner:** Grace / executor.

## Problem

The mobile route `/onboarding-v2` was renamed to `/onboarding` on
2026-04-30 (commit log `09_onboarding`). The route file itself was
deleted, but every deep-link to `suppr:///onboarding-v2` continued
to land on Expo Router's `+not-found` 404 ("We couldn't find that.
The link may be stale or the recipe may have been deleted").

Three pieces of test infrastructure still opened the dead link:

- `apps/mobile/.maestro/00b_screenshot_tour_extended.yaml:226`
- `apps/mobile/.maestro/00c_onboarding_v2_steps.yaml:35`
- `apps/mobile/scripts/capture-every-route.sh:122`

The 2026-05-05 supplemental audit captured 13+ screenshots of the
404 across the onboarding step capture (`onb-03-goal.png` through
`onb-15-recipes.png`) — what should have been the onboarding flow
was the 404 page in every shot.

The risk that pushed this to P0: AsyncStorage scratchpad key
`suppr.onboarding-v2.state` is still referenced by
`apps/mobile/components/settings/SettingsBundleContent.tsx`. While
that key is intentionally kept (the rename of the storage key is
deferred per `project_v2_rename_pending.md`), any future drift —
push-notification scaffolding, marketing email link, bookmark — that
fed `suppr:///onboarding-v2` would 404 in production.

## Fix

Three coordinated edits:

1. **`apps/mobile/app/onboarding-v2.tsx` (NEW).** A one-line Expo
   Router `<Redirect href="/onboarding" />` screen. Defensive — the
   file is intended to live indefinitely. Cost of removing it is a
   404 for any historical link.

2. **Test infra callsites updated** to use the canonical
   `suppr:///onboarding` URL directly, not the redirect:
   - `00b_screenshot_tour_extended.yaml`
   - `00c_onboarding_v2_steps.yaml`
   - `capture-every-route.sh` (label adjusted to
     `onboarding-v2-redirect` and `onboarding-canonical` so the
     captured PNGs make their purpose obvious)

3. **Vitest regression test** at
   `apps/mobile/tests/unit/onboardingV2Redirect.test.ts` — pins the
   redirect file's existence and asserts the `href` is `/onboarding`
   (not `/login` or self-referential).

## Validation

- Sim screenshot: opening `suppr:///onboarding-v2` now lands on the
  onboarding welcome ("Eat well, without overthinking it." with the
  Imported recipe card and "Get started" CTA). See
  `/tmp/sim-check/after-A3-onboarding-v2.png`.
- Vitest passes (2/2).
- Mobile `tsc --noEmit` clean.

## What I did NOT change (deliberately)

- The AsyncStorage key `suppr.onboarding-v2.state` is kept. Renaming
  it would orphan in-flight onboarding sessions for any user with
  partial onboarding state on disk. Per memory
  `project_v2_rename_pending.md`, the full v2 → canonical rename is
  scoped as a focused multi-hour PR, not piecemeal.
- The `lib/onboarding.ts` file comment about "Renamed 2026-04-30
  from `onboarding-v2.ts`" is kept — historical breadcrumb.
- `00c_onboarding_v2_steps.yaml`'s filename (with `_v2_` in it) is
  kept. Maestro flow filenames are the suite's own convention; not
  user-facing.

## Cross-platform

Mobile-only — there is no equivalent dead-link surface on web.

## End-of-life

**Target removal date:** 2026-07-31 (~ 12 weeks after the redirect
shipped on 2026-05-05). Rationale:

- The redirect catches users running a TF build cached with the old
  `/onboarding-v2` deep-link. TF builds typically rotate every 2-4
  weeks; by end of July, every active tester will have run a build
  that already points at the canonical `/onboarding`.
- The `onboarding_v2_redirect_followed` PostHog event (shipped in
  the same audit batch) gives an EOL signal. If hit-count drops to
  ~0 across a 14-day window before 2026-07-31, the redirect and the
  route file can be deleted ahead of schedule.
- After removal, `/onboarding-v2` 404s naturally via the Expo Router
  NotFound fall-through. That is the desired end state — the route
  should not live indefinitely.

When the EOL date arrives: delete `apps/mobile/app/onboarding-v2.tsx`,
the redirect import, and the `onboarding_v2_redirect_followed`
analytics event definition. Update memory `project_v2_rename_pending.md`
to mark fully complete.

## Closes

- Audit finding A3 (P0)
- Notion task [`Audit P0] A3`](https://www.notion.so/35759b41503081708609da42e92fc599) → mark Done
- Removes the orchestrator's mis-flagged `SettingsBundleContent.tsx`
  reference as a user-facing risk; that line is an AsyncStorage key
  string, not a router deep-link.
